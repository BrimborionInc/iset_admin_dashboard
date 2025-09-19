# Assignable Staff Sourcing Logic

## Purpose
Explain when the frontend receives placeholder assignees vs real users for case assignment.

## Endpoint
`GET /api/staff/assignable`

## Logic (Post 2025-09-19 Fix)
1. `AUTH_PROVIDER=cognito` AND request authenticated (`req.auth` populated) -> Query real `staff_profiles` filtered to roles:
   - Program Administrator
   - Regional Coordinator
   - Application Assessor
   Ordered by role then email.
2. `AUTH_PROVIDER` NOT `cognito` (IAM off) -> Return three static placeholder identities.
3. `AUTH_PROVIDER=cognito` but unauthenticated AND dev bypass env flags active (`DEV_DISABLE_AUTH=true` or `DEV_AUTH_BYPASS=true`) -> Return placeholders (allows UI render in partially configured dev states).
4. All other cases (e.g. unexpected unauthenticated with IAM on and no dev bypass) -> Also placeholders (fail-safe; avoids exposing partial real list with inconsistent auth state).

## Rationale For Ignoring Dev Bypass When Authenticated
Previously, having any bypass env flag (`DEV_AUTH_BYPASS`, `DEV_DISABLE_AUTH`) forced placeholders even after a valid Cognito token was accepted. That created confusion: real user context existed, but assignment list stayed static. The updated logic prefers actual data once a real token is present.

## Future Enhancements
- Add query param `?include=inactive` once staff enable/disable status is tracked.
- Augment roles via configuration rather than hard-coded list.
- Cache staff list in-memory with short TTL (e.g. 30s) to reduce DB load on rapid modal openings.

## Validation Checklist
- Sign in (IAM on) -> Open assignment modal -> See real staff emails.
- Set `AUTH_PROVIDER=none` -> See 3 placeholder entries.
- Set `DEV_DISABLE_AUTH=true`, do NOT sign in -> placeholders.
- Same env, sign in (token accepted) -> real staff list appears.

## Related Files
- `isetadminserver.js` (/api/staff/assignable logic)
- `src/widgets/ApplicationsWidget.js` (modal fetch)

## Last Updated
2025-09-19
