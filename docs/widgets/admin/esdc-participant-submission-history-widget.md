# ESDC Participant Submission History widget

## Workflow

ILMP Reporting

## Source

- src/pages/esdc/widgets/EsdcParticipantHistoryWidget.jsx

## Primary Route Context

- /esdc/participants

## Purpose

Optional Recent ILMP exports widget for checking downloaded participant batch XML files and requeueing exported clients when a replacement export is needed.

## User Actions (observed)

- Add the widget from the `/esdc/participants` dashboard palette when prior export details are needed.
- Review the downloaded file path/name, downloaded time, downloader display name, clients exported, and XML payload.
- Requeue the exported clients when a batch needs to be regenerated.

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
- UI wording must use downloaded/exported/manual-upload language. PATH generates/downloads XML for manual upload; it does not directly submit ILMP data to ESDC from this widget.
- The primary widget surface is intentionally compact: an embedded history table plus a selected-export area with `Summary`, `Clients exported`, and `XML` tabs. Summary should show recorded file path/name, downloaded time, downloader display name, and clients exported; keep upload status, checksum, and other technical metadata out of the default summary unless a real staff task needs it.
- The `XML` tab shows the stored XML snapshot from the export history event details at the point the file was downloaded. It is not regenerated from current client/case data.
- Switching selected exports should preserve the active tab so staff can compare the same view, especially XML snapshots, across exports.
- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
