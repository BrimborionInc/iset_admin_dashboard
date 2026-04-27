# Privacy ERM Cleanup and Grand Release Plan

Purpose: persistent plan for the DEV-first cleanup of the PATH entity model, privacy-sensitive relationships, public portal messaging paths, and admin-console backend assumptions before a carefully rehearsed PROD cleanup release.

Status: active execution baseline as of 2026-04-26. Progress log: `docs/planning/privacy-erm-cleanup-progress.md`.

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

- `messages.sender_id` and `messages.recipient_id` historically pointed at local `user.id` values by convention only. DEV now has typed actor-domain columns plus FKs for legacy sender/recipient, typed actors, case, and application, but the table shape still carries compatibility person-to-person fields until the case-thread cutover is complete.
- `message_item` historically had no FK to `messages` or `user`; DEV contained rows pointing at missing messages and rows for nonparticipant owners. DEV cleanup preserved and deleted unsafe rows, and the table now has FKs for message and owner user.
- Admin case-message reads previously seeded `message_item` rows for the staff user opening a case, meaning mailbox state could be created by viewing rather than by true participation. DEV code no longer creates or trusts nonparticipant mailbox rows.
- Public portal message compose now targets current assigned staff and replies target the original same-case thread counterpart. DEV code also writes typed actor-domain fields, but the access model still needs to finish moving away from recipient authority toward case-thread authority.
- `iset_case.assigned_to_user_id` stores `staff_profiles.id`, despite the column name saying `user_id`. DEV now also has `assigned_staff_profile_id` with an FK to `staff_profiles(id)` as the first additive target-schema migration.
- DEV cases currently confirm that both legacy and explicit assignment columns match staff-profile IDs, not shared `user.id` values, with 0 assignment drift after the migration.
- Staff identity remains split across `staff_profiles` and shared `user`, with partial Cognito/email mappings and at least one local user row colliding with both staff and client identity concepts.
- `message_attachment.application_id` historically had a different integer type than `iset_application.id`, and public portal attachment insert previously did not populate `case_id`. DEV now has corrected typing, `client_id`, scope FKs, portal scope writes, and admin adoption validation, but TEST/PROD still need rehearsal before relying on those constraints outside DEV.
- `iset_document` allowed missing `client_id`; DEV contained documents missing `client_id` and `case_id`. DEV cleanup backfilled deterministic document scope gaps and cleared invalid document `user_id` values.
- `iset_document` now has DEV FKs for user/applicant user, client, case, application, action plan, linked task, and origin message. Final NOT NULL/source-specific constraints still need classification and rehearsal.
- `iset_application` and `iset_case` currently have bidirectional links, even though the target model is one client -> one case -> many applications.
- DEV now has FKs on the core case/application/client links and has retired the unscoped `POST /api/applications/ingest-from-submission` endpoint that could create applications without client/case scope.
- Application versioning has two incompatible implementations: newer application-based routes match the live table, while older case-based routes reference nonexistent columns.
- `/api/govuk-components` routes reference a missing `govuk_component` table.
- `jordan_application` and `jordan_application_draft` are empty legacy experiment tables; only stale UI references remain.
- Old stored procedures remain for appointment, booking, queue, and ticket structures that no longer exist.
- `staff_message*` appears to be a separate internal staff-to-staff messaging feature and should not be confused with applicant secure messaging.
- CFA tables have weak or missing FKs and mixed staff-profile ID typing, though DEV currently does not show orphan CFA rows.

## Target Model

### Identity

- `staff_profiles` is the authoritative staff profile table for admin roles, assignment, region, and staff display identity.
- Shared `user` rows are portal/applicant/local-account rows unless a specific bridge says otherwise.
- If staff need local `user` rows for legacy messaging compatibility, create or document an explicit mapping rather than relying on email fallback or numeric coincidence.
- Rename or replace misleading columns such as `iset_case.assigned_to_user_id` with `assigned_staff_profile_id`.
- Use typed actor fields for audit and messaging, for example:
  - `actor_type`
  - `actor_user_id`
  - `actor_staff_profile_id`

