# Intervention Assessment & Approvals Plan (Draft)
Status: Draft (design in progress)  
Owners: Casework / Admin Dashboard  
Last updated: 2025-12-25

## Purpose
Document the target workflow for proposing, reviewing, approving, and running interventions within the existing Case Workspace. Keep queues aligned to current widgets (Action Plans + Interventions) instead of inventing parallel queue UIs.

## Scope / Guardrails
- Live in Case Workspace: Interventions widget + Action Plans widget; no new standalone queues.
- Keep a single intervention `status` column and extend its allowed values to cover pre-approval stages; avoid parallel approval-status fields.
- Reuse existing execution states (`planned`, `in_progress`, `suspended`, `completed`, `cancelled`, `ready_to_close`), see `docs/guides/status-lifecycle-implementation.md`.
- Require an active Action Plan before an intervention can start (`in_progress`); if no active plan, prompt to activate/create one.

## Implementation Progress (UI)
- Supporting Documents widget now supports intervention filtering in Case Workspace, intervention-linked uploads, and generic uploads without associations. Edit details allow reassociation between application and intervention, and a new “Duplicate” flow copies submission-scoped docs.
- Intervention Assessment wizard now loads the intervention checklist by stage (draft vs submitted), makes the documents step mandatory, adds contextual upload links, and includes manual refresh + auto-refresh. Save Progress is separate from Submit Decision.
- EI verification step now validates eligibility on Next and triggers uploads on Next/Save Progress when a file is selected (no standalone upload button). Uploads attach to the intervention (not application) and show a blocking alert if no intervention record exists. Submit Decision is gated on decision outcome, EI status, and submitted-stage checklist completeness.
- EI verification step now blocks progression when EI status implies a funding stream mismatch with the selected Action Plan, shows instructions to close/create the correct plan, and provides an Action Plan picker to reassign.
- Status normalization currently recognizes: `draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `rejected`, `planned`, `in_progress`, `suspended`, `ready_to_close`, `completed`, `cancelled` (plus aliases like `in-progress`, `ready-to-close`, `canceled`).
- Interventions table status now shows “Submitted — EI verified/unverified” based on EI status value (document presence is handled by the checklist).
- Intervention checklist logic now follows the reduced submission list (band funding letter, acceptance letter if institution, financial overview + evidence if living allowance) and adds EI verification at approval.
- Interventions table action menu now maps status → actions: draft = Resume/Delete; submitted/in_review/changes_requested/rejected = View (+Delete if plan editable); approved/planned = View (+Activate/Delete if plan editable); in_progress/suspended = View (+Close if plan editable); ready_to_close/completed/cancelled = View only. For approved and beyond, View opens the intervention details modal instead of the proposal wizard.
- Intervention details modal now treats approved/review statuses as open (close section only for completed/cancelled or explicit close) and removes the duplicate Close intervention block; status select shows non-execution statuses as disabled when present.
- Action plan PATCH error fix: ensure `esdcExisting` is initialized before accessing `esdcExisting.postingContext` in `isetadminserver.js`.
- Interventions widget CTA relabeled to “Propose intervention”.
- Case header quick actions now include “Propose intervention” (dispatches the proposal wizard when a plan is selected).
- Proposal start now reflows the case workspace board to show Case Header (4x2), Participant details (2x7), and Intervention assessment (2x7), with other widgets moved to the palette.
- Fixed a Step 7 runtime error by moving `uploadEiVerificationIfSelected` above its first use in the intervention assessment widget.
- Supporting Documents and Secure Messaging quick links in the intervention wizard now add their widgets to the board with span 2x5.
- Intervention assessment wizard now persists the active step outside the widget and restores it on remount; the stored step is cleared when the widget is removed from the board, and step changes no longer trigger a restore loop.
- Interventions widget no longer clears the selected intervention on remount; it only resets selection when the active Action Plan actually changes, preventing wizard step resets during unrelated board changes.
- Added console logging around wizard step restore/persist/select/hydrate to debug remount resets.
- Wizard step storage now uses a module-level store (with last-key tracking per case) so step state survives provider remounts; wizard key falls back to the last stored key when selection is lost.
- Fixed a scope error in Interventions widget by initializing the plan-change ref after `activePlan` is defined.
- Draft form entries are now stored outside the widget and merged during hydration so in-progress fields (e.g., employer/wage subsidy details) survive board remounts; draft state is cleared when the widget is removed.
- DB check: `document_type.code='ei_verification'` is scoped as `application`, which is correct for intervention uploads; the latest EI verification upload is stored with `application_id=1` and `linked_intervention_id=NULL` (doc id 19), so the intervention checklist cannot see it. That record predates the latest intervention (intervention id 5), which suggests the upload came from the application flow or an older UI that did not send `interventionId`.
- Interventions table row click no longer opens the modal; only the Type link triggers view, preventing action menu clicks from opening the modal.
- Case header now shows a compact Action Plan summary (selected/active plan, status, funding stream).
- Case header now includes an intervention rollup (total plus draft/submitted/approved/in-progress/closed counts).
- Case header now shows a funding snapshot (overall and selected plan committed/actual/remaining).
- Case header now shows the next key date (nearest upcoming intervention start/end or action plan end).
- Case header now shows the last activity timestamp from the latest action plan or intervention update.
- Case header ILMP validation now includes a "Last validated" subtext instead of a separate row.

## Current Anchors (baseline)
- Coordinator Assessment already captures a recommended intervention (code, dates, provider, funding stream guess); use as prefill.
- Case status derives from Action Plan activity; Action Plans default to `draft` on approval and must be explicitly activated.
- Interventions table already supports status filtering chips and row actions; leverage these for review and implementation flows.
- ILMP export requires structured fields (intervention code, NOC/version, duration, cost, outcome, childcare flags) per CR-0007.

## Target Workflow (single status, linear)
- Status set (ordered): `draft` → `submitted` → `in_review` → (`changes_requested` → `submitted`/`in_review`) → `approved`/`rejected` → `planned` (alias for approved/pending start if we keep backward compatibility) → `in_progress` → `suspended` (optional) → `ready_to_close` (flagged state) → `completed`/`cancelled`.
- **Draft (CM)**: Created from Interventions widget (“Add intervention”), prefilled from Coordinator Assessment when available. Editable by Case Manager only. Status `draft`.
- **Submit for review (CM)**: CM clicks “Submit for approval”; locks primary fields for CM, sets status `submitted`.
- **Eligibility review (RM/NWAC)**: RM/NWAC works in status `in_review`; records EI result, funding stream, docs. Outcomes: `approved` (or `planned` for backward compatibility), `rejected`, or `changes_requested`.
- **Changes requested (RM → CM)**: Status `changes_requested`; unlocks editable fields, preserves review notes. CM resubmits to `submitted`.
- **Approved / Planned (RM/NWAC)**: Status `approved` (or `planned` if we reuse the existing label) until CM starts execution. Banner nudges CM to activate the Action Plan if not active.
- **In progress (CM)**: Status `in_progress`; blocked unless Action Plan is `active`.
- **Ready to close (system/CM)**: Use `ready_to_close` flag/status when end date passed or actuals missing; CM records outcome, actual cost/duration.
- **Closed (CM)**: Status `completed` or `cancelled` with outcome code; remains immutable unless reopened with audit.

## Queue / Filter Mapping (reuse existing UI)
- Case Manager Drafts: `draft` or `changes_requested` (Interventions table filter).
- Pending Eligibility: `submitted` or `in_review`.
- Regional Manager home queue: `interventions-awaiting-approval` bucket fed by `submitted`/`in_review` interventions.
- Ready to Activate: `approved`/`planned` + Action Plan not active → banner/action to activate plan or start when plan is active.
- Active/Monitoring: `in_progress`/`suspended`.
- Ready to Close: `ready_to_close` flag or `in_progress` with past end date/missing actuals; surfaced via table filter + reminder.
- Closed: `completed`/`cancelled`.

## Inputs by Stage
- Draft/Submit (CM): rationale/goals, intervention code/type, provider/program, planned start/end, cost breakdown, funding stream guess (EI/CRF), linked Action Plan, attachments (quotes/schedules), client consent to share with EI.
- Eligibility Review (RM/NWAC): EI claim status and verification result, funding stream decision, required EI docs (consent, eligibility form, ATQ if applicable), policy flags (caps/priority), review notes, reviewer + timestamp. EI verification document uploads are allowed for any role (CM/RM/NWAC/PA/SA) when working in the intervention flow.
- Approval Decision (RM/NWAC): decision + approver, approved amount/caps, conditions (docs/milestones), reminders (review date, follow-up), action plan choice (use active vs create new).
- Activation/Execution (CM): confirm active Action Plan, set lifecycle start, monitor attendance/engagement, edit schedule if dates shift (within allowed guardrails).
- Closure (CM): actual start/end, actual cost vs approved, outcome code, follow-up result window (e.g., 12-week check), outcome attachments (attendance, invoices).

## Action Plan Alignment
- Default to the latest active plan; allow selecting a different active plan when multiple exist.
- If no active plan exists: prompt to activate a draft plan or create a new one. Block intervention start until a plan is active.
- Funding stream is derived from EI status at approval. If that implies a different pot than the parent Action Plan (EI↔CRF), prompt the user to draft a new Action Plan with a new agreement number to hold the intervention.
- New plan path only when funding stream changes (EI↔CRF) or the existing plan is closed/archived/incompatible with dates/goals.
- Case status remains derived via `recomputeCaseStatus`; activating the plan transitions the case to `active`.

## EI / Eligibility Gating (ordering difference vs application assessment)
- Application assessment: EI eligibility is required before assessment completion/submission (current behavior).
- New intervention proposal (Case Workspace): Case Manager completes and submits the assessment first; the proposal enters the RM/NWAC approval queue. EI eligibility/verification is performed or confirmed during the approval step, not before submission, to avoid a two-step preflight handoff.
- Implication: do not reuse the application gating that blocks submission on missing EI eligibility. Adjust validation so CM can submit a proposal without pre-verified EI, while the approval step requires the EI check/result + docs to finalize `approved`.

## Data Model Notes (design, not implemented)
- Single `status` column extended to include pre-approval states (`draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `rejected`) in addition to execution states (`planned`, `in_progress`, `suspended`, `ready_to_close`, `completed`, `cancelled`).
- Track reviewer metadata (`reviewed_by_staff_profile_id`, `reviewed_at`, `review_notes`, `eligibility_result`, `funding_stream_decision`, `required_docs_flags`) alongside the intervention; no separate approval-status column.
- Consider computed views or API filters for queues; reuse Interventions list queries with status filters.
- DB impact: `iset_case_intervention.status` is varchar (no enum) so new states require no type change. Add reviewer/eligibility columns via migration (`sql/20251223_add_intervention_review_fields.sql`). Funding stream column was dropped (see `sql/20251210_drop_intervention_funding_stream.sql`); keep funding stream selection at the Action Plan level. Enforce plan linkage + active-plan start guard in service logic; a NOT NULL on `action_plan_id` is a stretch goal if legacy rows allow it.
- Document scope (EI verification): keep the existing `document_type.scope` enum (`client`, `application`) and reuse `ei_verification` (application-scoped) for intervention submissions. Application-scoped document types must be associated with either an application or an intervention (no new scope), using `iset_document.application_id` or `iset_document.linked_intervention_id` respectively.
- Checklist behavior: required documents fall into two categories—client-scoped docs that persist across submissions, and submission-scoped docs that must be re-provided per application or per intervention proposal. EI verification (`document_types.code = ei_verification`) is in the submission-scoped category and must be uploaded anew for each intervention proposal.
- Checklist definition: create a separate intervention-specific checklist, initially copied from the application checklist and adjusted later as needed.
- Checklist by status: use a reduced draft checklist for proposals, then add `ei_verification` once the intervention is submitted; revalidate the submitted checklist during approval.
- Intervention submission checklist (reduced): Band funding confirmation/denial letter (one required), Letter of Acceptance if Institution entered, ISET Financial Overview if living allowance > 0, Financial Evidence (min 1) if living allowance > 0.
- Approval-only docs: for now, only `ei_verification` is added at submission; additional approval-only docs may be added during testing.
- Wizard documents step: show only intervention-scoped checklist items (exclude client-scoped docs).
- Wizard gating: documents step is mandatory; require the intervention checklist to be complete before submitting (in-progress items count as incomplete). Navigation can proceed, but submission is blocked.
- Wizard documents step: provide an upload action to add required documents directly from the step (not just a link).
- Wizard documents step: missing checklist items should be clickable upload actions that preselect the document type.
- Wizard documents step: auto-refresh the checklist after uploads, with a manual refresh icon button available.
- Wizard documents step: show status only (no file name list).
- Wizard documents step: show a missing-required count in the header.
- Wizard documents step: update the checklist contents after status changes to submitted (adds EI verification requirement).
- Approval gating: EI status is required only at approval (not proposal submission). Block approval if EI status is unset or the submitted-state checklist (including `ei_verification`) is incomplete; show a clear blocking modal and require the user to return to Step 7/5 as needed.
- Submitted review flow: missing documents should not block navigation between steps; gating happens at Submit Decision only.
- Save behavior: board-level “Save” is a save-and-finish-later action with no validation; incomplete steps are allowed for both draft and submitted review saves.

