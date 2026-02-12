# Workflow: ILMP Reporting

## Purpose

Prepare participant and reporting-package submissions for ILMP/ESDC requirements, including readiness checks, validation, payload preview, and submission history.

## Primary Routes

- `/esdc/participants`
- `/esdc/participant/:clientId`
- `/esdc/reporting`

## Core Widgets (current)

Participant submissions page (`/esdc/participants`):
- Participant submission queue
- Batch submission
- Validation summary
- Recent participant submissions

Participant workspace (`/esdc/participant/:clientId`):
- Submission readiness checklist
- Validation summary
- Payload preview
- Submission history

Reporting packages (`/esdc/reporting`):
- Reporting packages
- Reporting readiness checklist
- Submission notes and follow-ups

Widget references:
- `docs/widgets/admin/esdc-participant-submission-queue-widget.md`
- `docs/widgets/admin/esdc-batch-submission-widget.md`
- `docs/widgets/admin/esdc-participant-validation-summary-widget.md`
- `docs/widgets/admin/esdc-participant-submission-history-widget.md`
- `docs/widgets/admin/esdc-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-validation-summary-widget.md`
- `docs/widgets/admin/esdc-payload-preview-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-history-widget.md`
- `docs/widgets/admin/esdc-reporting-packages-widget.md`
- `docs/widgets/admin/esdc-reporting-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-reporting-notes-widget.md`

## Typical Flow

1. Review participant submission queue and validation summary.
2. Open participant workspace for blocking issues.
3. Resolve readiness items and re-validate payload.
4. Run batch submission for ready participants.
5. Manage reporting package status/checklist/notes for reporting periods.

## Data & Integration Touchpoints

- ESDC participant submission endpoints.
- ILMP validation and payload generation.
- Reporting package and notes persistence.

## Role Notes

- `/esdc/reporting` is explicitly guarded for Program Administrator (and System Administrator).
- Other ESDC routes are role-matrix controlled.

## Current Gaps / Risks

- ILMP schema conformance and code mappings are sensitive to backend mapping updates.
- Keep this workflow doc aligned with `docs/planning/ilmp-export-hardening-plan.md` and `docs/data/case-finance-data-architecture.md`.
