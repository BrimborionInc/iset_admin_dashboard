# Staff Profiles and Role-Based Case Visibility

This document summarizes the current behavior of `staff_profiles` and the related RBAC flows after the March 2026 Cognito-only auth cleanup.

## When `staff_profiles` rows are created
- When an admin creates a staff user via the Manage Users dashboard, the backend seeds `staff_profiles` with `name` / `display_name` keyed by Cognito `sub` so identity fields exist before first sign-in.
- Every authenticated staff request passes through `staffProfileMiddleware`. That middleware upserts the staff row from the real Cognito token context, keeping `cognito_sub`, email, primary role, and `custom:region_id` aligned with the signed-in user.
- There is no longer an IAM-off or dev-bypass path for admin users. Placeholder identities should not be created or relied on.

## Why duplicate rows appeared previously
- `/api/staff/assignable` once used the Cognito username when ensuring staff rows, so repeated reads could insert email-based `cognito_sub` values instead of the stable Cognito GUID.
- The current flow uses real authenticated Cognito identity only and upserts against the GUID-based `cognito_sub`, so assignment lookups no longer depend on placeholder or email-based identities.

## How to clean up legacy rows
1. Reassign any cases that still point at the email-based `staff_profiles` record to the canonical GUID-based record.
2. Delete the duplicate row (leave the GUID row intact). If you remove a user’s row entirely, have them sign in once with IAM on; `staffProfileMiddleware` will recreate it.

## Application visibility rules (RBAC)
- **System Administrator / Program Administrator**: full access to all cases (including unassigned submissions).
- **Regional Coordinator**: sees cases assigned to their region or directly assigned to their staff profile (`sp.region_id = regionId OR assigned_to_user_id = staffProfileId`).
- **Application Assessor**: sees only cases assigned to their `staff_profiles.id`.

Because the API depends on accurate `staff_profiles.region_id`, ensure each coordinator signs in through Cognito at least once after account creation.

## Tips for testing
- After adding a new Cognito user, confirm the `staff_profiles` row exists and sign in once to verify the auth context + assignment flows.
- Run `SELECT id, application_id, assigned_to_user_id FROM iset_case;` to verify assignments line up with the expected staff profile IDs.
- Use `fetch('/api/auth/me', { credentials: 'include' })` in the browser console to inspect the current auth context (role, region, sub) without opening the network tab.
