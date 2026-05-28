# ESDC Batch Submission widget

## Workflow

ILMP Reporting

## Source

- src/pages/esdc/widgets/EsdcBatchSubmissionWidget.jsx

## Primary Route Context

- /esdc/participants

## Purpose

Historical standalone widget for generating ILMP submission batches for ready records.

## User Actions (observed)

- Retired from the default `/esdc/participants` dashboard in DEV on 2026-05-27.
- Use `Generate batch XML` in the Participant submission queue header instead.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- The source file remains in the repo as legacy/reference code, but `EsdcParticipantSubmissionsPage.jsx` no longer registers it in the widget registry.
- Batch prepare/download endpoints are now invoked by `src/pages/esdc/widgets/EsdcParticipantQueueWidget.jsx`.
