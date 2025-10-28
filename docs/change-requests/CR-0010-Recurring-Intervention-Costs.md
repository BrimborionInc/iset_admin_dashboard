# Change Request CR-0010 - Optional Recurring Intervention Costs

## Context
- **Trigger:** NWAC finance leads requested support for tracking intervention costs that recur on a schedule (e.g., weekly supports) without losing ILMP export compatibility.
- **Goal:** Allow staff to capture recurring cost details for interventions while continuing to submit a single total cost value to ESDC.
- **Related CRs:** CR-0009 (intervention reference data enablement).

## Proposed Changes
1. **Frontend**
   - Add a "Cost type" toggle in the intervention modal (`InterventionModal`) letting staff choose between "One-time total" (current behaviour) and "Recurring".
   - When "Recurring" is selected, show inputs for:
     - Recurrence period (enum: weekly, bi-weekly, monthly, quarterly; admin-configurable list).
     - Amount per period (currency).
     - Number of occurrences (auto-default based on start/end dates and period, but editable).
   - Display a calculated total and validation message if the derived total is non-integer (ESDC requirement).
   - Persist recurring parameters alongside the derived total cost; fallback to total cost if the toggle is off.

2. **Backend / Data Model**
   - Extend the intervention payload to accept new fields: `costType`, `recurrence` object (`period`, `amountPerPeriod`, `occurrences`, `calculatedTotal`).
   - Store the recurrence metadata in `iset_case_intervention.metadata_json` for now; plan a future migration into normalized finance tables once budget pot work lands.
   - Ensure API validation rejects totals that exceed ILMP limits (0-999999) after calculation and enforces integer totals for export.

3. **Exports / Reporting**
   - ILMP exporter continues to use the single total amount.
   - Case workspace summaries and future finance dashboards should surface both the total and recurrence details when present.

## Open Questions
- Should recurrence periods be fully configurable, or bounded to a fixed list aligned with finance policy?
- How do we handle partial periods when start/end dates do not divide evenly by the selected cadence?
- Do we need budget pot split logic to mirror the recurring schedule (tie-in with upcoming finance module)?

## Risks & Dependencies
- Requires coordination with the finance schema roadmap to avoid duplicate modeling.
- Client training and documentation updates needed so staff understand recurring vs one-time workflows.
- Additional QA to verify calculations, rounding, and ILMP validation edge cases.

## Next Steps
1. UX wireframe for the updated intervention modal.
2. API contract update and metadata schema definition.
3. Implementation (frontend + backend) and targeted regression tests on ILMP export totals.
4. Update end-user guidance once feature is ready for pilot.
