Purpose: Capture the UX, data model, and implementation decisions for the homepage Metrics widget.
Audience: Admin dashboard engineers, product owners, and operators.
Last Updated: 2026-03-24

## Background
- The homepage is a configurable Cloudscape board that surfaces role-scoped widgets.
- Stakeholders want a compact metrics snapshot for common reporting periods.

## Goals
- Provide a Metrics widget on the homepage for all roles except System Administrator.
- Support a configurable mix of application, case, action-plan, intervention, outcome, and funding metrics.
- Allow count metrics to drill down into the shared homepage Items table without introducing a separate drilldown page.

## Non-goals (current)
- No standalone drilldown page; reuse the homepage `Work Queue Items` widget instead.
- No widget-level geography filter that scopes only Metrics.
- No System Administrator view.

## Constraints / References
- Follow `docs/guides/configurable-dashboard-notes.md` for dashboard/widget wiring.
- Use Cloudscape components and existing homepage patterns.
- Confirm data sources in `isetadminserver.js` (no assumptions about API payloads).

## Decisions (Interview Log)
- Time windows are calendar-based (week/month/quarter/year).
- Weekly windows start on Monday (aligned with existing dashboard counts).
- Timezone is derived from the signed-in user's region; if `regionId` is null, default to Ottawa (Eastern).
- Use primary IANA timezone per `canada_region.code`:
  - AB: `America/Edmonton`
  - BC: `America/Vancouver`
  - MB: `America/Winnipeg`
  - NB: `America/Halifax`
  - NL: `America/St_Johns`
  - NT: `America/Yellowknife`
  - NS: `America/Halifax`
  - NU: `America/Iqaluit`
  - ON: `America/Toronto`
  - PE: `America/Halifax`
  - QC: `America/Toronto`
  - SK: `America/Regina`
  - YT: `America/Whitehorse`
  - XX: `America/Toronto`
- New Applications count uses submission timestamp (`iset_application_submission.submitted_at`) for the period window.
- Metrics should count only current (non-legacy) statuses; legacy statuses will be dropped and should be excluded from calculations.
- Decisions Made includes both application decisions and intervention decisions.
- Application decisions are counted when `iset_application.status` is `decision_ready` (plus `completed` if it advanced post-decision), using `updated_at` in the selected period.
- Intervention decisions are counted when `iset_case_intervention.status` is `approved`, `changes_requested`, or `rejected`, using `updated_at` in the selected period.
- Active Cases count is a current snapshot of `iset_case.status` in `initiated`, `active`, `dormant`, or `ready_to_close` (shown for all periods).
- Count metrics now drill down into the existing homepage `Work Queue Items` widget, which has a separate metric-results mode and a `Back to work queue` action.
- Currency metrics remain informational only and do not open a row list.
- The metric drilldown grain must match the counted entity:
  - application metrics -> application rows
  - active cases -> case rows
  - action-plan metrics/outcomes -> action-plan rows
  - intervention metrics -> intervention rows
- `Active Cases` drilldown must include application-less client-file cases because the count is case-based.
- If homepage geography scoping is added later, it should be a shared page-level filter that drives both Metrics and the Items drilldown; do not add a Metrics-only region filter.
- Regional Coordinator metrics must honor all resolved `regionIds`, not only a single primary region id.
- Funds Committed sums `finance_transaction.amount` where status is `submitted` or `approved` and `transaction_date` (fallback `created_at`) falls in the selected period.
- Funds Spent sums `finance_transaction.amount` where status is `posted` and `transaction_date` (fallback `created_at`) falls in the selected period.
- Non-legacy application statuses include: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`, `decision_ready`, `completed`, `closed`, `archived`.

## Current UX
- Board widget titled `Metrics` with a period selector (week/month/quarter/year), metric preferences, and a refresh action in the header.
- Period range label shown below the tiles.
- Count metric values render as links when the count is non-zero.
- Selecting a count metric opens the matching rows in the homepage `Work Queue Items` widget.
- The Items widget remains queue-driven by default; metric drilldown is a temporary alternate mode rather than a fake queue bucket.
- Loading state uses a Cloudscape StatusIndicator; errors render a Cloudscape Alert.

## Data Model / Schema
- Response payload includes `periods.{week|month|quarter|year}` with `metrics` and date range metadata.
- Metrics values are numeric counts or currency totals; UI formats counts with `en-CA` and currency as CAD.
- Drilldown payload includes metric metadata plus normalized rows for the shared Items table.

## API & Persistence
- New endpoint: `GET /api/dashboard/metrics`.
- Aggregates by the selected period, applying role-based scope and non-legacy statuses.
- Drilldown endpoint: `GET /api/dashboard/metrics/details`.
- No persistence for drilldown state beyond the current browser session; the homepage board still persists layout and visible metrics in browser storage.
- No persistence beyond DB aggregation; widget re-fetches on refresh.

## Permissions & Visibility
- Widget available to all roles except System Administrator.
- Program Administrators see global totals.
- Regional Coordinators are scoped to all resolved coordinator `regionIds`.
- Application Assessors are scoped to their assigned cases.

## Validation & Error Handling
- If scope cannot be resolved (e.g., missing region for a Regional Coordinator), returns zeroed metrics.
- Missing tables or bad field errors return zeroed metrics to keep the dashboard usable.
- API failures surface an error alert in the widget.
- Drilldown failures surface an inline error in the shared Items widget instead of changing queue data.

## Rollout
- Live on homepage.
