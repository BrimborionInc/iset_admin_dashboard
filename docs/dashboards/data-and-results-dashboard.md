# Data And Results Dashboard

Purpose: capture the current live behavior of `Reporting > Data and Results` so future threads can extend the reporting surface without reverse-engineering the page from code.
Audience: admin dashboard engineers, product owners, and reporting reviewers.
Last Updated: 2026-03-24

## Scope

- Route: `/reporting/data-and-results`
- Page source: `src/pages/reporting/DataAndResultsDashboard.jsx`
- Help content: `src/helpPanelContents/dataAndResultsDashboardHelp.js`
- Live data endpoint: `GET /api/reporting/data-and-results/live-report`
- Drilldown endpoint: `GET /api/reporting/data-and-results/drilldown`
- Quarterly uploads endpoint: `GET /api/reporting/data-and-results/quarterly-uploads`

## Current layout

- The page uses fixed report controls above a removable Cloudscape board of full-width report sections.
- Default section order:
  - `Intake and Assessment`
  - `Interventions`
  - `Overall Results Targets vs Year-end Results`
  - `Quarterly Data Uploads`
  - `Client Results`
  - `ILMP Data Uploads`
  - `Status of Action Plans`
  - `Additional Comments`
- Layout persistence key: `reporting-data-and-results-layout.v2`
  - The key was bumped when `Intake and Assessment` was added so existing users pick up the new default order instead of only seeing the section in `Add section`.

## Shared report controls

- Participant home province / territory
- Case manager
- Fiscal year
- Results view (`Cumulative` / `Monthly`)
- Demo mode

The page-level province/territory and case-manager filters apply to `Intake and Assessment`, `Interventions`, `Overall Results`, `Client Results`, `ILMP Data Uploads`, and `Status of Action Plans`.

`Quarterly Data Uploads` remains agreement-wide and does not change with those slice-and-dice filters.

## Intake And Assessment section

- Title: `Intake and Assessment`
- Structure: province/territory rows with fiscal-year month columns
- Header controls:
  - `Show`: `New applications`, `Approved applications`, `Denied applications`
  - `Filter provinces`: local text filter for the row labels/codes
- CSV export is available from the board-item menu and exports the currently visible filtered view.
- In live mode, non-zero cells are drillable.
  - Clicking a cell opens an inline detail panel directly beneath the clicked province row.
  - The detail panel shows contributing application records with linked applicant names.
  - Applicant links open `Application Workspace` at `/application-case/:caseId` when a linked case exists; applications without a case fall back to the standard assignment/dashboard route.
- Drilldown window rules:
  - cumulative view: fiscal-year start through the clicked month
  - monthly view: only the clicked month
  - `Final (p14)` in monthly view still represents the full fiscal-year total, so its drilldown uses the full fiscal-year window

### Live data rules

- New applications use `iset_application_submission.submitted_at`.
- Approved applications use `iset_application.updated_at` as the current decision-month proxy when status is `approved` or `completed`.
- Denied applications use `iset_application.updated_at` as the current decision-month proxy when status is `rejected` or `declined`.
- Participant geography is resolved from the application payload with fallback to the submission payload, using the same participant home province/territory field as the rest of the report.
- Case-manager filtering uses `iset_case.assigned_to_user_id` when a linked case exists.

Important limitation:

- PATH does not currently persist a dedicated application decision timestamp/history table, so approved/denied month buckets are based on the application row's last status-update timestamp proxy. Do not describe these counts as exact historical decision-event dates in UX copy or docs until the source model improves.

## Interventions section

- Title: `Interventions`
- Structure: intervention-type rows with fiscal-year month columns
- Header controls:
  - `Show`: `Count` / `Cost`
  - `Status`: `Completed` / `Planned` / `Active` / `Cancelled`
  - `Date`: `By start date` / `By end date` for count mode; cost mode is fixed to payment month
- In live mode, non-zero cells are drillable.
  - Clicking a cell opens an inline detail panel directly beneath the clicked intervention row.
  - Count drilldowns list the contributing interventions for the clicked row/month window.
  - Cost drilldowns list the contributing intervention payment-month allocations, including the amount allocated into the clicked value.
  - Participant links open `Case Workspace` at `/cases/:caseId`.
- Drilldown window rules:
  - cumulative view: fiscal-year start through the clicked month
  - monthly view: only the clicked month
  - `Final (p14)` in monthly view still uses the full fiscal-year window because the visible final value remains cumulative

## Drilldown guardrails

- The drilldown panel is row-anchored, not a detached modal or page-level results area. Only one drilldown stays open per section at a time.
- Demo mode currently does not open drilldown lists; drilldown is live-data-only.
- The drilldown rows must reconcile to the same bucketing rules used by the summary matrices:
  - application approvals/denials use the application row `updated_at` proxy
  - intervention count drilldowns use the currently selected start/end-date basis
  - intervention cost drilldowns use payment-month allocation

## Demo data rules

- Demo mode includes sample province-by-month counts for the new Intake and Assessment section.
- The sample counts are internally consistent with the rest of the report in broad shape:
  - new applications exceed approvals and denials
  - province filtering narrows the visible rows
  - the shared cumulative/monthly toggle changes how the same sample counts are presented

## Files to inspect together

- `src/pages/reporting/DataAndResultsDashboard.jsx`
- `src/helpPanelContents/dataAndResultsDashboardHelp.js`
- `isetadminserver.js`
- `docs/AGENTS.md`
