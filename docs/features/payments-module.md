# Finance Payments Module and Dashboard

**Purpose:** Canonical design and planning for the Payments module/dashboard, aligned to `docs/requirements/payments-module.v2.md`.  
**Audience:** PATH program staff, product owners, engineers, operations, audit/compliance, and external Finance stakeholders.
**Status:** partially deployed/current-source capability; real Finance email routing/sends are not rolled out or enabled in PROD.
**Last Updated:** 2026-08-21

Current implementation review: `docs/planning/payments-implementation-review-2026-05-11.md`. Current target operating model: `docs/planning/payments-target-operating-model-2026-05-11.md`. Current transformation plan for the NWAC email workflow: `docs/planning/payments-transformation-plan-2026-05-11.md`.

## Sources and authority levels
- **MUST (source-derived):** From NWAC training modules, compliant checklist, and ISET agreement context.
- **SHOULD (best practice):** Recommended defaults to reduce audit and operational risk.
- **MAY (configurable/later):** Optional capabilities not required for initial compliance.

## Context (current codebase)
- The cross-client operational Payments dashboard is implemented and has admin deployment history at `/iset/payments` in `src/pages/Caseworking/ProgramPaymentsPage.jsx` with queue, detail, communications, and SLA widgets. `/finance/payments` remains an administrator oversight surface using the same shared widget family. Route deployment does not mean the real Finance email workflow is enabled.
- Core finance objects already exist: `budget_pot`, `budget_pot_region`, `finance_transaction`, `iset_document`, `pending_uploads`.
- The Payments module is internal to NWAC (ISET team to Finance team), not GoC disbursement.
- Finance/Sage is the financial system of record. PATH is the ISET operations system designed to prepare, evidence, and track payment requests across the email handoff gap; real PROD Finance email sends remain disabled pending a deliberate rollout.
- Finance reporting back to operations after AP fulfillment is erratic, so PATH must support operational follow-up and confidence tracking without pretending to be authoritative accounting truth.
- Payments are exposed through two operational surfaces over the same data and business capabilities: a case-scoped surface in the Case Workspace and the multi-client `/iset/payments` dashboard. The difference is scope and queueing context, not a separate workflow model.

## Design stance (updated)
- Requirements explicitly stated in training/checklists are not treated as hypotheses.
- The **Payment Packet** is the canonical workflow record.
- The PATH-side ledger/reporting model is an operational shadow of ISET payment request activity. It supports budget awareness, case finance views, follow-up, and reporting caveats, but Sage/Finance remains the financial record.
- Approved interventions authorize future funding but do not auto-create live payment packets.
- Multiple packets may exist for one intervention over time; recurring supports should be packeted by the payable period or receipt cycle.
- Release 1 favors compliance gates and auditability over automation.
- After email submission, PATH should track operational confidence states such as sent, follow-up needed, reported paid, confirmed by evidence, or stale/no response. Do not over-label normal widgets with accounting disclaimers; keep nuance in help panels and workflow guidance unless a user action creates genuine risk.
- Current implementation now stores follow-up state on packets and lines, with immutable `payment_followup_event` history. Financial Reports prefer that explicit follow-up state before falling back to submitted/posted PATH finance transactions. Treat this as operations-side follow-up/confidence tracking, not Sage/AP confirmation.
- Payment evidence now uses line-level links where the checklist row is line-scoped; `payment_packet_document.payment_packet_line_id` is populated by manual link/upload flows and validation uses baseline plus line evidence for payment-type gates.

## Goals
- Evidence-gated payment workflow that can pass audit.
- Clear packet-first claims workflow with full audit trail from draft through finance handoff and payment confirmation.
- Traceability to case/client, intervention, reporting unit, and pot.
- Posted transactions compatible with Annual Report rollups (CRF/EI separation).

## Non-goals (initial)
- ERP replacement or bank integrations.
- Payroll/stat remittance workflows.
- Full procurement lifecycle (RFQs, bids, purchase orders).

## Definitions
- **Payment Packet:** Workflow wrapper for a pay request, containing one or more payment lines plus evidence and approvals.
- **Payment Line:** One payable unit (e.g., living allowance for a month, tuition invoice).
- **Batch:** Finance grouping of approved payment lines for EFT processing.
- **Confirmation:** Proof that payment was executed (EFT confirmation, bank reference).
- **Evidence:** Supporting documents tied to packet/line (invoice, attendance report, receipts).

## Roles and permissions (RBAC)
- **ISET Coordinator / Regional Manager:** Work with packets and evidence within normal case scope.
- **System Administrator / NWAC Administrator:** Have global payment administration and can use restricted finalization, batch, export, and configuration actions.
- **Finance:** Receives the handoff and works outside PATH; Finance does not sign in.

Segregation of duties (SHOULD):
- Sensitive overrides and finalization should use the two administrator roles, a logged reason, and actor history.

## Workflow and statuses
Packet status (canonical):
- Draft → Ready to send → Sent to finance → Payment confirmed
- Cancelled is terminal.

Line status (derived):
- Needs evidence | Ready to send | Sent to finance | Paid | Held | Cancelled

Validation gates (MUST):
- Required fields present.
- Required evidence attached and verified.
- Pot linkage for ISET-funded lines.
- Amounts within authorized limits.
- Required approvals satisfied.

## Evidence requirements and gates (MUST where specified)
Baseline client file compliance (MUST for client-linked payments):
- Signed client application.
- EI verification consent + eligibility verification where applicable.
- Indigenous identity/self-declaration documentation.
- Band funding confirmation/denial.
- Letter of acceptance + statement of account (where training is funded).
- Client Funding Agreement (signed).
- Case manager assessment.
- Required consents/authorizations.

