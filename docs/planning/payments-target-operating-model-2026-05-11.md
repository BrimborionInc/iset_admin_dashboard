# Payments Target Operating Model, 2026-05-11

Purpose: define the agreed business process PATH must support for NWAC's email-based payment workflow. This is the operating-model companion to `docs/planning/payments-transformation-plan-2026-05-11.md`.

## Context

Finance and Sage are the financial system of record. PATH is the ISET operations system for preparing payment requests, sending the known email handoff to Finance, and tracking operations-side follow-up where Finance feedback is unreliable.

PATH should help operations know what they requested, what evidence supported the request, when Finance was emailed, what follow-up has happened, and what operations believes about fulfillment. PATH must not imply that it is authoritative AP/Sage truth.

## Surfaces

Payments has two surfaces over the same packet, line, evidence, communication, follow-up, and reporting data:

- Case Workspace: case-scoped, starts from the selected client/case context.
- Payments dashboard: cross-client queue, filters, and monitoring for all payment packets the user is allowed to access.

The surfaces should differ by scope and navigation context only. They should not encode separate business workflows.

## Target Workflow

1. Operations creates a draft payment packet for a specific payable period, invoice, receipt, or claim cycle against an approved intervention.
2. Operations adds one or more lines with payee, payment type, amount, budget pot, reporting unit, service period or requested date where applicable, and supporting evidence.
3. PATH validates required fields, evidence, funding authorization, duplicate-risk rules, EI restrictions, and configured payment policy.
4. PATH sends the Finance email through one canonical submit transition. This transition records the communication, moves the packet to sent/submitted, locks normal edits, and creates operational committed/requested ledger rows for budget visibility.
5. Operations tracks follow-up after the email handoff. Follow-up states should express operational confidence such as follow-up needed, follow-up logged, reported paid, confirmed by evidence, stale/no response, or cancelled/not proceeding.
6. Reports and case finance views use PATH ledger data as an operational shadow ledger. Widget labels should be concise; help panels should explain the Finance/Sage boundary.
7. Audit evidence is preserved through packet history, line history, evidence links, communication logs, follow-up events, overrides, generated packet artifacts, and audit bundles.

## Safety Rules

- Packet creation is draft-only. Imports or historical data backloads need a deliberate, separately named path.
- The packet status endpoint is the only code path allowed to send the Finance email.
- Direct email endpoints must not bypass validation, status transitions, communication logging, or ledger creation.
- Every Finance email or external accounting handoff must have a committed durable attempt before dispatch. Accepted outcomes must replay without resending; uncertain provider outcomes require review and must never be retried blindly.
- Payment evidence may be unlinked only while the packet is `draft` or `ready_to_send`. Once submitted to Finance, the evidence link is part of the retained payment record. Supporting Documents must protect any document with a payment-record link; staff working on a draft or ready-to-send packet must remove that link in the payment workflow before using Delete in Supporting Documents.
- Payment follow-up evidence must belong to the selected packet's client/case as well as being accessible to the actor.
- The old `Mark paid` behavior must not be used as an operations-side shortcut for unreliable Finance feedback. It should be replaced by explicit follow-up tracking.
- PATH may record operationally reported or evidenced payment fulfillment, but visible copy and help text must avoid presenting that as Sage-confirmed accounting truth unless an actual Sage import/integration proves it.

## Open Design Points

- Final visible names for post-email follow-up states.
- Whether the cross-client dashboard canonical route is `/iset/payments`, `/finance/payments`, or one aliasing the other.
- Whether line `paid` remains an internal status behind follow-up events, or whether fulfillment is represented only by follow-up state plus ledger rows.
- Minimum evidence or note requirements for `reported paid` and `confirmed by evidence`.
- Whether the current maker-checker rule on packet submission fits NWAC operations, or should apply later in a different way.
