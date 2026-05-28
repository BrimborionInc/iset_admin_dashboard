# Interventions widget

## Workflow

Case Management

## Source

- src/pages/Caseworking/caseWorkspace/widgets/InterventionsWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Manage interventions under the active action plan.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.

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
- Add endpoint-level detail and UAT script rows in the next documentation pass.
- Approved new/revised intervention proposals with pending approval-letter follow-up still count as an in-progress proposal for quick actions. They block starting another proposal or revision until the intervention-scoped approval letter has been sent and the persisted `approvalLetterFollowUp` marker is present.
- Activating an already approved intervention is a delivery transition (`delivery_status = in_progress`). It must not be treated as recording a proposal approval/denial/pushback decision and must remain available to the authorized case owner/manager path.
- The stored/reportable `duration_days` value is capped at 999 for ILMP compatibility. The actual intervention schedule should continue to use `start_date` and `end_date`; long education interventions can span more than 999 days, but the modal/API should clamp the derived duration instead of blocking save.
- Residence costs are a distinct payment type from living allowance. When correcting an intervention revision, staff can edit the existing cost line's cost item instead of deleting and recreating it; switching from a recurring living-allowance line to an intervention-start cost item should clear the installment schedule unless the new payment type is also recurrence-scheduled.
