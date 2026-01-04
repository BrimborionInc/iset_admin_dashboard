# NWAC Financial Module — Payments Dashboard Specification (ISET → NWAC Finance)
Version: 0.1 (initial)  
Date: 2026-01-03  
Primary sources:
- NWAC ISET Orientation Training Modules 2025–2026 (internal training) fileciteturn3file0
- Compliant File Checklist (client/intervention evidence requirements) fileciteturn3file1
- ISET Contribution Agreement template + schedules (governing program context) fileciteturn2file0

Alignment note: This spec is intentionally compatible with the previously delivered **Annual Report Data Pack** spec (`NWAC_ISET_Annual_Report_Spec_v0_2.md`) so that all payments recorded here feed Annual Report tables without rework.

---

## 1) Goal and intent
Build a **Payments Dashboard** and supporting workflows that allow NWAC ISET program staff to **request, validate, approve, and hand off** payments to NWAC Finance, and allow NWAC Finance staff to **review, batch, disburse, and record** payments — with strict evidence gating so that client files can “PASS AN AUDIT” and NWAC can demonstrate payment justification and eligibility. fileciteturn3file0

This module is about **NWAC internal payment operations** (ISET Team → Finance Team), not GoC disbursement.

---

## 2) Scope
### In scope
- Payment request creation from approved interventions (Client Funding Agreement / approved recommendation)
- Evidence gating (document completeness and type-specific prerequisites)
- Multi-stage approval workflow (program → finance)
- Payment batching and handoff artifacts (EFT packet / export)
- “Paid” confirmation recording + supporting remittance proof attachment
- Exceptions: holds, reductions, repayment/recovery tracking
- Sub-agreement holder roll-ups (e.g., Alberta) and regional finance views
- Transaction posting to the system’s financial ledger (“transactions vs pots”) in a way that is compatible with the Annual Report module.

### Out of scope (explicitly)
- Bank integration / direct EFT transmission (assume manual finance execution unless later added)
- Full procurement lifecycle (competitive bids, purchase orders) — but see contracting exception register under Annual Report spec
- Full payroll/wage engine (for TWS/JCP wage computations) — payments module supports evidence, approval, and recording.

---

