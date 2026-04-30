# User Management Overview

_Last updated: 30 April 2026_

## High-level flow

* The Manage Users dashboard (`src/pages/manageUsers.js`) now has two operational areas:
  - `Administrative Users` for staff/admin Cognito group management
  - `Applicant Accounts` for imported participant account creation, invitation, and activation tracking
* Staff/admin CRUD actions call `/api/admin/users…` endpoints implemented in `src/routes/admin/users.js`.
* Applicant-account actions call `/api/admin/applicants…` endpoints implemented in `src/routes/admin/applicants.js`.
* Legacy generic `/api/users` shared-table endpoints are retired. Do not use the mixed `user` table as a staff/applicant directory surface.
* Cognito remains the source of truth for authentication + group membership. MySQL tables (e.g. `staff_profiles`, `staff_region`) hold the operational mapping, staff identity details, and staff-region access used throughout the admin experience.
* For applicant accounts, `client` is the workflow anchor and the legacy `user` table remains the public-portal identity principal.

## Front-end behaviour

### Data loading
* On mount the dashboard calls `GET /api/admin/users`.
* Results come directly from Cognito groups, but the server now scopes the list to the admin roles the current actor is allowed to manage. For example, Regional Managers see only ISET Coordinators in this dashboard.
* The UI applies local filtering, searching (debounced), quick filters, and renders a board with metrics/audit log panels.

### Actions available from the page
* **Create user** – opens a modal requiring email + name + role (display name optional), optional region (for regional roles). On submit:
  - POST `/api/admin/users`
  - Creates the Cognito user with `email_verified=true`, adds the user to the requested group, and persists staff-region access in the database-backed staff profile model.
  - Seeds `staff_profiles` with `name`/`display_name` at creation time (keyed by Cognito `sub`) to avoid NULL identity fields before first sign-in.
  - The grid is optimistically updated, and an audit entry is appended.
* **Disable / Enable** – calls `PATCH /api/admin/users/:username/disable|enable`. The toolbar now enables these buttons only for rows in a matching state (`Enable` for disabled accounts, `Disable` for active/pending ones).
* **Remove role** – `DELETE /api/admin/users/:username/role`. The backend removes all admin-role groups currently attached to the user so stray multi-group states are cleaned up.
* **Force password reset** – `PATCH /api/admin/users/:username/force-reset`. This is intended for active accounts; users already in `FORCE_CHANGE_PASSWORD` should use `Resend invite` instead.
* **Resend invite** – `POST /api/admin/users/:username/resend-invite`. This now performs a real Cognito resend for users still in `FORCE_CHANGE_PASSWORD`, using Cognito `AdminCreateUser` with `MessageAction: RESEND`.
* **Change role** – opens a modal calling `PATCH /api/admin/users/:username/role`, removing all current admin-role groups and adding the selected new one.
* Role change and creation forms show only the roles the current actor is allowed to manage, and enforce entering a region for regional roles.
* Flashbar errors now show the route `detail` message returned by the API instead of generic HTTP-only failures.

### Applicant Accounts tab
* Lists imported or linked applicants by client/case context instead of raw Cognito rows.
* Visible workflow statuses are:
  - `No account`
  - `Ready to invite`
  - `Invitation sent`
  - `Activated`
* **Create account** – silently creates or links the applicant Cognito account and local `user` row with no email sent.
* **Send activation / Resend activation** – PATH sends a branded activation email; the portal then uses the forgot-password APIs behind an activation-specific UI.
* `Application Assessor` users can access the dashboard for the `Applicant Accounts` tab even though they do not have access to staff-user administration.
* The tab is currently the PATH management surface for imported applicant accounts; case-workspace quick actions are still a later extension, not part of the first implementation.

### UX affordances
* The table reflects loading/pending states (`pendingRoutes`) while requests are in flight.
* Flashbar notifications report success/error; an in-memory audit log records recent actions.

## Back-end logic (`src/routes/admin/users.js`)

### Guard matrix
```
System Administrator → may manage System Administrator, NWAC Administrator, Regional Manager, ISET Coordinator
NWAC Administrator   → may manage NWAC Administrator, Regional Manager, ISET Coordinator
Regional Manager     → may manage ISET Coordinator only
ISET Coordinator     → cannot manage administrative users
```
* `normalizeRoleKey` canonicalises friendly labels ("Program Administrator", "System Admin", etc.) before applying the guard.
* The server now resolves the target user's actual Cognito admin group with Cognito `AdminListGroupsForUser` before applying guards. Administrative routes no longer trust `role` or `currentRole` values sent from the browser.
* Staff region access and staff-profile identity for admin users are DB-backed. For staff/admin accounts, treat `staff_profiles.region_id` plus `staff_region` as the operational region source of truth, and `staff_profiles.id` as the staff identity source after Cognito-sub hydration. Do not rely on Cognito `custom:region_id` or `custom:user_id`. The admin auth middleware ignores those legacy staff token claims so missing DB assignments must be repaired in the database/user-management flow, not by signing in.

