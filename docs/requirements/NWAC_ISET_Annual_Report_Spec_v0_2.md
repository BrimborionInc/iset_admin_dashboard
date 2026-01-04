# NWAC Financial Module — ISET Annual Report Function (Data Pack + Certification) Specification
Version: 0.2 (revised after interview)  
Date: 2025-12-31  
Authority: ISET template agreement + Schedules A (CRF) and B (EI) in the provided PDF. fileciteturn2file0

## 0. Design decision summary (based on your answers)
- **One Annual Report package** should cover **both CRF + EI** (because the agreement is a single funding agreement with multiple schedules), **with separate CRF and EI financial annexes/tables** inside the package. Also provide optional “export CRF only / EI only” files for convenience.
- **AOP stays off-system**: the module will not author the AOP. It will (a) export FY actuals for inclusion in the Annual Report, and (b) optionally accept an **AOP planned-budget import** (CSV/XLSX) to compute variances automatically.
- Current system tracks **transactions only**; this module will treat advances/holdbacks/receipts as **optional extensions** (Phase 2) unless you decide to track them for richer reconciliation.
- **Pots are stream-tagged** (CRF or EI). Top-level parent pot is “both” but non-chargeable. Stream derivation is therefore deterministic.
- **Sub-agreement holders exist** and are represented by their own pot subtrees. Roll-ups by sub-agreement holder are required.
- No contracts/procurement objects today: the module will include a lightweight **Annual Report contracting-exception register** (manual entry) to satisfy the disclosure requirement.
- Output language: **English**.

---

## 1. What this module delivers
This module provides:
1) A **preview UI** for Annual Report financial content (tables + drilldowns), and  
2) A versioned **Annual Report Data Pack export** (XLSX/CSV + optional PDF annex), and  
3) Storage for **audited financial statements** and (optionally) the final externally-produced Annual Report PDF, plus  
4) **Designated-official certification metadata** and version locking.

It does **not** attempt to replace NWAC’s narrative/report writing process. It produces the system-derived data elements and a defensible, frozen snapshot.

---

## 2. Compliance requirements supported (from the agreement)
This module exists to support the Annual Report obligations found in Schedules A/B (Annual Reports due within 120 days after FY end; include activities & expenditures for FY; include audited financial statements; certification by designated official; public availability) and the contracting exception disclosure requirement (competitive process exceptions ≥ $25,000 disclosed in Annual Report). fileciteturn2file0

---

## 3. Primary user stories
- As Finance, I can generate the FY Annual Report financial annexes (CRF and EI) from system transactions and pots.
- As Finance, I can export the annex in XLSX/CSV for insertion into NWAC’s Annual Report document.
- As Finance, I can upload audited financial statements and lock the numbers used for the Annual Report.
- As Designated Official, I can certify/sign off on the Annual Report Data Pack version.
- As Program staff, I can review FY spend by intervention and by sub-agreement holder (province/region) to validate completeness.
- As Admin, I can configure pot groupings and reporting-unit mapping rules used in the Annual Report tables.

---

## 4. Core entities and configuration
### 4.1 Fiscal Year
- `fiscal_year_id`
- `start_date`, `end_date`
- `label` (e.g., "2024-2025")
- `annual_report_due_date` = `end_date + 120 days`

### 4.2 Pot (already exists; required fields for reporting)
Each **chargeable pot** must have:
- `pot_id`
- `pot_code`, `pot_name`
- `parent_pot_id`
- `is_chargeable` (bool) — only leaf/chargeable pots may be used on transactions
- `funding_stream` (enum) — **CRF** or **EI** (top-level parent may be BOTH but must be `is_chargeable=false`)
- `reporting_group` (string) — used to roll up multiple pots into a report line
- `reporting_unit` (string) — required for sub-agreement holder roll-ups (e.g., "NWAC National", "Alberta")

### 4.3 Transaction (already exists; required fields for reporting)
- `transaction_id`
- `posting_date`
- `amount` (CAD)
- `description`
- `pot_id` (must be chargeable pot)
- `intervention_id` (nullable but strongly recommended for intervention spending)
- `vendor_name` (optional)
- `evidence_document_ids[]` (0..n)
- `created_at`, `created_by`, `updated_at`, `updated_by`

