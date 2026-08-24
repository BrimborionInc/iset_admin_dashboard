# Privacy ERM Cleanup and Grand Release Plan

Purpose: persistent plan for the DEV-first cleanup of the PATH entity model, privacy-sensitive relationships, public portal messaging paths, and admin-console backend assumptions before a carefully rehearsed PROD cleanup release.

Status: active execution baseline as of 2026-04-27. Progress log: `docs/planning/privacy-erm-cleanup-progress.md`.

## Decision

Yes: the right approach is to fix this properly in DEV first, then promote it as a deliberate cleanup release with a rehearsed production data migration. The system is now live in PROD, so this work must be treated as privacy hardening plus production migration planning, not as a casual schema tidy-up.

Codex owns the technical design and execution plan. Bill owns business intent and workflow expectations. Codex should inspect code and data directly, make defensible model decisions from evidence, and avoid asking Bill implementation-level questions that can be answered from the repo or database.

## Operating Rules

- Do all design, schema, code, and repair-script work in DEV first.
- Do not make PROD structural or data-model changes outside the planned cleanup release.
- Do not preserve unsafe legacy behavior just because old rows or old routes exist.
- Do not add new fallback identity matching without proving it cannot cross applicants, staff, cases, or Cognito pools.
- Rehearse PROD migration against TEST or a restored/sanitized prod-like dataset before the PROD release.
- Take a PROD snapshot or equivalent restore point immediately before migration.
- Make migration scripts guarded, idempotent where practical, and auditable with before/after counts.
- Favor explicit foreign keys, typed actor columns, and scoped access checks over app-only conventions.

## Problem Statement

The current risk is not one isolated secure-message bug. The deeper issue is that several older experiments and transitional designs still let privacy-sensitive features rely on overloaded identifiers, weak relationships, or compatibility fallbacks.

The most serious pattern is numeric ID domain confusion: `staff_profiles.id`, shared `user.id`, applicant accounts, clients, applications, and cases are sometimes treated as interchangeable or recoverable by fallback. That is how a message can be valid from the database's point of view but privacy-wrong from the application's point of view.

The second serious pattern is object access by raw ID. A route that fetches a message, document, note, event, or generated file by its own ID must still prove the caller is allowed to see the owning case, application, client, action plan, or intervention.

## Scope

This plan covers:

- MySQL schema in the shared `iset_intake` database.
- Admin backend in `isetadminserver.js`.
- Current deployed public portal backend in `../ISET-intake/server.js`.
- Current deployed public portal frontend in `../ISET-intake`.
- Admin-console secure messaging, case documents, case/application/client scope checks, application versioning, and dead or experimental endpoints.
- Canonical migrations under `sql/migrations/`.
- One-off and audit scripts under `sql/ops/` or clearly named repo scripts.

Out of scope unless explicitly reopened:

- The parked public portal rebuild under `../iset-public-portal`.
- Visual redesign unrelated to privacy/model cleanup.
- PROD data mutation before the planned cleanup release.

## Non-Negotiable Invariants

- `staff_profiles.id` and `user.id` are different domains and must not be interchangeable.
- A column named `*_user_id` must point to the shared `user` table, or be renamed.
- A column that stores `staff_profiles.id` must say so in its name and, where feasible, have an FK to `staff_profiles(id)`.
- Applicant data visibility is derived from applicant account -> client -> case/application scope, not from caller-supplied IDs.
- Staff data visibility is derived from authenticated staff profile, role, region, assignment, or explicit case access.
- Secure messaging is case/application scoped. It is not a free mailbox between arbitrary local users.
- Documents and message attachments must carry enough case/application/client context at write time that later access does not depend on guessing.
- Legacy fallbacks should be removed or hard-disabled when they increase privacy risk.

## Current Evidence

Findings from DEV code and schema review:

- `messages.sender_id` and `messages.recipient_id` historically pointed at local `user.id` values by convention only. DEV now has typed actor-domain columns plus case/application FKs, and migration `20260427_0009` physically retires the old participant shadows after aggregate 0-drift recording.
- `message_item` historically had no FK to `messages` or `user`; DEV contained rows pointing at missing messages and rows for nonparticipant owners. DEV cleanup preserved and deleted unsafe rows, and the table now has FKs for message and owner user.
- Admin case-message reads previously seeded `message_item` rows for the staff user opening a case, meaning mailbox state could be created by viewing rather than by true participation. DEV code no longer creates or trusts nonparticipant mailbox rows.
- Public portal message compose now targets current assigned staff and replies target the original same-case thread counterpart. DEV code also writes typed actor-domain fields, but the access model still needs to finish moving away from recipient authority toward case-thread authority.
- `iset_case.assigned_to_user_id` stored `staff_profiles.id`, despite the column name saying `user_id`. DEV now uses `assigned_staff_profile_id` with an FK to `staff_profiles(id)`, and migration `20260427_0010` physically retires the misleading old shadow after aggregate 0-drift recording.
- DEV cases confirmed 2 legacy assignment values and 0 drift before the old assignment column was dropped.
- Staff identity remains split across `staff_profiles` and shared `user`, with partial Cognito/email mappings and at least one local user row colliding with both staff and client identity concepts. DEV code now removes the checked shared-user-to-staff-profile email fallback paths; TEST/PROD preflight still needs to find any staff local-user rows missing Cognito-sub resolution before rollout.
- `message_attachment.application_id` historically had a different integer type than `iset_application.id`, and public portal attachment insert previously did not populate `case_id`. DEV now has corrected typing, `client_id`, scope FKs, portal scope writes, and admin adoption validation, but TEST/PROD still need rehearsal before relying on those constraints outside DEV.
- `iset_document` allowed missing `client_id`; DEV contained documents missing `client_id` and `case_id`. DEV cleanup backfilled deterministic document scope gaps and cleared invalid document `user_id` values.
- `iset_document` now has DEV FKs for user/applicant user, client, case, application, action plan, linked task, and origin message plus source-specific privacy CHECK constraints. Admin manual-upload code now preserves or resolves real `case_id` for application/action-plan/client scopes instead of weakening the constraint. Generated application-linked documents now also require applicant scope, and global finance exports are kept out of the supporting-document table.
- Finance allocation evidence previously had upload/delete/presign routes that accepted raw object keys. DEV now requires System Administrator or NWAC Administrator, tracks new uploads as owned pending finance evidence, and allows presign/delete only for keys referenced by allocation/pot evidence metadata or owned pending uploads.
- Workflow/component authoring endpoints had broad staff reach and older raw blockstep/Nunjucks routes exposed repo-file/debug behavior. DEV now limits workflow/component authoring to step-editor roles and gates legacy raw debug routes behind unsafe-admin-debug plus System Administrator access.
- Case watches, application locks, application version routes, escalation routes, case detail/save, case assignment, conflict actions, and ILMP/ready-to-close actions previously had surfaces where raw case/application IDs, watch rows, role filters, or lock ownership could be mistaken for object access authority. DEV now validates case/application scope before returning or mutating those objects.
- Query Editor server export previously exposed every schema visible to the DB login. DEV now limits export metadata/selection to the active environment PATH database and rejects non-active database requests.
- Generated consent/declaration PDF routes previously accepted a raw `applicationId` body value before rendering. DEV now validates application visibility before generating those PDFs.
- `iset_application` and `iset_case` historically had bidirectional links, even though the target model is one client -> one case -> many applications. DEV now uses only `iset_application.case_id` for that relationship.
- DEV now has FKs on the core case/application/client links and has retired the unscoped `POST /api/applications/ingest-from-submission` endpoint that could create applications without client/case scope.
- Application versioning has two incompatible implementations: newer application-based routes match the live table, while older case-based routes reference nonexistent columns.
- `/api/govuk-components` routes reference a missing `govuk_component` table.
- `jordan_application` and `jordan_application_draft` were empty in DEV and are now retired there through a fail-closed migration that refuses to drop non-empty TEST/PROD tables.
- Old appointment/queue stored procedures that referenced missing tables are now retired in DEV with routine-name audit rows.
- Event log actor IDs historically mixed applicant numeric user IDs, staff Cognito subjects, and a few legacy numeric staff-labeled actor IDs. DEV now has typed event actor references for applicant users and staff profiles, `chk_iset_event_entry_typed_actor_scope` enforces typed refs for staff/applicant events, and raw `actor_id` is retained as audit text only.
- Application version authorship historically used free-form `created_by_id`; DEV now writes/reads typed staff-profile/local-user author references and physically retires the legacy column by `20260427_0015`.
- Internal staff bell notifications historically carried ambiguous `audience_user_id` and dismissal `user_id` shadows. DEV now uses typed staff-profile/applicant-user audience and viewer fields, and migration `20260427_0011` physically retires those old notification shadows after aggregate 0-drift recording.
- Event read receipts historically used only a free-form `recipient_id`. DEV now uses typed read-receipt viewer references for staff profiles/applicant users, and migration `20260427_0012` physically retires `recipient_id` after replacing the legacy composite key with typed viewer unique keys.
- `staff_message*` appears to be a separate internal staff-to-staff messaging feature and should not be confused with applicant secure messaging.
- CFA tables historically had weak or missing FKs and mixed ID typing. DEV now constrains CFA case/version/document/participant relationships through `20260427_0017`, after verifying 0 orphan CFA rows and 0 CFA document case/client mismatches.
- `client_applicant_account_event.client_id`, transient input-state client links, case-assessment budget-pot links, reminder action-plan links, and staff-profile region links had relationship-looking IDs without FKs. DEV cleaned 40 orphan client-account events into an audit table and migration `20260427_0018` now constrains those relationships.
- Workflow `workflow_id` fields in submissions/drafts/input state currently store runtime string keys such as `iset-v1`, not numeric `workflow.id` values. Treat them as classified string keys until the workflow model gets an explicit stable key column; do not force a numeric FK.
- `zzz_legacy_documents` was a confirmed-empty legacy document upload experiment table in DEV. Migration `20260427_0019` retires it with a fail-closed non-empty guard, and the audit now classifies remaining ID-like fields instead of treating external/runtime IDs as FK debt.