### Endpoints
* **GET /users** – lists Cognito users, enriched with role, status, MFA flag, last sign-in, and region access from `staff_profiles` / `staff_region`. The response is scoped to roles the current actor is allowed to manage. If Cognito admin configuration is missing, the endpoint fails explicitly instead of returning mock users.
  * Disabled-state note: Cognito models disabled accounts with `Enabled=false` while `UserStatus` may still read `CONFIRMED` or `FORCE_CHANGE_PASSWORD`. The admin API now normalizes those rows to `status = DISABLED` so the dashboard filters/actions stay correct.
* **POST /users** – uses `AdminCreateUser`, adds the user to the requested admin group, and persists the user's region access in `staff_profiles` / `staff_region`. Region is mandatory for regional roles.
* **PATCH /users/:username/attributes** – updates DB-backed region access for Regional Managers and ISET Coordinators, with target-role authorization resolved server-side.
* **PATCH /users/:username/role** – removes all existing admin-role groups from the user and adds the target group (normalised keys).
* **PATCH /users/:username/disable|enable** – toggles Cognito user status, with state checks to reject already-disabled or already-enabled rows.
* **DELETE /users/:username/role** – removes all admin-role groups from the user (no new group added).
* **PATCH /users/:username/force-reset** – triggers `AdminResetUserPassword` for active accounts; pending first-sign-in users are redirected to `Resend invite`.
* **POST /users/:username/resend-invite** – resends the Cognito invitation for users still in `FORCE_CHANGE_PASSWORD`.

## Applicant account lifecycle (`src/routes/admin/applicants.js`)

### Endpoints
* **GET /applicants** – lists client-linked applicant accounts with case, region, case manager, and PATH activation status.
* **POST /applicants/:clientId/create-account** – creates or links the applicant Cognito account silently and seeds/links the local `user` row.
* **POST /applicants/:clientId/send-activation** – sends PATH’s activation email and moves the linked client to `invitation_sent`.

### Import behavior
* Client-file import now attempts silent applicant account creation only when the row has one clean email value.
* PATH does **not** create an applicant account when the email is missing, invalid, ambiguous, or contains multiple values.
* Import still creates the client/case when the row is otherwise valid, but the applicant account is left for later review/manual action.
* Import creates/link the applicant account in the environment-specific applicant Cognito pool resolved from `COGNITO_TRUSTED_POOLS`; it does not send any Cognito welcome mail.

### Portal activation behavior
* PATH does not rely on Cognito welcome emails for imported applicants.
* The invitation email points applicants to `/activate-account` in the public portal.
* The portal wraps Cognito’s forgot-password flow in activation wording and marks the linked client as `activated` on the first successful authenticated session.
## Relationship to staff_profiles
* Creating users seeds `staff_profiles` with identity details (`name`, `display_name`) at creation time, keyed by Cognito `sub`.
* `staffProfileMiddleware` still upserts operational identity fields on authenticated requests (Cognito `sub`, email, role) and resolves the effective `staff_profiles.id`, `region_id`, and `regionIds` from the database-backed staff model. It must not backfill staff identity or region access from Cognito custom token claims.
* `/api/staff/assignable` also ensures staff profiles exist when listing assignable users. Recent fixes ensure we merge into the existing row instead of creating duplicates and prefer the Cognito GUID for `cognito_sub`.

## Testing tips
1. New Cognito users are seeded into `staff_profiles` at creation time; if an older user lacks a row, have them sign in once so the profile captures their Cognito GUID, then assign regions through Manage Users or a reviewed DB repair.
2. Use the browser console to inspect the current auth context:
   ```js
   fetch('/api/auth/me', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log);
   ```
3. Verify case visibility with:
   ```sql
   SELECT id, client_id, assigned_staff_profile_id FROM iset_case;
   ```
   and compare `assigned_staff_profile_id` to `staff_profiles.id`.
4. If assignments look wrong, verify there are no stale duplicate `staff_profiles` rows keyed by email instead of Cognito `sub`, then have each user sign in again.

## Open considerations
* New-user invitations and invite resends still rely on Cognito's default email delivery. If PATH later moves to branded SES/Lambda invite mail, this route should be revisited.
* The current account-management model remains single-role. The backend now cleans up stray multi-group state, but deliberate multi-role admin support would still require a new UX and policy model.
* Region-backed staff roles must have database-backed region access. Regional Managers can have multiple `staff_region` assignments; ISET Coordinators keep a single primary `staff_profiles.region_id` and may also be mirrored into `staff_region` for consistent reads.
