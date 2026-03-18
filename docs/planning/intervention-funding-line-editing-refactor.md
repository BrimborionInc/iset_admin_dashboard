Purpose: Track design, planning, implementation, and validation for allowing controlled post-approval revisions to intervention funding and related intervention/action-plan data through the existing gated workflow.
Audience: Admin dashboard engineers, workflow owners, finance operations, and program administrators.
Last Updated: 2026-03-18

# Intervention Funding Revision Refactor

## Phase Status
- Design: In progress
- Planning: In progress
- Implementation: In progress

## Problem Statement
- Intervention funding lines currently behave like a staged proposal model that becomes operational data downstream.
- The product now needs a controlled way to change funding lines for interventions without breaking auditability, approval expectations, payment packet integrity, or reporting.
- The main design problem is not "how to let users edit rows"; it is how to define which funding-line changes are allowed, at what lifecycle stage, with what review requirements, and how those changes propagate to downstream artifacts.
- Interventions are created as the end product of the assessment process in the Application Workspace for both approved and denied applications, then managed in the Case Management Workspace.
- Active interventions may need funding changes over time as client circumstances change, but the current workflow does not define a post-approval funding-change process.
- Funding changes should be treated as normal operational adjustments within an ICIT case-management episode, not as exceptional corrections to historical records.
- Reusing the existing gated assessment workflow is preferable to introducing a separate amendment dashboard if the system can safely reopen an intervention revision into that workflow.

## Discussion Scope
- Define the business rules for changing funding lines on interventions.
- Define lifecycle boundaries:
  - before approval
  - after approval but before payments
  - after payments exist
  - after intervention closure
- Define data and audit model expectations for edits, supersession, and history.
- Define downstream impacts on payment packets, finance validation, documents, exports, and compliance/reporting.
- Define the UI/UX pattern for reviewing and applying changes safely.
- Define how the Case Workspace initiates a revision that re-enters the existing Application/Assessment-style gated workflow without mutating the approved intervention directly.

## Non-Goals
- Implementing the refactor before design is locked.
- Silent in-place mutation of financial records with no traceability.
- Building a separate standalone amendment dashboard in v1 unless reuse of the existing gated surfaces proves unworkable.
- Reworking unrelated finance modules unless they are directly affected by funding-line change behavior.

## Initial Design Constraints
- Auditability is mandatory. A reviewer must be able to tell what changed, who changed it, when, and why.
- Approved intervention data likely already drives downstream packet generation and reporting, so edits cannot be treated as harmless UI-only changes.
- Existing application-workspace and case-workspace costing flows must be verified from code before locking a design.
- The design should prefer one defensible source of truth for intervention funding lines rather than accumulating parallel copies.

## Working Hypotheses
- Pure overwrite-in-place is likely too weak once an intervention has been approved or any finance artifact exists.
- Post-approval edits may need explicit change states such as draft change, submitted change, approved change, and applied change.
- Some classes of edits may be minor and patchable, while others may need re-approval or packet regeneration.
- Existing packet lines and reporting extracts may need supersession rules instead of destructive rewrite.
- The safest baseline is to treat any funding change as an intervention amendment requiring a new approval cycle.
- If staff must move back through existing gates anyway, the practical workflow may be broader than funding-only and may reopen intervention/action-plan data that naturally sits in those gates.

## Evidence Snapshot
- Existing planning docs already establish intervention cost lines as operational workflow data, not throwaway UI state.
- Relevant prior design references:
  - `docs/planning/coordinator-assessment-costing-line-items-tracker.md`
  - `docs/planning/vendor-payee-early-capture-refactor.md`
  - `docs/planning/proposed-interventions-wizard-alignment.md`
- Code-path verification for current intervention funding-line persistence, approval transitions, and downstream finance effects is still pending for this refactor.

## Open Design Questions
- What exactly counts as a "funding line change"?
  - amount only
  - payee only
  - payment type/category
  - recurrence/schedule
  - add new line
  - remove existing line
