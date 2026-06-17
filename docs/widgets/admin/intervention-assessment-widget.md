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
- Submitted new intervention proposals and submitted intervention revision/amendment proposals are read-only while awaiting decision. The submitter sees `Recall submission`; recall moves the proposal/revision back to `draft`, archives the active generated assessment/redline PDFs for the recalled submission, writes an `assessment_recalled` audit event, and allows correction/resubmission while no decision has been recorded.
- Reviewers keep editable decision-only controls on submitted proposals/revisions, but the proposal body remains locked from the approver perspective. Recalled PDFs are archived out of the active document stream so later redlines compare against the last active non-recalled assessment rather than a withdrawn submission.
- Other funding rows now carry a funding status (`Confirmed`, `Pending`, `Denied`, or `Unknown / not confirmed`), optional amount, coverage, and notes. Coverage is required only for confirmed other funding; pending/denied/unknown rows can be recorded for context without generating other-funder approval letters. When an intervention revision has no saved other-funding details, the widget seeds the revision from the current application assessment other-funding context.
- Intervention approval-letter follow-up lets staff edit generated client, institution, loan-provider, and other-funder letter bodies in the letter tabs before sending the client letter or downloading supporting letters.
- `Record of decision` now shows the inferred case manager recommendation plus the submitted proposal/revision rationale above the decision controls, so reviewers can see the proposal context without opening the generated assessment PDF.
- For submitted intervention revisions, `Record of decision` shows a compact reviewer-only amendment scale line immediately above the decision control: `Net change +/-$X · Revised total $Y`. This compares the loaded source intervention total with the proposed revised snapshot and does not change proposer workflow, approval semantics, or PDF generation.
- `Record of decision` uses context-specific decision wording for new intervention proposals and intervention change proposals. The decision field asks whether the reviewer is approving the proposal/change, denying it, or requesting changes, and no longer describes all outcomes as an approval decision.
