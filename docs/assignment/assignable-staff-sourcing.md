# Assignable Staff Sourcing Logic

## Purpose
Explain how the frontend receives assignable staff for case assignment.

## Endpoint
`GET /api/staff/assignable`

## Current Logic
1. The request must be authenticated through Cognito.
2. The endpoint queries real `staff_profiles` rows filtered to assignable roles:
   - Program Administrator
   - Regional Coordinator
   - Application Assessor
3. Results are ordered by role and email.
4. Unauthenticated requests fail through normal auth middleware; the endpoint no longer returns placeholder staff identities.

## Future Enhancements
- Add query param `?include=inactive` once staff enable/disable status is tracked.
- Augment roles via configuration rather than hard-coded list.
- Cache staff list in-memory with short TTL (e.g. 30s) to reduce DB load on rapid modal openings.

## Validation Checklist
- Sign in through Cognito -> Open assignment modal -> See real staff emails.
- Sign out -> Assignment fetch is rejected as unauthenticated.

## Related Files
- `isetadminserver.js` (/api/staff/assignable logic)
- `src/widgets/ApplicationsWidget.js` (modal fetch)

## Last Updated
2026-03-24
