# Case Workspace Onboarding Guide

Use this note when spinning up a fresh chat so the LLM has the context it needs to continue work on the Case management “Case Workspace” area of the admin dashboard.

---

## 1. Working Context
- The legacy `src/pages/iset` folder was renamed to `src/pages/Caseworking` and all imports were updated. Treat Case Workspace work as the canonical location; do not reintroduce `iset` paths.
- Development servers normally run concurrently: `npm start` (React dev server) and `nodemon isetadminserver.js` (backend). Assume both are running and auto-restart after changes.
- Docs we keep up-to-date:
  - `docs/change-requests/CR-0008-Cases-Dashboard-Live-Data.md` – overall Case Workspace roadmap, including table behaviour.
  - `docs/change-requests/CR-0011-Intervention-Recurrence-Persistence.md` – tracks recurring intervention cost persistence (now completed).
  - `docs/data/case-finance-data-architecture.md` – authoritative data model reference (recently refreshed with the ESDC lookup tables).
  - DB snapshots + requirements live under `docs/data/` (`DB-Structure-Dump`, `ESDC/`).

## 2. Key Modules & Standards
- **Routing**: Case Workspace routes are registered in `src/routes/AppRoutes.js`.
- **Cloudscape table standard**: follow `docs/guides/cloudscape-table-persistence.md`. Recent widgets (Action Plans, Interventions) already apply the pattern (TextFilter + CollectionPreferences + Pagination + column width persistence).
- **Case Header widget** (`src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx`): description defaults to “Participant case summary information and quick actions.”
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
- Interventions table cost column: picks up persisted totals even after editing, thanks to new metadata merge logic.
- CR-0011 is complete (both persistence and hydration).

## 6. Handy Reminders When Picking Up Work
- Confirm the dev servers are running before testing UI changes.
- When touching tables, re-read the Cloudscape standard doc to ensure consistency (filter/search state persistence is expected).
- Update the relevant change request and data architecture docs whenever you modify behaviour or schema expectations.
- If you need live data context, refer to the MySQL dump in `docs/data/DB-Structure-Dump` or the ESDC requirements in `docs/data/ESDC`.
- Keep new LLM sessions aligned by referencing this guidance plus the CR documents so no context is lost between chats.
