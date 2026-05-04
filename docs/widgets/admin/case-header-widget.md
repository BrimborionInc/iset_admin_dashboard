# Case Header widget

## Workflow

Case Management

## Source

- src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Top-level case identity, status, ownership, quick layouts, and quick actions.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.
- Switch the board through `Quick layouts`, including plans/interventions, payments, notes/calendar, documents/messages, audit trail, and ILMP validation.
- Use `Quick actions` for mutating or workflow-launching actions such as reassignment, intervention proposal, PATH account activation, case status changes, watchlist, lock release, and historical entry.
- For non-archived cases, System Administrator, NWAC Administrator, and Regional Manager can use historical-entry actions:
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
- The funding line now distinguishes `Approved`, `Committed`, and `Actual` instead of using `Committed` as a stand-in for approved intervention funding.
- Historical-entry actions are silent backload entry points. They record current-state action plans, interventions, and documents without starting approvals, checklist progression, payment packets, signing workflows, or applicant notifications.
- Existing-intervention backload is lifecycle-aware: archived plans are blocked, closed plans accept only completed/cancelled interventions, and in-progress/suspended interventions require an active plan.
- Backloaded intervention `actual amount` is now finance-history only: it can write a posted historical ledger entry for reporting/budget burn, but the intervention cannot create payment packets or enter the live finance submission workflow.
- `View audit trail` now reconfigures the case workspace to show `Case header`, `Participant details`, and `Events timeline`.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
