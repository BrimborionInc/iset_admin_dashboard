# Privacy ERM Cleanup Progress

Purpose: running execution log for the privacy ERM cleanup plan so work survives thread transitions.

Last Updated: 2026-08-09

Canonical plan: `docs/planning/privacy-erm-cleanup-grand-release-plan.md`

## 2026-08-09 Smoke SQL Admission Hardening

`scripts/privacy-erm-smoke.js` now has an explicit fail-closed database admission boundary:

- `--schema-preflight-only` proves the exact configured/live WSL DEV identity and retrieves each required table independently with its full create definition, columns, indexes, and constraints. It executes no integrity read after metadata discovery.
- Retired-object and retired-column absence, and required FK/CHECK ownership/reference, are derived and reported from the proven object DDL/column/constraint evidence. The smoke no longer runs ordinary joined `information_schema` count queries to infer those facts.
- The three privacy audit objects are required and proved from live metadata as base tables; the guard rejects a type mismatch rather than assuming that an object name implies a view.
- Full read-only integrity checks receive only the guarded connection created after preflight. Every statement is validated immediately, every multi-table column is qualified, and every table alias is both backtick-quoted and live keyword-proven.
- The old informational join that tried to interpret runtime string `workflow_id` values as either numeric workflow IDs or names was removed. Those fields remain deliberately classified as string keys and are not asserted as a relational FK by this smoke.
- Wrong identity, missing/wrong object metadata, a retired column/object reappearing, or a missing/misdirected constraint aborts before any ordinary integrity query. Focused fake-connection tests prove this boundary without contacting a database.

This change is source/test hardening only. It does not itself constitute a new DEV, TEST, or PROD smoke result, and it made no environment or schema change.

## Current Stage

Stage: Phase 1 inventory complete; Phase 2 containment patches, Phase 3 additive identity/message/attachment constraints, first legacy experiment/routine retirements, event actor typing, application-version author typing, event read-receipt viewer typing, legacy compatibility-shadow retirement inventory, secure-message participant physical shadow retirement, case-assignment physical shadow retirement, internal-notification audience/viewer physical shadow retirement, event-receipt physical shadow retirement, case/application pointer retirement, application ownership hardening, application-version author-shadow retirement, event-entry typed-actor scope hardening, application/CFA relationship FK hardening, remaining relationship FK hardening, legacy document experiment retirement, remaining ID-like column classification, reusable privacy ERM smoke checks, and route-level scope hardening applied in DEV.

Environment touched so far:

- DEV codebase.
- DEV database audit plus guarded cleanup of `message_item` and `iset_document` scope rows.
- DEV schema migrations for explicit case assignment staff-profile FK, typed secure-message actors, attachment scope, and secure-message/mailbox referential constraints.
- DEV schema migration for retiring confirmed-empty legacy Jordan experiment application tables with fail-closed non-empty guards.
- DEV schema migration for retiring broken appointment/queue stored procedures whose backing tables are already absent.
- DEV schema migration and shared emitter changes for typed event-entry actor references.
- DEV schema migration and admin version-write changes for typed application-version authorship.
- DEV schema migration and shared/admin event read-state changes for typed event-receipt viewer references.
- DEV audit and planning docs for remaining physical legacy-field retirement gates.
- DEV schema migration for physically retiring `messages.sender_id` and `messages.recipient_id` after typed actor cutover and aggregate drift recording.
- DEV schema migration for physically retiring `iset_case.assigned_to_user_id` after assignment code cutover and aggregate drift recording.
- DEV schema migration for physically retiring `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id` after notification code cutover and aggregate drift recording.
- DEV schema migration for physically retiring `iset_event_receipt.recipient_id` after typed viewer read-state cutover and aggregate drift recording.
- DEV schema migration for physically retiring `iset_case.application_id` after moving the ownership model to `iset_application.case_id`.
- DEV schema migration for requiring `iset_application.client_id` and `case_id`.
- DEV schema migration for physically retiring `iset_application_version.created_by_id` after version code cutover.
- DEV schema migration for enforcing typed `iset_event_entry` actors for staff/applicant events while retaining `actor_id` as audit principal text.
- DEV schema migration for constraining application submission/version lineage plus CFA case/version/document/participant relationships.
- DEV guarded cleanup and schema migration for remaining relationship FKs on client account events, transient input state clients, case-assessment budget pots, case reminders, and staff regions.
- DEV schema migration for retiring the confirmed-empty `zzz_legacy_documents` experiment table with a fail-closed non-empty guard.
- DEV audit classification for remaining ID-like runtime keys, external references, audit principals, and lookup primary keys that should not be forced into row FKs.
- DEV read-only smoke script for post-cleanup privacy ERM assertions.
- DEV static route-scope smoke script for high-risk raw-ID/raw-key route guards.
- DEV route-scope code hardening for workflow/component authoring, legacy raw Nunjucks/blockstep debug routes, case watches, application details/versions/locks, escalation routes, and case detail/mutation/assignment/ILMP actions.
- DEV route-scope code hardening for Query Editor server export database scope and generated consent/declaration PDFs.
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
- The previous `system_generated` applicant-scope gap was classified and closed by `20260427_0008_harden_system_generated_document_scope.sql`.

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

- At this stage, admin backend assignment write paths dual-wrote `assigned_to_user_id` and `assigned_staff_profile_id`. This transition state is superseded by the later `20260427_0010` physical retirement section below.
- At this stage, public portal case auto-assignment write paths dual-wrote both columns. This transition state is superseded by the later `20260427_0010` physical retirement section below.
- The audit script now reports explicit assignment counts and drift, while still supporting pre-migration databases.

### Case Assignment Read Cutover

Refactored high-risk case-assignment reads to prefer the explicit staff-profile assignment column:

- Shared case-access helper now resolves `assigned_staff_profile_id` before the legacy `assigned_to_user_id` fallback.
- RBAC assignment predicates now filter by `COALESCE(assigned_staff_profile_id, assigned_to_user_id)`.
- Admin backend case-access rows, coordinator/regional scope filters, staff-profile joins, dashboard/reporting joins, assignment comparisons, and owner resolution paths now use explicit-staff-profile semantics.
- Applicant-account service case-manager joins now use the explicit assignment column first.

This was a transition state. API response fields such as `assigned_to_user_id` and `assigned_user_id` remain for frontend compatibility, but after `20260427_0010` they are derived from `assigned_staff_profile_id` rather than read from a physical legacy case column.

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

At this stage, added FKs to the remaining legacy secure-message relationship columns. The physical sender/recipient columns were retired later by `20260427_0009`.

- `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`

Migration behavior:

- Adds FKs from `messages.sender_id` and `messages.recipient_id` to `user(id)` while those columns remained compatibility mailbox fields before later retirement.
- Adds FKs from `messages.case_id` to `iset_case(id)` and `messages.application_id` to `iset_application(id)`.
- Adds FKs from `message_item.message_id` to `messages(id)` and `message_item.owner_user_id` to `user(id)`.

DEV pre-checks were clean:

- 6 messages, 0 missing sender users, 0 missing recipient users, 0 missing cases, 0 missing applications.
- 12 `message_item` rows, 0 missing messages, 0 missing owner users.

DEV post-checks:

- At this stage, `messages` had FKs for legacy sender/recipient, typed sender/recipient actor fields, case, and application. The legacy sender/recipient FKs were dropped with the retired columns in `20260427_0009`.
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
- At this stage, admin case-message reads still exposed legacy `sender_id` / `recipient_id` for frontend compatibility, but mailbox state joins and status fallbacks used typed user fields. The response fields and physical columns were retired later in DEV by `20260427_0009`.
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

- DEV already has FKs for `iset_application.client_id`, `iset_application.case_id`, and `iset_case.client_id`. The old `iset_case.application_id` FK was retired later in this cleanup by `20260427_0013`.
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

Moved secure-message response interpretation away from legacy participant IDs:

- Admin `GET /api/cases/:id/messages` now returns canonical `sender`, `recipient`, and `thread` objects on each message item, plus response-root applicant/thread aliases for the case conversation.
- Public portal message mappers now return the same canonical actor/thread objects alongside `direction`, so portal pages do not need to infer participant meaning from raw numeric IDs.
- Admin secure-message widgets now classify sender/recipient/applicant direction, inbox/sent buckets, display names, and read-state updates from canonical actor objects or typed actor fields only.
- Public portal `../ISET-intake/src/pages/ComposeMessage.js` no longer sends a legacy `recipient_id` when replying to an existing message. The backend derives the reply recipient from the typed actor counterpart and case/application scope.
- Secure-message event payloads now carry typed sender/recipient actor fields, including staff-profile IDs where known, while retaining legacy `recipient_id` / `to_user_id` compatibility fields.

Compatibility retained:

- At this stage, legacy `sender_id` / `recipient_id` fields remained in response rows and database writes as compatibility shadows during DEV-to-TEST-to-PROD migration. They were physically retired later in DEV by `20260427_0009`.
- Main admin and portal UI code must not use those raw legacy participant IDs as routing, display, or applicant-direction authority.
- TEST/PROD rollout must apply the typed actor/message-scope migrations before or with this response contract change; otherwise old rows without typed actor fields would not classify correctly under the hardened widgets.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `rg` confirmed the main admin secure-message widgets no longer read `message.sender_id` / `message.recipient_id`.
- `npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npm run db:migrate:plan -- --target-env dev`
- `git diff --check` in admin and portal repos.

### Case Assignment Response-Contract Cleanup

Moved high-risk case-assignment API/UI interpretation away from legacy `assigned_user_id` naming:

- Added backend helpers in `isetadminserver.js` that emit explicit `assigned_staff_profile_id` / `assignedStaffProfileId` aliases while retaining legacy `assigned_to_user_id` / `assigned_user_id` compatibility fields during transition. After `20260427_0010`, those legacy aliases are derived from `assigned_staff_profile_id`.
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
- At this stage, the only staff-profile-like column intentionally still lacking an FK in the audit was transitional `iset_case.assigned_to_user_id`; it was constrained by `20260427_0002` and then retired by `20260427_0010`.

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

### DEV Internal Notification and Upload Identity Hardening

Closed the next staff-profile/shared-user ambiguity:

- Added migration `sql/migrations/20260427_0001_harden_internal_notification_and_upload_identity.sql`.
- Classified `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id` as legacy compatibility shadows. Existing DEV values were staff profile IDs, not shared `user.id` values.
- Added typed notification audience columns:
  - `audience_actor_type`
  - `audience_staff_profile_id`
  - `audience_applicant_user_id`
- Added typed notification dismissal viewer columns:
  - `viewer_actor_type`
  - `viewer_staff_profile_id`
  - `viewer_applicant_user_id`
