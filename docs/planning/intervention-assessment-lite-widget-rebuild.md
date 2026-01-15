Purpose: Track design, planning, and implementation for rebuilding the Case Workspace Intervention Assessment "lite" widget from the refactored Coordinator Assessment wizard.
Audience: Admin dashboard engineers, product owners, and workflow owners.
Last Updated: 2026-01-15

# Intervention Assessment Lite Widget Rebuild

## Phase Status
- Design: Complete
- Planning: Complete
- Implementation: Complete

## Background
- The current `InterventionAssessmentWidget.jsx` is a legacy single-intervention wizard.
- The refactored `CoordinatorAssessmentWidget.js` now supports multiple interventions, cost line items, and richer review/approval flows.
- Proposed approach: rebuild a new lite widget from the refactored full widget and remove unneeded steps.

## Decision Log
- 2026-01-14: Begin evaluation of rebuilding the lite widget from the refactored full widget instead of retrofitting the legacy widget.
- 2026-01-15: Terminology set: "full" widget = Coordinator Assessment in application assessment workspace; "new lite" widget = Propose New Intervention in case management workspace. New lite must support multiple intervention proposals.
- 2026-01-15: Remove the "EI Eligibility Check" step from the new lite wizard; its status check and document upload must be integrated into the approval step.
- 2026-01-15: Include the "What is being proposed?" (framing) step; new lite should match the full widget, including the editable Cloudscape table.
- 2026-01-15: Include the "Why is this intervention needed?" (rationale) step, but align it with the existing lite widget: Rationale and Goals plus Barriers to Employment.
- 2026-01-15: Include the "How will the intervention be delivered?" (type) step; replicate full widget behavior, including per-intervention delivery paths and related functionality.
- 2026-01-15: Include the "Does the client need childcare?" step.
- 2026-01-15: Exclude the "Has the client received previous ISET funding?" step.
- 2026-01-15: Exclude the standalone "Barriers to employment" step; keep barriers embedded in the rationale step (new lite).
- 2026-01-15: Exclude the "Local area priorities (target areas)" step.
- 2026-01-15: Include the "Other funding sources" step; update the hint text for current participants to prompt changes since the original approval (new/ended sources, amount changes) and documentation to avoid double-dipping.
- 2026-01-15: Include the "What will it cost?" step; match the full widget with line-item costing and shared configuration data.
- 2026-01-15: Include the "Do you have the right supporting documents?" step.
- 2026-01-15: Include the "Review and submit" step.
- 2026-01-15: Include the "Approval and decision" step.
- 2026-01-15: Exclude the "Communication & agreement" step.
- 2026-01-15: Exclude the "Complete funding documentation" step; approval is the endpoint (create intervention/action plan on approval, no creation on denial).
- 2026-01-15: Draft/save behavior should match the full widget (same draft functionality).
- 2026-01-15: Approval requires EI eligibility status and an EI verification document (document_type.code = 'ei_verification') associated with the proposed intervention; data model implications need review.
- 2026-01-15: Do not include the conflict-of-interest declaration gate in the new lite widget; case management implies it is already satisfied upstream.
- 2026-01-15: New lite should reuse the full widget API payload shape (multi-intervention array, line-item costing), adjusting case management endpoints as needed.
- 2026-01-15: Action plan routing: if the active plan eligibility matches the proposal, approved interventions attach to that plan; if eligibility differs, create a new draft plan for the approved interventions and prevent activation until the active plan closes (warn user).
- 2026-01-15: Eligibility matching should use `iset_case_action_plan.funding_stream` (CRF/EI). Agreement number remains derived from funding stream (EI = 16535866, CRF = 16535841) per Action Plan logic.
- 2026-01-15: One EI verification document can cover all proposed interventions; EI status determines funding stream (CRF vs EI) for budget pot selection and whether a new action plan is required.
- 2026-01-15: Link the new EI verification document to each newly approved intervention via `iset_document_intervention`; do not replace or remove existing EI verification documents for prior interventions.
- 2026-01-15: If eligibility mismatches the active plan, show a non-blocking warning/confirmation that a new draft plan will be created and activation must wait until the active plan is closed.
- 2026-01-15: Decision step in new lite is minimal: approve / request changes / reject only (no full recommendation/justification/NWAC review fields).
- 2026-01-15: "Other funding sources" remains a simple text entry in the new lite widget (with updated hint text for current participants).
- 2026-01-15: Show EI eligibility + EI verification upload only when the decision outcome is "Approve" (still required to approve).
- 2026-01-15: "Request changes" requires a note; submitting it should add a note to the case file (visible in Notes & Reminders).
- 2026-01-15: "Reject" requires a reason note for audit and should be recorded in the case file.
- 2026-01-15: Approval does not create a case note; only request-changes/reject add notes.
- 2026-01-15: If there is no active action plan, require selecting an existing plan before proposing interventions; instruct the user to create a plan first.
- 2026-01-15: Action plan creation stays separate from the proposal flow. Step 1 requires selecting an existing plan; do not create plans inline. EI status stays at the end; if it mismatches the selected plan, warn/block approval and let the user reselect the correct plan.
- 2026-01-15: Action plan selection is the first step before any other steps to force plan context upfront.
- 2026-01-15: Step 1 plan selector should list all non-terminal plans (draft/planned/active), excluding closed plans.
- 2026-01-15: Exclude archived plans from the Step 1 plan selector.
- 2026-01-15: Default the Step 1 selection to the active plan when one exists.
- 2026-01-15: If a submitted proposal is pending approval, warn and block starting a new proposal at Step 1.
- 2026-01-15: Allow only one draft proposal at a time (match full widget behavior).
- 2026-01-15: Supporting documents checklist should be simplified (not full widget parity).
- 2026-01-15: Start the simplified checklist with no required items (scaffold only).
- 2026-01-15: Reuse full widget cost-line defaults/suggestions for the new lite widget.
- 2026-01-15: Use the full widget intervention delete confirmation modal (including the warning about removing cost items).
- 2026-01-15: Case note titles should be "Intervention proposal — Request changes" and "Intervention proposal — Rejected".
- 2026-01-15: "Request changes" keeps the proposal editable and blocks creating new proposals until it is resubmitted.
- 2026-01-15: Rejected proposals are read-only and do not block new proposals.
- 2026-01-15: Approved proposals should create interventions in planned status (planned/approved treated as equivalent in UI).
- 2026-01-15: Place "Other funding sources" immediately after the rationale step.
- 2026-01-15: If no eligible action plans exist, show a plain-text instruction to create one first (no link/button).
- 2026-01-15: Keep the current step order from the full widget, inserting "Other funding sources" after rationale.
- 2026-01-15: Case note body for request-changes/reject defaults to the entered reason text only (can refine during review).