## Open Decisions
- Should CM be allowed to edit core fields post-submission while in review? (lean: no, unless reviewer requests changes).
- Exact gating rules for “Ready to Activate” when multiple draft/active plans exist.
- Do we auto-create reminders for review follow-ups / ready-to-close checks? If so, reuse existing reminders API.
- How to surface review state in dashboards beyond the Case Workspace (badges vs filter chips).
- Application-scoped documents: enforce mutual exclusivity between `application_id` and `linked_intervention_id` in the UI; update checklist queries accordingly.
- Checklist configurability: future work to let sysadmins manage checklist rules via a widget stored in `iset_runtime_config`.

## Implementation Proposal (initial pass)

### Workflow (Case Workspace)
- Initiator: Case Manager from the Interventions widget.
- Capture: rationale/goals, intervention code/type, provider/program, planned start/end, cost breakdown, funding stream guess (EI/CRF), attachments (quotes/schedules), EI consent flag. Link to an Action Plan (default latest active; prompt to activate/create).
- Submit: status moves `draft → submitted`; CM loses edit on core fields; appears via Interventions filter for RM/NWAC.
- Approval: RM/NWAC opens the same intervention (expanded modal), performs/confirms EI eligibility + required docs, and sets status `approved` or `rejected`, or sends `changes_requested` with notes.
- Post-approval: CM can start (`approved → in_progress`) only if the linked Action Plan is `active`; otherwise prompt to activate/create. Closure remains `completed/cancelled` with outcome code and actuals.