- Added FKs from typed notification staff columns to `staff_profiles(id)` and typed applicant columns to `user(id)`, with `ON DELETE CASCADE` so a targeted notification cannot become broad by nulling its audience.
- Re-keyed dismissals to a surrogate `id` primary key plus unique typed viewer keys, preventing staff-profile/applicant numeric collisions on the old `(notification_id, user_id)` shape.
- Updated `/api/me/notifications`, notification dismissal, and `../shared/events/notificationDispatcher.js` so direct staff audiences and viewers are now staff-profile typed, while applicant audiences remain shared-user typed.
- Added FK from `pending_uploads.user_id` to shared `user(id)`.
- Added FK from `application_lock.application_id` to `iset_application(id)`, while leaving `application_lock.owner_user_id` as an opaque lock-principal string rather than forcing it into `user(id)`.
- Extended the privacy audit with internal-notification audience/viewer counts, pending-upload ownership counts, and an opaque actor ID inventory for lock/event/session identifiers.

DEV post-checks:

- 60 internal notifications.
- 34 user-audience notifications, all typed as `staff_profile`.
- 34 notification dismissals, all typed as `staff_profile`.
- 0 missing typed notification audience/viewer targets.
- 0 legacy shadow mismatches.
- 0 pending upload rows; 0 pending upload owner anomalies.
- 0 application lock rows; 0 lock application anomalies.
- `db:migrate:plan -- --target-env dev` shows 0 pending.

Operational note:

- The first DEV apply attempt partially added the notification typed-audience columns/FKs before failing on rerun idempotency. The migration was rewritten to tolerate both fresh databases and that partial DEV state, then applied successfully with a new checksum. TEST/PROD will only see the final idempotent file.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check src/internalNotifications.js`
- `npx env-cmd -f .env node --check ../shared/events/notificationDispatcher.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Runtime helper smoke: `getInternalNotifications(pool, { subjectType: 'staff', staffProfileId: 92, role: 'ISET Coordinator' })` returned only direct `staff_profile` typed notifications for that staff profile, with 0 applicant-typed rows.
- `git diff --check`
- `git -C ../ISET-intake diff --check`
- `../shared` is not a git worktree in this checkout; `node --check` passed for the modified shared dispatcher and a direct whitespace/conflict-marker scan of that file returned clean.

### DEV Legacy Case Assignment Shadow FK Hardening

Closed the last staff-profile-like column that still lacked a staff-profile FK:

- Added migration `sql/migrations/20260427_0002_harden_legacy_case_assignment_shadow.sql`.
- Normalized `iset_case.assigned_to_user_id` from `assigned_staff_profile_id` so the legacy shadow stays aligned with the explicit staff-profile assignment column.
- Added `fk_iset_case_legacy_assigned_staff_profile` from `iset_case.assigned_to_user_id` to `staff_profiles(id)` with `ON DELETE SET NULL`.
- At this stage, kept `assigned_to_user_id` as a legacy compatibility field only while new code continued to write and prefer `assigned_staff_profile_id`. The physical legacy column was retired later by `20260427_0010`.
- Updated the privacy audit so user-like columns now include a `classification` column. `assigned_to_user_id` is reported as a `legacy staff-profile assignment shadow`, while lock/event/session/version actor identifiers are reported as opaque principals.

DEV post-checks:

- 2 cases.
- 2 legacy-assigned cases and 2 explicit assigned cases.
- 0 explicit assignment values without a staff profile.
- 0 legacy assignment values without a staff profile.
- 0 assignment column drift.
- The regenerated audit shows both `fk_iset_case_assigned_staff_profile` and `fk_iset_case_legacy_assigned_staff_profile`.
- `db:migrate:plan -- --target-env dev` shows 0 pending.

Operational note:

- The first DEV apply attempt added the FK but failed when MySQL rejected a CHECK constraint comparing two columns that both participate in `ON DELETE SET NULL` FKs. The final migration omits that CHECK and relies on the audit drift count instead. DEV has a failed old-checksum ledger row and a successful final-checksum row; TEST/PROD will only see the final idempotent file.

Verification performed:

- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct `INFORMATION_SCHEMA` check confirmed `fk_iset_case_legacy_assigned_staff_profile` on `assigned_to_user_id`.
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check ../shared/events/notificationDispatcher.js`
- `git diff --check`
- `git -C ../ISET-intake diff --check`
- Direct whitespace/conflict-marker scan of `../shared/events/notificationDispatcher.js` returned clean.

### DEV Jordan Experiment Table Retirement

Retired the confirmed legacy Jordan application experiment tables:

- Added migration `sql/migrations/20260427_0003_retire_jordan_application_experiment_tables.sql`.
- Removed `jordan_application` and `jordan_application_draft` from the admin test-data reset order.
- Removed both tables from the privacy audit's default current-table count list while keeping them in the legacy-table status list.
- Left current "Jordan's Principle" intake/document labels untouched; this cleanup only targets the abandoned `jordan_application*` experiment tables.

Migration behavior:

- Creates `privacy_erm_legacy_table_retirement_audit` for non-payload retirement counts.
- Counts each legacy table before drop.
- Fails closed if either table exists with rows, so TEST/PROD cannot silently drop private legacy application JSON. Non-empty rows must be quarantined or archived by a separate reviewed migration.
- Inserts count audit rows only when the tables exist and are empty.
- Drops `jordan_application_draft` and `jordan_application`.

DEV post-checks:

- `jordan_application`: 0 rows before drop.
- `jordan_application_draft`: 0 rows before drop.
- Both tables are now missing from DEV, as expected.
- `privacy_erm_legacy_table_retirement_audit` records both retirements with row count `0`.
- `db:migrate:plan -- --target-env dev` shows 0 pending after the final fail-closed checksum.
- The regenerated privacy ERM audit now lists both Jordan experiment tables as `missing` under known legacy/experiment table status.

Operational note:

- DEV first applied the zero-row drop, then the migration was tightened to fail closed for non-empty TEST/PROD tables and reapplied as a no-op final checksum. DEV therefore has two successful ledger rows for `20260427_0003`; TEST/PROD should only see the final fail-closed migration file.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct SQL confirmed no `jordan_application%` tables remain and the retirement audit rows have count `0`.
- Disposable local-schema guard test confirmed the migration drops empty experiment tables but errors before dropping when a legacy Jordan table contains rows.

### DEV Appointment/Queue Legacy Routine Retirement

Retired the dead stored procedures from the old appointment/queue experiment:

- Added migration `sql/migrations/20260427_0004_retire_appointment_queue_legacy_routines.sql`.
- Targeted procedures:
  - `CheckBILUsage`
  - `CheckInUser`
  - `GenerateTicketNumber`
  - `PurgeAppointments`
  - `PurgeSlots`
- These procedures referenced already-missing legacy tables such as `appointment`, `booking`, `slot`, `queue`, `ticket_counter`, and `queue_ticket_config`.

Migration behavior:

- Creates `privacy_erm_legacy_routine_retirement_audit`.
- Records routine names/types before drop.
- Drops the five procedures with `DROP PROCEDURE IF EXISTS`.

DEV post-checks:

- `information_schema.routines` now reports 0 routines in DEV.
- `privacy_erm_legacy_routine_retirement_audit` records all five retired procedure names.
- The regenerated privacy ERM audit now shows `_No rows._` under `Stored routines still present`.
- `db:migrate:plan -- --target-env dev` shows 0 pending after `20260427_0004`.

Verification performed:

- `rg` found no live code `CALL` sites for the five procedure names outside the migration and stale audit output before regeneration.
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct SQL confirmed 0 routines remain and all five routine-retirement audit rows exist.

### DEV Event Entry Actor Typing

Closed the next actor-identity ambiguity in the shared event log:

- Added migration `sql/migrations/20260427_0005_add_event_entry_typed_actor_references.sql`.
- Added nullable typed actor reference columns to `iset_event_entry`:
  - `actor_staff_profile_id`
  - `actor_applicant_user_id`
- Added indexes and FKs from those columns to `staff_profiles(id)` and `user(id)` with `ON DELETE RESTRICT`.
- Backfilled applicant event actors from numeric applicant `user.id`.
- Backfilled staff event actors from staff Cognito subject, staff-profile ID where applicable, captured-by subject, and message-linked `messages.sender_staff_profile_id` for legacy secure-message events.
- Updated `../shared/events/emitter.js` so new events populate typed actor references when the columns exist, while remaining compatible with databases that have not yet run the migration.
- Updated admin secure-message event emission so staff `message_received` events use the authenticated actor subject plus explicit staff-profile reference instead of writing a local `user.id` while labeling it as `staff`.
- Updated shared event-feed joins to prefer typed actor references and to use binary Cognito-sub comparisons on legacy fallback joins, avoiding collation-sensitive joins.
- Extended the privacy audit with event-entry typed actor counts and unresolved actor samples.

DEV post-checks:

- 10 applicant event rows, all with typed applicant-user refs.
- 44 staff event rows, 43 with typed staff-profile refs in the initial additive pass.
- 1 legacy staff event remained unresolved in the initial additive pass; this was later resolved and CHECK-hardened by `20260427_0016`.
- 1 system event row, with no typed actor ref as expected.
- Event feed smoke returned rows through the shared service without the previous collation-sensitive join risk.
- `db:migrate:plan -- --target-env dev` shows 0 pending after the final `0005` checksum.

Operational note:

- DEV first applied `0005`, then the migration was tightened to backfill legacy `message_received` events through their linked message sender staff profile and reapplied as a final checksum. TEST/PROD should only see the final file.

Verification performed:

- `npx env-cmd -f .env node --check ../shared/events/emitter.js`
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct SQL confirmed the initial typed event actor counts; the remaining unresolved aggregate was later closed by `20260427_0016`.
- Shared event-service smoke returned recent event rows using the updated typed/fallback joins.

### DEV Application Version Author Typing

Closed the application-version author field before it accumulates production rows in the old free-form shape:

- Added migration `sql/migrations/20260427_0006_add_application_version_typed_author_references.sql`.
- Added nullable typed author columns to `iset_application_version`:
  - `created_by_staff_profile_id`
  - `created_by_user_id`
- Added indexes and FKs to `staff_profiles(id)` and `user(id)` with `ON DELETE RESTRICT`.
- Backfills staff-profile author references from legacy `created_by_id` when it is a staff-profile ID or staff Cognito subject.
- Backfills local user author references from legacy `created_by_id` only when it matches `user.cognito_sub`, avoiding numeric user/staff-profile collision guesses.
- Updated application version insert helpers so new version rows write typed staff-profile and local-user author references when the columns exist.
- Updated version list/detail responses to expose `savedByStaffProfileId` and `savedByUserId` while retaining compatibility `savedById`.
- Extended the privacy audit with application-version typed author counts.

DEV post-checks:

- `iset_application_version` has 0 rows in DEV, so no author backfill was needed.
- `created_by_staff_profile_id` and `created_by_user_id` are present with FKs.
- The regenerated audit shows 0 application-version rows and 0 unresolved legacy author values.
- `db:migrate:plan -- --target-env dev` shows 0 pending after `20260427_0006`.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct SQL confirmed the new columns/FKs and the successful migration ledger row.

### DEV Event Receipt Viewer Typing

Closed the next opaque event principal before read-state rows accumulate around a legacy string-only recipient:

- Added migration `sql/migrations/20260427_0007_add_event_receipt_typed_viewer_references.sql`.
- Added nullable typed viewer columns to `iset_event_receipt`:
  - `viewer_staff_profile_id`
  - `viewer_applicant_user_id`
- Added indexes and FKs to `staff_profiles(id)` and `user(id)` with `ON DELETE CASCADE`.
- Added CHECK constraint `chk_iset_event_receipt_single_typed_viewer` so a receipt cannot point at both a staff profile and an applicant user.
- Backfills staff viewers from staff Cognito subject and unambiguous numeric staff-profile IDs.
- Backfills applicant viewers from applicant Cognito subject and unambiguous numeric shared-user IDs.
- Leaves ambiguous numeric legacy `recipient_id` rows unresolved instead of guessing between `staff_profiles.id` and `user.id`.
- Updated `../shared/events/emitter.js` and `../shared/events/index.js` so event feed/timeline read-state joins and `markRead` writes use typed viewer columns when present, while retaining legacy `recipient_id` compatibility.
- Updated admin event timeline/feed/read routes to pass the authenticated staff-profile viewer ID.
- Hardened the read-state join to aggregate matching receipts per event, so mixed legacy/typed receipt rows cannot duplicate feed events.
- Runtime read/write helpers now prefer the staff-profile viewer when both typed viewer IDs are accidentally supplied, matching the database one-viewer-domain guard.
- Extended the privacy audit with event-receipt typed viewer counts and reclassified `iset_event_receipt.recipient_id` as a legacy read-state principal shadow.

DEV post-checks:

- `iset_event_receipt` has 0 rows in DEV, so no viewer backfill was needed.
- `viewer_staff_profile_id` and `viewer_applicant_user_id` are present with FKs.
- `chk_iset_event_receipt_single_typed_viewer` is present.
- The regenerated audit shows 0 event receipts and 0 unresolved legacy viewer values.
- Event feed smoke returned recent rows through the shared service using the new typed receipt join.
- `db:migrate:plan -- --target-env dev` shows 0 pending after `20260427_0007`.

Verification performed:

- `npx env-cmd -f .env node --check ../shared/events/emitter.js`
- `npx env-cmd -f .env node --check ../shared/events/index.js`
- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env node scripts/privacy-erm-audit.js --out docs/data/privacy-erm-audits/dev-20260426.md --max-rows 80`
- Direct SQL confirmed the new columns/FKs and 0 receipt rows.
- Direct SQL confirmed the single typed-viewer CHECK constraint and 0 dual-typed receipt rows.
- Shared event-service smoke returned recent event rows with typed viewer parameters.

