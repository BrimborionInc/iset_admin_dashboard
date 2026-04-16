# Status Architecture Overhaul

Purpose: define the target PATH status model so the client/case/application entity migration and the status overhaul can be designed and migrated together.

Audience: engineering, product, reporting/data, and operations.

Last Updated: 2026-04-16

## Status

- Planning draft.
- Based on the current shipped implementation in code and docs.
- This note is the canonical target-state plan for status architecture.
- The route/widget dependency ledger for status cutover is tracked in `docs/planning/client-case-application-cutover-dependency-inventory.md`.
- First DEV-only frontend status-normalization work landed on 2026-04-16: application-facing widgets now resolve application workflow status separately from case lifecycle status, while case-facing widgets normalize legacy `pending_approval` and `rejected` case values to the target case lifecycle for display and RBAC compatibility.
- A follow-on DEV-only persistence increment on 2026-04-16 moved the main assessment approval write path onto canonical case lifecycle storage and additive application lifecycle/decision fields, while keeping legacy application status values in place for compatibility during cutover.
- A further DEV-only queue/notification increment on 2026-04-16 updated application-list and dashboard queue payloads to surface additive application lifecycle/decision fields, and updated applicant decision notifications to prefer explicit `decision_outcome` when available.
- A further DEV-only workspace/UI increment on 2026-04-16 normalized homepage queue items, application workspace hydration, case workspace hydration, secure-messaging decision context, supporting-document application pickers, and NWAC tutorial prompts through the shared additive application-state resolver instead of raw `application_status` fallbacks.
- A further DEV-only intervention increment on 2026-04-16 introduced a shared intervention-state resolver that separates proposal review status from delivery status, surfaced additive `review_status` and `delivery_status` on intervention payloads, dual-wrote `delivery_status` in the main intervention create/update/close paths, and switched the main interventions table and intervention assessment widget to read that additive state first while legacy `status` remains in place for compatibility.
- A further DEV-only intervention consistency increment on 2026-04-16 updated the intervention modal, backload-plan validation helpers, case workspace intervention hydration, and case-header intervention rollups to read/write additive delivery state directly instead of flattening back to legacy raw intervention status during edit, close, and workspace summary flows.
- A further DEV-only intervention queue increment on 2026-04-16 updated the intervention approval queue, intervention milestone queue, homepage queue hydration, and mixed work-queue status badges to derive proposal review state and delivery state explicitly. Approval queues now filter/render by review status, while milestone queues now filter/render by delivery status.
- A further DEV-only intervention proposal-compatibility increment on 2026-04-16 added compatibility writes to `iset_intervention_proposal` from the main intervention create/revise/update/close/delete flows. Legacy proposal-like intervention rows now upsert proposal records by `legacy_intervention_id`, approved proposals now remain in that table as audit history even after the linked live intervention moves into delivery, and only deleted legacy interventions remove the compatibility proposal record.
- A further DEV-only intervention metrics increment on 2026-04-16 moved the `New intervention proposals` metric toward the target model: both the dashboard count and drilldown now read `iset_intervention_proposal` first, fall back to unsynced legacy intervention rows when needed, and keep `Interventions completed` on live delivery rows in `iset_case_intervention`.
- A further DEV-only intervention count normalization increment on 2026-04-16 realigned case/portfolio intervention counts with the target model: case list and workspace counts now treat only live delivery records as interventions, so proposal-review rows no longer inflate `openInterventions` or `totalInterventions` as if they were active service delivery.
- A further DEV-only action-plan guard increment on 2026-04-16 aligned plan-close blocking with the additive intervention model on both server and client: open proposal-review rows (`draft`, `submitted`, `in_review`, `changes_requested`) and open live-delivery rows (`planned`, `in_progress`, `suspended`) now consistently block plan closure, and the blocking message now reflects the derived status instead of stale legacy raw status.
- A further DEV-only reporting/export increment on 2026-04-16 aligned the lower-level metrics, ESDC participant readiness logic, finance intervention reporting, and intervention approval/milestone queues with the derived review/delivery model. Those paths now use shared intervention SQL helpers instead of inferring business meaning directly from raw legacy `iset_case_intervention.status`.
- A further DEV-only application-status cleanup increment on 2026-04-16 removed the legacy compatibility vocabulary from the main manual application-status control. The Application Overview widget now exposes the reduced workflow set (`Submitted`, `In Review`, `Awaiting Applicant`, `Pending Decision`, `Closed`, `Archived`), while display helpers now render target lifecycle labels plus decision/awaiting qualifiers and the backend still writes mapped legacy raw values underneath during the compatibility window.
- A further DEV-only public-portal status presentation increment on 2026-04-16 introduced a dedicated participant-facing status layer in the intake app. The applicant dashboard, application card, and submission-details page now present participant-safe statuses such as `Application received`, `Action required`, `Approved`, `Not approved`, and `Closed`, with plain-language summaries and next-step guidance instead of mirroring internal admin workflow terms.

