# Finance Payments Module and Dashboard (NWAC ISET → NWAC Finance)
**Purpose:** Canonical design + requirements spec for the Payments module/dashboard in the admin codebase, supporting **evidence-gated** payment submissions to Finance (email delivery) with a complete audit trail and clean downstream reporting.  
**Audience:** Finance staff, program staff, product owners, engineers, ops, audit/compliance.  
**Last Updated:** 2026-01-04  
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
- Provide a clear queue of draft and submitted payment packets with complete packet details and evidence.
- Enforce **payment-type-specific documentary prerequisites** (e.g., attendance report required before monthly living allowance payment).
- Submit packets to Finance via email with a complete audit trail of communications.
- Trace every packet back to case/client, intervention, region/sub-agreement holder, and budget pot.
- Preserve clean downstream reporting inputs (CRF/EI separation; pot rollups) while Finance processes payment execution offline.

## 4. Non-goals (initial)
- ERP replacement or full accounting system.
- Automatic bank reconciliation or import-based confirmation.
- Payroll/stat remittance workflows.
- Full procurement lifecycle (RFQs, bids, purchase orders).

## 5. Definitions
- **Payment Packet:** workflow wrapper for one “pay request,” containing one or more Payment Lines, linked to a client/intervention (or operational payment), with evidence.
- **Payment Line:** one payable unit (e.g., “Living allowance — Feb 2026”, “Tuition invoice #123”, “Books reimbursement”).
- **Batch (future):** finance grouping of payment lines for EFT processing.
- **Confirmation (future):** proof that payment was executed (EFT confirmation, bank screenshot/reference).
- **Evidence:** supporting documents tied to the packet/line (invoice, attendance report, receipts, etc.).

## 6. Roles and responsibilities (RBAC)
- **Program requester (Case Manager/Coordinator):** creates packets, attaches evidence, and submits to Finance.
- **Finance (email recipient):** receives the submission email and processes payment externally (no sign-in).
- **Admin:** configures evidence rules, payment-type mappings, and finance email routing.

## 7. Workflow and statuses
### 7.1 Packet status (canonical)
**Draft** -> **Submitted**  
**Cancelled** is terminal.

### 7.2 Line status (derived)
**Needs Evidence** | **Ready to Submit** | **Submitted** | **Cancelled**

### 7.3 Validation gates (MUST)
A packet cannot be submitted unless:
- all required fields are present,
- required evidence is attached (received),
- pot linkage exists for ISET-funded lines,
- amount does not exceed authorized limits (see §10.2),
- payment-type policy rules (e.g., service period rules) are satisfied.

## 8. Core module surfaces (UI)
### 8.1 Program dashboard
- Drafts (needs evidence)
- Submitted to Finance

### 8.2 Finance dashboard
- Finance receives email submissions (no sign-in required).
- Optional: an internal read-only queue showing Draft vs Submitted for staff oversight.

Each row shows:
- client (if applicable), intervention, amount, stream (CRF/EI), region/reporting unit, pot, requester, ageing, evidence completeness indicator, risk flags.

### 8.3 Payment detail view
- Packet metadata (client/case/intervention, region)
- Payment lines table
- Evidence checklist (required vs received) per line
- Notes / internal context
- Duplicate warnings (if detected)
- “Submit to finance” action (emails Finance and locks edits)

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

Implementation: the dashboard shows **baseline compliance** as a badge and blocks submission where baseline is incomplete.

### 9.2 Living allowance (MUST)
- Must have **Client Monthly Attendance Report** for that month received before submission.
- Backdating is not permitted: system blocks living allowance lines whose service period ends before intervention start or violates configured “no backdating” rule.
- Financial overview + income/expense verification must be present before a living allowance line can be submitted.

### 9.3 Tuition / training provider (MUST)
- Direct institution payments require statement of tuition/fees or invoice; payee must match institution unless alternate payee letter exists.
- Client reimbursement requires “paid” receipts and must match authorized categories/amounts.

### 9.4 Specialized equipment (MUST)
- Before advance: institution letter stating requirement + quote.
- After advance: receipt required within configurable deadline (default 14 days); missing receipt is flagged for follow-up (hold workflow is future).

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
- status (needs evidence / ready to submit / submitted / cancelled)

**PaymentPacketDocument**
- document_id (FK to `iset_document`), evidence_type, required flag, received_at

**PaymentBatch (future)**
- id, created_by, status, totals, export artifacts, list of line IDs

### 10.3 Mapping to existing tables
- Pots: `budget_pot`, `budget_pot_region`
- Evidence: `iset_document` + staging `pending_uploads`
- Ledger posting (future): when a line reaches **Confirmed**, create a `finance_transaction` record (see §11).

## 11. Alignment with Annual Reporting (MUST)
Annual Reporting consumes posted transactions rolled up by stream/pot/reporting unit/intervention.
Therefore:
- In the simplified workflow, Finance executes payments outside the admin system and posts transactions through Finance tooling.
- If in-app confirmation is reinstated later, **Confirmed Payment Line ⇒ Posted `finance_transaction` exists** with:
  - posting_date (paid date), amount, pot_id, intervention_id (when applicable),
  - derived funding stream,
  - region/reporting unit,
  - evidence_document_ids (attendance report, invoice, receipts, etc.).
- The Payments module must expose an export that matches the Annual Report module’s expected extract fields when confirmations are enabled.

## 12. Validation and risk controls (best practice)
- **Duplicate detection (SHOULD):** warn if similar line exists (client, period, type, amount, vendor/invoice).
- **Overdue evidence tasks (SHOULD):** e.g., equipment receipt due date triggers dashboard alert.

## 13. Reporting and outputs
### 13.1 Operational exports
- Batch EFT sheet export (CSV/XLSX) — future
- Packet PDF summary (optional) containing metadata + evidence checklist
- Audit bundle export (zip of packet + evidence + linked transactions)

### 13.2 Downstream reporting hooks
- Region/PTMA rollups: spent vs outstanding vs queued
- Stream rollups: CRF vs EI totals
- Intervention rollups for program monitoring

## 14. Settings and configuration
- Evidence rule matrix by payment_type and payee_type
- Finance email routing by reporting unit/region (runtime config)
- “No backdating” rule parameters
- Receipt deadline settings (default 14 days for equipment advance receipts, if follow-ups are tracked)
- SLA targets and ageing buckets
- Pot-to-reporting-group mappings (for annual reporting rollups)

## 15. MVP vs later (re-baselined)
### MVP (include compliance-critical features)
- Packet + line creation
- Evidence engine with living allowance/tuition/equipment/TWS hard gates
- Submit to Finance via email (no sign-in)
- Audit trail and basic duplicate warnings

### Later
- Email send/reply tracking integrations
- Batching and confirmation tracking (if reinstated)
- Auto-post `finance_transaction` on confirmation (future)
- Deeper disbursement/payment table chain (`commitment`→`disbursement`→`payment`)
- Automated SLA alerts
- Finance system imports for confirmations

## 16. Open questions (reduced)
- If confirmations are reinstated later, decide required attachments and posting triggers.
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
