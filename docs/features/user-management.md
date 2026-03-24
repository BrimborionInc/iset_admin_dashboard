# User Management Overview

_Last updated: 24 March 2026_

## High-level flow

* The Manage Users dashboard (`src/pages/manageUsers.js`) is the single front-end surface for Cognito-backed staff management.
* All CRUD actions call `/api/admin/users…` endpoints implemented in `src/routes/admin/users.js`.
* Cognito remains the source of truth for authentication + group membership. MySQL tables (e.g. `staff_profiles`) hold the operational mapping and staff identity details (such as `display_name`) used throughout the admin experience.

## Front-end behaviour

### Data loading
* On mount the dashboard calls `GET /api/admin/users`.
* Results come directly from Cognito groups. The UI applies local filtering, searching (debounced), quick filters, and renders a board with metrics/audit log panels.

### Actions available from the page
* **Create user** – opens a modal requiring email + name + role (display name optional), optional region (for regional roles). On submit:
  - POST `/api/admin/users`
  - Creates Cognito user with `email_verified=true`, optional `custom:region_id` and `custom:user_id`, adds to the requested group.
  - Seeds `staff_profiles` with `name`/`display_name` at creation time (keyed by Cognito `sub`) to avoid NULL identity fields before first sign-in.
  - The grid is optimistically updated, and an audit entry is appended.
* **Disable / Enable** – calls `PATCH /api/admin/users/:username/disable|enable`.
* **Remove role** – `DELETE /api/admin/users/:username/role` (only available when we can determine the current admin group).
* **Force password reset** – `PATCH /api/admin/users/:username/force-reset`.
* **Resend invite** – `POST /api/admin/users/:username/resend-invite` (placeholder behaviour until SES hooks are wired up).
* **Change role** – opens modal calling `PATCH /api/admin/users/:username/role`, removing the current group and adding the new one.
* Role change and creation forms enforce entering a region for regional roles.

### UX affordances
* The table reflects loading/pending states (`pendingRoutes`) while requests are in flight.
* Flashbar notifications report success/error; an in-memory audit log records recent actions.

## Back-end logic (`src/routes/admin/users.js`)

### Guard matrix
```
SysAdmin           → may create SysAdmin, ProgramAdmin, RegionalCoordinator, Adjudicator
ProgramAdmin       → may create ProgramAdmin, RegionalCoordinator, Adjudicator
RegionalCoordinator→ may create Adjudicator only
Adjudicator        → cannot create users
```
* `normalizeRoleKey` canonicalises friendly labels ("Program Administrator", "System Admin", etc.) before applying the guard.
* Guarding is applied consistently to create, disable (when role provided), and role-change endpoints.

### Endpoints
* **GET /users** – lists Cognito users, enriched with role, status, MFA flag, last sign-in, region (from `custom:region_id`). If Cognito admin configuration is missing, the endpoint now fails explicitly instead of returning mock users.
* **POST /users** – uses `AdminCreateUser`, sets `custom:region_id`, and adds the user to the requested admin group. Region is mandatory for regional roles.
* **PATCH /users/:username/attributes** – updates `custom:region_id` and/or `custom:user_id` via `AdminUpdateUserAttributes`.
* **PATCH /users/:username/role** – removes the user from the existing admin group and adds them to the target group (normalised keys).
* **PATCH /users/:username/disable|enable** – toggles Cognito user status.
* **DELETE /users/:username/role** – removes the user from their admin group (no new group added).
* **PATCH /users/:username/force-reset** – triggers `AdminResetUserPassword`.
* **POST /users/:username/resend-invite** – placeholder; returns a stub response while a custom email flow is pending.
## Relationship to staff_profiles
* Creating users seeds `staff_profiles` with identity details (`name`, `display_name`) at creation time, keyed by Cognito `sub`.
* `staffProfileMiddleware` still upserts operational fields on authenticated requests (cognito `sub`, email, role, `region_id`) and does not need to overwrite `name`/`display_name`.
* `/api/staff/assignable` also ensures staff profiles exist when listing assignable users. Recent fixes ensure we merge into the existing row instead of creating duplicates and prefer the Cognito GUID for `cognito_sub`.

## Testing tips
1. Ensure new Cognito users sign in once so `staff_profiles` captures their GUID and region.
2. Use the browser console to inspect the current auth context:
   ```js
   fetch('/api/auth/me', { credentials: 'include' })
     .then(r => r.json())
     .then(console.log);
   ```
3. Verify case visibility with:
   ```sql
   SELECT id, application_id, assigned_to_user_id FROM iset_case;
   ```
   and compare `assigned_to_user_id` to `staff_profiles.id`.
4. If assignments look wrong, verify there are no stale duplicate `staff_profiles` rows keyed by email instead of Cognito `sub`, then have each user sign in again.

## Open considerations
* New-user invitations still rely on Cognito’s default email; the resend endpoint returns a placeholder response until SES is wired up.
* Role change currently assumes only one admin group per user. If multi-role admin support is required later, the guard and UI need updating.
* Regional coordinators require `custom:region_id`. Make sure to capture that in the create modal and sync it back to Cognito if changed elsewhere.
