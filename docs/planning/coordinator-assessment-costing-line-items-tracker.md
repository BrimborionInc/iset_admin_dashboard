Purpose: Capture requirements, UX decisions, and implementation plan for enabling multiple interventions and manual line-item costing in the Coordinator Assessment wizard.
Audience: Admin dashboard engineers, product owners, and operations.
Last Updated: 2026-04-11

## Background
- The Coordinator Assessment wizard needs updates to support multiple interventions.
- The "What will it cost" step must allow assessors to manually enter line items in the costing table.

## Goals
- Enable multiple interventions within a single Coordinator Assessment.
- Allow assessors to add/edit/remove manual line items in the costing table for the "What will it cost" step.
- Preload suggested cost items based on earlier assessment inputs.
- Restrict cost item choices by intervention using the same payment type mapping as finance.
- Keep the costing experience clear and auditable for assessors and downstream reviewers.

## Non-goals (initial)
- Seeding draft payment packets from assessment cost lines (follow-on phase; track in a separate planning doc).

## Constraints / References
- Follow dashboard/widget guardrails in `docs/guides/configurable-dashboard-notes.md`.
- Use Cloudscape components and existing assessment patterns.
- Confirm backend payloads and projections before changing UI fields.

## Open Questions
- Where should the "starter" line-item mapping per intervention code live (runtime config vs code vs DB), and who will maintain it?
- Which application/assessment fields should be used to suppress or add suggested items (e.g., living allowance request, childcare, dates)?
- Should suggested rows be marked as "recommended" vs "added by assessor" for audit clarity?