## 3) Core concepts and definitions
### 3.1 Payment object vocabulary
- **Payment Request**: a proposal to pay money (to client, institution, employer, vendor) for an approved intervention-related eligible cost.
- **Payment Line**: a single payable item (e.g., “Living allowance – Feb 2026”, “Tuition invoice #123”, “Books reimbursement”).
- **Payment Batch**: a set of approved Payment Lines packaged for Finance processing (with exported EFT sheet / packet).
- **Payment Evidence**: documentary support attached to the payment and/or client file (attendance report, invoice, receipts, approvals, etc.).
- **Funding Authorization**: the program approval artifact authorizing the maximum amounts and eligible categories (e.g., Client Funding Agreement). fileciteturn3file0

### 3.2 Payee types (supported)
- Client / Participant
- Educational or training institution
- Employer (e.g., Targeted Wage Subsidy partner)
- Service provider / vendor (e.g., childcare provider)
- Sub-agreement holder (only if the model supports redistributing funds; otherwise sub-agreement holders are a reporting unit, not a payee)

---

## 4) Roles and permissions (RBAC)
### 4.1 Roles
- **Case Manager / Coordinator (Requester)**: creates payment requests, uploads evidence, submits to program approval.
- **Regional ISET Manager (Program Approver)**: reviews completeness and eligibility, approves or returns.
- **NWAC Associate Director / Senior Director (Program Final Approver)**: optional second-level approval for thresholds/high-risk items.
- **Finance Processor**: reviews approved requests, prepares batches, generates EFT forms/exports, marks paid with proof.
- **Finance Approver**: final finance approval for batch (maker-checker).
- **System Admin**: configures evidence rules, thresholds, pot mappings, reporting units, fiscal calendars.
- **Auditor/Read-only**: view-only access with export/audit bundle capability.

### 4.2 Segregation of duties (best practice requirement)
- A user **cannot** both (a) request and (b) finance-approve the same payment line.
- “Mark Paid” permission is restricted to Finance roles.
- Evidence rule overrides require elevated role and leave an audit trail.

---

## 5) Data model (implementation guidance)
> These entities can be implemented as new tables or as extensions to existing transaction/evidence tables.

### 5.1 PaymentRequest (new)
- `payment_request_id` (UUID)
- `client_id` (nullable) *(some payments may be vendor-only but still linked to a client intervention)*
- `intervention_id` (required for ISET intervention payments)
- `requester_user_id`
- `reporting_unit` (derived from pot tree / region; e.g., Alberta)
- `status` (Draft | Submitted | ProgramReview | ProgramApproved | FinanceReview | FinanceApproved | Batched | Paid | Cancelled | OnHold | Returned)
- `created_at`, `updated_at`
- `notes_internal`
- `risk_flags[]` (computed; e.g., missing docs, late receipt, EI status mismatch)

### 5.2 PaymentLine (new)
- `payment_line_id` (UUID)
- `payment_request_id` (FK)
- `payment_type` (enum):
  - LivingAllowance
  - TuitionFeesDirect
  - TuitionFeesReimbursement
  - BooksMaterialsDirect
  - BooksMaterialsReimbursement
  - Childcare
  - Transportation
  - SpecializedEquipmentAdvance
  - SpecializedEquipmentReimbursement
  - WageSubsidyEmployer
  - JCPProjectCost
  - SEBSupport
  - OtherEligibleCost
- `payee_type` (Client | Institution | Employer | Vendor | Other)
- `payee_name`
- `payee_payment_details_ref` *(externalized; e.g., EFT profile ID; do not store raw bank details in this module)*
- `amount`
- `currency` (CAD)
- `service_period_start`, `service_period_end` *(required for recurring supports like living allowance)*
- `invoice_or_reference_number` (optional)
- `requested_payment_date` (optional)
- `pot_id` (required; chargeable child pot)
- `funding_stream` (derived from pot: CRF or EI)
- `sub_agreement_holder_id` (optional)
- `status` (Draft | NeedsEvidence | ReadyForProgramApproval | ReadyForFinance | Batched | Paid | Held | Cancelled)
- `hold_reason` (optional)
- `created_at`, `updated_at`

### 5.3 PaymentEvidenceLink (new)
- `payment_line_id` (FK)
- `document_id` (FK)
- `evidence_type` (AttendanceReport | TuitionStatementOrInvoice | PaidReceipt | EquipmentQuote | EquipmentReceipt | EmployerLetters | EIConsent | EIVerification | BandFundingOrDenial | FinancialOverview | IncomeVerification | ExpenseVerification | FundingAgreement | CaseManagerAssessment | Other)
- `required` (bool)
- `received_at`
- `verified_by_user_id` (optional)
- `verified_at` (optional)

### 5.4 PaymentBatch (new)
- `payment_batch_id`
- `created_by_finance_user_id`
- `created_at`
- `status` (Draft | Approved | Exported | Closed)
- `total_amount`
- `payment_line_ids[]`
- `export_artifact_ids[]` (EFT sheet, CSV, PDF packet)
- `approved_by_finance_user_id`, `approved_at`

### 5.5 PostedTransaction linkage (align with Annual Report module)
Each **Paid** PaymentLine must result in one **posted transaction** in the financial ledger, with:
- `transaction_id`
- `posting_date` = paid date (or accounting posting date)
- `amount`
- `pot_id`
- `intervention_id`
- `evidence_document_ids[]` (links to supporting docs)
- `vendor/payee` metadata (as available)

This preserves compatibility with Annual Report exports that roll up by stream, pot reporting group, intervention, and reporting unit.

---

## 6) Evidence gating rules (source-driven + best practice)
### 6.1 Global “file must be compliant” gate (recommended)
Before any payment line can reach FinanceApproved, the system must confirm that a minimum compliant set exists in the client file / request package, including:
- Signed client application
- EI verification consent + verification (where applicable)
- Indigenous self-declaration and/or identity documentation
- Band funding confirmation/denial
- Letter of acceptance + statement of account (for training)
- Client Funding Agreement (signed)
- Case Manager assessment/recommendation
- Any consents required
(See Compliant File Checklist) fileciteturn3file1

**Implementation**: treat this as a configurable baseline checklist with per-payment-type additions below.

### 6.2 Living Allowance — monthly payment gate (explicit)
Rule: A living allowance payment **must not be processed** until:
- A **Client Monthly Attendance Report** exists for that month,
- It is signed by the client and verified by coordinator,
- It is attached to the EFT payment packet for that month. fileciteturn3file0

Additional rules from training (encode as validations):
- Living allowance is “needs basis” and cannot be back-dated; retroactive payments are not permissible. fileciteturn3file0
- EI active claimant is not eligible for living allowance until the EI claim is completed (requires EI status check input from NWAC process). fileciteturn3file0
- Financial Overview and income/expense verification required before recommending living allowance. fileciteturn3file0turn3file1

### 6.3 Tuition / training provider direct payment gate (explicit)
Before paying an institution/provider:
- Statement of tuition/fees or invoice must be present and include student number where applicable. fileciteturn3file0
- Amount must match the approved Client Funding Agreement.
- Payee must be the institution/provider unless alternate payee terms letter is provided. fileciteturn3file0

### 6.4 Reimbursements to client gate (explicit)
Reimbursement to client requires:
- Original “paid” receipts for the approved eligible costs,
- Match to Client Funding Agreement line items. fileciteturn3file0

### 6.5 Specialized equipment / computer advance gate (explicit)
Before advancing funds:
- Letter from institution stating specific equipment is required,
- Quote is attached; quotes over configured threshold require prior NWAC approval,
After advancing:
- Receipt must be provided within **2 weeks**; if not, the account enters repayment/hold and future payments may be reduced until receipt is received. fileciteturn3file0

### 6.6 Targeted Wage Subsidy (TWS) employer payment gate (explicit)
Cannot proceed without employer documents:
- Letter stating duties,
- Letter of offer after TWS period (commitment). fileciteturn3file0
Best-practice additions:
- Employer plan details and subsidy schedule (hours/day cap, wage rate, MERCs) stored as structured fields or attachments.
- Payment periods must match approved subsidy timeline; prevent payments outside authorized period.

### 6.7 Sub-agreement holder roll-up controls (best practice)
Where sub-agreement holders have their own pot subtrees:
- Payment requests must carry `reporting_unit` and roll up automatically.
- Finance dashboard must show totals and outstanding items by reporting unit (e.g., Alberta).

---

## 7) Payment workflow (end-to-end)
### 7.1 Standard workflow states
1) Draft request (Requester)
2) Submit for program review
3) Program review (check evidence, eligibility, amounts vs funding agreement)
4) Program approved → Finance review queue
5) Finance review (check payee details, batch readiness, duplicates, policy gates)
6) Finance approves line(s)
7) Batch creation and export (EFT packet)
8) Finance marks paid + attaches proof
9) System posts ledger transaction(s)

