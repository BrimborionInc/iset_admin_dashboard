# Events Timeline widget

## Workflow

Application Assessment

## Source

- src/widgets/applicationEvents.js

## Primary Route Context

- /application-case/:id
- /cases/:caseId (shared timeline, via case workspace wrapper)

## Purpose

Chronological event history for case/application actions.

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
- The same underlying timeline/feed is now also exposed in Case Workspace.
