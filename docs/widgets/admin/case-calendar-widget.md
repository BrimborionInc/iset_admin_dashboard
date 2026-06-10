# Case Calendar widget

## Workflow

Application Assessment; Case Management

## Source

- src/widgets/CaseCalendarWidget.js

## Primary Route Context

- /application-case/:id; /cases/:caseId

## Purpose

Calendar/list visibility for reminders and due dates.

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
- `src/widgets/CaseCalendarWidget.js` is shared by both the case workspace and application workspace.
- Treat date-only values (`YYYY-MM-DD`) as local calendar dates for Canadian users; do not feed them directly through UTC-based `new Date('YYYY-MM-DD')` parsing or UTC-midnight weekday label anchors.
- Empty event/reminder fields should render as `Not recorded`, not replacement-character placeholders.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
