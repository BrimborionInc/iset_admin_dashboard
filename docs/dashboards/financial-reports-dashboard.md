# Financial Reports Dashboard

Purpose: capture the current live behavior of `Budgets and Finance > Financial Reports` so future threads can extend the finance-reporting surface without reverse-engineering the page and endpoints from code.
Audience: admin dashboard engineers, finance/reporting reviewers, and product owners.
Last Updated: 2026-07-08

## Scope

- Route: `/finance/reports`
- Page source: `src/pages/finance/FinanceReportsPage.jsx`
- Help content: `src/helpPanelContents/financeReportsHelp.js`
- Excel export helper: `src/pages/finance/financeInterventionReportExport.js`
- Filter-options endpoint: `GET /api/finance/reports/intervention-funding/filter-options`
- Live data endpoint: `GET /api/finance/reports/intervention-funding`

## Current intent

- This page is the Budgets and Finance reporting surface for the annual `ISET Advances and Active Clients` report.
- The live view is an approved-funding report, not a live payments ledger.
- Approved funding is based on intervention approval timing and approved expense.
- Intervention detail defaults to funded interventions only so zero-dollar reportable rows do not clutter the advances view. Staff can switch the row-scope selector to all reportable interventions when they need to review zero-dollar rows, including denied-application reporting records.
- Payment follow-up status is shown beside each intervention so staff can see whether the related packet work is still draft, ready to send, sent to finance, needs follow-up, reported paid, confirmed by evidence, stale/no response, or cancelled.
- An optional `Include carry-over` toggle adds a best-effort cross-fiscal estimate using payment-line dates when available and the intervention schedule as fallback.
- User-facing guidance is structured as an approved-funding review job aid: set report scope, read the summary and regional totals, inspect intervention detail, use carry-over only when needed, export the current visible rows, and check filters/approval basis before investigating a number that looks wrong.

## Current controls

- Fiscal year
- Region (one or more provinces / territories)
- Include carry-over
- Intervention detail row scope:
  - `Funded interventions only` (default)
  - `All reportable interventions`
- Local detail-table text filter
- Intervention detail table preferences for visible columns and stored column widths
- Intervention detail sorting on all visible columns
- Default intervention detail columns focus on funding review fields: participant, region, funding source, approved funding, PATH follow-up state, intervention, and funding-category amounts.

## Current data rules

- Geography is participant home province / territory, using submission-address province first and client-address province as fallback.
- The report grain is one row per intervention.
- The default visible row set excludes interventions whose approved total is zero; the API still returns the full approved row set for the selected fiscal year/region and the frontend applies the row-scope selector.
- Approved-date basis is `COALESCE(ci.reviewed_at, ci.created_at)`.
- Manual historic/backloaded interventions should carry their inferred historic approval date in `iset_case_intervention.reviewed_at`; for those records, PATH entry time remains in `created_at` for audit and must not drive fiscal-year reporting.
- Approved totals use approved intervention expense, with fallback to budget/intervention cost when needed.
- Funding source resolution prefers the action-plan budget pot funding source and then falls back to plan/intervention funding-stream fields.
- Only `CRF` and `EI` rows are included.
- Included intervention statuses currently align with approved-funding homepage metrics:
  - `approved`
  - `in_progress`
  - `suspended`
  - `completed`

## Current output

- Summary cards:
  - total advances
  - CRF advances
  - EI advances
  - funded client count
  - funded intervention count as a separate card in the default row scope; the card changes to reportable interventions when staff switch to all reportable rows
- Optional carry-over summary section with:
  - carry-over from prior FY
  - carry-over to next FY
  - selected-FY estimated amount
- Region summary table with:
  - participants
  - interventions
  - CRF advances
  - EI advances
  - total advances
- Intervention detail table with:
  - default visible columns: participant, region, funding source (`CRF` / `EI`), approved funding amount, intervention, tuition, books/materials, living, childcare, wage/project, and other
  - optional table-preference columns: approved date, start/end dates, institution / partner, program / position, status, PATH payment follow-up status, optional carry-over estimate / adjustment, and budget pot
- Participant reference numbers are not shown in the visible participant cell to reduce clutter, but case/tracking references remain searchable in the detail text filter.
- The intervention secondary line now appears only when it adds different context, such as an intervention title or action plan name. It no longer repeats the intervention label in different casing.

## Excel export

- The page exports the currently filtered dataset, including the local text filter.
- The export uses the current intervention row scope, so the default workbook excludes zero-dollar rows unless staff switch to all reportable interventions first.
- Workbook layout:
  - `Summary`
  - `CRF Detail`
  - `EI Detail`
- Export is intentionally closer to workbook-style approved-funding review than to the old demo dashboard.

## Current limitations

- Approved funding is the main report basis; the finance-follow-up fields are a clean PATH operational summary, not a full payment-history ledger or Sage ledger.
- `Recorded paid` amounts/dates are PATH-side paid/confirmed records from payment follow-up or posted finance transactions; Finance/Sage remains the financial system of record.
- Approved category columns are derived from intervention cost-line data and scaled to the approved total when needed so row totals reconcile, which means category amounts are presentation/reporting allocations rather than a separate authoritative ledger.
- Carry-over is best-effort only. It uses stored payment-line dates first, then derived intervention schedules when no live payment lines exist, so it should be treated as a planning/reconciliation aid rather than a definitive accounting ledger.
- This page replaced the earlier finance-reporting demo/widget scaffold; `Add widget` / `Reset layout` no longer apply here.
- The route-level help and section-level info links are written as staff-facing job aids rather than implementation notes. The page also has seeded admin-AI guidance for the annual report purpose, default funded-intervention scope, Excel export scope, PATH-vs-Sage payment-status caveat, and explicit comparison questions when staff ask why finance advances do not match an operational reporting view.
