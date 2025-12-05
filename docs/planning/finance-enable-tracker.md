Purpose: Single source for Finance module enablement decisions, milestones, and next actions.  
Audience: Finance/Casework engineers, product, ops.  
Last Updated: 2025-02-06

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

## Current Focus
- First slice: Budgets dashboard backed by pot hierarchy service (read/create/update) with seeded hierarchy; pot lookup wired for case tagging; intervention saves create finance transactions and roll up committed/actual.

## Next Actions (short)
- Implement pot lookup endpoint for case tagging.
- Add snapshot create/list endpoints once persistence is ready.
- Wire role guards for finance APIs as needed.
- Mark finance transactions as `posted` on intervention close and ensure rollups run on mutations.
- Add read endpoint for pot transactions and tighten status transitions (draft→submitted→posted) for reconciliation.
- Add guarded recalc endpoint to refresh pot rollups on demand.
- Wire Budgets widgets off remaining demo state (saved views/burn rate) once persistence exists.

## Links
- Workflow map: `docs/planning/finance-workflow-map.md`
- CR log: `docs/change-requests/CR-0003-Implementation-Log.md`
- FM user guide: `docs/change-requests/CR-0003-Financial-Management-User-Guide.md`
- Addendum plan: `docs/change-requests/CR-0003-Addendum-Plan.md`
- Dashboard guardrails: `docs/guides/configurable-dashboard-notes.md`
