# Workflow: Payments AP Integrations

## Purpose

Move payment packets from operational preparation to AP-facing submission context with traceable evidence, communication logs, and SLA monitoring.

## Primary Routes

- `/finance/payments`
- `/iset/payments`
- `/cases/:caseId` (case payment packet widgets)

## Core Widgets (current)

Finance Payments dashboard (`/finance/payments`):
- Payment packet queue
- Payment packet detail
- Payment communications
- SLA snapshot

Operational Payments dashboard (`/iset/payments`):
- Payment packet queue
- Payment packet detail
- Payment communications
- SLA snapshot

Case workspace payment surfaces (`/cases/:caseId`):
- Payment packet queue (case scope)
- Payment packet detail (case scope)
- Payment communications (case scope)

Widget references:
- `docs/widgets/admin/finance-payment-packet-queue-widget.md`
- `docs/widgets/admin/finance-payment-packet-detail-widget.md`
- `docs/widgets/admin/finance-payment-communications-widget.md`
- `docs/widgets/admin/finance-payment-sla-widget.md`
- `docs/widgets/admin/case-payment-packet-queue-widget.md`
- `docs/widgets/admin/case-payment-packet-detail-widget.md`
- `docs/widgets/admin/case-payment-communications-widget.md`

## Typical Flow

1. Create/refine packet in case workspace or finance queue.
2. Confirm reporting unit, amounts, evidence completeness, and required metadata.
3. Submit packet and track communication/outbound events.
4. Monitor SLA status and exceptions.
5. Reconcile follow-up actions for returned or incomplete packets.

## Data & Integration Touchpoints

- Finance payment packet APIs and data context.
- Evidence/document linkage and checklist completeness.
- AP communication log and status transitions.

## Role Notes

- Program Administrator and Regional Manager are primary operational roles for finance payment queues.
- ISET Coordinator interaction is typically case-scoped and may be partial.

## Current Gaps / Risks

- AP integration semantics depend on backend pipeline state; document expected behavior separately from integration implementation internals.
- Keep queue/status definitions synchronized with finance help-panel and SLA widget docs.