## Decisions (Interview Log)
- 2026-01-09: The "What will it cost" step becomes a Cloudscape table with add/edit/remove line items.
- 2026-01-09: Support multiple interventions in step 2; each cost item is linked to exactly one intervention.
- 2026-01-09: Cost item type is not free-text; it must be selected from the same payment type list and intervention mapping used for payment lines.
- 2026-01-09: Cost items preload suggested entries based on earlier assessment steps.
- 2026-01-09: Replace the single recurring-cost model with per-line recurrence; recurrence rules can vary by cost item type (some types may require recurrence).
- 2026-01-09: Suggested cost items should cover all intervention codes; assessors can edit, add, delete, or clear the starter list.
- 2026-01-09: Suggested items should be suppressed when application inputs indicate they are not requested (e.g., living allowance).
- 2026-01-09: Living allowance suggestions should default to monthly recurrence when dates are provided and the intervention allows living allowance.
- 2026-01-09: Store the starter line-item mapping per intervention in runtime config; plan to expose it later via a configuration settings widget.
- 2026-01-09: The starter mapping should support default amounts and recurrence rules per line item (even if not fully configured at first).
- 2026-01-09: Recurrence supports monthly only, with per-line start date, end date, and occurrences fields.
- 2026-01-09: Living allowance lines require recurrence; other payment types allow both non-recurring and recurring for now.
- 2026-01-09: Recurrence rules live in the runtime mapping (avoid hard-coding to support future config settings).
- 2026-01-09: Store coordinator costing defaults in runtime config under scope `assessment`, key `coordinator.costing.line_item_defaults`.
- 2026-01-09: Persist proposed interventions and their cost lines in a new JSON column on `iset_case_assessment` (e.g., `proposed_interventions`) instead of a new table.
- 2026-01-09: Use a separate cost table per intervention, with per-intervention totals visible.
- 2026-01-09: Costing table columns are limited to Cost Item, Amount, and Installments to keep the widget compact (no Intervention column).
- 2026-01-09: Recurrence details (start/end/occurrences) are edited in the line item modal; the table shows a compact recurrence summary only.
- 2026-01-09: Line items are scoped to the active intervention table (no intervention selector in the modal).
- 2026-01-09: Each intervention table has its own “Add cost item” button.
- 2026-01-09: No bulk clear; deletes are per-row only.
- 2026-01-09: Per-intervention totals update live as amounts change.
- 2026-01-09: Empty-state text per intervention table: "Intervention has no cost items".
- 2026-01-09: Amounts can be null; validation blocks Next until each line has an amount. $0.00 is valid.
- 2026-01-09: Inline edit should prevent invalid currency input (non-numeric or >2 decimals) but allow blank.
- 2026-01-09: Totals ignore null amounts (do not break summing).
- 2026-01-09: Inline edits on recurring lines update the per-period amount to match the new total/occurrences.
- 2026-01-09: Modal edits to per-period amount or occurrences recalculate the total on save.
- 2026-01-09: If intervention end date changes and recurring line(s) exist with non-null values, prompt whether to adjust per-period amount or overall total.
- 2026-01-09: End-date change adjustment applies to all recurring lines for that intervention.
- 2026-01-09: End-date change modal defaults to adjusting total (not monthly).
- 2026-01-09: Recurrence occurrences are editable when no intervention end date exists.
- 2026-01-09: If an end date exists and occurrences are edited, confirm whether to update the end date; cancel reverts the occurrences change.
- 2026-01-09: Accepting an occurrences change updates the intervention end date and recalculates recurring lines for that intervention (using the default "adjust total" behavior).
- 2026-01-09: When an intervention end date is missing, a recurring line can still be completed by entering occurrences; the line’s end date is derived from start + occurrences, and the intervention end date is only updated on explicit confirmation.
- 2026-01-09: Per-intervention totals display in a table footer row labeled TOTAL.
- 2026-01-09: Occurrences auto-calculate from dates when end date is set (no manual helper control).
- 2026-01-09: Show an overall total proposed cost above the intervention tables.
- 2026-01-09: Overall total updates live and always shows the sum of entered amounts (no "incomplete" placeholder).
- 2026-01-09: Each intervention table heading uses the intervention code label only (no numeric code).
- 2026-01-09: Do not display intervention start/end dates in the costing step.
- 2026-01-09: Overall total displays as simple text (no callout styling).
- 2026-01-09: Installments column uses a checkmark only (monthly is implied).
- 2026-01-09: Show a compact warning icon when a recurring schedule is incomplete (no checkmark).
- 2026-01-09: Warning icon shows when recurrence is incomplete or required-but-unset.
- 2026-01-09: Modal save enforces required recurrence completion (start/end/occurrences).
- 2026-01-09: Total amount is editable in the modal as well as inline in the table.
- 2026-01-09: Editing total in the modal immediately recomputes per-period amount for recurring lines.
- 2026-01-09: Per-period field is hidden when recurrence is not enabled.
- 2026-01-09: Add-item modal starts with an empty cost item selection; available types are filtered by the intervention’s allowed payment types.
- 2026-01-09: Prevent duplicate cost item types within the same intervention.
- 2026-01-09: Deleting a cost line frees that type for reuse within the intervention.
- 2026-01-09: Preserve insertion order (seeded by runtime-config suggestions).
- 2026-01-09: Suggested line items can prefill notes/description from runtime config.
- 2026-01-09: Cost item type is locked after creation; change requires deleting and re-adding the line.
- 2026-01-09: All modal fields are read-only until Edit is selected.
- 2026-01-09: No row selection column; actions are per-row only. Amount is inline-editable; all other edits happen in the line item modal.
- 2026-01-09: Inline Amount editing uses the custom currency helper for display while keeping input values numeric/sanitized.
- 2026-01-09: Line item modal includes a free-text notes/description field.
- 2026-01-09: Assessment cost line items should seed draft payment packets when interventions are proposed.
- 2026-01-09: Suggested cost lines seed once per intervention; application edits do not reflow the table. Date edits only update recurrence schedules.
- 2026-01-09: Deleting a proposed intervention prompts a warning that associated costing will be removed; deletion removes all related cost lines.
- 2026-01-09: Do not add a manual “regenerate suggestions” button; keep automatic changes minimal to preserve assessor control.
- 2026-01-09: Intervention types are not edited in place; assessors add/delete interventions instead.
- 2026-01-09: Date edits should recalculate recurrences for existing recurring lines.
- 2026-01-09: Living allowance suggestions only appear on initial population; later application edits do not reflow the costing table.
- 2026-01-09: Deleting a proposed intervention removes all linked cost lines (suggested or edited).
- 2026-01-09: Recurrence fields are visible when recurrence is enabled; disable the toggle when the cost item type does not allow edits.
- 2026-01-09: Each cost line requires an amount; Next is blocked until all lines have amounts or are deleted.
- 2026-01-09: Amount represents the total cost per line item; recurring lines store/display total (not per-period) to keep totals accurate.
- 2026-01-09: Recurrence column label should change to "Installments" (or similar) and show a checkmark only when the schedule is complete.
- 2026-01-09: Amount column always shows total; per-period values are only shown/edited in the modal.
- 2026-01-09: Inline table actions are delete only (icon). Cost Item column is a Cloudscape Link to open the line modal.
- 2026-01-09: Line modal opens in view mode by default with readOnly inputs (not disabled). Edit action switches to editable fields with save/cancel; delete is available in the modal.
- 2026-01-09: Recurrence checkmark shows only when the schedule is complete (start/end/occurrences valid).
- 2026-01-09: Interventions may have zero cost lines; allow no-cost interventions.
- 2026-01-09: Show the TOTAL footer row even when an intervention has zero cost lines (display $0.00).
- 2026-01-09: Overall total still displays and shows $0.00 when all interventions have no cost lines.
- 2026-01-09: Overall total includes only currently proposed interventions (no archived/removed concept).
- 2026-01-09: Persist cost line changes on Save and Next (not on each inline/modal edit).
- 2026-04-11: Amount-entry sanitizing for the Add cost item modal and inline amount editors must preserve a just-typed trailing decimal while the field is focused. Stripping the trailing `.` during controlled-input updates turns values like `1505.28` into `150528`, so the UI must keep the raw in-progress numeric string during editing and normalize it on blur.
- 2026-01-09: Save bypasses validation; Next enforces amount/recurrence rules.
- 2026-01-09: Summary step lists interventions with totals (no full line-item table).
- 2026-01-09: Summary step shows overall total plus per-intervention totals; if only one intervention, avoid duplicating the same total twice.
- 2026-01-09: Recurring lines default start/end/occurrences from the intervention dates when available.
- 2026-01-09: Step 2 must enforce intervention start date required on Next.
- 2026-01-09: When recurrence is enabled and an intervention end date exists, auto-calculate occurrences from dates even if recurrence is optional for the cost item type.
- 2026-01-09: Allow deleting the last proposed intervention; block Next when no interventions are present.
- 2026-01-09: Proposed interventions step uses an embedded Cloudscape table with columns Intervention + Actions and an empty-state message.
- 2026-01-09: Intervention start/end dates are only editable in a modal; intervention code is locked after creation with a hint to delete/re-add to change it.
- 2026-01-09: Intervention modal opens in view mode with edit/delete actions; edit mode unlocks inputs and exposes save/cancel (save enabled only when dirty).
- 2026-01-09: Deletion warning modal should be short ("all cost items will be removed").
- 2026-01-09: Use Cloudscape table `stripedRows` for the costing tables.
- 2026-01-09: Recurrence section is always visible when recurrence is enabled.

