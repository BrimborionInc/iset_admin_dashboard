# Admin Manual "New Application" Design (MVP Spec)

Status: In Progress (staff-assisted intake/account triage first pass implemented)
Last updated: 2026-07-11

## Context

- Legacy assumption in system design: new applications originate in the public portal.
- Operational reality: portal usage is not mandatory or universal; staff receive paper/PDF applications.
- MVP goal: add a first-class manual intake path in admin without introducing backend draft-record complexity.

## Why This Exists

- Support valid non-portal intake operations.
- Allow authorized staff to key handwritten/paper/PDF applications into PATH.
- Preserve existing downstream assessment/casework workflow after creation.

## Canonical Personas

1. Applicant/Participant
- Program subject whose information is being represented.

2. ISET Coordinator
- Primary operator for manual intake and downstream assessment/casework.

3. Regional Manager
- Authorized manual creator and operational overseer.

4. NWAC (Program) Administrators
- Authorized manual creator and policy/oversight role.

## Access Scope (MVP)

Manual intake route is available to:
- ISET Coordinator
- Regional Manager
- NWAC (Program) Administrator
- System Administrator (technical/admin access in current role matrix)

## UX Container And Naming (Settled)

- Dashboard/nav label: `Application Intake`
- Page header: `Manual Application Intake`
- Primary action: `Create Application`
- Supporting copy intent:
  - Enter application information received outside the portal (paper/PDF).
  - PATH creates a record only after validation passes.

## Entry Point (Settled)

- Primary entry under `New ISET Applications` section in side navigation.
- Dedicated route: `/iset/applications/intake`.
- Manual intake is separated from assessment dashboards.

## Core Flow (MVP Settled)

1. Staff opens `Application Intake` and reviews the `Staff-Assisted Intake Flow` widget.
2. Staff works the process in order: confirm identity, check existing PATH client/applicant-account records, choose account handling, complete application details, then submit/follow up.
3. Staff records the intake source and searches existing client/applicant-account rows when enough identity information is available.
4. Staff selects an existing client/account match when the application belongs to a known PATH client, or chooses an account handling plan for a new file.
5. Staff completes required fields in the dedicated manual intake form.
6. Form working state remains in the mounted React page only while incomplete. Raw applicant answers, notes, searches, and selected matches are not written to browser storage.
7. Backend create is blocked until required validation passes and the selected account strategy is internally consistent.
8. On success, PATH creates or reuses the appropriate `client`/case context, writes `user`, `iset_application_submission`, `iset_application`, and `iset_case` records as needed, and can silently prepare the applicant account as `Ready to invite` when that strategy is explicitly selected.
9. PATH emits `application_submitted` through the existing shared events pipeline with manual-origin and account-decision metadata.
10. User is redirected immediately to `/application-case/:id` with success confirmation.

## Staff-Assisted Intake Flow Widget (2026-06-11)

Manual Intake now has a full-width `Staff-Assisted Intake Flow` board widget above the `Staff-Assisted Intake Wizard`. The flow cards are status-aware and clickable; they mirror the wizard steps while still showing the process at a glance before staff begin.

The widget shows five live checkpoints:

- `Identity` - derives its status from name/email/contact information entered in the manual form;
- `Check Existing Account` - reflects search readiness, active search, selected match, no-match result, or search errors;
- `Account Handling` - reflects the selected account strategy and validation requirements such as selected-client linkage, email for ready-to-invite accounts, or required no-portal notes;
- `Application Details` - reflects whether the published intake schema is loading, not started, in progress, or on the final visible step;
- `Submit & Follow Up` - reminds staff that application creation and account activation/follow-up are separate operational actions.

This keeps the process visible before staff begin data entry while the wizard provides the actual step-by-step working surface. The dashboard layout storage key moved to `manual-intake-dashboard-layout-v12` so the wizard-led layout appears by default even for browsers with older Manual Intake layouts saved.

## Staff-Assisted Intake Wizard (2026-06-11 First Pass)