### Entry UX (Case Manager, future design)
- Trigger: CM clicks “New Intervention” in the Interventions widget.
- Landing: Case Workspace shows the Intervention Assessment **widget** (board item) in place, full-width like other workspace widgets—not a modal or side panel. Header: “Proposed Intervention” with a draft badge and the linked Action Plan selector (defaulting to latest active).
- First interaction: CM chooses/confirms the target Action Plan (or is prompted to activate/create one) and sees a brief explainer that this is a proposal pending approval; key fields (rationale, code, dates, cost) are presented as the first step.
- State clarity: A persistent banner indicates “Proposal — not approved” with a short note that submission will send it to RM/NWAC for approval and that EI eligibility is checked during approval, not now.

### Status / Data Model
- Single intervention status column extended: `draft`, `submitted`, `in_review`, `changes_requested`, `approved`, `rejected`, plus existing `planned`/`in_progress`/`suspended`/`ready_to_close`/`completed`/`cancelled`. Treat `approved` as the pre-start equivalent of today’s `planned` (alias if needed for backward compatibility).
- No separate Proposal table; proposals are interventions in pre-approval states.
- Reviewer metadata on `iset_case_intervention`: `reviewed_by_staff_profile_id`, `reviewed_at`, `review_notes`, `eligibility_result`, `funding_stream_decision`, `required_docs_flags`.
- Action Plan link required on create; block `in_progress` unless plan is `active`. Allow create when only a draft plan exists, but require activation before start.
- Audit/events: emit intervention status-change events and capture reviewer/timestamps.

