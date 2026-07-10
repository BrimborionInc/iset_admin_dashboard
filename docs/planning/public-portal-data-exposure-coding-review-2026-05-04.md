# Public Portal Data Exposure Coding Review - 2026-05-04

Status: current; first review pass complete, code fixes revalidated 2026-07-10, open findings and live-denial coverage remain pending

Purpose: persistent review log for coding/model errors in the deployed public portal that could cause one applicant to see another applicant's or staff-only information.

Audience: developers, security reviewers, and future AI threads continuing the review.

## Trigger

Bill requested a systematic public portal review after the secure-message incident where a message intended for case managers appeared in an applicant inbox because legacy code confused `staff_profiles.id` with shared `user.id`.

This review is intentionally broader than classic endpoint vulnerability testing. It looks for fundamental coding errors, legacy compatibility assumptions, unsafe identity-domain joins, broad payloads, stale API surfaces, and route composition mistakes that could lead to inappropriate data appearing in an applicant view.

## Scope

- Active deployed public portal code: `../ISET-intake`.
- Admin repo documentation and schema/migration context where needed.
- Public portal features that render data read from the main database.
- Intake schema authoring/runtime payloads are out of scope as requested, except when a non-schema database row stores applicant-specific answers, drafts, uploads, or signing request content.

Out of scope for this document unless a later review explicitly adds it:

- Parked rebuild repo `../iset-public-portal`.
- Admin dashboard staff-only views.
- Purely unauthenticated static content with no database read.
- Live environment denial testing. This document records code review evidence first; live tests can be added later.

## Review Method

1. Inventory public portal UI calls to `/api/*`.
2. For each route family, identify every database read that can influence what an applicant sees.
3. Prove the route's identity boundary from code, not assumptions.
4. Look for legacy-domain mistakes, especially:
   - treating staff profiles and applicant users as one numeric ID space
   - resolving identities by email when Cognito subject is required
   - mixing `client`, `case`, `application`, `submission`, and `user` ownership without a single proven chain
   - trusting mailbox rows, file IDs, tracking IDs, or supplied application IDs without re-resolving applicant scope
   - overfetching full sensitive payloads for badges/counts
5. Record findings as they are discovered, including "no issue found" notes for completed surfaces.

## Exposure Surfaces Under Review

| Surface | Status | Notes |
| --- | --- | --- |
| Identity/session binding | Reviewed | `auth/cognitoAuth.js`, `/api/me`, applicant API gate |
| Secure messages | Reviewed | list/detail/reply/context, message item repair, attachments, signing-request links |
| Signing requests and documents | Reviewed | list/detail/sign, artifact URLs, uploaded-file APIs |
| Dashboard aggregation | Reviewed | draft/submissions/messages/interventions/header counts |
| Submitted application detail | Reviewed | tracking reference lookup and full submitted payload display |
| Draft/intake working state | Reviewed | `input_json_state`, dynamic drafts, resume behavior |
| Interventions | Reviewed | post-approval plan cards and case manager display |
| Public config/support/contact | Reviewed | runtime config, service announcement, AI support, contact submission |
| Legacy/API-only surfaces | Reviewed | routes not currently called by UI but still reachable |

## Findings

Findings are added in severity order within each reviewed surface. Severity reflects likelihood of inappropriate applicant-visible data exposure, not general security severity.

### Patched High-Risk Findings

#### MSG-SR-01 - High - Admin staff-to-applicant message/signing creation can still resolve the participant by applicant email fallback

Evidence:

- `isetadminserver.js` `resolveCaseApplicantMessagingContext()` resolves `applicant_user_id` with `COALESCE(applicant_submission.id, applicant_client_sub.id, applicant_client_email.id, payload_json.submission_snapshot.user_id)`.
- The email leg is `LEFT JOIN user applicant_client_email ON applicant_client_email.email = cl.applicant_account_email`.
- `POST /api/cases/:id/messages` uses that resolved `applicant_user_id` as `recipientId`.
- The same `recipientId` is inserted into `messages.recipient_user_id` with `recipient_actor_type='applicant_user'`.
- Attached forms/signing requests are inserted with `signing_request.participant_user_id = recipientId`.

