# Case Header widget

## Workflow

Case Management

## Source

- src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Top-level case identity, status, ownership, and quick actions.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.
- Switch the board to focused layouts such as `View audit trail`.
- For application-less imported client files, the quick actions menu also exposes:
  - `Add existing action plan`
  - `Add existing intervention`
  - `Upload existing documents`

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
- Imported/application-less cases use these quick actions as silent backload entry points. They record current-state action plans, interventions, and documents without starting approvals, checklist progression, or applicant notifications.
- Existing-intervention backload is lifecycle-aware: archived plans are blocked, closed plans accept only completed/cancelled interventions, and in-progress/suspended interventions require an active plan.
- Backloaded intervention `actual amount` is now finance-history only: it can write a posted historical ledger entry for reporting/budget burn, but the intervention cannot create payment packets or enter the live finance submission workflow.
- `View audit trail` now reconfigures the case workspace to show `Case header`, `Participant details`, and `Events timeline`.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
