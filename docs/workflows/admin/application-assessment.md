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
7. Use timeline and notes for operational traceability.

## Data & Integration Touchpoints

- Case read/write: `/api/cases/:id`
- Messaging: `/api/cases/:id/messages`
- Supporting documents and checklist APIs (case-linked)
- Event/audit timelines (case/application events)

## Role Notes

- Intended for ISET Coordinator, Regional Manager, Program Administrator.
- Final permissions enforced by route matrix and server-side action checks.

## Current Gaps / Risks

- Widget behavior and route permissions are spread across multiple components; keep this doc aligned on refactors.
- Layout customization can hide required widgets unless reset logic runs before tutorial flows.
