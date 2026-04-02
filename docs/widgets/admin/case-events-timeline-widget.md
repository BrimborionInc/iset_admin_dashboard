# Case Events Timeline widget

## Workflow

Case Management

## Source

- `src/pages/Caseworking/caseWorkspace/widgets/CaseApplicationEventsWidget.jsx`
- Shared renderer: `src/widgets/applicationEvents.js`

## Primary Route Context

- `/cases/:caseId`

## Purpose

Chronological event history for case activity, reminders, status changes, and related workflow actions.

## User Actions (observed)

- Open and inspect the current case audit trail.
- Filter or sort the timeline to find specific activity.
- Acknowledge reminder events when action is complete.
- Export the visible timeline to CSV when needed for review or audit support.

## Inputs / Dependencies

- Route case id from the Case Workspace.
- Back-end event feed from `GET /api/cases/:id/events`.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Refreshes when case widgets emit the shared `case-events-refresh` event.
- Can acknowledge reminder rows through the reminder API.
- Contributes auditability and operational traceability for the case record.

## Current Notes

- This is the same underlying timeline/feed used in Application Workspace, now exposed in Case Workspace as an optional widget and `View audit trail` quick layout.
- Keep this document aligned whenever the shared timeline widget or case wrapper changes.
