# TEST Staff Cognito Recovery

Purpose: recover TEST admin/staff accounts when the Admin Users widget shows only a primary region, when Cognito invitation/reset emails do not arrive, or when a staff account is stuck in `FORCE_CHANGE_PASSWORD`.

Last Updated: 2026-04-07

## When to use this

- The `Administrative Users` widget shows only one region for a Regional Manager who should have multiple province/territory assignments.
- A TEST staff user says they are not receiving forgot-password or invitation emails.
- `AdminResetUserPassword` fails with `User password cannot be reset in the current state`.
- A TEST DB refresh or DEV-to-TEST table copy may have overwritten `staff_profiles`.

## Verified TEST pool state

As of 2026-04-02, the TEST staff pool is:

- User pool: `ca-central-1_uvypDUOwa`
- App client: `28pk6qvqhcmagvhoctas5578i3`
- Email sending: `COGNITO_DEFAULT`
- Custom SES sender: none
- Custom message Lambda: none
- Recovery mechanism: `verified_email` only

Implication: a staff user must have `email` plus `email_verified=true` in Cognito before Cognito can send recovery mail.

## Root cause 1: `staff_profiles.cognito_sub` drift

The Admin Users API enriches multi-region access by matching Cognito users to `staff_profiles` on `cognito_sub`, then loading `staff_region` memberships. If the `cognito_sub` in `staff_profiles` is stale, the UI falls back to the single Cognito `custom:region_id` value and shows only the primary region.

Relevant code:

- `src/routes/admin/users.js`
- `docs/AGENTS.md`

### How to verify

Check the DB row:

```bash
scripts/run-test-sql-via-ssm.sh --sql "
SELECT id,email,cognito_sub,primary_role,region_id
FROM staff_profiles
WHERE LOWER(email) = LOWER('user@example.org');
"
```

Check the Cognito record:

```bash
AWS_PROFILE=nwac-test aws cognito-idp admin-get-user \
  --user-pool-id ca-central-1_uvypDUOwa \
  --username user@example.org \
  --region ca-central-1
```

If `staff_profiles.cognito_sub` does not match Cognito `sub`, update the DB row to the Cognito `sub`.

## Root cause 2: Cognito user missing `email` / `email_verified`

Some legacy TEST staff users existed in Cognito with only a `sub` attribute. In that state:

- Cognito has no verified email destination
- forgot-password and invitation delivery will not work
- the pool's `verified_email` recovery mechanism has nothing to send to

### How to verify

```bash
AWS_PROFILE=nwac-test aws cognito-idp admin-get-user \
  --user-pool-id ca-central-1_uvypDUOwa \
  --username user@example.org \
  --region ca-central-1
```

If the user is missing `email` or `email_verified`, fix it with:

```bash
AWS_PROFILE=nwac-test aws cognito-idp admin-update-user-attributes \
  --user-pool-id ca-central-1_uvypDUOwa \
  --username user@example.org \
  --region ca-central-1 \
  --user-attributes \
    Name=email,Value=user@example.org \
    Name=email_verified,Value=true
```

## `FORCE_CHANGE_PASSWORD` recovery rule

For an existing invitation-style Cognito user in `FORCE_CHANGE_PASSWORD`:

- `AdminResetUserPassword` is not the right tool
- Cognito can reject it with `User password cannot be reset in the current state`

Use one of these instead.

### Preferred: resend the Cognito invite

```bash
AWS_PROFILE=nwac-test aws cognito-idp admin-create-user \
  --user-pool-id ca-central-1_uvypDUOwa \
  --username user@example.org \
  --region ca-central-1 \
  --message-action RESEND \
  --desired-delivery-mediums EMAIL \
  --user-attributes \
    Name=email,Value=user@example.org \
    Name=email_verified,Value=true
```

This keeps the user in `FORCE_CHANGE_PASSWORD` and sends a fresh temporary-password email.

The `Manage Users > Administrative Users > Resend invite` button now uses this same Cognito `RESEND` path in-app for staff users who are still in `FORCE_CHANGE_PASSWORD`.

### Fallback: set a temporary password manually

If Cognito mail still does not arrive, bypass email delivery:

```bash
AWS_PROFILE=nwac-test aws cognito-idp admin-set-user-password \
  --user-pool-id ca-central-1_uvypDUOwa \
  --username user@example.org \
  --password 'TempPasswordHere123!' \
  --no-permanent \
  --region ca-central-1
```

Then send the temporary password to the user out-of-band. On first sign-in, Cognito should require them to choose a new password immediately.

## Historical TEST fixes on 2026-04-02

The following stale `staff_profiles.cognito_sub` rows were corrected in TEST by syncing them to the live TEST Cognito pool:

- `acurtis@nwac.ca`
- `emarion@nwac.ca`
- `mcoppola@nwac.ca`
- `sstacey@nwac.ca`
- `aws@sillery.co.uk`
- `iset@awentech.ca`

This restored proper multi-region display for Regional Managers whose `staff_region` mappings were already correct in the DB.

## Practical recovery order

1. Verify the Cognito user attributes and status.
2. If `email` / `email_verified` are missing, add them first.
3. If the app UI is showing only a primary region, compare Cognito `sub` to `staff_profiles.cognito_sub` and sync the DB row if needed.
4. If the user is in `FORCE_CHANGE_PASSWORD`, use `admin-create-user --message-action RESEND`.
5. If mail still does not arrive, use `admin-set-user-password --no-permanent` and give the temporary password directly.
