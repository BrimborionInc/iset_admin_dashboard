Purpose: Single source for Finance module enablement decisions, milestones, and next actions.  
Audience: Finance/Casework engineers, product, ops.  
Last Updated: 2025-12-05

# Finance Module Enablement Tracker

## Scope
- Wire Finance dashboards from scaffold to production: budgets, allocations, payments, reconciliation, monitoring, reporting, forecasting, settings.
- Track shared decisions, dependencies, and cross-thread progress. Keep concise and current.

## Milestones (working list)
- M0 — Baseline pots live (DB + API) and Budgets dashboard reads real data.
- M1 — Case interventions can tag pots; payment requests created against pots.
- M2 — Finance approvals + reconciliation write back to pots; evidence linked.
- M3 — Monitoring/reporting live with certified exports; forecasting published.
- M4 — Settings (hierarchy/approvals/mapping) editable in-app; roles finalized.

## Decision Log
- 2025-02-06: Core entities to add — `budget_pot`, `budget_snapshot`, `budget_allocation` (transfer), `finance_transaction` (case-linked), optional pot lookup view. Start Budgets wiring first with real pot API, plus case→pot picker reuse.
- 2025-02-06: Migration added `budget_pot`, `budget_snapshot`, `budget_snapshot_pot`, `budget_allocation`, `finance_transaction` with full dummy hierarchy seed (files: `db/migrations/20250206_0007_create_finance_budget_tables.sql` for reference; active runner uses `sql/20250206_create_finance_budget_tables.sql`).
- 2025-02-06: Finance pot API live (list/get/create/update + lookup); Budgets UI now consumes API instead of demo data; case Intervention modal uses lookup.
- 2025-02-06: Intervention create/update now upserts `finance_transaction` for selected pot (amount from actual→approved→cost) and refreshes pot committed/actual rollups. Lookup route ordering fixed (was shadowed by `/:id`).
- 2025-02-06: Structure Manager wired to live pot API; snapshots backed by `budget_snapshot`/`budget_snapshot_pot` with list/create/read endpoints; Budgets loads snapshots.
- 2025-12-05: Draft workflows live in Budgets: Draft Budgets tab shows/controls drafts; Structure manager edits selected draft only; publish replaces Active after taking a safety snapshot; restore snapshot creates a new draft. Snapshots and drafts have delete/restore modals; draft labels inline-editable. Pot parent guard prevents self-parenting. Admin % column now reads `adminTargetPct`.
- 2025-12-05: Roles for finance endpoints limited to `System Administrator` and `Program Administrator`. Snapshot creator stored as NULL to avoid FK issues.
- 2025-12-05: Forecast column remains manual (placeholder); variance = forecast - adjusted. Auto-forecasting deferred.
- 2025-12-07: Saved views rewired to real API + DB table (`finance_saved_view`); UI now creates/edits/deletes views per active budget version. Loaded view/summary widgets moved to palette by default.
- 2025-12-07: Pot detail widget refreshed (3-col overview, tabs, actions/export dropdown); CSV export endpoint added (`GET /api/finance/budget-pots/:id/export?format=csv`).
- 2025-12-07: Burn-rate widget now reads live pot metrics (adjusted/actual/forecast/variance) with simple risk tagging; risk filter listens to loaded view presets.

## Current Focus
- Budgets dashboard now runs live: pot CRUD, draft/publish, snapshots, pot selection for case interventions. Case-linked finance transactions roll into committed/actual. Draft and snapshot UX refined.

## Next Actions (short)
- Add auto-forecasting (system-generated) and clarify variance vs adjusted; remove manual placeholder.
- Wire Allocations/reallocation flows to draft/publish pattern; expose transfers and approvals.
- Expose pot transaction history endpoint and UI; harden status transitions (draft→submitted→posted) for reconciliation.
- Add guarded recalc endpoint for pot rollups and background consistency checks.
- Extend exports beyond CSV (PDF/JSON) and align with saved views filters.

## Links
- Workflow map: `docs/planning/finance-workflow-map.md`
- CR log: `docs/change-requests/CR-0003-Implementation-Log.md`
- FM user guide: `docs/change-requests/CR-0003-Financial-Management-User-Guide.md`
- Addendum plan: `docs/change-requests/CR-0003-Addendum-Plan.md`
- Dashboard guardrails: `docs/guides/configurable-dashboard-notes.md`
