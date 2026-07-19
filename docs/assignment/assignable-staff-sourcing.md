# Assignable Staff Sourcing Logic

## Purpose
Explain how the frontend receives assignable staff for case assignment.

## Endpoint
`GET /api/staff/assignable`

## Current Logic
1. The request must be authenticated through Cognito.
2. The endpoint merges enabled Cognito users with active `staff_profiles` rows for the assignable roles:
   - System Administrator
   - NWAC Administrator
   - Regional Manager
   - ISET Coordinator
3. Disabled Cognito users and inactive staff profiles are excluded. Assignment APIs independently reject inactive targets so a caller cannot bypass the list by posting a staff-profile ID directly.
4. Regional Managers can select any active staff member returned by the assignable pool, including another Regional Manager or an ISET Coordinator outside their own region. This changes target selection only; the RM must still have access to the source case through direct assignment or the existing case-region rules.
5. Results are ordered by role and email.
6. Unauthenticated requests fail through normal auth middleware; the endpoint no longer returns placeholder staff identities.

## Future Enhancements
- Augment roles via configuration rather than hard-coded list.
- Cache staff list in-memory with short TTL (e.g. 30s) to reduce DB load on rapid modal openings.

## Validation Checklist
- Sign in through Cognito -> Open assignment modal -> See real staff emails.
- Sign out -> Assignment fetch is rejected as unauthenticated.

## Related Files
- `isetadminserver.js` (/api/staff/assignable logic)
- `src/widgets/ApplicationsWidget.js` (modal fetch)

## Last Updated
2026-07-19
