# ISET Case & Financial Management – Forward Data Architecture

**Status:** Draft v0.2 (2025-10-30)  
**Author:** Codex (LLM assistant)  
**Scope:** Internal caseworking + financial management data domains, including ILMP/ESDC reporting alignment. All data described is dev/test only; no legacy production reconciliation is required.

---

## Revision History

| Date | Version | Author | Notes |
|------|---------|--------|-------|
| 2025-10-30 | v0.2 | Codex | Captured Oct 2025 schema migrations (contact comms, ESDC submissions, enumeration seeds) and aligned current-state summaries. |
| 2025-10-28 | v0.1 | Codex | Initial draft outlining target data architecture for case and finance domains. |

---

## 1. Executive Summary

The current database supports initial case tracking (linking applications to cases, assessments, notes/tasks) and emerging action-plan scaffolding. Financial data is limited to lightweight snapshots; detailed budgeting and commitments are still pending, while the participant submission pipeline now has dedicated persistence (`esdc_participant_submission` + history and reporting package tables) that still requires service integration. This document outlines the target-state entity-relationship model (ERM) required to manage case workflows end-to-end, align interventions with budgets, and satisfy ILMP (ESDC) reporting. A gap analysis and staged transition path are provided to guide schema evolution and service/API work.

---

## 2. Current-State Reference Points

### 2.1 Key Tables in `iset_intake` (2025-10-27 snapshot)

| Table | Purpose | Key Columns (selected) | Relationships |
|-------|---------|------------------------|---------------|
| `iset_case` | Root case record linked to application/client | `id`, `application_id`, `client_id`, `assigned_to_user_id`, `status` | FK → `iset_application.id`, `client.id` |
| `iset_case_assessment` | Assessment snapshot (single row per case) | `employment_goals`, `esdc_eligibility`, `employment_barriers` (JSON), `itp_payload`, `wage_payload` | PK = `case_id` |
| `iset_case_action_plan` | Early action plan scaffold | `case_id`, `name`, `status`, `effective_date`, `review_date`, `metadata_json` | FK → `iset_case.id`, optional owner FKs |
| `iset_case_intervention` | Intervention scaffold tied to case/action plan | `case_id`, `action_plan_id`, `intervention_code`, `status`, `funding_stream`, amounts | FK → `iset_case`, `iset_case_action_plan` |
| `iset_case_financial_snapshot` | Rolling totals per case | `allocated_amount`, `committed_amount`, `spent_amount`, `variance_amount` | FK → `iset_case.id` |
| `iset_case_task`, `iset_case_note`, `iset_case_event`, `iset_case_watch`, `iset_case_action_item`, `iset_case_compliance_check` | Ancillary workflow activity spanning tasks, notes, timeline entries, watchers, action items, and compliance verifications | Standard audit columns + soft-delete timestamps where applicable | FK → `iset_case.id`, optional assignee FKs → `staff_profiles.id`/`user.id` |
| `iset_application`, `iset_application_version` | Source application payloads (immutable snapshot for audit) | `payload_json` (answers, submission data) | FK from `iset_case.application_id` |
| `esdc_participant_submission` | Participant readiness + payload snapshot for ILMP exports | `case_id`, `application_id`, `readiness_status`, `submission_status`, `payload_snapshot`, `payload_checksum`, `rejection_reason` | FK → `iset_case.id`, `iset_application.id`, `user.id` (submitter) |
| `esdc_participant_submission_history` | Timeline of validation/export events | `participant_submission_id`, `event_type`, `actor_user_id`, `event_details`, `occurred_at` | FK → `esdc_participant_submission.id`, `user.id` |
| `esdc_reporting_package`, `esdc_reporting_note` | Reporting package lifecycle + internal collaboration | `reporting_period`, `due_date`, `status`, `checklist_state`, `note_text` | FK → `user.id` (submitter/author) |
| `esdc_intervention_code`, `esdc_intervention_outcome` | Seeded enumeration catalogs aligned with ILMP schema 1.4 | `code`, `label`, `schema_version`, `is_active`, `display_order` | Referenced by UI/API when coding interventions & outcomes |

