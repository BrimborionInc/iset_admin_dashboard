# Application Overview widget

## Workflow

Application Assessment

## Source

- src/widgets/ApplicationOverviewWidget.js

## Primary Route Context

- /application-case/:id

## Purpose

Case summary, status context, quick actions, and layout shortcuts.

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
- The manual status selector in this widget is currently available to `System Administrator` and `NWAC Administrator` users; other roles see the read-only status badge plus any role-gated quick actions.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
