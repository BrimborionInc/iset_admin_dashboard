# ISET Admin Portal – Cognito + RBAC + Regional Scoping Implementation Plan

Last updated: 2025-08-19

## Objectives
- Configure AWS Cognito for Admin authentication (User Pool + App Client + Hosted UI Domain) with Email OTP MFA.
- Issue tokens containing role and region claims via Pre Token Generation (PreTokenGen) Lambda.
- Enforce authorization in Express API (RBAC + regional scoping) with mandatory DB predicates.
- Wire React Admin to Cognito (OIDC Code + PKCE), in-memory tokens, idle-timeout.
- Ensure auditability and session controls appropriate for Protected B.

## Roles & Delegation
- SysAdmin: Full system access; can create SysAdmins & ProgramAdmins.
- ProgramAdmin: Full data access across regions; can create RegionalCoordinators.
- RegionalCoordinator: Scoped to one region; can view all applications in region; can create Adjudicators (regional staff).
- Adjudicator: Scoped to one region; access only cases assigned to them; no delegation.
- One role per user; hierarchical privilege is explicit, not implicit.

## Assumptions
- Admin backend is `admin-dashboard/isetadminserver.js` (Express + MySQL). Admin React app runs in the same project.
- Regions are finite and stored as `region_id` in DB; null permitted for Sys/Program where global.
- We can add an `admin_user` mapping table (or reuse existing staff tables) to link Cognito user to app DB user and region.

## Ambiguities (to confirm)
- Region model source of truth: do we have a `region` table or derive from PTMA/province? If PTMA is region, confirm mapping.
- Which table represents admin staff today (`iset_evaluators` vs new `admin_user`)? Which is authoritative for role/region?
- Token storage constraints in SPA: acceptable to rely on refresh tokens (≤ 12h absolute)? Any requirement for server-side sessions?

## Risks
- Claims injection in PreTokenGen must respect size and naming; some libraries ignore non-namespaced claims.
- Session invalidation is not instantaneous with JWT; rely on short access TTL and limited refresh TTL.
- RBAC gaps if any route bypasses scoped query helpers; enforce centrally and lint/check.
- Secrets currently in `.env` need rotation and proper .gitignore/secret scanning.

## Repository inventory (likely impacted)
Backend (Admin)
- `admin-dashboard/isetadminserver.js`: add JWT verification, `req.auth`, RBAC enforcement.
- `admin-dashboard/src/middleware/authn.(js|ts)`: Cognito JWT verification via JWKS; audience/issuer checks.
- `admin-dashboard/src/middleware/authz.(js|ts)`: role guards.
- `admin-dashboard/src/lib/rbac.(js|ts)`: role/region policy helpers.
- `admin-dashboard/src/lib/dbScope.(js|ts)`: inject mandatory WHERE clauses for region/assignment.
- `admin-dashboard/src/routes/admin/users.(js|ts)`: delegated user management (Cognito + DB).
- `admin-dashboard/db/migrations/*`: schema changes.

Frontend (Admin)
- `admin-dashboard/src/auth/AuthProvider.(tsx|jsx)`, `auth/cognitoClient.(ts|js)`: Hosted UI integration, PKCE, token lifecycle, idle-timeout.
- Role-aware routing/nav components.

Infrastructure
- `admin-dashboard/infra/terraform/*` or `admin-dashboard/infra/cdk/*`: Cognito User Pool, App Client, Hosted UI domain, SES identity, PreTokenGen Lambda, logging.
- `admin-dashboard/infra/lambda/pre-token-gen/*`: Lambda code to inject claims.

Public Portal (`ISET-intake`)
- No direct change required for this effort.

## Phased implementation
### Phase 0 – Foundations
- Enforce `.gitignore` and secret scanning; rotate any exposed credentials.
- Introduce feature flag: `AUTH_PROVIDER=cognito` for staged rollout.

### Phase 1 – Cognito & Email (IaC)
- Create User Pool “ISET-Admin-Prod” and App Client “iset-admin-console”.
- Hosted UI domain (e.g., `iset-admin.auth.<region>.amazoncognito.com`).
- MFA: Email OTP required every login; TOTP enrollment optional.
- Password policy: ≥ 12 chars; upper/lower/number/special; breached/common password checks.
- Sessions: Access/ID TTL ≤ 60m; Refresh TTL ≤ 12h (absolute session cap).
- SES identity and verified sender; route Cognito emails through SES.
- PreTokenGen Lambda:
  - Read `cognito:groups` -> role; read `custom:region_id`, `custom:user_id` attributes.
  - Override ID/Access token claims with `role`, `region_id`, `user_id`.
- Outputs to app config: Pool ID, Client ID, Region, JWKS URL, Hosted UI URLs.

### Phase 2 – Backend Authentication (Express)
- `authn` middleware: verify JWT via JWKS, validate iss/aud, attach `req.auth = { sub, userId, role, regionId }`.
- Optional sliding idle timeout via activity header; absolute enforced by refresh TTL.
- `authz` middleware + `rbac` helpers for role checks.

