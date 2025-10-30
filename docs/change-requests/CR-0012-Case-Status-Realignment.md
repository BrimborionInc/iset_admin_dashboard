# Change Request CR-0012 – Case vs Application Status Realignment

## Context
- Current `iset_case.status` values still mirror the legacy application workflow (draft, approved, rejected, etc.).
- The case workspace introduced `stage` / `subStage` fields to describe casework progress, but the rest of the product (queues, counting queries, dashboards) still keys off the old `status`.
- This duplication confuses staff and the UI: cases often show `status = approved` alongside a separate stage badge (e.g. “Assessment → Documents requested”).
- We need a dedicated case lifecycle that reflects action plan activity and closes the gap between the workspace and the broader dashboards.

## Problem Statement
- Case-facing screens use two competing vocabularies (`status` vs `stage/subStage`), forcing users to interpret both.
- `iset_case.status` is still required by assignment/SLA logic, so we cannot simply ignore or blank it.
- The application lifecycle (submission → approval/rejection) should remain distinct from the case lifecycle (plan execution, dormancy, closure).

## Goals
1. Define a clear, case-centric status model that supports day-to-day casework.
2. Preserve application lifecycle statuses separately (on the application records).
3. Remove the need for `stage` / `subStage` by folding their meaning into the new case statuses.
4. Update backend logic and UI so the entire product uses the same case lifecycle vocabulary.

## Non-Goals
- Changing the application intake flow or its status names.
- Altering action plan or intervention status models (they already align with workspace UX).
- Building the automation to recompute new statuses (will be covered by follow-on implementation tasks).

## Proposed Changes
### Status Model
- **Application status** (existing): remains tied to the submission lifecycle (`submitted`, `under_review`, `approved`, `rejected`, `archived`).
- **Case status** (new canonical set):
  - `pending_approval` – submission has arrived but casework has not begun (default for auto-created `iset_case` rows).
  - `initiated` – application approved, but no action plans exist yet.
  - `active` – at least one action plan is active.
  - `dormant` – case has plans but none active (e.g. all closed or archived).
  - `ready_to_close` – business logic identifies that closure work remains but no plan activity is left (exact rules to confirm in implementation).
  - `closed` – casework complete.
  - `archived` – historical retention state.
- Deprecate `iset_case.stage` / `iset_case.sub_stage` once UI/queries are migrated.

### Backend
- Introduce helpers in `isetadminserver.js` to derive and persist the new case statuses when:
  - An application moves from `approved` → case becomes `initiated`.
  - Action plans are activated/closed/archived to flip case status between `active`, `dormant`, and `ready_to_close`.
  - Closure/archive flows run to mark `closed` or `archived`.
- Update counting queries (work queues, SLA dashboards) to filter/scope using the new case status strings, not the legacy list.

### Frontend / UX
- Portfolio dashboard: replace stage/sub-stage badges with the new case status labels.
- Workspace header: show the case status pill (with friendly labels) instead of stage/sub-stage chips.
- Remove stage/sub-stage references from widget descriptions, filters, and help copy.
- Ensure action plan/intervention components remain unchanged; they continue to expose their own statuses.

### Data / Migration
- Backfill existing cases:
  - For cases with active plans → `active`.
  - Cases with only closed/archived plans → `dormant` (or `closed` if closure criteria already met).
  - Cases with no plans but approved applications → `initiated`.
  - Historical records previously marked `archived` / `closed` stay as-is.
- Drop or leave null the stage/sub-stage columns after all consumers move to the new status (decision pending; likely phased removal).

## Risks & Considerations
- We must audit every consumer of `iset_case.status` to avoid regressions during the transition.
- Reporting extracts that currently join on stage/sub-stage will need updates.
- Migration script must be idempotent and safe for both sandbox and production datasets.
- Until the backfill runs, screens may temporarily show mismatched statuses.

## Open Questions
1. Do we need an automated rule for transitioning `ready_to_close` → `closed`, or is it manual?
2. Should legacy stage/sub-stage values be preserved anywhere for analytics, or can we retire them entirely?
3. What SLA/business logic determines when a dormant case becomes `ready_to_close` versus remaining `dormant`?