### 2.2 Current API Payloads

- `/api/cases/:id/workspace` returns: case header, client region, owner, counts, `actionPlans[]` (currently empty in dev), derived from SQL join of case + assessment + client + action plan tables, and populated with participant identity/contact from `case_context_json`.
- `/api/cases/:id/action-plan/context` (new) synthesizes assessment values with case context (eligibility, labour-force status, childcare, etc.) for UI defaults.
- `/api/cases/:id/action-plans` (POST) inserts minimal record into `iset_case_action_plan` (name, dates, owner, metadata JSON).

Financial APIs are not yet exposed; finance UI widgets use mocked data or rely on snapshots. ESDC submission endpoints exist (`/api/esdc/reporting-packages`) but operate separately from action plans/interventions.

### 2.3 Application Payload Insights

Application answers (stored in `iset_application.payload_json.answers`) are used only for initial seeding; `case_context_json` is now the canonical source for ILMP-aligned fields (labour force status, education level, social assistance, requested supports, barriers, childcare needs, etc.) that drive case management and ESDC submissions. Payloads also include signatures and supporting document metadata for audit/reference.

### 2.4 Recent schema changes (Oct 2025)

- `20250923_0005_add_internal_notifications.sql` introduced `iset_internal_notification` + dismissal tables, enabling in-app alerts that surface case/finance workflow changes to staff.
- `20251002_0006_add_sla_stage_target.sql` added SLA target configuration (`iset_sla_stage_target`) supporting future case ageing dashboards.
- `20251022_create_contact_message_tables.sql` created `contact_message`, `contact_message_note`, and `contact_message_status_history` to capture intake/portfolio communications; contact cases will eventually cross-link to case records.
- `20251023_create_esdc_submission_tables.sql` landed the ESDC participant submission pipeline (`esdc_participant_submission`, `_history`, `esdc_reporting_package`, `esdc_reporting_note`) and seeded ILMP enumerations (`esdc_intervention_code`, `esdc_intervention_outcome`). UI/service wiring still pending.
- `esdc_intervention_code` and `esdc_intervention_outcome` now serve as canonical lookup tables for ILMP codes. Both tables share the same structure: `code` (TINYINT UNSIGNED), `label` (VARCHAR 255), `schema_version` (defaults to `1.4`), `is_active`, `display_order`, and audit timestamps. Front-end widgets resolve user-facing labels from these tables instead of displaying numeric codes.

---

## 3. External Requirements & Constraints

- **ESDC ILMP Schema 1.4:** Requires action plan records with agreement number, start/result dates, result codes, eligibility, and associated interventions (mandatory fields: code, start date; conditional fields: end date, duration, cost, outcome, related NOC/version). See `docs/data/ESDC/` for full specification.
- **ESDC Submission Audit:** Each exported participant submission requires traceability (source case, action plan, interventions, financial totals) and ability to regenerate/export corrections.
- **NWAC / Contribution Agreement Oversight:** Budget pots (EI vs CRF), local priorities, and region-specific funding allocations must be enforceable to avoid overspend and ensure interventions tie to correct funding stream.
- **Multi-role Access Control:** System admin, program admin, regional coordinator, and assessor roles with region scoping; financial officers/auditors will be added.

---

## 4. Target-State ER Model (Narrative)

### 4.1 Core Caseworking Entities