Operational note:

- DEV first applied `0007`, then the migration was tightened with the single typed-viewer CHECK and reapplied as a final checksum. TEST/PROD should only see the final file.

### DEV Manual Upload Case-Scope Resolver Cleanup

Closed the first runtime mismatch exposed by the hardened document CHECK constraints:

- DEV testing of application reference `ISET-20260427-03EDB1` / application `3` failed to upload an `evidence_expense` manual supporting document because the insert wrote `application_id = 3` and `case_id = NULL`.
- The database was correct to reject that shape through `chk_iset_document_manual_upload_scope`; the fix is not to loosen the CHECK.
- Patched `resolveDocumentAttachmentContext()` in `isetadminserver.js` so `client`, `application`, and `action_plan` scope resolution preserve or derive the real owning `case_id`.
- Application-scoped uploads now keep both `application_id` and the real `case_id`, and reject mismatched supplied case/application pairs with `application_case_mismatch`.
- Action-plan-scoped uploads now keep both `action_plan_id` and the real `case_id`, and reject mismatched supplied plan/case pairs with `action_plan_case_mismatch`.
- Application-type uploads that fall back to an action plan for application-less cases now also keep the action plan's real `case_id`.
- Updated durable document guidance so future deploy/migration work treats `chk_iset_document_manual_upload_scope` as a privacy guard, not an obstacle.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- Transactional DEV insert smoke for application `3` wrote `case_id = 1`, `application_id = 3`, `client_id = 1`, `applicant_user_id = 2`, `source = 'manual_upload'`, `document_category = 'evidence_expense'`; the constraint accepted it and the transaction rolled back.
- Transactional DEV insert smoke for action plan `2` wrote `case_id = 1`, `action_plan_id = 2`, `client_id = 1`, `source = 'manual_upload'`, `document_category = 'alternate_payee_letter'`; the constraint accepted it and the transaction rolled back.
- `git diff --check`
- `git -C ../ISET-intake diff --check`
- Focused trailing-space/conflict-marker scan across the document/progress/changelog files touched in this lane.

Deployment note:

- TEST/PROD should promote this resolver change with the document hardening release. If `chk_iset_document_manual_upload_scope` fails in rehearsal, quarantine/fix the caller or resolver path that lost scope; do not weaken the constraint to accept unscoped manual uploads.

### DEV System-Generated Document Scope Hardening

Closed the remaining generated-document scope gap and one future runtime mismatch:

- The audit showed one application-linked `system_generated` document without `applicant_user_id`: document `37`, a `payment_audit_bundle` for payment packet `2`.
- Added migration `sql/migrations/20260427_0008_harden_system_generated_document_scope.sql`.
- Backfilled document `37` from its application submission applicant user, changing it to `applicant_user_id = 2`.
- Tightened `chk_iset_document_system_generated_scope` so system-generated rows require `client_id` and `case_id`, and when `application_id` is present they also require `applicant_user_id`.
- Patched `storeGeneratedDocument()` so generated supporting documents resolve/validate case, client, application, and applicant scope before uploading and inserting.
- Updated payment packet PDF/audit-bundle generation to pass packet client/application/applicant scope into generated document storage.
- Split global payment batch export away from `iset_document`; the CSV object key/checksum remains in `payment_batch.export_metadata`, but the export no longer pretends to be a client/case supporting document.
- Updated `scripts/privacy-erm-audit.js` so system-generated violation counts match the tightened CHECK.

DEV post-checks:

- `iset_document` now has 0 application-linked `system_generated` rows missing `applicant_user_id`.
- The regenerated audit shows `system_generated` missing applicant count 0 and source-specific violation count 0.
- `chk_iset_document_system_generated_scope` now includes `(application_id IS NULL OR applicant_user_id IS NOT NULL)`.
- `db:migrate:plan -- --target-env dev` shows 0 pending after `20260427_0008`.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct SQL confirmed the current `0008` checksum in `iset_migration`, 0 missing generated-document applicant scopes, document `37` backfilled to applicant user `2`, and the tightened CHECK clause.

Deployment note:

- TEST/PROD rehearsal must run the document source-specific audit before `0008`. Any application-linked generated document without applicant scope should be backfilled from the application submission if deterministic; non-case/global generated exports should be moved out of `iset_document` rather than exempted from the supporting-document constraint.

### DEV Assignment Response Naming Cleanup

Completed the lower-risk response/event payload cleanup for case assignment naming without changing the DB shape:

- `resolveOrCreateCaseForClient()` now accepts `assignedStaffProfileId` as the preferred input and returns explicit `assignedStaffProfileId` / `assigned_staff_profile_id` fields, while retaining legacy `assignedToUserId` / `assigned_to_user_id` transition aliases.
- Admin case creation, assign, and reassign responses now use the shared assignment response helper so clients receive explicit staff-profile fields consistently.
- Applicant application-list responses now include the explicit assignment aliases when a case is present.
- Assignment events now include `from_assignee_staff_profile_id`, `to_assignee_staff_profile_id`, and `assigned_staff_profile_id` alongside the older `*_assignee_id` aliases.
- Public portal auto-assignment events now carry `to_assignee_staff_profile_id` as well as the older `to_assignee_id`.
- Shared notification delivery now resolves assignment recipients from explicit staff-profile payload fields first, falling back to legacy aliases only as compatibility.
- Frontend assignment alias construction now emits explicit staff-profile fields plus the legacy aliases, all carrying the same staff-profile ID.

No migration was needed for this response-contract lane itself. The physical legacy `iset_case.assigned_to_user_id` column was retired later in DEV by `20260427_0010`; TEST/PROD must still rehearse that drop before promotion.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../shared/events/notificationDispatcher.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `git diff --check`
- `git -C ../ISET-intake diff --check`

### Legacy Compatibility Shadow Retirement Inventory

Completed the read-only retirement prep for the remaining physical legacy fields:

- Added a consolidated `Legacy compatibility shadow retirement inventory` section to `scripts/privacy-erm-audit.js`.
- Added durable planning doc `docs/planning/privacy-erm-legacy-field-retirement-inventory.md`.
- The DEV audit now classifies each known compatibility shadow with its canonical replacement, value counts, drift/unresolved count, and retirement gate.

Current DEV data snapshot before the physical retirement migrations:

- `messages.sender_id`: 6 values, 0 drift from typed sender fields.
- `messages.recipient_id`: 6 values, 0 drift from typed recipient fields.
- `iset_case.assigned_to_user_id`: 2 values, 0 drift from `assigned_staff_profile_id`.
- `iset_internal_notification.audience_user_id`: 35 direct-audience values, 0 drift from typed audience fields.
- `iset_internal_notification_dismissal.user_id`: 42 values, 0 drift from typed viewer fields.
- `iset_event_receipt.recipient_id`: 0 values in DEV, but shared event emitter legacy queries still exist.
- `iset_event_entry.actor_id`: 55 populated values, 0 unresolved typed actor rows after `20260427_0016`; this remains audit principal text, not a simple drop candidate.
- `iset_application_version.created_by_id`: physically retired in DEV by `20260427_0015`.
- `iset_case.application_id`: 2 case-side pointers, 0 mismatches against `iset_application.case_id`; 3 application rows now point at cases, so the target model already supports one case with multiple applications.

Conclusion:

- No destructive column retirement was done in this lane.
- At this stage, the data for true shadows was aligned in DEV, but code gates remained for secure messages, assignment, notifications, event receipts, and case/application target-model cleanup. Secure-message participant, assignment, and internal-notification shadows were physically retired later by `20260427_0009`, `20260427_0010`, and `20260427_0011`.
- `actor_id`, `application_lock.owner_user_id`, and session-audit user IDs are retained opaque operational/audit principals; do not reinterpret them as shared `user.id`.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `git diff --check`
- `git -C ../ISET-intake diff --check`

### Secure Message Participant Shadow Physical Retirement

Completed the first physical legacy-field retirement in DEV:

- Removed routine admin secure-message selects/inserts of `messages.sender_id` and `messages.recipient_id`.
- Removed routine public-portal secure-message selects/inserts of `messages.sender_id` and `messages.recipient_id`.
- Kept typed actor authority on `sender_actor_type`, `sender_user_id`, `sender_staff_profile_id`, `recipient_actor_type`, `recipient_user_id`, and `recipient_staff_profile_id`.
- Added migration `sql/migrations/20260427_0009_retire_secure_message_legacy_participant_columns.sql`.
- The migration fails closed if either legacy column has drift from the typed user fields, records aggregate before-drop counts in `privacy_erm_secure_message_participant_shadow_retirement_audit`, drops any FK still attached to the legacy columns, then drops the columns.

DEV apply result:

- Migration `20260427_0009` applied successfully.
- Aggregate retirement audit recorded 6 messages, 6 sender shadow values, 6 recipient shadow values, 0 sender drift, and 0 recipient drift.
- `messages` now has `sender_actor_type` and `recipient_actor_type`; `sender_id` and `recipient_id` are absent.
- The regenerated privacy audit now marks the message participant shadows as physically retired in this schema.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct DEV schema check confirmed only `sender_actor_type` / `recipient_actor_type` remain from the old/new participant marker set.

### Case Assignment Shadow Physical Retirement

Completed the second physical legacy-field retirement in DEV:

- Removed routine admin, portal, shared RBAC, case-access, notification, and assignment helper dependence on the physical `iset_case.assigned_to_user_id` column.
- Assignment reads and writes now use `assigned_staff_profile_id` directly. Legacy response/request aliases such as `assigned_to_user_id`, `assignedToUserId`, `assigned_user_id`, and `assignedUserId` may still be emitted or accepted for compatibility, but they are derived from `assigned_staff_profile_id`.
- Added migration `sql/migrations/20260427_0010_retire_legacy_case_assignment_shadow.sql`.
- The migration fails closed if `assigned_to_user_id` has drift from `assigned_staff_profile_id`, records aggregate before-drop counts in `privacy_erm_case_assignment_shadow_retirement_audit`, drops any FK/indexes attached to the legacy column, then drops the column.

DEV apply result:

- Migration `20260427_0010` applied successfully.
- Aggregate retirement audit recorded 2 cases, 2 legacy shadow values, 2 explicit assignment values, and 0 drift.
- `iset_case` now has `assigned_staff_profile_id`; `assigned_to_user_id` is absent.
- The regenerated privacy audit now marks the case-assignment shadow as physically retired in this schema.

Verification performed:

- `npx env-cmd -f .env node --check isetadminserver.js`
- `npx env-cmd -f .env node --check ../ISET-intake/server.js`
- `npx env-cmd -f .env node --check ../shared/events/notificationDispatcher.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct DEV schema check confirmed only `assigned_staff_profile_id` remains from the assignment column pair.

### Internal Notification Audience/Viewer Shadow Physical Retirement

Completed the third physical legacy-field retirement in DEV:

- Removed runtime notification fetch/dismiss/dispatch dependence on `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id`.
- Notification direct audiences now use `audience_actor_type`, `audience_staff_profile_id`, and `audience_applicant_user_id`; dismissals use `viewer_actor_type`, `viewer_staff_profile_id`, and `viewer_applicant_user_id`.
- Added migration `sql/migrations/20260427_0011_retire_internal_notification_legacy_identity_shadows.sql`.
- The migration fails closed if either legacy shadow drifts from the typed audience/viewer fields, records aggregate before-drop counts in `privacy_erm_internal_notification_shadow_retirement_audit`, replaces the old shadow-coupled CHECK constraints with typed-only CHECK constraints, drops old legacy indexes/FKs where present, then drops the two legacy columns.

DEV apply result:

- Migration `20260427_0011` applied successfully.
- Aggregate retirement audit recorded 61 notifications, 35 direct-audience shadow values, 35 typed audience values, 0 audience drift, 42 dismissals, 42 dismissal shadow values, 42 typed dismissal values, and 0 dismissal drift.
- `iset_internal_notification` now has typed audience fields only; `audience_user_id` is absent.
- `iset_internal_notification_dismissal` now has typed viewer fields only; `user_id` is absent.
- The regenerated privacy audit marks both notification shadows as physically retired in this schema.

Verification performed:

- `npx env-cmd -f .env node --check src/internalNotifications.js`
- `npx env-cmd -f .env node --check ../shared/events/notificationDispatcher.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:apply -- --target-env dev`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct DEV schema check confirmed only typed notification audience/viewer columns remain, with typed-only CHECK constraints `chk_internal_notification_audience_typed_scope` and `chk_internal_notification_dismissal_typed_viewer_scope`.

### Event Receipt Shadow Physical Retirement

Completed the fourth physical legacy-field retirement in DEV:

- Moved shared event feed/case event read-state joins to typed `viewer_staff_profile_id` / `viewer_applicant_user_id` keys and removed the legacy `recipient_id` database fallback from the shared emitter.
- Moved `markEventRead()` writes off `recipient_id`; writes now require a staff-profile or applicant-user viewer key.
- Added migration `sql/migrations/20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql`.
- The migration fails closed if legacy `recipient_id` values cannot be resolved to exactly one typed viewer or if duplicate typed viewer receipt groups would collide, records aggregate before-drop counts in `privacy_erm_event_receipt_shadow_retirement_audit`, replaces the legacy composite primary key with a surrogate `id`, adds typed unique keys, tightens the typed-viewer CHECK, and drops `recipient_id`.

DEV apply result:

- Migration `20260427_0012` applied successfully.
- Aggregate retirement audit recorded 0 receipts, 0 legacy recipient values, 0 typed viewer values, 0 unresolved typed viewers, and 0 duplicate typed viewer groups.
- `iset_event_receipt` now has `id`, `event_id`, `viewer_staff_profile_id`, `viewer_applicant_user_id`, and `read_at`; `recipient_id` is absent.
- The regenerated privacy audit marks the event receipt shadow as physically retired in this schema.

Verification performed:

- `npx env-cmd -f .env node --check ../shared/events/emitter.js`
- `npx env-cmd -f .env node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- Direct DEV schema check confirmed `recipient_id` is absent, typed viewer unique keys are present, and `chk_iset_event_receipt_exactly_one_typed_viewer` is active.

### Case/Application Pointer Physical Retirement

Completed the case-side application pointer cleanup in DEV:

- Admin, portal, shared notification/watchlist, import/demo, and audit paths no longer select, join, insert, or update the physical `iset_case.application_id` column.
- Case-level code now derives compatibility `application_id` response fields from the latest `iset_application` row whose `case_id` points at the case.
- Public portal intake and admin/manual case resolution no longer refresh a case-side application pointer; they persist application ownership through `iset_application.client_id` and `iset_application.case_id`.
- Added migration `sql/migrations/20260427_0013_retire_legacy_case_application_pointer.sql`.
- The migration records row-level legacy pointer state in `privacy_erm_case_application_pointer_retirement_audit`, backfills missing application ownership from the old pointer, fails closed on duplicate pointer groups, missing pointed applications, post-backfill ownership mismatches, or applications left without `case_id`, then drops `iset_case.application_id`.

DEV apply result:

- Migration `20260427_0013` applied successfully.
- Direct DEV schema check confirmed `iset_case.application_id` is absent.
- DEV has 2 cases, 3 applications, 0 applications missing `case_id`, 2 retirement audit rows, and 0 post-backfill retirement audit mismatches.
- The regenerated privacy audit marks the case-side application pointer as physically retired in this schema.

Completed the application ownership hardening in DEV:

- Public portal submission, admin manual intake, admin case-from-submission creation, demo data generation, and `scripts/seedDevCases.js` now resolve/create the owning case before inserting a new `iset_application` row.
- New `iset_application` rows are inserted with both `client_id` and `case_id`; ownership is no longer inserted as nullable data and repaired afterward.
- Added migration `sql/migrations/20260427_0014_harden_application_case_scope.sql`.
- The migration records row-level application/case/client scope in `privacy_erm_application_scope_hardening_audit`, backfills deterministic missing client links from the owning case or single-client application group, fails closed on missing application client, missing case, missing case client, or application/case client mismatch, then makes `iset_application.client_id` and `iset_application.case_id` `NOT NULL`.
- DEV apply result: `iset_application.client_id` and `iset_application.case_id` are both `NOT NULL`; DEV has 3 applications, 0 missing application client links, 0 missing application case links, 0 application/case client mismatches, 3 hardening audit rows, and 0 hardening audit blockers.

Verification performed:

- `npm run db:migrate:apply -- --target-env dev`
- `npm run db:migrate:plan -- --target-env dev`
- `node --check isetadminserver.js`
- `node --check ../ISET-intake/server.js`
- `node --check ../shared/events/notificationDispatcher.js`
- `node --check ../shared/applicantWatchlist.js`
- `node --check scripts/privacy-erm-audit.js`
- `node --check scripts/seedDevCases.js`
- `node --check scripts/debugAssessorCounts.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npm run dump:dev-schema`
- Direct DEV SQL check confirmed `legacy_case_application_column_count = 0`, `applications_missing_case_id = 0`, and `audit_mismatches_after = 0`.
- Direct DEV SQL check confirmed `iset_application.client_id` / `case_id` are `NOT NULL`, `applications_missing_client = 0`, `applications_missing_case = 0`, `application_case_client_mismatches = 0`, and `privacy_erm_application_scope_hardening_audit` has 0 blockers.

### Application-Version Author Shadow Physical Retirement

Completed the version-author compatibility cleanup in DEV:

- Removed runtime inserts/selects/responses that depended on `iset_application_version.created_by_id`.
- Version author display now resolves from `created_by_staff_profile_id` or `created_by_user_id`; compatibility `savedById` values are derived as typed strings such as `staff:<id>` or `user:<id>`.
- Added migration `sql/migrations/20260427_0015_retire_application_version_legacy_author_shadow.sql`.
- The migration records historical `created_by_id` state in `privacy_erm_application_version_author_shadow_retirement_audit`, fails closed if any non-empty legacy value lacks a typed author reference, and then drops `created_by_id`.

DEV apply result:

- Migration `20260427_0015` applied successfully.
- `iset_application_version` has 0 rows in DEV, so no historical author values needed repair.
- Direct schema checks confirmed `created_by_id` is absent and the typed author columns remain.
- The regenerated privacy audit now marks `created_by_id` as physically retired.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-erm-audit.js`
- `npm run db:migrate:apply -- --target-env dev`
- `npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npm run dump:dev-schema`

### Event-Entry Typed Actor Scope Hardening

Completed the opaque event-principal cleanup without treating raw audit text as an authorization subject:

- Kept `iset_event_entry.actor_id` as audit-retained principal text.
- Removed code paths that used raw `event.actor_id` to resolve staff/applicant labels, notification recipients, or portal applicant email recipients when typed actor refs are available.
- Shared event reads now join actor labels by `actor_staff_profile_id` / `actor_applicant_user_id`; old raw joins remain only for databases that have not run the typed actor migration.
- Added migration `sql/migrations/20260427_0016_harden_event_entry_typed_actor_scope.sql`.
- The migration backfills deterministic typed actors, records row-level state in `privacy_erm_event_actor_scope_hardening_audit`, fails closed on unresolved staff/applicant actors or dual typed actors, and adds `chk_iset_event_entry_typed_actor_scope`.

DEV apply result:

- Migration `20260427_0016` applied successfully after the migration was patched for MySQL collation-safe candidate comparisons.
- DEV now has 45 staff event rows with 45 staff-profile refs, 10 applicant event rows with 10 applicant-user refs, and 1 system event row with no typed actor ref.
- There are 0 unresolved staff/applicant event actors and 0 actor-scope blockers.
- `chk_iset_event_entry_typed_actor_scope` is present.
- The regenerated privacy audit now shows no unresolved event actor samples; `actor_id` remains classified as retained audit principal text.

Verification performed:

- `node --check isetadminserver.js`
- `node --check ../ISET-intake/server.js`
- `node --check ../shared/events/emitter.js`
- `node --check scripts/privacy-erm-audit.js`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md`
- `npm run dump:dev-schema`
- `npm run db:migrate:plan -- --target-env dev`
- Direct DEV SQL confirmed `created_by_id_columns = 0`, `blockers = 0`, and `privacy_erm_event_actor_scope_hardening_audit` has 56 rows with 0 blockers.