Derived fields:
- `fiscal_year_id` (by posting_date)
- `funding_stream` (derived from pot.funding_stream)
- `reporting_group` (derived from pot.reporting_group)
- `reporting_unit` (derived from pot.reporting_unit)

### 4.4 Intervention (already exists; required fields for reporting)
- `intervention_id`
- `intervention_code` (NWAC taxonomy)
- `intervention_name`
- Optional: `start_date`, `end_date`, `outcome_category`, `related_NOC`

### 4.5 Annual Report “Data Pack” object (new)
**Entity:** `AnnualReportPack`
- `annual_report_pack_id` (UUID)
- `organization_id`
- `agreement_id`, `agreement_number`
- `fiscal_year_id`
- `status` (Draft | Locked | Certified | Exported | Superseded)
- `version` (integer; increments on each re-lock/re-certify)
- `data_cutoff_at` (timestamp; transactions up to this point included)
- `generated_at`
- `generated_by`
- `certified_by_user_id` (designated official)
- `certified_at`
- `certification_statement_text` (stored verbatim)
- `notes_internal`

### 4.6 Attachments (new)
**Entity:** `AnnualReportPackAttachment`
- `attachment_id`
- `annual_report_pack_id`
- `type` (AuditedFinancialStatements | FinalAnnualReportPDF | ExportXLSX | ExportCSV | AnnexPDF | Other)
- `file_name`, `mime_type`, `file_size`
- `checksum_sha256`
- `uploaded_at`, `uploaded_by`
- `visibility` (Internal | Public)

### 4.7 Contracting exception register (new; manual entry)
**Entity:** `AnnualReportContractingException`
- `annual_report_pack_id`
- `vendor`
- `contract_or_purchase_description`
- `value_excl_tax`
- `competitive_process_used` (bool; default true)
- `exception_rationale` (required if competitive_process_used=false)
- `date`
- `related_transaction_ids[]` (optional)

This satisfies the “include exceptions and rationale in Annual Report” requirement even without a procurement module.

### 4.8 Optional: AOP Planned Budget Import (new, optional but recommended)
**Entity:** `AOPPlannedBudgetImport`
- `fiscal_year_id`
- `source_file_attachment_id`
- `imported_at`, `imported_by`
- Rows:
  - `funding_stream` (CRF/EI)
  - `reporting_group` (must match pot.reporting_group)
  - `planned_amount`

Purpose: enable automatic variance computation without storing the full AOP narrative.

---

## 5. Required Annual Report financial tables (system-derived)
These are the **minimum** financial elements the module must generate from system data for insertion into the Annual Report.

### Table AR-1: Expenditure summary by funding stream
For FY:
- CRF total actual expenditures
- EI total actual expenditures
Optionally include planned/variance if AOP import exists.

Columns:
- Funding Stream | Actual Expenditures | (Planned) | (Variance) | Notes

### Table AR-2: Expenditure by reporting group (pot roll-up)
Group chargeable pots by `pot.reporting_group` (and stream).

Columns:
- Funding Stream | Reporting Group | Actual Expenditures | (Planned) | (Variance)

### Table AR-3: Expenditure by intervention (category)
Group by `intervention_code` or `intervention_name`, and stream.

Columns:
- Funding Stream | Intervention Code | Intervention Name | Actual Expenditures | # Transactions (optional)

### Table AR-4: Expenditure by sub-agreement holder (reporting unit)
Group by `pot.reporting_unit` and stream.

Columns:
- Reporting Unit | Funding Stream | Actual Expenditures | Notes

### Table AR-5: Admin flat-rate summary (non-detailed)
Because admin is flat-rate/exempt, show summary only (no transaction listing required in this module’s outputs).

Columns:
- Funding Stream | Admin Rate (%) | Admin Amount (if tracked or configured) | Method (Configured/Derived) | Note (“Exempt from detailed reporting”)

