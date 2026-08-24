# CR-0003 – Financial Administration & Reporting Module  
_Implementation Log & Chat Handoff Notes_
Last Updated: 2025-12-07

Current role boundary (2026-08-24): PATH has only System Administrator, NWAC Administrator, Regional Manager, and ISET Coordinator sign-in roles. Finance and Sage work outside PATH; this historical implementation log does not authorize a separate Finance user or group.

## 1. Purpose
Track progress, decisions, and outstanding work for the CR-0003 implementation. Use this document to resume work across chat sessions without re-reading the full change request.

## 2. Current Scope Snapshot
* **Side navigation** – `Financial Management` section scaffolded with nine dashboard links (`finance/overview`, `budgets`, `allocations`, `reconciliation`, `reports`, `monitoring`, `forecasting`, `payments`, `settings`).
* **Routing** – Placeholder pages created in `src/pages/finance/` with breadcrumb wiring and guards in `src/routes/AppRoutes.js`.
* **Access control** – Finance routes added to `src/config/roleMatrix.json`, surfaced in `AccessControlMatrix`, and merged automatically with server state via `mergeWithBaseRoutes` in `RoleMatrixContext`.
* **UI** - Finance Overview and Budgets dashboards run on configurable Cloudscape boards with widget-level help. Budgets is wired to the finance pot API for CRUD, draft/publish, snapshots (with safety restore), saved views, pot detail (3-col overview + tabs, export dropdown), CSV export endpoint, burn-rate widget (live metrics + risk tagging), and a guarded Structure Manager (parent guard, inline draft labels). Payments board is scaffolded per addendum with mock data (queue, detail, comms, SLA). Allocations remains a configurable board scaffold (transfer wizard, approvals, history, policy exceptions, snapshots) pending live data; other finance pages still use placeholder containers.

## 3. Completed Work (latest session)
| Date (UTC) | Item | Files |
|------------|------|-------|
| 2025-10-18 | Added nav section and finance route stubs | `src/layouts/SideNavigation.js`, `src/routes/AppRoutes.js`, `src/pages/finance/*` |
| 2025-10-18 | Updated role matrix defaults + Access Control labels | `src/config/roleMatrix.json`, `src/context/RoleMatrixContext.js`, `src/widgets/AccessControlMatrix.jsx` |
| 2025-10-18 | Scaffolded Finance Overview configurable board with KPIs, trend, compliance, deadlines | `src/pages/finance/FinanceOverviewPage.jsx`, `src/pages/finance/widgets/*`, `src/helpPanelContents/financeOverview*.js` |
| 2025-10-18 | Scaffolded Finance Budgets board (hierarchy, pot detail, saved views, burn-rate, active view) with contextual help and persistent preferences | `src/pages/finance/FinanceBudgetsPage.jsx`, `src/pages/finance/widgets/Budget*.jsx`, `src/helpPanelContents/financeBudget*.js`, `docs/guides/cloudscape-table-persistence.md`, `src/routes/AppRoutes.js` |
| 2025-10-20 | Scaffolded Finance Allocations board (transfer wizard, approvals queue, timeline, policy exceptions, snapshots) with contextual help | `src/pages/finance/FinanceAllocationsPage.jsx`, `src/pages/finance/widgets/Allocation*.jsx`, `src/helpPanelContents/financeAllocation*.js` |
| 2025-10-20 | Added Budgets Structure Manager scaffold (shared data context, create/edit pot UI, draft publishing, snapshots) and refreshed help content | `src/pages/finance/FinanceBudgetsPage.jsx`, `src/pages/finance/widgets/BudgetsDataContext.jsx`, `src/pages/finance/widgets/BudgetStructureManagerWidget.jsx`, `src/pages/finance/widgets/Budget*.jsx`, `src/helpPanelContents/financeBudgetStructureManagerHelp.js` |
| 2025-10-20 | Scaffolded Finance Reconciliation board (transactions queue, exception detail, bulk actions, sync status) with table persistence + help content | `src/pages/finance/FinanceReconciliationPage.jsx`, `src/pages/finance/widgets/Reconciliation*.jsx`, `src/helpPanelContents/financeReconciliation*.js`, `src/routes/AppRoutes.js` |
| 2025-10-18 | Added Cloudscape table persistence notes for future dashboards | `docs/guides/cloudscape-table-persistence.md` |
| 2025-12-05 | Finance Budgets wired to live pot API: CRUD + draft/publish, snapshots with restore safety, pot parent guard, inline draft labels, and case intervention pot selection feeding committed/actual rollups; Structure Manager, draft controls, and snapshot modals refined | `src/pages/finance/FinanceBudgetsPage.jsx`, `src/pages/finance/widgets/Budget*.jsx`, `src/pages/finance/widgets/BudgetStructureManagerWidget.jsx`, `src/pages/intake/interventions/*`, `sql/20250206_create_finance_budget_tables.sql` |
| 2025-12-07 | Saved views hooked to `finance_saved_view` API + DB; Budgets widgets refreshed (loaded view/summary palette defaults, pot detail 3-col view with tabs/actions/export dropdown, CSV export endpoint); burn-rate widget reads live metrics with risk tagging | `src/pages/finance/widgets/Budget*.jsx`, `src/pages/finance/widgets/BudgetsDataContext.jsx`, `src/pages/finance/FinanceBudgetsPage.jsx`, `src/helpPanelContents/financeBudget*.js`, server finance endpoints |
| 2025-12-07 | Scaffolded Finance Payments board (queue, detail, communications, SLA widgets) with mock data and help content per addendum | `src/pages/finance/FinancePaymentsPage.jsx`, `src/pages/finance/widgets/Payment*.jsx`, `src/pages/finance/widgets/PaymentsDataContext.jsx`, `src/helpPanelContents/financePayment*.js`, `docs/change-requests/CR-0003-Addendum-Plan.md` |

