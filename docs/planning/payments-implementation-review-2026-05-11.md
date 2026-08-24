# Payments Implementation Review, 2026-05-11

Purpose: capture the current code-backed state of PATH payments and the cleanup risks found during the May 11 review. This note is a handoff for future Codex/payment threads, especially where older experimental payment paths might look like intended behavior.

Transformation planning now lives in `docs/planning/payments-transformation-plan-2026-05-11.md`. Use that plan for the agreed NWAC email-workflow target state, workstreams, and PROD launch preflight notes.

## Current Source-Backed State

- `docs/AGENTS.md` remains the entry point. The current payment access rule is: System Administrator and NWAC Administrator are global; Regional Manager and ISET Coordinator are case-scoped; batch and full-ledger exports are limited to the two administrator roles.
- Agreed business context from the May 11 design conversation: Finance/Sage is the financial system of record. PATH is the ISET operations system for preparing payment requests, sending the finance email handoff, and tracking operations-side follow-up where Finance feedback is unreliable.
- Post-email state in PATH should be treated as operational confidence/follow-up status, not authoritative AP/accounting truth. Keep that distinction in design docs and help guidance; avoid turning normal widgets into warning-heavy explanations.
- The canonical workflow record is `payment_packet`; the ledger-of-record is still `finance_transaction`.
- Approved interventions authorize funding only. They do not create live payment packets or live finance ledger rows.
- Payment packets are created manually for the specific payable period, receipt, invoice, or claim now being sent.
- Agreed target surface model: Payments has two surfaces over the same data and business actions. The Case Workspace is case-scoped; the Payments dashboard is cross-client/multi-case. They should differ by scope, filtering, and queueing context, not by having separate workflows.
- Canonical packet statuses are `draft`, `ready_to_send`, `submitted`, `confirmed`, and `cancelled`.
- Canonical line statuses are `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, and `cancelled`.
- As of the 2026-05-11 two-surface tranche, `/iset/payments` is the cross-client operational dashboard using the shared payment queue, detail, communications, and SLA widgets. `/finance/payments` remains an administrator oversight board pending a later route decision.
- Submitting a packet through `POST /api/finance/payment-packets/:id/status` with `status=submitted` runs policy, funding, duplicate, EI, and evidence gates, then sends externally. External submission routes to email unless runtime config `scope=finance`, `k=intacct.integration`, field `submissionMode` is `intacct_rest`.
- The local WSL DEV database checked on 2026-05-11 has canonical enum definitions for packet, line, and batch statuses. The checked local database had no current packet or line rows, so there were no legacy status values to normalize in data.
- The checked local finance runtime config had `intacct.integration.submissionMode = email`, `enabled = false`, payment evidence rules dated 2026-03-19, and email routing enabled.

## PROD Read-Only Baseline

Checked on 2026-05-11 through the documented `scripts/run-prod-sql-via-ssm.sh` SSM path with aggregate, non-PII SQL only.

- PROD payment workflow tables had no rows: `payment_packet`, `payment_packet_line`, `payment_packet_document`, `payment_packet_communication`, `payment_status_event`, `payment_batch`, `payment_batch_line`, `payment_line_transaction`, `payment_override`, and `linked_payment_transactions` were all empty.
- PROD `finance_transaction` had 2 posted rows, both `metadata.source = manual_backload_history`, totaling `40695.62`. Preserve these as historical PATH ledger rows, not payment-packet workflow rows.
- PROD payment status enums were canonical: packet `draft`, `ready_to_send`, `submitted`, `confirmed`, `cancelled`; line `needs_evidence`, `ready_to_send`, `submitted`, `paid`, `held`, `cancelled`; batch `draft`, `approved`, `exported`, `closed`.
- PROD `finance.email.routing` exists but `enabled = false`; current code suppresses payment emails while that flag remains false.
- PROD route matrix currently allows `/finance/payments` for System Administrator, NWAC Administrator, and Regional Manager. `/iset/payments` and `/cases/:caseId` allow System Administrator, NWAC Administrator, Regional Manager, and ISET Coordinator.

## Evidence Rule Snapshot From Local DEV

Runtime config `finance/payment.evidence.rules` contained:

- Baseline required: `ClientApplicationSigned`, `FundingAgreement`, `CaseManagerAssessment`, `IndigenousIdentity`, `BandFundingConfirmationOrDenial`.
- `LivingAllowance`: `AttendanceReport`.
- `TuitionFeesDirect`: `TuitionStatementOrInvoice`, `AcceptanceLetter`, `FundingAgreement`.
- `TuitionFeesReimbursement`: `PaidReceipt`, `FundingAgreement`.
- `SpecializedEquipmentAdvance`: `InstitutionLetter`, `Quote`, `FundingAgreement`.
- `WageSubsidyEmployer`: `EmployerDutiesLetter`, `EmployerOfferLetterAfterSubsidy`, `FundingAgreement`.

## High-Risk Drift To Resolve

Safety tranche update on 2026-05-11: `SIMPLE_PAYMENT_WORKFLOW` was disabled, direct `send-email` now returns `410 payment_email_endpoint_retired`, packet creation rejects non-draft statuses, line creation rejects non-draft line statuses, the frontend send helper uses the canonical packet status transition, and the old `Mark paid` UI action is hidden pending explicit follow-up modeling. Follow-up tranche update on 2026-05-11: `payment_packet` and `payment_packet_line` now carry current follow-up fields, `payment_followup_event` stores immutable follow-up history, and packet/line follow-up can be logged through the new follow-up API/UI. Two-surface tranche update on 2026-05-11: `/iset/payments` is populated as the operational dashboard, Case Workspace manage-payments includes communications, communications load by selected packet for scoped users, and manual email logging uses a modal instead of one-click placeholder rows. Evidence tranche update on 2026-05-11: manual payment document attach now supports line-scoped evidence and writes `payment_packet_document.payment_packet_line_id` after validating the line belongs to the packet. Reporting/budget semantics tranche update on 2026-05-11: Financial Reports prefer explicit packet follow-up state, report/export paid wording is now `Recorded paid`, and budget/case/homepage finance labels use `Recorded actual` where PATH is only the operational shadow. See `docs/planning/payments-transformation-plan-2026-05-11.md` and `docs/testing/payments-workflow-automation.md`.

1. The first explicit follow-up model is in place. Remaining follow-up refinement: decide the final visible labels, minimum evidence/note rules, and whether line `paid` is fully replaced by follow-up state for operations.
2. `applyPostPayEvidenceHolds()` no longer short-circuits with `SIMPLE_PAYMENT_WORKFLOW` disabled. Re-test this behavior once follow-up/fulfillment semantics are redesigned so post-payment evidence holds do not imply Sage authority.
3. The direct email route is retired, but any callers or docs that still use `/send-email` must be removed or migrated to the canonical packet status transition.
4. Packet creation is now draft-only, but a separately named import/admin path would still be needed if future migration/backload work legitimately has to create non-draft packet history.
5. Line-level payment evidence attach is now implemented. Remaining evidence work is to broaden workflow/API/browser coverage, confirm audit bundle output, and retest evidence gates against line-specific payment types.
6. Recurring-line backend/context paths still exist, while the UI hides the recurring button with `showRecurringLinesButton = false`. Decide to ship, retire, or keep behind an explicit feature flag.
7. The route/header/help labels for the main payment surfaces no longer say "Batch Payments", and the main budget/reporting surfaces now use PATH-recorded wording. The broader user manual and any less-used finance help pages still need a focused pass so email-workflow language, optional batches, and experimental Intacct content do not conflict.
8. Resolved 2026-08-24: PATH has only four sign-in roles. The backend and frontend payment allowlists now use `System Administrator`, `NWAC Administrator`, `Regional Manager`, and `ISET Coordinator`; only the two administrator roles have global/finalization access, while Regional Manager and ISET Coordinator remain case-scoped. Finance remains external to PATH.
9. The `/iset/payments` dashboard is now operational, but `/finance/payments` is still a separate inspection-oriented surface. Decide later whether that route remains useful, aliases the operational dashboard, or is retired.

## Recommended Cleanup Direction

- Make the packet status endpoint the only path that performs external submission.
- Restrict packet creation to `draft` unless a reviewed import/admin exception is added.
- Either retire `SIMPLE_PAYMENT_WORKFLOW` or clearly mark it as a local/demo-only feature flag and keep it disabled outside controlled development.
- Keep payment confirmation/finalization restricted to System Administrator and NWAC Administrator, require proof/reference where the operating model requires it, and preserve actor history.
- Keep line-level evidence as the canonical model for payment-type gates and extend test/browser coverage around it.
- Update route titles, help panels, and user manual copy so "Payment packets", "optional batches", email, and Intacct REST do not conflict.

## Key Files

- `isetadminserver.js`: payment API, access checks, evidence gates, submission, batches, exports.
- `src/pages/finance/widgets/PaymentsDataContext.jsx`: shared frontend payment data service.
- `src/pages/finance/widgets/PaymentRequestsWidget.jsx`: payment packet queue and packet creation UI.
- `src/pages/finance/widgets/PaymentDetailWidget.jsx`: packet detail, validation/send, evidence, mark paid, Intacct preview.
- `src/pages/finance/widgets/PaymentCommunicationWidget.jsx`: shared communications log and manual email logging surface.
- `src/pages/finance/FinancePaymentsPage.jsx`: finance oversight dashboard.
- `src/pages/Caseworking/ProgramPaymentsPage.jsx`: cross-client operational payments dashboard.
- `src/pages/Caseworking/CaseWorkspacePage.jsx`: case workspace payment widgets.
- `src/config/roleMatrix.json`: frontend route access.
- `docs/features/payments-module.md`: canonical design, but verify against this review and current code before treating it as implementation truth.