### UI Changes
- New Intervention becomes a multi-step modal (assessment → summary/submit) with a persistent summary panel; role-based footer actions (`Submit`, `Request changes`, `Approve`, `Reject`, `Start`, `Close`).
- Permissions: CM can edit in `draft/changes_requested`; RM/NWAC can edit eligibility fields and decide in `submitted/in_review`; fields lock after submission except review notes/eligibility for RM; unlock only on `changes_requested`.
- Interventions table: add filters/badges for pre-approval statuses; add “Ready to activate” hint when `approved` and plan not active.
- No new Case Workspace widget; keep flow in the modal to avoid layout bloat.
- Supporting Documents manual upload: allow application-scoped document types (including `ei_verification`) to be attached to a specific intervention; update the attach control to offer interventions in addition to applications, respecting one submission association at a time (or none for generic uploads).
- Workspace-aware attachments: in Application Workspace, the “Attach to” list shows applications; in Case Workspace, it shows interventions (default to the selected intervention if present). Secure Messaging form uploads should follow the same rule: forms sent from Case Workspace attach to the selected intervention, while forms sent from Application Workspace attach to the selected application.
- Attach selector scope: in Case Workspace, show all interventions (including completed/cancelled) for now; revisit restrictions during user testing.
- EI verification step gating: only available once the intervention is submitted (so a DB record exists). If the record is missing, show a Cloudscape error alert and block upload.
- Wizard sequencing: keep EI verification (and decision) steps hidden in draft; only append them after status transitions to submitted so the final draft step remains “Review and submit”.
- Interventions table status: display compound status for submitted items reflecting EI verification based on the EI status field (not document presence). If any EI status value is set (same ESDC options: CRF / EI Active Claim / EI Reach Back), treat as “EI verified”; otherwise show “EI unverified”. Missing documents are handled separately in the checklist.
- EI status edits: EI status is editable until approval, then locked because it drives the funding stream/action plan.
- EI status entry: require explicit selection for every intervention (no auto-fill on upload); the workflow assumes a fresh ESDC lookup per intervention.
- Decision step actions: relabel the Step 8 action to “Submit Decision” (distinct from the board-level “Save Progress”). Submitting runs validation; “Approve” is blocked until EI status + submitted-state checklist are complete, while other outcomes can proceed.
- Generic uploads: allow uploads even when no submission is selected; extend “Edit document details” to manually associate/reassociate application-scoped documents to either applications or interventions (client-scoped types are not assignable). Reassociation is allowed for any user with edit access.
- Duplicate-to action: add a “Duplicate to…” control so users can copy a submission-scoped document to a new application or intervention while retaining the original association; prefill label/type from the source with optional edits.
- Move warning: when reassigning a document, warn that the original submission may become incomplete.

