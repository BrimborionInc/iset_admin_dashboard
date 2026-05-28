# ESDC Participant Submission History widget

## Workflow

ILMP Reporting

## Source

- src/pages/esdc/widgets/EsdcParticipantHistoryWidget.jsx

## Primary Route Context

- /esdc/participants

## Purpose

Optional Recent ILMP exports widget for participant batch audit/re-export work.

## User Actions (observed)

- Add the widget from the `/esdc/participants` dashboard palette when export audit details are needed.
- Review generated batch metadata, participants, checksum/size, and XML payload.
- Mark a batch back to pending when it needs to be regenerated.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- No longer shown in the default `/esdc/participants` layout as of storage key `esdc-participants-layout-v6`; it remains registered as an optional palette widget.
- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