- Which lifecycle states allow edits directly, and which require a formal change request?
- If an intervention is already approved, does any funding-line edit reopen approval automatically?
- If payment packets already exist, should changes:
  - update draft packets in place
  - invalidate and regenerate draft packets
  - create adjustment lines only
  - be blocked once finance has progressed past a threshold
- What happens if a line was already paid or partially paid?
- Do we need immutable line versions with superseded records, or is event history plus current-state rows sufficient?
- Which user roles may initiate, approve, apply, or reject funding-line changes?
- What downstream documents become stale when funding lines change?
  - funding agreement
  - client acknowledgement
  - statement of account
  - approval letter
- What reporting/export consequences exist for ESDC/ILMP payloads if intervention funding changes after approval?
- Should denied-application-origin interventions ever allow funding amendments, or is this amendment flow only valid for active approved interventions?
- Should an approved amendment immediately replace the current approved funding snapshot, or should it become effective only after downstream documents are issued/signed?
- Do payment packets already generated from the prior approved version become void, archived, or diff-adjusted?
- For the email payment-package workflow, should packet status `sent` be treated as the irreversible operational boundary because finance payment completion is not visible in-system?
- Should the workflow be modelled as:
  - a funding-only amendment with isolated fields, or
  - a broader intervention revision that reuses the existing assessment gates and can update related intervention/action-plan data?
- If the existing gated workflow is reused, which fields become editable again and which remain locked even during revision?

## Decision Log
- 2026-03-18: Opened major-refactor planning tracker for intervention funding-line change behavior.
- 2026-03-18: No implementation decisions locked yet.
- 2026-03-18: Locked baseline product rule: any increase, decrease, addition, or removal of intervention funding lines requires a new approval cycle.
- 2026-03-18: Locked baseline workflow entry point: staff initiate a "propose funding change" action from an active intervention in the Case Workspace.
- 2026-03-18: Locked baseline data rule: proposed funding changes are captured as a new version/amendment, not as direct edits to the currently approved funding.
- 2026-03-18: Locked baseline workflow rule: amendment review should mirror the rigor of the original assessment process, including gated approvals and required data/evidence.
- 2026-03-18: Locked baseline outcome rule: once approved, the intervention funding snapshot updates to the approved amendment and a new Client Funding Agreement must be generated.
- 2026-03-18: Locked baseline downstream rule: required downstream letters/documents for third parties must also be generated from the approved amendment.
- 2026-03-18: Revised baseline trigger rule: amendment control is based on whether approved funding exists, not whether the intervention is `active`.
- 2026-03-18: Locked payment boundary for the email-package workflow: once a payment package has been sent, treat its lines as effectively paid/immutable because PATH has no downstream visibility into actual finance disbursement.
- 2026-03-18: Locked prospective-change rule: funding amendments may change future funding and unsent payment packages, but must not rewrite historical sent payment packages.
- 2026-03-18: Locked amendment accounting model: each approved funding amendment becomes a full replacement funding snapshot for future funding authority, not a delta patch against the prior approved version.
- 2026-03-18: Revised scope decision: do not introduce a separate amendment dashboard in v1; prefer reusing existing gated workflow surfaces.
- 2026-03-18: Revised scope decision: initiation begins from Case Workspace, but the revision flow may reopen the intervention into the existing assessment workflow rather than a funding-only editor.
- 2026-03-18: Revised scope decision: approved revision flow is not limited to funding lines; moving back through gates may allow controlled updates to broader intervention data and linked action-plan artefacts when required by the workflow.
- 2026-03-18: Locked field-scope rule: reopened revision workflow is limited to intervention-plan and action-plan operational fields; participant/application-origin facts remain historical and read-only.
- 2026-03-18: Revised v1 scope decision: rely on the existing Application Workspace versioning model and existing Case Workspace client-editing behavior rather than adding revision-specific field locks up front.
- 2026-03-18: Revised v1 architecture decision: prefer reusing the existing Application Workspace surfaces/widgets/routes for intervention revision unless code discovery proves that reuse is unworkable.
- 2026-03-18: Locked historical-safety assumption for v1: application edits made during an intervention revision are acceptable because the application record already versions changes rather than destructively overwriting prior state.
- 2026-03-18: Locked user-facing entry-point label: `Revise Approved Intervention`.
- 2026-03-18: Baseline UX direction: expose `Revise Approved Intervention` from Case Workspace as a quick action on the intervention/workspace context.