## Why This Needs To Change

PATH currently uses `status` to mean too many different things at once:

- lifecycle stage
- approval/decision result
- waiting/blocker state
- queue membership
- UI presentation shorthand

That is now causing structural confusion in both the database and the product.

Examples from the current implementation:

- application status mixes workflow and decision: `submitted`, `docs_requested`, `pending_approval`, `approved`, `completed`, `rejected`
- case status still carries pre-approval meanings such as `pending_approval`, and some code paths still treat `rejected` as a case status
- intervention proposals and live interventions share the same table and the same `status` field
- frontend normalization maps different raw meanings onto one badge layer, for example `approved -> initiated`, `submitted -> pending_approval`, and `rejected -> archived` in some RBAC helpers
- work queues derive business buckets from these overloaded values rather than from explicit workflow meaning

## Design Rules

1. Each core entity should have one primary status field that represents that entity's own lifecycle.
2. Approval decisions should not be stored as lifecycle status unless the entity is itself an approval artifact.
3. “Awaiting applicant”, “awaiting approver”, and similar concepts are blockers or work-state qualifiers, not the same thing as lifecycle.
4. Queue membership must be derived from entity state, not stored as a user-facing status.
5. Case status must stop mirroring application status.
6. New intervention proposals should stop being treated as live interventions.

## Current Problems By Entity

### Application

Current `iset_application.status` mixes:

- intake lifecycle
- assessment workflow
- waiting on applicant
- approval queue
- decision outcome
- post-decision correspondence completion

That is why values like `docs_requested`, `pending_approval`, `approved`, and `completed` all live in one field even though they mean different things.

### Case

Current `iset_case.status` is partly a case lifecycle and partly a projection of the currently linked application.

That is why the system has had to support meanings like:

- `pending_approval`
- `initiated`
- `active`
- `dormant`
- and in some places even `rejected`

This becomes untenable once one case can hold many applications.

### Intervention

Current `iset_case_intervention.status` mixes:

- proposal draft/review lifecycle
- decision outcomes
- live service delivery lifecycle

Today the same column holds:

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

That is the clearest sign that proposals and live interventions need to be separated.

## Target Status Model

## 1. Application

Recommended fields:

- `lifecycle_status`
- `decision_outcome`
- `awaiting_reason`
- `closure_reason`

Recommended `application.lifecycle_status` values:

- `submitted`
- `in_review`
- `awaiting_applicant`
- `pending_decision`
- `decision_recorded`
- `closed`
- `archived`

Recommended `application.decision_outcome` values:

- `approved`
- `denied`
- `null`

Recommended `application.awaiting_reason` values:

- `documents`
- `closure_response`
- `information`
- `none`

Recommended `application.closure_reason` values:

- `withdrawn`
- `no_response`
- `administrative`
- `duplicate`
- `other`

Interpretation:

- `pending_decision` means the assessment is complete and an approver decision is required
- `decision_recorded` means the approval/denial decision exists, but the application episode is not yet fully closed
- `closed` is the terminal lifecycle state for a finished application episode
- `completed` should be retired; checklist/correspondence completion is task/checklist state, not application lifecycle

## 2. Case

Recommended fields:

- `lifecycle_status`
- `closure_reason`

Recommended `case.lifecycle_status` values:

- `intake`
- `initiated`
- `active`
- `dormant`
- `ready_to_close`
- `closed`
- `archived`

