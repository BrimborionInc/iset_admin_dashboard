# Change Request CR-0011 – Persisted Recurring Intervention Costs

## Context
- **Trigger:** During workspace testing we confirmed the recurrence inputs in `InterventionModal` only pre-fill the single cost field; the calculated total is stored, but the recurring parameters themselves are discarded as soon as the modal closes. Re-opening the modal therefore shows a one-time cost, and upcoming finance projections cannot read the underlying cadence.
- **Dependencies:** Builds on CR-0010 (optional recurring costs) and the action-plan/intervention APIs defined in CR-0008/CR-0007.

## Problem Statement
- Users can capture recurring cost details, but the cadence (period, amount per occurrence, occurrence count) is not persisted.
- Editing an intervention that was originally entered as recurring displays it as a one-time total, losing user intent and preventing future financial models from reconstructing the schedule.
- Finance forecasting features planned for 2026 require access to recurrence metadata.

## Goals
1. Persist recurrence metadata whenever the modal is saved (create or edit).
2. Hydrate the modal with the stored recurrence values so users see the original cadence when reopening.
3. Ensure the intervention table and ILMP exports continue to display the single total cost.

## Non-Goals
- No change to ILMP payload structure (still a single total amount).
- No immediate UI changes to the interventions table (labels remain as totals).
- Budget pot forecasting logic remains out of scope; this CR only guarantees the recurrence data is available.

## Proposed Changes
### Frontend
- Update `InterventionModal` submission payload to include `costType` and `recurrence` object (`period`, `amountPerPeriod`, `occurrences`, `calculatedTotal`).
- On modal open, detect recurrence metadata in the intervention record (`metadata.costSettings`) and pre-populate the recurrence form fields, switching the toggle to “Recurring schedule” automatically.
- Ensure the derived total continues to backfill the `cost` field so existing table display and validation remain intact.

### Backend / Data Normalisation
- In `createIntervention` / `updateIntervention` APIs, accept and persist the recurrence object inside `metadata_json` (or introduce dedicated columns if already planned).
- When normalising interventions in `CaseWorkspaceContext`, expose the recurrence metadata so the UI can hydrate the modal.

### Testing & Documentation
- Add regression tests (unit + Cypress) verifying that:
  - Saving a recurring schedule and re-opening preserves the cadence fields.
  - Switching from recurring back to one-time removes the stored recurrence metadata.
- Update CR-0010 implementation notes / user guidance to reflect the persistence behaviour.

## Risks & Considerations
- `metadata_json` growth: ensure payload size stays reasonable and key names align with future finance schemas.
- Backwards compatibility: existing interventions without recurrence data must still load as one-time totals.
- Migration/cleanup for interventions already stored with recurrence intent but missing metadata may be required (manual QA pass planned).

## Milestones
1. **API contract update** – define payload shape and validation (Q4 2025).
2. **Frontend persistence** – ship modal changes + hydration (Q4 2025).
3. **Documentation & QA** – update user docs, regression suite (Q4 2025).
4. **Follow-up** – leverage recurrence data in finance forecasting (separate CR, targeting 2026 finance roadmap).

## Progress
- **2025-10-30** – Step 1 complete. Intervention modal now submits recurrence metadata (cost type + cost settings), and workspace state merges those details after create/update so they persist for future hydration. (Codex)
- **2025-10-30** – Step 2 complete. Stored recurrence metadata is merged into the workspace intervention and drives modal hydration, so reopening an intervention restores the original cadence settings. (Codex)