## Design Targets
- Safe editing model with explicit lifecycle rules.
- Clear audit trail and change visibility.
- Predictable downstream synchronization behavior.
- Minimal operator confusion between "edit proposal" and "change approved funding".
- Shared rules across Application Workspace, Case Workspace, and Finance where applicable.
- A clear distinction between:
  - current approved intervention funding
  - in-flight proposed amendment
  - superseded historical funding versions

## Proposed Baseline Model
- An intervention with approved funding has one current approved revision baseline.
- Staff initiate a revision from the Case Workspace on the intervention record.
- Initiation creates a draft revision copied from the current approved intervention/action-plan state relevant to the workflow.
- The draft revision re-enters the existing Application Workspace / gated assessment-style workflow rather than a new standalone amendment dashboard.
- As the user moves back through the gates, the workflow may allow edits to funding lines and related intervention/action-plan fields that belong to those gates.
- Existing Application Workspace widgets may still allow application-field edits during revision; in v1 that is acceptable because those edits are versioned and become part of the current case/client state rather than destructive rewrites of history.
- Submission of the revision triggers the same style of gated review/approval cycle used for the original approval path.
- Approval does not edit history; it supersedes the prior approved version with a new approved revision baseline.
- Each approved revision stores a complete replacement snapshot of approved funding lines and any other in-scope approved data required by the workflow.
- Rejection or push-back leaves the prior approved version unchanged.
- Downstream artifacts generated from the approved revision must be regenerated from the newly approved version.
- Revision eligibility is determined by the existence of approved funding on the intervention, even if the intervention itself is still in `draft` delivery status.
- Sent payment packages remain historical records and are not rewritten by later approved revisions.
- Unsent payment packages may be updated, invalidated, or regenerated from the newly approved revision.
- Funding changes operate prospectively: historical commitments/actuals stay intact, while future funding is recalculated from the newly approved revision.

## Funding Semantics
- Do not frame post-approval amendments as preventing or detecting "mistakes" by default.
- Do not treat historical packet/payment records as errors simply because later circumstances change.
- Treat prior sent package amounts as historical commitments/actuals within the case timeline.
- Treat newly approved amendments as the authority for future funding only.
- Use full approved snapshots as the legal/operational funding state for each amendment version; derive future remaining funding by comparing the current approved snapshot against historical sent amounts.
- The system should preserve a clear distinction between:
  - historical funding that has already moved through finance workflow
  - current approved funding authority for future obligations
  - proposed but not yet approved funding changes

## User-Provided Product Intent
- Application Workspace creates the intervention record at the end of the assessment process.
- Case Workspace is the operational home for managing the client, action plan, and intervention after creation.
- Staff need a way to handle post-approval funding changes within an active intervention.
- Direct edits to approved funding without approval are not allowed.
- The process must remain controlled and auditable.
- The preferred UX is to reuse existing surfaces rather than introducing a new amendment dashboard.
- Initiating a funding change may effectively push the intervention back into the existing assessment/gated workflow.
- Once reopened into that flow, the process may revise not only funding but also other intervention fields and linked action-plan artefacts as needed.
- Existing application versioning is considered sufficient protection against uncontrolled historical rewrite in v1.
- Existing direct client-editing behavior in Case Workspace remains valid and should continue alongside the revision workflow.
- Avoid introducing a separate UI layer on top of the Application Workspace unless reuse proves unworkable.

