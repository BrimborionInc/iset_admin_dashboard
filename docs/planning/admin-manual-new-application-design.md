# Admin Manual "New Application" Design (MVP Spec)

Status: In Progress (backend semantics refactor underway)  
Last updated: 2026-03-06

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

1. Staff opens `Application Intake` and starts `Create Application`.
2. Staff completes required fields in a dedicated manual intake form.
3. Form working state remains frontend/session only while incomplete.
4. Backend create is blocked until required validation passes.
5. On success, PATH creates `user`, `iset_application_submission`, `iset_application`, `client`, and `iset_case`.
6. PATH emits `application_submitted` through the existing shared events pipeline with manual-origin metadata.
7. User is redirected immediately to `/application-case/:id` with success confirmation.

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
- Step runner orchestration (next/back progression, draft-in-session behavior, submit trigger).
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
- `created_by_staff_id`
- `created_by_staff_role`
- `created_by_staff_email`
- `manual_entry_timestamp`
- `intake_source` and optional notes

Source-of-truth rule remains unchanged: intake origin is determined from persisted origin metadata, not UI rendering context.

## Guardrails (MVP Non-Negotiable)

- No backend persisted partial/draft manual application records.
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
- Current MVP keeps incomplete state in frontend/session only.

## Implementation Progress (2026-03-06)

Implemented in this thread:
- New intake page scaffold:
  - `src/pages/intake/ManualApplicationIntakePage.jsx`
  - frontend/session working state + validation-gated create.
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
  - Retains frontend/session draft behavior only; no backend partial record persistence.
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
