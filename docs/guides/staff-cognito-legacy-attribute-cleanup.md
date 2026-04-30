# Staff Cognito Legacy Attribute Cleanup

Status: current operational guide for auditing and retiring deprecated staff Cognito custom attribute values.
Last updated: 2026-04-30

## Purpose

PATH staff region and staff-profile identity are database-backed. Cognito remains the source of truth for authentication and staff role groups, but staff scope must come from `staff_profiles.region_id` and `staff_region`, not Cognito custom attributes.

The legacy staff custom attributes are:

- `custom:region_id`
- `custom:user_id`

Current backend code must not read those attributes for staff authorization, staff-profile identity, or region backfill. If values remain visible in the AWS Console, treat them as deprecated residue.

## What Can And Cannot Be Removed

Cognito user pool custom schema attributes generally remain part of the pool schema once created. The practical cleanup is to delete per-user values with `AdminDeleteUserAttributes`; this removes the values from future tokens and from the user attribute list, but it does not remove the custom attribute definition from the pool.

Use the repo helper:

```bash
scripts/audit-staff-cognito-legacy-custom-attrs.sh --env dev
```

Default mode is read-only. It lists users that still carry `custom:region_id` or `custom:user_id`.

To clear DEV values after validating DB-backed region assignments:

```bash
scripts/audit-staff-cognito-legacy-custom-attrs.sh --env dev --apply --yes
```

Do not run the TEST or PROD `--apply` path until the release owner explicitly approves it:

```bash
scripts/audit-staff-cognito-legacy-custom-attrs.sh --env test
scripts/audit-staff-cognito-legacy-custom-attrs.sh --env prod
```

## Preflight Before Clearing Values

Before applying cleanup in any environment:

1. Confirm the code release that ignores staff Cognito custom claims is deployed.
2. Export or screenshot the dry-run output for audit.
3. Verify affected users have correct DB-backed rows:

```sql
SELECT id, email, cognito_sub, primary_role, region_id, status
FROM staff_profiles
WHERE LOWER(email) = LOWER('user@example.org');

SELECT staff_profile_id, region_id
FROM staff_region
WHERE staff_profile_id = <staff_profile_id>;
```

4. Repair missing `staff_profiles.region_id` / `staff_region` assignments through Manage Users or reviewed SQL.
5. Apply Cognito attribute cleanup only after DB-backed assignments are correct.

## DEV Cleanup Baseline

On 2026-04-30, a DEV dry-run against pool `ca-central-1_inn3R0tte` with AWS profile `nwac-test` found 11 users with `custom:region_id` values and no `custom:user_id` values. Those per-user DEV values were cleared the same day with `AdminDeleteUserAttributes`, and a follow-up dry-run returned zero users with deprecated custom attribute values.

TEST and PROD Cognito user attributes were not changed during this cleanup.

## TEST And PROD Release Plan

For TEST:

1. Deploy the auth cleanup code.
2. Run the script in dry-run mode only.
3. Compare affected Cognito users to `staff_profiles` / `staff_region`.
4. Repair DB assignments.
5. Clear per-user Cognito values only after explicit approval.

For PROD:

1. Complete DEV and TEST validation first.
2. Take the normal PROD release path for the code change.
3. Run PROD dry-run only and capture the output.
4. Repair DB assignments if any are missing.
5. Schedule and approve the per-user Cognito cleanup separately from the code deploy.