Why this matters:

The public portal list/detail/sign routes correctly trust `messages.recipient_user_id` and `signing_request.participant_user_id` as the applicant-visible boundary. That means a mistake at row creation time becomes directly visible in the portal.

For normal submitted applications, `iset_application_submission.user_id` wins and this path looks safe. For imported or case-only records without a submission owner or `client.applicant_cognito_sub`, however, admin creation can still bind an outbound secure message and any attached signing requests to whatever shared `user.email` matches `client.applicant_account_email`.

That is the same family as the previous breach: legacy account-link fallback creates an applicant-visible portal row for the wrong `user.id`. The fallback is by email rather than `staff_profiles.id`, but the portal effect is the same if the email points at a different applicant, a duplicate legacy applicant row, or a staff/shared-user row.

Recommended fix:

Make staff-to-applicant secure-message/signing creation fail closed unless the case resolves to a strongly linked applicant account:

- Prefer `iset_application_submission.user_id`.
- Allow `client.applicant_cognito_sub -> user.cognito_sub`.
- Do not resolve `participant_user_id` from `client.applicant_account_email -> user.email` for portal-visible messages/signing requests.
- If imported/client-only cases still need messaging before activation, require an explicit account-linking step that writes `client.applicant_cognito_sub` or otherwise proves the selected applicant user belongs to that client.
- Add a regression smoke/audit query for `messages` and `signing_request` rows whose applicant recipient/participant does not match the case's submission user or client Cognito-sub user.

Fix status (2026-05-04):

- Patched `isetadminserver.js` so `resolveCaseApplicantMessagingContext()` no longer resolves applicant portal recipients from `client.applicant_account_email -> user.email` or `payload_json.submission_snapshot.user_id`.
- Portal-visible message/signing creation now resolves only from `iset_application_submission.user_id` or `client.applicant_cognito_sub -> user.cognito_sub`.
- If both strong sources exist but point at different `user.id` values, message/signing creation fails closed with `applicant_identity_conflict`.

Follow-up audit still needed: run a data audit for existing `messages` and `signing_request` rows whose applicant recipient/participant does not match the case's submission user or client Cognito-sub user.

Deployment status:

- 2026-05-04: deployed to TEST as release `public-portal-exposure-hardening-test` through the normal `path:deploy` admin + portal rollout after a Test and Training maintenance warning. Both TEST admin and portal target groups reported both instances healthy, and on-instance verification confirmed the deployed `applicant_resolution_conflict` marker in admin.

#### UP-01 - High - Document finalization can bind a caller-supplied object key/path to the authenticated user's document row

Evidence:

- `/api/uploads/presign` persists a `pending_uploads` row with `upload_id`, `user_id`, and, in S3 mode, the generated `object_key`.
- `consumePendingUpload()` verifies that the pending upload exists and `pending.userId === req.user.userId`.
- In S3 mode, `consumePendingUpload()` then uses `const objectKey = key || pending.key` and only checks that that object exists in S3; it does not require `key === pending.key`.
- In local-direct mode, `consumePendingUpload()` accepts the caller-supplied `filePath` after verifying only the `uploadId` owner; it does not prove that the path came from the authenticated user's upload.
- `/api/documents/finalize` records `finalPath` into `iset_application_file` for the authenticated user.
- `/api/documents/:id/presign-download` later scopes by the attacker's new `iset_application_file.user_id`, then presigns/downloads whatever `file_path` is stored on that row.

Why this matters:

This creates a path from "I know another object's key/path" to "I can create my own document row pointing at it and download it through my own scoped document endpoint." It is not a simple guessing issue because object keys include date, user id, UUID, and filename, but object keys can leak through logs, support workflows, exported payloads, or other overbroad responses. Once the key is known, the database ownership check is moved to the forged row rather than the original upload provenance.