## Target Model

### Identity

- `staff_profiles` is the authoritative staff profile table for admin roles, assignment, region, and staff display identity.
- Shared `user` rows are portal/applicant/local-account rows unless a specific bridge says otherwise.
- If staff need local `user` rows for legacy messaging compatibility, create or document an explicit mapping rather than relying on email fallback or numeric coincidence.
- Use clearly typed relationship names such as `assigned_staff_profile_id`; do not reintroduce misleading `*_user_id` names for staff-profile relationships.
- Use typed actor fields for audit and messaging, for example:
  - `actor_type`
  - `actor_user_id`
  - `actor_staff_profile_id`

### Client, Case, and Application

- Preserve the agreed target model: one client -> one case -> many applications.
- Every submitted application must have `client_id` and `case_id`; DEV now enforces both as `NOT NULL`.
- `iset_case.application_id` is physically retired in DEV by `20260427_0013`; TEST/PROD must rehearse the same backfill/audit/drop path against live data before release.
- Application ownership hardening is applied in DEV by `20260427_0014`; TEST/PROD must run preflight audits for missing clients, missing cases, missing case clients, and application/case client mismatches before applying it.

### Secure Messaging

Secure messaging should become case-thread based.

Preferred destination model:

- `case_message_thread`
  - case/application/client scoped.
  - one canonical thread per case/application flow unless product behavior requires more.
- `case_message`
  - belongs to a thread.
  - sender is explicitly typed as applicant user or staff profile.
  - contains no arbitrary cross-user `recipient_id` authority.
- `case_message_participant` or derived participant rules
  - applicant participant derived from client/application account.
  - staff participant derived from case access, assignment, role, or explicit staff thread membership.
- `case_message_state`
  - read/delete/archive state per true participant only, if per-user state is still required.

Minimum acceptable interim model if replacing tables is too large for one pass:

- Add explicit actor-domain columns to `messages`.
- Stop relying on `recipient_id` as access authority.
- Treat `message_item` only as per-viewer state, never as proof that the viewer is allowed to see the message.
- Add FKs and cleanup scripts after current invalid rows are understood.

### Documents and Attachments

- `iset_document.client_id` should be required for client/application/case documents once data is backfilled.
- Case-scoped documents should carry `case_id`.
- Application-scoped documents should carry `application_id` and, either directly or by FK, resolve to the owning case/client.
- Message attachments should carry message, case, application, and client context at insertion time.
- Attachment adoption into `iset_document` should validate that the message and destination case/application/client match.

### Dead and Experimental Surfaces

- Remove or hard-disable routes that reference missing or obsolete tables.
- Drop empty legacy tables only after confirming PROD state and writing a migration plan.
- Keep current `contact_message*` and `staff_message*` unless separate review finds a real privacy/model issue.

## Work Phases

### Phase 0 - Persistent Plan

Create this plan and link it from the repo entry points so future threads recover the same strategy.

Deliverables:

- `docs/planning/privacy-erm-cleanup-grand-release-plan.md`
- `docs/AGENTS.md` pointer and guardrail.
- `docs/meta/codex-thread-index.md` entry.

### Phase 1 - DEV Privacy Inventory

Build read-only inventory scripts against DEV.

Inventory should report:

- Every `*_user_id`, `staff*_id`, `applicant*_id`, `client_id`, `case_id`, `application_id`, `document_id`, and `message_id` relationship that lacks an FK.
- Rows where a `user_id` column appears to contain a `staff_profiles.id`.
- Rows where a staff-profile column appears to contain a shared `user.id`.
- Message rows where sender/recipient is not the case applicant or a valid staff participant.
- `message_item` rows for missing messages or unauthorized viewers.
- Documents missing client/case/application scope.
- Attachments missing case/application/client context.
- Dead stored procedures, empty experiment tables, and routes that reference missing tables.

Deliverables:

- Read-only SQL or script under `sql/ops/` or `scripts/`.
- DEV audit output captured in a durable note.
- Prioritized repair list with counts, not guesses.

Current status as of 2026-04-27:

- Repeatable audit script created at `scripts/privacy-erm-audit.js`.
- First DEV report generated at `docs/data/privacy-erm-audits/dev-20260426.md`.
- The audit now reports explicit case-assignment staff-profile counts and drift after the `assigned_staff_profile_id` migration.
- Running progress is tracked in `docs/planning/privacy-erm-cleanup-progress.md`.

### Phase 2 - DEV Containment Hardening

Fix high-risk behavior before larger table redesign.

Expected changes:

- Stop creating `message_item` rows for staff viewers unless the row is true per-viewer state after a case-access check.
- Ensure every message read, send, reply, attachment presign, and attachment adoption path validates case/application/client scope.
- Remove or hard-disable broken legacy admin endpoints such as `govuk_component` routes.
- Remove or return explicit `410` for stale portal routes that imply obsolete application flows.
- Add focused denial tests for wrong-applicant, wrong-case, wrong-staff, and nonparticipant message/document access.

