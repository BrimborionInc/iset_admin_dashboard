# Privacy ERM Cleanup Progress

Purpose: running execution log for the privacy ERM cleanup plan so work survives thread transitions.

Last Updated: 2026-04-26

Canonical plan: `docs/planning/privacy-erm-cleanup-grand-release-plan.md`

## Current Stage

Stage: Phase 1 inventory complete; Phase 2 containment patches and Phase 3 additive identity/message/attachment constraints applied in DEV.

Environment touched so far:

- DEV codebase.
- DEV database audit plus guarded cleanup of `message_item` and `iset_document` scope rows.
- DEV schema migrations for explicit case assignment staff-profile FK, typed secure-message actors, attachment scope, and secure-message/mailbox referential constraints.
- No PROD schema or data changes.
- No TEST deployment yet.

## 2026-04-26 Progress

### Persistent Plan

Created the controlling plan:

- `docs/planning/privacy-erm-cleanup-grand-release-plan.md`

Linked it from:

- `docs/AGENTS.md`
- `docs/meta/codex-thread-index.md`
- `docs/meta/changelog.md`

### Phase 1 Audit Tooling

Added a repeatable read-only audit script:

- `scripts/privacy-erm-audit.js`
- npm script: `npm run audit:privacy-erm`

Generated the first DEV report:

- `docs/data/privacy-erm-audits/dev-20260426.md`

The audit output deliberately avoids names, emails, message bodies, and file paths. It reports counts and object IDs only.

Run command used:

```bash
npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md --max-rows 100
```

Key DEV findings from the first audit before cleanup:

- 119 base tables, 182 FKs, and 5 old stored procedures.
- `iset_case.assigned_to_user_id` is a staff-profile ID in DEV: 2 assigned cases, 2 matching `staff_profiles.id`, 0 matching shared `user.id`.
- 6 of 23 staff profiles overlap shared `user` by Cognito subject or email.
- 1 shared `user` row overlaps both staff identity and client identity.
- `messages` has 6 rows; all have case/application/sender/recipient targets, but the table still relies on unconstrained person-to-person `sender_id` / `recipient_id`.
- Current case-linked messages show 6 sender anomalies against the current-case candidate model, confirming old staff-sender drift after reassignment.
- `message_item` has 50 rows; 16 point to missing messages, 3 point to missing owner users, and 22 belong to owners who are not the message sender or recipient.
- `message_attachment` has 0 rows in DEV, but schema still allows missing case/application scope and `application_id` is the wrong integer family.
- `iset_document` has 87 rows; 5 missing `client_id`, 35 missing `case_id`, and 7 with a `user_id` value that does not resolve to shared `user`.
- `iset_application_version` matches the newer application-based implementation but lacks the old columns still referenced by obsolete case-based routes.
- `govuk_component` is missing while admin routes still reference it.
- `jordan_application` and `jordan_application_draft` exist but are empty.
- Old appointment/booking/queue/ticket stored procedures remain while the underlying tables are missing.

### First Phase 2 Containment Patch

Changed the admin case secure-message read path in `isetadminserver.js`:

- `GET /api/cases/:id/messages` no longer bulk-inserts `message_item` rows for the staff user opening the case.
- The route now left-joins participant mailbox state only when the owner is the sender or recipient.
- Authorized staff case viewers can still see the case thread through case access, but their viewing no longer creates or trusts nonparticipant mailbox rows.
- Admin message delete/status/hard-delete endpoints now reject mailbox-state mutations for users who are not the message sender or recipient, even when they have case access.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- Manual DEV SQL shape check for the updated case-message query confirmed an authorized staff case viewer still sees the 6 case messages while stale nonparticipant `message_item` rows are ignored.

### DEV `message_item` Cleanup

Added guarded cleanup scripts:

- `sql/ops/privacy-erm-message-item-cleanup-preview.sql`
- `sql/ops/privacy-erm-message-item-cleanup-apply.sql`

Preview before cleanup found:

- 16 `message_item` rows pointing to missing `messages` rows.
- 2 `message_item` rows with existing messages but missing owner users.
- 20 `message_item` rows where the owner was neither sender nor recipient.
- 12 valid participant rows.

Applied the cleanup in DEV only. The apply script preserved deleted rows in `privacy_erm_message_item_cleanup_audit` under run ID `message-item-20260426214458`, then deleted 38 unsafe `message_item` rows.

