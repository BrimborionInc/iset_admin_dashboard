Purpose: Capture the UX, data model, and implementation decisions for the homepage Metrics widget.
Audience: Admin dashboard engineers, product owners, and operators.
Last Updated: 2025-12-31

## Background
- The homepage is a configurable Cloudscape board that surfaces role-scoped widgets.
- Stakeholders want a compact metrics snapshot for common reporting periods.

## Goals
- Provide a Metrics widget on the homepage for all roles except System Administrator.
- Display the requested metrics for this week, this month, this quarter, and this year:
  - New Applications
  - Decisions Made
  - Active Cases
  - Funds Committed
  - Funds Spent

## Non-goals (initial)
- No drill-down views or export from the widget (unless explicitly requested).
- No System Administrator view.

## Constraints / References
- Follow `docs/guides/configurable-dashboard-notes.md` for dashboard/widget wiring.
- Use Cloudscape components and existing homepage patterns.
- Confirm data sources in `isetadminserver.js` (no assumptions about API payloads).

## Open Questions
- Define time windows: calendar-based vs rolling (week start day, timezone, quarter boundaries).
- Define each metric precisely (source tables, statuses, date fields).
- Decide if the widget needs a refresh action or auto-refresh interval.
- Confirm currency formatting for Funds Committed/Spent.

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
- Funds Committed sums `finance_transaction.amount` where status is `submitted` or `approved` and `transaction_date` (fallback `created_at`) falls in the selected period.
- Funds Spent sums `finance_transaction.amount` where status is `posted` and `transaction_date` (fallback `created_at`) falls in the selected period.
- Non-legacy application statuses include: `submitted`, `in_review`, `docs_requested`, `closure_notice`, `pending_approval`, `decision_ready`, `completed`, `closed`, `archived`.

## Proposed UX
- Board widget titled "Metrics" with a period selector (week/month/quarter/year) and a refresh action in the header.
- Five metric tiles: New Applications, Decisions Made, Active Cases, Funds Committed, Funds Spent.
- Period range label shown above tiles (e.g., `2025-01-01 - 2025-01-07`).
- Loading state uses a Cloudscape StatusIndicator; errors render a Cloudscape Alert.

## Data Model / Schema
- Response payload includes `periods.{week|month|quarter|year}` with `metrics` and date range metadata.
- Metrics values are numeric counts or currency totals; UI formats counts with `en-CA` and currency as CAD.

## API & Persistence
- New endpoint: `GET /api/dashboard/metrics`.
- Aggregates by the selected period, applying role-based scope and non-legacy statuses.
- No persistence beyond DB aggregation; widget re-fetches on refresh.

## Permissions & Visibility
- Widget available to all roles except System Administrator.
- Program Administrators see global totals; Regional Coordinators are scoped to their region; Application Assessors are scoped to their assigned cases.

## Validation & Error Handling
- If scope cannot be resolved (e.g., missing region for a Regional Coordinator), returns zeroed metrics.
- Missing tables or bad field errors return zeroed metrics to keep the dashboard usable.
- API failures surface an error alert in the widget.

## Rollout
- Pending.