Payment-type gates (minimum):
- **Living allowance (MUST):** Monthly attendance report signed/verified; submission must fall within the configured backdating window (default `60` days from service period end); financial overview + income/expense verification before program approval.
- **Tuition provider (MUST):** Statement/invoice required; payee must match institution unless alternate-payee letter exists.
- **Reimbursements (MUST):** Paid receipts required and aligned to authorization.
- **Specialized equipment (MUST):** Institution letter + quote before advance; receipt within configured deadline (default 14 days) or hold/recovery.
- **TWS employer (MUST):** Employer duties letter + offer letter after subsidy; payment confined to approved period.

## Data model (conceptual) and mapping
Conceptual entities:
- `PaymentPacket`
- `PaymentPacketLine`
- `PaymentPacketDocument`
- `PaymentStatusEvent` (audit trail)
- `PaymentBatch`
- `PayeeProfile` (reference only; no raw banking details stored)

Required fields (summary):
- **Packet:** id, created_by, status, reporting_unit, linked case/client/intervention (nullable), notes, computed stream totals, evidence completeness, risk flags, ageing.
- **Line:** payment_type, amount, service_period (recurring supports), payee reference, `pot_id` (required for ISET-funded lines), derived `funding_stream`, `intervention_id` (for intervention-linked costs), status, hold/return reasons.
- **Document:** `document_id` (FK to `iset_document`), evidence_type, required flag, verified_by/at.
- **Batch:** id, created_by, approved_by, status, totals, export artifacts, line IDs.

Mapping anchors:
- Pots: `budget_pot`, `budget_pot_region`
- Evidence: `iset_document` + `pending_uploads`
- Ledger posting: `finance_transaction` on confirmation

## Alignment with Annual Reporting (MUST)
Confirmed payment line must produce a posted `finance_transaction` with:
- posting_date (paid date), amount, pot_id, intervention_id (when applicable)
- derived funding stream and reporting_unit
- evidence_document_ids linked to the payment line

## Validation and risk controls
- **Duplicate detection (SHOULD):** warn/block similar lines with override reason.
- **Maker-checker (SHOULD):** batch approval required before Sent/Confirmed.
- **Overdue evidence tasks (SHOULD):** auto-create receipt-due tasks and flag holds.
- **Override registry (MUST):** record reason + approver for any gate bypass.

## Dashboard requirements (functional)
Program dashboard:
- Drafts / Needs Evidence, Ready to send, Sent to finance.

Administrator oversight dashboard:
- Drafts needing evidence, Sent to finance, Payment confirmed, overdue evidence tasks.

The case-scoped payment widgets and the cross-client Payments dashboard should show the same packet/line/payment-follow-up data and support the same core business actions where role/scope allows. The dashboard adds aggregate filtering, queueing, and cross-client monitoring; the case workspace adds local case context.

Row fields:
- client (if applicable), intervention, payment type, amount, stream (CRF/EI), reporting unit, pot, requester, ageing, evidence completeness, risk flags, status.

Payment detail view:
- Packet metadata (client/case/intervention, region, stream totals).
- Payment lines table.
- Evidence checklist per line (required vs received).
- Approvals and audit timeline.
- Notes/questions to requester.
- Duplicate warnings + override history.
- Batch actions (System Administrator / NWAC Administrator only).
- Record PATH follow-up and attach confirmation evidence through the restricted administrator workflow; this does not make PATH the accounting authority.

Batch UI:
- Optional internal grouping of already-submitted lines.
- Totals by stream and reporting unit.
- Export artifacts: EFT sheet (CSV/XLSX) and optional PDF packet.

## Reporting and outputs
- Batch EFT export (CSV/XLSX).
- Packet PDF summary (optional).
- Audit bundle export (packet + evidence + approvals + linked transactions).
- FY ledger extract aligned to Annual Report inputs.

## Settings and configuration
- Evidence rule matrix by payment_type and payee_type.
- Approval thresholds and escalation routing.
- No-backdating rule parameters.
- Receipt deadline settings (default 14 days for equipment advances).
- SLA targets and ageing buckets.
- Pot-to-reporting-group mappings for annual reporting rollups.

## MVP vs later (re-baselined)
MVP (compliance-critical):
- Packet + line creation.
- Evidence engine with living allowance/tuition/equipment/TWS hard gates.
- Validate, auto-mark ready, and send to finance.
- Mark paid / confirm payment in PATH.
- Auto-create `finance_transaction` on confirmation.
- Audit trail and basic duplicate warnings.

Later:
- Optional batch exports and finance-side grouping workflows.
- Email send/reply tracking integrations.
- Deeper disbursement/payment chain (`commitment` → `disbursement` → `payment`).
- Automated SLA alerts.
- Finance system imports for confirmations.

## Open questions
- Does "Sent" require confirmation attached, or is confirmation a separate step (default: separate)?
- Can operational/non-program packets exist without pots (default: yes, flagged and excluded from Annual Reporting exports)?

## Sources consolidated
- `docs/requirements/payments-module.v2.md`
- `docs/change-requests/CR-0003-Addendum-Finance-Payments-and-Reporting.md`
- `docs/change-requests/CR-0003-Addendum-Plan.md`
- `docs/planning/finance-workflow-map.md`
- `docs/planning/finance-enable-tracker.md`
- `docs/data/case-finance-data-architecture.md`
- `docs/features/document-signing.md`
- `docs/change-requests/CR-0003-Implementation-Log.md`
