# Finance Payments Module and Dashboard (NWAC ISET → NWAC Finance)
**Purpose:** Canonical design + requirements spec for the Payments module/dashboard in the admin codebase, supporting **evidence-gated** payments to funded participants and third parties, with a complete audit trail and clean downstream reporting.  
**Audience:** Finance staff, program staff, product owners, engineers, ops, audit/compliance.  
**Last Updated:** 2026-01-03  
**Version:** 2.0 (supersedes prior “hypotheses” draft)

## 0. Sources and authority levels
This spec distinguishes between:
- **MUST (Source-derived)**: directly implied by NWAC training modules / compliant checklist / ISET contribution agreement context.
- **SHOULD (Best practice)**: recommended default behaviour to reduce risk and improve auditability and throughput.
- **MAY (Configurable / later)**: optional capabilities.

Primary sources:
- NWAC ISET Orientation Training Modules 2025–2026 (payments gates, evidence, compliance expectations).
- Compliant File Checklist (baseline documentary requirements for a “pass an audit” client file).
- ISET contribution agreement template + schedules (for stream separation CRF/EI and audit/recordkeeping posture).
- Annual Reporting module spec alignment (Annual Report consumes posted transactions by pots/streams/reporting unit).

## 1. Context (current codebase)
- Finance dashboards exist for budgets; the Payments board exists as a scaffold with mock data in `src/pages/finance/FinancePaymentsPage.jsx`.
- Core finance objects already exist:
  - **Budget pots**: `budget_pot` (funding source/stream), and region tagging via `budget_pot_region`.
  - **Transactions**: `finance_transaction` remains the ledger-of-record for actuals and annual reporting.
  - **Documents**: `iset_document` with upload staging in `pending_uploads`.

## 2. Design stance (updated)
- This module **does not treat requirements as hypotheses** where NWAC training/checklists are explicit.
- The canonical record is the **Payment Packet**, but the ledger-of-record for annual reporting remains `finance_transaction`.
- The module is intentionally “light automation” in release 1, but **hard evidence gates** are enforced to prevent non-compliant payments.

## 3. Goals
- Provide a clear queue of payment requests with complete packet details and evidence.
- Enforce **payment-type-specific documentary prerequisites** (e.g., attendance report required before monthly living allowance payment).
- Support review, approval, batching, and paid/confirmation tracking with a complete audit trail.
- Trace every payment back to case/client, intervention, region/sub-agreement holder, and budget pot.
- Ensure every paid item posts a transaction usable by Annual Reporting (CRF/EI separation; pot rollups).

## 4. Non-goals (initial)
- ERP replacement or full accounting system.
- Automatic bank reconciliation or import-based confirmation.
- Payroll/stat remittance workflows.
- Full procurement lifecycle (RFQs, bids, purchase orders).