### 7.2 Returns and holds
- Any reviewer can “Return” with required fixes; system must preserve comments and missing evidence list.
- Holds: Finance can place a line “On Hold” with reason (e.g., missing receipt, suspected duplicate, exceeded budget).

---

## 8) Payments Dashboard (UI functional requirements)
### 8.1 Finance dashboard views (required)
- Queue: **Ready for Finance Review**
- Queue: **Ready for Batching**
- Queue: **On Hold**
- Queue: **Paid (recent)**
- Filters: fiscal year, reporting unit, funding stream, payment type, status, requester, client, intervention

Each row shows:
- client (if applicable), intervention, payment type, amount, stream, reporting unit, requested date, evidence completeness indicator, risk flags, status.

### 8.2 Program dashboard views (required)
- Queue: Drafts needing completion
- Queue: Submitted for approval
- Queue: Returned items
- Missing evidence checklist per request
- Ability to upload evidence quickly and re-submit

### 8.3 Drilldowns (required)
From any payment line:
- Evidence checklist (required vs received)
- Funding authorization (Client Funding Agreement) line item limits
- Related transactions already paid (duplicate detection)
- Budget remaining in pot (optional)
- Audit log for the payment line (who did what when)

### 8.4 Batch UI (required)
- Create batch from selected finance-approved lines
- Batch totals by funding stream and reporting unit
- Export artifacts:
  - EFT sheet (CSV/XLSX)
  - PDF “EFT packet” (optional) that includes required evidence summaries/links