Post-cleanup preview found only 12 valid rows. The DEV audit report was regenerated and now shows:

- `message_item` row count: 12.
- `message_items_missing_message`: 0.
- `message_items_missing_owner_user`: 0.
- `message_items_owner_not_sender_or_recipient`: 0.
- Base table count: 120 because the DEV cleanup created `privacy_erm_message_item_cleanup_audit`.

### Public Portal Attachment Scope Patch

Changed the current deployed public portal backend in `../ISET-intake/server.js`:

- Applicant message attachments now insert `message_attachment.case_id` together with `message_id`, `user_id`, and `application_id`.
- This removes one avoidable later-inference point before admin attachment adoption into `iset_document`.

Verification performed:

- `npx env-cmd -f .env node --check ../ISET-intake/server.js`

### Legacy Route Retirement

Hard-disabled obsolete admin backend routes in `isetadminserver.js`:

- `GET /api/cases/:case_id/application/versions`
- `GET /api/cases/:case_id/application/current`
- `POST /api/cases/:case_id/application/versions`
- `PATCH /api/applications/:id/answers`
- `GET /api/govuk-components`
- `GET /api/govuk-components/:id`
- `POST /api/govuk-components`
- `PUT /api/govuk-components/:id`
- `DELETE /api/govuk-components/:id`

Each now returns `410 retired_endpoint`.

Rationale:

- The case-based application-version routes queried old `iset_application_version` columns that no longer exist (`case_id`, `version_number`, `source_type`, `is_current`).
- The old direct answer patch route attempted a swallowed insert into nonexistent `previous_payload_json` and bypassed the current row-version/lock edit workflow.
- The GOV.UK component routes queried `govuk_component`, which does not exist in DEV and appears to be an abandoned experiment.
- Current frontend search found no callers for these retired routes. Current application editing uses `POST /api/applications/:id/versions`.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `rg` check confirmed no frontend callers for `govuk-components`, the retired case-based application-version routes, or the retired direct answer patch route.
- `rg` check confirmed no remaining `previous_payload_json` references in `isetadminserver.js`.

### DEV Document Scope Cleanup

Added document-scope preview/apply scripts:

- `sql/ops/privacy-erm-document-scope-preview.sql`
- `sql/ops/privacy-erm-document-scope-apply.sql`

Preview before cleanup found all document scope gaps were deterministic in DEV:

- 5 missing `client_id` values backfillable.
- 35 missing `case_id` values backfillable.
- 9 missing `application_id` values backfillable.
- 7 invalid `user_id` values that did not resolve to shared `user.id`.

Applied the cleanup in DEV only. The apply script preserved old/new values in `privacy_erm_document_scope_cleanup_audit` under run ID `document-scope-20260426215637`, then updated 37 `iset_document` rows.

Post-cleanup preview found no remaining rows needing document-scope cleanup. The regenerated DEV audit report now shows:

- `iset_document` missing `client_id`: 0.
- `iset_document` missing `case_id`: 0.
- `iset_document` missing `application_id`: 0.
- `iset_document` broken `user_id` references: 0.
- No document scope mismatch samples.
- Base table count is now higher than the original audit because DEV now has the audit-preservation tables `privacy_erm_message_item_cleanup_audit` and `privacy_erm_document_scope_cleanup_audit`.

Remaining document-model work:

- `origin_message_id` is still absent for non-message documents, which is expected.
- One `system_generated` document still has no `applicant_user_id`; this may be valid for staff/system-generated artifacts but should be classified before making `applicant_user_id` constraints.

### DEV Case Assignment Identity Migration

Added the first target-schema identity migration:

- `sql/migrations/20260426_0001_add_case_assigned_staff_profile_id.sql`

Migration behavior:

- Adds `iset_case.assigned_staff_profile_id BIGINT UNSIGNED NULL`.
- Backfills it only from legacy `iset_case.assigned_to_user_id` values that resolve to `staff_profiles.id`.
- Normalizes the legacy `assigned_to_user_id` value back to the explicit staff-profile value, so invalid legacy assignment values become unassigned instead of continuing to drive old read paths.
- Adds indexes plus `fk_iset_case_assigned_staff_profile` to `staff_profiles(id)` with `ON DELETE SET NULL`.

Applied in DEV through the canonical migration runner:

```bash
npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev
```

Post-apply checks:

- `npm run db:migrate:plan -- --target-env dev` reports 0 pending migrations.
- `iset_case` now has both `assigned_to_user_id` and `assigned_staff_profile_id`.
- `assigned_staff_profile_id` has FK `fk_iset_case_assigned_staff_profile`.
- DEV assignment counts: 2 total cases, 2 legacy assigned, 2 explicit assigned, 0 drift, 0 legacy-only assigned.

Code changes:

- Admin backend assignment write paths now dual-write `assigned_to_user_id` and `assigned_staff_profile_id`.
- Public portal case auto-assignment write paths now dual-write both columns.
- The audit script now reports explicit assignment counts and drift, while still supporting pre-migration databases.

### Case Assignment Read Cutover

Refactored high-risk case-assignment reads to prefer the explicit staff-profile assignment column:

- Shared case-access helper now resolves `assigned_staff_profile_id` before the legacy `assigned_to_user_id` fallback.
- RBAC assignment predicates now filter by `COALESCE(assigned_staff_profile_id, assigned_to_user_id)`.
- Admin backend case-access rows, coordinator/regional scope filters, staff-profile joins, dashboard/reporting joins, assignment comparisons, and owner resolution paths now use explicit-staff-profile semantics.
- Applicant-account service case-manager joins now use the explicit assignment column first.

This is still a transition state. API response fields such as `assigned_to_user_id` and `assigned_user_id` remain for frontend compatibility, but they now increasingly carry the explicit staff-profile assignment value rather than a raw legacy column read.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check src/lib/caseAccess.js`
- `npx env-cmd -f .env node --check src/lib/rbac.js`
- `npx env-cmd -f .env node --check src/lib/applicantAccountService.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `git diff --check`
- `git -C ../ISET-intake diff --check`

Post-read-cutover DEV assignment counts remain clean:

- 2 total cases.
- 2 legacy assigned.
- 2 explicit assigned.
- 0 assignment drift.
- 0 legacy-only assigned.

### Secure Message Actor-Domain Migration

Added typed actor-domain columns to the legacy `messages` table:

- `sql/migrations/20260426_0002_add_message_actor_domain_columns.sql`

Migration behavior:

- Adds sender/recipient actor type columns.
- Adds explicit sender/recipient shared-user columns.
- Adds explicit sender/recipient staff-profile columns.
- Adds FKs from the explicit user columns to `user(id)`.
- Adds FKs from the explicit staff-profile columns to `staff_profiles(id)`.
- Backfills existing messages by resolving the case applicant user and staff-profile mappings by Cognito subject/email.

DEV migration result:

- 6 existing messages.
- 0 missing sender actor types.
- 0 missing recipient actor types.
- 0 missing typed sender/recipient user references.
- 0 missing staff-profile references.
- 0 `local_user` fallback actors.
- Existing DEV messages classify as `staff_profile -> applicant_user`.

Code changes:

- Admin case-message sends now populate typed sender/recipient actor fields.
- Public portal text replies and attachment replies now populate typed sender/recipient actor fields.
- The public portal context now preserves the assigned staff profile ID alongside the resolved staff local user ID.
- The privacy audit now includes a `Message actor-domain counts` section.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### Secure Message Attachment Scope Migration

Added attachment relationship hardening:

- `sql/migrations/20260426_0003_harden_message_attachment_scope.sql`

Migration behavior:

- Adds `message_attachment.client_id`.
- Changes `message_attachment.application_id` to `BIGINT UNSIGNED` so it matches `iset_application.id`.
- Makes `message_attachment.user_id` nullable so legacy invalid uploader references can be repaired before final NOT NULL tightening.
- Backfills case/application/client scope from the parent message and linked case/application.
- Adds FKs from `message_attachment` to `messages`, `iset_case`, `iset_application`, `client`, and `user`.

Code changes:

- Public portal attachment inserts now persist `client_id` as well as message/case/application/user scope.
- Admin attachment adoption now validates attachment case/application/client scope against the message and destination case before inserting `iset_document` rows.
- The privacy audit now reports attachment `client_id` gaps and client mismatch counts.

DEV result:

- `message_attachment` has 0 rows in DEV.
- Scope counters remain 0.
- FK checks confirm constraints for message, case, application, client, and user.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### Secure Message Referential Constraint Migration

Added FKs to the remaining legacy secure-message relationship columns:

- `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`