Recommended fix:

Bind finalization to the pending-upload record:

- In S3 mode, ignore caller-supplied `key` or reject unless it exactly equals `pending.key`.
- In local-direct mode, persist the local upload path on `pending_uploads` or require finalization to recover an existing `iset_application_file` row owned by the same user before accepting `filePath`.
- Add a regression test that creates a pending upload for user A, attempts to finalize with user B's key/path, and confirms the route rejects it and does not insert a user-A document row.

Fix status (2026-05-04):

- Patched `ISET-intake/server.js` so S3 finalization uses the pending upload's stored object key and rejects a caller-supplied different `key` or `filePath`.
- Patched local-direct upload flow so `/api/upload-application-file` can bind the generated local path back to the same user's pending upload token, and `consumePendingUpload()` rejects mismatched local paths when that binding exists.
- Existing local-direct fallback now requires the supplied path to resolve to an existing document/upload row owned by the authenticated applicant before finalization can consume the pending upload.
- Updated the intake file-upload component and secure-message attachment upload path to pass `uploadId` into local-direct multipart uploads.

Follow-up audit still needed: check existing applicant document rows for paths inconsistent with the source upload owner or pending-upload provenance where logs are available.

Deployment status:

- 2026-05-04: deployed to TEST as release `public-portal-exposure-hardening-test` through the normal `path:deploy` admin + portal rollout. Both TEST portal instances contained the deployed `upload_key_mismatch` and `bindPendingUploadLocalPath` markers after rollout.

### Open Findings

#### ID-01 - Low - Frontend auth guard treats any authenticated token as portal-authenticated

Evidence:

- `/api/me` returns `authenticated: true` for any valid hydrated token and separately returns `isApplicantPortalUser` based on Applicant role plus the primary portal client.
- `../ISET-intake/src/AuthContext.js` only checks `{ authenticated, id }` before setting `isAuthenticated=true`; it ignores `isApplicantPortalUser`.
- `../ISET-intake/src/AuthGuard.js` gates protected screens only on `isAuthenticated`.

Why this matters:

Current applicant data APIs are still protected server-side by the `/api` middleware, which rejects non-Applicant roles or non-primary portal clients. So this is not a proven current cross-applicant data exposure by itself.

It is still the wrong UI boundary. A staff/admin token can make the browser render applicant-only shells and attempt applicant DB-backed calls. If a future DB-backed route is registered before the applicant API gate, or if a page consumes a DB-backed public route and assumes AuthGuard already proved applicant identity, this UI-level mismatch could become an inappropriate data-display path.

Recommended fix:

Make the portal frontend distinguish "valid token" from "valid applicant portal account." `AuthContext` / `AuthGuard` should treat `isApplicantPortalUser !== true` as not authorized for applicant-only routes and show the existing applicant-account-required message instead of entering the dashboard shell.

Review status: code review only; no patch applied in this review pass.

#### SM-01 - Medium - Secure-message list route overreturns message bodies to count/table consumers

Evidence:

- `../ISET-intake/server.js` `GET /api/messages` selects `m.body` for every listed message.
- `../ISET-intake/src/components/Header.js` calls `/api/messages` only to compute unread message count.
- `../ISET-intake/src/pages/userDashboard.js` calls `/api/messages` only to compute unread/urgent dashboard banners.
- `../ISET-intake/src/pages/Messages.js` renders folder tables with subject/status/date only; the body is needed by `GET /api/messages/:id`, not by the list view.

Why this matters:

Current list scoping is much stronger than the incident-era path: it uses typed applicant actor predicates plus resolved case/application context. But returning full message bodies from a list endpoint is still a data-minimization error. If any future write path misclassifies a message as applicant-visible, the body becomes available immediately to header/dashboard/list network responses, even if the applicant never opens the message detail page.

This is especially relevant because secure-message bodies may contain staff-only reasoning, decision detail, or document instructions.

Recommended fix:

Split secure-message summary/list/detail payloads:

