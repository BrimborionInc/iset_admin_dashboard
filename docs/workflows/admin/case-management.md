# Workflow: Case Management (Action Plans, Interventions, Payments)

## Purpose

Run active client cases after approval, including plan management, intervention lifecycle, compliance checks, and case-linked payment packet preparation.

## Primary Routes

- `/cases/:caseId`
- `/iset/payments` (cross-client operational payments dashboard)

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
- Events timeline
- Compliance
- Export preview
- Finance panel
- Payment packet queue (case scope)
- Payment packet detail (case scope)
- Payment communications (case scope)

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
- `docs/widgets/admin/case-events-timeline-widget.md`
- `docs/widgets/admin/case-compliance-widget.md`
- `docs/widgets/admin/case-export-preview-widget.md`
- `docs/widgets/admin/case-finance-panel-widget.md`
- `docs/widgets/admin/case-payment-packet-queue-widget.md`
- `docs/widgets/admin/case-payment-packet-detail-widget.md`
- `docs/widgets/admin/case-payment-communications-widget.md`

## Typical Flow

1. Open case workspace from queue item.
2. Confirm case header and participant profile context.
3. For imported/application-less client files, use the Case Header backload actions to add existing action plans, existing interventions, and existing documents without fabricating intake history.
4. Maintain or activate action plan.
5. Create/update interventions and track status/cost progression.
6. Use the Events Timeline when you need to confirm the audit trail, reminder activity, or who changed the file.
7. Validate compliance/export readiness as needed.
8. Draft and refine case-linked payment packets.
9. Communicate and store supporting evidence/messages.

## Data & Integration Touchpoints

- Case workspace endpoint(s) for case context and plans/interventions.
- Participant Details saves use the dedicated case-only `PATCH /api/cases/:caseId/participant-details` endpoint. The request contains only changed canonical participant fields and never carries an `applicationId`, application decision state, assessment state, or the whole case context. The server applies normal case access, locks and rereads the case, merges only its controlled field mapping, and returns the authoritative saved context.
- ILMP validation/export services for compliance and payload preview.
- Payment packet data via finance payment services/context.
- Document and secure messaging APIs.

## Role Notes

- Intended for ISET Coordinator, Regional Manager, NWAC Administrator.
- Some actions are role-sensitive; route and server checks determine final access.
- The `ISET Clients` route is available to Regional Managers; the backing `/api/cases` list uses the same case-scope model as workspaces: direct assignment, unassigned files when the manager has region scope, portfolio-region matches, and assigned-owner region matches.
- Regional Managers can now open directly assigned case-workspace files even when the case's current portfolio/owner region falls outside their normal region scope; otherwise normal region-scoped case access still applies.

## Current Gaps / Risks

- Plan/intervention/payment behavior is distributed across several widgets and contexts; regression risk is high without synchronized docs/tests.
