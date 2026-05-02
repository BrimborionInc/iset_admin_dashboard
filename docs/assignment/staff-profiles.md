# Staff Profiles and Role-Based Case Visibility

This document summarizes the current behavior of `staff_profiles` and the related RBAC flows after the March 2026 Cognito-only auth cleanup.

## When `staff_profiles` rows are created
- When an admin creates a staff user via the Manage Users dashboard, the backend seeds `staff_profiles` with `name` / `display_name` keyed by Cognito `sub` so identity fields exist before first sign-in.
- The Manage Users > Administrative Users profile inspector can update `staff_profiles.name` and `staff_profiles.display_name` for an existing staff account. Those labels are DB-backed operational identity fields, not Cognito custom attributes.
- Every authenticated staff request passes through `staffProfileMiddleware`. That middleware upserts the staff row from the real Cognito token context, keeps `cognito_sub`, email, and primary role aligned with the signed-in user, and resolves effective `userId`, `region_id`, and `regionIds` from `staff_profiles` / `staff_region`. Legacy Cognito `custom:region_id` and `custom:user_id` values are not staff authorization or identity sources.
- There is no longer an IAM-off or dev-bypass path for admin users. Placeholder identities should not be created or relied on.

## Why duplicate rows appeared previously
- `/api/staff/assignable` once used the Cognito username when ensuring staff rows, so repeated reads could insert email-based `cognito_sub` values instead of the stable Cognito GUID.
- The current flow uses real authenticated Cognito identity only and upserts against the GUID-based `cognito_sub`, so assignment lookups no longer depend on placeholder or email-based identities.

## How to clean up legacy rows
1. Reassign any cases that still point at the email-based `staff_profiles` record to the canonical GUID-based record.
2. Delete the duplicate row (leave the GUID row intact). If you remove a user’s row entirely, have them sign in once with IAM on; `staffProfileMiddleware` will recreate it.

## Application visibility rules (RBAC)
- **System Administrator / Program Administrator**: full access to all cases (including unassigned submissions).
- **Regional Coordinator**: sees cases assigned to their region or directly assigned to their staff profile (`sp.region_id = regionId OR assigned_staff_profile_id = staffProfileId`).
- **Application Assessor**: sees only cases assigned to their `staff_profiles.id`.

Because the API depends on accurate `staff_profiles.region_id` and `staff_region` mappings, ensure each coordinator has a local operational row and assign region access through Manage Users or reviewed DB repair. Do not rely on Cognito custom region attributes to seed access.

## Assignment API naming
- New backend code should read/write `assigned_staff_profile_id` / `assignedStaffProfileId` for case ownership.
- In DEV, migration `20260427_0010_retire_legacy_case_assignment_shadow.sql` physically retires the old `iset_case.assigned_to_user_id` column after recording aggregate 0-drift counts. `assigned_to_user_id`, `assignedToUserId`, `assigned_user_id`, and `assignedUserId` remain response/request compatibility aliases only; they carry a `staff_profiles.id` value when emitted.
- Assignment event payloads should prefer `to_assignee_staff_profile_id`, `from_assignee_staff_profile_id`, and `assigned_staff_profile_id`. Older `to_assignee_id` / `from_assignee_id` payload keys are retained only for existing notification templates and historical events.

## Tips for testing
- After adding a new Cognito user, confirm the `staff_profiles` row exists and sign in once to verify the auth context + assignment flows.
- Run `SELECT id, client_id, assigned_staff_profile_id FROM iset_case;` to verify assignments line up with the expected staff profile IDs.
- Use `fetch('/api/auth/me', { credentials: 'include' })` in the browser console to inspect the current auth context (role, DB-backed region, sub) without opening the network tab.
