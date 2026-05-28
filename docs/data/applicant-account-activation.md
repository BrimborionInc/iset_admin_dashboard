# Applicant Account Activation Data

_Last updated: 27 May 2026_

## Purpose

This feature supports imported participant/applicant accounts that are created silently in Cognito during client-file import and then activated later by PATH staff through a manual invitation workflow.

PATH is the operational source of truth for invitation and activation status. Cognito remains the identity store.

## `client` additions

The applicant-account workflow is anchored on `client`, not the legacy `user` table.

Added columns:

- `applicant_cognito_sub` - Canonical Cognito identity link for the applicant pool user.
- `applicant_cognito_username` - Cognito username used for sign-in and forgot-password (`email` in the current pool design).
- `applicant_account_status` - PATH workflow state:
  - `created`
  - `invitation_sent`
  - `activated`
- `applicant_account_email` - Email address PATH used for the linked applicant account.
- `applicant_invited_at` - Last PATH invitation send timestamp.
- `applicant_invited_by_staff_profile_id` - Staff profile that last sent the activation email.
- `applicant_activated_at` - First successful portal-authenticated activation timestamp.

Visible UI labels derive from those stored values:

- No account
- Ready to invite
- Invitation sent
- Activated

## `client_applicant_account_event`

`client_applicant_account_event` stores the audit trail for applicant-account workflow actions.

Current event types:

- `account_created`
- `account_email_changed`
- `invitation_sent`
- `activated`

Invitation events may include Cognito repair metadata such as `cognitoUserStatusBefore`,
`cognitoUserStatusAfter`, and `cognitoTemporaryPasswordRepaired`. This records when PATH
had to convert an older imported Cognito user out of `FORCE_CHANGE_PASSWORD` before the
forgot-password-based activation flow could work.

Columns:

- `id`
- `client_id`
- `event_type`
- `actor_staff_profile_id`
- `metadata_json`
- `created_at`

## `applicant_password_reset_request_audit`

`applicant_password_reset_request_audit` stores public-portal password-reset request attempts for later investigation.

Current sources:

- `/forgot-password`
- `/activate-account`
- `/reset-password` resend

Columns:

- `id`
- `email`
- `request_route`
- `request_flow`
- `source_ip`
- `user_agent`
- `outcome`
- `metadata_json`
- `created_at`

Current outcome values written by the portal:

- `submitted`
- `rate_limited`
- `daily_limit_exceeded`
- `cognito_error`

Notes:

- The audit row is written by the portal server when `/api/auth/forgot-password` is called.
- Route attribution is explicit from the frontend, so activation traffic is distinguishable from normal forgot-password traffic after the fact.
- `metadata_json` may include small delivery or Cognito error details to help explain whether the reset request actually reached Cognito.

## Import behavior

Client-file import may create client/case records without creating an applicant account.

Applicant account creation occurs only when the import row has one clean email value. PATH suppresses account creation when:

- no email is provided
- the email is invalid
- multiple email addresses are supplied
- the email field is partially invalid or ambiguous

When eligible:

- PATH creates or reuses the applicant Cognito user silently
- the applicant pool is resolved from the non-staff entry in `COGNITO_TRUSTED_POOLS`, so DEV / TEST / PROD use their own pool configuration
- no invitation email is sent
- PATH seeds/links the local `user` row so the public portal auth model stays coherent
- PATH updates the `client` workflow fields to `created`

## Activation behavior

PATH sends its own invitation email. The applicant does not receive any Cognito email at import time.

Activation flow:

1. PATH staff selects `Send activation` (or resend).
2. PATH emails an `Activate your account` link.
3. The portal activation page starts the Cognito forgot-password flow behind the scenes.
4. On the first successful authenticated portal session, PATH marks the linked client as `activated`.

Before sending or resending an activation email, the admin backend now checks whether the
linked Cognito applicant user is still in `FORCE_CHANGE_PASSWORD`. Older imported accounts
can get stuck there if they were created with a temporary password before the activation
workflow normalized imported users to permanent random passwords. When found, PATH replaces
that temporary state with an unknown permanent random password. No password is exposed to
staff or the applicant; the applicant still sets their own password through the activation
code flow.

## Manual temporary-password exception

The normal applicant-account recovery path is still activation-code delivery. If Bill or an
authorized PATH owner explicitly approves a one-off exception because Cognito activation-code
email delivery is not reaching the participant, an operator may use Cognito
`admin-set-user-password --no-permanent` to set a temporary password. The public portal
supports Cognito `NEW_PASSWORD_REQUIRED`: the participant signs in with the temporary
password and must choose a new private password before continuing.

Do not store the temporary password in PATH notes, report notes, docs, or SQL artifacts.
Record only that the exception was used, who approved it, the account/email, and that Cognito
was verified in `FORCE_CHANGE_PASSWORD`. Staff should not resend the PATH activation link
after the temporary password is set, because the normal resend path intentionally repairs
`FORCE_CHANGE_PASSWORD` accounts back to the activation-code flow.

## Correcting an unactivated account email

Case Header quick actions include `Change PATH account email` while the linked applicant
account is not activated. This is the operational repair path when an imported or manually
edited participant email was wrong and an activation invitation would otherwise keep using
the old account address.

The correction path:

- validates that no other client or local applicant user already owns the corrected email
- creates or reuses the corrected applicant-pool Cognito user without sending Cognito mail
- repoints the local portal `user` row and `client` applicant-account fields to the corrected Cognito identity
- updates `address_json.contact.email` and `emailNormalized`
- resets the PATH invitation state to `created`, clearing the previous invited timestamp/staff marker
- attempts to delete the old typo Cognito user when it is a different unactivated identity
- records `client_applicant_account_event.event_type = account_email_changed` with old/new email and Cognito metadata

Staff should send the activation email again after saving the corrected address.