| Entity | Description | Key Attributes | Relationships |
|--------|-------------|----------------|---------------|
| **Client** (`client`) | Single person or organization served | Demographics, SIN, region, contact | `Client` ⟷ `Application` (1:M), `Client` ⟷ `Case` (1:M) |
| **Application** (`iset_application`, versions) | Submitted intake application | `payload_json` (answers), submission status, attachments | Links to `Case` (optional until converted) |
| **Case** (`iset_case`) | Primary record for caseworking | `status`, `assigned_to_user_id`, `portfolio_region_id`, `agreement_id` (FK to FundingAgreement once approved) | 1:M to assessments, action plans, events |
| **CaseAssessment** (extend `iset_case_assessment`) | Time-versioned assessments | Move to versioned table (PK surrogate + `case_id`, `version`, `is_current`) storing all ILMP-related evaluation fields | Case 1:M CaseAssessment |
| **ActionPlan** (`iset_case_action_plan`) | Strategic plan for case | Add `agreement_id` (FK), `result_code`, `result_date`, `closed_at`, `outcome_summary`, `version_no`; enforce max one active (non-closed) plan per case | Case 1:M ActionPlan (active constraint) |
| **ActionPlanRevision** (new) | Snapshot per plan edit | `action_plan_id`, `revision_no`, `effective_date`, `data_json`, `created_by` | Supports plan history & ILMP export reproducibility |
| **ActionPlanOutcome** (new) | Normalized outcome row | `action_plan_id`, `result_code`, `result_date`, `education_level_after`, `employment_noc`, `employment_noc_version`, `employment_status_end` | 1:1 with closed plan |
| **Intervention** (`iset_case_intervention`) | Activity tied to plan | Extend table with ILMP fields: `intervention_code`, `outcome_code`, `duration_days`, `cost_budgeted`, `cost_actual`, `related_noc`, `related_noc_version`, `delivery_partner_id`, `location_id`, `support_category_id`, `is_esdc_reportable` | ActionPlan 1:M Intervention |
| **InterventionFundingSplit** (new) | Budget pots per intervention | `intervention_id`, `budget_pot_id`, `committed_amount`, `approved_amount`, `actual_amount` | Enables multi-pot allocation |
| **InterventionDocument** (new) | Evidence linking to doc repo | `intervention_id`, `document_id`, `document_type` | 1:M to Document |
| **CaseTask**, **CaseNote**, **CaseEvent**, **ComplianceCheck** | Already exist, may require columns for new statuses and event enums |

### 4.2 Financial Management Entities

| Entity | Description | Key Attributes | Relationships |
|--------|-------------|----------------|---------------|
| **FundingAgreement** (new) | Represents Contribution Agreement / Budget envelope | `id`, `code`, `program_stream` (EI/CRF), `start_date`, `end_date`, `total_value`, `region_scope` | 1:M to `BudgetPot` |
| **BudgetPot** (new) | Allocated budget line (e.g., Skills Training) | `funding_agreement_id`, `name`, `category`, `allocated_amount`, `fiscal_year` | 1:M to `BudgetAllocation` |
| **BudgetAllocation** (new) | Portion allocated to region/team | `budget_pot_id`, `region_id`, `allocated_amount`, `committed_amount`, `spent_amount` | Aligns with `portfolio_region_id` |
| **InterventionCommitment** (new) | Commitment record per intervention & budget pot | `intervention_id`, `budget_pot_id`, `committed_amount`, `approved_amount`, `approval_date`, `approver_id`, `status` | 1:M to `Disbursement` |
| **Disbursement** (new) | Authorized payment instructions | `commitment_id`, `scheduled_date`, `amount`, `status`, `payment_reference`, `invoice_id` | 1:M to `Payment` |
| **Payment** (new) | Actual payment transactions | `id`, `disbursement_id`, `issued_date`, `amount`, `finance_system_reference`, `gl_code`, `status` | |
| **Invoice / Claim** (new) | Supplier claim data | `id`, `case_id`, `supplier_id`, `invoice_number`, `invoice_date`, `amount`, `document_id` | Links to `Disbursement` |
| **FinancialSnapshot** (`iset_case_financial_snapshot`) | Keep as aggregated view; adjust to reference `snapshot_type`, details JSON includes pot breakdown | |
| **ForecastScenario / ForecastLine** (existing UI scaffolding) | Align with future budgets by linking to `BudgetPot` and `Case` |