Interpretation:

- `intake`: case exists but no approved or active service episode yet
- `initiated`: service is authorized/open but no active action plan is underway
- `active`: at least one active service episode exists
- `dormant`: no active episode, but the case remains open

Rules:

- case should never be `rejected`
- case should never be `pending_approval`
- a denied application does not deny the case; it affects the application episode only

## 3. Action Plan

Recommended field:

- `lifecycle_status`

Recommended values:

- `draft`
- `active`
- `closed`
- `archived`

Keep result/outcome information separate, as PATH already partly does:

- `result_code`
- `result_date`
- `outcome_summary`
- `closure_notes`

## 4. Intervention Proposal

Recommended model:

- create a new entity/table for intervention proposals and revisions
- do not keep proposal workflow in `iset_case_intervention`

Recommended fields:

- `review_status`
- `proposal_kind`
- `decision_reason`
- `source_intervention_id` nullable for revisions

Recommended `intervention_proposal.review_status` values:

- `draft`
- `submitted`
- `in_review`
- `changes_requested`
- `approved`
- `rejected`
- `withdrawn`

Recommended `intervention_proposal.proposal_kind` values:

- `new`
- `revision`

Why a separate entity is the right target:

- proposal approval is a different lifecycle from delivered service
- approval queues should point to proposal records, not live intervention rows
- a rejected proposal should not exist as a rejected live intervention
- approved proposals can create or update real interventions and remain as audit history

## 5. Intervention

Recommended field:

- `delivery_status`

Recommended values:

- `planned`
- `in_progress`
- `suspended`
- `completed`
- `cancelled`

Interpretation:

- `planned` replaces the current overloaded meaning of `approved`
- approval belongs to the proposal record
- live intervention rows should represent actual service delivery only

## 6. External/Reporting Workflows

Some other domains should keep their own status models and not be merged into case/application status:

- ESDC participant submission readiness/submission status
- payment packet and payment line status
- secure-message or signing-request state
- checklist completion state

These are adjacent workflow states, not replacements for application/case status.

## Presentation Model

PATH should present status in layers:

### Primary Badge

Show the entity lifecycle as the main status badge.

Examples:

- application: `In review`
- case: `Active`
- action plan: `Closed`
- intervention: `In progress`

### Secondary Chips

Show separate chips for:

- decision outcome
- awaiting reason
- queue state
- SLA stage

Examples:

- application badge: `Pending decision`
- chips: `Decision: none`, `Queue: approvals`, `SLA: Program decision`

- application badge: `Decision recorded`
- chips: `Decision: approved`

- intervention proposal badge: `Submitted`
- chips: `Queue: approvals`

## Queue Model

Queues should be derived, not encoded in entity `status`.

Examples:

- `Approvals` queue
  - applications where `lifecycle_status = pending_decision`
  - intervention proposals where `review_status IN ('submitted', 'in_review')`

- `Awaiting applicant`
  - applications where `lifecycle_status = awaiting_applicant`

- `Unassigned applications`
  - applications where `lifecycle_status = submitted` and no owner is assigned

- `Case portfolio`
  - cases where `lifecycle_status IN ('initiated', 'active', 'dormant', 'ready_to_close')`

## Database Implications

Recommended schema direction:

- `iset_application`
  - add `lifecycle_status`
  - add `decision_outcome`
  - add `awaiting_reason`
  - add `closure_reason`

- `iset_case`
  - add `lifecycle_status`
  - add `closure_reason`

- `iset_case_action_plan`
  - keep `status` for now or rename later to `lifecycle_status`

- `iset_case_intervention`
  - add `delivery_status`
  - remove proposal workflow from this table over time

- new `iset_intervention_proposal`
  - own proposal/revision review workflow

This should be additive first. Existing `status` columns can remain during transition and be retired later.

## Migration Mapping

## 1. Application Mapping

Current `iset_application.status` -> target fields:

| Current value | `lifecycle_status` | `decision_outcome` | `awaiting_reason` | `closure_reason` |
| --- | --- | --- | --- | --- |
| `submitted` | `submitted` | `null` | `none` | `null` |
| `in_review` | `in_review` | `null` | `none` | `null` |
| `docs_requested` | `awaiting_applicant` | `null` | `documents` | `null` |
| `closure_notice` | `awaiting_applicant` | `null` | `closure_response` | `null` |
| `pending_approval` | `pending_decision` | `null` | `none` | `null` |
| `decision_ready` | `pending_decision` | `null` | `none` | `null` |
| `approved` | `decision_recorded` | `approved` | `none` | `null` |
| `rejected` | `decision_recorded` | `denied` | `none` | `null` |
| `declined` | `decision_recorded` | `denied` | `none` | `null` |
| `completed` | `closed` | `approved` | `none` | `null` |
| `closed` | `closed` | `null` | `none` | `administrative` |
| `withdrawn` | `closed` | `null` | `none` | `withdrawn` |
| `cancelled` | `closed` | `null` | `none` | `administrative` |
| `archived` | `archived` | `null` | `none` | `null` |

Migration note:

- Some historical `closed` / `cancelled` rows may need a better `closure_reason` if the business history is known.
- If post-decision communications are incomplete, migrated `approved` / `rejected` rows may temporarily remain `decision_recorded` rather than `closed`.

## 2. Case Mapping

Current `iset_case.status` -> target `case.lifecycle_status`:

| Current value | Target value |
| --- | --- |
| `pending_approval` | `intake` |
| `submitted` | `intake` |
| `in_review` | `intake` |
| `open` | `intake` |
| `pending` | `intake` |
| `initiated` | `initiated` |
| `active` | `active` |
| `dormant` | `dormant` |
| `ready_to_close` | `ready_to_close` |
| `closed` | `closed` |
| `archived` | `archived` |

Special handling:

- current `rejected` case rows should not survive as a valid target status
- if a rejected case has no action plans or interventions, migrate it to `closed` with closure reason `application_denied`
- if a rejected case has service history, flag it for manual review

## 3. Intervention Mapping

Current `iset_case_intervention.status` should split into two migration paths.

### Live interventions

| Current value | Target entity | Target status |
| --- | --- | --- |
| `approved` | `intervention` | `planned` |
| `in_progress` | `intervention` | `in_progress` |
| `suspended` | `intervention` | `suspended` |
| `completed` | `intervention` | `completed` |
| `cancelled` | `intervention` | `cancelled` |

### Proposal/revision records

| Current value | Target entity | Target status |
| --- | --- | --- |
| `draft` | `intervention_proposal` | `draft` |
| `submitted` | `intervention_proposal` | `submitted` |
| `in_review` | `intervention_proposal` | `in_review` |
| `changes_requested` | `intervention_proposal` | `changes_requested` |
| `rejected` | `intervention_proposal` | `rejected` |

Migration note:

- proposal rows should not remain in the live intervention table after cutover
- revision drafts can be identified from the current `metadata_json.revision.*` structure

## Workflow Impact

The following workflows must be updated together with the status migration:

- application intake
- application assignment
- assessment submit / approver decision
- approval correspondence and follow-up checklists
- case portfolio and case workspace headers
- intervention proposal drafting
- intervention proposal approval
- intervention revision approval
- approvals queue and work-queue badges
- reporting and metrics that currently count mixed status sets

## Implementation Strategy

Recommended order:

1. add new status columns and the proposal table
2. backfill new columns from current values
3. dual-write old and new status structures
4. switch UI and queries to the new fields
5. stop routing proposal workflow through `iset_case_intervention.status`
6. retire the old overloaded status logic

## Code Areas That Must Change

At minimum:

- `docs/guides/status-lifecycle-implementation.md` once cutover begins
- `isetadminserver.js`
  - `recomputeCaseStatus`
  - application approval/update handlers
  - intervention create/revise/update/close handlers
  - queue queries
- `src/utils/rbac.js`
  - current synonym/canonicalization logic must be rewritten
- `src/widgets/CoordinatorAssessmentWidget.js`
- `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`
- `src/pages/home/widgets/WorkQueueItemsTableWidget.js`
- `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`

## Immediate Next Step

Use this target architecture together with `docs/planning/client-case-application-migration-plan.md`, then inventory every status-dependent query, API response, badge, and queue so the rollout can be sequenced without ambiguity.