Migration behavior:

- Adds FKs from `messages.sender_id` and `messages.recipient_id` to `user(id)` while those columns remain compatibility mailbox fields.
- Adds FKs from `messages.case_id` to `iset_case(id)` and `messages.application_id` to `iset_application(id)`.
- Adds FKs from `message_item.message_id` to `messages(id)` and `message_item.owner_user_id` to `user(id)`.

DEV pre-checks were clean:

- 6 messages, 0 missing sender users, 0 missing recipient users, 0 missing cases, 0 missing applications.
- 12 `message_item` rows, 0 missing messages, 0 missing owner users.

DEV post-checks:

- `messages` now has FKs for legacy sender/recipient, typed sender/recipient actor fields, case, and application.
- `message_item` now has FKs for message and owner user.
- Audit still reports 0 message referential gaps and 0 `message_item` anomalies.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### Secure Message Typed-Actor Access Cutover

Moved the highest-risk secure-message read/mutation paths away from legacy sender/recipient numeric authority:

- Public portal message lists now require the current applicant to be a typed `applicant_user` sender or recipient and require the message to belong to the applicant's resolved case/application scope.
- Public portal message detail, read, delete, replied, and reply-target resolution now use typed actor fields plus case/application scope instead of `sender_id` / `recipient_id` alone.
- Public portal reply-to-message routing now derives the staff/local counterpart from typed actor fields and rejects applicant-to-applicant counterpart routing.
- Admin secure-message mailbox-state helpers now seed, mutate, and compare `message_item` state through typed `sender_user_id` / `recipient_user_id` fields.
- Admin case-message reads still expose legacy `sender_id` / `recipient_id` for frontend compatibility, but mailbox state joins and status fallbacks now use typed user fields.
- Admin secure-message attachment adoption no longer falls back from message legacy sender/recipient fields when resolving the applicant/document user.
- The privacy audit now reports `message_items_owner_not_typed_user_participant`.

DEV checks:

- Existing six case messages remain visible to the applicant typed actor under the stricter case/application predicate.
- Existing 12 mailbox rows have 0 owners outside typed sender/recipient user fields.
- The regenerated DEV audit shows 0 `message_item` referential, legacy participant, and typed participant anomalies.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`

### DEV Document Scope Reference Migration

Added document relationship hardening:

- `sql/migrations/20260426_0005_harden_document_scope_references.sql`

Migration behavior:

- Changes `iset_document.user_id`, `iset_document.applicant_user_id`, and `iset_document.origin_message_id` from `BIGINT UNSIGNED` to `INT` so they match their target tables.
- Adds `fk_iset_document_user` to `user(id)`.
- Adds `fk_iset_document_applicant_user` to `user(id)`.
- Adds `fk_iset_document_case` to `iset_case(id)`.
- Adds `fk_iset_document_application` to `iset_application(id)`.
- Adds `fk_iset_document_origin_message` to `messages(id)`.
- Preserves existing FKs for `client_id`, `action_plan_id`, and `linked_task_id`.

DEV pre-checks were clean:

- 87 documents.
- 0 broken client references.
- 0 broken case references.
- 0 broken application references.
- 0 broken applicant-user references.
- 0 broken uploader/user references.
- 0 broken origin-message references.
- Existing max `user_id` and `applicant_user_id` values fit the target `INT` type.

DEV post-checks:

- `iset_document.user_id`, `applicant_user_id`, and `origin_message_id` now use `INT`.
- `iset_document` now has FKs for user, applicant user, client, case, application, action plan, linked task, and origin message.
- The regenerated DEV audit still reports 0 document referential gaps and 0 document scope mismatches.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### Case/Application Scope Cleanup

Reviewed the case/application/client backbone after the document and message scope work:

- DEV already has FKs for `iset_application.client_id`, `iset_application.case_id`, `iset_case.client_id`, and `iset_case.application_id`.
- DEV audit shows 2 applications and 2 cases, with 0 missing client/case links and 0 bidirectional mismatch rows.
- The remaining unscoped admin ingest endpoint `POST /api/applications/ingest-from-submission` was retired with `410 retired_endpoint`.

Rationale:

- That endpoint created `iset_application` rows from a submission without `client_id` or `case_id`.
- Current scoped creation should flow through `POST /api/cases` with `client_id` and optional `submission_id` / `application_id`, or through the current portal/manual-intake flows that persist application ownership links.
- Leaving an unscoped application creator alive would block future NOT NULL tightening and could reintroduce scope inference for documents/messages.

Verification performed:

- `rg` found no frontend callers for `ingest-from-submission`.
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### Secure Message Response-Contract Cleanup

Moved secure-message UI interpretation away from legacy participant IDs:

- Admin `src/widgets/SecureMessagingWidget.js` now classifies sender/recipient/applicant direction through typed actor fields first.
- Case Workspace `src/widgets/caseWorkspace/SecureMessagingWidget.js` now uses the same typed actor interpretation for inbox/sent buckets, display names, and read-state updates.
- Public portal `../ISET-intake/src/pages/ComposeMessage.js` no longer sends a legacy `recipient_id` when replying to an existing message. The backend derives the reply recipient from the typed actor counterpart and case/application scope.

Compatibility retained:

- The admin backend still returns legacy `sender_id` / `recipient_id` fields until the broader response contract is replaced.
- The widgets keep a legacy fallback for older rows/environments that have not yet run the typed actor migration, but new DEV behavior uses typed fields.

Verification performed:

- `npx eslint src/widgets/SecureMessagingWidget.js src/widgets/caseWorkspace/SecureMessagingWidget.js`
- `cd ../ISET-intake && npx eslint src/pages/ComposeMessage.js`
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`