### API / Component Touchpoints
- Frontend: `InterventionModal` (convert to stepper), `CaseWorkspaceContext` normalization (support new statuses/metadata), Interventions table filters/actions, shared form sections extracted from `CoordinatorAssessmentWidget`.
- Backend: `POST /api/action-plans/:id/interventions` and `PATCH /api/interventions/:id` to accept new statuses + reviewer fields; add start guard (block `in_progress` if plan not active); validation to require EI eligibility result/docs only when moving to `approved`.
- Validation changes: remove “EI required pre-submit” from reused components; add approval-time EI requirement. Keep `recomputeCaseStatus` unchanged (plan-driven).

### Blocking Decisions
- Status naming/alias: collapse or alias `approved`/`planned`? Affects migration and UI labels.
- Create with no active plan: allow link to draft plan, but enforce active plan before start—confirm ops agreement.
- Shared form extraction: commit to extracting Coordinator Assessment sections vs duplicating logic; otherwise the modal will drift from intake assessment rules.

## UX Decision: Where assessment lives
- Primary path: dedicated Intervention Assessment widget inside Case Workspace (case-scoped adaptation of Coordinator Assessment), not a modal.
- Rationale: page-level work (rationale, cost breakdown, program codes, employment status, approvals, eligibility) does not fit cleanly in a modal; keeps “proposal” mental model explicit vs “just add an intervention.”
- Behavior: no pre-submit EI gate; explicit “Submit for Approval”; EI eligibility checked during approval; proposed intervention enters pending state and appears in RM/NWAC approval filters/queue. Role-based actions (“Submit”, “Request changes”, “Approve”, “Reject”, “Start”) live in the widget.
- Reuse: extract shared form components/schema/validation from Coordinator Assessment, adjust copy/bindings for existing cases (remove intake framing).
- Future optional compact path: a modal could be added later for trivial amendments, but the primary workflow remains the widget.

