# Notes and Tasks widget

## Workflow

Application Assessment; Case Management

## Source

- src/widgets/CaseNotesWidget.js

## Primary Route Context

- /application-case/:id; /cases/:caseId

## Purpose

Internal notes, reminders, and operational context.

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
- The manual `Refresh notes` control should call `GET /api/cases/:id/notes` once. Do not dispatch a self-targeted `case-notes-refresh` event from the refresh handler, because the widget already listens for that event from other workflow surfaces.
