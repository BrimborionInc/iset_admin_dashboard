# Admin Home - Work Queue Widget

Purpose: document the live homepage Work Queue widget and the queues that drive the shared `Work Queue Items` table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-05-20

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

## Inline action policy

- The item/applicant name in the `Item` column is the workspace link.
- `Open workspace` is not shown as an inline action because it repeats the item link.
- The `Actions` column is hidden when the selected queue has no secondary inline actions.
- Rows show at most two inline actions.
- `Assign` / `Reassign` is generally available for assignable application, case, watchlist, and conflict rows. It is suppressed for queues where assignment is not the row-level job, including decision, completion, approval, funding agreement, milestone/check-in, payment/proof, overdue, and escalation queues.
- Assignment action labels are owner-aware: unassigned rows show `Assign`, and rows with an owner show `Reassign`.

## Current role behavior

- `NWAC Administrator`
  - sees the shared application-pipeline queues (`New Applications`, `In Assessment`, `On Hold`, `Pending Decision`, `Pending Completion`) first
  - then sees `All Cases`
  - then sees the remaining shared admin/manager exception queues (`Unresolved Conflicts`, `Exceptions & Escalations`, `Payments Issues`, `Watchlist Hits`, `Overdue`)
- `Regional Manager`
  - sees `Applications in My Region` first
  - then sees `My Applications`
  - then sees the shared application-pipeline queues (`New Applications`, `EI Check Needed`, `In Assessment`, `On Hold`, `Pending Decision`, `Pending Completion`)
  - then sees `Clients in My Region`
  - then sees the remaining shared admin/manager exception queues
- `ISET Coordinator`
  - sees the coordinator-specific queue set from `IsetCoordinatorWorkQueueWidget`
  - `My Applications` remains first and `My Clients` appears second
  - `On Hold` shows assigned applications intentionally parked for later review

## Current shared application pipeline

- The shared pipeline is visible to `NWAC Administrator` and `Regional Manager`.
- `New Applications`
  - contains non-terminal applications whose normalized lifecycle status is still `submitted` and that are not yet in active assessment
  - this now includes both unassigned files and assigned files whose EI status has already been verified but that have not yet moved into `in_review`
  - inline actions show `Assign` for unassigned rows and `Reassign` for rows that already have an owner; assigned rows can also show `Set Eligibility` when EI status is still pending
- `Pending Assessment`
  - contains assigned non-terminal applications whose normalized lifecycle status is still `submitted` and whose EI status is still pending
  - this queue is currently visible to `Regional Manager` under the label `EI Check Needed`; for `NWAC Administrator`, those files are folded into `New Applications` instead of shown as a separate queue
  - `Awaiting EI status verification` is now a status qualifier within this queue instead of its own top-level queue card
  - inline actions can show `Assign` / `Reassign` and `Set Eligibility`, capped at two actions
- `In Assessment`
  - contains applications whose normalized lifecycle status is `in_review` or `awaiting_applicant`
  - applicant-wait states such as docs requested / closure-response now remain in this queue as qualifiers instead of their own top-level queue cards
  - explicitly parked applications with raw workflow status `on_hold` are excluded and shown in `On Hold`
  - inline actions can show `Assign` / `Reassign` and, while EI status is pending, `Set Eligibility`
- `On Hold`
  - contains applications whose raw workflow status is `on_hold`
  - holds are application-level, not case-level `dormant` status
  - the Application Overview quick action records a hold reason in `iset_application.awaiting_reason` and creates a case reminder for the selected review date
  - common hold reasons include external funding pending, future program/school start, applicant-requested pause, internal follow-up, and other hold reason
  - rows leave active assessment and decision queues until staff use `Resume review`
