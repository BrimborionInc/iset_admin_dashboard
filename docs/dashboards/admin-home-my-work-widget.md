# Admin Home - Work Queue Widget

Purpose: document the live homepage Work Queue widget and the queues that drive the shared `Work Queue Items` table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-04-15

## Scope

- Route: `/`
- Widget title: `Work Queue`
- Shared items table: `Work Queue Items`
- Frontend implementation:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/IsetCoordinatorWorkQueueWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Backend implementation: `isetadminserver.js`

## Current role behavior

- `NWAC Administrator`
  - sees `All Applications` first
  - then sees `All Cases`
  - then sees `Approvals`
  - then sees the remaining shared admin/manager queue set (`Unassigned Applications`, `Unresolved Conflicts`, `EI Eligibility Checks`, `Exceptions & Escalations`, `Payments Issues`, `Watchlist Hits`, `Marked for Closure`, `Overdue`)
- `Regional Manager`
  - sees `Applications in My Region` first
  - then sees `Clients in My Region`
  - then sees `Approvals`
  - then sees `My Applications`
  - then sees the remaining shared admin/manager queue set
- `ISET Coordinator`
  - sees the coordinator-specific queue set from `IsetCoordinatorWorkQueueWidget`

## Current Approvals queue

- The shared `Approvals` queue is visible to `NWAC Administrator` and `Regional Manager`.
- It combines submitted application assessments with new intervention proposals waiting for decision.
- Selecting `Approvals` drives the shared items table into `Approvals Items` mode rather than opening a separate widget.
- Current detailed behavior for that table is documented in `docs/dashboards/admin-home-approvals-items-widget.md`.
- Approval decisions are completed from the workspace after opening the selected row.
- `Open workspace` now passes explicit approval-entry context so the target workspace opens in a review-focused board layout and the relevant decision step instead of restoring a stale personal board/wizard position.

## NWAC Administrator scope rule

- `All Applications` includes all non-terminal applications visible through `/api/applications?excludeTerminal=1`.
- `All Cases` includes open client cases visible through `/api/dashboard/all-client-cases`.
- `All Cases` is case-based, not deduped by client, so multiple open files for one client count separately.
- The case queue excludes only `closed` and `archived` statuses. `Dormant` and `ready_to_close` remain in scope.
- The applications queue excludes terminal application statuses, including normalized terminal variants such as `approved`, `completed`, `withdrawn`, `cancelled`, `closed`, and `archived`.

## Regional Manager scope rule

- `Applications in My Region` includes all non-terminal applications visible to the Regional Manager through `/api/applications?excludeTerminal=1`.
- `Clients in My Region` includes non-terminal client cases visible through `/api/dashboard/regional-client-cases`.
- Region scope is resolved from all assigned `regionIds`, including `staff_region` mappings when present.
- For Regional Managers, `/api/applications` includes:
  - applications assigned to staff whose `staff_profiles.region_id` is in the manager's resolved region set
  - applications assigned directly to the Regional Manager
  - unassigned applications whose applicant address province/territory code matches one of the manager's resolved region codes
- For Regional Managers, `/api/dashboard/regional-client-cases` includes:
  - cases assigned directly to the Regional Manager
  - cases assigned to staff whose `staff_profiles.region_id` is in the manager's resolved region set
  - cases whose `iset_case.portfolio_region_id` is in the manager's resolved region set
- `Clients in My Region` is case-based, not deduped by client, so multiple open files for one client count separately.
- The client-case queue excludes only `closed` and `archived` statuses. `Dormant` and `ready_to_close` remain in scope.
- The applications queue excludes terminal application statuses, including normalized terminal variants such as `approved`, `completed`, `withdrawn`, `cancelled`, `closed`, and `archived`.

## Widget settings behavior

- Queue cards are removable from the homepage board like other widgets.
- Within the widget, `Work queue preferences` controls which queue cards are visible.
- The current bucket preference storage key is `home-work-queue-preferences-v4`.
- The version was bumped when `All Applications` and `All Cases` were added so the new NWAC Administrator queues are visible by default in existing browsers, while Regional Manager browsers also pick up the new default ordering.