### Application and CFA Relationship FK Hardening

Closed the next high-risk relationship-looking FK gaps in DEV:

- Added migration `sql/migrations/20260427_0017_harden_application_and_cfa_relationship_fks.sql`.
- Added `fk_iset_application_submission_id` from `iset_application.submission_id` to `iset_application_submission(id)`.
- Added `fk_iset_application_version_application` from `iset_application_version.application_id` to `iset_application(id)`.
- Converted `cfa_series.case_id` to `BIGINT UNSIGNED` and constrained it to `iset_case(id)`.
- Added CFA version FKs for series, superseded version, and signed participant user.
- Converted `cfa_version_documents.document_id` to `BIGINT UNSIGNED` and constrained CFA document links to `iset_document(id)`; CFA version-document rows now also constrain `cfa_version_id`.
- Added row-level preflight/audit table `privacy_erm_relationship_fk_hardening_audit`.
- Extended the privacy ERM audit with application/CFA lineage counts and included the new FKs in the privacy-sensitive delete-rule inventory.
- Updated `ensureApplicationVersionTable()` so fresh DEV/test databases create the application-version table with the application FK.

DEV apply result:

- Migration `20260427_0017` applied successfully.
- The hardening audit recorded 0 blockers.
- Direct SQL confirmed all eight new FKs are present, `cfa_series.case_id` is `BIGINT UNSIGNED`, and `cfa_version_documents.document_id` is `BIGINT UNSIGNED`.
- The regenerated privacy audit shows 0 missing application/CFA lineage targets and 0 CFA document case/client mismatches.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-erm-audit.js`
- `npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md --max-rows 100`
- `npm run dump:dev-schema`
- Direct DEV SQL confirmed the new FK names/delete rules and 0 relationship hardening blockers.

### Remaining Relationship FK Hardening

Closed the next relationship-looking FK gaps in DEV where the target relationship was real and deterministic:

- Added read-only preview SQL `sql/ops/privacy-erm-client-account-event-orphan-preview.sql`.
- Added guarded apply SQL `sql/ops/privacy-erm-client-account-event-orphan-apply.sql`.
- The apply script preserves orphan event IDs, client IDs, event type, actor staff profile ID, metadata hash, and event timestamp in `privacy_erm_client_account_event_orphan_cleanup_audit`, then deletes orphan client-account event rows.
- Applied the DEV cleanup run `client-account-event-orphan-20260427203708`; 40 orphan `client_applicant_account_event` rows were preserved in the audit table and deleted from live relationship data.
- Added migration `sql/migrations/20260427_0018_harden_remaining_relationship_fks.sql`.
- Added `fk_client_applicant_account_event_client` from `client_applicant_account_event.client_id` to `client(id)` with `ON DELETE RESTRICT`.
- Added `fk_input_json_state_client` from `input_json_state.client_id` to `client(id)` with `ON DELETE SET NULL`.
- Added `fk_case_assessment_intervention_budget_pot` from `iset_case_assessment.intervention_budget_pot_id` to `budget_pot(id)` with `ON DELETE SET NULL`.
- Added `fk_case_reminder_action_plan` from `iset_case_reminder.action_plan_id` to `iset_case_action_plan(id)` with `ON DELETE SET NULL`.
- Converted `staff_profiles.region_id` to `TINYINT UNSIGNED` and added `fk_staff_profiles_region` to `canada_region(region_id)` with `ON DELETE SET NULL`.
- Updated `staffProfileMiddleware` fallback table creation so fresh/local schemas create `staff_profiles.region_id` in the same unsigned tinyint domain as `canada_region.region_id`.
- Extended the privacy ERM audit with remaining-relationship counts, workflow string-key counts, the client-account-event table, and the new FKs in the privacy-sensitive delete-rule inventory.

DEV apply result:

- Migration `20260427_0018` applied successfully.
- `npm run db:migrate:plan -- --target-env dev` showed 0 pending after `0018`.
- Direct SQL confirmed all five new FKs are present, `staff_profiles.region_id` is `tinyint unsigned`, the client-account orphan count is 0, and 40 orphan rows are preserved in the cleanup audit table.
- The regenerated privacy audit shows 0 blockers for the 0018 relationship targets.
- Workflow IDs remain reported separately as string runtime keys such as `iset-v1`; they are not safe numeric FKs to `workflow.id` without a workflow-key model change.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-erm-audit.js`
- `npm run db:migrate:apply -- --target-env dev`
- `npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md --max-rows 100`
- `npm run dump:dev-schema`
- Direct DEV SQL confirmed the new FK names/delete rules, `staff_profiles.region_id` typing, 0 remaining 0018 blockers, and the preserved client-account-event cleanup audit rows.

### Legacy Document Experiment Retirement and ID Classification

Closed the remaining clear legacy-table candidate and made the leftover ID inventory actionable:

- Confirmed `zzz_legacy_documents` had 0 DEV rows.
- Confirmed the only live code reference was the local clear-test object-key purge helper, which already tolerated missing legacy sources.
- Removed `zzz_legacy_documents` from `CLEAR_TEST_OBJECT_KEY_SOURCES` in `isetadminserver.js`.
- Added migration `sql/migrations/20260427_0019_retire_zzz_legacy_documents_table.sql`.
- The migration records the table in `privacy_erm_legacy_table_retirement_audit` and drops it only if it is empty; non-empty TEST/PROD tables fail closed and must be quarantined or archived separately.
- Added `zzz_legacy_documents` to the audit's legacy/experiment table status list.
- Extended the audit's ID-like inventory with classifications and next actions so runtime workflow keys, event audit principals, external finance/payment references, upload tokens, tutorial keys, and lookup primary keys are no longer treated as unresolved FK work.
- Deleted the stale schema dump file for the retired table.

DEV apply result:

- Migration `20260427_0019` is recorded as successfully applied.
- `zzz_legacy_documents` is absent from DEV.
- The regenerated privacy audit lists `zzz_legacy_documents` as missing, reports 130 base tables, and classifies all remaining ID-like no-FK columns.
- The remaining workflow IDs are still classified as runtime string keys such as `iset-v1`, not numeric `workflow.id` values.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-erm-audit.js`
- `npm run db:migrate:apply -- --target-env dev`
- `npm run db:migrate:plan -- --target-env dev`
- `npx env-cmd -f .env npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/dev-20260426.md --max-rows 100`
- `npm run dump:dev-schema`
- Direct DEV SQL confirmed the table is absent and the successful migration ledger row exists.

### Privacy ERM Smoke Checker

Added a reusable read-only smoke checker for DEV and later TEST/PROD rehearsal:

- Added `scripts/privacy-erm-smoke.js`.
- Added npm alias `npm run smoke:privacy-erm`.
- The checker asserts retired tables/columns are absent, required privacy FKs and CHECK constraints exist, hardening audit blockers are zero, mailbox state has only true message participants, secure messages follow typed actor scope, documents satisfy source-specific lineage, applications still match their case/client ownership, client-account events have clients, and `zzz_legacy_documents` has a retirement audit row.
- Workflow string-key rows are reported as informational and explicitly do not fail the smoke, because those fields are runtime keys such as `iset-v1`, not numeric `workflow.id` values.
- The first run exposed a collation-sensitive workflow-key comparison in the new script; the query now uses binary comparisons.
- The second run exposed that the smoke assertion was stricter than the actual typed-message model: staff-profile message actors intentionally carry both `*_staff_profile_id` and the resolved local `*_user_id`. The assertion now matches the CHECK constraint and the current code model.

DEV result:

- `npm run smoke:privacy-erm` passed.
- The smoke reports 3 workflow string-key rows as classified informational rows, not failures.

Verification performed:

- `node --check scripts/privacy-erm-smoke.js`
- `npm run smoke:privacy-erm`

### Route-Scope Smoke and Finance Evidence Key Hardening

Started the route-level scope-denial lane by closing a raw object-key exposure in finance allocation evidence:

- `POST /api/allocations/evidence/upload`, `/delete`, and `/presign-download` now require System Administrator or NWAC Administrator instead of accepting any authenticated staff request.
- Allocation evidence uploads now store object keys under an actor-specific `allocations/<localUserId>` object prefix and record a short-lived `pending_uploads` row with `document_type = finance_allocation_evidence`.
- Allocation evidence delete/presign now rejects arbitrary object keys. A key must either be referenced in `budget_allocation.metadata.evidence[*].attachments[*]` / `budget_pot.metadata.evidence[*].attachments[*]`, or be an unexpired pending finance evidence upload owned by the current local staff user.
- Delete refuses to remove evidence already referenced by a budget allocation or pot (`finance_evidence_in_use`).
- Legacy allocation evidence keys already stored as `uploads/YYYY/MM/DD/allocations/<uuid>-...` remain readable when referenced by allocation/pot metadata; new uploads use `uploads/YYYY/MM/DD/allocations/<actorUserId>/<uuid>-...`.
- The allocation-evidence administrator guard uses the canonical role normalizer, so Cognito-style aliases for the two administrator roles are handled consistently with the rest of the admin access layer.

Added a lightweight static route-scope smoke:

- Added `scripts/privacy-route-scope-smoke.js`.
- Added npm alias `npm run smoke:privacy-routes`.
- The smoke checks guard markers on high-risk route surfaces: allocation evidence object keys, admin/public document presign, applicant/case document lists, admin secure-message attachments, case event feed, public secure-message detail/mutations/sends, and participant signing-request detail/sign.
- This is intentionally a regression tripwire, not a replacement for live wrong-user/wrong-case HTTP denial tests.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-route-scope-smoke.js`
- `npm run smoke:privacy-routes`
- Direct DEV SQL confirmed current allocation evidence metadata is discoverable through the same `JSON_TABLE` shape used by the hardened presign/delete checks; DEV has 6 existing referenced allocation evidence attachments and 0 pending finance evidence uploads.

### Route-Scope Authoring, Application, Escalation, and Case Mutation Hardening

Continued the route-level scope-denial lane across admin surfaces that previously trusted staff auth, locks, or role filters without first proving object scope:

- Workflow/component authoring routes now require the step-editor role for component templates, component render/audit endpoints, workflow detail/mutation/preview/validate endpoints, and the frontend `/modify-component/:id` route.
- Legacy blockstep and raw Nunjucks generator/render endpoints now require explicit unsafe-admin-debug enablement plus System Administrator access.
- Case watch list/create/delete now revalidates each watched case through `validateCaseAccessByCaseId()`, preventing stale watch rows from continuing to expose case metadata after access changes.
- Application detail, PTMA summary update, version list/detail/save/restore, and lock acquire/release now call `enforceApplicationVisibility()` so raw application IDs only work when the caller can see the owning case and the application is not hidden by the archive rule.
- Escalation create/respond now validates the escalation application's case scope before mutating, and escalation list results are post-filtered through `validateCaseAccessForCaseRow()` so coordinator/regional role filters cannot expose out-of-scope escalation metadata.
- Case detail and case save now validate `validateCaseAccessByCaseId()` before returning or mutating case data.
- Legacy `PATCH /api/cases/:id/assign`, newer POST assign/reassign, conflict revoke/resolve, ILMP validate/prepare, and ready-to-close actions now validate case access before reading or mutating case data; assignment routes also require the existing assignment permission check.
- `scripts/privacy-route-scope-smoke.js` now checks these guards so future edits fail the static smoke if the access calls are removed.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-route-scope-smoke.js`
- `npm run smoke:privacy-routes`

### Route-Scope Query Export and Generated PDF Hardening

Continued the generated-file/reporting/export route lane:

- Query Editor server export metadata now exposes only the active environment PATH database instead of every schema visible to the DB login.
- Query Editor server export now rejects a requested database that is not the active environment database with `database_not_allowed`.
- The five admin-generated consent/declaration PDF routes now validate `applicationId` through `enforceApplicationVisibility()` before rendering a PDF, so a raw application ID cannot generate a file outside the caller's case/application scope.
- Reporting data-and-results/regional-snapshot routes were reviewed and already require `hasOperationalReportingAccess()`, which currently limits them to System Administrator and NWAC Administrator roles.
- Payment packet PDFs/audit bundles and payment batch/ledger exports were reviewed and already use the payments role guard plus packet/global finance scope helpers.
- `scripts/privacy-route-scope-smoke.js` now includes static tripwires for active-database export scope and generated PDF application visibility.

Verification performed:

- `node --check isetadminserver.js`
- `node --check scripts/privacy-route-scope-smoke.js`
- `npm run smoke:privacy-routes`

### TEST/PROD Rehearsal Runbook

Added a dedicated cleanup release rehearsal runbook:

- `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`
- `sql/ops/privacy-erm-staff-shared-user-identity-preview.sql`

The runbook captures the release shape, local DEV gates, TEST rehearsal order, PROD preflight requirements, stop conditions, rollback expectations, and the rule that privacy CHECK constraints are not loosened to make legacy data fit.

### Staff/Profile Shared-User Email Fallback Cleanup

Continued the identity-domain cleanup on shared `user` and `staff_profiles` overlap:

- Public portal `resolveStaffProfileIdForUserId()` now maps a shared `user.id` to `staff_profiles.id` only through `user.cognito_sub = staff_profiles.cognito_sub`; it no longer falls back to matching email.
- Public portal secure-message display-name resolution now uses the local user's Cognito subject when it needs a staff display name, instead of using the local user's email to find a staff profile.
- Public portal signed CFA creator display fallback now uses `cognito_sub` for staff-profile lookup rather than email.
- Admin `findStaffProfileIdByUserId()` now maps a local shared user to a staff profile only by Cognito subject.
- Admin funding-agreement creator display fallback now uses `cognito_sub` rather than email.
- `scripts/privacy-route-scope-smoke.js` now has forbidden-pattern checks so these shared-user-to-staff-profile email fallbacks cannot be reintroduced unnoticed.

No schema migration was needed for this pass. The new preview SQL validated against DEV and currently reports 0 staff profiles missing Cognito subject, but 3 staff-email/shared-user overlaps where subjects do not match. Those are now explicit preflight rows, not runtime fallback candidates. TEST/PROD rehearsal must still count and resolve equivalent rows because this code intentionally refuses to guess by email.

### Public AI Support Prompt/History Privacy Hardening

Closed a concrete gap in the public support endpoint review lane:

- `POST /api/ai-support` already rejected obvious sensitive content in the current prompt before calling OpenRouter.
- The bounded recent chat history was sanitized for size/role, but was not scanned with the same sensitive-data detector.
- DEV now scans both the current prompt and the bounded history before any model call.
- The detector now also catches contiguous 9-digit SIN-style values, not only dashed/spaced forms.
- `scripts/privacy-route-scope-smoke.js` now includes a static tripwire that the public AI support route checks prompt plus history before the OpenRouter call.

No schema migration was needed.

### Admin Feedback Attachment Scope Review

Closed the admin feedback attachment portion of the remaining route review lane:

- Admin feedback supporting files are intentionally separate from `iset_document`; they are not case/application/client documents.
- No raw attachment download route was found. Presigned URLs are generated inside `loadAdminFeedbackReportDetail()` from `admin_feedback_attachment` rows belonging to the requested report.
- `GET /api/admin/feedback-reports/:id` is System Administrator-only before report detail and attachment URLs are returned.
- `scripts/privacy-route-scope-smoke.js` now checks these guard markers.

No code or schema change was needed beyond the static regression tripwire.

### Admin AI External-Data and Dummy-Generator Hardening

Closed the first admin AI/debug privacy pass:

- `POST /api/ai/chat` now blocks obvious raw applicant/client identifiers, credentials, contact details, PATH references, and live-record JSON fields in messages and chat context before proxying to OpenRouter.
- The denial-letter draft workflow now uses the existing local decision-letter template path instead of sending applicant denial context to OpenRouter.
- AI-backed dummy-data generators now require `ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES=true` plus System Administrator access, matching the existing unsafe debug route policy.
- Free-text dummy-generation guidance now gets the same sensitive-content block before any model call.
- `scripts/privacy-route-scope-smoke.js` now checks the admin AI guard, dummy-generator debug gates, and the local denial-letter draft path.

No schema migration was needed.

### Notification Template and Routing Configuration Gate

Closed a backend/page-gate mismatch in notification administration:

- `/manage-notifications` and `/template-editor` were already route-matrix limited to System Administrator and NWAC Administrator.
- Their backend configuration APIs still allowed any authenticated staff token to read or mutate notification templates, notification routing rows, and shared sender/reply-to settings.
- DEV now applies the same System/NWAC Administrator server-side check to `/api/templates`, `/api/notifications`, and `/api/config/notifications/email-settings`.
- `scripts/privacy-route-scope-smoke.js` now checks those notification configuration gates.

No schema migration was needed.

### Legacy Generic Shared-User API Retirement

Closed an old directory-surface leak:

- Current Manage Users code uses `/api/admin/users` for staff administration and `/api/admin/applicants` for applicant-account lookup.
- Legacy generic `/api/users` routes still existed in the monolith and one copy returned mixed shared-user names/emails from the historical `user` table.
- DEV now returns `410 retired_endpoint` for generic `/api/users` and `/api/users/:id` so the mixed staff/applicant local table cannot be used as a broad directory API.
- `scripts/privacy-route-scope-smoke.js` now checks that those legacy endpoints stay retired.

No schema migration was needed.

### Live Route-Denial Smoke Harness

Started converting the static route-scope guard markers into repeatable live denial checks:

- Added `scripts/privacy-route-denial-smoke.js` and npm alias `smoke:privacy-denials`.
- The harness uses real Cognito bearer tokens only; it does not add any dev impersonation or auth bypass path.
- Current checks cover non-admin denial for notification/template/sender configuration, legacy generic `/api/users` retirement, unsafe debug route blocking, cross-surface staff/applicant token rejection, wrong-applicant portal document/message access when applicant tokens or DB-discovered fixtures are available, explicit out-of-scope admin case/application/document probes, generated consent/declaration PDF application visibility, finance allocation evidence role/raw-key denial, and casework payment-packet/global-batch denial when fixture IDs are supplied.
- Missing tokens or fixtures are reported as `SKIP`; `--require-live` turns skipped checks into a failing gate for TEST rehearsal or a fully provisioned DEV run.

No schema migration was needed. Current no-token DEV run produces only expected `SKIP` rows and no false passes.

### TEST Rehearsal Package Tightening

Turned the grand cleanup runbook into a concrete TEST rehearsal checklist:

- Added exact preflight audit/preview commands, deterministic pre-cleanup apply commands, canonical migration plan/apply commands, and post-migration smoke commands.
- Made the maintenance expectation explicit: TEST apps should not run against a half-migrated schema during canonical migration apply.
- Added blocker-decision handling for unsafe `message_item` rows, document source-scope gaps, staff/shared-user identity overlaps, client account event orphans, non-empty experiment tables, application/client/case mismatches, and generated/manual document scope violations.

No code or schema migration was needed.

### Live Route-Denial Fixture Seeding and Payment Scope Fix

Added `npm run seed:privacy-denials`, an idempotent DEV-only seeder that uses the supplied applicant/staff tokens to create synthetic wrong-owner fixtures for the live route-denial harness. It writes ignored fixture IDs to `tmp/privacy-denial-fixtures.env`; this is test data setup only, not a TEST/PROD migration path.

The seeded live run found a real payment privacy defect: payment-packet scope rows used the compatibility alias `assigned_to_user_id`, while `src/lib/caseAccess.js` only considered `assigned_staff_profile_id`. Regional Manager scope therefore treated assigned out-of-region packets as unassigned and allowed them. The shared helper now resolves that alias as a staff-profile ID, and the seeded live denial check now returns `403 region_scope_mismatch` for out-of-region payment packet reads and PDFs.

Historical live route-denial status with the supplied tokens and seeded fixtures: 26 passed, 0 failed, 0 skipped with `--require-live`.

After fixture seeding, `smoke:privacy-erm` exposed 11 pre-existing/stale `message_item` anomalies. The TEST/PROD rehearsal cleanup SQL still referenced physically retired `messages.sender_id` / `recipient_id`, so it was updated to use typed `sender_user_id` / `recipient_user_id`. DEV cleanup run `message-item-20260427233945` preserved and deleted 10 orphan mailbox rows and 1 nonparticipant mailbox row. `smoke:privacy-erm` now passes again.

Public-portal smoke then exposed a transient intake-state regression: `POST /api/intake-json` tried to persist "no client yet" as `client_id = 0`, which correctly failed the new `input_json_state.client_id` FK. The portal helper now normalizes intake-state `clientId` through the existing positive-client-id parser so `null`, empty, or zero values write as SQL `NULL`; the FK remains strict. A rolled-back DB smoke confirmed `input_json_state.client_id = NULL` is valid under the hardened model. Browser retry is still needed with a fresh applicant session.

The synthetic privacy-denial DEV fixtures were later removed at Bill's request. Deleted marker graph: `PRIVDENIAL-*` submissions, applications, cases, synthetic clients, portal/admin/generated documents, the synthetic secure message, the payment packet, attached client-account events, and synthetic out-of-scope staff/user rows. The ignored local `tmp/privacy-denial-*.env` files were also removed. Post-cleanup checks found 0 remaining marker rows, 0 direct FK references to the deleted fixture IDs, 0 pending migrations, and `scripts/privacy-erm-smoke.js` passed with dotenv preloaded. The live denial harness now needs fresh tokens plus reseeding before another `--require-live` run.

Public-portal document upload smoke then exposed the old pre-submission dual-write shape: `/api/documents/finalize` inserted a `source='application_submission'` row into `iset_document` before an application/case existed, violating `chk_iset_document_application_submission_scope`. The portal now records pre-submission uploads in `iset_application_file` plus `input_json_state.doc_refs` only; `iset_document` is written immediately only when a validated existing application scope is present, and `/api/intake/complete` materializes referenced uploads into `iset_document` after case/application creation. The failed Jack DEV upload (`identity_document`, "Government ID") was added back to `input_json_state.doc_refs` so the current smoke session can continue.

Post-approval portal signing smoke exposed a related materialization gap: the EFT signing request preserved the uploaded voided cheque in `signing_request.signed_payload_json` and `iset_application_file`, but only the generated EFT PDF was adopted into `iset_document`. The portal signing completion path now materializes embedded signing-request upload files into scoped `application_submission` `iset_document` rows using the same client/case/application/applicant scope as the signed form. Current DEV case/application `4` was backfilled with `iset_document.id = 34` for `Void Cheque.png` / `document_category = 'voided_cheque'` so the approval checklist can continue.

## Still Open

### Restart Note - 2026-04-27

### TEST Rehearsal Checkpoint - 2026-04-28

The PROD-like TEST rehearsal for the grand privacy ERM cleanup has completed successfully enough for UAT smoke testing:

- TEST was restored from sanitized PROD dump `s3://nwac-test-artifacts/db-refresh/20260428-021742-prod-like-test-rehearsal.sanitized.sql.gz` after capturing backup `s3://nwac-test-artifacts/db-dumps/test/20260428-021742-pre-prod-like-restore.sql.gz`.
- TEST side-effect guard and identity overlay were applied. Imported PROD Cognito links are neutralized; TEST `bill@sillery.co.uk` and `program.admin@awentech.ca` are rebound.
- TEST canonical migrations show 0 pending through `20260427_0020_allow_casefile_secure_message_document_scope.sql`.
- TEST admin and portal were deployed as release `prod-like-privacy-erm-test`; both target groups are healthy.
- SSM DB smoke checks report 0 retired legacy surfaces, 0 relationship hardening blockers, 0 event actor blockers, 0 message mailbox anomalies, 0 secure-message scope anomalies, 0 document scope anomalies, 0 application ownership anomalies, and 0 client-account event orphans.

