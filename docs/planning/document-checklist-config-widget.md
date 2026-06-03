Purpose: Capture the UX, data model, and implementation decisions for a configuration widget that lets SysAdmins edit the runtime document checklist by status gate.
Audience: Admin dashboard engineers, product owners, and operators configuring checklist requirements.
Last Updated: 2026-06-03

## Background
- The runtime checklist is stored in `iset_runtime_config` under `scope='checklist'` and key `checklist.compliance.iset`.
- Admin UIs consume `/api/applicants/:id/document-checklist`, which loads the runtime config and computes per-item status.
- System Administrators can edit the checklist from Configuration Settings > Document checklists. Direct DB edits are still used for guarded PROD repairs when the live config itself is broken.
- Runtime config source of truth remains `iset_runtime_config`; fallback JSON under `src/server/config/checklists/` should be kept aligned so new environments do not reintroduce repaired drift.
- Current PROD gate/item/document-type snapshot lives in `docs/data/document-checklist-current-configuration.md`; use it for staff-facing configuration review, then re-query the target environment before mutating runtime rows.

## Current Runtime Guardrails

- Checklist item `id` values are behavioral, not just display keys. `/api/applicants/:id/document-checklist` uses specific IDs to apply conditional required logic.
- Application checklist gate selection must respect `iset_application.decision_outcome`. A denied application must use the denial/no-funding checklist path even when its status is `completed`, its case is `closed`, or the UI explicitly requests the approval/funding stage (for example the shared assessment `communication` step requesting `approve_and_commence`).
- For income/expense evidence, use these conditional item IDs:
  - `financial-records` with document type `evidence_income`
  - `financial-evidence` with document type `evidence_expense`
- Do not use ad hoc IDs such as `evidence-of-income-submit-assessment` or `evidence-of-expense-submit-assessment` unless backend aliases are added; those IDs bypass the conditional logic and make the items always required.
- `band_funding_decision` is the merged Band/Nation decision-letter type. Checklist configs should accept it anywhere they still accept historical `band_funding_confirmation` / `band_funding_denial`.
- 2026-05-06 PROD repair: feedback reports `#78` and `#82` were resolved by updating live runtime config so application assessment income/expense evidence uses the conditional IDs above, intervention proposal Band/Nation checklist items accept `band_funding_decision`, and intervention financial evidence uses active document type `evidence_expense` instead of inactive `financial_evidence`.

## Goals
- Let System Administrators edit the checklist JSON via a configuration settings widget.
- Make checklist requirements configurable by status gate (e.g., draft, submitted, approval, post-approval).
- Preserve existing computed checklist behavior where it is still desired.

## Non-goals (initial)
- Redesign the supporting documents UI or the assessment flows.
- Replace the checklist computation logic outside of the configuration scope without explicit approval.

## Constraints / References
- Follow configuration dashboard patterns in `src/pages/configurationSettings.js`.
- Follow Cloudscape board guidance in `docs/guides/configurable-dashboard-notes.md` and `docs/guides/dashboard-scaffolding.md`.
- Runtime config source of truth remains `iset_runtime_config`.

## Open Questions
- None (ready to implement).

## Decisions (Interview Log)
- UI editor will be structured; admins will not see or edit raw JSON.
- Status cleanup deferred; keep the existing status model and alias handling for now.
- Application assessment gates are three phases:
  - Documents needed to submit the assessment (client/application docs such as ID, proof of expenses).
  - Documents needed to complete the assessment (e.g., Client Funding Agreement, EFT & Wire Transfer, Void Cheque).
  - Documents needed post completion (e.g., monthly attendance reports, receipts).
- Possible equivalence to intervention proposal/approval gates (needs confirmation).
- Final gate labels:
  - Needed to Submit Assessment
  - Needed to Enable Funding
  - Needed to Release Payments
- Scope includes both applications and interventions within one widget (separate tabs/sections).
- Separate tabs (not separate tables); tailored labels are acceptable while keeping the same gate structure.
- Intervention gate labels:
  - Needed to Submit Proposal
  - Needed to Enable Funding
  - Needed to Release Payments
- Application gate mapping (Needed to Submit Assessment): apply when application_status is
  `submitted`, `in_review`, `docs_requested` (plus hold aliases like `action_required`, `pending info`,
  `information requested`, `on_hold`), `closure_notice`.
- `pending_approval` should use the same checklist as "Needed to Submit Assessment" (not the funding gate).
- Application gate mapping (Needed to Enable Funding): apply when application_status is `approved` in the normal flow, while still accepting legacy `decision_ready` rows during cleanup.
- Application "Needed to Release Payments" gate should be driven by case status (not application status).
- Terminal case statuses (`closed`, `archived`) should not have checklists.
- Application "Needed to Release Payments" gate applies when case status is `initiated`, `active`, `dormant`, or `ready_to_close`.
- Intervention gate mapping (accepted):
  - Needed to Submit Proposal: `draft`, `changes_requested`.
  - Needed to Enable Funding: `submitted`, `in_review`.
  - Needed to Release Payments: `approved`, `in_progress`, `suspended`.
- Intervention terminal statuses (`completed`, `cancelled`) are excluded from checklists.
- The widget edits document requirements within each gate; gate/status mappings are read-only in the UI for now.

## Superseded Decisions (Status Cleanup)
- Canonical application status list (cleaned): `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`, `pending_completion`, `completed`, `closed`, `archived`.
- Canonical intervention status list (cleaned): `draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `rejected`, `in_progress`, `suspended`, `completed`, `cancelled`.
- No aliases: enforce hard, single-source status values only.
- Status cleanup scope included the full application + intervention status model (not just checklist gating).
- Assume clean DB; no migration/alias/fallback handling.
- Application gate mapping (Needed to Enable Funding): apply when application_status is `pending_completion` only.

## Proposed UX
- Structured checklist editor (no raw JSON view).
- Two tabs: Applications and Interventions.
- Each gate renders as a section with status summary, table of items, and add/edit modal.

## Data Model / Schema
- Config shape:
  - `id`, `label`, `version`
  - `gates[]`: `id`, `label`, `statusScope` (`application` | `case` | `intervention`), `statuses[]`, `items[]`
  - `items[]`: `id`, `label`, `required` (bool), `documentTypes[]`, `sources[]`, optional `minCount`, optional `notes`
- Item `id` values are used for conditional checklist logic; preserve existing ids when editing.

## API & Persistence
- `GET /api/config/runtime/checklists` -> `{ application, intervention, source }`
- `PATCH /api/config/runtime/checklists` -> persists to `iset_runtime_config` under:
  - `scope = 'checklist'`, `k = 'checklist.compliance.iset'` (application)
  - `scope = 'checklist'`, `k = 'checklist.compliance.iset.intervention'` (intervention)

## Validation & Error Handling
- Server rejects payloads without gates/statuses or with items missing `id`, `label`, or `documentTypes`.
- UI enforces required fields, highlights duplicates per gate, and surfaces API errors.

## Permissions & Audit
- Save endpoint requires System Administrator role.

## Migration / Rollout
- Seed fallbacks in `src/server/config/checklists/`.
- Save updates into `iset_runtime_config` so checklists survive deploys.