- Header/dashboard should call a count/summary endpoint that returns only unread/urgent counts.
- `/api/messages` list should omit `body` or return only a deliberately bounded preview if the UX needs one.
- Keep full `body` only on `GET /api/messages/:id` after the existing participant/case/application access checks.

Review status: code review only; no patch applied in this review pass.

#### SR-01 - Medium - Signing-request list route returns artifact URLs to count/summary consumers

Evidence:

- `../ISET-intake/server.js` `GET /api/signing-requests` selects `artifact_url` for every request owned by the current applicant.
- The list route maps every row through `resolveArtifactUrl()`, which generates a presigned S3 download URL when object storage is S3-backed.
- `../ISET-intake/src/components/Header.js` calls `/api/signing-requests` only to compute document badge counts.
- `../ISET-intake/src/pages/Messages.js` calls `/api/signing-requests` only to compute the document-summary panel.
- `../ISET-intake/src/pages/Documents.js` is the page that actually needs completed-document download links.

Why this matters:

The route is scoped by `participant_user_id = req.user.userId`, so this is not a standalone cross-user authorization bug. The problem is data minimization and blast radius. If any creation path misassigns a signing request, header/messages/document-list network responses immediately include generated signed-document download URLs without the applicant opening a document detail/download action.

Recommended fix:

Split signing-request summary/list/detail/download payloads:

- Header/messages should call a count/summary endpoint with only totals/status counts.
- The list endpoint should omit `artifact_url` unless the UI surface is explicitly a document download list.
- Prefer a scoped `GET /api/signing-requests/:id/download` route that verifies participant ownership and generates the presigned URL at click time.

Review status: code review only; no patch applied in this review pass.

#### LG-01 - Low - Stale `GET /api/applications` still uses retired legacy ownership shape

Evidence:

- `POST /api/applications` and `GET /api/applications/by-tracking-id` now return `410 legacy_endpoint_retired`.
- `GET /api/applications` remains reachable behind the applicant API gate.
- The route runs `SELECT * FROM iset_application WHERE user_id = ? ORDER BY created_at DESC`.
- The current documented `iset_application` schema no longer has a `user_id` owner column; canonical applicant ownership is `iset_application.submission_id -> iset_application_submission.user_id` plus client/case lineage.
- No current frontend call to `/api/applications` was found in `../ISET-intake/src`.

Why this matters:

In the current schema this route likely fails rather than returns data. The concern is that it preserves the exact kind of legacy mental model this review is trying to eliminate: treating `iset_application.user_id` as the owner of applicant-visible application rows and returning broad `SELECT *` application payloads from that stale key.

Recommended fix:

Retire `GET /api/applications` with the same `410 legacy_endpoint_retired` response as the companion legacy routes, or replace it with a narrow wrapper around the current `/api/submissions` query that uses `iset_application_submission.user_id = req.user.userId` and returns only dashboard-safe fields.

Review status: code review only; no patch applied in this review pass.

### Reviewed Without Finding

#### Identity/session binding server gate

Evidence reviewed:

- `../ISET-intake/server.js` registers the applicant data API gate before applicant data routes. The gate calls Cognito `requireAuth`, allows only explicit `/api/admin/*` portal-admin paths through as admin, and rejects all other protected API requests unless `req.user.role === 'Applicant'` and the token client matches `COGNITO_PORTAL_CLIENT_ID`.
- `../ISET-intake/auth/cognitoAuth.js` prefers local `user` lookup by `cognito_sub`.
- The remaining email-based first-login link is limited to unbound legacy rows, refuses rows already bound to another Cognito subject, and refuses applicant email linking when the email belongs to `staff_profiles`.
- Duplicate cookie handling and stale bearer precedence have regression coverage in `../ISET-intake/auth/__tests__/cognitoAuth.test.js`.

Conclusion:

No current identity-binding code path was found that repeats the original `staff_profiles.id` / shared `user.id` numeric collision class. The remaining concern is the frontend guard mismatch recorded as ID-01.