- Maker-checker: batch requires finance approval before “Mark Paid” actions are enabled

---

## 9) Functional requirements (implementation-ready)
### FR-PAY-001 Evidence rule engine
- System evaluates required evidence for a PaymentLine based on payment_type.
- Produces: `missing_evidence[]` and `ready_state`.
- Rule sets are configurable (admin UI), but defaults ship as per training/checklist.

### FR-PAY-002 Prevent payment outside authorization
- PaymentLine amounts and categories must not exceed approved funding agreement allocations (per intervention).
- System must support partial payments and running “remaining authorized amount” tracking.

### FR-PAY-003 Recurring payment scheduler (living allowance, childcare, etc.)
- For recurring supports, system can generate “expected payment lines” per month/period, but keeps them in NeedsEvidence until required proof is attached.
- Hard rule: prevent back-dated living allowance payment lines beyond configurable grace window; default “no back-dating” enforced. fileciteturn3file0

### FR-PAY-004 Duplicate payment detection (best practice)
- Warn/block if a new payment line matches a previously paid one by (client, intervention, type, service period, amount, vendor/invoice).
- Provide override with reason and audit trail.

### FR-PAY-005 Receipt follow-up enforcement (equipment advances)
- When payment_type=SpecializedEquipmentAdvance, system auto-creates a “receipt due” task (default 14 days).
- If overdue:
  - flag client/payment as OnHold for future discretionary payments,
  - show in dashboard risk queue. fileciteturn3file0

### FR-PAY-006 Mark paid + post transaction
- Only Finance roles can mark paid.
- Marking paid requires:
  - paid date,
  - payment reference,
  - optional proof attachment.
- System then creates the ledger transaction linked to pot/intervention/evidence.

### FR-PAY-007 Reporting unit roll-ups
- All dashboards and exports can roll up by reporting unit (e.g., province/territory), matching the pot subtree model.

### FR-PAY-008 Export for Annual Report compatibility
- Export “FY payment ledger extract” that matches Annual Report module assumptions:
  - transaction_id, posting_date, amount, pot_id, funding_stream, intervention_id, reporting_unit, evidence doc IDs.

### FR-PAY-009 Audit bundle export (best practice)
- For any payment line or client intervention, export a zipped bundle:
  - payment record
  - evidence docs
  - approvals log
  - linked ledger transaction(s)

---

## 10) Non-functional requirements
- **NFR-PAY-001 Security/RBAC**: least privilege; role boundaries; no raw bank data stored in app DB.
- **NFR-PAY-002 Auditability**: immutable audit log for create/edit/approve/return/hold/batch/export/paid actions.
- **NFR-PAY-003 Integrity**: file checksums for evidence and batch exports.
- **NFR-PAY-004 Privacy**: client PII access limited; downloads logged; secure storage.
- **NFR-PAY-005 Availability**: payment workflows must be resilient; avoid partial state updates.
- **NFR-PAY-006 Performance**: dashboard list operations should return within 2–3 seconds for typical loads; batch exports within 30 seconds.
- **NFR-PAY-007 Accessibility**: keyboard navigable tables; screen-reader friendly labels for status/evidence indicators.
- **NFR-PAY-008 Retention**: evidence and payment records retained per NWAC policy; support legal holds and audit needs. (Minimum should meet program audit expectations.) fileciteturn3file0

---

## 11) Acceptance criteria (high-value)
- Living allowance cannot be marked FinanceApproved unless monthly attendance report is attached and verified. fileciteturn3file0
- Tuition direct pay cannot be FinanceApproved without statement/invoice and correct payee, and amount ≤ funding agreement. fileciteturn3file0
- Client reimbursement cannot be FinanceApproved without paid receipts. fileciteturn3file0
- Equipment advances create receipt-due task and enforce hold/reduction behavior when overdue. fileciteturn3file0
- Marking paid creates a posted transaction that is included correctly in Annual Report exports (stream, pot roll-ups, reporting unit).
- Duplicate payment attempts are flagged and require explicit override + reason.
- Audit bundle export contains all evidence and approval history for a sampled payment line.

---