## Design
Status: In progress (implementation underway)

### UX / Flow
- Costing step renders one compact line-items table per proposed intervention, each with a visible total.
- Cost item selector is filtered by the intervention code via the shared payment type mapping.
- Each line item includes its own recurrence settings (when allowed/required).
- Suggested rows seed the table; assessors can edit amounts/recurrence, add new rows, or delete rows.
- Tables stay compact; recurrence details are summarized in the Installments column with full edit in the line editor.
- Suggested rows are only auto-affected by major events (adding/removing interventions, date changes for recurrence); warn before deleting interventions because related cost lines will be removed.

### Data & Validation
- Each cost line references a single intervention.
- Line item types are validated against the allowed payment types for that intervention.
- Recurrence validation is per-line and can be required based on payment type.
- Suggested line items are derived from intervention code plus application/assessment data (e.g., requested living allowance).
- Starter line-item mapping will live in runtime config (future admin editor).
- Starter line-item mapping should be able to carry default amounts and recurrence rules.
- Recurrence fields: monthly frequency only, plus start date, end date, and occurrences.
- Recurrence requirement (e.g., Living Allowance) is configured via runtime mapping, not hard-coded.

### Permissions & Roles
- TBD.

## Planning
Status: In progress

### Work Breakdown
- TBD.

### Dependencies / Risks
- Follow-on: define how assessment cost lines map to payment packets when interventions are proposed.

### Validation / Testing
- TBD.

## Implementation
Status: In progress

### Changes
- Added runtime config API for assessment costing defaults and seeded `coordinator.costing.line_item_defaults`.
- Persisted proposed interventions + cost lines in `assessment_proposed_interventions` (JSON) and mapped primary intervention fields for legacy columns.
- Reworked Coordinator Assessment wizard to support multiple interventions, per-intervention costing tables, inline amount edits, and line-item modals with recurrence schedules.
- Updated the proposed interventions step to use an embedded table with modal-based editing and a delete-only row action.
- Updated cost totals (overall + per intervention) and review step summaries.
- Removed legacy intervention type references in schema/mapping sources.

### Rollout / Comms
- TBD.
