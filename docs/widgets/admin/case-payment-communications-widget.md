# Case Payment Communications widget

## Workflow

Case Management; Payments AP Integrations

## Source

- src/pages/Caseworking/caseWorkspace/widgets/CasePaymentCommunicationWidget.jsx
- src/pages/finance/widgets/PaymentCommunicationWidget.jsx

## Primary Route Context

- /cases/:caseId

## Purpose

Case-scoped communication history for payment packets and manual finance email follow-up logs.

## User Actions (observed)

- Inspect email/communication history for the selected payment packet.
- Log a manual email or finance response with direction, people/email addresses, subject, and notes.
- Use packet selection from the case payment queue/detail widgets to focus the communication log.

## Inputs / Dependencies

- Case-scoped `PaymentsDataProvider` filters.
- Selected payment packet from the shared payments data context.
- `/api/finance/payment-communications?packetId=...` for scoped communication loading.

## Outputs / Side Effects

- Writes `payment_packet_communication` rows for manual payment email logs.
- Updates the shared communication list for the selected packet.

## Current Notes

- Added to the Case Workspace manage-payments layout on 2026-05-11 so the case and cross-client payment surfaces expose the same communication model.
- Manual logging requires an explicit modal save; it no longer creates placeholder `finance@nwac.org` logs from a single button click.