## 12) Open items / configuration decisions (for NWAC)
These are intentionally left configurable; CODEX can implement defaults.
- Approval thresholds (e.g., > $650 equipment quote needs extra approval; define the threshold as config) fileciteturn3file0
- Whether Finance must see full client file or only payment-linked evidence
- Whether “expected recurring payments” should auto-generate or be manual
- Whether sub-agreement holders can be payees vs only reporting units
- Whether to integrate with existing “Active Client Spreadsheet” reporting or replace it over time fileciteturn3file0


---

## 13) Build alignment and gaps (current implementation)
This section documents how the current admin-dashboard build aligns with this spec and where gaps remain.

### 13.1 Scope alignment
In-scope items:
- Payment request creation from approved interventions: PARTIAL. Payment packets exist, but creation is not yet wired to the case/action plan workflow UI.
- Evidence gating: PARTIAL. Required evidence can block status changes, but rules are not auto-generated per payment type.
- Multi-stage approval workflow: PARTIAL. Statuses and approval fields exist; role-based separation is not enforced.
- Payment batching and handoff artifacts: PARTIAL. Batch tables and endpoints exist; no batch UI or exports yet.
- Paid confirmation recording + proof attachment: PARTIAL. Confirmed status exists; proof attachment UI is not wired.
- Exceptions (holds/returns/recovery): PARTIAL. On-hold and return statuses exist; recovery workflows are not implemented.
- Sub-agreement holder roll-ups / regional finance views: GAP. Reporting unit is stored but no rollup views.
- Ledger posting for Annual Report compatibility: PARTIAL. Transactions post on confirmation; evidence doc IDs and export are not implemented.

Out-of-scope items remain out-of-scope (bank integration, procurement lifecycle, payroll engine).

### 13.2 Roles and permissions (RBAC)
- Role support: PARTIAL. Payments endpoints are gated by a broad allowlist (System Admin, Program Admin, Regional Coordinator, Application Assessor). Dedicated Finance Processor/Approver roles are not enforced.
- Segregation of duties: GAP. No guardrails prevent requester = finance approver on the same line.
- Mark paid restriction: GAP. Status updates are not restricted to finance roles.

### 13.3 Data model mapping
- PaymentRequest -> `payment_packet` table (numeric ID, status, reporting_unit, notes, risk_flags, approvals, timestamps).
- PaymentLine -> `payment_packet_line` (payment_type, payee fields, service period, pot, funding_stream, status).
- PaymentEvidenceLink -> `payment_packet_document` (evidence_type, required flag, received/verified timestamps).
- PaymentBatch -> `payment_batch` + `payment_batch_line` (status, totals, approvals).
- PostedTransaction linkage -> `payment_line_transaction` plus `finance_transaction` created on confirmation.
- Payee types: stored in `payee_type` as free-form text; not enforced against the spec list.
- Reporting unit: stored on the packet but not auto-derived from pot tree or region.

Gaps: UUIDs are not used; finance_transaction does not store evidence document IDs or payee metadata.

### 13.4 Evidence gating rules
- Baseline compliance gate: PARTIAL. Packet-level evidence can be marked required, but there is no default checklist or rule engine.
- Living allowance (attendance, EI status, no backdating): GAP.
- Tuition / reimbursements / equipment / TWS payment-type gates: GAP.
- Receipt due tasks and automatic holds: GAP.

### 13.5 Workflow and status handling
- Packet and line statuses: IMPLEMENTED (status enums, transitions, audit events).
- Returns and holds: PARTIAL (status + hold_reason exist; no structured reason workflows).
- Maker-checker batch approval: GAP.

### 13.6 UI requirements
Finance dashboard:
- Queue and detail widgets: IMPLEMENTED (queue, detail, communications, SLA snapshot).
- Required queues: PARTIAL (status filter available; dedicated queue widgets not split out).
- Filters: GAP (no fiscal year / reporting unit / stream filters beyond free-text search).
- Row fields: PARTIAL (client, intervention, amount, stream, reporting unit, evidence, risk flags, status present; requested date missing).
- Communications log: IMPLEMENTED (automatic email send log + manual log entries).

Program dashboard:
- Queues for drafts/submitted/returned: GAP.
- Evidence upload and resubmission: GAP.