Duplicate-case follow-up before second rehearsal:

- The post-rehearsal TEST UI exposed Erica Christian as a visible duplicate-case client. A read-only TEST inventory found four duplicate client case groups: Ashlee Barner, Erica Christian, Hailey Lafrance-Chaput, and Shelly Van Loon.
- Main case-creation code paths were reviewed: public portal submission, admin manual intake, and `POST /api/cases` resolve/reuse a preferred case by `client_id`; client-file import updates a single existing case and blocks clients with multiple existing cases for manual review.
- Added `sql/ops/privacy-erm-duplicate-case-consolidation-preview.sql` and `sql/ops/privacy-erm-duplicate-case-consolidation-apply.sql`. The preview picks canonical cases using the documented precedence: open action plan/intervention history, richest operational history, assigned/open case, then recency. The apply script records `iset_case_merge_audit`, repoints case-owned child rows, merges case context JSON, archives/detaches merged-away case shells by clearing `client_id`, and fails closed on unique-key blockers or dangling references.
- The preview currently proposes four merge pairs with zero blockers. Ashlee Barner is the only group with case-owned rows to repoint from the merged case: 1 application, 1 assessment, 1 conflict declaration, and 15 documents. Erica Christian, Hailey Lafrance-Chaput, and Shelly Van Loon have empty shell duplicate cases to detach.
- A rollback-only TEST validation of the apply script reported 4 merge pairs, 0 remaining case-owned references, and 0 remaining duplicate client groups, then rolled back. Follow-up checks confirmed current TEST still has 4 duplicate groups and 0 `iset_case_merge_audit` rows.

## 2026-04-28 Second TEST rehearsal result

The second PROD-like TEST rehearsal applied the duplicate-case consolidation step for real and completed the privacy ERM release path through app deploy and target-group recovery.

Measured disruptive window:

- TEST apps stopped at `10:03:24` America/New_York.
- Post-deploy target-group smoke passed at `10:42:05` America/New_York.
- Observed downtime from app stop through healthy admin/portal target groups: approximately `38m 41s`.

Database outcomes:

- Canonical migration apply covered 33 migrations through `20260427_0020_allow_casefile_secure_message_document_scope.sql` in `10m 37s`.
- `npm run db:migrate:plan -- --target-env test` reported 0 pending after apply.
- Duplicate-case consolidation merged the four known duplicate groups with 0 blockers, 0 dangling case-owned references, and 0 remaining duplicate client-case groups.
- Erica Christian now has only case `107` attached; old case `38` is archived, detached from the client, and marked `merged_duplicate`.
- SSM DB smokes were clean for retired tables/columns, required FKs/CHECKs, relationship hardening, event actor scope, message mailbox rows, secure-message scope, document source scope, application ownership, client-account events, duplicate cases, and identity overlay bindings.

Operational outcomes:

- Admin and portal app build/deploy took `12m 29s`.
- The first target-group smoke immediately after deploy failed because one portal target was still warming up. Local instance curl returned `200`; both portal targets became healthy without changes and `npm run path:deploy:smoke -- --env test` then passed.
- `npm run smoke:privacy-routes` passed. `npm run smoke:privacy-denials` had no live tokens and reported 26 skips, 0 failures.

Second-rehearsal fix:

- `privacy-erm-message-item-cleanup-preview.sql` and `privacy-erm-message-item-cleanup-apply.sql` initially assumed post-migration message participant columns while the runbook correctly executes them before canonical migrations. They now dynamically use legacy `messages.sender_id` / `recipient_id` before migration and typed `sender_user_id` / `recipient_user_id` after migration.

Pre-PROD note:

- Commit the second-rehearsal SQL/doc changes before building PROD artifacts. The TEST admin build correctly reflected the current code but marked the admin checkout as dirty because the rehearsal fix and documentation were made after the user's `Pre 2nd Rehersal` commit.

Migration additions discovered by rehearsal:

- `20260426_0007_add_legacy_intake_document_source.sql` adds `legacy_intake_upload` and quarantines historical portal uploads that predate deterministic application/case materialisation.
- `20260426_0007_backfill_document_applicant_scope.sql` backfills applicant scope for application-linked manual/system documents from the owning application submission.
- `20260427_0016_backfill_unresolved_event_actor_scope.sql` preserves unresolved raw actor values but reclassifies unresolvable legacy staff/applicant events as `system`.
- `20260427_0016_reconcile_event_actor_scope_audit.sql` reconciles retry-produced event actor audit flags against current event rows.
- `20260427_0020_allow_casefile_secure_message_document_scope.sql` supports application-less case-file secure messaging without fabricating an application row.

Known verification note: local `audit:privacy-erm` and `smoke:privacy-erm` cannot reach private TEST RDS from the operator machine and time out. Use SSM-backed SQL checks, or run the node scripts from a host with RDS network access.

Current restart state:

- DEV cleanup is current through migration `20260427_0019_retire_zzz_legacy_documents_table.sql`.
- DEV code now also includes the manual supporting-document upload resolver cleanup above; no additional schema migration was needed for that bug because the existing CHECK constraint is the intended guard.
- DEV code now also includes the public-portal transient intake-state `clientId` normalization fix above; no schema migration was needed because `input_json_state.client_id` should remain nullable until a real client is linked.
- DEV code now also includes the public-portal pre-submission upload materialization fix above; no schema migration was needed because the `application_submission` document CHECK constraint is still the intended guard.
- DEV code now also includes the public-portal signing-request embedded upload materialization fix above; no schema migration was needed because these applicant-provided form attachments already satisfy the scoped `application_submission` document model once the request is linked to a case/application.
- DEV code now also includes the lower-risk assignment response/event naming cleanup, physical assignment shadow retirement, physical internal-notification shadow retirement, physical event-receipt shadow retirement, physical case/application pointer retirement, application ownership NOT NULL hardening, application-version author-shadow retirement, event-entry typed-actor scope hardening, application/CFA relationship FK hardening, remaining relationship FK hardening, legacy document experiment retirement, remaining ID-like column classification, privacy ERM smoke checker, route-scope smoke checker, live route-denial smoke harness, finance allocation evidence raw-key hardening, workflow/component authoring guard tightening, legacy unsafe debug route gating, case-watch scope filtering, application detail/version/lock scope guards, escalation list/action scope filtering, case detail/mutation/assignment/ILMP scope guards, Query Editor active-database export scope, generated consent/declaration PDF application visibility checks, staff/shared-user email-fallback removal, public AI support prompt/history filtering, admin feedback attachment review, admin AI external-data/dummy-generator hardening, notification configuration server-side gating, and generic shared-user API retirement above.
- `npm run db:migrate:plan -- --target-env dev` showed 0 pending after `0019`.
- The latest DEV audit is `docs/data/privacy-erm-audits/dev-20260426.md`; it now includes the `Legacy compatibility shadow retirement inventory` section.
- Verified today: admin server syntax, shared event emitter/index syntax, shared notification dispatcher/watchlist syntax, notification helper syntax, portal server syntax, audit script syntax, smoke script syntax, route-scope smoke script syntax, route-denial smoke script syntax and no-token skip behavior, live route-denial smoke with real DEV tokens and seeded fixtures before fixture cleanup, seed/debug helper syntax, CoordinatorAssessmentWidget JSX parse, regenerated audit, regenerated DEV schema dump, event feed smoke, direct SQL checks for the latest typed receipt FKs/CHECK, rolled-back manual-upload insert smokes for application/action-plan scoped documents, rolled-back `input_json_state.client_id = NULL` insert smoke, rolled-back fully scoped `application_submission` document insert smoke, direct SQL checks for the tightened system-generated document CHECK/backfill, direct schema checks for the retired secure-message, assignment, internal-notification, event-receipt, case/application pointer, application-version author, and legacy document experiment shadows/tables, direct schema/data checks for application ownership NOT NULL hardening, event-entry typed actor hardening, application/CFA relationship FK hardening, remaining relationship FK hardening, typed message-item cleanup preview/apply SQL, privacy-denial fixture cleanup verification, `scripts/privacy-erm-smoke.js`, `npm run smoke:privacy-routes`, route-scope smoke coverage for authoring/case-watch/application-lock/escalation/case-mutation/query-export/generated-PDF/public-AI-support/admin-feedback-attachment/admin-AI/notification-config/legacy-user endpoints, static sub-only identity checks for shared-user-to-staff-profile helpers, and `db:migrate:plan` still showing 0 pending after `0019`.
- Persistent docs updated: this progress file, grand release plan, legacy-field retirement inventory, TEST/PROD rehearsal runbook, changelog, thread index, AGENTS guidance, secure messaging/documents/signing/escalation/locking/workflow docs.
- Next recommended lane: make a final DEV-refactor-complete checkpoint before TEST rehearsal.
- Do not move to TEST/PROD yet. TEST rehearsal still needs preflight audits and quarantine planning for PROD-like data before applying migrations `0001`-`0009` and `20260427_0001`-`20260427_0019` outside DEV.

Immediate next DEV work:

- Keep client/case/application docs aligned with the current DEV state: `iset_case.application_id` is gone, and submitted applications now require both `iset_application.client_id` and `iset_application.case_id`.
- Keep assignment response/event payload code on explicit staff-profile names. Use `assigned_to_user_id` / `assigned_user_id` only as compatibility aliases derived from `assigned_staff_profile_id`; do not reintroduce the physical case column.
- Keep secure-message code on typed actor-only participant columns; do not reintroduce physical `messages.sender_id` / `recipient_id`.
- Use `docs/planning/privacy-erm-legacy-field-retirement-inventory.md` as the retirement checklist for retained audit-principal fields and physically retired shadows.
- Continue final document/thread model tightening once TEST/PROD rehearsals prove no legacy rows need quarantine.
- Keep manual supporting-document upload checks strict: application/action-plan/client scoped uploads must write a real `case_id`; do not relax `chk_iset_document_manual_upload_scope` during rehearsal.
- Keep raw application/case mutation checks strict: application locks, application versions, escalations, case detail/save/assignment/conflict/ILMP actions must validate owning case scope before doing work. Do not rely on pessimistic locks, role filters, or watched-case rows as substitutes for case visibility.
- Keep generated-file and export checks strict: generated consent/declaration PDFs must validate application visibility before rendering, and Query Editor server export must stay limited to the active environment database.
- Keep external-AI checks strict: admin/public OpenRouter calls must not receive raw applicant/client identifiers or live case context. Denial-letter drafts stay local-template only. The application approval-letter call is limited to generic opening/closing templates and non-personal mode flags, with record facts merged locally; the former unreachable full-record payload was removed on 2026-07-30. AI dummy-data routes stay behind the unsafe debug gate.
- Keep notification configuration checks strict: notification templates, matrix rows, sender names, and reply-to settings can redirect applicant/staff communications, so server routes must stay System/NWAC Administrator-only.
- Keep generic shared-user APIs retired. The shared `user` table is not a safe directory surface because it mixes public-portal applicants and old local identities.
- Continue staff/profile shared-user overlap cleanup; shared-user-to-staff-profile email fallback is now removed from the checked portal/admin helper paths, but the underlying split identity model and any TEST/PROD rows missing Cognito subjects still need rehearsal/preflight handling.
- Keep the remaining ID-like fields classified unless their model changes. Workflow IDs are string runtime keys today, not numeric `workflow.id` values; do not coerce them into a bad FK. Opaque operational/version/external IDs (`application_lock.owner_user_id`, session-audit IDs, retained event `actor_id`, event correlation/tracking IDs, budget agreement IDs, provider message IDs, upload IDs, tutorial IDs) should be documented or renamed rather than forced into row FKs.

TEST/PROD deployment considerations already visible:

- TEST outbound SES has been neutralized before any PROD-data rehearsal. TEST SES in `ca-central-1` is still sandboxed (`ProductionAccessEnabled=false`), but sandbox is not sufficient because TEST has several verified identities. Inline IAM policy `DenySesSendDuringProdDataRehearsal` now denies `ses:Send*` for both the deployed app credential user `SES_backend` and the app instance role `nwac-test-app-role`; IAM simulation confirmed `explicitDeny` for direct, raw, templated, and bulk SES send actions. DEV local `.env` now uses separate IAM user `SES_backend_dev` so DEV sandbox email delivery can work without removing the TEST deny. Keep the TEST guard until email delivery testing is intentionally re-enabled.
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
- The internal-notification/upload migration (`20260427_0001`) assumes user-targeted bell alerts and dismissals can be classified as either staff-profile or applicant-user subjects. Run the internal-notification audit section first; quarantine any rows whose legacy `audience_user_id` / `user_id` matches neither domain instead of guessing.
- The legacy case-assignment shadow migration (`20260427_0002`) will fail if TEST/PROD `iset_case.assigned_to_user_id` has values that cannot be normalized to `assigned_staff_profile_id` / `staff_profiles(id)`. Run the case-assignment audit section first and quarantine invalid legacy assignment values rather than reinterpreting them as shared users.
- The Jordan experiment retirement migration (`20260427_0003`) will fail closed if TEST/PROD `jordan_application` or `jordan_application_draft` contains rows. Run the legacy-table audit first; if either table is non-empty, quarantine/archive those rows through a separate reviewed script before dropping the tables.
- The appointment/queue routine retirement migration (`20260427_0004`) assumes those stored procedures are unused and their backing tables are already absent. Run the routine inventory and source search before applying outside DEV.
- The event-entry actor migration (`20260427_0005`) is additive and exposes any legacy staff/applicant event actors that cannot be deterministically typed. Run the event-entry typed actor audit first and quarantine/document unresolved legacy events rather than treating raw `actor_id` as authorization data.
- The application-version author migration (`20260427_0006`) is additive. Run the application-version typed-author audit first and do not backfill numeric legacy `created_by_id` values to shared `user(id)` unless TEST/PROD evidence proves they are not staff-profile IDs.
- The event-receipt viewer migration (`20260427_0007`) is additive. Run the event-receipt typed-viewer audit first; ambiguous numeric legacy `recipient_id` rows should stay unresolved or be quarantined rather than guessed across staff/user ID domains.
- The system-generated document migration (`20260427_0008`) tightens an existing CHECK. Run the document source-specific audit first; backfill deterministic application-linked applicant scope and move non-case/global generated exports out of `iset_document` instead of weakening the constraint.
- The secure-message participant retirement migration (`20260427_0009`) drops `messages.sender_id` / `recipient_id`. Run the secure-message participant drift audit first, verify TEST/PROD runtime code no longer selects or writes those columns, and keep a rollback plan that can restore the columns from the retirement audit/snapshot if rehearsal fails.
- The case-assignment retirement migration (`20260427_0010`) drops `iset_case.assigned_to_user_id`. Run the assignment drift audit first, verify TEST/PROD runtime code no longer selects or writes the physical column, and preserve legacy response aliases from `assigned_staff_profile_id` rather than widening the schema again.
- The internal-notification retirement migration (`20260427_0011`) drops `iset_internal_notification.audience_user_id` and `iset_internal_notification_dismissal.user_id`. Run the notification audience/viewer drift audit first, verify TEST/PROD runtime code no longer selects or writes those physical columns, and preserve direct-user notification behavior through typed staff-profile/applicant-user keys.
- The event-receipt retirement migration (`20260427_0012`) drops `iset_event_receipt.recipient_id` and replaces the old composite primary key with typed viewer unique keys. Run the event-receipt typed-viewer audit first; any unresolved legacy recipients or duplicate typed viewer groups must be quarantined before applying outside DEV.
- The case/application pointer retirement migration (`20260427_0013`) drops `iset_case.application_id`. Run the case/application audit first; duplicate pointer groups, pointers to missing applications, applications left without `case_id`, or post-backfill case/client mismatches must be quarantined before applying outside DEV.
- The application-scope hardening migration (`20260427_0014`) makes `iset_application.client_id` and `iset_application.case_id` required. Run the case/application audit first; missing application clients, missing application cases, cases without clients, or application/case client mismatches must be quarantined or repaired deterministically before applying outside DEV.
- The application-version author-shadow retirement migration (`20260427_0015`) drops `iset_application_version.created_by_id`. Run the application-version typed-author audit first; any non-empty legacy author value without a typed staff-profile/local-user author must be resolved or quarantined before applying outside DEV.
- The event-entry typed-actor hardening migration (`20260427_0016`) adds `chk_iset_event_entry_typed_actor_scope`. Run the event-entry typed actor audit first; unresolved staff/applicant actors or dual typed actors must be resolved or quarantined before applying outside DEV.
- The application/CFA relationship FK migration (`20260427_0017`) adds FKs for application submission/version lineage and CFA case/version/document/participant links. Run the application/CFA lineage audit first; missing targets or CFA document case/client mismatches must be repaired or quarantined before applying outside DEV.
- The remaining relationship FK migration (`20260427_0018`) adds FKs for client-account events, input-state clients, case-assessment budget pots, case-reminder action plans, and staff profile regions. Run the client-account-event orphan preview before applying outside DEV; orphan rows must be quarantined/archived or deterministically repaired before the FK is added. Do not convert workflow string IDs such as `iset-v1` into numeric workflow FKs during this release.
- The legacy document experiment retirement migration (`20260427_0019`) drops `zzz_legacy_documents` only when empty. Run the legacy-table audit first; if TEST/PROD has rows, quarantine/archive their metadata and object keys through a reviewed script rather than dropping the table.
- The staff/profile shared-user cleanup assumes staff local-user rows can be resolved by Cognito subject. Before TEST/PROD rollout, count staff profiles without `cognito_sub`, local `user` rows with staff emails but missing or mismatched `cognito_sub`, and any live message/signing/funding-agreement rows whose staff display or routing would depend on email fallback. Repair or quarantine those rows; do not re-enable email fallback.
- The retired unscoped application ingest endpoint should be smoke-checked in TEST/PROD rollout notes if any old operator workflow still references it; no current frontend caller was found in DEV.
- PROD cleanup should not drop old columns/tables in the same release that first migrates message/document scope data.

## 2026-07-10 GPT-5.6 Security/Privacy Revalidation

- Current admin `4084e93`, portal `99c440c`, and shared `49ccb73` were reviewed read-only. No application, schema, configuration, or environment mutation occurred.
- The current route-scope static smoke has four stale pattern failures. Conflict revoke/resolve routes still call `validateCaseAccessByCaseId`; feedback detail uses the intentionally expanded `canReviewAdminFeedback` policy; notification template/settings routes use the current route-aware access-matrix helper. The dedicated notification-access test passed 3/3. The stale smoke is queued for the later test-blind-spots lane.
- The real-token denial harness reported 26 skips because tokens and fixture IDs were absent. This is a coverage limitation, not a denial pass. `node --test auth/__tests__/cognitoAuth.test.js` passed all 11 portal auth tests.
- Schema-proven PROD aggregates found `0` strong-identity mismatches across `1,400` typed applicant messages and `107` signing requests. All `3,818` S3-shaped application-file paths match their owning `user_id`, and no application-file path is shared across owners. Seventeen document/application-file owner differences were traced to the reviewed 2026-05-21 Molly duplicate-identity merge; the source account is suspended and the canonical application owns the normalized document rows, so these are not unexplained `UP-01` residue.
- One historical Contact Communications note is attributed to a shared-user row by email rather than matching the staff Cognito subject, and the current note-create route still retains that fail-open email fallback. This is now `EA-007` in the engineering audit register.
- Admin `/api/ai/chat` applies the obvious-sensitive-content filter but accepts a caller-supplied OpenRouter model without enforcing `isModelAllowed()` or the System Administrator configuration boundary. This is now `EA-008` in the engineering audit register.

### 2026-07-10 R0 Route-Scope Smoke Follow-Up

- The four stale static route-scope failures were repaired locally under authorized tranche `R0`. Conflict actions, feedback review, template routes, notification settings, and sender settings now use one Express registration per assertion with the current route-matrix policy.
- `npm run smoke:privacy-routes` now passes all 71 checks, and the new backend self-test removes each formerly stale guard in memory to prove the checker fails rather than accepting adjacent-route markers.
- This changes only the local static verification tool. The real-token denial harness still needs approved TEST tokens/fixtures and was not run or reclassified by `R0`.
