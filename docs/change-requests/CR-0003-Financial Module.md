# ISET Financial Administration & Reporting Module
*Functional Requirements Specification (Draft 1)*

## Document Metadata
| Field | Value |
|:-|:-|
| Version | 0.9 |
| Date | 2025-10-18 |
| Author | Bill Sillery / Awentech Ltd. |
| Target Consumers | CODEX LLM (iset_admin_dashboard) and delivery team |

## Table of Contents
- [1. Purpose and Scope](#1-purpose-and-scope)
- [2. References](#2-references)
- [3. Solution Overview](#3-solution-overview)
- [4. Functional Requirements](#4-functional-requirements)
- [5. Non-Functional Requirements](#5-non-functional-requirements)
- [6. System Interfaces](#6-system-interfaces)
- [7. Reporting Workflow](#7-reporting-workflow)
- [8. Future Enhancements](#8-future-enhancements)
- [9. Guidance for CODEX Implementation](#9-guidance-for-codex-implementation)
- [10. UI/UX Requirements – ISET Financial Management (Draft v0.2)](#10-uiux-requirements--iset-financial-management-draft-v02)
- [20. Forecasting & Scenario Management (Draft v0.1)](#20-forecasting--scenario-management-draft-v01)
- [Appendix A. Data Dictionary & XML Mapping](#appendix-a-data-dictionary--xml-mapping)
- [Appendix B. Eligible Expenditure Rules](#appendix-b-eligible-expenditure-rules)
- [Appendix C. Capacity Tier Model](#appendix-c-capacity-tier-model)
- [Appendix D. Administrative Flat-Rate Formula](#appendix-d-administrative-flat-rate-formula)

---

## 1. Purpose and Scope
This module enables Indigenous Skills & Employment Training (ISET) agreement holders to record, validate, and report financial data in compliance with Employment and Social Development Canada (ESDC) program and contribution-agreement requirements. It covers:
- Financial transaction capture, categorization, and evidence management
- Budget vs. expenditure tracking (eligible, ineligible, administration)
- Sub-agreement management and roll-up
- Interim and year-end financial reports
- Capacity-based monitoring controls
- XML and CSV export envelopes for ESDC submission

## 2. References
| Ref | Title / Source | Notes |
|:-|:-|:-|
| [1] | **ESDC – Indigenous Skills and Employment Training Program (First Nations Terms & Conditions)** ([canada.ca](https://www.canada.ca/en/employment-social-development/programs/indigenous-skills-employment-training/first-nations-terms-conditions.html)) | Defines contribution-agreement obligations including financial reporting |
| [2] | **House of Commons PACP Report: ESDC Action Plan – ISET Program Monitoring** ([ourcommons.ca Rpt06 Annex A3](https://www.ourcommons.ca/Content/Committee/421/PACP/WebDoc/WD8148750/PACP-Sessional-ActionPlans/2018-Spring-OAG/Rpt06/ESDC-AnnexA3-Recc5-7-ISETProgramMonitoring-e.pdf)) | Describes joint-capacity assessment and monitoring / audit frequency |
| [3] | **PACP Follow-up Report: ISET Program Implementation** ([ourcommons.ca 421 PACP](https://www.ourcommons.ca/content/Committee/421/PACP/WebDoc/WD10439706/421_PACP_reldoc_PDF/42_1_PACP_EmploymentAndSocialDevelopmentCanada-e.pdf)) | Confirms 15% flat-rate administration-cost rule and oversight model |
| [4] | **ASETS Guidelines on Eligible Expenditures (Final)** ([fpdinc.ca](https://fpdinc.ca/wp-content/uploads/2021/01/02-ENG_ASETS-Guidelines-on-Eligible-Expenditures_FINAL.pdf)) | Legacy cost-category and capital-asset rules carried forward to ISET |
| [5] | **ISET Program Data Cycle, Security & Tools** ([mkonation.com](https://mkonation.com/mko/wp-content/uploads/day1_1_overview_isetp_data_cycle.pdf)) | Confirms XML schema used for structured data submissions |

## 3. Solution Overview

### 3.1 Module Summary
1. **Agreement & Capacity Management** – store contribution-agreement metadata, funding ceilings, capacity tier, reporting cadence.
2. **Budget & Cost Rules Engine** – encode eligible and ineligible costs, capital thresholds, and administration flat-rate rules (15% default per [3]).
3. **Transactions & Evidence Registry** – maintain secure expenditure records with linked proof documents (invoices, timesheets, bank records).
4. **Sub-Agreement Manager** – track funds disbursed to partner organizations and roll up sub-recipient financials.
5. **Reporting Engine** – generate interim and year-end financial reports per agreement; export PDF, CSV, and XML deliverables.
6. **Monitoring & Audit Controls** – apply capacity-based sampling rules (per [2]) and log monitoring events.
7. **XML Submission Interface** – configure exports that map internal records to the ESDC XML schema ([5]).

### 3.2 Actors and Roles
- **Finance Officer** – records transactions, prepares reports, uploads evidence.
- **Auditor / Compliance Officer** – reviews flagged transactions, monitors adherence to capacity tier rules.
- **Sub-Agreement User** – submits downstream financial data and supporting documents.
- **Administrator** – manages agreements, overrides, and system configuration.

## 4. Functional Requirements

### FR-1 Agreement Management
- Store core metadata: ESDC agreement ID, funding period, fiscal year, capacity tier (“Capacity Building”, “Enhanced”, “Optimal” [2]), and approved budget.
- Track reporting deadlines and status (interim, year-end) with reminders.
- Configure flat-rate administration percentage (default 15% per [3]) per agreement and per sub-agreement when authorized.
- Maintain version-controlled history of agreements and amendments.

### FR-2 Budget & Cost Rules Engine
- Define budget lines by category (Direct Program, Administration, Capital, Other [4]) with budget ceilings.
- Maintain eligibility metadata sourced from policy references ([1], [4]).
- Enforce capital asset threshold: default > $5,000 requires pre-approval ([4]).
- Flag non-arm’s-length transactions and require justification notes ([4]).
- Auto-calculate administrative allowance (≤ 15% of eligible costs [3]) and log overrides when negotiated.

### FR-3 Transactions & Evidence Registry
- Capture transaction fields: date, vendor, amount, category, funding source, cost-share ratio, and eligibility flag.
- Require supporting evidence uploads (receipt, invoice, contract scan [1]) with SHA-256 checksum.
- Link transactions to budget lines and sub-agreements; enforce agreement-period validation.
- Support batch import (CSV or JSON) with schema validation and error reporting.
- Track retention status (≥ seven-year retention per [1]) and evidence access logs.

### FR-4 Sub-Agreement Management
- Record sub-agreement metadata: funded amount, recipient, reporting cadence, capacity tier alignment, and period ([1]).
- Provide portal access for recipient users to upload financial reports and evidence.
- Roll up sub-agreement spending into parent agreement dashboards and exports ([2]).
- Apply eligibility and flat-rate rules downstream; surface exceptions to parent agreement administrators.

### FR-5 Reporting Engine
**FR-5a Interim and Year-End Reports**
- Produce statements of expenditures vs. budget by category (Direct, Admin, Capital) ([1]).
- Highlight variance thresholds (e.g., > 10% variance flagged for review).
- Compute administrative flat-rate allocation and verify cap compliance ([3]).
- Generate capital asset schedule detailing items > $5,000 with approval evidence ([4]).
- Attach certification statement and e-signature from authorized signatory.
- Output PDF summary for sign-off and CSV detail for downstream processing.

**FR-5b Data Export / Import Pipeline**
- Map internal schema to field dictionary (`code`, `description`, `amount`, `evidenceRef`).
- Produce XML envelope with:
  - Namespace and version metadata (`iset-financial-report v1.0`).
  - Header (`AgreementID`, `ReportingPeriod`, `CapacityTier`).
  - Elements per budget line and transaction (`CategoryCode`, `Eligible`, `Amount`).
  - Validation status, checksum, and creation timestamp.
- Support pluggable XSD to accept updated schemas from ESDC ([5]).
- Persist generated exports with immutable hash and submission status.

### FR-6 Monitoring & Audit Controls
- Auto-assign review level based on capacity tier ([2]):
  - Capacity Building → 100% transaction review.
  - Enhanced → 25% random sampling.
  - Optimal → annual desk review.
- Record monitoring events and attach ESDC findings, remediation tasks, and deadlines.
- Maintain audit trail for all report submissions (user, timestamp, artifact hash).

### FR-7 Security & Compliance
- Implement role-based access control for Finance Officer, Auditor, Sub-Agreement User, and Administrator roles.
- Encrypt evidence files at rest (AWS KMS / S3 SSE-KMS) and in transit.
- Enforce PII redaction guidance on upload and align with CCCS Medium security profile.
- Log all access, changes, and export actions for audit reporting.

## 5. Non-Functional Requirements
| Area | Requirement |
|:-|:-|
| Performance | Generate year-end reports ≤ 5 s for up to 100,000 transactions. |
| Scalability | Support multi-tenant deployment across multiple agreement holders. |
| Interoperability | Deliver validated XML per ISET schema ([5]) and JSON APIs for portal integration. |
| Accessibility | User interfaces comply with WCAG 2.2 AA. |
| Security | Implement CCCS Medium Cloud Profile controls (AWS-native encryption, least-privilege IAM). |
| Auditability | Provide immutable logs for report submissions and financial record changes. |

## 6. System Interfaces
| Interface | Purpose | Protocol |
|:-|:-|:-|
| ISET Portal API | Upload XML financial report envelope | HTTPS POST / REST |
| AWS S3 Evidence Bucket | Store supporting documents | AWS S3 API v4 (Signature V4) |
| Audit Log Service | Persist immutable event records | EventBridge → CloudWatch |
| User Directory (Cognito) | Authentication and RBAC | OIDC / JWT |

## 7. Reporting Workflow
1. Finance Officer records transactions and uploads evidence.
2. System validates eligibility rules and flat-rate calculations ([3], [4]).
3. Report compiles for interim or year-end submission and passes automated validation ([2]).
4. Authorized signatory reviews, certifies, and locks the report.
5. XML envelope generates ([5]) and submits via secure portal ([1]); checksum recorded.
6. Monitoring feedback imports and links to the report record with follow-up tasks ([2]).

## 8. Future Enhancements
- Add automated validation against official ESDC XSD once released ([5]).
- Integrate with ESDC web services for submission acknowledgements.
- Introduce predictive analytics for variance and risk scoring.
- Provide BI dashboards for network-wide roll-up views.

## 9. Guidance for CODEX Implementation
- Prioritize canonical JSON structures in `shared/events` for interoperability; reference Appendix A for field names.
- Expose validation rules (Appendix B) as configuration to allow policy updates without redeploy.
- Ensure capacity-tier parameters (Appendix C) drive sampling logic and reporting cadence automatically.
- Embed administrative flat-rate computation (Appendix D) within reporting services; log override metadata alongside agreements.
- Emit structured telemetry (`agreement_id`, `report_id`, `validation_status`) for observability pipelines.

## 10. UI/UX Requirements – ISET Financial Management (Draft v0.2)

Context: This module is primarily for leadership and finance management at an ISET agreement holder. It must support both complex, multi-bucket national holders (e.g., NWAC) and simpler organizations. Most transactional entries originate in a separate Case Management module; the Financial module consumes those entries, provides budgetary control, compliance views, and reporting readiness.

---

### 10.1 Design Principles
- Leadership-first: surface the health of budgets and compliance at a glance.
- Auditability by default: every movement of funds is justified, approved, timestamped, and immutable once certified.
- Scales from simple to complex: same screens adapt to “few pots” and “many pots” scenarios without overwhelming small orgs.
- Readable connections to Case Management: finance views reference the underlying case-level transactions without duplicating the workflow.

---

### 10.2 Primary Personas & Permissions
- CEO / Executive Director: overview dashboards, approve budget reallocations, certify reports (read/write/approve).
- Finance Officer / Controller: manage budgets, run reallocations, reconcile transactions from Case Management, prepare reports (read/write).
- Program/Regional Manager: view budgets for own portfolio, propose reallocations with justification (read/write within scope).
- Auditor / ESDC Monitor (internal or external): read-only access to certified data, evidence bundles, and logs (read).
- Caseworker (from Case Management): no write in Finance; can view read-only budget summaries tied to their cases (read-scoped).

Segregation of duties must be supported (e.g., the requester of a transfer cannot approve it).

---

### 10.3 Information Architecture (Top-Level)
- Dashboard
- Budgets
- Allocations & Transfers
- Reconciliation (from Case transactions)
- Reports
- Monitoring & Evidence
- Settings (roles, terminology, views)

Small-org “Simple mode” hides Reconciliation and Monitoring into Reports, and collapses Budgets into a single list.

---

### 10.4 Dashboard (Leadership View)
**Purpose:** one screen to understand status and risk.

Visible elements:
- Agreement selector + fiscal year context
- KPIs:
  - Total budget vs spent vs remaining
  - Admin flat-rate used vs allowed (gauge)
  - Commitments vs actuals (if enabled)
  - Evidence coverage % (transactions with valid proof)
  - Upcoming reporting deadline and XML validation status
  - Variance alerts (over/under > configurable threshold)
- Quick links: View Budgets, Start Reallocation, Open Reconciliation Queue, Generate Report
- Compliance strip: Capacity tier, next monitoring date, unresolved findings count

All metrics are clickable to filtered drill-downs.

---

### 10.5 Budgets (Buckets / Pots)
**Model:** hierarchical or flat “pots,” configurable per org.

Examples:
- Level 1: Funding Stream (Core, Targeted, Capital)
- Level 2: Program/Initiative
- Level 3: Region/Delivery Partner

Each pot shows:
- Approved amount
- Adjusted amount (after reallocations)
- Committed (optional) and Actuals
- Remaining and burn-rate
- Admin attribution (if applied proportionally)

UX elements:
- Toggle between Tree and Flat list
- Saved views (e.g., “By Region”, “By Program”)
- Simple mode: single-level list with totals only

---

### 10.6 Allocations & Transfers (Budgetary Management)
**Goal:** allow finance to move money between pots with full auditability.

Flow (Transfer Wizard):
- Source pot → Destination pot
- Amount, effective date, justification (required), attachment(s)
- Optional tagging (e.g., Board Minute ID)
- Pre-submit validation: source availability, policy checks (e.g., cannot increase ADM beyond cap), period boundaries
- Approval route based on policy (e.g., Program Manager propose → Finance approve → CEO certify if over threshold)

UI features:
- Pending approvals queue (with diff view of before/after pot balances)
- History timeline showing every approved transfer with user, timestamp, and reason
- Snapshot view: “Show balances as of [date]” to reproduce board/ESDC numbers

Simple mode:
- Single “Reallocate” action with minimal fields; approval still enforced.

---

### 10.7 Reconciliation (Financial <-> Case Management)
**Purpose:** align case-originated transactions with finance budgets and catch exceptions early.

Views:
- Inbound transactions feed (read-only details: date, amount, case ID, category, evidence refs)
- Auto-match results to pots (rule-based; configurable mapping)
- Exceptions queue:
  - Missing evidence
  - Ineligible category flags
  - Date out of period
  - Pot overrun
  - Unclassified vendor

Actions:
- Reclassify to different pot (with justification)
- Request evidence from Case Management (sends task/event)
- Mark as non-claimable (with reason)

UX emphasis: fast triage (keyboard navigation, bulk actions), clear cross-links back to the case record.

---

### 10.8 Reports
- Interim and Year-End financial statements (summary and drill-down)
- Variance analysis by pot and by category
- Admin flat-rate computation line item (read-only calculation)
- Export: CSV, PDF summaries, XML envelope (validation status displayed)
- Certification modal (authorized signatory, timestamp, lock)

Simple mode: single “Generate Report” flow, minimal options.

---

### 10.9 Monitoring & Evidence
- Evidence coverage progress bar and filters
- Sampling set generator (capacity-tier based)
- Evidence bundle builder (zip receipts for sampled items)
- Findings log with status (open/resolved), notes, and attachments
- Read-only access mode for auditors/monitors

---

### 10.10 Settings (Org-Level Configuration)
- Simple vs Advanced mode toggle
- Budget hierarchy definition and labels (rename “pots/buckets” to org’s terminology)
- Reallocation approval thresholds and routes
- Mapping rules from Case categories → Finance pots
- Roles and permissions
- Reporting cadence and due-date reminders

---

### 10.11 States, Alerts, and Empty-State UX
- Empty Budgets: guided setup with minimal friction (Advanced mode offers CSV import)
- No Evidence: show “Add later” vs “Required now” tags
- Overruns and blocked transfers: inline reasons, not generic errors
- Every alert is actionable (link to the relevant filtered view)

---

### 10.12 Accessibility and Language
- WCAG 2.2 AA: keyboard-first design, focus states, readable contrasts
- Bilingual labels and content (English/French); terminology pack supports Indigenous language labels where provided by the org

---

### 10.13 Performance Targets (Perceived UX)
- Dashboard loads < 2s with cached KPIs
- Budget tree renders < 300ms per 1k pots (virtualized list/tree)
- Reconciliation queue supports 100k+ items with server-side filtering and pagination

---

### 10.14 Security & Audit UX
- Clear “who can do what” per control (tooltips show permission and policy references)
- Immutable logs shown in a human-readable timeline (who, what, before/after, reason)
- Snapshots for board/ESDC reference points (restorable read-only views)

---

### 10.15 Integration Boundaries with Case Management
- Finance is system-of-record for budgets, allocations, reports, and approvals.
- Case Management is system-of-record for client-level transactions and evidence collection.
- Cross-links only; no duplicate editing. Finance can request corrections back to Case.
- Event-driven sync preferred; UI shows last sync time and any ingest errors.

---

### 10.16 Fit for Small vs Large Holders (Progressive Disclosure)
- Simple mode by default for small holders:
  - Flat list budgets, single transfer action, single report entry point
  - Reconciliation folded into report preview warnings
- Advanced mode for large holders:
  - Hierarchical budgets, transfer workflows, reconciliation queue, monitoring workspace
- Users can switch modes without data migration; it only changes presentation.

---

### 10.17 Terminology (UI Labels – configurable)
- Pot / Bucket / Envelope (org-selectable)
- Allocation, Transfer, Reallocation
- Commitment vs Actual (optional feature flag)
- Evidence, Certification, Monitoring, Findings

---

### 10.18 Non-Goals (for clarity)
- No case creation or editing here (belongs to Case Management)
- No general ledger accounting functions (export only)
- No free-form KPIs unrelated to ISET reporting

---

### 10.19 Open Questions (tracked for CR alignment)
- Should commitments be modeled and surfaced in leadership KPIs, or remain finance-internal?
- Do some orgs need multi-currency display (rare, but possible for travel)?
- Are there per-pot admin allocations, or only global flat-rate display?

End of Draft v0.2

## 20. Forecasting & Scenario Management (Draft v0.1)

Context: This section extends the ISET Financial Management module to include forecasting, allowing leadership and finance teams to project expenditures by budget pot and reporting period, simulate reallocations, and take proactive actions before formal reporting.

---

### 20.1 Concept Overview

Forecasting adds a forward-looking layer to the existing Plan → Actual → Report cycle. It introduces a third state for each budget line:

- **Planned**: the approved budget.
- **Actual**: confirmed expenditures to date (primarily imported from Case Management).
- **Forecast**: projected expenditure for the period end, based on trends and manual adjustments.

This layer supports scenario planning and helps CEOs and finance officers manage funds dynamically while maintaining auditability.

---

### 20.2 Objectives

- Provide a clear view of forecasted vs budgeted spend across all pots.
- Support manual and automated forecasting methods.
- Enable auditable, justified reallocations between pots before overrun occurs.
- Simplify for smaller holders while providing scenario tools for national/multi-program organizations.

---

### 20.3 Forecast UX Elements

**Dashboard Enhancements**

- Forecast toggle: switch charts between Actual / Forecast / Combined views.
- KPIs:
  - Forecasted year-end spend vs budget.
  - Forecast variance percentage.
  - Forecasted admin rate vs allowed cap.
- Colour indicators: green (on track), amber (approaching limit), red (over forecast).

**Budgets View Additions**

Each pot displays:

```
Budgeted | Actual | Forecast | Variance (Forecast - Budget)
```

- Inline editing for forecasts.
- System-generated forecast suggestions based on historical spend trends.
- Manual override with justification text and audit log.

---

### 20.4 Reallocation Workflow

**Forecast-driven reallocation**

- When transferring funds, both current and forecasted balances are displayed.
- Validation prevents reallocations that create forecasted overruns.
- Each transfer requires justification referencing forecast data.

**Scenario Workspace**

- A sandbox view for what-if analysis.
- Users can drag or input new forecast values by pot.
- System recalculates total spend and admin percentage in real time.
- Approved scenarios can be committed to live data as reallocations.

Simplified mode: one-step forecast adjustment and transfer confirmation.

---

### 20.5 Time Horizons

Forecasts may target multiple time frames:

- Quarter-end.
- Year-end.
- Next agreement period.

Forecast records include a period-end date and versioning for audit purposes.

---

### 20.6 Forecast Data Sources

- Case Management transaction trends (rolling averages, known commitments).
- Scheduled payments and approved proposals.
- Manual entries by finance officers.

Each forecast entry is labeled with its origin:

```
method = system_estimate | manual_override | imported_commitment
```

---

### 20.7 Role-Based Interaction

- **CEO / Executive Director**: reviews forecasts, approves reallocations, certifies scenarios.
- **Finance Officer**: manages detailed forecast entries, performs simulations.
- **Program Manager**: proposes updates for their area, subject to approval.

---

### 20.8 Visual Design

- Progress bars or stacked bars for Budget, Actual, Forecast.
- Trend charts: monthly actual vs forecast lines.
- Colour-coded variances.
- Change log for each forecast value (old → new, user, reason, timestamp).

---

### 20.9 Data Model Additions

```
ForecastRecord {
  id,
  pot_id,
  period_end_date,
  forecast_amount,
  method (manual | system | imported),
  justification_text,
  created_by,
  created_at
}
```

Linked one-to-one with BudgetLine. Historical versions retained.

---

### 20.10 Reporting Integration

- Forecast data used internally for management and planning.
- Interim and year-end reports may include a "Forecast vs Budget" summary.
- XML export excludes forecasts by default (for ESDC compliance) unless explicitly requested.

---

### 20.11 Small vs Large Holder Modes

**Simple Mode**

- Forecast equals Actual until overridden.
- Single summary chart for expected year-end spend.

**Advanced Mode**

- Scenario workspace and multi-period forecasting enabled.
- Drill-downs by funding stream, region, or program.

---

### 20.12 Auditability and Change Management

Every forecast adjustment is logged:

```
User | Date | Previous | New | Reason | ApprovalRef
```

This ensures all forward-looking decisions are transparent and reviewable during monitoring.

End of Section 20

---

## Appendix A. Data Dictionary & XML Mapping
Version 0.1 – 2025-10-18 (linked to Sections 4.5 and 4.7)

### A1. Purpose
Define canonical data structures for storage and export envelopes used in XML/CSV submissions to ESDC. Maintain compatibility with the ISET Program Data Cycle specifications ([5]) and ASETS/ISET category definitions ([4]).

### A2. Schema Overview
| Object | Description | Key Fields |
|:-|:-|:-|
| **Agreement** | Master record for ESDC contribution agreement. | `agreement_id`, `fiscal_year`, `capacity_tier`, `admin_flat_rate_pct` |
| **BudgetLine** | Budget allocation by category. | `budget_line_id`, `category_code`, `eligible_flag`, `amount_budgeted` |
| **Transaction** | Financial entry linked to budget line and evidence. | `txn_id`, `agreement_id`, `budget_line_id`, `txn_date`, `vendor_name`, `amount`, `eligible_flag`, `evidence_ref` |
| **Evidence** | Stored proof document. | `evidence_id`, `file_uri`, `sha256`, `doc_type`, `uploaded_by` |
| **Report** | Interim or year-end summary for submission. | `report_id`, `agreement_id`, `period_start`, `period_end`, `status`, `export_version` |
| **ExportEnvelope** | XML package metadata and payload. | `export_id`, `schema_version`, `created_at`, `validation_status`, `xml_payload` |

### A3. Core Field Dictionary
| Field Name | Type | Description / Validation | XML Tag (Proposed) | Source Ref |
|:-|:-|:-|:-|:-|
| `agreement_id` | string (12) | Unique ESDC identifier (e.g., CA-####-####). | `<AgreementID>` | [1] |
| `fiscal_year` | string (9) | Format `YYYY-YYYY` (e.g., 2025-2026). | `<FiscalYear>` | [1] |
| `capacity_tier` | enum (`Building`, `Enhanced`, `Optimal`) | Joint Capacity Assessment outcome. | `<CapacityTier>` | [2] |
| `admin_flat_rate_pct` | decimal (≤ 15.00) | Default 15% per program policy. | `<AdminFlatRate>` | [3] |
| `category_code` | enum | Values listed in Section A4. | `<CategoryCode>` | [4] |
| `eligible_flag` | bool | True for approved expenditures. | `<Eligible>` | [4] |
| `amount_budgeted` | currency | ≥ 0; two decimals. | `<BudgetAmount>` | [1] |
| `amount_spent` | currency | ≥ 0; two decimals. | `<ActualAmount>` | [1] |
| `vendor_name` | string (150) | Payee or entity name. | `<Vendor>` | [4] |
| `txn_date` | date (ISO 8601) | Must fall within agreement period. | `<TransactionDate>` | [1] |
| `evidence_ref` | string (UUID) | Reference to Evidence record. | `<EvidenceRef>` | [1] |
| `doc_type` | enum (`invoice`, `receipt`, `payroll`, `contract`, `bank_proof`) | Evidence classification. | `<EvidenceType>` | [1] |
| `sha256` | string (64) | File checksum. | `<EvidenceHash>` | Internal |
| `variance_pct` | decimal | `(amount_spent − amount_budgeted)/amount_budgeted × 100`. | `<VariancePercent>` | Derived |
| `certified_by` | string (100) | Authorized signatory name. | `<CertifiedBy>` | [1] |
| `certified_at` | datetime | UTC timestamp. | `<CertifiedAt>` | [1] |
| `export_version` | string | Internal schema identifier (e.g., `iset-fin-1.0`). | `<SchemaVersion>` | [5] |

### A4. Category Codes
| Code | Label | Eligible Examples | Source Ref |
|:-|:-|:-|:-|
| **DIR** | Direct Program Delivery | Client training fees, materials, front-line wages. | [4] |
| **ADM** | Administration | Finance salaries, office supplies, audit fees (≤ 15%). | [3] |
| **CAP** | Capital Assets | Equipment > $5,000 with approval. | [4] |
| **OTH** | Other Approved Costs | Negotiated activities not captured elsewhere. | [1] |

### A5. XML Envelope (Placeholder)
```xml
<ISETFinancialReport xmlns="https://esdc.gc.ca/iset/reporting/v1" schemaVersion="1.0">
  <Header>
    <AgreementID>CA-2025-1234</AgreementID>
    <FiscalYear>2025-2026</FiscalYear>
    <ReportingPeriod type="YearEnd">2026-03-31</ReportingPeriod>
    <CapacityTier>Optimal</CapacityTier>
    <AdminFlatRate>15.00</AdminFlatRate>
  </Header>
  <BudgetLines>
    <BudgetLine>
      <CategoryCode>DIR</CategoryCode>
      <BudgetAmount>350000.00</BudgetAmount>
      <ActualAmount>340200.25</ActualAmount>
      <VariancePercent>-2.8</VariancePercent>
    </BudgetLine>
    <BudgetLine>
      <CategoryCode>ADM</CategoryCode>
      <BudgetAmount>52500.00</BudgetAmount>
      <ActualAmount>51200.00</ActualAmount>
    </BudgetLine>
  </BudgetLines>
  <Transactions>
    <Transaction>
      <TransactionID>TXN-000045</TransactionID>
      <CategoryCode>DIR</CategoryCode>
      <TransactionDate>2025-06-15</TransactionDate>
      <Vendor>Acme Training Inc.</Vendor>
      <Eligible>true</Eligible>
      <Amount>1200.00</Amount>
      <EvidenceRef>EVD-789b-abc</EvidenceRef>
    </Transaction>
  </Transactions>
  <EvidenceList>
    <Evidence>
      <EvidenceRef>EVD-789b-abc</EvidenceRef>
      <EvidenceType>invoice</EvidenceType>
      <EvidenceHash>f7a9e...c5b8</EvidenceHash>
      <FileName>acme-training-jun2025.pdf</FileName>
    </Evidence>
  </EvidenceList>
  <Certification>
    <CertifiedBy>Jane Doe</CertifiedBy>
    <CertifiedAt>2026-05-15T14:22:00Z</CertifiedAt>
  </Certification>
</ISETFinancialReport>
```

### A6. Validation Rules
| Rule ID | Description | Severity | Source |
|:-|:-|:-|:-|
| FIN-001 | `amount_spent ≤ amount_budgeted × 1.15` unless documented variance. | Warning | [1], [4] |
| FIN-002 | `admin_flat_rate_pct ≤ 15` unless override flag and approval reference present. | Error | [3] |
| FIN-003 | `txn_date` must fall within agreement start and end dates. | Error | [1] |
| FIN-004 | Capital asset > $5,000 requires `doc_type = invoice` and approval flag. | Error | [4] |
| FIN-005 | `sha256` must match stored file checksum. | Error | Internal |
| FIN-006 | XML payload must conform to current schema version and pass XSD validation. | Error | [5] |

### A7. Example CSV Export (Parallel Format)
```csv
AgreementID,FiscalYear,CategoryCode,TxnDate,Vendor,Amount,Eligible,EvidenceRef
CA-2025-1234,2025-2026,DIR,2025-06-15,Acme Training Inc.,1200.00,TRUE,EVD-789b-abc
CA-2025-1234,2025-2026,ADM,2025-07-01,Office Mart Ltd.,86.25,TRUE,EVD-790a-def
```

### A8. Security Metadata
- Include `<Checksum>` element containing SHA-256 of the payload with AWS KMS-signed signature header.
- Encrypt evidence files using S3 SSE-KMS; share via pre-signed URLs valid ≤ seven days.
- Store immutable submission history with `export_id`, checksum, and validation status.

### A9. Change History
| Version | Date | Author | Notes |
|:-|:-|:-|:-|
| 0.1 | 2025-10-18 | B. Sillery | Initial draft with placeholder XML until official XSD released. |

---

## Appendix B. Eligible Expenditure Rules
Version 0.1 – 2025-10-18 (sources [1], [3], [4])

### B1. Purpose
Define baseline rules for classifying, validating, and calculating expenditures under ISET agreements. Intended for encoding in a rules engine or JSON configuration.

### B2. Category Definitions

**Direct Program Delivery (DIR)**
- Eligible: front-line staff wages, participant allowances, training materials, contracted providers, client travel, attributable facility costs, equipment ≤ $5,000.
- Ineligible: general corporate marketing, capital assets > $5,000 without approval, costs covered by other federal programs.

**Administration (ADM)**
- Eligible: finance/HR salaries, office supplies, postage, banking fees, telecom services, external audit/legal fees, proportional facility costs.
- Ineligible: expenditures beyond 15% flat-rate cap without authorization, personal benefits, non-program activities.

**Capital Assets (CAP)**
- Eligible: approved purchases > $5,000 (equipment, vehicles, facility upgrades, multi-year software) with recorded inventory.
- Conditions: prior written approval, inventory register, approved depreciation policy.
- Ineligible: unapproved capital purchases, luxury or non-program assets, land acquisition.

**Other Approved Costs (OTH)**
- Eligible: activities explicitly authorized in the contribution agreement (e.g., pilot projects, consultations).
- Requires written ESDC approval per line item.

### B3. Structured Rule Definition
```json
{
  "DIR": {
    "description": "Direct Program Delivery",
    "eligibility_criteria": [
      "Expense directly supports client training or employment outcomes",
      "Expense occurs within agreement period"
    ],
    "cap_rules": [],
    "approval_required": false
  },
  "ADM": {
    "description": "Administration",
    "eligibility_criteria": [
      "Supports management or operation of the ISET agreement"
    ],
    "cap_rules": [
      { "type": "flat_rate", "limit_percent": 15.0, "reference": "[3]" }
    ],
    "approval_required": false
  },
  "CAP": {
    "description": "Capital Assets",
    "eligibility_criteria": [
      "Useful life > 1 year",
      "Unit cost > 5000"
    ],
    "cap_rules": [],
    "approval_required": true
  },
  "OTH": {
    "description": "Other Approved Costs",
    "eligibility_criteria": [
      "Explicitly identified in contribution agreement"
    ],
    "approval_required": true
  }
}
```

### B4. Cross-Cutting Validation Rules
1. Expenditures must occur within the agreement start and end dates ([1]).
2. Duplicate claims across funding sources are prohibited ([1]).
3. Recoverable taxes (GST/HST) must be excluded from claims ([4]).
4. Per-diem and travel rates must follow recipient policy approved by ESDC ([4]).
5. Each transaction requires verifiable evidence and audit trail ([1]).
6. Ineligible expenditures must be disclosed and may be deducted from future claims ([1]).

### B5. Capital Asset Register Template (Excerpt)
| AssetID | Description | PurchaseDate | Cost | SerialNumber | Location | ESDCApprovalRef | DisposalDate |
|:-|:-|:-|:-|:-|:-|:-|:-|
| CAP-0001 | Training Laptops (10) | 2025-05-12 | 12,750.00 | SN-12345 | Learning Lab | APR-2025-ESDC-01 |  | 

### B6. Change History
| Version | Date | Notes |
|:-|:-|:-|
| 0.1 | 2025-10-18 | Initial draft for Awentech prototype based on ASETS/ISET guidance. |

---

## Appendix C. Capacity Tier Model
Version 0.1 – 2025-10-18 (sources [1], [2])

### C1. Purpose
Describe standardized capacity tiers used by ESDC to determine monitoring, reporting, and audit activities. System behavior adjusts cadence, sampling, and oversight based on these tiers.

### C2. Tier Definitions

**Capacity Building**
- Characteristics: emerging controls, limited agreement experience, limited segregation of duties, occasional late reporting.
- Monitoring: annual on-site visit, 100% transaction review, quarterly interim reports, capital purchases require pre-approval.
- System Configuration: `reporting_frequency = quarterly`, `sample_rate = 1.0`, `onsite_monitoring = annual`, `requires_capital_preapproval = true`.

**Capacity Enhancement**
- Characteristics: established procedures, timely annual reports, minor compliance issues.
- Monitoring: on-site every two years, ≥ 25% transaction sampling, semi-annual interim reporting, desk review of year-end reports.
- System Configuration: `reporting_frequency = semi_annual`, `sample_rate = 0.25`, `onsite_monitoring = biennial`, `requires_capital_preapproval = true`.

**Optimal Capacity**
- Characteristics: robust controls, clean audits, effective sub-agreement management.
- Monitoring: desk reviews only, ≤ 10% annual sample, annual reporting, capacity reassessment every three years.
- System Configuration: `reporting_frequency = annual`, `sample_rate = 0.10`, `onsite_monitoring = none`, `requires_capital_preapproval = case_by_case`.

### C3. Tier Transitions and Reassessment
- Joint Capacity Assessment occurs at least every three years or after major organizational changes.
- System must allow manual updates and import of JCA scorecard outputs.
- Reassessment triggers: repeated late reports, governance changes, new funding agreements, or recurring ineligible findings.

### C4. Monitoring Schedule Summary
| Tier | Report Frequency | Sample % | On-Site Review | JCA Reassessment |
|:-|:-|:-|:-|:-|
| Capacity Building | Quarterly | 100% | Annual | Annual |
| Capacity Enhancement | Semi-Annual | 25% | Biennial | Every 2 years |
| Optimal Capacity | Annual | 10% | Desk only | Every 3 years |

### C5. Data Model Parameters
```yaml
capacity_tier: enum("Building", "Enhancement", "Optimal")
reporting_frequency: enum("quarterly", "semi_annual", "annual")
sample_rate: float (0.0-1.0)
onsite_monitoring: enum("annual", "biennial", "none")
next_review_due: date
requires_capital_preapproval: boolean
```

### C6. Change History
| Version | Date | Notes |
|:-|:-|:-|
| 0.1 | 2025-10-18 | Initial draft aligned with Joint Capacity Assessment framework. |

---

## Appendix D. Administrative Flat-Rate Formula
Version 0.1 – 2025-10-18 (sources [1], [3])

### D1. Purpose
Specify computation of administrative expenditures under the ISET flat-rate model and related system constraints.

### D2. Policy Basis
- Flat rate of up to 15% of eligible direct costs reduces reporting burden while maintaining accountability.
- Flat rate does not supersede restrictions on ineligible expenditures.
- ESDC may approve alternate percentages through agreement amendments.

### D3. Definitions
- **Eligible Direct Costs** – Expenditures classified as `DIR` that meet criteria in Appendix B and occur within the agreement period.
- **Administrative Costs** – Indirect costs supporting agreement management and operations.
- **Flat-Rate Percentage (FR%)** – Negotiated or default percentage (typically 15.0) applied to eligible direct costs.
- **Approved Flat-Rate Amount (AFA)** – Amount reported for administrative costs after applying FR%.

### D4. Formula
```text
AFA = Total_Eligible_Direct_Costs × (FR% / 100)
```
Example: If total eligible direct costs = $400,000 and FR% = 15, then `AFA = 400,000 × 0.15 = $60,000`.

### D5. Constraints
1. FR% must not exceed 15 without written authorization from ESDC.
2. Flat-rate administrative costs must not duplicate direct cost line items.
3. Report administrative allowance under category code `ADM`.
4. Apply the same percentage across sub-agreements unless otherwise specified.
5. Store approval reference when FR% differs from 15.

### D6. Implementation Rules
```python
if agreement.admin_flat_rate_pct > 15.0:
    require_esdc_approval_reference()

admin_flat_rate_amount = sum(d.amount for d in direct_costs if d.eligible)
admin_flat_rate_amount *= agreement.admin_flat_rate_pct / 100

assert admin_flat_rate_amount <= budgeted_admin_limit, "ADM variance exceeds limit"
lock_after_certification(report_id)
```

### D7. Reporting Display
```text
Direct Program Delivery Expenditures ......... $400,000
Administrative Flat-Rate (15%) .............. $ 60,000
Total Eligible Expenditures ................. $460,000
```
XML representation:
```xml
<Administration>
  <FlatRatePercent>15.00</FlatRatePercent>
  <FlatRateAmount>60000.00</FlatRateAmount>
</Administration>
```

### D8. Exceptions and Overrides
- Capacity Building agreements may require itemized administrative expenditures instead of flat rate.
- Overrides must record ESDC approval reference and rationale.
- Audits may request documentation showing actual administrative costs meet or exceed the flat-rate amount.

### D9. Change History
| Version | Date | Notes |
|:-|:-|:-|
| 0.1 | 2025-10-18 | Initial draft aligned with ESDC flat-rate policy. |

---

© 2025 Awentech Ltd. All rights reserved.