### Phase 3 – DB scoping helper + retrofits
- `dbScope` helpers: generate predicate/params for role:
  - SysAdmin/ProgramAdmin: no region filter.
  - RegionalCoordinator: `region_id = ?`.
  - Adjudicator: `region_id = ? AND assigned_to_user_id = ?`.
- Refactor all application/case queries to include scoping; add deny logs for violations.

### Phase 4 – Data model & migrations
- Tables/columns (illustrative; adjust to current schema):
  - `region` (id, code, name, active).
  - `admin_user` (id, cognito_sub UNIQUE, role, region_id FK, app_user_id FK, status, timestamps).
  - `applications`: `ADD region_id INT NOT NULL`, index.
  - `iset_case`: `ADD region_id INT NOT NULL`, index; ensure `assigned_to_user_id` indexed.
- Backfill scripts: derive region_id from PTMA/province or existing mapping; validate counts.
- Enforce NOT NULL post-backfill.

### Phase 5 – Delegated user management (Admin API)
- Endpoints in `routes/admin/users`:
  - POST /users: create Cognito user, set attributes (`custom:region_id`, `custom:user_id`), add to Group, persist mapping in DB.
  - PATCH /users/:id: enable/disable, update role/region (update Cognito Group & attributes).
- Enforce delegation rules:
  - SysAdmin can create/disable SysAdmin & ProgramAdmin.
  - ProgramAdmin can create/disable RegionalCoordinator.
  - RegionalCoordinator can create/disable Adjudicator in their region.

### Phase 6 – React Admin (Hosted UI)
- OIDC Code + PKCE via Hosted UI; configure callback/logout URIs.
- In-memory token storage; refresh silently until absolute cap.
- Idle-timeout (15–30m) with activity tracking and warning modal.
- Role-aware routing/nav; backend remains authoritative for data access.

### Phase 7 – Monitoring, audit, rollout
- Enable CloudTrail and Cognito advanced security; CloudWatch log groups with ≥ 1 year retention.
- App logs: auth success/failure, authz denials, user lifecycle events.
- Staged rollout with `AUTH_PROVIDER=cognito`; start in log-only (shadow) mode, then enforce.
- Backout: flip feature flag.

## Data migrations & rollout plan
DDL (example; refine against live schema)
- `applications`: `region_id INT NOT NULL`, `INDEX (region_id)`.
- `iset_case`: `region_id INT NOT NULL`, `INDEX (region_id)`, `INDEX (assigned_to_user_id)`.
- `region`: seed rows; add FKs where appropriate.
- `admin_user`: link to Cognito sub and existing staff/app user.

Backfill
- Compute `region_id` from existing PTMA/province mapping; dry-run counts per region; then write.
- Populate `admin_user` from existing evaluator/admin sources; link to Cognito after user creation.

Safe rollout
- Ship migrations with columns nullable; backfill; add NOT NULL after verification.
- Deploy auth middleware gated by feature flag; log-only for a period; then enforce.
- Pilot users in production post-verify.

## Testing strategy
Unit
- `rbac` policy matrix tests for all roles/regions/assignment combinations.
- `dbScope` generates correct predicates; prevents injection.
- `authn` JWT tests using stubbed JWKS (good/bad iss, aud, exp).

Integration
- API tests with signed JWTs containing role/region/user claims.
- Negative cases:
  - Adjudicator: other region -> 403
  - Adjudicator: same region but unassigned -> 403
  - RegionalCoordinator: other region -> 403
  - Program/Sys: global -> 200
- User lifecycle endpoints: delegation boundaries enforced.

E2E
- Hosted UI login with Email OTP, refresh flow, idle-timeout, role-aware UI.
- Verify CloudTrail/Cognito advanced logs for key events.

Security & ops checks
- Secret scanning; ensure no tokens/keys in repo.
- CSP and redirect/callback URI validation.
- Log retention configuration and PII minimization in logs.

## Next steps
- Await "PROCEED" to generate:
  - IaC (Terraform/CDK) for Cognito, SES, PreTokenGen Lambda, logging.
  - Express middleware (`src/middleware/authn.ts`, `src/middleware/authz.ts`) and RBAC utilities (`src/lib/rbac.ts`, `src/lib/dbScope.ts`).
  - Admin user management routes (`src/routes/admin/users.ts`).
  - DB migrations and tests.
  - React auth bootstrap (Hosted UI, token handling, role-aware nav).

  ### Environment variables (backend)
  - AUTH_PROVIDER=cognito
  - AWS_REGION=<e.g., ca-central-1>
  - COGNITO_USER_POOL_ID=<pool id>
  - COGNITO_CLIENT_ID=<app client id>
  - COGNITO_ISSUER=https://cognito-idp.<region>.amazonaws.com/<pool id>
  - COGNITO_JWKS_URL=https://cognito-idp.<region>.amazonaws.com/<pool id>/.well-known/jwks.json

  Optional (admin routes):
  - COGNITO_REGION=<if different from AWS_REGION>