## Action Plan defaulting for proposals
- Creation rule: proposals must attach to an Action Plan. If an active plan exists, use it; else reuse an existing draft. If none exist, auto-create a draft plan (placeholder details, no funding stream set) and attach the proposal.
- Funding stream decision happens at approval; update the draft plan’s stream/dates accordingly. If incompatible, create a new draft with the correct stream and move the proposal before activation.
- Guard stays: interventions cannot start until their plan is `active`; approval alone does not activate the plan or start the intervention.

## Near-Term Steps
- Validate status enum extensions and reviewer metadata fields with data team; add migration plan.
- Wire Interventions widget to display approval state and provide “Submit / Request changes / Approve / Reject / Start / Close” actions per role.
- Add plan-activation prompt in the start flow; block start otherwise.
- Draft validation matrix (who can edit which fields at each approval state).
- Implement EI status verification step UI in Intervention Assessment widget: ESDC eligibility select + EI verification document upload via applicant documents endpoint; confirm application vs client scoping for the upload.
- Extend Supporting Documents widget and secure messaging attachment flows to support intervention-linked uploads of application-scoped docs (EI verification), with any role allowed to upload.

## Step 1 Scope (Initiation UX)
- **Objective:** land the Intervention Assessment widget entry flow for Case Managers: create a proposed intervention tied to an Action Plan with draft status and clear proposal framing.
- **In scope:** expose the widget from “New Intervention”; header/banner + plan selector; initial fields (rationale, code/type, dates, cost, attachments, EI consent flag); draft record creation linked to plan/case; show draft in Interventions list with status badge; submit action to move `draft → submitted`; guard against start without active plan (UX prompt only).
- **Out of scope:** approval actions, EI verification validation, RM/NWAC role handling, start/close transitions, backend status guards, reminders/queues UI beyond showing draft in the existing table.
- **Draft rule:** only one draft proposal exists per case; “Save draft” updates the existing draft instead of creating another intervention record.
- **Submitted review access:** submitted proposals stay in the wizard for Regional Managers, Program Administrators, and System Administrators to complete EI verification + record of decision; Case Managers see submitted proposals in read-only mode.
- **Single proposal guard:** while a draft or submitted proposal exists, block starting a new wizard; non-draft interventions open read-only in the wizard.
- **Plan:**
  1. Add Intervention Assessment widget (board item) to Case Workspace and route “New Intervention” to reveal it.
  2. Implement header/banner/plan selector and initial field set with draft save to `iset_case_intervention` (status `draft`), linking to selected plan/case.
  3. Update CaseWorkspaceContext normalization and Interventions table to surface the draft proposal with “Proposed”/`draft` badge.
  4. Add UX prompt when plan is not active (inform CM activation is required before start; no backend block yet).
  5. Smoke-test flow (create draft, see it in table, reopen/edit in widget) and document any backend gaps for step 2.

## Widget flow (guided, in-page wizard)
- Steps: (1) Framing (code, start/end, duration), (2) Rationale (narrative + barriers), (3) Type-specific details (conditional blocks for training vs wage vs other, NOC/institution/program as required), (4) Cost/childcare/posting context/consent, (5) Review & submit. Submitted-only additions: (6) EI status verification, (7) Record of decision (visible when status is `submitted`; editable for RM/PA/SA).
- Behaviour: progressive disclosure with Next disabled until the current step is valid; Back always available; Save draft/Submit only when validation passes; conditional fields clear when no longer applicable; duration auto-calculates.
- Status banner persists (“Proposal — not approved; EI checked at approval”). Review shows read-only summary; submit remains a separate action from start/activation.
