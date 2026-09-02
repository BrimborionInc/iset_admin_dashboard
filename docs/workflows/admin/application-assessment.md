# Workflow: Application Assessment

## Purpose

Process a submitted application from triage through assessment, recommendation, review, and decision handoff.

## Primary Route

- `/application-case/:id`

## Core Widgets (current)

- Application Overview
- ISET Application Form
- Application Assessment
- Supporting Documents
- Secure Messaging
- Notes and Reminders
- Case Calendar
- Events Timeline

Widget references:
- `docs/widgets/admin/application-overview-widget.md`
- `docs/widgets/admin/iset-application-form-widget.md`
- `docs/widgets/admin/application-assessment-widget.md`
- `docs/widgets/admin/supporting-documents-widget.md`
- `docs/widgets/admin/secure-messaging-widget.md`
- `docs/widgets/admin/case-notes-widget.md`
- `docs/widgets/admin/case-calendar-widget.md`
- `docs/widgets/admin/application-events-timeline-widget.md`

## Typical Flow

1. Open item from work queue into `/application-case/:id`.
2. Confirm identity, status, lock context, SLA, and owner in Application Overview.
3. Review intake data in ISET Application Form; edit where role allows.
4. Complete assessment sections in Application Assessment widget.
5. Validate documents and communicate with applicant as needed.
6. Save/submit assessment and progress to NWAC decision where applicable.
7. While pending decision, the submitted assessment is read-only. The recorded submitter can use `Recall submission` before a decision is recorded to return it to editable review and archive the active generated submission PDFs. The resulting `withdrawn` review stage is a recalled submission, not a cancelled application: only that recorded submitter (or System Administrator technical support without changing submitter ownership) may edit and resubmit it. Resubmission restarts Regional Manager review, clears stale reviewer decisions, and records a new workflow event.
8. `Withdraw application` is a separate terminal action available through Application Overview to every staff role with normal access to an eligible file. It requires a reason and atomically moves any pre-final application-assessment review to `withdrawn` with no owner, without calling recall or archiving the submitted assessment packet. A final-decision-recorded review remains blocked from ordinary withdrawal.
9. Regional Managers, NWAC Administrators, and System Administrators can correct the EI status from the existing eligibility dropdown after submission while no action-plan or intervention dependency exists.
10. Use timeline and notes for operational traceability.

## Data & Integration Touchpoints

- Case read/write: `/api/cases/:id`
- Assessment recall: `POST /api/cases/:id/assessment/recall`
- Messaging: `/api/cases/:id/messages`
- Supporting documents and checklist APIs (case-linked)
- Event/audit timelines (case/application events)

## Role Notes

- Intended for ISET Coordinator, Regional Manager, NWAC Administrator.
- Final permissions enforced by route matrix and server-side action checks.

## Current Gaps / Risks

- Widget behavior and route permissions are spread across multiple components; keep this doc aligned on refactors.
- Layout customization can hide required widgets unless reset logic runs before tutorial flows.