Implementation options:
- If you track admin as transactions in admin pots: sum those transactions.
- If not: allow configuration of admin budget cap and show that figure.

### Optional Table AR-6: Contracting exceptions (if any)
Pulled from manual register:
- Vendor | Description | Value (excl tax) | Competitive used? | Rationale

---

## 6. Functional requirements (implementation-ready)
### FR-AR-001 Create a Draft Annual Report Data Pack
- Input: fiscal year
- Output: Draft pack with computed tables (AR-1..AR-5) visible in UI.
- Permissions: Finance roles.

### FR-AR-002 Stream derivation and validation
- Every included transaction must map to exactly one stream via pot tag (CRF or EI).
- Transactions posted to non-chargeable pots are rejected by validation (not included).

### FR-AR-003 Sub-agreement roll-up
- System must compute AR-4 using pot.reporting_unit.
- The UI must support drilldown: Reporting Unit → Reporting Group → Transactions.

### FR-AR-004 Optional AOP planned budget import + variance
- If an AOP planned budget import exists for FY, compute:
  - planned/variance at stream level (AR-1) and reporting-group level (AR-2).
- If no import exists, planned/variance columns are suppressed or shown as blank.

### FR-AR-005 Lock (freeze) the Annual Report Data Pack
- “Lock” captures:
  - data_cutoff_at
  - snapshot totals and rowsets
- After lock, underlying transaction edits do not change the locked pack’s values.
- Any correction requires “Create new version” (Draft → Lock → Certify).

### FR-AR-006 Upload audited financial statements (required for certification)
- Attachment type `AuditedFinancialStatements` is required before certification.
- Must support storing checksum + metadata.

### FR-AR-007 Certification by designated official
- Capture:
  - signatory user
  - timestamp
  - certification statement text
- After certification, pack becomes read-only.

### FR-AR-008 Export Annual Report Data Pack
Exports required:
- XLSX (primary) containing tabs: AR-1..AR-5 (+ AR-6 if any)
- CSV option (one per table) for integration workflows
- Optional “Annex PDF” that renders the tables for quick inclusion/printing
Exports must embed: org name, agreement number, FY, version, generated_at, cutoff_at.

### FR-AR-009 Upload final Annual Report PDF (optional)
- Allow attachment `FinalAnnualReportPDF` for record-keeping.
- This supports future audits and internal retrieval.

### FR-AR-010 Contracting exception disclosure workflow
- UI allows:
  - enter zero or more exceptions (manual)
  - explicit “No exceptions” attestation (stored)
- Exceptions are included in exports (AR-6).

### FR-AR-011 Due date reminders (UI)
- Show the FY due date (FY end + 120 days).
- Provide reminders/dashboard flags (configurable) but do not require email automation.

---

## 7. Non-functional requirements
- **Auditability**: immutable audit log for create/lock/certify/export/upload actions.
- **Integrity**: file attachments must store SHA-256 checksum.
- **Performance**: generating tables for a FY should complete within 30 seconds for typical org sizes; support incremental caching.
- **Security**: RBAC; certified packs are immutable; only admins can edit pot reporting groups/units.
- **Export determinism**: same pack version always exports identical totals and rows.
- **English-only output** (current); architecture should not preclude future FR output.

---

## 8. Acceptance tests (high-value)
- Transactions assigned to CRF pots never appear in EI totals and vice versa.
- AR-1 stream totals equal the sum of AR-2 reporting-group totals per stream.
- Roll-up by reporting unit (AR-4) equals stream totals (AR-1) when summed.
- Locking freezes numbers; editing a transaction after lock does not change exports.
- Certification is blocked until audited statements file is attached.
- Export includes agreement number, FY label, version, and cutoff timestamp.

---

## 9. Notes for CODEX implementation strategy
- Treat `AnnualReportPack` as a **snapshot-based report artifact**, not a live view.
- Leverage existing “transactions vs pots” architecture; the main additions are:
  - pot-level `reporting_group` and `reporting_unit`
  - snapshot/versioning + exports
  - audited statements attachment gating + certification record
  - optional AOP planned-budget import

