# Workflow: ILMP Reporting

## Purpose

Prepare participant and reporting-package submissions for ILMP/ESDC requirements, including readiness checks, validation, payload preview, and submission history.

## Primary Routes

- `/esdc/participants`
- `/esdc/participant/:clientId`
- `/esdc/reporting`

## Core Widgets (current)

Participant submissions page (`/esdc/participants`):
- Participant submission queue (bucket-style readiness summary, Validate all action, Generate batch XML action, and queue table)
- Recent ILMP exports (optional palette widget for audit/re-export work; no longer shown by default)

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
- `docs/widgets/admin/esdc-participant-submission-history-widget.md`
- `docs/widgets/admin/esdc-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-validation-summary-widget.md`
- `docs/widgets/admin/esdc-payload-preview-widget.md`
- `docs/widgets/admin/esdc-participant-workspace-history-widget.md`
- `docs/widgets/admin/esdc-reporting-packages-widget.md`
- `docs/widgets/admin/esdc-reporting-readiness-checklist-widget.md`
- `docs/widgets/admin/esdc-reporting-notes-widget.md`

## Typical Flow

1. Review participant readiness counts and the participant submission queue.
2. Open participant workspace for blocking issues.
3. Resolve readiness items and re-validate payload.
4. Generate the batch XML from the participant submission queue header for ready participants.
5. Manage reporting package status/checklist/notes for reporting periods.

## Data & Integration Touchpoints

- ESDC participant submission endpoints.
- ILMP validation and payload generation.
- Reporting package and notes persistence.
- Intervention/action-plan close-out rules are status-driven: planned end dates on non-terminal interventions stay out of ILMP close-out XML, while completed/cancelled interventions require end date + outcome.
- Intervention duration is exported/stored as the ILMP three-digit duration field and is capped at 999 days. Do not use that cap to limit real program schedules; long intervention start/end dates remain valid and the reportable duration should be clamped.

## Role Notes

- `/esdc/reporting` is explicitly guarded for Program Administrator (and System Administrator).
- Other ESDC routes are role-matrix controlled.

## Current Gaps / Risks

- ILMP schema conformance and code mappings are sensitive to backend mapping updates.
- Keep this workflow doc aligned with `docs/planning/ilmp-export-hardening-plan.md` and `docs/data/case-finance-data-architecture.md`.
