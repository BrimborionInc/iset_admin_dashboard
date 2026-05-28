# ESDC Participant Validation Summary widget

## Workflow

ILMP Reporting

## Source

- src/pages/esdc/widgets/EsdcParticipantValidationWidget.jsx

## Primary Route Context

- /esdc/participants

## Purpose

Retired from the default `/esdc/participants` dashboard in DEV on 2026-05-27. Its readiness counts and bulk `Validate all` action moved into `EsdcParticipantQueueWidget.jsx` so the participant submissions page has one combined validation/queue/export surface.

## User Actions (observed)

- Historical reference only unless this standalone widget is deliberately reintroduced.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Current participant dashboard documentation lives in `docs/widgets/admin/esdc-participant-submission-queue-widget.md`.