## Timeline & Ownership (Draft)
1. **Design sign-off** – confirm status definitions and migration approach (stakeholders: Case Ops, Product, Finance).
2. **Backend implementation** – update API, introduce status recompute helpers, write migration/backfill scripts.
3. **Frontend alignment** – adjust portfolio + workspace UI, remove stage/sub-stage references, update docs/help.
4. **Data migration & rollout** – run backfill in lower environments, validate, deploy to production.
5. **Cleanup** – remove unused stage/sub-stage fields and legacy status handling once adoption is complete.

## Implementation Plan
1. **Schema Preparation**
   - Extend `iset_case.status` enum (or introduce lookup) with the new case lifecycle values.
   - Decide on retention/removal approach for `stage` / `sub_stage` (keep nullable for transition or drop immediately).
   - Document existing indexes/constraints that reference `status`, `stage`, `sub_stage`, and the task/intervention counters.
2. **Status Derivation Helper**
   - Implement a server-side helper (e.g., `recomputeCaseStatus(caseId, connection)`) in `isetadminserver.js`.
   - Call helper from:
     - Application approval/rejection flows.
     - Action plan create/activate/close/archive endpoints.
     - Case close/archive endpoints (existing or new).
3. **Database Migration / Seed**
   - Write an idempotent SQL/data job to backfill existing cases to the new statuses based on current plan data.
   - For environments we can reset, update seed scripts to create sample cases covering every new status.
4. **Backend Consumer Updates**
   - Replace stage/sub-stage usage in counting queries, SLA logic, and any filters with the new status names.
   - Ensure `/api/cases` and `/api/cases/:id/workspace` expose the new status and no longer send stage/sub-stage.
5. **Frontend Updates**
   - Portfolio dashboard: update columns, filters, and copy to show case status (friendly label mapping).
   - Workspace header & widgets: swap stage/sub-stage badges for the new status pill; adjust help text.
   - Remove any UI references to stage/sub-stage.
6. **Documentation & Comms**
   - Update user guides, help panels, and release notes to explain the new status vocabulary.
   - Document the helper/migration script for operations.
7. **Rollout & Validation**
   - Deploy to lower environments, run backfill, validate dashboards and workspace behaviour.
   - After production rollout, monitor queues/dashboards to confirm counts match expectations.
8. **Cleanup**
   - Once all consumers are confirmed switched, drop `stage` / `sub_stage` columns and remove legacy status constants.
   - Remove any dead code or feature flags related to the transition.

## Documentation & Follow-Up
- Update case management guides and help panels to reference the new status vocabulary.
- Add a short migration note for developers/operators describing the status recompute logic.
- Ensure change is recorded in release notes and communicated to frontline staff prior to deployment.

## Progress Log
- 2025-11-01 Schema Recon (Phase 1, Step 1)
  Reviewed iset_intake_iset_case dump: status is a varchar(32) defaulting to "open" with indexes on status, (status, assigned_to_user_id), and no enum constraint. stage / sub_stage plus several operational fields (priority, task/intervention counts, etc.) are present with dedicated indexes (idx_iset_case_stage, idx_iset_case_open_task_count, etc.). Existing Node code defensively checks for the presence of the stage columns (__stageColumnPresent guards in isetadminserver.js), so any removal plan must tidy those guards. Next step is to define the exact status mutation helper and transition strategy.
- 2025-11-01 Status Derivation Design (Phase 1, Step 2)
  Inspected iset_case_action_plan (status enum enforced via CHECK: draft, active, closed, archived) and iset_case_intervention (status varchar(32) with existing normalization helpers). Proposed recompute logic: (1) leave archived/closed untouched unless explicitly reopened; (2) if any plan is active, mark the case active; (3) if plans exist but none are active, fall back to dormant (with an explicit path to ready_to_close); (4) if no plans exist, use initiated once the application is approved, otherwise stay pending_approval. Helper will live in isetadminserver.js and run after application decisions plus plan state changes. Next step: outline migration/backfill approach.
- 2025-11-01 Migration Outline (Phase 1, Step 3)
  Backfill strategy: seed lower environments after the helper lands; for persistent data, run an idempotent SQL job that (a) resets everything to pending_approval, (b) upgrades to initiated when the linked application has an approved decision and no plans, (c) derives active / dormant via plan aggregates, and (d) leaves space for ops to mark ready_to_close, closed, or archived. Stage/sub-stage columns remain nullable until final cleanup. Ready to move into Phase 2.
