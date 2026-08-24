Purpose: Capture the core Finance module workflows and keep a live map that aligns scaffolding with upcoming wiring work.  
Audience: Finance/Casework engineers, product owners, ops.  
Last Updated: 2025-02-06

# Finance Module Workflow Map

Context: Finance dashboards/widgets are scaffolded with mock data. This map names the end-to-end spines we need to wire, the states/outputs they must emit, and the UI touchpoints already in place. PATH has only the four canonical casework roles; Finance works outside PATH. Keep this file updated as flows go live.

## Plan / Budgeting
- Inputs: funding agreements, fiscal periods, pot hierarchy, admin cap %, ceilings, owners.
- Validations: totals vs envelope; admin cap; required codes/owners; versioning/snapshots.
- States: draft → approved → adjusted → frozen (per snapshot).
- Outputs: pot tree with approved/adjusted/committed/actual/forecast; snapshots; audit trail.
- Ownership: PATH administrators maintain PATH-side planning data; external Finance leadership owns accounting approval outside PATH.
- UI scaffold: `src/pages/finance/FinanceBudgetsPage.jsx`, widgets `BudgetHierarchyWidget.jsx`, `BudgetPotDetailWidget.jsx`, `BudgetSavedViewsWidget.jsx`, `BudgetStructureManagerWidget.jsx`, data via `BudgetsDataContext.jsx` + `financeDemoData.js`.

## Allocate / Reallocate
- Inputs: source/dest pots, amount, justification, policy exceptions, approvals.
- Validations: pot availability; policy thresholds; role gates; routing (Program → Finance → Exec).
- States: proposed → pending approvals → approved/rejected → applied (snapshot).
- Outputs: allocation records, approvals log, updated pot balances/snapshots.
- Ownership: PATH program staff prepare the proposal; external Finance/leadership approval remains outside PATH.
- UI scaffold: `src/pages/finance/FinanceAllocationsPage.jsx`; widgets `AllocationTransferWizardWidget.jsx`, `AllocationApprovalsWidget.jsx`, `AllocationPolicyWidget.jsx`, `AllocationHistoryWidget.jsx`, `AllocationSnapshotsWidget.jsx`; mock data context.

## Request / Pay (Payments)
- Inputs: payment packets (EFT/invoice), pot link, documents, requester notes, approval refs.
- Validations: required fields (banking, invoice metadata), pot/commitment match, SLA/routing, evidence presence.
- States: draft → awaiting release → ready to send → sent to finance → payment confirmed → closed/cancelled.
- Outputs: payment queue, packet detail, comms log, SLA metrics, confirmations.
- Ownership: PATH program staff prepare and send the handoff; Finance/AP reviews and processes it outside PATH; PATH staff record follow-up.
- UI scaffold: `src/pages/finance/FinancePaymentsPage.jsx`; widgets `PaymentRequestsWidget.jsx`, `PaymentDetailWidget.jsx`, `PaymentCommunicationWidget.jsx`, `PaymentSlaWidget.jsx`; `PaymentsDataContext.jsx` (mock).

## Reconcile
- Inputs: transactions feed, pot/budget mapping, evidence attachments, exceptions.
- Validations: GL/pot match, date/period, duplicate detection, evidence completeness, variance thresholds.
- States: unreviewed → matched → exception (pending) → resolved → posted.
- Outputs: reconciled ledger by pot, exception queue, bulk actions log, sync status.
- Ownership: External Finance/AP reconciles accounting records; PATH administrators may record operations-side follow-up and evidence.
- UI scaffold: `src/pages/finance/FinanceReconciliationPage.jsx`; widgets `ReconciliationTransactionsWidget.jsx`, `ReconciliationExceptionDetailWidget.jsx`, `ReconciliationBulkActionsWidget.jsx`, `ReconciliationSyncStatusWidget.jsx`; `ReconciliationDataContext.jsx` (mock).

## Monitor / Control
- Inputs: evidence coverage, findings, sampling tasks, compliance thresholds (admin rate, overspend).
- Validations: evidence % per pot/period; admin cap; variance; sampling rules.
- States: healthy → warning → exception/open tasks → resolved.
- Outputs: findings list, tasks, coverage dashboards, alerts.
- Ownership: PATH program leadership drives PATH tasks; external Finance resolves accounting findings.
- UI scaffold: `src/pages/finance/FinanceMonitoringPage.jsx`; widgets `MonitoringEvidenceCoverageWidget.jsx`, `MonitoringFindingsWidget.jsx`, `MonitoringSamplingTasksWidget.jsx`, `MonitoringBundlesWidget.jsx`; `MonitoringDataContext.jsx` (mock).

## Report / Certify
- Inputs: period close, reconciled totals, certifications, export params.
- Validations: period completeness; approvals gathered; variance explanations; evidence links.
- States: in-prep → ready-for-cert → certified → exported; history retained.
- Outputs: statement exports, certification records, export history.
- Ownership: PATH administrators prepare PATH-side outputs; external Finance/leadership owns accounting certification.
- UI scaffold: `src/pages/finance/FinanceReportsPage.jsx`; widgets `ReportsLifecycleWidget.jsx`, `ReportsValidationSummaryWidget.jsx`, `ReportsCertificationWidget.jsx`, `ReportsExportHistoryWidget.jsx`; `ReportsDataContext.jsx` (mock).

## Forecast
- Inputs: budgets/actuals/commitments, scenarios, assumptions (admin rate, growth, timing).
- Validations: pot mapping; policy limits; scenario completeness.
- States: scenario draft → reviewed → approved → published.
- Outputs: forecast vs budget/actual charts, commits, comparisons.
- Ownership: PATH administrators maintain PATH-side scenarios; external Finance leadership approves accounting use outside PATH.
- UI scaffold: `src/pages/finance/FinanceForecastingPage.jsx`; widgets `ForecastingScenarioWorkspaceWidget.jsx`, `ForecastingChartWidget.jsx`, `ForecastingComparisonWidget.jsx`, `ForecastingCommitWidget.jsx`; `ForecastingDataContext.jsx` (mock).

## Settings / Config
- Inputs: hierarchy/terminology, approval routes, GL mappings, evidence/policy toggles, role matrix granularity.
- Validations: uniqueness; referential use; role compatibility; policy bounds.
- States: draft → approved → effective (versioned).
- Outputs: config bundle used by all other flows; audit trail.
- Ownership: System Administrator / NWAC Administrator for PATH configuration; external Finance leadership for policies outside PATH.
- UI scaffold: `src/pages/finance/FinanceSettingsPage.jsx` (placeholder), planned widgets in `docs/change-requests/CR-0003-Addendum-Plan.md`.

## Upkeep
- Keep this file current as each flow gains real data/API wiring and as states/policies are finalized.
- Cross-check with: `docs/change-requests/CR-0003-Implementation-Log.md`, `docs/change-requests/CR-0003-Financial-Management-User-Guide.md`, `docs/change-requests/CR-0003-Addendum-Plan.md`, and `docs/guides/configurable-dashboard-notes.md` for dashboard guardrails.