Current status as of 2026-04-27:

- Admin case-message reads no longer create or trust nonparticipant `message_item` rows.
- Admin mailbox-state mutations now require the caller to be sender or recipient.
- DEV `message_item` cleanup removed 38 unsafe rows after preserving them in `privacy_erm_message_item_cleanup_audit`.
- Public portal attachment insert now records `message_attachment.case_id`.
- Obsolete `govuk_component`, case-based application-version, and direct application-answer patch routes now return `410 retired_endpoint` instead of executing broken legacy SQL.
- DEV document-scope cleanup backfilled deterministic `client_id`, `case_id`, and `application_id` gaps and cleared invalid document `user_id` values after preserving old/new values in `privacy_erm_document_scope_cleanup_audit`.

### Phase 3 - DEV Target Schema Migration

Add the new structure without destructive cleanup first.

Expected changes:

- Add clear staff-profile assignment columns.
- Backfill from current case/application/client data.
- Add nullable FKs where data repair is still in progress.
- Add typed actor fields for messages/audit paths.
- Add attachment/document scope columns needed by the target model.
- Add compatibility views or temporary dual-read only where required for a safe transition.

Current status as of 2026-04-27:

- Added `iset_case.assigned_staff_profile_id` through `sql/migrations/20260426_0001_add_case_assigned_staff_profile_id.sql`.
- Backfilled it from valid legacy `assigned_to_user_id` values and normalized invalid legacy values to `NULL` by copying back from the explicit column.
- Added `fk_iset_case_assigned_staff_profile` to `staff_profiles(id)`.
- Updated admin and public portal assignment write paths to use the explicit column during the transition.
- Updated high-risk admin/shared read paths, case-access checks, RBAC predicates, staff joins, and reporting filters to prefer explicit `assigned_staff_profile_id` semantics.
- DEV post-migration audit showed 0 assignment-column drift and 0 legacy-only assigned cases before physical retirement.
- Added typed actor-domain columns to `messages` through `sql/migrations/20260426_0002_add_message_actor_domain_columns.sql`, with FKs to `user(id)` and `staff_profiles(id)`.
- Backfilled existing DEV messages to explicit `staff_profile -> applicant_user` actor domains with 0 missing typed actor fields and 0 `local_user` fallbacks.
- Added `message_attachment.client_id`, corrected `message_attachment.application_id` typing, and added attachment FKs through `sql/migrations/20260426_0003_harden_message_attachment_scope.sql`.
- Updated public portal attachment writes and admin attachment adoption validation to carry and check message/case/application/client scope.
- Added FKs for remaining legacy secure-message columns and mailbox state through `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`.
- Added document-scope FKs and normalized document user/message ID column types through `sql/migrations/20260426_0005_harden_document_scope_references.sql`.
- Added staff-profile actor/reference FKs for remaining admin feedback, CFA, applicant-account, and tutorial-progress columns through `sql/migrations/20260426_0006_harden_staff_profile_actor_references.sql`.
- Added typed event-entry actor references through `sql/migrations/20260427_0005_add_event_entry_typed_actor_references.sql`.
- Added typed application-version author references through `sql/migrations/20260427_0006_add_application_version_typed_author_references.sql`.
- Added typed event-receipt viewer references through `sql/migrations/20260427_0007_add_event_receipt_typed_viewer_references.sql`, with ambiguous numeric legacy recipients left unresolved rather than guessed and a CHECK preventing dual staff/applicant viewer refs.
- Physically retired `iset_application_version.created_by_id` through `sql/migrations/20260427_0015_retire_application_version_legacy_author_shadow.sql`.
- Hardened event-entry typed actor scope through `sql/migrations/20260427_0016_harden_event_entry_typed_actor_scope.sql`, while keeping raw `actor_id` as audit-retained principal text.
- Hardened application submission/version lineage and CFA case/version/document/participant relationships through `sql/migrations/20260427_0017_harden_application_and_cfa_relationship_fks.sql`.
- Hardened remaining deterministic relationship FKs through `sql/migrations/20260427_0018_harden_remaining_relationship_fks.sql` after preserving and deleting 40 orphan DEV client-account event rows.
- Retired the confirmed-empty `zzz_legacy_documents` table through `sql/migrations/20260427_0019_retire_zzz_legacy_documents_table.sql` and classified remaining non-FK ID-like fields as runtime keys, external references, audit principals, or lookup keys.

### Phase 4 - DEV Code Cutover

Move admin and public portal code to the target model.

Expected changes:

- Public portal message create/reply uses case-thread identity, not arbitrary staff recipient selection.
- Admin case messaging uses case-thread access and staff-profile identity explicitly.
- Document upload/download/adoption routes resolve through scoped case/application/client relationships.
- Case assignment uses `staff_profiles.id` intentionally and consistently.
- Application versioning routes use one live implementation; obsolete case-version routes are removed or repaired.

Current status as of 2026-04-27:

- Public portal message list/detail/read/delete/replied/reply-target paths now require typed `applicant_user` participation and resolved case/application scope.
- Public portal reply routing now derives the recipient from the typed counterpart actor rather than trusting request-provided or legacy recipient authority.
- Admin secure-message mailbox state now seeds, joins, and mutates through typed `sender_user_id` / `recipient_user_id` fields.
- Admin and public portal secure-message responses now expose canonical `sender`, `recipient`, and `thread` objects, and the main admin widgets classify inbox/sent/display/read-state behavior from typed actor data rather than raw legacy participant IDs.
- The public portal reply composer no longer supplies legacy `recipient_id` for replies; reply authority is derived server-side from the typed counterpart and case/application scope.
- DEV migration `20260427_0009` physically retires `messages.sender_id` / `recipient_id` after aggregate 0-drift recording; TEST/PROD must rehearse the same step after typed actor backfill and preflight.
- DEV migration `20260427_0010` physically retires `iset_case.assigned_to_user_id` after assignment code cutover and aggregate 0-drift recording; TEST/PROD must rehearse the same step after assignment preflight.
- DEV migration `20260427_0011` physically retires `iset_internal_notification.audience_user_id` and dismissal `user_id` after typed notification code cutover and aggregate 0-drift recording; TEST/PROD must rehearse the same step after notification preflight.
- DEV migration `20260427_0012` physically retires `iset_event_receipt.recipient_id` after typed viewer read-state cutover and aggregate 0-drift recording; TEST/PROD must rehearse the same step after event-receipt preflight.
- Unscoped admin application ingest route `POST /api/applications/ingest-from-submission` now returns `410`; scoped case/application creation must flow through `POST /api/cases` or the current intake/manual-intake flows.
- High-risk assignment response paths now emit explicit `assigned_staff_profile_id` / `assignedStaffProfileId` aliases and the main application/work-queue/case overview UI compares assignment through staff-profile IDs first.
- Shared event writes/reads now populate and prefer typed actor references where present, application version writes carry typed author IDs, and event read-state joins/marks carry typed viewer references.
- The audit now includes a legacy compatibility-shadow retirement inventory, and `docs/planning/privacy-erm-legacy-field-retirement-inventory.md` tracks physically retired shadows plus retained audit-principal fields.
- Admin workflow/component authoring, case watches, application details/versions/locks, escalations, case detail/save/assignment/conflict actions, and ILMP/ready-to-close actions now validate the same case/application visibility model instead of relying on raw IDs, watch rows, or locks as access authority.
- Query Editor server export now lists and accepts only the active environment PATH database, and generated consent/declaration PDFs validate application visibility before rendering.

### Phase 5 - DEV Constraint Tightening

After repair scripts pass:

- Add NOT NULL constraints where business rules require them.
- Add FKs on case/application/client/message/document relationships.
- Add CHECK constraints for actor type/domain combinations where MySQL supports them.
- Add unique constraints for one-to-one mappings that must be stable.
- Drop or archive obsolete columns only after all code paths stop reading them.

Current DEV status:

- `20260426_0007_harden_secure_message_scope_constraints.sql` now hardens secure-message scope in DEV.
- Secure messages require `case_id` and typed sender/recipient actor domains.
- Secure messages must have exactly one applicant actor.
- Message attachments require message/case/client/uploader scope, with parent-message cleanup cascading and scope parents protected by `RESTRICT`.
- Privacy-sensitive document scope parents now use `RESTRICT` instead of `SET NULL`.
- Source-specific document CHECK constraints now prevent application-submission and secure-message documents without required lineage, while preserving application-less manual upload support through a client/case-scope rule.
- TEST/PROD rehearsal must preflight for legacy rows that violate those checks; the migration intentionally fails closed rather than guessing.
- `20260426_0008_harden_signing_request_scope_references.sql` now protects participant signing requests with FKs to workflow, case, participant user, and creator user.
- `20260426_0009_harden_escalation_and_task_user_references.sql` now protects application escalation routing and case-task audit users with explicit application/case/user FKs.
- `20260427_0018_harden_remaining_relationship_fks.sql` now protects client account events, input-state client links, case-assessment intervention budget pots, case reminders' action-plan links, and staff-profile region links. Remaining workflow IDs are classified as runtime string keys, not numeric workflow FKs.
- `20260427_0019_retire_zzz_legacy_documents_table.sql` now retires the empty legacy document experiment table in DEV. TEST/PROD must quarantine/archive any non-empty rows before applying it.
- `scripts/privacy-erm-smoke.js` now provides a read-only smoke check for the cleaned model, including retired tables/columns, required privacy constraints, message/document/application/client-account invariants, and informational workflow string-key reporting.
- `scripts/privacy-route-scope-smoke.js` now provides a static route guard tripwire for high-risk document, message, signing, event, and finance evidence object-key endpoints. It is a regression guard only; live denial tests are still required before TEST/PROD promotion.
- The route-scope smoke now also covers workflow/component authoring guards, legacy unsafe debug route gates, case watches, application details/versions/locks, escalation actions/listing, and case detail/save/assignment/conflict/ILMP mutation guards.
- The route-scope smoke now also covers Query Editor active-database export scope and generated consent/declaration PDF application-visibility guards.