#### Secure-message participant and staff-recipient model

Evidence reviewed:

- `resolveApplicantMessagingContext` starts from the authenticated applicant's latest `iset_application_submission.user_id`, then linked `iset_application` / `iset_case`; imported/case-only fallback uses `user.cognito_sub -> client.applicant_cognito_sub`, not email or numeric staff IDs.
- Applicant message reads use `applicantMessageParticipantPredicate`, which requires typed actor fields: `sender_actor_type='applicant_user' AND sender_user_id=?` or `recipient_actor_type='applicant_user' AND recipient_user_id=?`.
- Message list/detail routes additionally require the resolved case and, when present, the resolved application.
- Mailbox `message_item` rows are not trusted by themselves. The list route deletes nonparticipant rows for the current applicant and only seeds rows for typed participant messages.
- `resolveOrCreateUserIdForStaffProfile` resolves staff recipients by `staff_profiles.cognito_sub` only, creates a staff local `user` row with that subject if needed, and refuses duplicate-email fallback.
- Reply/new-message writes derive recipient/case/application via `resolveApplicantOutboundMessageTarget`; caller-supplied recipient/case/application IDs are validated or ignored.
- Attachment adoption for applicant-origin messages requires a pending upload owned by the authenticated user or an already-owned upload path.

Conclusion:

No current public-portal secure-message read/write path was found that repeats the original numeric collision class. The remaining secure-message issue found in this pass is overbroad list payload shape, recorded as SM-01.

#### Public signing-request read/sign routes

Evidence reviewed:

- `GET /api/signing-requests` scopes rows with `WHERE participant_user_id = req.user.userId`.
- `GET /api/signing-requests/:id` loads by id, then rejects the request unless `row.participant_user_id === Number(req.user.userId)`.
- `POST /api/signing-requests/:id/sign` uses the same participant check before accepting the signed payload or generating/storing signed artifacts.
- Funding agreement requests keep case-manager signature tokens in the stored schema for PDF generation, but the applicant detail response runs `hideCfaCaseManagerTokensInStepsForApplicant()` for `checklist_doc_type='funding_agreement'`.

Conclusion:

No public-portal signing-request read/sign route was found that repeats the original staff/applicant numeric collision class. The main risks are upstream row misassignment from admin creation, recorded as MSG-SR-01, and broad list payload shape, recorded as SR-01.

#### Applicant upload/list/download/remove routes

Evidence reviewed:

- `/api/uploads/presign`, `/api/documents/finalize`, and legacy `/api/upload-application-file` derive ownership from `req.user.userId`.
- `consumePendingUpload()` rejects a finalize request unless the pending upload belongs to the authenticated user, but the final object key/path binding problem is recorded separately as UP-01.
- `/api/documents` lists only `iset_application_file WHERE user_id = req.user.userId`.
- `/api/documents/:id/presign-download` looks up the file row by id, then rejects unless `row.user_id === req.user.userId`.
- `DELETE /api/uploads/remove` resolves the submitted file path through `resolveApplicantOwnedUploadPath()`, which checks both `iset_application_file.user_id` and `iset_document.applicant_user_id` before deleting.
- Pre-submission finalization comments explicitly avoid falling back to the user's most recent application when no current application scope is proven.

Conclusion:

List, download, and delete routes re-check authenticated applicant ownership. The finalize route has a separate provenance bug where it proves pending-upload ownership but not final object-key/path ownership; see UP-01.

#### Dashboard aggregation

Evidence reviewed:

- `../ISET-intake/src/pages/userDashboard.js` loads `/api/draft`, `/api/submissions`, `/api/messages`, and conditionally `/api/my/interventions`.
- `/api/submissions` returns only submissions where `iset_application_submission.user_id = req.user.userId`, and maps them down to tracking id, submitted/updated timestamps, and participant-facing status.
- `/api/draft`, `/api/draft/autosave`, and `/api/draft` delete read/write/delete only `iset_application_draft_dynamic.user_id = req.user.userId`.
- `/api/intake-json`, used when resuming a dashboard draft, reads/writes only the current authenticated user's aggregate intake state.
- `/api/my/interventions` joins interventions back to `iset_application_submission s` and filters `s.user_id = req.user.userId`.
- The intervention dashboard payload maps `metadata_json` down to a title only, plus type, dates, action-required flag, updated timestamp, tracking id, and case manager display name. It does not return raw intervention metadata, review notes, finance details, or case notes.

Conclusion:

No additional dashboard-specific cross-user exposure path was found. The dashboard does amplify the overfetch findings already recorded as SM-01 and SR-01, because it uses full message/signing list endpoints to compute badges and summary banners.

#### Submitted application detail

Evidence reviewed:

- `../ISET-intake/src/pages/SubmissionDetails.js` uses the route parameter as a tracking reference and calls `/api/submissions/by-reference?ref=...`.
- `/api/submissions/by-reference` requires `req.user.userId` and filters with `WHERE s.user_id = ? AND s.reference_number = ?`.
- The route returns the full submitted `intake_payload`, plus status/timestamps/history/docRefs, only after the applicant owner and reference both match.
- The UI renders submitted answers from the returned payload. With a current workflow schema it maps known fields into schema sections; otherwise it falls back to payload keys.

Conclusion:

No submitted-application detail path was found that trusts the tracking reference by itself. A guessed or copied tracking id is not sufficient without the same authenticated `user_id`.

#### Draft/intake working state

Evidence reviewed:

- `input_json_state` reads and writes are keyed by `user_id = req.user.userId` plus the fixed portal session token.
- `/api/intake-step/:stepId`, `/api/intake-json`, and `/api/intake/complete` all derive the applicant id from `req.user.userId`.
- `persistInputJsonState()` writes the authenticated user id; caller-supplied user ids are not accepted.
- Dynamic draft load/save/delete use `iset_application_draft_dynamic.user_id = req.user.userId`.
- `ensureClientForUser()` no longer claims existing clients by email/name/SIN fallback. It uses a pinned client only if unbound or bound to the same Cognito subject, then `client.applicant_cognito_sub`, then creates a new client.
- Document finalization during intake checks requested application scope against `iset_application_submission.user_id = req.user.userId`; the separate final object-key provenance issue is recorded as UP-01.

Conclusion:

No draft/intake state route was found that can read another applicant's draft, aggregate working state, or saved dynamic draft by supplying another id.

#### Interventions / current plan activities

Evidence reviewed:

- `/api/my/interventions` filters with `iset_application_submission.user_id = req.user.userId`.
- The route joins interventions through the applicant-owned application/case path and returns only an applicant-facing card payload: intervention id, tracking id, type, date range, state, action-required flag, updated timestamp, and case manager display name.
- The route does not return raw `metadata_json`, internal notes, review notes, finance amounts, required-doc flags, or case notes.

Conclusion:

No intervention/current-plan route reviewed in this pass was found to expose another applicant's plan activity. The route's action-required flag can still be affected by upstream message/signing misassignment; see MSG-SR-01.

#### Public config/support/contact

Evidence reviewed:

- `/api/config/runtime` is public before the applicant auth gate, but its query is limited to `admin/auth.config` public data and `runtime` keys matching `intake.%`.
- `/api/service-announcement/current` reads the single runtime service-announcement key and returns normalized announcement content.
- `/api/ai-support` is public, reads only public AI model/parameter/fallback config from `iset_runtime_config(scope='public')`, sanitizes bounded conversation history, and blocks common sensitive-information prompts before sending content to OpenRouter.
- `/api/organizations` and `/api/organizations/:id` sit behind the applicant API gate and read active organization directory rows only.
- `/api/contact` sits behind the applicant API gate, inserts a new `contact_message`, and does not read or render other contact messages.

Conclusion:

No public config/support/contact route reviewed in this pass was found to expose applicant, case, message, signing, draft, or document records from another user.

