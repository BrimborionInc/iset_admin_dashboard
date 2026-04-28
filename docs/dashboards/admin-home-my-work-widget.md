# Admin Home - Work Queue Widget

Purpose: document the live homepage Work Queue widget and the queues that drive the shared `Work Queue Items` table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-04-23

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
  - sees the shared application-pipeline queues (`New Applications`, `In Assessment`, `Pending Decision`, `Pending Completion`) first
  - then sees `All Cases`
  - then sees the remaining shared admin/manager exception queues (`Unresolved Conflicts`, `Exceptions & Escalations`, `Payments Issues`, `Watchlist Hits`, `Overdue`)
- `Regional Manager`
  - sees `Applications in My Region` first
  - then sees `My Applications`
  - then sees the shared application-pipeline queues (`New Applications`, `EI Check Needed`, `In Assessment`, `Pending Decision`, `Pending Completion`)
  - then sees `Clients in My Region`
  - then sees the remaining shared admin/manager exception queues
- `ISET Coordinator`
  - sees the coordinator-specific queue set from `IsetCoordinatorWorkQueueWidget`

## Current shared application pipeline

- The shared pipeline is visible to `NWAC Administrator` and `Regional Manager`.
- `New Applications`
  - contains non-terminal applications whose normalized lifecycle status is still `submitted` and that are not yet in active assessment
  - this now includes both unassigned files and assigned files whose EI status has already been verified but that have not yet moved into `in_review`
- `Pending Assessment`
  - contains assigned non-terminal applications whose normalized lifecycle status is still `submitted` and whose EI status is still pending
  - this queue is currently visible to `Regional Manager` under the label `EI Check Needed`; for `NWAC Administrator`, those files are folded into `New Applications` instead of shown as a separate queue
  - `Awaiting EI status verification` is now a status qualifier within this queue instead of its own top-level queue card
- `In Assessment`
  - contains applications whose normalized lifecycle status is `in_review` or `awaiting_applicant`
  - applicant-wait states such as docs requested / closure-response now remain in this queue as qualifiers instead of their own top-level queue cards
- `Pending Decision`
  - is the final decision-stage queue in this pipeline
  - combines submitted application assessments plus new and revised intervention proposals waiting for decision
  - selecting it drives the shared items table into `Pending Decision Items` mode rather than opening a separate widget
  - detailed behavior for that table is documented in `docs/dashboards/admin-home-approvals-items-widget.md`
  - decision actions are still completed from the workspace after opening the selected row
  - `Open workspace` continues to pass explicit decision-entry context so the target workspace opens in a review-focused board layout and the relevant decision step instead of restoring a stale personal board or wizard position
- `Pending Completion`
  - contains decision-recorded application files that still need post-decision follow-through before the application workflow is complete
  - currently includes approved outcomes from `/api/applications`, plus denied/declined outcomes only until the denial letter has been sent
  - sending the denial letter is the terminal follow-up action for denied applications, so records with `decisionLetterSent.denial` in case context are excluded from this queue
  - is visible across the admin/manager shared pipeline and as the renamed coordinator `funding-agreements` queue so the post-decision stage is represented consistently across role homepages

## NWAC Administrator scope rule

- `All Cases` includes open client cases visible through `/api/dashboard/all-client-cases`.
- `All Cases` is case-based, not deduped by client, so multiple open files for one client count separately.
- The case queue excludes only `closed` and `archived` statuses. `Dormant` and `ready_to_close` remain in scope.
- `Pending Completion` is the exception to the non-terminal-only rule for the pipeline cards: it intentionally surfaces decision-recorded application files that still need post-decision work even when the underlying application outcome is `approved`, `rejected`, or `declined`. Denied/rejected files are removed after the denial letter is sent.

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
- The current bucket preference storage key is `home-work-queue-preferences-v5`.
- The version was bumped again when the shared application pipeline was reworked so existing browsers pick up the new queue IDs and ordering by default.
