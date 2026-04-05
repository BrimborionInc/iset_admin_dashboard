# Case Workspace Onboarding Guide

Use this note when spinning up a fresh chat so the LLM has the context it needs to continue work on the Case management “Case Workspace” area of the admin dashboard.

---

## 1. Working Context
- The legacy `src/pages/iset` folder was renamed to `src/pages/Caseworking` and all imports were updated. Treat Case Workspace work as the canonical location; do not reintroduce `iset` paths.
- Development servers normally run concurrently: `npm start` (React dev server) and `nodemon isetadminserver.js` (backend). Assume both are running and auto-restart after changes.
- Docs we keep up-to-date:
  - `docs/change-requests/CR-0008-Cases-Dashboard-Live-Data.md` - overall Case Workspace roadmap, including table behaviour.
  - `docs/change-requests/CR-0011-Intervention-Recurrence-Persistence.md` - tracks recurring intervention cost persistence (now completed).
  - `docs/data/case-finance-data-architecture.md` - authoritative data model reference (recently refreshed with the ESDC lookup tables).
  - `docs/guides/status-lifecycle-implementation.md` - canonical reference for application/case/action-plan status logic.
  - DB snapshots + requirements live under `docs/data/` (`DB-Structure-Dump`, `ESDC/`).

## 2. Key Modules & Standards
- **Routing**: Case Workspace routes are registered in `src/routes/AppRoutes.js`.
- **Cloudscape table standard**: follow `docs/guides/cloudscape-table-persistence.md`. Recent widgets (Action Plans, Interventions) already apply the pattern (TextFilter + CollectionPreferences + Pagination + column width persistence).
- **Case Header widget** (`src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx`): renders a five-column Cloudscape `ColumnLayout` showing (in order) client name, case number, status, owner, and last-updated timestamp. The widget no longer injects a default description; titles/descriptions now come from the configurable dashboard metadata.
- **Coordinator Assessment widget** (`src/widgets/CoordinatorAssessmentWidget.js`): records the recommended intervention (code, schedule, training context) and optional ILMP-ready details (duration/cost, NOC version/code when required, childcare info) via the `/api/reference/*` lookup endpoints. When NWAC approves an assessment the backend auto-creates the initial action plan (now always seeded as `draft`, regardless of start date) and an `approved` intervention so caseworkers must explicitly activate the plan before work begins.
- **Action Plans widget**:
  - Sorted by recency (newest first) and default-selects the latest plan.
  - Uses pagination/filtering per standard.
  - Action plan modal (`ActionPlanDetailsModal.jsx`) converts dates to `YYYY-MM-DD` before submitting a PATCH to `/api/action-plans/:id`.
- **Interventions widget**:
  - Lookup labels for codes/outcomes preload during mount, so the table always shows friendly strings.
  - Recurring cost metadata (`metadata.costSettings`) is persisted and merged after create/update; reopening the modal restores the cadence fields.
  - Workspace normalisation (`CaseWorkspaceContext.jsx`) prefers metadata totals before falling back to `budget_amount`/`approved_amount`.

## 3. API Endpoints in Play
- `GET /api/cases/:caseId/workspace` – provides the entire Case Workspace payload, including action plans and interventions.
- `PATCH /api/action-plans/:id` – updates plan details (expects `YYYY-MM-DD` dates).
- `POST /api/action-plans/:id/interventions`, `PATCH /api/interventions/:id` – create/update interventions.
- Reference data loaded on demand or prefetch:
  - `GET /api/reference/intervention-codes`
  - `GET /api/reference/intervention-outcomes`
  - `GET /api/reference/funding-streams`
  - `GET /api/reference/noc-codes`
- Recurrence data currently sits inside `iset_case_intervention.metadata_json`. The database also exposes `budget_amount`, `approved_amount`, and `actual_amount`; the UI still surfaces the single total but retains recurrence metadata for future finance forecasting.

## 4. Data & DB Notes
- `esdc_intervention_code` / `esdc_intervention_outcome` tables store the ILMP lookups – each includes `code`, `label`, `schema_version` (1.4), `is_active`, `display_order`, and audit timestamps.
- `iset_case_intervention` columns: `budget_amount` is the initial cost entered, `approved_amount` reflects finance approval, `actual_amount` tracks real spend. Metadata JSON currently carries recurrence details such as `costSettings`.
- Recurring UI is intentionally a calculator that produces the ILMP-compliant single total while now preserving cadence parameters for NWAC projections.

