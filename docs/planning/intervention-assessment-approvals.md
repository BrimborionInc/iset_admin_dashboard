# Intervention Assessment & Approvals Plan (Draft)
Status: Draft (design in progress)  
Owners: Casework / Admin Dashboard  
Last updated: 2025-12-23

## Purpose
Document the target workflow for proposing, reviewing, approving, and running interventions within the existing Case Workspace. Keep queues aligned to current widgets (Action Plans + Interventions) instead of inventing parallel queue UIs.

## Scope / Guardrails
- Live in Case Workspace: Interventions widget + Action Plans widget; no new standalone queues.
- Keep a single intervention `status` column and extend its allowed values to cover pre-approval stages; avoid parallel approval-status fields.
- Reuse existing execution states (`planned`, `in_progress`, `suspended`, `completed`, `cancelled`, `ready_to_close`), see `docs/guides/status-lifecycle-implementation.md`.
- Require an active Action Plan before an intervention can start (`in_progress`); if no active plan, prompt to activate/create one.

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
- Ready to Activate: `approved`/`planned` + Action Plan not active → banner/action to activate plan or start when plan is active.
- Active/Monitoring: `in_progress`/`suspended`.
- Ready to Close: `ready_to_close` flag or `in_progress` with past end date/missing actuals; surfaced via table filter + reminder.
- Closed: `completed`/`cancelled`.

## Inputs by Stage
- Draft/Submit (CM): rationale/goals, intervention code/type, provider/program, planned start/end, cost breakdown, funding stream guess (EI/CRF), linked Action Plan, attachments (quotes/schedules), client consent to share with EI.
- Eligibility Review (RM/NWAC): EI claim status and verification result, funding stream decision, required EI docs (consent, eligibility form, ATQ if applicable), policy flags (caps/priority), review notes, reviewer + timestamp.
- Approval Decision (RM/NWAC): decision + approver, approved amount/caps, conditions (docs/milestones), reminders (review date, follow-up), action plan choice (use active vs create new).
- Activation/Execution (CM): confirm active Action Plan, set lifecycle start, monitor attendance/engagement, edit schedule if dates shift (within allowed guardrails).
- Closure (CM): actual start/end, actual cost vs approved, outcome code, follow-up result window (e.g., 12-week check), outcome attachments (attendance, invoices).

## Action Plan Alignment
- Default to the latest active plan; allow selecting a different active plan when multiple exist.
- If no active plan exists: prompt to activate a draft plan or create a new one. Block intervention start until a plan is active.
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

## Open Decisions
- Should CM be allowed to edit core fields post-submission while in review? (lean: no, unless reviewer requests changes).
- Exact gating rules for “Ready to Activate” when multiple draft/active plans exist.
- Do we auto-create reminders for review follow-ups / ready-to-close checks? If so, reuse existing reminders API.
- How to surface review state in dashboards beyond the Case Workspace (badges vs filter chips).

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

## Step 1 Scope (Initiation UX)
- **Objective:** land the Intervention Assessment widget entry flow for Case Managers: create a proposed intervention tied to an Action Plan with draft status and clear proposal framing.
- **In scope:** expose the widget from “New Intervention”; header/banner + plan selector; initial fields (rationale, code/type, dates, cost, attachments, EI consent flag); draft record creation linked to plan/case; show draft in Interventions list with status badge; guard against start without active plan (UX prompt only).
- **Out of scope:** approval actions, EI verification validation, RM/NWAC role handling, start/close transitions, backend status guards, reminders/queues UI beyond showing draft in the existing table.
- **Plan:**
  1. Add Intervention Assessment widget (board item) to Case Workspace and route “New Intervention” to reveal it.
  2. Implement header/banner/plan selector and initial field set with draft save to `iset_case_intervention` (status `draft`), linking to selected plan/case.
  3. Update CaseWorkspaceContext normalization and Interventions table to surface the draft proposal with “Proposed”/`draft` badge.
  4. Add UX prompt when plan is not active (inform CM activation is required before start; no backend block yet).
  5. Smoke-test flow (create draft, see it in table, reopen/edit in widget) and document any backend gaps for step 2.

## Widget flow (guided, in-page wizard)
- Steps: (1) Framing (code, start/end, duration), (2) Rationale (narrative + barriers), (3) Type-specific details (conditional blocks for training vs wage vs other, NOC/institution/program as required), (4) Cost/childcare/posting context/consent, (5) Review & submit.
- Behaviour: progressive disclosure with Next disabled until the current step is valid; Back always available; Save draft/Submit only when validation passes; conditional fields clear when no longer applicable; duration auto-calculates.
- Status banner persists (“Proposal — not approved; EI checked at approval”). Review shows read-only summary; submit remains a separate action from start/activation.