Manual Intake is now treated as staff-assisted intake rather than only an embedded public form. The dashboard uses a single `Staff-Assisted Intake Wizard` beneath the top flow widget instead of a dense separate account-triage panel.

The wizard supports:

- identity and source capture for paper, PDF, phone, in-person, or other intake;
- manual search against `/api/admin/applicants` for existing clients/applicant accounts, after staff confirm identity;
- selecting an existing client/account match so the backend reuses that client and their preferred case instead of creating a duplicate client file;
- choosing an account handling plan in its own step:
  - `review_later` - create the application and review PATH account/activation from the workspace;
  - `create_ready_to_invite` - call `ensureApplicantAccountForClient` during manual intake so the participant account is ready for staff to send activation later;
  - `link_selected_client` - attach to the selected existing client/account;
  - `no_portal_planned` - record that portal access is not planned yet, with a required account-decision note in the UI;
- completing the published manual-intake form as the `Application details` step, with internal form-step next/back labels when the published schema has multiple visible steps;
- reviewing identity, selected account context, and account plan before creating the application;
- persisting the chosen plan in `intake_payload.manual_intake`, `iset_application.payload_json.manual_intake`, and the `application_submitted` event payload.

The first pass intentionally does not send activation email during manual application creation. Activation email remains an explicit workspace/User Management action so staff do not accidentally notify applicants while still reviewing a paper/PDF/phone/in-person intake.

Current limitation: the published public-intake schema still drives required fields for Manual Intake, so the existing email/name requirements still apply. A true no-email/no-portal manual-only path would need a separate backend/schema decision rather than a UI-only option.

## Portal Canonical Write Sequence (`POST /api/intake/complete`)

The public portal canonical submission flow writes in this order:

1. Load aggregate intake working state from `input_json_state` for the signed-in applicant.
2. Resolve/create `client` linkage for the applicant context.
3. Build canonical submission payload (`intake_payload`), normalized history, doc refs, locale/IP/user-agent, and checksum.
4. Capture runtime published intake schema snapshot and persist it with the submission.
5. Insert `iset_application_submission` (`status='submitted'`, `submitted_at=NOW()`).
6. Create `iset_application` linked by `submission_id` (idempotent check first).
7. Link submitted documents to application scope.
8. Create `iset_case` for the application (auto-assignment may run first and set assignee).
9. Emit `application_submitted` event into the shared event pipeline with baseline metadata.
10. Trigger post-submit document/signature generation pipeline.
11. Clear draft/ephemeral intake state (`iset_application_draft_dynamic` and `input_json_state`).

This sequence is the baseline for manual admin intake semantics.

## Shared Service Decision

For this refactor, we did not call into the portal route handler directly. The portal submit flow and admin submit flow run in different server entrypoints with different request/auth contexts, so direct route reuse would create tight cross-service coupling.  

The chosen approach is functional parity with extraction-ready helpers in admin:
- use the same canonical model (`iset_application_submission` first, with schema snapshot),
- use the same event type (`application_submitted`),
- preserve baseline metadata shape,
- and keep implementation structured so a future shared module can be extracted cleanly once both services are ready to consume a common submission service.

## Frontend Reuse Strategy (Explicit)

What is reused directly:
- Runtime-published intake schema from `iset_runtime_config` (`publish/workflow.schema.intake`) via admin API endpoint.
- Shared schema contract (`steps/components/storageKey/validation`) as the only field-definition source.
- Shared portal renderer registry (`src/portalRendererRegistry.js` -> `src/component-lib/portalRenderers.js`) for component rendering.

What is adapted (not a separate form definition):
- Admin wrapper UX (header, intake-source metadata, create action, redirect).
- Step runner orchestration (next/back progression, mounted-page working state, submit trigger).
- Validation orchestration adapted from existing admin schema runner logic (same schema-driven required/rules model).

Result:
- No admin-only field model was created.
- Manual intake UI renders against the same runtime-published schema contract used for portal intake.

## Signature Policy (MVP Settled)