## 5. Recent Fixes & Behavioural Updates
- Action plan editing bug: sending ISO timestamps caused DB errors; now we convert to `YYYY-MM-DD`.
- Action plan table default selection: sorts by recency and picks the newest plan.
- Client context now lives in `iset_case.case_context_json`. The Action Plan details modal exposes those client-centric fields (employment status, education, NOC version/code lookup, childcare, barriers/priorities, previous ISET) for editing; saves PATCH `/api/cases/:id` and the values are shared across all plans in the workspace payload.
- Action plan review dates now drive reminders: creating or updating a plan with a review date upserts an open reminder via `/api/reminders` (case + action_plan scoped, assigned to the plan owner when available). Clearing the review date cancels the reminder. Reminders are set to 8:00 AM local so they surface at the start of the day and trigger `case-reminders-refresh` for the calendar.
- Interventions table cost column: picks up persisted totals even after editing, thanks to new metadata merge logic.
- CR-0011 is complete (both persistence and hydration).
- Participant details widget: added as a configurable Case Workspace board item with remove menu + help panel. It seeds from intake on approval and is now the case-level source of truth for identity/contact in `case_context_json` (workspace header/compliance/export also read from this). Read mode uses locked inputs (emails have inline copy), edit mode uses Cloudscape inputs/selects aligned to intake/ESDC: biological sex (male/female), gender identity (female/male/other), legal Indigenous identity (First Nations status/non-status, Inuit, Metis), yes/no selects normalised, preferred language (en/fr), marital status labels matched to intake, band/home community autosuggest, and contact details split into tabs (main/alternate/emergency). SIN is masked for display, validated for 9 digits + checksum, and stored unmasked. Client-context saves normalise yes/no values to avoid duplicate options in selects.
- Assessment dashboard status flow: `/api/cases/:id` now returns `application_status`, the Application Overview widget listens for the normalised payload, and both the overview and NWAC widgets trigger `refreshCaseData` on submit/approval. Earlier we spent hours chasing front-end cache issues because the SQL query omitted `a.status`; always verify the API is projecting new fields before debugging UI state.
- Coordinator Assessment persistence: the `Save`, `Submit`, and NWAC completion paths now serialise the same assessment payload. Intervention code/duration/cost, NOC version/code, childcare answers, and the "previously funded" toggle map straight into the new `iset_case_assessment` columns (see `sql/20251101_01_alter_case_assessment_esdc_fields.sql`). Reloading the widget after saving should recover every field without relying on ad-hoc browser state.
- Workspace alerts: all Cloudscape `Alert` instances in the action plan/intervention widgets and modals are now dismissible so users can clear success/error banners after reviewing them.
- Payment packet creation in the Case Workspace now derives reporting unit, pot, and amount from the selected intervention (partial payments unlock amount entry), hides service period fields unless the payment type requires them, and the Manage Payments quick action focuses the first intervention with a draft/returned packet.
- Payment type options now filter by intervention code using runtime config `payment.intervention.payment_type_map`, and the backend blocks disallowed types.
- Existing-intervention backload now enforces lifecycle compatibility with the selected action plan: archived plans are blocked, closed plans accept only completed/cancelled interventions, in-progress/suspended interventions require an active plan, and historical start/result/end dates seed the stored lifecycle timestamps for backloaded plans/interventions.
- Backloaded intervention finance is now history-only: `actual_amount` on a `manual_backload` intervention writes a posted historical finance ledger entry for reporting/budget burn, but those interventions cannot generate payment packets or be submitted through the live payments workflow.

## 6. Handy Reminders When Picking Up Work
- Confirm the dev servers are running before testing UI changes.
- When touching tables, re-read the Cloudscape standard doc to ensure consistency (filter/search state persistence is expected).
- Update the relevant change request and data architecture docs whenever you modify behaviour or schema expectations.
- If you need live data context, refer to the MySQL dump in `docs/data/DB-Structure-Dump` or the ESDC requirements in `docs/data/ESDC`.
- Keep new LLM sessions aligned by referencing this guidance plus the CR documents so no context is lost between chats.