### Client, Case, and Application

- Preserve the agreed target model: one client -> one case -> many applications.
- Every submitted application should have `client_id` and `case_id`.
- `iset_case.application_id` should be retired, replaced by a clearly named `originating_application_id`, or treated as a temporary compatibility field until all reads move to `iset_application.case_id`.
- Case/application relationship constraints should be added only after backfill and repair scripts prove the current data can satisfy them.

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

Current status as of 2026-04-26:

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

Current status as of 2026-04-26:

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

Current status as of 2026-04-26:

- Added `iset_case.assigned_staff_profile_id` through `sql/migrations/20260426_0001_add_case_assigned_staff_profile_id.sql`.
- Backfilled it from valid legacy `assigned_to_user_id` values and normalized invalid legacy values to `NULL` by copying back from the explicit column.
- Added `fk_iset_case_assigned_staff_profile` to `staff_profiles(id)`.
- Updated admin and public portal assignment write paths to dual-write the legacy and explicit columns during the transition.
- Updated high-risk admin/shared read paths, case-access checks, RBAC predicates, staff joins, and reporting filters to prefer `assigned_staff_profile_id` through a legacy fallback expression.
- DEV post-migration audit shows 0 assignment-column drift and 0 legacy-only assigned cases.
- Added typed actor-domain columns to `messages` through `sql/migrations/20260426_0002_add_message_actor_domain_columns.sql`, with FKs to `user(id)` and `staff_profiles(id)`.
- Backfilled existing DEV messages to explicit `staff_profile -> applicant_user` actor domains with 0 missing typed actor fields and 0 `local_user` fallbacks.
- Added `message_attachment.client_id`, corrected `message_attachment.application_id` typing, and added attachment FKs through `sql/migrations/20260426_0003_harden_message_attachment_scope.sql`.
- Updated public portal attachment writes and admin attachment adoption validation to carry and check message/case/application/client scope.
- Added FKs for remaining legacy secure-message columns and mailbox state through `sql/migrations/20260426_0004_add_secure_message_referential_constraints.sql`.
- Added document-scope FKs and normalized document user/message ID column types through `sql/migrations/20260426_0005_harden_document_scope_references.sql`.
- Added staff-profile actor/reference FKs for remaining admin feedback, CFA, applicant-account, and tutorial-progress columns through `sql/migrations/20260426_0006_harden_staff_profile_actor_references.sql`.

### Phase 4 - DEV Code Cutover

Move admin and public portal code to the target model.

Expected changes:

- Public portal message create/reply uses case-thread identity, not arbitrary staff recipient selection.
- Admin case messaging uses case-thread access and staff-profile identity explicitly.
- Document upload/download/adoption routes resolve through scoped case/application/client relationships.
- Case assignment uses `staff_profiles.id` intentionally and consistently.
- Application versioning routes use one live implementation; obsolete case-version routes are removed or repaired.

Current status as of 2026-04-26:

- Public portal message list/detail/read/delete/replied/reply-target paths now require typed `applicant_user` participation and resolved case/application scope.
- Public portal reply routing now derives the recipient from the typed counterpart actor rather than trusting request-provided or legacy recipient authority.
- Admin secure-message mailbox state now seeds, joins, and mutates through typed `sender_user_id` / `recipient_user_id` fields.
- Admin secure-message widgets now classify inbox/sent/display state through typed actor fields first, and the public portal reply composer no longer supplies legacy `recipient_id` for replies.
- Legacy `sender_id` / `recipient_id` remain compatibility response/write fields until the full case-thread model or response contract cutover is complete.
- Unscoped admin application ingest route `POST /api/applications/ingest-from-submission` now returns `410`; scoped case/application creation must flow through `POST /api/cases` or the current intake/manual-intake flows.
- High-risk assignment response paths now emit explicit `assigned_staff_profile_id` / `assignedStaffProfileId` aliases and the main application/work-queue/case overview UI compares assignment through staff-profile IDs first.

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