- `Pending Decision`
  - is the final decision-stage queue in this pipeline
  - combines submitted application assessments plus new and revised intervention proposals waiting for decision
  - selecting it drives the shared items table into `Pending Decision Items` mode rather than opening a separate widget
  - detailed behavior for that table is documented in `docs/dashboards/admin-home-approvals-items-widget.md`
  - decision actions are completed from the workspace after opening the selected row from the `Item` column
  - the selected row still passes explicit decision-entry context so the target workspace opens in a review-focused board layout and the relevant decision step instead of restoring a stale personal board or wizard position
- `Pending Completion`
  - contains decision-recorded application files that still need post-decision follow-through before the application workflow is complete
  - includes approved application assessment outcomes until the application is actually completed/closed
  - includes denied application assessment outcomes only until the denial letter is sent; sending the denial letter immediately completes the application because there are no further denial follow-up steps
  - approved application rows open Application Workspace with a post-decision step intent: `Approval letters` before the approval letter is sent, then `Funding forms and signatures` after an approval letter is recorded as sent
  - denied application rows open Application Workspace at the denial-letter step until the denial letter is sent
  - includes approved new intervention proposals and approved intervention revisions from `/api/dashboard/intervention-completion-items` until the intervention-scoped approval letter is sent
  - does not include ordinary approved/planned interventions, historical/backloaded interventions, or `auto_assessment` interventions created by an application approval, even when those rows have compatibility proposal records
  - is visible across the admin/manager shared pipeline and as the renamed coordinator `funding-agreements` queue so the post-decision stage is represented consistently across role homepages
  - has no inline action by default; staff open the workspace through the item link

## Shared exception queues

- `Unresolved Conflicts`
  - inline actions are `Assign` / `Reassign` and `Resolve`
  - reassigning a conflict row uses the normal case assignment modal and then revokes the declaring staff member's conflict where possible
- `Exceptions & Escalations`
  - assignment is suppressed because the queue action is escalation handling, not ownership management
  - `NWAC Administrator` rows show `Respond` and `Resolve`
  - `Regional Manager` rows show `Respond` and `Escalate to NWAC Administrator`
- `Watchlist Hits`
  - keeps assignment available so staff can route a matched file for manual review
- `Overdue`
  - has no inline action by default; staff open the workspace through the item link and handle the overdue work in context

## NWAC Administrator scope rule

- `All Cases` includes open client cases visible through `/api/dashboard/all-client-cases`.
- `All Cases` is case-based, not deduped by client, so multiple open files for one client count separately.
- The case queue excludes only `closed` and `archived` statuses. `Dormant` and `ready_to_close` remain in scope.
- `Pending Completion` is the exception to the non-terminal-only rule for the pipeline cards: it intentionally surfaces decision-recorded application files that still need post-decision work. Approved rows remain until the application is completed/closed after approval-letter and funding-doc follow-through. Denied rows remain only until the denial letter is sent, because the denial-letter send completes the application.

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

## ISET Coordinator scope rule

- `My Applications` includes assigned application rows loaded through `/api/applications` for the coordinator's application workflow statuses.
- `My Clients` includes open client case files assigned directly to the signed-in coordinator through `/api/dashboard/my-client-cases`.
- `My Clients` uses `iset_case.assigned_staff_profile_id` as the assignment source and is case-based, not deduped by client.
- The client-case queue excludes only `closed` and `archived` statuses. `Dormant` and `ready_to_close` remain in scope.
- `My Clients` is a case-navigation queue, so assignment/reassignment is suppressed in its row actions.

## Widget settings behavior

- Queue cards are removable from the homepage board like other widgets.
- Within the widget, `Work queue preferences` controls which queue cards are visible.
- The current bucket preference storage key is `home-work-queue-preferences-v5`.
- The version was bumped again when the shared application pipeline was reworked so existing browsers pick up the new queue IDs and ordering by default.
- The ISET Coordinator bucket preference key is `home-iset-coordinator-work-queue-preferences-v2`; it was bumped when `My Clients` was added so existing browsers pick up the new second-position queue by default.