- 2025-11-01 Case Status Helper (Phase 2, Step 1)
  Added CASE_STATUS_DERIVED_VALUES constants and a reusable recomputeCaseStatus(caseId, connection) helper in isetadminserver.js. The helper normalises stored values, short-circuits for final states (ready_to_close, closed, archived), and otherwise derives status from action-plan activity (active with any active plan, dormant when plans exist but none active, initiated/pending_approval when no plans exist). Updates are written lower-case and the helper returns { status, previousStatus, changed } so callers can react. Next step: wire this helper into every endpoint that alters case state (application approval, action plan activate/close/archive, case close/archive).
- 2025-11-01 Helper Integration (Phase 2, Step 2)
  Updated action plan create/activate/close/archive endpoints to call recomputeCaseStatus so case lifecycle reacts immediately to plan mutations. Helper now distinguishes between draft-only plans (case stays initiated) and historical plans (case becomes dormant). Remaining work: hook the helper into case status edits and future close/archive flows.

- 2025-11-01 Status Vocabulary Alignment (Phase 2, Step 3)
  Updated backend constants so work-queue logic uses the new case lifecycle (pending_approval, initiated, active, dormant, ready_to_close, closed, archived). Removed the obsolete stage update endpoint and its runtime guards; recomputeCaseStatus now governs the lifecycle. Next: migrate queues/SLA queries and update UI to consume the new status field.
- 2025-11-02 Portfolio API Alignment (Phase 2, Step 4)
  Relocated the case status constant block ahead of recomputeCaseStatus to prevent TDZ crashes, normalised the `/api/cases` filter/response so it drops legacy stage/subStage fields, emits canonical status keys, and wraps task/intervention metrics in a `counts` helper. Workspace and watch payloads now mirror that structure (status + statusRaw, no stage echo). Outstanding: complete the queue/SLA helper rewrites and finish migrating front-end widgets off the scaffolded portfolio data set.
- 2025-11-02 Stage Retirement & NWAC Flow (Phase 2, Step 5)
  Removed the `/api/cases/:id/stage` compatibility endpoint, updated coordinator assessment flows to rely on canonical statuses (`pending_approval`, `initiated`, `archived`), and dropped stage badges from the application overview. NWAC approvals now send the new status values and UI fallbacks carry `statusRaw` for consistency. Outstanding: expand regression coverage for the approval/assessment paths and queue/SLA summaries once test harness is ready.
- 2025-11-02 Applications Widget Alignment (Phase 2, Step 6)
  `/api/applications` now surfaces both `application_status` and `case_status`, and the Applications widget renders the intake lifecycle while still exposing case ownership details. Legacy checks were updated to look at `case_status` only where assignment logic demands it.
- 2025-11-02 NWAC Assessment Status Bugfix (Phase 2, Step 6 follow-up)  
  While validating the Assessment dashboard, the NWAC widget continued to display the outcome panel as if the application were `pending_approval`. Browser logs showed `rawApplicationStatus: null`, so the widget fell back to the case status (`pending_approval`). Root cause: the `/api/cases/:id` handler never projected `a.status AS application_status` in its primary query, so cached responses lacked the application lifecycle value even after we normalised the payload. Dev time was lost because we kept debugging front-end caching before noticing the missing column in the SQL SELECT. Resolution: update the base select to include `application_status`, normalise the initial fetch before caching, and clear stale cache entries. Lesson: whenever we add new fields that front-end components depend on, confirm every API path (initial fetch, refresh, cache hit, and query projection) hydrates them, otherwise widgets regress to legacy case status fallbacks and debugging tunnels onto the wrong layer.
- 2025-11-02 Assessment Widget Live Refresh (Phase 2, Step 6 follow-up)  
  Submitting the assessment or approving/rejecting the outcome now triggers the shared `refreshCaseData` callback and the Application Overview widget reads `caseData.applicationStatus` before falling back to stale values. Previously the overview badge only updated after a full page reload, masking the correct status change and forcing manual refreshes. Lesson: whenever multiple widgets share the same status indicators, wire them to the same refresh path and prefer the normalised payload instead of duplicating derive logic per component.
