# Finance Packet Email Preview widget

## Workflow

Finance Settings

## Source

- src/pages/finance/widgets/FinancePacketEmailPreviewWidget.jsx

## Primary Route Context

- /finance/settings

## Purpose

Read-only preview of the current finance payment-packet email template.

## Current Notes

- The widget calls `GET /api/config/runtime/finance-packet-email-preview`.
- The endpoint renders sample packet data through the same backend `buildPaymentPacketEmail()` helper used by real packet submissions, so the preview reflects the current production email shape without duplicating template logic in React.
- The sample includes a placeholder `Download packet bundle` link and seven-day expiry wording. It does not generate a signed token, read packet files, or download evidence.
- The Finance Settings board layout storage key is `finance-settings-layout-v3` so the preview appears by default for existing browsers.
