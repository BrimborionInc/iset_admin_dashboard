# Public Portal Legacy Fallback Security Review - 2026-04-25

Purpose: durable assessment of legacy compatibility and identity-fallback risks in the applicant-facing public portal, especially paths that could expose client data to the wrong portal account.

## Trigger

The 2026-04-23 secure-message incident proved that old identity-domain assumptions could route applicant-origin messages to the wrong local `user.id`. The specific repaired bug treated `iset_case.assigned_to_user_id` (`staff_profiles.id`) as a shared `user.id`, which collided with applicant user IDs.

This review looked for the same pattern in the current deployed public portal (`../ISET-intake`), plus a targeted scan of the parked rebuild (`../iset-public-portal`) because that code could become future portal surface if it is deliberately revived later.

## Deployed Code Determination

The current TEST/PROD public portal code is `../ISET-intake`.

Evidence:

- `admin-dashboard/scripts/path-deploy.js` sets `PORTAL_ROOT` to `../ISET-intake`.
- TEST deploy calls `../ISET-intake/scripts/deploy-portal-test.ps1`.
- PROD deploy calls `../ISET-intake/scripts/deploy-portal-prod.ps1`.
- The deployed instance bootstrap installs the portal artifact under `/opt/nwac/portal` and links it so sibling references resolve as `/opt/nwac/ISET-intake`.

`../iset-public-portal` is not the active deploy target. Treat it as parked experimental/rebuild code until the deploy path is intentionally changed.

## Assessment

Bill's concern is valid. The exact numeric `staff_profiles.id` / `user.id` message-recipient bug appears fixed in current deployed portal messaging paths, but the live portal still contains high-risk legacy fallback logic. The highest-risk remaining class is not the message list/detail queries themselves; it is identity and client-link resolution before those queries run. If authentication maps a Cognito principal to the wrong local `user.id`, or if portal login links a principal to the wrong `client`, otherwise-scoped routes can still show the wrong applicant's case, messages, documents, or messaging context.

## Current Positive Findings

- Applicant message list/detail routes now require the authenticated local user to be the sender or recipient before returning messages.
- Applicant message replies now validate that the reply target belongs to the authenticated user and the current case/application context.
- The direct 2026-04-23 compose bug is mitigated by resolving the assigned staff profile to a staff local user before inserting new applicant messages.
- Submitted application detail, signing-request, and document list/download routes are mostly scoped by `req.user.userId` once authentication resolves to the correct local user.

These positives do not remove the need to harden identity resolution. They mean the current exposure risk concentrates in legacy linking and fallback paths.

## Findings

### 1. High - Cognito authentication still falls back from subject to email

In `../ISET-intake/auth/cognitoAuth.js`, `ensureLocalUser` first looks up the local `user` row by `cognito_sub`, then falls back to `user.email`. If an email row exists, the function returns that row's `id` even when the row already has a different non-empty `cognito_sub`.

Risk: a valid Cognito token can be mapped to an existing local `user.id` by email rather than immutable subject. Since all applicant portal routes use `req.user.userId` as the security boundary, this can become a cross-account data exposure if old data, cross-pool trust, account reuse, or a misbound row exists.

Relevant code:

- `../ISET-intake/auth/cognitoAuth.js` `ensureLocalUser`
- `../ISET-intake/auth/cognitoAuth.js` additional client ID handling
- `../ISET-intake/server.js` applicant routes that trust `req.user.userId`

Fix pass status: addressed locally on 2026-04-25 in `../ISET-intake/auth/cognitoAuth.js`. Email linking is now limited to unbound legacy rows, refuses rows already bound to a different `cognito_sub`, refuses applicant email linking when the email belongs to `staff_profiles`, and maps underscore-style staff Cognito groups such as `System_Administrator` / `NWAC_Administrator` / `Regional_Manager` / `ISET_Coordinator` as admin/staff roles instead of applicants.

### 2. High - Portal client matching can overwrite existing client ownership