### 4.3 Cross-cutting / Reporting Entities

| Entity | Description |
|--------|-------------|
| **ESDCParticipantSubmission** (extend existing table) – add FKs to `case_id`, `action_plan_id`, `intervention_id` reference sets, `schema_version`, `submission_type`, `validation_status`, `submitted_at`, `ack_code`, `error_payload` |
| **ESDCParticipantSubmissionLine** (new child table) – 1:M lines mapping to each intervention/plan exported to allow audit & resubmission |
| **AuditLog** (existing event infrastructure) – ensure action plan & financial changes trigger entries |
| **ReferenceCatalog** (new generic table) – centralize enumerations (intervention codes, outcomes, result codes, funding streams) with versioning |
| **AttachmentLink** (existing `iset_document` / `iset_case_document`) – ensure linking to interventions, commitments, invoices |

### 4.4 Conceptual ER Relationships (textual)

```
Client 1───* Application *───1 Case ───1..* ActionPlan ───1..* Intervention
                          │             │                    │
                          │             │                    ├── 1..* InterventionFundingSplit ──* BudgetPot ──1 FundingAgreement
                          │             │                    ├── 0..* InterventionCommitment ───1..* Disbursement ───1..* Payment
                          │             │                    └── 0..* InterventionDocument ─── Document
                          │             └── 0..* CaseAssessment (versioned)
                          │
                          └── 0..* CaseEvent / CaseTask / CaseNote

Case ───0..* FinancialSnapshot (denormalized)
ActionPlan ───0..1 ActionPlanOutcome
ActionPlan ───0..* ActionPlanRevision (history for audit; immutable once exported)
ActionPlan ───0..* ESDCParticipantSubmission (export log)
Intervention ───0..* ESDCParticipantSubmissionLine
```

---

## 5. Gap Analysis: Current vs Target Schema

| Area | Current State | Target Requirement | Delta (Schema Actions) |
|------|---------------|--------------------|------------------------|
| **Case root** | `iset_case` lacks agreement, portfolio, lifecycle history columns | Need `agreement_id`, `portfolio_region_id`, `risk_rating`, `priority`, SSC integration IDs; ensure client linked before Approved | Add columns; enforce NOT NULL for `client_id` on Approved; create `case_assignment_history` (if not already) |
| **Assessments** | Single-row per case | Require versioning & retention of past decisions; freeze once exported | Create `iset_case_assessment_version` table; migrate current rows; add `export_lock` flag |
| **Action Plans** | Minimal fields, no agreement linkage or outcome metadata | Need FK to `funding_agreement`, result code/date, closure reason, owner roles, ILMP fields, active-plan constraint, export immutability | Alter table; add `iset_case_action_plan_history`, `iset_case_action_plan_outcome`; enforce single active plan via service validation |
| **Interventions** | Generic `intervention_code`, basic amounts | Must capture ILMP codes, NOC, duration, costing split, status gating with DB constraints | Alter table: add ILMP columns; enforce integer cost/duration; add check constraints; create `iset_case_intervention_split`, `iset_case_intervention_commitment` |
| **Budgets** | Financial snapshot only | Need budgets, commitments, disbursements, payments | Create new finance tables listed in §4.2; rely on snapshots/views for case rollup |
| **Documents** | Linked via `iset_case_document` only | Need per-intervention and per-financial artifact links | Introduce pivot tables or polymorphic linking |
| **ESDC Submissions** | Table exists but not linked to case modules | Must log per plan/intervention export, errors, ack codes, hashes | Add FKs + child lines + submission status enums + content hash |
| **Reference Data** | Enums scattered via code/config | Need centralized, versioned enumeration store exposed to UI | Create `reference_catalog` + APIs; remove hardcoded enums in UI |
| **Audit/Eventing** | `iset_case_event` exists but limited types | Must log financial approvals, plan transitions, ESDC exports | Extend enum field, ensure triggers in services |
| **API Layer** | Case workspace & action plan context only | Need CRUD for budgets, interventions, commitments, disbursements; ESDC export controls | Implement new endpoints (see §6) |