## 4. Outstanding Tasks
1. **Allocations wiring** - Connect transfer/reallocation flows (draft/publish pattern), approvals, history, and policy exception widgets to live services.
2. **Reconciliation/transactions** - Expose pot transaction history endpoint + UI; harden status transitions (draft→submitted→posted) and evidence links.
3. **Forecasting/variance** - Add auto-forecasting (system-generated) and clarify variance vs adjusted; remove manual placeholder.
4. **Rollup integrity** - Add guarded recalc endpoint/background checks for pot rollups; extend burn-rate/snapshot consistency tests.
5. **Exports/reporting** - Extend exports beyond CSV (PDF/JSON) and align saved-view filters; build Reports/Monitoring/Forecasting/Settings boards with scoped widgets.
6. **Role scope & telemetry** – Keep access within the four canonical PATH roles, confirm object scope for read-only/audit views, and hook telemetry for `agreement_id`/`report_id` events.
7. **Payments wiring** – Connect Payments board to services for packet ingest, confirmations, GL/region metadata, and evidence storage; replace mock data context.

## 5. Open Questions / Dependencies
* Do program partners require separate access to sub-agreement dashboards, or will they continue using existing portals?
* Which API endpoints are already available for finance data versus those that must be implemented?
* Confirm design system assets (icons, board widgets) for finance KPIs—reuse existing board layout or move to page templates?

## 6. Next Suggested Steps
1. Finalize live endpoints/contracts for Allocations and Reconciliation (transfers, approvals, transaction history, evidence) and wire the existing boards.
2. Implement forecasting/variance service + UI (replace manual column) and add rollup recalculation guardrails/background checks.
3. Extend exports (PDF/JSON) and build remaining Reports/Monitoring/Forecasting/Settings boards using the established configurable board pattern.
4. Wire Payments board to services (packet ingest, confirmations, GL/regional context, evidence) and align with addendum widgets.

## 7. Notes for Future Sessions
* When loading in a real environment, verify the server-side role matrix has been refreshed (Access Control → “Restore defaults”) so finance routes appear without local overrides.
* Keep an eye on line endings (repo mixes CRLF/LF in some files); stick to UTF-8 via `apply_patch` or Python scripts.
* If tokens are tight, reference this log plus the original CR (`docs/change-requests/CR-0003-Financial Module.md`) for requirement details.
* Finance dashboards must expose `Add widget` / `Reset layout` header actions that dispatch `<dashboard>:openPalette` and `<dashboard>:resetLayout` events (mirror Finance Overview & Budgets).