In `../ISET-intake/server.js`, `ensureClientForUser` tries several fallback matches after Cognito-sub lookup: pinned transient state, SIN hash, old submission payload SIN, contact email, name plus DOB, and name-only when DOB is null. If any fallback matches, `updateClientCognitoSub` writes the current Cognito sub onto that `client`. The current update condition permits overwriting an existing different `client.applicant_cognito_sub`.

Risk: a portal account can become linked to the wrong client record through stale transient state or weak fallback matching. Once linked, messaging context can select that client's preferred case, and uploads/documents can be attached to that client/application context.

Relevant code:

- `../ISET-intake/server.js` `updateClientCognitoSub`
- `../ISET-intake/server.js` `ensureClientForUser`
- `../ISET-intake/server.js` `resolveApplicantMessagingContext`
- `../ISET-intake/server.js` `fetchLinkedApplicantClientId`

Fix pass status: addressed locally on 2026-04-25 in `../ISET-intake/server.js`. Portal client resolution now trusts only a pinned client that is unbound or already bound to the same Cognito subject, an existing `client.applicant_cognito_sub` match, or a newly created client row. It no longer claims existing clients by SIN hash, old submission payload SIN, contact email, name plus DOB, or name-only fallback; and it refuses to overwrite an existing different `client.applicant_cognito_sub`.

### 3. High - Staff-profile-to-user resolution still falls back by email

The fixed applicant-message compose path now resolves the assigned `staff_profiles.id` to a shared `user.id`, but `resolveOrCreateUserIdForStaffProfile` still falls back from `staff_profiles.email` to any row in the shared `user` table. There is no staff/applicant discriminator in that table.

Risk: if the staff local user row is missing, stale, or misbound, a staff profile email collision can still route new applicant messages to the wrong shared `user.id`. This is the same family as the breach, with email fallback instead of numeric ID fallback.

Fix pass status: addressed locally on 2026-04-25 in `../ISET-intake/server.js`. Staff recipient resolution now requires `staff_profiles.cognito_sub`, resolves by that subject, creates a staff local user with that subject when needed, and refuses duplicate-email fallback instead of returning an arbitrary shared `user` row.

### 4. High/Medium - Legacy application create endpoint trusts caller-supplied `user_id`

`POST /api/applications` is a legacy route and the current portal frontend does not appear to call it. The route still accepts `user_id` from `req.body`, requires it, and inserts that value into `iset_application`.

Risk: any authenticated portal user who can call the endpoint directly can create a legacy application row under another user's ID. This is data-corruption risk and could become exposure risk if any legacy application views or downstream jobs trust the inserted owner.

Fix pass status: addressed locally on 2026-04-25 in `../ISET-intake/server.js`. The route now returns `410 legacy_endpoint_retired` instead of accepting caller-supplied `user_id`.

### 5. Medium - Public portal accepts additional Cognito clients without applicant-role enforcement

The deployed portal auth accepts `COGNITO_ADDITIONAL_CLIENT_IDS`, and the production env labels this as cross-trust for the admin pool. Public routes require only a valid token and local user mapping; they do not reject `Admin` or staff-role tokens at the route middleware layer.

Risk: cross-pool acceptance amplifies the email-fallback and shared-user-table risks. Even if staff cannot practically navigate the applicant UI, a valid accepted token should not be enough to enter applicant-owned routes unless the token belongs to the applicant identity domain.

Fix pass status: addressed locally on 2026-04-25 in `../ISET-intake/server.js` and `../ISET-intake/auth/cognitoAuth.js`. Applicant data routes now require both the Applicant role and the primary applicant portal Cognito client ID after authentication, while explicit `/api/admin/*` portal-admin paths remain available for admin-only portal operations. Production config should still be reviewed to decide whether `COGNITO_ADDITIONAL_CLIENT_IDS` / cross-trust remains necessary, but additional clients are no longer accepted for applicant data routes.

### 6. Low/Medium - Stale frontend and legacy compatibility surfaces remain

The current frontend still sends a `userId` query parameter to `/api/messages`, and compose/upload code still carries legacy direct-upload and old recipient assumptions. The backend currently ignores or revalidates the riskiest fields, so these are not the primary exposure issues.

Risk: stale client-side assumptions make future regressions more likely, especially if a later change starts trusting a previously ignored parameter.

