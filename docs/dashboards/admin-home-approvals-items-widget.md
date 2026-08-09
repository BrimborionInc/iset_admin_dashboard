# Admin Home - Pending Decision / Pending Review Items Widget

Purpose: document the live pending-decision/review-mode behavior of the shared homepage `Work Queue Items` table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-08-09

## Scope

- Route: `/`
- Queue triggers: `Pending Decision` for NWAC Administrator; `Pending Review` for Regional Manager
- Widget title in this mode: `Pending Decision Items` or review-focused item wording
- Visible to: `NWAC Administrator`, `Regional Manager`
- Frontend implementation:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Backend implementation: `isetadminserver.js`

## Current queue contents

- Submitted application assessments waiting for program decision or RM review
  - sourced from `GET /api/dashboard/awaiting-approval-items`
  - active `iset_review_workflow.current_stage` is authoritative even when the compatibility application status/lifecycle has drifted
  - Regional Managers receive rows only when the review workflow is `rm_review` or `returned_to_rm`
  - NWAC Administrators receive rows when the review workflow is `nwac_review`, plus legacy/off-toggle pending decisions with no review-workflow row
  - the Application Work Queue drilldowns use the same contract through `/api/applications?bucket=awaiting-my-approval` and `/api/applications?bucket=awaiting-decision`; their tile counts and list predicates must remain aligned
- New and revised intervention proposals waiting for review
  - sourced from `GET /api/dashboard/intervention-approval-items`
  - current intervention status filter is `submitted` or `in_review`
  - Regional Managers receive rows only when the review workflow is `rm_review` or `returned_to_rm`
  - NWAC Administrators receive rows when the review workflow is `nwac_review`, plus legacy/off-toggle submitted proposals with no review-workflow row
- Operationally this bucket is "all decision work waiting on approvers", even though only the application side maps cleanly to a single application lifecycle stage.

## Current table behavior

- The shared `Work Queue Items` table switches into a decision/review-focused column set when the selected bucket is `pending-decision` or `pending-review`.
- The current columns are:
  - `Tag`
  - `Item`
  - `Province`
  - `EI status`
  - `Owner`
  - `Timeline target`
  - `Actions`
- `Actions` is intentionally limited to `Open workspace`.
- Do not expose inline `Make Decision` or `Assign` actions in this mode. Decisions are completed inside the workspace.
- Regional Managers use `Pending Review` for application-assessment, new-intervention, and intervention-amendment review/sign-off work. They do not record final decisions.

## Current column rules

- `Item`
  - title line is the applicant name
  - first subtext line shows the approval request type (`New application assessment`, `Additional intervention proposal`, or `Proposed change to intervention`)
  - revised intervention rows show one compact amendment scale line when the source baseline can be resolved: `Net change +/-$X · Revised total $Y`
  - secondary detail shows only funded proposed payment items
  - payment items are grouped under the intervention type
- `Province`
  - uses the applicant submission address province/territory when available
- `EI status`
  - application-assessment rows use the selected application's assessment EI value
  - new-intervention rows use the proposal's explicit `metadata.review.eiStatus`; they do not borrow the case assessment value
  - revision rows use that explicit proposal value when present and otherwise fall back only to the same parent Action Plan's `EIClaimant`
  - blank values are shown as `Not yet verified`
- `Timeline target`
  - uses the same due/overdue badge style as the rest of the homepage work queue
  - is forced to the `Program decision` timing target from `Configuration > Workflow timing targets`
  - badge text is intentionally compact (`Due in 2 days`, `Due today`, `3 days overdue`)
  - the full `Program decision ...` wording remains in the badge tooltip

## Current routing and date anchors

- Application decisions
  - `Open workspace` goes to `/application-case/:id?entry=approval&approvalType=application&step=decision`
  - the application workspace now opens an approval-review board layout with `ISET Application Form`, `Supporting Documents`, and `Application Assessment`
  - approval mode now seeds that board as the starting layout for queue launches without overwriting the user's saved normal board, and the usual board quick actions/reset still work afterward
  - `Application Assessment` now lands on `Approval and decision`; explicit approval-entry step intent beats local wizard-step memory and no longer gets bounced back by the Cloudscape navigation-priming workaround
  - the decision timing anchor currently uses `a.updated_at` as the best available proxy for when the file entered `pending_approval`
- Intervention decisions
  - `Open workspace` goes to `/cases/:caseId?entry=approval&approvalType=intervention&step=decision&interventionId=...&planId=...`
  - the case workspace now opens an approval-review board layout with `Case header`, `Proposed new intervention`, `Participant details`, and `Supporting documents`
  - approval mode now seeds that board as the starting layout for queue launches without overwriting the user's saved normal case board, and the usual board quick actions/reset still work afterward
  - the case workspace uses the queue-provided intervention/action-plan context so `Intervention assessment` loads the correct proposal and lands on `Record of decision` instead of snapping back to a stored draft step during selection/hydration
  - intervention decision is committed from `Record of decision`; optional decision-letter preparation is available separately after the decision is recorded and is not part of the stepper
  - the decision timing anchor currently uses `COALESCE(ci.updated_at, ci.created_at)`

## Current guardrails

- Do not infer budget-pot assignment for application decisions when no explicit pot is stored. The table uses `EI status` instead of a derived budget guess.
- Do not show unfunded proposed intervention rows in the `Item` breakdown.
- Keep this table as a launch point into the real record. Detailed review and the final decision action belong in the workspace, not in the homepage table.
- Preserve `application_id` on every application queue row and workspace link. A case can have multiple applications, so a queue route must never reopen whichever application happens to be primary for the case.
- Preserve exact intervention application lineage as well. Proposal and Action Plan application ids must agree and belong to the case; do not use the case-primary application as a fallback for queue rows or links.
- An applied revision evidence row is audit history, not a second operational intervention. Do not count it or emit a second approval/completion item; the source intervention's exact revision-follow-up marker owns any required completion work.
