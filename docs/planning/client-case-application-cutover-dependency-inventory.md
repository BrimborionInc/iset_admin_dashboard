# Client, Case, and Application Cutover Dependency Inventory

Purpose: inventory the current code, workflow, and status dependencies that must be changed before PATH can safely cut over from the current hybrid model to the agreed target model of one `client`, one `case`, and many `applications`.

Audience: engineering, product, release planning, QA/UAT, and production migration planning.

Last Updated: 2026-04-16

## Status

- Planning draft based on the initial code inspection snapshot.
- Many of the main admin-server compatibility-read hotspots listed here were addressed in DEV on 2026-04-16; treat this note as the baseline inventory, not a claim that every listed dependency is still unresolved.
- This note complements:
  - `docs/planning/client-case-application-target-model.md`
  - `docs/planning/client-case-application-migration-plan.md`
  - `docs/planning/status-architecture-overhaul.md`
- The main migration risk is not the schema change by itself. It is the number of live workflows that still assume:
  - `iset_case.application_id` is the primary relationship anchor
  - legacy `status` values still carry lifecycle, decision, queue, and blocker meaning at the same time

## Executive Summary

Main conclusion:

- The target model is still feasible.
- The migration should still proceed.
- But historical case merges and one-case-per-client enforcement must wait until a small set of high-value write and read paths are cut over first.

Highest-risk dependency families:

- public portal intake completion and applicant messaging context
- admin manual intake and `POST /api/cases`
- `GET /api/applications`, `GET /api/cases`, `GET /api/cases/:id`, and `PUT /api/cases/:id`
- dashboard queue endpoints and homepage queue widgets
- `CoordinatorAssessmentWidget`, `InterventionAssessmentWidget`, and `src/utils/rbac.js`

Release planning implication:

- Release 1 can still be additive schema only.
- Release 2 must add compatibility reads/writes and backfills.
- Release 3 must cut over the write paths listed below.
- Release 4 must not merge historical cases or enforce one-case-per-client until the read paths below stop depending on `iset_case.application_id`.

## Relationship Dependencies

## 1. Write Paths That Still Create or Resolve Cases By `application_id`

### Public portal submission

Current behavior in `../ISET-intake/server.js`:

- `POST /api/intake/complete` creates `iset_application`, then looks up `iset_case` by `application_id`, and creates a new case with `(application_id, client_id, ...)` if one does not exist.
- This is the core behavior at lines around `4995` and `5043`.

DEV status update:

- The main portal submit path was cut over in DEV on 2026-04-16 to reuse an existing client case when available and to persist `iset_application.client_id` and `iset_application.case_id`.
- The legacy `iset_case.application_id` pointer is still refreshed during that DEV transition so current case-centric flows keep opening the current application.

Migration implication:

- This must change to:
  - resolve or create `client`
  - resolve that client's single `case`
  - create `application` with explicit `client_id` and `case_id`
  - stop creating a new case per application

### Manual application intake

Current behavior in `isetadminserver.js`:

- admin manual intake creates `submission`, then `application`, then `client`, then inserts `iset_case (application_id, case_number, client_id, ...)`.
- This is the main write path at lines around `69363` to `69430`.

DEV status update:

- This flow was cut over in DEV on 2026-04-16 to resolve/create `client` first, write `iset_application.client_id`, then reuse or create the client's case and persist `iset_application.case_id`.

Migration implication:

- This flow must follow the same rule as portal submit.
- Manual intake must not create a second case for an existing client.

### Admin `POST /api/cases`

Current behavior in `isetadminserver.js`:

- `POST /api/cases` still treats `application_id` as the uniqueness check.
- If an application is present it blocks on `SELECT id FROM iset_case WHERE application_id = ?`.
- It then inserts `iset_case (application_id, client_id, ...)`.
- This is the current create-case route at lines around `38335` to `38490`.

DEV status update:

- This route was cut over in DEV on 2026-04-16 to client-first case reuse.
- Application-backed requests now return the reused case when one already exists for the client or for the already-linked application instead of always trying to insert a new case row.

Migration implication:

- This route must become client-first.
- For application-backed intake it should reuse the client's case.
- For true client-file creation it should remain able to create an application-less case.

## 2. Portal/Applicant Flows That Infer Case Context Through `application_id`

Current behavior in `../ISET-intake/server.js`:

- applicant messaging context resolves `caseId` from the latest case where `application_id = ?`
- applicant secure-message event helpers derive missing `applicationId` or `caseId` by hopping through `iset_case.application_id`

Key hotspots:

- `resolveApplicantMessagingContext`
- `resolveApplicantOutboundMessageTarget`
- `emitApplicantSecureMessageReceivedEvent`

Migration implication:

- Applicant messaging must derive allowed context from explicit `application.case_id` or from the applicant's canonical case, not by reverse-looking up the latest case for an application.

## 3. Core Admin Read APIs Still Anchored On `c.application_id = a.id`

### `GET /api/cases`

Current behavior in `isetadminserver.js`:

- joins `iset_application` through `LEFT JOIN iset_application a ON c.application_id = a.id`
- exposes `c.application_id` directly in the case list payload
- search, owner, tracking id, and derived counts still assume one primary application per case
- open intervention counts also still include proposal-review statuses as live open work

Key section:

- lines around `40836` to `41076`

Migration implication:

- case list must stop treating one application as the case header record
- if application context is needed, it should choose an explicit latest/current application view or a separate application summary payload

### `GET /api/cases/:id`

Current behavior in `isetadminserver.js`:

- the case detail query loads the linked application through `c.application_id`
- application lock, row version, docs-request state, submission data, and applicant data all ride through that one application link
- even the fallback query assumes an application-backed case when available

Key section:

- lines around `46778` to `47054`

Migration implication:

- case detail must become truly case-first
- application detail must be selected explicitly, not assumed to be singular
- locking/versioning must move from "the case's one application" to "the currently opened application"

### `GET /api/applications`

Current behavior in `isetadminserver.js`:

- uses `FROM iset_case c JOIN iset_application a ON c.application_id = a.id`
- elevated-role unassigned rows are detected with `LEFT JOIN iset_case c2 ON c2.application_id = a.id`
- counts use the same join assumption

Key section:

- lines around `70901` to `71085`

Migration implication:

- application list must become application-native
- cases should be joined by `a.case_id`
- "unassigned" should mean "application has no owner/case assignment context", not "no case row exists for this application id"

### `PUT /api/cases/:id`

Current behavior in `isetadminserver.js`:

- loads the current application through `c.application_id`
- uses application row-version locking from that relationship
- blocks `applicationStatus` and docs-request mutations if the case has no linked application
- still treats approval as a coupled case/application status write

Key section:

- lines around `72105` to `72960`

Migration implication:

- the write contract must split:
  - case lifecycle updates on the case
  - application lifecycle/decision/blocker updates on the selected application
- the current route may survive for compatibility, but its data model must change underneath it

## 4. Queue, Dashboard, and Reporting Endpoints Still Assume One Primary Application Per Case

Current behavior in `isetadminserver.js`:

- dashboard application queues join through `c.application_id = a.id`
- intervention approval queue still joins the proposal row back to the application through the case's `application_id`
- marked-for-closure and EI eligibility queues still key off legacy application statuses

Key endpoints:

- `/api/dashboard/ei-eligibility-items`
- `/api/dashboard/awaiting-approval-items`
- `/api/dashboard/watchlist-hit-items`
- `/api/dashboard/marked-for-closure-items`
- `/api/dashboard/intervention-approval-items`

Key section:

- lines around `31874` to `32532`

Migration implication:

- application queues must be application-native
- intervention approval queues must use case plus proposal context, with optional application provenance, not the case's single linked application

## 5. Supporting APIs With Secondary Relationship Drift

Other notable dependencies:

- `GET/POST /api/cases/:case_id/application/*` versioning routes are still case-keyed rather than application-keyed
- assignment events publish `applicationId: caseRow.application_id`
- task queries still join task -> case -> application
- several document and reminder queries still coalesce application context from `c.application_id`
- `GET /api/case-assignment/unassigned-applications` still has a temporary join/comment assuming `c.application_id`

Migration implication:

- these do not need to be first, but they must be in the Release 2 and Release 3 inventory
- otherwise production cutover will leave hidden legacy joins behind

## Status Dependencies

## 1. Backend Status Model Still Overloads Meaning

Current behavior in `isetadminserver.js`:

- application status still carries lifecycle, blocker, approval queue, and decision meanings in one field
- case status still accepts or derives pre-approval meanings such as `pending_approval`
- intervention status still mixes proposal review and live delivery
- docs-request state still partly mutates `application.status = 'docs_requested'` even though dedicated `docs_requested_*` columns already exist

Key hotspots:

- `CASE_STATUS_DERIVED_VALUES`
- `APPLICATION_DECISION_STATUSES`
- `OPEN_INTERVENTION_PROPOSAL_STATUSES`
- `CANONICAL_INTERVENTION_STATUSES`
- docs-request update logic in `PUT /api/cases/:id`

Migration implication:

- schema and code cutover should move status responsibility to the owning entity
- queues must derive from the new fields rather than treat stored status as presentation shorthand

## 2. Application Assessment Workflow Still Couples Case and Application Status

Current behavior in `src/widgets/CoordinatorAssessmentWidget.js`:

- assessment submission sets both `status` and `applicationStatus` to `pending_approval`
- outcome completion maps:
  - approved -> case `initiated`, application `approved`
  - push back -> case `pending_approval`, application `in_review`
  - deny -> case `rejected`, application `rejected`
- later communication/funding-doc completion marks application `completed`

Key section:

- lines around `6278` to `6281`
- lines around `7631` to `7971`

Migration implication:

- application decision flow must stop using case status as a mirror of the latest application outcome
- case should remain open/intake/active independently of application decisions

## 3. Intervention Proposal Workflow Still Lives Inside `iset_case_intervention.status`

Current behavior in `src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx`:

- proposal drafts use live intervention rows with statuses such as `draft`, `submitted`, `in_review`, `changes_requested`
- decision outcomes write back `approved`, `rejected`, or `changes_requested`
- approval then turns that same record into a live intervention or revision artifact

Key section:

- lines around `1791` to `1843`
- lines around `4246` to `4285`
- lines around `4679` to `4838`

Migration implication:

- proposal review needs its own entity/table and its own status field
- live interventions should carry delivery status only

## 4. Frontend Status Normalization And RBAC Still Collapse Distinct Meanings

### `src/utils/rbac.js`

Current behavior:

- maps `approved -> initiated`
- maps `submitted` and `in_review` to `pending_approval`
- maps `rejected -> archived`
- still treats `rejected` as a final case status

Migration implication:

- this file must be rewritten around explicit case lifecycle and explicit application lifecycle/decision fields

### `src/pages/home/widgets/WorkQueueItemsTableWidget.js`

Current behavior:

- badge colors and labels still mix application, case, and intervention semantics
- `pending_approval`, `docs_requested`, `closure_notice`, `approved`, `completed`, and `rejected` are all rendered from one raw status pipe
- approval SLA rows are hard-coded as `pending_approval`

Migration implication:

- queue rows need a typed status payload:
  - primary lifecycle label
  - optional decision chip
  - optional awaiting/blocker chip
  - derived queue bucket

### `src/pages/home/widgets/ProgramAdminWorkQueueWidget.js`

Current behavior:

- one bucket called `Approvals` still combines application approvals and intervention proposal approvals into one presentation concept

Migration implication:

- this is acceptable as a UI bucket only if the underlying data model is split cleanly
- the bucket must be derived from separate application and proposal status sources

## 5. UI Language Still Reflects The Old Model

Current behavior:

- `src/pages/home/widgets/CaseWorkQueueWidget.js` still says client case files are only created when a client's first ISET application is approved

Migration implication:

- the target model and user-facing copy are out of alignment
- copy cleanup should land with workflow cutover, not after production migration

## Recommended Cutover Order

## 1. Release 1: Additive Schema And Status Structure

- add `iset_application.client_id`
- add `iset_application.case_id`
- add `iset_case_action_plan.application_id`
- add new application/case status fields
- add the intervention proposal structure
- do not remove `iset_case.application_id` yet

## 2. Release 2: Backfill And Compatibility Reads

- backfill `application.client_id` and `application.case_id`
- backfill action-plan application provenance
- backfill new status columns from current legacy values
- update reads to prefer the new columns when present

## 3. Release 3: Write-Path Cutover

Must cut over first:

- public portal `POST /api/intake/complete`
- admin manual intake
- admin `POST /api/cases`
- case/application status writes in `PUT /api/cases/:id`

Target behavior:

- one client resolves to one case
- every submitted application is written with `client_id` and `case_id`
- no new case is created just because a new application exists

## 4. Release 3: Read-Path Cutover

Must cut over before case merge:

- `GET /api/applications`
- `GET /api/cases`
- `GET /api/cases/:id`
- dashboard queue endpoints
- applicant messaging/document/reminder helpers
- key homepage/workspace widgets

## 5. Release 4: Historical Consolidation And Constraint Enforcement

Only after the above is stable in test/UAT and then production:

- merge duplicate cases per client
- repoint applications to canonical cases
- enforce one case per client
- retire legacy status normalization and `iset_case.application_id` dependency paths

## Test And Production Migration Notes

Test/UAT rehearsal requirements:

- use a sanitized production snapshot, not the local dev DB
- rehearse portal submit, manual intake, client import, approval, messaging, documents, action-plan creation, and queue/reporting views
- verify both existing historical rows and new post-cutover rows

Production readiness gates:

- no remaining critical read/write dependency on `iset_case.application_id`
- application queues and case views work with explicit `application.case_id`
- status badges and queues work from the new status model
- merge scripts are logged, reviewable, and reversible

## Immediate Next Implementation Step

- Draft the Release 1 DDL and Release 2 backfill scripts directly from this inventory.
- Start with the additive schema and the write-path hotspots, because those are the blockers for safe production migration.
