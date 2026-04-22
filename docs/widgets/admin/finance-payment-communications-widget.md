# Finance Payment Communications widget

## Workflow

Payments AP Integrations

## Source

- src/pages/finance/widgets/PaymentCommunicationWidget.jsx

## Primary Route Context

- /finance/payments

## Purpose

Communication history for packet submissions.

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
- The communication log table shows `Client name` as the first column for each packet communication row.
- In `/finance/payments`, the widget is read-only and shows either the active packet's log or the all-packets log when no packet is selected.
- Outbound finance payment emails now use a lean AP-style body organized into `Payee`, `Payment Instructions`, and `Coding` sections.
- `Payment Instructions` renders as an HTML table with required columns `Payment type`, `Amount`, and `Invoice reference`, plus conditional `Requested payment date` and `Payee reference` columns when those values exist on one or more packet lines.
- The payee section labels the optional line-level `payee_reference` value as `Vendor reference` in the finance email when a single shared value is present across the packet.
- Add endpoint-level detail and UAT script rows in the next documentation pass.