## Open Product Decisions
- Exact placement of the `Revise Approved Intervention` quick action within Case Workspace (header, intervention row, action menu, or multiple surfaces).
- Whether the action should route into the Application Workspace, embed the same workflow in Case Workspace, or open a shared reusable assessment flow component.
- Whether partial approvals or staged amendments are required.
- Exact revision workflow stages and evidence requirements.
- Whether any revision-specific field restrictions are actually needed after code discovery, or whether current workspace behavior is sufficient for v1.
- Exact behavior when an approved amendment touches a line that already has mixed history:
  - some packet lines unsent
  - some packet lines already sent
  - remaining balance still uncommitted
- How best to present historical-versus-future funding in the UI without implying that prior sent packages are erroneous or need correction.

## Status Model Discovery
- Current intervention status handling is inconsistent across docs and code.
- The server and multiple front-end surfaces still normalize aliases and legacy/transitional values rather than enforcing a single canonical set.
- Current duplicated normalization logic still defaults missing/unknown intervention status to `planned`, which indicates refactor drift rather than a clean completed migration.
- `planned` is still treated as a first-class execution state in several UI paths even though later planning docs treat `approved` as the intended pre-start state and propose dropping `planned`.
- `on_hold` is still normalized to `suspended` in multiple places instead of being removed.
- `ready_to_close` behaves more like a workflow marker than a durable intervention lifecycle state.

## Recommended Status Cleanup Direction
- Do not carry forward the current mixed status model into the revision refactor.
- Clean the intervention status set before or during the revision refactor so the new workflow is not built on transitional drift.
- Recommended single-field canonical set for the next pass:
  - `draft`
  - `submitted`
  - `in_review`
  - `changes_requested`
  - `approved`
  - `rejected`
  - `in_progress`
  - `suspended`
  - `completed`
  - `cancelled`
- Recommended removals:
  - `planned` (redundant with `approved` as pre-start approved state)
  - `on_hold` (alias only; use `suspended`)
  - `ready_to_close` (treat as workflow/UI flag, not intervention status)

## Refactor Sequencing Recommendation
- Treat intervention-status cleanup as a prerequisite cleanup slice for the revision workflow, not as a separate later nicety.
- Reason: `Revise Approved Intervention` gating, payment behavior, action menus, and document/checklist logic all depend on status semantics; building the revision workflow first would cement more drift.
- Cleanup scope should be end-to-end and explicit:
  - server normalization/helpers
  - Case Workspace context/state normalization
  - Interventions widget table/actions/badges
  - intervention modal options and close/start rules
  - finance payment gating
  - checklist/status gating
  - docs/planning references
- Under the standing no-legacy-fallback principle, do not preserve alias support unless current dev data inspection proves it is still required.

## Planning Workstreams
1. Current-state discovery
   - Verify current persistence model for intervention cost/funding lines.
   - Verify approval transition behavior and downstream packet/document generation.
2. Business-rule design
   - Define allowed edits by lifecycle stage and role.
   - Define re-approval thresholds and hard blockers.
3. Data-model design
   - Decide current-state mutation vs versioned change model.
   - Define history, reason, actor, and effective-date fields.
4. Downstream integration design
   - Define packet, document, compliance, and reporting consequences.
5. UX design
   - Define where staff initiate, review, compare, approve, and apply changes.

## Risks
- Breaking financial auditability by mutating approved records in place.
- Causing packet/report mismatches if downstream data is not synchronized consistently.
- Creating inconsistent behavior between Application Workspace and Case Workspace.
- Underestimating how many existing artifacts depend on the current funding-line snapshot.

## Validation Plan
- Lock lifecycle rules with explicit examples before implementation.
- Trace at least one full scenario for each major state:
  - approved intervention with no payments
  - approved intervention with draft packet
  - approved intervention with submitted/approved packet
  - partially paid intervention
  - closed intervention
- Verify any chosen design against current packet generation, validation, and reporting code paths before implementation starts.

## Progress Log
- 2026-03-18: Created planning document and set discussion scope for major-refactor design interview.
- 2026-03-18: Started prerequisite intervention-status cleanup implementation to remove transitional `planned`/alias handling before building `Revise Approved Intervention`.
