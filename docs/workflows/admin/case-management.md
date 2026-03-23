# Workflow: Case Management (Action Plans, Interventions, Payments)

## Purpose

Run active client cases after approval, including plan management, intervention lifecycle, compliance checks, and case-linked payment packet preparation.

## Primary Routes

- `/cases/:caseId`
- `/iset/payments` (program payments surface; currently scaffolded)

## Core Widgets (current)

- Case header
- Participant details
- Action plans
- Interventions
- Intervention assessment
- Case notes and tasks
- Case calendar
- Supporting documents
- Secure messaging
- Compliance
- Export preview
- Finance panel
- Payment packet queue (case scope)
- Payment packet detail (case scope)

Widget references:
- `docs/widgets/admin/case-header-widget.md`
- `docs/widgets/admin/participant-details-widget.md`
- `docs/widgets/admin/action-plans-widget.md`
- `docs/widgets/admin/interventions-widget.md`
- `docs/widgets/admin/intervention-assessment-widget.md`
- `docs/widgets/admin/case-notes-widget.md`
- `docs/widgets/admin/case-calendar-widget.md`
- `docs/widgets/admin/supporting-documents-widget.md`
- `docs/widgets/admin/secure-messaging-widget.md`
- `docs/widgets/admin/case-compliance-widget.md`
- `docs/widgets/admin/case-export-preview-widget.md`
- `docs/widgets/admin/case-finance-panel-widget.md`
- `docs/widgets/admin/case-payment-packet-queue-widget.md`
- `docs/widgets/admin/case-payment-packet-detail-widget.md`

## Typical Flow

1. Open case workspace from queue item.
2. Confirm case header and participant profile context.
3. For imported/application-less client files, use the Case Header backload actions to add existing action plans, existing interventions, and existing documents without fabricating intake history.
4. Maintain or activate action plan.
5. Create/update interventions and track status/cost progression.
5. Validate compliance/export readiness as needed.
6. Draft and refine case-linked payment packets.
7. Communicate and store supporting evidence/messages.

## Data & Integration Touchpoints

- Case workspace endpoint(s) for case context and plans/interventions.
- ILMP validation/export services for compliance and payload preview.
- Payment packet data via finance payment services/context.
- Document and secure messaging APIs.

## Role Notes

- Intended for ISET Coordinator, Regional Manager, Program Administrator.
- Some actions are role-sensitive; route and server checks determine final access.

## Current Gaps / Risks

- `/iset/payments` page currently has empty widget registry; treat as scaffold.
- Plan/intervention/payment behavior is distributed across several widgets and contexts; regression risk is high without synchronized docs/tests.
