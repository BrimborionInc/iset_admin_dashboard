# ISET Coordinator Homepage Wiring Plan

Purpose: Track requirements, decisions, and progress for wiring the ISET Coordinator Home page.

Audience: Admin dashboard engineers and reviewers.

Last Updated: 2025-12-27

## Scope
- Wire the ISET Coordinator view of `src/pages/home` from scaffold to functional UI.
- Follow Cloudscape patterns and configurable dashboard guidance.

## Constraints
- Confirm wizard steps, validations, status transitions, and role gating before implementation.
- Do not assume API payloads or backend support; verify before wiring.
- Use Cloudscape components and existing UI patterns.

## Status
- Read `docs/README.md` and `docs/guides/configurable-dashboard-notes.md`.
- Reviewed Program Admin / Regional Coordinator home page wiring in `src/pages/home/HomeDashboardPage.jsx`, `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`, and `src/pages/home/widgets/WorkQueueItemsTableWidget.js`.

## Open Questions
- Pending: Define required wizard steps, validations, status transitions, and role gating for the coordinator view.

## Progress Log
- 2025-10-11: Initialized plan and reviewed mandatory dashboard guidance.
- 2025-10-11: Reviewed Program Admin / Regional Coordinator home page implementation to mirror patterns for the coordinator view.
- 2025-10-11: Asked to confirm wizard steps before implementation per stated working style constraints.
- 2025-10-11: Noted updated instruction to ignore wizard-step requirement; continuing single-question interview only.
- 2025-10-11: User prefers implementation choices that align with existing home page architecture; clarifying coordinator bucket scope next.
- 2025-10-11: Preparing recommendation on whether to keep or adjust the ISET Coordinator bucket list.
- 2025-10-11: Confirmed to keep the existing 10 ISET Coordinator buckets.
- 2025-10-11: Confirmed coordinator queues should be limited to items assigned to the signed-in coordinator.
- 2025-10-11: Agreed to implement queues one at a time to validate columns and actions.
- 2025-10-11: User wants to follow Program Admin/Regional Manager home page column conventions (standard Item column).
- 2025-10-11: User expects proactive UX decisions aligned to existing home page patterns; start with “My New Applications.”
- 2025-10-11: Coordinator “My New Applications” should be simplified to “Applications assigned to me” (no acknowledged/contacted field).
- 2025-10-11: Provided canonical application status list from status lifecycle guide for filtering decisions.
- 2025-10-11: Updated status lifecycle guide to reflect current application status set (closure_notice, legacy terminal values, hold variants).
- 2025-10-11: Re-listed application statuses for alignment and re-asked scope question on including closed/archived items.
- 2025-10-11: Confirmed "Applications assigned to me" includes submitted, in_review, docs_requested, closure_notice, pending_approval statuses.
- 2025-10-11: Updated Applications widget empty-state text and user-facing hint copy.
- 2025-10-11: Shortened coordinator bucket label, simplified hint text, and hid Owner column for assessor queue items.
- 2025-10-11: Clarified scope difference between My Applications and Missing Docs queues; gathering Missing Docs status criteria.
- 2025-10-11: Proposed Missing Docs queue statuses (docs_requested + closure_notice plus hold/legacy variants) and treating it as a focused subset for follow-ups.
- 2025-10-11: Confirmed Missing Docs queue can overlap with My Applications (subset allowed).
- 2025-10-11: Wired Missing Docs queue to assigned applications with hold/closure statuses; enabled selection and user-facing description.
- 2025-10-11: Added Secure Messaging automation to set application status to docs_requested when sending forms from submitted/in_review.
- 2025-10-11: Searched for a `keepOpen` prop in secure messaging multiselect; no occurrences found yet.
- 2025-10-11: Updated Application Overview status badge to show "Docs Requested X days ago" for action-required statuses.
- 2025-10-11: Added severity-based badge coloring for Docs Requested by days overdue.
- 2025-10-11: Applied severity thresholds to SLA Status when overdue (0-3 neutral, 3-6 low, 7-14 medium, 15-28 high, >28 critical).
- 2025-10-11: Updated Missing Docs queue status column to use Docs Requested age badge and relabeled Due to SLA Target with stage-aware labels.
- 2025-10-11: Applied the same status badge and SLA Target column treatment to the My Applications queue.
- 2025-10-11: Noted that the new status/SLA display pattern should be reused for future queues and will be applied to Program Admin/Regional Manager queues when requested.
- 2025-10-11: Applied the enhanced Status badge and SLA Target display to Program Admin and Regional Manager queue items.
- 2025-10-11: Made the Item column applicant name a workspace link aligned with the Open workspace inline action.
- 2025-10-11: Linked applicant names in Program Admin/Regional Manager queue lists and detail views to their workspace paths.
- 2025-10-11: Ready to resume ISET Coordinator queue build-out and select the next queue to implement.
- 2025-10-11: Proposed EI Consent / EI Verification Pending as the next coordinator queue; awaiting criteria and data source confirmation.
- 2025-10-11: Enabled the EI Consent / EI Verification Pending queue with user-facing hint text and eligibility-missing filter on assigned applications.
- 2025-10-11: Renamed the queue label to “EI Verification Pending.”
- 2025-10-11: Moving to File Complete: Processing Due queue; awaiting criteria for what marks a file complete and due.
- 2025-10-11: Proposed File Complete queue vision (assigned files with required docs complete, now approaching SLA for assessment/decision); asked for the canonical “file complete” signal.
- 2025-10-11: Clarified File Complete vs Approvals Pipeline: pre-approval processing due vs post-assessment approvals workflow.
- 2025-10-11: Renamed File Complete queue to “Ready to assess,” updated hint text, enabled bucket, and filtered to assigned submitted/in_review items with completed EI eligibility.
- 2025-10-11: Renamed Approvals Pipeline to “Awaiting Approval,” updated hint text, enabled the bucket, and wired it to pending approval items.
- 2025-10-11: Added automatic status revert from docs_requested to in_review when all secure-message signing requests are signed.
- 2025-10-11: Fixed missing useRef import for SecureMessagingWidget after adding signed-forms status update.
- 2025-10-11: Added backend status flip on signing_request completion to update queues without opening the workspace.
- 2025-10-11: Added portal backend status flip on signing_request completion so queues update without opening the workspace.
- 2025-10-11: Attempted DB verification for signing-status updates; MySQL not reachable on localhost:3306 in this environment.
- 2025-10-11: Verified in the DB that ISET-20251226-1B854A has all signing_requests signed and application status set to in_review.
- 2025-10-11: Consolidated Supporting Documents table row actions into an Actions dropdown to reduce inline action clutter.
- 2025-12-27: Updated supporting document source handling to distinguish application submission vs secure message attachments vs digitally signed forms.
- 2025-12-27: Confirmed Supporting Documents widget is shared across application and case workspaces (single component file).
- 2025-12-27: Reconfirmed the Supporting Documents widget is the same component in both workspaces.
- 2025-12-27: Adjusted supporting documents duplicate action visibility and application labels for the application workspace.
- 2025-12-27: Renamed Supporting Documents column header to "Application" in the application workspace view.
- 2025-12-27: Investigated missing checklist doc for ISET-20251226-1B854A; found signed doc stored without application_id, so it doesn't match when applicant has multiple applications.
- 2025-12-27: Adjusted signing-request flow to capture application_id for application workspace sends while keeping case workspace requests case-only.
- 2025-12-27: Updated supporting documents to display submission reference numbers in the application workspace instead of application IDs.
- 2025-12-27: Removed the "Application" prefix from reference numbers in the application workspace document list.
- 2025-12-27: Expanded Supporting Documents help panel content to cover filters, columns, checklist behavior, and actions.
- 2025-12-27: Fixed Supporting Documents help text to avoid JSX expression in example labels.
- 2025-12-27: Adjusted Supporting Documents help text example to avoid JSX parsing errors.
- 2025-12-27: Set signed-form document labels to the document type label instead of the filename.
- 2025-12-27: Prevented duplicate status labels in application select lists by suppressing redundant status tags.
- 2025-12-27: Removed the redundant "Outcome notice" info alert from Coordinator Assessment review step.
- 2025-12-27: Clarified the "Read only" submit label behavior for the Coordinator Assessment wizard (shows when submit is gated/disabled).
- 2025-12-27: DB check on read-only assessment: application is pending_approval with an active application_lock and eligibility/conflict declarations set.
- 2025-12-27: Returned to ISET Coordinator queue build-out; prompting for next queue to implement.
- 2025-12-27: Awaiting Approval queue confirmed complete; selecting next coordinator queue.
- 2025-12-27: Proposed Funding Agreements to Complete / Sign as the next coordinator queue to implement.
- 2025-12-27: Shared vision for Funding Agreements queue and noted second-row focus on post-approval case/intervention work.
- 2025-12-27: Discussing funding agreement trigger criteria before wiring the queue.
- 2025-12-27: Confirmed starting trigger: post-approval with funding details defined and no signed funding agreement yet.
- 2025-12-27: Proposed using assessment cost + budget pot as the concrete “funding details defined” signal for the funding agreement queue.
- 2025-12-27: Discussed shifting Funding Agreements queue toward case/intervention focus while still gating on application approval status.
- 2025-12-27: Implemented Funding Agreements queue using approved applications with cost + budget pot set and no signed funding agreement; added backend fields to support filtering.
- 2025-12-27: Discussing prefilled funding agreement form generation and send flow before wiring the signature request.
- 2025-12-27: User asked whether to start building the funding agreement form; need template/field list confirmation.
- 2025-12-27: User asked whether DB access is still available; respond on current environment constraints.
- 2025-12-27: User created funding agreement workflow (id 45) with step 142; requested DB inspection of workflow and step components.
- 2025-12-27: Reread DB access instructions in docs/README.md; use Windows MySQL client for inspection.
- 2025-12-27: Discussed approach for prefilled funding agreement HTML templates and data sources (application vs intervention).
- 2025-12-27: User offered to replace the HTML with a provided template if needed; deciding on placeholder strategy.
- 2025-12-27: User asked me to own the implementation approach for prefilled funding agreement forms.
- 2025-12-27: Confirmed approach: snapshot assessment into first intervention and prefill CFA from intervention (assessment fallback).
- 2025-12-27: Implemented funding agreement prefill tokens, auto-plan assessment snapshot into intervention metadata, and updated CFA HTML placeholders.
- 2025-12-27: CFA HTML displayed as base64 in portal; correcting step_component html storage to utf8 string.
- 2025-12-27: Discussing approach to prefill case manager signature on CFA (HTML vs signature component).
- 2025-12-27: Added case manager signature token and HTML rendering for CFA; removed interactive case manager signature component.
- 2025-12-27: Discussing conditional display for CFA sections (hide living allowance when empty).
- 2025-12-27: Implemented conditional CFA sections, extra funding line items, and case manager signature date styling.
- 2025-12-27: Simplified CFA header layout and ensured client name uses legal first/last.
- 2025-12-27: Returning to coordinator home page queue build-out; selecting next queue to implement.
- 2025-12-27: Funding Agreements queue confirmed working; proceed to next coordinator queue.
- 2025-12-27: Moving to Active Clients: Check-ins & Milestones Due queue; gathering criteria.
- 2025-12-27: Proposed initial criteria for Active Clients queue (active interventions with upcoming/overdue start/end milestones); awaiting confirmation.
- 2025-12-27: Confirmed Active Clients queue criteria and began wiring intervention milestone feed plus milestone column rendering.
- 2025-12-27: Requested expansion of “Payments & Proof Due” to cover any missing documents (including proposed interventions, attendance reports, receipts); clarifying the missing-doc source of truth next.
- 2025-12-27: Confirmed a combination of missing-doc sources should power the Payments & Proof Due queue; need explicit sources and merge rules.
- 2025-12-27: Scoped Payments & Proof Due to missing attendance reports or required receipts tied to releasing funds.
- 2025-12-27: Requested dedicated receipt document type for Payments & Proof Due; awaiting code/label confirmation before adding.
- 2025-12-27: Added receipt document type (code `receipt`, label “Receipt”, scope application) and updated Supporting Documents fallback list + checklist doc list.
- 2025-12-27: Confirmed Client Funding Agreement HTML updates were applied directly to the DB step_component (workflow 45).
- 2025-12-27: Extracted CFA HTML from step_component 3346 into `tmp_cfa_template.html` for temporary file-based editing.
- 2025-12-27: Updated CFA top fields to use rounded signature-style panels with labels beneath the line in `tmp_cfa_template.html`.
- 2025-12-27: User began a new CFA formatting request but the prompt cut off; awaiting clarification.
- 2025-12-27: User asked where HTML override saves in `PropertiesPanel.js` and about prior encoding issues; responding with code location and context.
- 2025-12-27: Rounded CFA tables by wrapping in a bordered panel with rounded corners in `tmp_cfa_template.html`.
- 2025-12-27: Matched CFA field panels/signature panel to the white table background in `tmp_cfa_template.html`.
- 2025-12-27: Removed the duplicate “CLIENT FUNDING AGREEMENT” heading from `tmp_cfa_template.html`.
- 2025-12-27: Increased top field value font size/weight for emphasis in `tmp_cfa_template.html`.
- 2025-12-27: Fixed Supporting Documents intervention filter to stop resetting to the workspace-selected intervention after user selection.
- 2025-12-27: Added CFA prefill wiring to pass the selected intervention from case workspace messages and use it for funding agreement token resolution.
- 2025-12-27: Updated CFA prefill to multiply per-period funding by recurrence, suppress extra expense rows when a breakdown exists, and generate living-allowance rows per month via raw HTML tokens.
- 2025-12-27: DB check: CFA step_component HTML still has static living-allowance rows (no `living_rows_html` token) even though intervention metadata has monthly living funding and dates.
- 2025-12-27: User will re-save the updated CFA HTML and retest the living-allowance table rendering.
- 2025-12-27: User confirmed CFA rendering looks good after the HTML update.
