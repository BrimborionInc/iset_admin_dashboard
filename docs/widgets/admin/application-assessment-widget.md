# Application Assessment widget

## Workflow

Application Assessment

## Source

- src/widgets/CoordinatorAssessmentWidget.js

## Primary Route Context

- /application-case/:id

## Purpose

Runs assessment workflow, recommendation, and decision preparation.

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
- Browser spellcheck is now explicitly enabled only for narrative assessment fields (for example overview, goals, justification, notes, and letter drafting) and explicitly disabled for proper-noun, code, reference, and semi-structured fields such as institutions, program names, NOC lookup, payees, and similar identifiers.
- The widget header and lead-in copy are now phase-aware: `Application assessment` during coordinator drafting, `Application approval` during decision review, and `Application decision/approval follow-up` once the workflow is in communication or funding-form completion.
- `Approval and decision > Request Changes` writes the reviewer note into Case Notes and should appear immediately in `Notes and Reminders` after commit.
- On `Submit assessment`, PATH now warns when active uploaded `Application form` or `Financial overview` documents already exist for the application and lets staff retain those current files instead of replacing them with system-generated PDFs.
- Case manager assessment PDF redlines now stay off for first-version submissions, and later redline PDFs compare only against the immediately previous submitted assessment version with old values shown in red strikethrough above new green values for changed text fields.
- Case manager assessment PDF signatures now prefer the coordinator/approver staff display name from the PATH staff profile and read signature history from the shared event store before falling back to the legacy case-event table.
- Application approval-letter packs allow staff to edit the client letter plus generated institution, loan-provider, and other-funder letter bodies in the approval-letter tabs before saving drafts, sending the client letter, or downloading supporting letters.
- `Approval and decision` now shows the case manager's submitted recommendation and justification above the NWAC decision controls, so reviewers can see the proposal context without opening the assessment PDF.