### Phase 6 - TEST Rehearsal

Rehearse the release on TEST or a prod-like restored dataset.

Current rehearsal runbook:

- `docs/ops/environments/privacy-erm-grand-cleanup-rehearsal.md`

Rehearsal must include:

- Snapshot or restore-point creation.
- Pre-migration audit output.
- Schema migration.
- Data backfill/repair.
- Post-migration audit output.
- Admin smoke test.
- Public portal smoke test.
- Secure-message privacy test with intentional ID-collision cases.
- Document access denial tests.
- Rollback or restore test plan.

### Phase 7 - PROD Grand Cleanup Release

PROD release should be deliberate and operator-led.

Release runbook must include:

- Exact release contents.
- Expected downtime or rolling-deploy behavior.
- User warning or maintenance plan if required.
- PROD snapshot or restore point.
- Pre-migration counts.
- Migration command sequence.
- Post-migration counts and privacy assertions.
- Admin and public portal smoke tests.
- Feedback-log or incident-note updates if this release closes live privacy findings.

## PROD Migration Principles

- First pass should be additive and repair-oriented, not destructive.
- Never drop columns or tables in the same step that first migrates live data unless rollback has been proven.
- Preserve before/after audit rows or exported reports for sensitive transformations.
- Use deterministic joins, not email/name/SIN fallback, when backfilling relationships.
- For ambiguous live rows, quarantine and report rather than guessing.
- Make scripts fail closed on count mismatches.
- Validate both data integrity and access behavior after migration.

## Risk Register

