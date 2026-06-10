# ESDC Participant Submission Queue widget

## Workflow

ILMP Reporting

## Source

- src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx

## Primary Route Context

- /esdc/participants

## Purpose

Combined queue of participants pending validation/export actions, with bucket-style readiness counts, the bulk `Validate all` action, and the `Generate batch XML` action.

## User Actions (observed)

- Review ready / needs-review / blocked counts.
- Run `Validate all` to refresh readiness for the queue.
- Run `Generate batch XML` to prepare the XML for all ready participants, then save/download it and mark included clients as exported in PATH. Browsers with native save-dialog support use that dialog; other browsers fall back to the normal download flow. Staff still upload the downloaded XML manually through the external ESDC process.
- Open linked case workspaces from participant names.
- Expand only grouped participants with multiple submission/action-plan rows.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- `/api/esdc/participants?groupByClient=true` returns the paged grouped rows plus a `summary` object for the full filtered queue. The table page-size preference is display-only.
- `/api/esdc/participants/batch-prepare` and `/api/esdc/participants/batch-submit` are now launched from this widget rather than a separate Batch export widget. They call the backend batch collector without table `limit`/`offset` values, so `Generate batch XML` is not capped by the visible table page.
- `Generate batch XML` should stay enabled when the full-queue summary has either `ready` or `needsReview` clients. Backend generation includes warning-only clients and excludes blocked records automatically.
- Staff-facing wording should describe this as export/download/manual upload. The backend still has legacy `batch-submit` naming and status fields, but PATH does not directly submit or upload participant XML to ESDC from this widget.
- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
