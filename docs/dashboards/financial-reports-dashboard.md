# Financial Reports Dashboard

Purpose: capture the current live behavior of `Budgets and Finance > Financial Reports` so future threads can extend the finance-reporting surface without reverse-engineering the page and endpoints from code.
Audience: admin dashboard engineers, finance/reporting reviewers, and product owners.
Last Updated: 2026-05-11

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
- Payment follow-up status is shown beside each intervention so staff can see whether the related packet work is still draft, ready to send, sent to finance, needs follow-up, reported paid, confirmed by evidence, stale/no response, or cancelled.
- An optional `Include carry-over` toggle adds a best-effort cross-fiscal estimate using payment-line dates when available and the intervention schedule as fallback.

## Current controls

- Fiscal year
- Region (one or more provinces / territories)
- Include carry-over
- Local detail-table text filter

## Current data rules

- Geography is participant home province / territory, using submission-address province first and client-address province as fallback.
- The report grain is one row per intervention.
- Approved-date basis is `COALESCE(ci.reviewed_at, ci.created_at)`.
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
  - CRF advances
  - EI advances
  - participant count
  - intervention count
- Optional carry-over summary section with:
  - carry-over from prior FY
  - carry-over to next FY
  - current FY estimated amount
- Region summary table with:
  - participants
  - interventions
  - CRF advances
  - EI advances
  - total advances
- Intervention detail table with:
  - participant
  - region
  - approved date
  - intervention
  - start/end dates
  - institution / partner
  - program / position
  - status
  - PATH payment follow-up status
  - tuition/books/living/childcare/wage-other category amounts
  - total advances
  - optional carry-over estimate / adjustment
  - budget pot

## Excel export

- The page exports the currently filtered dataset, including the local text filter.
- Workbook layout:
  - `Summary`
  - `CRF Detail`
  - `EI Detail`
- Export is intentionally closer to workbook-style finance review than to the old demo dashboard.

## Current limitations

- Approved funding is the main report basis; the finance-follow-up fields are a clean PATH operational summary, not a full payment-history ledger or Sage ledger.
- `Recorded paid` amounts/dates are PATH-side paid/confirmed records from payment follow-up or posted finance transactions; Finance/Sage remains the financial system of record.
- Approved category columns are derived from intervention cost-line data and scaled to the approved total when needed so row totals reconcile, which means category amounts are presentation/reporting allocations rather than a separate authoritative ledger.
- Carry-over is best-effort only. It uses stored payment-line dates first, then derived intervention schedules when no live payment lines exist, so it should be treated as a planning/reconciliation aid rather than a definitive accounting ledger.
- This page replaced the earlier finance-reporting demo/widget scaffold; `Add widget` / `Reset layout` no longer apply here.