## 5. Definitions
- **Payment Packet:** workflow wrapper for one “pay request,” containing one or more Payment Lines, linked to a client/intervention (or operational payment), with evidence and approvals.
- **Payment Line:** one payable unit (e.g., “Living allowance — Feb 2026”, “Tuition invoice #123”, “Books reimbursement”).
- **Batch:** finance grouping of approved payment lines for EFT processing.
- **Confirmation:** proof that payment was executed (EFT confirmation, bank screenshot/reference).
- **Evidence:** supporting documents tied to the packet/line (invoice, attendance report, receipts, approvals, etc.).

## 6. Roles and responsibilities (RBAC)
- **Program requester (Case Manager/Coordinator):** creates packets, attaches evidence, submits.
- **Program approver (Regional manager / Director):** validates eligibility/completeness; approves or returns.
- **Finance reviewer:** checks payee details, duplicates, pot linkage, evidence completeness.
- **Finance approver:** maker-checker for batch approval and high-risk overrides.
- **AP/Ops:** executes EFT and attaches confirmation/proof.
- **Audit/Compliance:** read-only; can export audit bundles.
- **Admin:** configures evidence rules, thresholds, pot mappings, reporting units.

**Segregation of duties (SHOULD):**
- The same user cannot both create and finance-approve/mark-paid the same payment line.
- Overrides to evidence gates require elevated role + logged reason.

## 7. Workflow and statuses
### 7.1 Packet status (canonical)
- **Draft** → **Submitted** → **Program Review** → (**Returned** | **Program Approved**) → **Finance Review** → (**On Hold** | **Finance Approved**) → **Batched** → **Sent** → **Confirmed** → **Closed**
- **Cancelled** is terminal.

### 7.2 Line status (derived)
- **Needs Evidence** | **Ready for Program** | **Ready for Finance** | **Approved** | **Batched** | **Paid** | **Held** | **Cancelled**

### 7.3 Validation gates (MUST)
A packet/line cannot advance to the next stage unless:
- all required fields are present,
- required evidence is attached and verified (where required),
- pot linkage exists for ISET-funded lines,
- amount does not exceed authorized limits (see §10.2),
- required approval threshold is satisfied.

## 8. Core module surfaces (UI)
### 8.1 Program dashboard
- My Drafts / Needs Evidence
- Submitted / In Program Review
- Returned (with reason + checklist)
- Approved (awaiting Finance)

### 8.2 Finance dashboard
- Ready for Finance Review
- Ready for Batching (Finance Approved)
- On Hold (and reason)
- Sent awaiting Confirmation
- Recently Confirmed / Closed

Each row shows:
- client (if applicable), intervention, payment type, amount, stream (CRF/EI), region/reporting unit, pot, requester, ageing, evidence completeness indicator, risk flags.

### 8.3 Payment detail view
- Packet metadata (client/case/intervention, region, stream breakdown)
- Payment lines table
- Evidence checklist (required vs received) per line
- Approvals and audit timeline
- Notes / questions to requester
- Duplicate warnings and override history
- “Generate batch” actions (Finance only)
- “Mark paid / attach confirmation” actions (AP/Ops only)

## 9. Evidence requirements and gates (MUST where specified)
### 9.1 Baseline “client file compliant” gate (MUST for any client-linked payment)
The system must support a baseline compliance checklist (configurable) aligned to the Compliant File Checklist, e.g.:
- Client application (signed/dated)
- EI verification consent + eligibility verification where applicable
- Indigenous identity documents / self-declaration + supporting evidence
- Band funding confirmation or denial
- Letter of acceptance + statement of account (where training is funded)
- Client Funding Agreement (signed)
- Case Manager Assessment
- Required consents/authorizations

Implementation: the dashboard shows **baseline compliance** as a badge and blocks finance approval where baseline is incomplete unless an explicit override is applied with reason.

### 9.2 Living allowance (MUST)
- Must have **Client Monthly Attendance Report** for that month, signed and verified, before payment is processed.
- Backdating is not permitted: system blocks living allowance lines whose service period ends before intervention start or violates configured “no backdating” rule.
- Financial overview + income/expense verification must be present before a living allowance line can be program-approved.

### 9.3 Tuition / training provider (MUST)
- Direct institution payments require statement of tuition/fees or invoice; payee must match institution unless alternate payee letter exists.
- Client reimbursement requires “paid” receipts and must match authorized categories/amounts.

### 9.4 Specialized equipment (MUST)
- Before advance: institution letter stating requirement + quote.
- After advance: receipt required within configurable deadline (default 14 days); missing receipt triggers **hold** and repayment workflow flags.

### 9.5 Targeted Wage Subsidy (TWS) (MUST)
- Employer documents required: duties letter + offer letter after subsidy ends.
- System should store wage/subsidy schedule inputs (hours/day cap, wage rate, MERCs) as structured data or attachments.

### 9.6 General best-practice evidence
- All evidence files stored with checksum and immutable audit trail.
- Evidence must be linkable to both packet and line, and to the posted `finance_transaction` after payment.

## 10. Data model (conceptual) and mapping to current codebase
### 10.1 Conceptual entities
- `PaymentPacket`
- `PaymentPacketLine`
- `PaymentPacketDocument`
- `PaymentStatusEvent` (audit trail)
- `PaymentBatch` (grouping for EFT processing)
- `PayeeProfile` (reference to payee payment details; do not store raw banking details in packet tables)

### 10.2 Required fields
**PaymentPacket**
- id, created_by, status, region/reporting_unit, linked case/client/intervention (nullable), notes
- computed: stream totals (CRF total, EI total), evidence completeness, risk flags, ageing

**PaymentPacketLine**
- payment_type, amount, service_period (required for recurring supports), payee (type + reference),
- `pot_id` (required for ISET-funded lines), derived `funding_stream` (CRF/EI)
- `intervention_id` (required for intervention-linked costs)
- status + hold/return reasons

**PaymentPacketDocument**
- document_id (FK to `iset_document`), evidence_type, required flag, verified_by/at

**PaymentBatch**
- id, created_by, approved_by, status, totals, export artifacts, list of line IDs

### 10.3 Mapping to existing tables
- Pots: `budget_pot`, `budget_pot_region`
- Evidence: `iset_document` + staging `pending_uploads`
- Ledger posting: when a line reaches **Confirmed**, create a `finance_transaction` record (see §11).

## 11. Alignment with Annual Reporting (MUST)
Annual Reporting consumes posted transactions rolled up by stream/pot/reporting unit/intervention.
Therefore:
- **Confirmed Payment Line ⇒ Posted `finance_transaction` exists** with:
  - posting_date (paid date), amount, pot_id, intervention_id (when applicable),
  - derived funding stream,
  - region/reporting unit,
  - evidence_document_ids (attendance report, invoice, receipts, etc.).
- The Payments module must expose an export that matches the Annual Report module’s expected extract fields.

## 12. Validation and risk controls (best practice)
- **Duplicate detection (SHOULD):** warn/block if similar line exists (client, period, type, amount, vendor/invoice).
- **Maker-checker (SHOULD):** batch approval required before “Sent/Confirmed” transitions.
- **Overdue evidence tasks (SHOULD):** e.g., equipment receipt due date triggers hold and dashboard alert.
- **Override registry (MUST):** any override (evidence missing, threshold bypass) must capture reason + approver.

## 13. Reporting and outputs
### 13.1 Operational exports
- Batch EFT sheet export (CSV/XLSX)
- Packet PDF summary (optional) containing metadata + evidence checklist + approvals
- Audit bundle export (zip of packet + evidence + approvals + linked transactions)

### 13.2 Downstream reporting hooks
- Region/PTMA rollups: spent vs outstanding vs queued
- Stream rollups: CRF vs EI totals
- Intervention rollups for program monitoring

## 14. Settings and configuration
- Evidence rule matrix by payment_type and payee_type
- Approval thresholds and escalation routing
- “No backdating” rule parameters
- Receipt deadline settings (default 14 days for equipment advance receipts)
- SLA targets and ageing buckets
- Pot-to-reporting-group mappings (for annual reporting rollups)

## 15. MVP vs later (re-baselined)
### MVP (include compliance-critical features)
- Packet + line creation
- Evidence engine with living allowance/tuition/equipment/TWS hard gates
- Program review + finance review
- Batch creation + export
- Mark paid + attach confirmation
- Auto-create `finance_transaction` on confirmation
- Audit trail and basic duplicate warnings

### Later
- Email send/reply tracking integrations
- Deeper disbursement/payment table chain (`commitment`→`disbursement`→`payment`)
- Automated SLA alerts
- Finance system imports for confirmations

## 16. Open questions (reduced)
- Decide whether “Sent” requires confirmation attached, or confirmation is a separate step (default: separate).
- Decide if some operational/non-program packets can exist without pots (default: yes, but must be flagged and excluded from Annual Reporting exports).

---

## Appendix A — Evidence matrix (starter defaults)
> Admin-configurable; this is a default mapping aligned to training/checklist.

### LivingAllowance
- Required: AttendanceReport (monthly), FinancialOverview, IncomeVerification, ExpenseVerification, FundingAgreement
- Optional: EI status evidence (if applicable)

### TuitionFeesDirect
- Required: TuitionStatementOrInvoice, FundingAgreement, AcceptanceLetter
- Optional: AlternatePayeeLetter

### TuitionFeesReimbursement
- Required: PaidReceipt, FundingAgreement

### SpecializedEquipmentAdvance
- Required: InstitutionLetter, Quote, FundingAgreement
- Post-pay required: ReceiptWithin14Days

### WageSubsidyEmployer (TWS)
- Required: EmployerDutiesLetter, EmployerOfferLetterAfterSubsidy, FundingAgreement
- Optional: WagePlan/MERCs schedule