| Risk | Severity | Fix Direction |
| --- | --- | --- |
| `staff_profiles.id` stored in columns named `user_id` | High | DEV now has explicit `iset_case.assigned_staff_profile_id` with FK, high-risk backend response aliases, frontend comparisons that resolve staff-profile IDs first, lower-risk assignment response/event payload aliases, and `20260427_0010` physically retires the misleading `assigned_to_user_id` shadow after aggregate 0-drift recording; continue TEST/PROD rehearsal before promoting the drop outside DEV |
| Shared `user.id` mapped to staff profile by email | High | DEV portal/admin helper paths now resolve shared-user-to-staff-profile identity only by Cognito subject; route-scope smoke has forbidden-pattern checks for the removed email fallback; TEST/PROD preflight must repair or quarantine staff local-user rows that cannot be resolved by subject |
| Applicant secure messages visible to wrong user through `message_item` or `recipient_id` | High | DEV now has typed actors plus FKs on messages and `message_item`; public portal applicant reads, admin mailbox-state mutations, secure-message response contracts, and main UI classification now use typed actor/case scope; `messages.sender_id` / `recipient_id` are physically retired in DEV with aggregate 0-drift evidence, so continue TEST/PROD migration rehearsal before promoting the drop outside DEV |
| Signing requests visible or signable by wrong applicant | High | DEV now has signing-request workflow/case/participant/creator FKs and an audit check for participant-not-case-applicant, missing message links, and message/case mismatches |
| Escalations or case tasks routed through wrong/missing user IDs | High | DEV now requires case-scoped escalations, constrains escalation requester/current-owner/resolver users to shared `user.id`, and constrains case-task created/updated shared-user actors |
| Staff bell alerts or dismissals routed through the wrong identity domain | High | DEV now uses typed staff-profile/applicant-user audience and viewer columns plus FKs and typed-only CHECK constraints; `20260427_0011` physically retires legacy `audience_user_id` / dismissal `user_id` after aggregate 0-drift recording, so continue TEST/PROD rehearsal before promoting the drop outside DEV |
| Documents fetched by raw document ID | High | DEV now has document relationship FKs; continue requiring case/application/client/action-plan/intervention scope before presign or metadata return |
| Finance allocation evidence fetched or deleted by raw object key | High | DEV allocation evidence upload/delete/presign now requires System Administrator or NWAC Administrator, actor-owned pending uploads, and DB metadata provenance before object-store presign/delete |
| Query/export surfaces expose unintended schemas or data | High | DEV Query Editor server export is System Administrator only and limited to the active PATH database; reporting routes require operational reporting admin access |
| Generated consent/declaration PDFs built from raw application IDs | Medium/High | DEV generated PDF routes now validate application visibility before rendering |
| Application locks or versions accessed by raw application ID | High | DEV application lock/detail/version routes now call application visibility checks that validate the owning case scope and archive visibility before returning or mutating data |
| Escalation queues expose out-of-scope case/application metadata | High | DEV escalation create/respond validates application case scope and list results are filtered through case access before returning role queue data |
| Case detail, assignment, conflict, or ILMP actions mutate by raw case ID | High | DEV case detail/save, legacy and current assignment routes, conflict revoke/resolve, ILMP validate/prepare, and ready-to-close actions now validate case access before work; assignment still requires assignment permission |
| Workflow/component authoring and raw debug routes broadly reachable | Medium/High | DEV workflow/component mutation/detail/audit routes require step-editor roles, the `/modify-component/:id` frontend route is guarded, and legacy blockstep/raw Nunjucks endpoints require unsafe-admin-debug plus System Administrator access |
| Message attachments adopted without case/application validation | High | DEV now carries message/case/application/client scope at insert, validates scope on adoption, requires attachment case/client/uploader scope, and protects attachment scope parents with FKs; rehearse against PROD data before applying constraints outside DEV |
| Public portal identity fallback by email/SIN/name | High | Bind by Cognito subject and applicant-pool client only |
| Event/audit actor IDs misread as authorization subjects | Medium/High | DEV now has typed `iset_event_entry` actor references, shared event writes/reads prefer typed refs, `20260427_0016` enforces typed staff/applicant actor scope with 0 unresolved actors, and raw `actor_id` is retained audit text only |
| Application version author-shadow migration misses historical rows | Medium | DEV now uses `created_by_staff_profile_id` / `created_by_user_id` FKs for version authors and physically retires `created_by_id` through `20260427_0015`; TEST/PROD still need preflight for historical unresolved author values before the drop |
| Event read receipts routed through opaque recipient IDs | Medium | DEV now uses typed `iset_event_receipt` viewer refs, typed viewer unique keys, and an exactly-one typed-viewer CHECK; `20260427_0012` physically retires `recipient_id` after aggregate 0-drift recording, so continue TEST/PROD rehearsal before promoting the drop outside DEV |
| Nullable/unconstrained document and message relationships | Medium/High | DEV now has message/message-item/attachment/document FKs plus source-specific message/document CHECK constraints; manual-upload and generated-document code resolve the full case/client/application/applicant context expected by those checks, secure-message responses expose typed actor/thread context, and global exports no longer masquerade as supporting documents; continue physical legacy-field retirement and TEST/PROD quarantine planning |
| CFA agreement documents linked by unconstrained IDs | Medium/High | DEV migration `20260427_0017` now constrains CFA series to cases, versions to series/superseded versions/signed participant users, and version documents to CFA versions plus `iset_document`; TEST/PROD must preflight missing CFA targets and document case/client mismatches |
| Client account event history linked to missing clients | Medium/High | DEV preserved and deleted 40 orphan client-account event rows through an audit table, then `20260427_0018` added a client FK; TEST/PROD must preview orphan rows and quarantine/archive or repair them before adding the FK |
| Workflow IDs confused with workflow row IDs | Medium | Current submission/draft/input-state `workflow_id` values are string runtime keys such as `iset-v1`; keep them classified and do not coerce to numeric `workflow.id` until an explicit workflow key model exists |
| Legacy document experiment table keeps obsolete object keys alive | Medium | DEV migration `20260427_0019` retires empty `zzz_legacy_documents` and records the retirement; TEST/PROD must fail closed and archive/quarantine any rows before dropping it |
| Bidirectional case/application links obscure one-case-many-applications model | Medium | DEV has moved reads to `iset_application.case_id`, retired `iset_case.application_id` through `20260427_0013`, and hardened application ownership through `20260427_0014`; TEST/PROD still need rehearsal |
| Split application versioning implementations | Medium | Keep application-based versioning, remove or repair obsolete case-based routes |
| Dead or scope-unsafe endpoints | Medium | Remove, gate, or return explicit gone responses; DEV now retires obsolete case-version/GOV.UK routes and unscoped submission-ingest route |
| Empty legacy experiment tables | Low/Medium | DEV retired empty `jordan_application*` through fail-closed migration `20260427_0003`; confirm TEST/PROD row counts and quarantine/archive any non-empty legacy payloads before applying outside DEV |
| Old stored procedures for removed tables | Low/Medium | DEV retired five appointment/queue procedures through `20260427_0004` after source search found no live `CALL` sites and backing tables were already absent |

## Immediate DEV Checklist