Fix pass status: partially addressed locally on 2026-04-25 in `../ISET-intake/src/components/Header.js`; the header no longer sends a stale `userId` query parameter to `/api/messages`. Other cleanup remains non-urgent after the backend hardening.

### 7. Not deployed, but unsafe - Newer rebuild repo is not production-ready

The newer `../iset-public-portal` API is not the deployed portal according to current guidance, but it has several security blockers if it is ever promoted:

- `x-user-id` / `x-user-email` header impersonation is accepted in `resolveSession` without an obvious environment gate.
- `/api/admin/upload-config` GET/PATCH routes are unauthenticated.
- Cognito issuer construction appears to derive a user pool ID from the app client ID.
- Authorization returns Cognito `sub` as `session.userId`, while MySQL persistence repositories require numeric local user IDs.

Recommended fix: keep this repo out of any deployment path until dev header impersonation is disabled in production, admin routes require authorization, Cognito verification uses the real user pool ID, and repository identity semantics are redesigned around explicit local-user resolution.

## Immediate Fix Order

1. Harden `ensureLocalUser`: no email fallback to an already-bound row; no staff/admin token acceptance on applicant routes.
2. Harden staff-profile recipient resolution: no arbitrary shared-user email fallback for staff messaging recipients.
3. Harden client linking: do not overwrite `client.applicant_cognito_sub`; remove weak portal-side client fallback matches.
4. Retire or auth-bind `POST /api/applications`.
5. Add regression tests for all four items.
6. Run a data audit for staff/applicant email collisions, mismatched `cognito_sub` rows, client records with suspect `applicant_cognito_sub`, and messages whose recipient does not match the assigned staff-user resolution.

## Suggested Regression Tests

- `ensureLocalUser` refuses to return a `user` row by email when that row has a different `cognito_sub`.
- applicant routes reject a token mapped to staff/admin groups.
- staff profile message-recipient resolution does not return an applicant `user` row by email.
- `updateClientCognitoSub` refuses to overwrite an existing different subject.
- `ensureClientForUser` does not link by name-only or contact-email fallback during normal authenticated portal use.
- legacy `POST /api/applications` ignores or rejects body `user_id`.

## Deployment Assessment

The first local hardening pass was implemented on 2026-04-25 in `../ISET-intake` and deployed to TEST as public-portal-only release `portal-security-hardening-20260425-test`. During TEST validation, a staff/admin or wrong-client sign-in surfaced the new applicant-only API gate as a generic dashboard `workflow_schema_error`. That was not a reason to loosen the gate; the follow-up patch changed the API to return `applicant_account_required` and changed the dashboard/form/preview screens to tell the user to sign out and use an applicant portal account.

The follow-up TEST deploy completed on 2026-04-25 as public-portal-only release `portal-security-hardening-message-20260425-test`, artifact `s3://nwac-test-artifacts/portal/portal-20260425-094700.zip`, updating instances `i-09fe8c219a4564040` and `i-0a8be782ed8604211`. The deploy smoke command exited 0 and both `nwac-test-portal-tg` targets were healthy on port 5000.

A later TEST validation with `jack@sillery.co.uk` showed a false applicant-account-required block. Cognito confirmed the account is a confirmed TEST applicant-pool user with no groups, and the TEST portal logs showed `role: 'Applicant'` with `tokenClientMatchesPortal: false`. The likely cause was stale bearer-token precedence over the portal's HttpOnly session cookie. `../ISET-intake/auth/cognitoAuth.js` now prefers the `iset_access` cookie over any `Authorization: Bearer` header for browser portal requests, with a regression test for that precedence. This hotfix was deployed to TEST as public-portal-only release `portal-auth-cookie-precedence-20260425-test`, artifact `s3://nwac-test-artifacts/portal/portal-20260425-100229.zip`; both TEST portal targets were healthy afterward.

PROD promotion is still pending Bill's TEST validation. Before PROD, confirm normal applicant login, dashboard workflow-schema load, intake upload/finalize, submission completion, applicant messaging context, and portal-admin upload-config behavior. When testing with a staff/admin account in the public portal, the expected result is now an applicant-account-required message rather than access to applicant data.