Drilldowns:
- Evidence checklist: IMPLEMENTED.
- Funding authorization limit checks: GAP.
- Duplicate detection view: GAP.
- Budget remaining in pot: GAP.
- Audit log per line: PARTIAL (status timeline exists; no full action log view).

Batch UI:
- Batch creation and approval UI: GAP.
- Export artifacts (CSV/XLSX/PDF): GAP.

### 13.7 Functional requirements mapping
- FR-PAY-001 Evidence rule engine: PARTIAL. Required evidence blocks progression, but rules are manual, not payment-type driven.
- FR-PAY-002 Prevent payment outside authorization: GAP.
- FR-PAY-003 Recurring payment scheduler: GAP.
- FR-PAY-004 Duplicate payment detection: GAP.
- FR-PAY-005 Receipt follow-up enforcement: GAP.
- FR-PAY-006 Mark paid + post transaction: PARTIAL. Confirmation posts transactions; paid date/reference/proof fields and finance-only role gates are missing.
- FR-PAY-007 Reporting unit roll-ups: GAP.
- FR-PAY-008 Annual Report export compatibility: GAP (no export; missing evidence doc IDs on transactions).
- FR-PAY-009 Audit bundle export: GAP.

### 13.8 Non-functional requirements mapping
- NFR-PAY-001 Security/RBAC: PARTIAL. Payments endpoints are gated but not by finance-specific roles.
- NFR-PAY-002 Auditability: PARTIAL. Status events and communications are logged; no immutable audit bundle export.
- NFR-PAY-003 Integrity: PARTIAL. Evidence documents use checksums; batch/export artifacts are not implemented.
- NFR-PAY-004 Privacy: PARTIAL. No download logging for evidence in payments flow.
- NFR-PAY-005 Availability: PARTIAL. Transactional DB writes are used; no retry/outbox model for email.
- NFR-PAY-006 Performance: UNVERIFIED.
- NFR-PAY-007 Accessibility: UNVERIFIED (Cloudscape components used).
- NFR-PAY-008 Retention: GAP (no retention or legal hold rules implemented).

### 13.9 Acceptance criteria mapping
- Living allowance evidence gate: GAP.
- Tuition direct pay gate: GAP.
- Client reimbursement gate: GAP.
- Equipment advance receipt follow-up: GAP.
- Marking paid posts transactions for Annual Report: PARTIAL (posting exists; exports and evidence doc IDs are missing).
- Duplicate payment override with reason: GAP.
- Audit bundle export: GAP.

---

## 14) Prioritized delivery plan (based on gaps)
This plan orders work by compliance risk, audit impact, and operational enablement.

### Phase 0: Compliance-critical foundations (release blocker)
- Enforce finance-specific RBAC and segregation of duties for approve/mark paid actions.
- Implement evidence rule engine with default baseline checklist + payment-type gates (living allowance, tuition, reimbursement, equipment, TWS).
- Add paid date/reference/proof fields and require them when marking paid/confirmed.
- Persist evidence document IDs and payee metadata into `finance_transaction` or a linked table.
- Derive reporting unit consistently (from case region/pot tree) and enforce required fields.

### Phase 1: Operational finance enablement
- Program dashboard queues for drafts/submitted/returned with evidence upload/resubmission.
- Finance queue filters: reporting unit, funding stream, fiscal year, payment type, requester.
- Batch UI: create batch from finance-approved lines, maker-checker approval, status locks.
- Batch exports: EFT CSV/XLSX and optional PDF packet summary.
- Duplicate payment detection with override reason logging.

### Phase 2: Audit readiness and reporting
- Receipt follow-up tasks and automated holds for equipment advances.
- Full audit log view per packet/line (beyond status timeline).
- Audit bundle export (packet + evidence + approvals + linked transactions).
- Annual Report extract export (transaction_id, posting_date, amount, pot_id, stream, intervention_id, reporting_unit, evidence IDs).

### Phase 3: Automation and resilience
- Recurring payment scheduler (living allowance/childcare) with evidence gating.
- SLA alerts and escalation rules based on ageing/overdue evidence.
- Download logging and retention/legal hold controls.
- Performance tuning and load testing for large queues and exports.