- Add this persistent plan and doc pointers.
- Create the read-only privacy inventory script.
- Run inventory against DEV and capture counts.
- Update stale client/case/application planning docs where live schema has already moved forward.
- Patch secure messaging containment issues that still create or trust unsafe `message_item` state.
- Remove or hard-disable routes that reference missing tables.
- Keep case-assignment APIs/events on explicit staff-profile response names; DEV now exposes `assigned_staff_profile_id` / `assignedStaffProfileId` on known case creation, assignment, application-list, work-queue, case-detail, and assignment-event surfaces while retaining legacy aliases derived from `assigned_staff_profile_id` for compatibility.
- Decide whether secure messaging moves by new tables or by carefully evolving existing tables.
- Keep `20260426_0007_harden_secure_message_scope_constraints.sql` as the canonical DEV proof for secure-message/document privacy constraints; do not relax it for TEST/PROD without a documented quarantine reason.
- Promote the manual-upload resolver code with the document constraint release. `chk_iset_document_manual_upload_scope` should fail closed if a caller drops `case_id`; the fix is context resolution, not constraint relaxation.
- Keep `20260427_0001_harden_internal_notification_and_upload_identity.sql` as the canonical DEV proof for typed internal-notification audience/viewer identity, pending-upload shared-user ownership, and application-lock application scope.
- Keep `20260427_0011_retire_internal_notification_legacy_identity_shadows.sql` as the canonical DEV proof for physically retiring internal-notification audience/viewer shadows after notification code cutover and aggregate 0-drift recording.
- Keep `20260427_0002_harden_legacy_case_assignment_shadow.sql` as the additive DEV proof that the misleading legacy `iset_case.assigned_to_user_id` shadow was constrained to `staff_profiles(id)` before retirement.
- Keep `20260427_0010_retire_legacy_case_assignment_shadow.sql` as the canonical DEV proof for physically retiring the case assignment shadow after assignment code cutover and aggregate 0-drift recording.
- Keep `20260427_0003_retire_jordan_application_experiment_tables.sql` as the canonical DEV proof for retiring the abandoned Jordan experiment tables; it must fail closed on non-empty TEST/PROD tables.
- Keep `20260427_0004_retire_appointment_queue_legacy_routines.sql` as the canonical DEV proof for retiring dead appointment/queue stored procedures after confirming no runtime callers.
- Keep `20260427_0005_add_event_entry_typed_actor_references.sql` as the canonical DEV proof for adding typed event-entry staff/applicant actor references.
- Keep `20260427_0016_harden_event_entry_typed_actor_scope.sql` as the canonical DEV proof for enforcing typed staff/applicant event actors while retaining raw `actor_id` as audit text.
- Keep `20260427_0006_add_application_version_typed_author_references.sql` as the canonical DEV proof for adding typed application-version author references without numeric collision guessing.
- Keep `20260427_0015_retire_application_version_legacy_author_shadow.sql` as the canonical DEV proof for physically retiring `iset_application_version.created_by_id` after typed-author code cutover.
- Keep `20260427_0017_harden_application_and_cfa_relationship_fks.sql` as the canonical DEV proof for constraining application submission/version lineage plus CFA case/version/document/participant relationships after 0-blocker audit recording.
- Keep `20260427_0018_harden_remaining_relationship_fks.sql` as the canonical DEV proof for constraining client-account events, input-state client links, case-assessment budget-pot links, reminder action-plan links, and staff-profile regions after orphan cleanup and 0-blocker audit recording.
- Keep `20260427_0019_retire_zzz_legacy_documents_table.sql` as the canonical DEV proof for retiring the empty legacy document upload experiment table; it must fail closed on non-empty TEST/PROD data.
- Use `npm run smoke:privacy-erm` after DEV migration/audit refreshes and during TEST/PROD rehearsal. It is a data-integrity smoke, not a substitute for route-level authorization denial tests.
- Use `npm run smoke:privacy-routes` after route-scope cleanup changes. It is a static guard-marker smoke for high-risk routes, not a substitute for live wrong-user/wrong-case denial tests.
- Keep application locks, application versions, escalation queues/actions, case watches, case detail/save, assignment/conflict actions, and ILMP/ready-to-close actions on explicit case/application visibility checks. Locks, watched rows, and role filters are not access authority by themselves.
- Keep workflow/component authoring on step-editor-only routes and keep legacy raw blockstep/Nunjucks endpoints behind unsafe-admin-debug plus System Administrator access.
- Keep Query Editor server export constrained to the active environment PATH database and keep generated consent/declaration PDFs on application visibility checks.
- Keep shared-user-to-staff-profile resolution on Cognito-sub only. Email can be contact/display data, but it must not be used to turn a shared `user.id` into a `staff_profiles.id`.
- Keep `20260427_0007_add_event_receipt_typed_viewer_references.sql` as the canonical DEV proof for typed event read-receipt viewer references without numeric collision guessing or dual staff/applicant viewer refs.
- Keep `20260427_0012_retire_event_receipt_legacy_recipient_shadow.sql` as the canonical DEV proof for physically retiring event receipt `recipient_id` after typed viewer read-state cutover and aggregate 0-drift recording.
- Keep `20260427_0008_harden_system_generated_document_scope.sql` as the canonical DEV proof that application-linked system-generated documents carry applicant scope and non-case global exports stay outside `iset_document`.
- Add denial tests around message and document access before broader refactor.

## Acceptance Criteria

The cleanup is not complete until:

- No route returns client, application, case, document, note, event, message, attachment, or generated-file data by raw object ID alone.
- No object-store presign/delete route accepts a raw key without database-backed provenance or owned pending-upload scope.
- No code path treats `staff_profiles.id` as a shared `user.id`.
- No code path treats shared `user.id` as a staff-profile ID, including by email fallback.
- Staff bell-alert targeting/dismissal uses typed staff-profile/applicant-user identity, not ambiguous `user_id` columns.
- Applicant secure-message visibility is derived from case/application/client scope.
- Staff secure-message visibility is derived from case access or explicit thread participation.
- DB constraints prevent the most important invalid relationships from being inserted.
- DEV and TEST audit scripts pass before PROD release.
- PROD migration has a written runbook, restore point, before/after counts, and smoke-test checklist.