### Case Assignment Response-Contract Cleanup

Moved high-risk case-assignment API/UI interpretation away from legacy `assigned_user_id` naming:

- Added backend helpers in `isetadminserver.js` that emit explicit `assigned_staff_profile_id` / `assignedStaffProfileId` aliases while retaining legacy `assigned_to_user_id` / `assigned_user_id` compatibility fields during transition.
- Updated high-risk admin responses for application listing, home/work-queue detail rows, case detail, case workspace, escalations, and dashboard queue rows to carry explicit staff-profile assignment aliases.
- Added frontend helper `src/utils/assignmentIdentity.js` and cut the application list, home dashboard queues, work-queue table, and application overview to resolve assignment through explicit staff-profile semantics first.
- Retained compatibility aliases so current UI code can continue to function during TEST/PROD migration, but new comparisons now prefer staff-profile IDs over generic user IDs.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx eslint src/utils/assignmentIdentity.js src/pages/home/HomeDashboardPage.jsx src/pages/home/widgets/WorkQueueItemsTableWidget.js src/widgets/ApplicationsWidget.js src/widgets/ApplicationOverviewWidget.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `git diff --check && git -C ../ISET-intake diff --check`

### DEV Staff-Profile Actor FK Hardening

Closed the remaining unconstrained staff-profile actor/reference columns reported by the DEV audit:

- Added migration `sql/migrations/20260426_0006_harden_staff_profile_actor_references.sql`.
- Normalized any invalid nullable staff-profile actor references to `NULL` before adding FKs.
- Deleted invalid `staff_tutorial_progress` rows before adding its required staff-profile FK. DEV had 0 invalid rows in the precheck.
- Converted older `INT` staff-profile actor columns to `BIGINT UNSIGNED` so they match `staff_profiles.id`.
- Added FKs for admin feedback staff actors, CFA staff actors, applicant-account invite/event staff actors, and staff tutorial progress.

DEV post-checks:

- All 10 targeted columns now reference `staff_profiles(id)`.
- Populated references still have 0 missing `staff_profiles` targets.
- The regenerated audit now reports those staff-profile columns as `bigint unsigned` with `staff_profiles` references.
- The only staff-profile-like column intentionally still lacking an FK in the audit is transitional `iset_case.assigned_to_user_id`.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct post-check against `INFORMATION_SCHEMA` confirmed each new FK and 0 populated orphan values.

### Case Assignment Documentation Cleanup

Updated older docs that still described case assignment as a generic user assignment:

- `docs/data/case-finance-data-architecture.md`
- `docs/architecture/case-lifecycle-operating-model.md`
- `docs/dashboards/admin-home-metrics-widget.md`
- `docs/dashboards/data-and-results-dashboard.md`
- `docs/data/case-detail-fallback.md`
- `docs/data/tutorial-progress.md`

Current documentation now treats `assigned_staff_profile_id` as the staff ownership field and names `assigned_to_user_id` only as a transitional legacy fallback where relevant.

Verification performed:

- `rg` against `docs/architecture`, `docs/data`, and `docs/dashboards` found no stale non-audit/non-dump `assigned_user_id` references outside explicit legacy-fallback notes.
- `git diff --check && git -C ../ISET-intake diff --check`

### DEV Secure-Message Scope Constraint Hardening

Added the first hard privacy guards around secure-message scope and document lineage:

- Patched admin case-message send so `messages.application_id` is derived from the validated case application instead of depending on a request-provided `applicationId`.
- Added migration `sql/migrations/20260426_0007_harden_secure_message_scope_constraints.sql`.
- Made `messages.case_id`, `sender_actor_type`, and `recipient_actor_type` required in DEV.
- Changed secure-message typed actor FKs from `ON DELETE SET NULL` to `ON DELETE RESTRICT`, so deleting a user/staff profile cannot silently detach a message actor.
- Added CHECK constraints requiring a valid typed sender actor, a valid typed recipient actor, and exactly one applicant actor per secure message.
- Made `message_attachment.case_id`, `client_id`, and `user_id` required, changed attachment scope FKs to `RESTRICT`, and changed the parent message FK to `ON DELETE CASCADE`.
- Changed privacy-sensitive `iset_document` scope FKs (`user_id`, `applicant_user_id`, `case_id`, `application_id`, `client_id`, `origin_message_id`) to `RESTRICT`.
- Added source-specific document CHECK constraints:
  - `application_submission` requires client/case/application/applicant scope.
  - `manual_upload` requires client/case scope, with applicant scope required when an application is present.
  - `secure_message_attachment` requires client/case/application/applicant/uploader/origin-message scope.
  - `system_generated` requires at least client/case scope.
- Updated `scripts/privacy-erm-audit.js` so message participant anomaly checks understand typed `staff_profile` actors and no longer assume secure messages must target the assigned staff member.
- Extended the durable DEV audit with FK delete-rule and CHECK-constraint sections.

Important DEV migration note:

- The first apply attempt partially committed message/attachment hardening before MySQL rejected document CHECK constraints that referenced columns still using `ON DELETE SET NULL`.
- The migration was rewritten to be rerunnable and to convert the relevant document FKs to `RESTRICT` before adding CHECKs.
- DEV has failed/superseded ledger rows from the iterative `0007` correction plus a successful row for the final checksum; `db:migrate:plan -- --target-env dev` shows 0 pending after the final apply.
- TEST/PROD should run the final migration file from a clean pre-`0007` state, after preflight counts confirm no legacy rows violate the new checks.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct `INFORMATION_SCHEMA` checks confirmed the expected `RESTRICT`/`CASCADE` rules and all eight privacy CHECK constraints.

### DEV Signing-Request Scope FK Hardening

Closed another secure-message-adjacent privacy gap around participant signing forms:

- Added migration `sql/migrations/20260426_0008_harden_signing_request_scope_references.sql`.
- Converted `signing_request.workflow_id`, `participant_user_id`, and `created_by_user_id` from `BIGINT UNSIGNED` to `INT` so they match `workflow.id` and `user.id`.
- Made `signing_request.case_id` required.
- Added FKs from signing requests to `workflow`, `iset_case`, participant `user`, and creator `user`, all with `ON DELETE RESTRICT`.
- Left `message_signing_request` on its existing cascade FKs to `messages` and `signing_request`.
- Extended the privacy audit with signing-request scope counts covering missing targets, missing message links, message/case mismatch, and participant-not-case-applicant anomalies.

DEV post-checks:

- 18 signing requests.
- 0 missing workflow/case/participant/creator targets.
- 0 missing message links.
- 0 message/case mismatches.
- 0 participant-not-case-applicant anomalies.
- `db:migrate:plan -- --target-env dev` shows 0 pending.

Verification performed:

- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`

### DEV Escalation and Case-Task User FK Hardening

Closed the next high-risk unconstrained shared-user fields:

- Added migration `sql/migrations/20260426_0009_harden_escalation_and_task_user_references.sql`.
- Patched `POST /api/escalations` to fail closed with `case_scope_required` if an application cannot resolve to a case before creating an escalation.
- Made `iset_application_escalation.case_id` required.
- Converted escalation `current_owner_user_id`, `requester_user_id`, and `resolved_by_user_id` from `BIGINT UNSIGNED` to `INT` so they match shared `user.id`.
- Added FKs from `iset_application_escalation` to `iset_application`, `iset_case`, requester user, current-owner user, and resolver user, all with `ON DELETE RESTRICT`.
- Added FK from `iset_application.current_escalation_id` to `iset_application_escalation(id)` with `ON DELETE SET NULL` for the helper pointer.
- Added FKs from `iset_case_task.created_by_user_id` and `updated_by_user_id` to shared `user(id)` with `ON DELETE RESTRICT`.
- Extended the privacy audit with escalation and case-task scope/actor counts, including user/staff-profile numeric-domain collision indicators.

DEV post-checks:

- 1 escalation, with 0 missing application/case/requester/current-owner/resolver targets and 0 staff-profile/user-domain collisions.
- 0 case tasks; all task anomaly counts report 0.
- `db:migrate:plan -- --target-env dev` shows 0 pending.
- The regenerated audit no longer lists escalation owner/requester/resolver fields or case-task created/updated user fields under user-like columns without FKs.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct `INFORMATION_SCHEMA` checks confirmed the new escalation/application/task FKs and expected column types.

## Still Open

Immediate next DEV work:

- Update any remaining stale client/case/application target-model docs not covered by the assignment cleanup to reflect that `iset_application.client_id` and `case_id` now exist in live DEV schema.
- Continue lower-risk API/frontend response naming cleanup from `assigned_to_user_id` / `assigned_user_id` toward explicit staff-profile naming before retiring the misleading legacy field.
- Continue secure-message cutover from compatibility `sender_id` / `recipient_id` response fields to a full case-thread model; backend authority and the main admin/portal UI interpretation now use typed actors.
- Continue final document/thread model tightening once TEST/PROD rehearsals prove no legacy rows need quarantine.
- Continue staff/profile shared-user overlap cleanup; staff-profile-like columns now have FKs except transitional `iset_case.assigned_to_user_id`.
- Classify the remaining `system_generated` document without `applicant_user_id` before requiring applicant scope for system-generated documents.
- Continue closing remaining high-risk unconstrained user-like IDs such as internal-notification audience/dismissal users and pending uploads, while treating opaque actor IDs (`application_lock.owner_user_id`, event receipt/session-audit IDs) separately from shared `user.id`.

TEST/PROD deployment considerations already visible:

- The audit script should be run against TEST before any deployment and against PROD in read-only mode before the grand cleanup release.
- The `message_item` containment patch plus cleanup should be rehearsed in TEST before PROD. The cleanup script is guarded and audit-preserving, but PROD use still requires a snapshot/restore point and pre/post counts.
- The case assignment migration is additive, but it intentionally nulls invalid legacy assignment values. PROD use must include a pre-migration count of old `assigned_to_user_id` values that do not resolve to `staff_profiles.id`.
- The message actor-domain migration is additive, but PROD rehearsal must count any rows that backfill to `local_user`; those are quarantine candidates before relying on actor-domain constraints for access decisions.
- The attachment-scope migration changes `message_attachment.application_id` type and adds FKs. PROD rehearsal must first count existing attachment rows and verify no invalid message/case/application/client/user references.
- The message/message-item FK migration should only run in TEST/PROD after the cleanup scripts prove there are no orphan message or mailbox rows.
- The document FK migration changes three document ID column types to `INT`; TEST/PROD rehearsal must first verify all `iset_document.user_id`, `applicant_user_id`, and `origin_message_id` values fit the target type and have valid targets.
- The secure-message scope constraint migration (`20260426_0007`) will fail closed if TEST/PROD still contain unscoped messages, ambiguous actors, attachments without scope, or document rows violating source-specific lineage. Run the audit and quarantine/fix those rows before applying it outside DEV.
- The signing-request FK migration (`20260426_0008`) will fail if TEST/PROD signing requests have missing workflow/case/participant/creator targets or nullable case links. Run the signing-request audit section before applying it outside DEV.
- The escalation/task FK migration (`20260426_0009`) will fail if TEST/PROD escalations have no case, point at missing application/case/user rows, or if task created/updated user fields contain invalid shared-user IDs. Run the escalation/task audit sections before applying it outside DEV.
- The retired unscoped application ingest endpoint should be smoke-checked in TEST/PROD rollout notes if any old operator workflow still references it; no current frontend caller was found in DEV.
- PROD cleanup should not drop old columns/tables in the same release that first migrates message/document scope data.