- Admin manual intake must not capture applicant signatures/declarations on the applicant’s behalf.
- Signature components are skipped in admin intake progression.
- Manual intake validation excludes signature storage types from required blocking.
- Manual submission metadata records signature handling as deferred (`signature_capture = deferred_to_applicant`).
- Any signature capture remains a participant-facing action outside staff entry.

## Document Upload Policy (MVP Settled)

- Admin manual intake does not capture supporting document uploads.
- `file-upload` components are skipped in admin intake progression.
- Manual intake validation excludes `files` storage types from required blocking.
- Manual submission metadata records document handling as deferred (`document_capture = deferred_to_application_workspace`).
- Supporting documents are collected and tracked in the Application Workspace document/checklist flow after create.

## Portal Metadata Mapping For Manual-Origin Submission

Portal baseline metadata kept for manual submissions:
- `reference_number`
- `workflow_id`
- `ip`
- `user_agent`
- `submitted_at`
- submission checksum and locale

Manual-origin additive metadata:
- `origin_channel = admin_manual`
- `origin_mode = staff_entered`
- `intake_source`
- `intake_source_notes`
- `account_decision`
- `account_selected_client_id`
- `account_selected_applicant_name`
- `account_selected_applicant_email`
- `account_selected_status`
- `account_search_query`
- `account_decision_notes`
- `created_by_staff_id`
- `created_by_staff_role`
- `created_by_staff_email`
- `manual_entry_timestamp`
- `intake_source` and optional notes

Source-of-truth rule remains unchanged: intake origin is determined from persisted origin metadata, not UI rendering context.

## Guardrails (MVP Non-Negotiable)

- No backend or browser-storage persisted partial/draft manual application records. Leaving/reloading the page discards incomplete applicant PII.
- Existing-client selection is valid only for the current normalized search, applicant-identity fingerprint, and response generation. Query/identity edits or a newer search invalidate it.
- The create endpoint rechecks selected-client strategy plus available email/DOB identity evidence under the transaction lock and fails closed on mismatch.
- Existing workflow gating remains authoritative after record creation.
- Manual intake uses existing event/audit framework; no parallel audit subsystem.
- Origin metadata must be explicit and queryable.
- No separate manager/admin approval workflow is introduced.

## Data/Origin Truth Model (Settled)

- Single canonical application model is retained.
- Authoritative origin signal is `origin_channel` metadata in persisted payload and event payload.
- Event catalog `source` label is not authoritative for intake-origin semantics.
- Consumer rule: timeline/reporting logic should use `event_data.origin_channel` when present.

Required manual-origin metadata (MVP target):
- `origin_channel = admin_manual`
- `origin_mode = staff_entered`
- creator identity fields (`created_by_staff_id`, role/email where available)
- `manual_entry_timestamp`
- intake source medium (`intake_source`)

## Audit/Event Baseline (Code Review)

Reviewed against:
- `../ISET-intake/server.js`
- `../shared/events/catalog.js`
- `../shared/events/emitter.js`
- `isetadminserver.js`

Portal baseline:
- `POST /api/intake/complete` persists `iset_application_submission` and emits `application_submitted`.
- Baseline payload fields include `submission_id`, `reference_number`, `workflow_id`, `ip`, `user_agent`.

Manual alignment:
- Reuse `application_submitted` event type.
- Emit as case event when case exists.
- Preserve baseline payload keys and add manual-origin metadata.
- Manual path actor should be staff (`actor_type='staff'`).

## MVP Control Risks And Explicit Requirements

### 1) Duplicate Risk

MVP requirement:
- Before final create, perform duplicate check at least on applicant email against existing active/in-flight records.
- If duplicate detected, require explicit user acknowledgement or override path.
- Persist dedupe outcome metadata for traceability (`dedupe_result`, optional `dedupe_override_reason`).

### 2) Staff Confirmation Trace

MVP requirement:
- Capture explicit minimal staff confirmation basis for submission readiness (short rationale/note).
- This is a lightweight trace requirement, not an approval workflow.

### 3) Origin Semantics Drift

MVP requirement:
- Downstream consumers must not infer origin solely from catalog `source`.
- Consumers should prefer explicit origin metadata in event payload/data model.

