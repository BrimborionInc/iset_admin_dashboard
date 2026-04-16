# Admin Home - Approvals Items Widget

Purpose: document the live approvals-mode behavior of the shared homepage `Work Queue Items` table.
Audience: admin dashboard engineers, product owners, and operators.
Last Updated: 2026-04-15

## Scope

- Route: `/`
- Queue trigger: `Approvals` in the homepage `Work Queue`
- Widget title in this mode: `Approvals Items`
- Visible to: `NWAC Administrator`, `Regional Manager`
- Frontend implementation:
  - `src/pages/home/HomeDashboardPage.jsx`
  - `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`
  - `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- Backend implementation: `isetadminserver.js`

## Current queue contents

- Submitted application assessments waiting for program decision
  - sourced from `GET /api/dashboard/awaiting-approval-items`
  - current application status filter is `pending_approval`
- New intervention proposals waiting for review
  - sourced from `GET /api/dashboard/intervention-approval-items`
  - current intervention status filter is `submitted` or `in_review`

## Current table behavior

- The shared `Work Queue Items` table switches into an approvals-focused column set when the selected bucket is `approvals`.
- The current columns are:
  - `Tag`
  - `Item`
  - `Province`
  - `EI status`
  - `Owner`
  - `Timeline target`
  - `Actions`
- `Actions` is intentionally limited to `Open workspace`.
- Do not expose inline `Make Decision` or `Assign` actions in this mode. Approval decisions are completed inside the workspace.

## Current column rules

- `Item`
  - title line is the applicant name
  - secondary detail shows only funded proposed payment items
  - payment items are grouped under the intervention type
- `Province`
  - uses the applicant submission address province/territory when available
- `EI status`
  - uses `assessment_esdc_eligibility` from the case assessment for both approval types
  - blank values are shown as `Not yet verified`
- `Timeline target`
  - uses the same due/overdue badge style as the rest of the homepage work queue
  - is forced to the `Program decision` timing target from `Configuration > Workflow timing targets`
  - badge text is intentionally compact (`Due in 2 days`, `Due today`, `3 days overdue`)
  - the full `Program decision ...` wording remains in the badge tooltip

## Current routing and date anchors

- Application approvals
  - `Open workspace` goes to `/application-case/:id?entry=approval&approvalType=application&step=decision`
  - the application workspace now opens an approval-review board layout with `ISET Application Form`, `Supporting Documents`, and `Application Assessment`
  - `Application Assessment` now lands on `Approval and decision` instead of restoring the last saved wizard step
  - the approvals timing anchor currently uses `a.updated_at` as the best available proxy for when the file entered `pending_approval`
- Intervention approvals
  - `Open workspace` goes to `/cases/:caseId?entry=approval&approvalType=intervention&step=decision&interventionId=...&planId=...`
  - the case workspace now opens an approval-review board layout with `Case header`, `Proposed new intervention`, `Participant details`, and `Supporting documents`
  - the case workspace uses the queue-provided intervention/action-plan context so `Intervention assessment` loads the correct proposal and lands on `Record of decision`
  - intervention approval is committed from `Record of decision`; optional decision-letter preparation is available separately after the decision is recorded and is not part of the stepper
  - the approvals timing anchor currently uses `COALESCE(ci.updated_at, ci.created_at)`

## Current guardrails

- Do not infer budget-pot assignment for application approvals when no explicit pot is stored. The approvals table now uses `EI status` instead of a derived budget guess.
- Do not show unfunded proposed intervention rows in the `Item` breakdown.
- Keep this table as a launch point into the real record. Detailed review and the final approval or rejection action belong in the workspace, not in the homepage table.
