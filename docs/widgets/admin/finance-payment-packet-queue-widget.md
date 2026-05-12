# Finance Payment Packet Queue widget

## Workflow

Payments AP Integrations

## Source

- src/pages/finance/widgets/PaymentRequestsWidget.jsx

## Primary Route Context

- /finance/payments
- /iset/payments
- /cases/:caseId through the case wrapper widget

## Purpose

Shared payment packet queue. In `/finance/payments` it is an oversight queue; in `/iset/payments` and the Case Workspace it is an operational queue for creating and progressing payment packets.

## User Actions (observed)

- Open and inspect widget state for current case/submission/packet context.
- Use widget controls to progress work for the owning workflow.
- Navigate to linked records or execute relevant operational actions.

## Inputs / Dependencies

- Route context identifiers (case id, participant id, or selected packet).
- Back-end API payloads and runtime configuration for this feature area.
- Role/permission checks enforced by route guards and server APIs.

## Outputs / Side Effects

- Persists workflow data and emits status transitions relevant to the workflow.
- Updates dependent widgets through shared context/event updates.
- Contributes auditability via timeline/history/notes where applicable.

## Current Notes

- Keep this document aligned whenever this widget is refactored, renamed, moved, or given new actions.
- In `/finance/payments`, queue selection is single-select and drives the detail/communications drill-down state.
- The default finance queue filter opens on `Unsubmitted` to reduce clutter and surface current work first.
- In `/iset/payments`, the widget runs in operational mode and supports case search plus packet creation for approved interventions the user can access.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