---

## 6. Endpoint Interactions & Data Flow

### 6.1 Existing Endpoints (selected)

- `GET /api/cases` – filterable case list (assignment, status).
- `GET /api/cases/:id/workspace` – aggregates case header, counts, action plans.
- `GET /api/cases/:id/action-plan/context` – merges assessment + application data.
- `POST /api/cases/:id/action-plans` – creates draft plan.
- `GET /api/cases/:id` – legacy assessment payload (for application workspace).
- Notes/messages/events endpoints (`/notes`, `/messages`, `/events`).

### 6.2 Required Endpoint Extensions

| Domain | Endpoint | Purpose |
|--------|----------|---------|
| Action Plan | `POST /api/action-plans/:id/activate` | Promote draft to active, stamp `activated_at`, enforce single active plan |
| Action Plan | `PATCH /api/action-plans/:id` | Edit plan metadata (name, dates, summary) prior to closure |
| Action Plan | `POST /api/action-plans/:id/close` | Set result code/date, capture closure summary and notes |
| Action Plan | `POST /api/action-plans/:id/archive` | Archive closed/draft plan and mark read-only |
| Action Plan | `GET /api/action-plans/:id/history` | Retrieve revision snapshots |
| Interventions | `POST /api/action-plans/:id/interventions` | Create intervention with ILMP fields |
| Interventions | `PATCH /api/interventions/:id` | Update schedule, funding splits, outcomes |
| Interventions | `POST /api/interventions/:id/close` | Record outcome, actual cost |
| Budgets | `GET/POST /api/funding-agreements`, `/budget-pots` | Manage program budgets |
| Budgets | `GET /api/cases/:id/budget` | View case-level allocations & remaining balances |
| Finance | `POST /api/cases/:id/commitments` | Create commitments tied to interventions + pots |
| Finance | `PATCH /api/commitments/:id` | Approve, adjust amounts |
| Finance | `POST /api/commitments/:id/disbursements` | Schedule payments |
| Finance | `POST /api/disbursements/:id/payments` | Record actual payment (import from finance system) |
| Finance | `GET /api/finance/forecasts` | Scenario planning (existing UI wiring) |
| ESDC | `POST /api/esdc/submissions` | Queue export; capture version references |
| ESDC | `GET /api/esdc/submissions/:id` | View status, errors, payload |
| ESDC | `POST /api/esdc/submissions/:id/retry` | Re-export corrected data |

Establish consistent DTOs mapping to normalized tables; avoid direct JSON blobs except for version histories.

---

## 7. Transition & Implementation Plan

1. **Foundation (Q4 2025)**
   - Add missing columns to `iset_case`, `iset_case_action_plan`, `iset_case_intervention` to unblock UI features (agreement FK, result fields, ILMP codes, check constraints). Introduce partial unique index enforcing at most one plan with `status IN ('draft','active')` per case.
   - Reference tables for intervention/outcome codes are in place (`esdc_intervention_code`, `esdc_intervention_outcome`); still need result codes, funding streams, NOC versions, and `/api/reference/...` endpoints for UI consumption.
   - Introduce versioned assessment table and migrate existing rows (straightforward copy since dev data only). Enforce export locks so historical revisions remain immutable post-submission.
   - Wire `/api/action-plans/:id` update/close endpoints and enforce validation (e.g., interventions required before closing).