### Phase 6 - TEST Rehearsal

Rehearse the release on TEST or a prod-like restored dataset.

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
| `staff_profiles.id` stored in columns named `user_id` | High | DEV now has explicit `iset_case.assigned_staff_profile_id` with FK, dual-write, high-risk backend response aliases, frontend comparisons that resolve staff-profile IDs first, and FKs on the remaining staff-profile actor columns; continue lower-risk response cleanup and eventual legacy-column retirement |
| Applicant secure messages visible to wrong user through `message_item` or `recipient_id` | High | DEV now has typed actors plus FKs on messages and `message_item`; public portal applicant reads, admin mailbox-state mutations, and main UI classification now use typed actor/case scope; continue full case-thread model and response contract cleanup |
| Signing requests visible or signable by wrong applicant | High | DEV now has signing-request workflow/case/participant/creator FKs and an audit check for participant-not-case-applicant, missing message links, and message/case mismatches |
| Escalations or case tasks routed through wrong/missing user IDs | High | DEV now requires case-scoped escalations, constrains escalation requester/current-owner/resolver users to shared `user.id`, and constrains case-task created/updated shared-user actors |
| Documents fetched by raw document ID | High | DEV now has document relationship FKs; continue requiring case/application/client/action-plan/intervention scope before presign or metadata return |
| Message attachments adopted without case/application validation | High | DEV now carries message/case/application/client scope at insert, validates scope on adoption, requires attachment case/client/uploader scope, and protects attachment scope parents with FKs; rehearse against PROD data before applying constraints outside DEV |
| Public portal identity fallback by email/SIN/name | High | Bind by Cognito subject and applicant-pool client only |
| Nullable/unconstrained document and message relationships | Medium/High | DEV now has message/message-item/attachment/document FKs plus source-specific message/document CHECK constraints; continue thread-model cleanup and TEST/PROD quarantine planning |
| Bidirectional case/application links obscure one-case-many-applications model | Medium | Move reads to `iset_application.case_id`, retire or rename case-side link |
| Split application versioning implementations | Medium | Keep application-based versioning, remove or repair obsolete case-based routes |
| Dead or scope-unsafe endpoints | Medium | Remove, gate, or return explicit gone responses; DEV now retires obsolete case-version/GOV.UK routes and unscoped submission-ingest route |
| Empty legacy experiment tables | Low/Medium | Confirm PROD state, then drop through migration |
| Old stored procedures for removed tables | Low/Medium | Drop after confirming no runtime use |

## Immediate DEV Checklist

- Add this persistent plan and doc pointers.
- Create the read-only privacy inventory script.
- Run inventory against DEV and capture counts.
- Update stale client/case/application planning docs where live schema has already moved forward.
- Patch secure messaging containment issues that still create or trust unsafe `message_item` state.
- Remove or hard-disable routes that reference missing tables.
- Continue lower-risk case-assignment response naming cleanup from `assigned_to_user_id` / `assigned_user_id` to explicit staff-profile naming; high-risk application/work-queue/case-detail paths now expose and consume `assigned_staff_profile_id` aliases.
- Decide whether secure messaging moves by new tables or by carefully evolving existing tables.
- Keep `20260426_0007_harden_secure_message_scope_constraints.sql` as the canonical DEV proof for secure-message/document privacy constraints; do not relax it for TEST/PROD without a documented quarantine reason.
- Add denial tests around message and document access before broader refactor.

## Acceptance Criteria

The cleanup is not complete until:

- No route returns client, application, case, document, note, event, message, attachment, or generated-file data by raw object ID alone.
- No code path treats `staff_profiles.id` as a shared `user.id`.
- No code path treats shared `user.id` as a staff-profile ID.
- Applicant secure-message visibility is derived from case/application/client scope.
- Staff secure-message visibility is derived from case access or explicit thread participation.
- DB constraints prevent the most important invalid relationships from being inserted.
- DEV and TEST audit scripts pass before PROD release.
- PROD migration has a written runbook, restore point, before/after counts, and smoke-test checklist.
