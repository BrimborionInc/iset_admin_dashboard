# Admin Home Metrics Widget

Purpose: document the live behavior of the homepage Metrics widget and its drilldown into the shared Items table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-04-14

## Scope

- Route: `/`
- Widget title: `Metrics`
- Visible to: Program Administrator, Regional Coordinator, Application Assessor
- Hidden from: System Administrator

## Current UX

- The widget shows configurable metrics for `This week`, `This month`, `This quarter`, and `This year`.
- Currency metrics (`Funds approved`, `Funds committed`, `Funds actual`) are display-only.
- Count metrics are links. Selecting one opens the matching records in the existing `Work Queue Items` widget.
- The `Work Queue Items` widget switches into a dedicated metric-results mode with neutral columns and a `Back to work queue` action.
- If the user previously removed `Work Queue Items` from the board, selecting a metric restores that widget automatically.
- Selecting a queue in the Work Queue widget exits metric-results mode and returns the Items table to queue-driven behavior.

## Current data model

- Summary endpoint: `GET /api/dashboard/metrics`
- Drilldown endpoint: `GET /api/dashboard/metrics/details?metricId=<id>&period=<week|month|quarter|year>`
- Backend implementation: `isetadminserver.js`
- Frontend implementation:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/MetricsWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`

## Metric drilldown mapping

- `newApplications`, `inReview`, `awaitingApproval`, `approved`, `denied`
  - drill down to application rows
  - open Application Workspace when a linked case exists; otherwise fall back to the assignment dashboard
- `activeCases`
  - drills down to case rows
  - includes application-less client-file cases because the metric count is case-based
  - opens Case Workspace
- `actionPlansStarted`, `employed`, `returnedToSchool`
  - drill down to action-plan rows tied to a case
  - opens Case Workspace
- `newInterventionProposals`, `interventionsCompleted`
  - drill down to intervention rows tied to a case
  - opens Case Workspace

## Scope rules

- Program Administrator: global scope
- Regional Coordinator: all resolved `regionIds` from the current staff context
- Application Assessor: assigned-owner scope (`assigned_staff_profile_id`, with legacy `assigned_to_user_id` fallback during transition)

Important:

- The metrics scope helper in `isetadminserver.js` must honor `regionIds`, not just a single `regionId`, or Regional Coordinator counts and drilldowns will diverge.

## UX guardrails

- Do not fake metric drilldown as another queue bucket. Queue mode and metric-results mode in `Work Queue Items` are intentionally separate.
- Do not add a Metrics-only region filter. If homepage geography scoping is needed in the future, make it a shared page-level filter that drives both Metrics and the Items drilldown.
- `Active cases` is a current snapshot metric. The period selector does not change that list; only the other count metrics are period-windowed.
- Funding semantics for the currency tiles are now:
  - `Funds approved`: intervention funding approved in PATH during the selected period.
  - `Funds committed`: finance transactions submitted to finance during the selected period.
  - `Funds actual`: finance transactions marked paid in PATH during the selected period.