2. **Financial Backbone (Q1 2026)**
   - Create funding agreement, budget pot, allocation, commitment, disbursement, payment tables.
   - Implement case budget summary view (materialized view or cron job populating `iset_case_financial_snapshot`).
   - Deliver commitments/disbursements APIs and UI wiring (ActionPlan -> Intervention -> Funding splits).
   - Introduce audit events for approvals and payments.

3. **ESDC Integration (Q1-Q2 2026)**
   - Extend `esdc_participant_submission` with case/plan/intervention FKs; create line table with required triplet + schema version + content hash.
   - Build exporter service generating ILMP XML from normalized tables, ensuring scheduling & retry capability and honoring export locks.
   - Add validation service aligning with ILMP schema (duration <= 60 months, NOC gating, costs integer, etc.).
   - Capture submission acknowledgements and store error payloads for triage.

4. **Advanced Controls (Q2 2026+)**
   - Implement forecasting scenarios tied to budget pots and case commitments.
   - Add NWAC-specific reporting (region vs national rollups, pot utilization dashboards).
   - Introduce soft delete/archival policies for closed plans & interventions with retention requirements.

### Migration Notes

- Dev/test only: migrations can be destructive if needed, but aim to script additive changes for future production parity.
- For new tables, create Flyway/Liquibase scripts maintaining referential integrity; ensure default values for new non-nullable columns.
- Update API layer to use transactions around multi-table writes (action plan + interventions + commitments).
- Expand automated tests covering RBAC for financial endpoints.

---

## 8. Appendix A – Key Enumeration Catalog (Target)

| Catalog | Examples | Source |
|---------|----------|--------|
| `intervention_code` | 1-20 list from ILMP schema | Seeded table `esdc_intervention_code` (`code` TINYINT, `label`, `schema_version`, `is_active`, `display_order`, timestamps) |
| `action_plan_result_code` | Ready for Work, Found Employment, Returned to School | ILMP Standard Data File |
| `intervention_outcome_code` | Complete, In progress, Incomplete, Cancelled | Seeded table `esdc_intervention_outcome` (`code` TINYINT, `label`, `schema_version`, `is_active`, `display_order`, timestamps) |
| `funding_stream` | EI, CRF, NWAC-Own | NWAC finance policy |
| `budget_category` | Skills Training, Wage Subsidy, Supports, Administration | NWAC finance structure |
| `noc_version` | 2016, 2021 | ILMP requirements |
| `commitment_status` | Draft, Submitted, Approved, Rejected, Closed | Finance workflow |
| `payment_status` | Scheduled, Sent, Reconciled, Failed | Finance integration |

---

## 9. Appendix B – Data Flow Narrative

1. **Create Case** – Application submission generates `iset_application` row; case creation links to client and seeds `iset_case` + default assessment record.
2. **Assessment** – Assessor works in workspace pulling application answers; upon submission, data stored in `CaseAssessmentVersion` and informs action plan context.
3. **Action Plan Draft** – User launches plan modal (context from `/action-plan/context`), stores to `ActionPlan` with initial metadata and revision snapshot.
4. **Add Interventions** – Each intervention captures ILMP code, schedule, funding needs; splits recorded via `InterventionFundingSplit`. Commitments created once budgets approved.
5. **Financial Approvals** – Finance officer reviews commitments, creates disbursements, and records payments. Snapshots aggregate case-level financial status.
6. **Plan Closure** – When outcomes achieved, plan result code/date captured; interventions closed with actuals. `ActionPlanOutcome` records final ILMP data.
7. **ESDC Submission** – Exporter composes participant XML from normalized tables (client + plan + interventions + financial totals); submission log captures ack/error.
8. **Reporting** – Dashboards draw from budgets, commitments, payments, and snapshots; compliance audits rely on event logs and document links.

---

This schema roadmap aligns case management activities with financial stewardship and ESDC reporting obligations, providing a consistent foundation for future development sprints. Subsequent updates should refine field-level specifications, data types, and migration scripts as additional requirements emerge.