## Historical Notes (Superseded)

- Early design discussion explored backend partial-save lifecycle and resumable incomplete records.
- That model is intentionally excluded from MVP to reduce complexity and queue clutter.
- Current MVP keeps incomplete state only in the mounted frontend page; the earlier origin-wide `sessionStorage` draft was retired in R3a because it crossed staff authentication boundaries with applicant PII.

## Implementation Progress (2026-03-06)

Implemented in this thread:
- New intake page scaffold:
  - `src/pages/intake/ManualApplicationIntakePage.jsx`
  - in-memory frontend working state + validation-gated create; no raw applicant PII draft in browser storage.
- Navigation/route/roles:
  - Side-nav `Application Intake` link.
  - Route `/iset/applications/intake`.
  - Role matrix updated for authorized roles.
- Help panel:
  - `src/helpPanelContents/manualApplicationIntakeHelp.js`.
- Backend endpoint (refactored for portal parity semantics):
  - `POST /api/applications/manual-intake` in `isetadminserver.js`.
  - Validates request payload against runtime published intake schema.
  - Rejects create when required runtime-schema fields are missing.
  - Persists full `iset_application_submission` snapshot with `schema_snapshot` (no longer `NULL`).
  - Persists canonical submission metadata (history/doc refs/locale/ip/user-agent/checksum).
  - Creates `iset_application` and `iset_case` transactionally after successful submission insert.
  - Emits `application_submitted` with baseline + manual-origin metadata.
  - Manual-origin event payload includes `intake_source` and `intake_source_notes` for timeline/reporting context.
- Published schema read endpoint:
  - `GET /api/workflows/published/intake-schema` in `isetadminserver.js`.
  - Returns runtime-published intake schema payload used by admin intake UI.
- Frontend intake refactor (reuse-first):
  - `src/pages/intake/ManualApplicationIntakePage.jsx` now loads published schema and renders schema-driven steps.
  - Uses shared portal renderer registry for component rendering.
  - Submits canonical body `{ workflowId, intakePayload, history, intakeSource, intakeSourceNotes }`.
  - Retains mounted-page working state only; no browser-storage or backend partial record persistence.
  - Signature/declaration steps are skipped in admin intake UI.
  - Document-upload (`file-upload`) steps are skipped in admin intake UI.
  - Manual Intake page now follows the standard configurable Cloudscape dashboard pattern (`Board`/`BoardItem`, palette integration, reset-layout wiring, layout persistence key).
- Backend signature enforcement:
  - Manual-intake schema validation excludes `signature` storage type from required checks.
  - Signature fields are stripped from persisted manual `intake_payload` if supplied.
  - Manual metadata includes `signature_capture: deferred_to_applicant`.
- Backend document enforcement:
  - Manual-intake schema validation excludes `files` storage type from required checks.
  - Manual metadata includes `document_capture: deferred_to_application_workspace`.
- Post-create handoff:
  - Redirect to `/application-case/:id` with success flash.
  - Events Timeline `application_submitted` message includes intake source/notes for manual-origin submissions when present.

Verification:
- Frontend lint on changed files: no new errors.
- Existing warnings remain in `src/pages/applicationCaseDashboard.js` (pre-existing hook dependency warnings).
- Backend syntax check succeeded with Windows Node:
  - `/mnt/c/Program Files/nodejs/node.exe --check isetadminserver.js`

## Remaining Implementation Follow-Ups

- Frontend intake UI currently posts a minimal scaffold payload. It must be upgraded to submit the full runtime-schema intake payload to satisfy new backend validation semantics.
- Implement explicit dedupe UX/behavior and dedupe trace metadata.
- Implement explicit confirmation-basis capture for staff attestation trace.
- Enforce origin-truth usage in downstream consumers (`event_data.origin_channel` precedence).
- Expand manual intake fields toward full portal parity as needed.
- Decide applicant-notification behavior post manual create.
- Define off-portal to portal account-link lifecycle (out of MVP scope).