#### Legacy/API-only surfaces

Evidence reviewed:

- `POST /api/applications` returns `410 legacy_endpoint_retired`.
- `GET /api/applications/by-tracking-id` returns `410 legacy_endpoint_retired`.
- `GET /api/admin/linkage-stats` returns `410 legacy_endpoint_retired`.
- `/api/admin/upload-config` and related admin-local upload configuration routes require `requirePortalAdmin`.
- The remaining stale DB-backed applicant route found in the active portal is `GET /api/applications`, recorded as LG-01.

Conclusion:

The retired high-risk legacy routes are fail-closed, but `GET /api/applications` should be retired or rewritten because it keeps a stale applicant ownership model alive.

## Running Questions

- Are there any deployed TEST/PROD custom routes or reverse-proxy paths outside `../ISET-intake/server.js` that should be included in live denial testing?
- Should this review produce immediate code patches as findings are confirmed, or should it first finish a full inventory for prioritization?

## 2026-07-10 GPT-5.6 Revalidation

The `GPT56-2026-07` security/privacy lane re-read the current portal at Git `99c440c`, compared its route inventory with the 2026-05-04 baseline, traced the applicant API gate and current UI consumers, ran the focused Cognito-auth tests, and performed schema-proven aggregate PROD checks. This was read-only; no portal behavior or live data changed.

Current finding status:

- `ID-01` remains open. `/api/me` still returns `isApplicantPortalUser`, while `AuthContext` and `AuthGuard` still enter the applicant shell from `authenticated`/`id` without requiring that flag. The server applicant gate remains the mitigating authorization boundary.
- `SM-01` remains open. `GET /api/messages` still selects full `m.body`, while Header and dashboard consumers need counts and the Messages list does not render the body.
- `SR-01` remains open. `GET /api/signing-requests` still selects and presigns `artifact_url` for the whole list; Header and Messages use the route for summaries while Documents is the download consumer.
- `LG-01` remains open. The stale `GET /api/applications` route still queries retired `iset_application.user_id`, returns broad rows, and has no current frontend caller.
- The only portal route added after the original review is `GET /api/application-start-eligibility`; it derives the applicant from `req.user.userId` and its database lookup is user-scoped. No new exposure finding was found in that delta.

Patched-finding data follow-up:

- `MSG-SR-01`: schema-proven PROD aggregates found `1,400` typed applicant messages and `107` signing requests, with `0` rows whose applicant participant lacked a strong case link through a submission user or client Cognito subject and `0` email-only matches. The code repair and current measured data remain clean.
- `UP-01`: all `3,818` current `iset_application_file` rows with S3-shaped paths have an owner segment matching `user_id`, and no file path is shared across application-file owners. Seventeen application-file/document owner differences were investigated rather than counted as residue: they are the documented 2026-05-21 Molly duplicate-identity repair, where duplicate-account uploads were deliberately rehomed to the canonical application and the retired source account was suspended. No unexplained current application-file owner/path mismatch was found. Pending-upload rows do not retain enough history after consumption/expiry to prove every older finalize request independently, so this remains an aggregate data check rather than request-log proof.

Verification and limitations:

- `node --test auth/__tests__/cognitoAuth.test.js` passed all 11 focused portal auth tests, including cookie precedence, Cognito-sub conflicts, staff-email conflicts, and bounded session-audit behavior.
- The current live denial harness had no real tokens or fixture IDs and reported 26 skips. No authenticated wrong-owner claim is made from that run; a future TEST rehearsal should run `npm run smoke:privacy-denials -- --require-live` with approved real-token fixtures.
- The static privacy route smoke currently has four stale source-pattern failures in admin code. Source tracing found the corresponding guards still present; this is tracked as a test-blind-spot candidate in the engineering audit register, not as removal of a portal authorization control.

## Next Step

Next review step: prioritize the four open findings and run the live denial harness with approved TEST tokens/fixtures. The message/signing and upload aggregate data follow-ups no longer need to block that prioritization.