## Open Questions
 (none yet)

## Planning
- Map full widget flow to new lite requirements (steps, shared utilities, payload shape).
- Design Step 1 action plan selection (default active plan, filter out closed/archived, block when pending submitted proposal).
- Rebuild multi-intervention framing/table and intervention modal using full widget behavior.
- Port type, childcare, cost (line items), and other funding steps (lite rationale variant).
- Implement simplified docs checklist scaffold (no required items yet).
- Implement decision step: approve/request changes/reject, EI eligibility + upload required on approve only.
- Implement approval routing: validate funding stream vs selected plan; block on mismatch with warning; create planned interventions on approval.
- Add case-note creation for request-changes/reject with required reason text.
- Confirm EI verification upload attaches to each approved intervention via `iset_document_intervention`.
- Manual QA: draft/save, submit, request changes, reject, approve, plan mismatch handling.

## Implementation Progress
- Replaced `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx` with the new lite wizard scaffolded from the full widget: multi-intervention framing, type, childcare, cost, simplified docs checklist, review, and decision steps.
- Added action plan selection step (Step 1) with filtering for non-terminal plans and default active plan selection.
- Implemented approve/request changes/reject decision flows with case note creation for request changes/reject and EI verification upload requirement on approve.
- Added `/api/documents/:id/link-interventions` to link EI verification documents to approved interventions (application-scoped docs).
- Fixed frontend compile issues (duplicate `updateIntervention` name collision, missing `ButtonDropdown` import).
- Updated `docs/meta/changelog.md` for user-visible changes.
- Validation: build/QA not run yet.

## Scope (Design)
- Define the required steps and data model for the lite wizard.
- Decide whether multiple interventions and line-item costing are in-scope.
- Confirm how drafts/submissions should appear in the Interventions table.

## Risks / Constraints
- UI behavior must stay consistent with case workspace permissions and status rules.
- Draft persistence and selection state will need to align with the Interventions table behavior.

## References
- src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx
- src/widgets/CoordinatorAssessmentWidget.js
