# Case Workspace Canonical Data Migration Plan
_Last updated: 2025-01-03_

## Objective
Identify and eliminate residual reliance on `iset_application(payload_json)` (and submission snapshots) inside the Case Workspace. Case-managed participant/context data should come from `iset_case.case_context_json`, seeded on approval and owned by casework. Align validation, export, and UI reads to this canonical source.

## Scope
- Case Workspace frontend (CaseWorkspaceContext, widgets under `src/pages/Caseworking`).
- Backend workspace/validation/export endpoints in `isetadminserver.js`.
- Participant fields (identity, SIN, DOB, gender, Indigenous identity, address/contact) plus assessment/action-plan metadata that currently fall back to application payload.

## Approach
- **Inventory data flows**: Catalog all workspace widgets/hooks and note which fields they display/edit; list their API calls and expected payload fields (caseContext, compliance, exportPreview, etc.).
- **Trace backend sources**: For each workspace endpoint (`/api/cases/:id/workspace`, validate/prepare ILMP, action plans, participant save), map which DB tables/columns they read/write (`case_context_json` vs `payload_json`). Flag any JSON_EXTRACT from `iset_application` or submission snapshots.
- **Static search sweep**: Run targeted searches for `payload_json`, `submission_snapshot`, `answers`, and `iset_application` across `src/pages/Caseworking`, `src/widgets`, and `isetadminserver.js` to catch lingering application-based reads in case flows.
- **Field-by-field matrix**: Build a matrix for key participant/assessment fields (SIN, DOB, gender, address, Indigenous identity, contact, action-plan metadata) showing current source and consumers (widget, validator, exporter).
- **Runtime spot-checks**: Use dev DB cases to call workspace and related endpoints, inspecting JSON to confirm actual payloads (caseContext vs application-derived fallbacks). Note missing/duplicated fields.
- **Prioritise dependencies**: Rank remaining `iset_application` dependencies by risk (staleness/privacy) and migration effort—especially validation/export, header display, filters, finance.
- **Migration map**: For each high-priority dependency, document the replacement source in `case_context_json`, required schema/seed adjustments, and any needed backfill to keep data available.
- **Confirm tests/UX**: Ensure validations (ILMP) and export previews run from canonical case data; note any UI edits that don’t propagate downstream.
- **Rollout shape**: Plan dual-read → single-read transitions with backfill/feature flags if needed; retire application fallbacks once coverage is validated.

## Deliverables
- Dependency audit matrix (field → current source → consumer → target source).
- Issue list of hotspots to migrate, with risk/effort tags.
- Migration steps (backend extractors, API response tweaks, UI read updates, backfill tasks).
- Rollout checklist and validation steps.

## Notes
- `case_context_json` is seeded on approval; application/submission stay immutable for audit.
- Keep intake/ESDC option mappings consistent to avoid regressions when switching sources.
- Masking stays UI-only; stored SIN remains 9 digits unmasked in case context.

## Progress Log
- **2025-01-03 – Inventory data flows (Stage 1)**  
  - Reviewed Case Workspace widgets: CaseHeader (status/compliance/client summary), ParticipantDetails (caseContext editor via PUT /api/cases/:id), ActionPlans/Interventions (case action plan APIs), SupportingDocuments/SecureMessaging/Notes/Calendar (case-linked collections), CompliancePanel/ExportPreview (driven by validate/prepare ILMP responses), FinancePanel (finance summary payload).  
  - Workspace wiring: `CaseWorkspaceContext` consumes `/api/cases/:id/workspace` and stores `caseContext`, `compliance`, `exportPreview`, action plans, documents, notes; `prepareIlmpExport`/`runComplianceChecks` call ILMP endpoints.  
  - Initial observation: front-end widgets already lean on `caseContext` where editable (participant details); header/compliance/export rely on backend-composed payloads, so backend sourcing will be key in later stages.
- **2025-01-03 – Static code sweep (Stage 2)**  
  - Searched workspace frontend/backend for `payload_json`/`submission_snapshot`/`iset_application` references.  
  - Frontend case workspace widgets show no direct `payload_json` reliance; they consume `caseData` supplied by workspace API.  
  - Backend `/api/cases/:id/workspace` response still pulls identity fallbacks from `iset_application.payload_json` (e.g., `payload_personal_first_name`, `payload_answers_first_name`, `payload_preferred_name`, `payload_reference_number`) to build client name, DOB, tracking ID. Assessment fields also fall back to case/assessment row values and application extracts.  
  - ILMP validation/export paths already use `case_context_json` first (recent extractor update), but workspace payload still mixes application-derived fields for header/client metadata—targets for migration in next stage mapping.
- **2025-01-03 – Backend source mapping (Stage 3 – in progress)**  
  - `/api/cases/:id/workspace` query joins `iset_application` and extracts multiple `payload_json` fields for client identity, DOB, preferred name, and tracking ID. Name/DOB fallbacks: `client` table → `payload_personal_*` → `payload_answers_*`. Tracking ID: `payload_reference_number` or submission reference.  
  - Case watches endpoints also join `iset_application`/submission to display applicant name/email/tracking in watch metadata.  
  - Validation/export endpoints (validate/prepare ILMP) now source participant fields from `case_context_json` first; remaining dependency is the workspace payload composition above.  
  - Next actions: define replacements from `case_context_json` (e.g., `caseContext.applicationPersonal`/`applicationAnswers` or direct `caseContext` fields) for header/client/tracking, eliminate application joins/JSON extracts, and adjust dependent UI fields accordingly.
- **2025-01-03 – Implementation slice: workspace identity/tracking off application payload**  
  - Updated `/api/cases/:id/workspace` response composition to derive client first/last/preferred names and DOB from `case_context_json` (applicationPersonal/applicationAnswers and top-level caseContext), with fallback to `client` table only. Removed use of `iset_application.payload_json` name/DOB/reference fields.  
  - Tracking ID now prefers submission reference (join retained) then case_number/CASE-{id}.  
  - Remaining items: remove any residual application payload fetches in workspace response; consider simplifying watch endpoints to use case_context/case_number/submission reference without application joins if feasible.
- **2025-01-03 – Implementation slice: case watch create payload**  
  - Simplified `/api/cases/:caseId/watch` response: drop `iset_application` name/email dependency; use `case_context_json` (applicationPersonal/applicationAnswers) for applicant name, and submission reference/case number for tracking. Retained submission join only for reference number. Applicant email omitted (not stored in case context).  
  - Next: evaluate removing the remaining application join in watch listing and workspace response if no longer needed for other fields.
- **2025-01-03 – Implementation slice: watch listing & messaging sourcing**  
  - Case watch listing now uses `case_context_json` for applicant name and submission ref/case number for tracking; removed applicant/application payload reliance (only submission join remains for reference).  
  - Secure messaging (send to applicant) now resolves applicant name/tracking from `case_context_json` and submission reference/case number; removed `payload_json` applicant_name/signature fallback.  
  - Workspace response uses case-created timestamp (not application.created_at) for submittedAt.
- **2025-01-03 – Remaining scope**  
  - Outstanding application payload references live outside case workspace flows (e.g., application versioning, analytics/search) and are out of scope for case-context migration.  
  - Workspace/header/watch/message paths now source identity/tracking from case context + submission reference; ILMP validation/export already case-context-first. Plan complete for workspace migration.
