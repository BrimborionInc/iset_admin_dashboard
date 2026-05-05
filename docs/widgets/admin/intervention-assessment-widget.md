# Intervention Assessment widget

## Workflow

Case Management

## Source

- src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Propose and stage intervention details for approvals.

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
- The widget header and lead-in copy are now phase-aware: draft flows use proposal/change wording, approval flows use review wording, and completion/follow-up states use completion or letter-follow-up wording instead of leaving the widget titled `Proposed new intervention` throughout.
- Approved new intervention proposals and approved intervention revisions now reopen into an approval-letter follow-up state based on persisted proposal/revision state, not temporary frontend completion state. Ordinary historical/backloaded approved interventions do not unlock this follow-up merely because their intervention status is approved/planned/in-progress.
- Approved intervention proposals remain in the follow-up state across sessions until the intervention-scoped approval letter is sent. Sending the letter records `metadata.approvalLetterFollowUp` on the durable intervention row, and revised-intervention approvals use the approved source intervention after the temporary revision draft is applied/deleted.
- Intervention proposal workflows expose approval-letter follow-up only. Denied or changes-requested intervention proposals close or return to draft/rework without showing an intervention denial-letter path.
- Changes-requested proposals stay in `changes_requested` while the case manager edits and saves progress. The final wizard action is `Resubmit for approval`, which updates the existing proposal/revision row back to `submitted` and clears the active decision fields for the new review cycle.
