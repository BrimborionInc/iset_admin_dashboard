Purpose: Track design, planning, implementation, and validation for moving vendor/payee capture earlier into intervention proposal cost-line workflows while keeping final enforcement at payment submission.
Audience: Admin dashboard engineers, workflow owners, finance operations.
Last Updated: 2026-03-10

# Vendor/Payee Early Capture Refactor

## Phase Status
- Design: In progress
- Planning: In progress
- Implementation: In progress

## Problem Statement
- Current flow exposes payee editing primarily at draft payment packet stage.
- Case managers need payee capture/editing earlier while adding intervention proposal cost lines in both:
  - Application Workspace (`CoordinatorAssessmentWidget`)
  - Case Workspace (`InterventionAssessmentWidget`)
- Cost-step UX must remain compact and not add table clutter.
- Submit-to-finance must still be blocked when payee is missing.

## Scope
- Add payee capture/editing to cost-line modal UX in both workspaces.
- Persist payee data in `assessment_proposed_interventions.proposed_interventions.costLines[]` JSON payload.
- Seed auto-generated payment packet lines from persisted cost-line payee values when available.
- Keep cost-step validation non-blocking for missing payee.
- Strengthen packet validation/submission blockers so missing payee is explicit and line-addressable.

## Non-Goals
- Full payee profile master-data redesign (`payee_profile` lifecycle, dedupe, directory search UX).
- New costing-table columns for payee in "What will it cost?".
- Final modal UX polish (deferred to testing phase).

## Evidence Snapshot (Code + DB)
- Assessment cost lines currently persist in JSON only and do not include payee fields.
- `iset_case_assessment.proposed_interventions` exists as JSON and is the current persistence target.
- `payment_packet_line` requires `payee_type` and `payee_name` (NOT NULL).
- Auto packet generation currently derives payee from fallback logic (`client/partner`) and does not read payee from cost lines.
- Packet validation path (`runPaymentPacketValidation` -> `validatePaymentLinePolicy`) currently enforces policy/evidence/recurrence but does not explicitly enforce non-empty payee fields at validation time.

## Locked Decisions (Interview Log)
- 2026-03-10: Missing payee is allowed at "What will it cost?" stage.
- 2026-03-10: Missing payee must block payment packet progression before "Submit to finance" unlocks.
- 2026-03-10: Do not add a dedicated payee column in the costing table (avoid clutter).
- 2026-03-10: Use a single cost-line modal (no multi-dialog payee flow).
- 2026-03-10: Modal sections should use dynamic hide/show fields; avoid collapsible sections.
- 2026-03-10: Payee section should be expanded/visible by default in add/edit cost-line modals.
- 2026-03-10: Submission-block UX should include both top-level validation messaging and line-level indication.
- 2026-03-10: Prioritize functional implementation now; visual/interaction polish deferred to testing phase.

## Data Model Proposal
- Extend proposed cost-line JSON shape with optional payee object:
  - `payee.type` (string)
  - `payee.name` (string)
  - `payee.reference` (string|null)
- Backward compatibility:
  - Existing cost lines without `payee` remain valid.
  - Serializer writes `payee: null` or omitted when blank.
  - Normalizers accept both missing and partial payee payloads safely.

## UX/Validation Proposal
- Cost-line modal fields:
  - Existing cost + recurrence + notes retained.
  - Add payee fields in same modal with dynamic visibility rules.
  - Keep table unchanged (no new columns).
- Cost-step validation:
  - No blocking for missing payee on Save/Next in costing step.
- Packet-stage validation/submission:
  - Validation returns explicit payee missing errors with `lineId`.
  - Packet UI shows:
    - top-level blocked summary (existing action status area), and
    - line-level indicator on affected lines.

## Backend Plan
1. Extend proposed-cost-line normalization/serialization helpers in `isetadminserver.js`:
   - `normalizeProposedCostLine`
   - any downstream projection helpers used for assessment/intervention metadata.
2. Update auto line generation from assessment cost lines:
   - `buildAutoPaymentLinesFromCostLines` should prefer cost-line payee when provided.
   - fallback to current derived payee behavior when missing.
3. Add explicit payee completeness checks in validation policy:
   - `validatePaymentLinePolicy` emits structured error when `payee_type`/`payee_name` are empty.
   - Preserve existing policy checks.

## Frontend Plan
1. Application Workspace (`src/widgets/CoordinatorAssessmentWidget.js`)
   - Extend cost-line model with `payee` fields.
   - Update normalizers/serializers.
   - Add payee inputs in cost-line modal.
2. Case Workspace (`src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`)
   - Mirror model + serializer/normalizer + modal changes.
3. Payment Detail UI (`src/pages/finance/widgets/PaymentDetailWidget.jsx`)
   - Render lightweight line-level indicator for payee-missing validation errors after validation attempt.

## Risks
- Divergence between Application and Case workspace models if one widget is updated incompletely.
- Legacy proposed-interventions payload variants (older rows not matching current JSON shape).
- Overly aggressive validation could block existing draft packets unexpectedly.

## Mitigations
- Implement shared payee helper shape in both widgets with identical field names.
- Keep parser tolerant and writer explicit.
- Limit new hard-block to packet validation/submission (not costing steps).
- Preserve fallback payee auto-derivation when cost-line payee absent.

## Validation Plan
- Manual:
  - Add/edit cost line with and without payee in both workspaces.
  - Save/Next succeeds without payee in costing step.
  - Approve intervention -> auto packet lines include captured payee when present.
  - Validate packet with missing payee -> blocked with top-level + line-level cues.
  - Complete payee and revalidate -> can submit.
- Regression:
  - Recurrence editing still functions.
  - Payment type allowed mapping unaffected.
  - Evidence requirement checks unchanged.

## Rollout/Docs
- Update help panel content for assessment/case intervention costing and payment detail validation behavior.
- Update `docs/meta/changelog.md` and `docs/meta/next-release-notes-log.md` once implementation lands.

## Open Items
- Whether to also persist `payee_profile_id` linkage in proposed cost-line JSON is deferred (out-of-scope for current functional refactor).

## Implementation Progress Log
- 2026-03-10: Added planning tracker and locked interview decisions for modal/table/submission behavior.
- 2026-03-10: Updated Application + Case costing widgets to include payee fields in cost-line models and single-modal UI.
- 2026-03-10: Extended backend proposed-cost-line normalization to persist optional payee payload (`type`, `name`, `reference`).
- 2026-03-10: Updated auto packet generation to prefer cost-line payee when available and carry `payee_reference` forward.
- 2026-03-10: Added packet validation error `payee_missing` to block submission when line payee is incomplete.
- 2026-03-10: Added line-level payee-missing indicator in payment packet detail table.
