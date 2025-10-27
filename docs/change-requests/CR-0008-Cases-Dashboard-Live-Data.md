# Change Request CR-0008 — Cases Dashboard Live Data Enablement

## Context
- **Business driver:** Portfolio leadership needs a reliable operational view of all ISET cases—both application-derived and legacy/admin-created—to coordinate workloads and meet SLA targets.
- **Current state:** The `Cases` widget on `PortfolioDashboardPage` is scaffold-only, powered by mock data with no persistence, RBAC enforcement, or assignment actions wired to the backend.
- **Reference materials:** `src/pages/iset/portfolio/widgets/CasesTableWidget.jsx`, `src/pages/iset/portfolio/PortfolioCaseContext.jsx`, `isetadminserver.js`, existing CRs `CR-0003` (financial module scaffolds) and `CR-0007` (data enrichment patterns).

## Problem Statement
- Case managers cannot rely on the current dashboard listing because it omits live data and ignores permissions.
- Assignment actions are non-functional, preventing rapid routing and rebalancing of case workloads.
- Existing case records lack a normalized `client` reference, making it difficult to join demographic data consistently across services.

## Goals
1. Replace the mock `Cases` widget with a fully data-enabled table backed by server pagination, sorting, and RBAC-aware actions.
2. Introduce a minimal `client` table, link it to `iset_case`, and backfill existing records so future workflows can depend on normalized client metadata.
3. Deliver assignment and re-assignment APIs with audit emission, enforcing that assessors cannot reassign their own cases.

## Non-Goals
- Implementing action plan, intervention, or submission log tables (deferred).
- Redesigning the case lifecycle or dashboard layout beyond the required wiring for live data and actions.
- Building new UI for client detail or bulk assignment; this CR focuses on single-case assignment flows.

## Scope
### Database (MySQL 8.0 / InnoDB)
1. **New table `client`:** columns `id BIGINT PK AUTO_INCREMENT`, `sin_hash VARBINARY(32) NULL`, `dob DATE NOT NULL`, `gender VARCHAR(32) NULL`, `aboriginal_group VARCHAR(64) NULL`, `last_name VARCHAR(128) NOT NULL`, `first_name VARCHAR(128) NOT NULL`, `initials VARCHAR(16) NULL`, `address_json JSON NULL`, `created_at`, `updated_at` (UTC, default current timestamp, on update). Charset `utf8mb4`, engine `InnoDB`.
2. **Alter `iset_case`:** add `client_id BIGINT NOT NULL`, FK `fk_iset_case_client_id` → `client(id)` ON DELETE RESTRICT; change `application_id` to nullable with FK `fk_iset_case_application_id` → `iset_application(id)` ON DELETE RESTRICT. Update indices if required (e.g., composite `(client_id, status)` for future queries).
3. **Backfill script:** for each existing `iset_case` record, derive client payload from the latest `iset_application.payload_json` (preferred) or `iset_application_submission.intake_payload`; populate a `client` row and update `iset_case.client_id`. Log/flag rows where no payload exists (should be none in prod snapshots; fall back to placeholder data suitable for remediation).
4. **Down migration:** drop FKs / columns in reverse order, removing `client` table only after clearing references.
5. **Case workspace enablement:** add dedicated persistence for the Case Workspace page:
   - Extend `iset_case` with lifecycle metadata (`case_number`, `stage`, `sub_stage`, `opened_at`, `closed_at`, `next_action_due_at`, `risk_rating`, `portfolio_region_id`) and cached counters (`open_task_count`, `overdue_task_count`, `open_intervention_count`, `total_intervention_count`) plus audit references (`created_by_staff_profile_id`, `updated_by_staff_profile_id`). All fields remain nullable/zero-default until populated.
   - Introduce `iset_case_event` to capture timeline entries (`event_type`, `summary`, `payload_json`, `occurred_at`, `actor_*`, `source_system`) with dense indexes on `(case_id, occurred_at DESC)` and `(event_type, occurred_at DESC)`.
   - Add `iset_case_task` for structured task tracking (title, status, category, due/completed dates, assignee + audit metadata, soft delete), keyed for both case and assignee roll-ups.
   - Model action plans via parent `iset_case_action_plan` and child `iset_case_action_item` tables, supporting versioning, ownership, and per-step outcomes.
   - Persist interventions through `iset_case_intervention` (type, status, dates, funding buckets, outcome metadata, optional plan linkage).
   - Track compliance artefacts with `iset_case_compliance_check` (`requirement_code`, status, due/fulfilled timestamps, evidence document FK).
   - Store financial snapshots in `iset_case_financial_snapshot` (per-case/per-date allocations, commitments, spend, variance, JSON detail) for the finance panel.
   - Extend `iset_document` with `document_category`, `visibility`, `linked_task_id`, `linked_intervention_id` to support filtered document views and cross-linking within the workspace.

#### Database Notes (2025-10-26)
- Baseline `iset_case` definition (from `docs/data/DB-Structure-Dump/iset_intake_iset_case.sql`): only columns are `id`, `application_id` (NOT NULL), `assigned_to_user_id`, `status`, timestamps, with indexes on `application_id`, `assigned_to_user_id`, `status`. No existing foreign keys.
- No `client` (or similarly named) table exists in the dump.
- Migration will therefore create `client` from scratch and retrofit `iset_case` with `client_id` plus nullable `application_id`, alongside new indexes (`idx_iset_case_client_id`, `idx_iset_case_owner_status`, etc.).
- 2025-10-26 19:50 UTC validation:
  - `client` table now present with expected columns and `utf8mb4_unicode_ci` collation.
  - `iset_case` reports `client_id` (nullable for now), `application_id` now `NULL DEFAULT NULL`, and named FKs `fk_iset_case_client_id` / `fk_iset_case_application_id`.
  - Newly created indexes confirmed via `SHOW INDEX FROM iset_case` (`idx_iset_case_client_id`, `idx_iset_case_status_owner`).
  - `iset_migration` contains a success record for `20251026_create_client_and_update_iset_case.sql` (duration recorded; success=1).
  - Existing Express route `app.get('/api/cases')` currently dumps an unpaginated array using `ANY_VALUE` aggregates; replacement will honour the contract above (pagination + RBAC-friendly filtering). Document response shape change for any future consumers.
  - Current live schema (2025-10-26): `iset_case` columns are limited to `id, application_id, client_id, assigned_to_user_id, status, created_at, updated_at`. Fields such as `priority`, `stage`, `opened_at`, etc. are not yet present. Future iterations of the caseworking module may extend the table; until then, derived values (e.g., SLA/priority) must be computed from other sources or returned as placeholders.
  - `client` columns confirmed (`id, dob, gender, aboriginal_group, last_name, first_name, initials, address_json, created_at, updated_at`).

### Backend API (Node/Express)
1. **GET `/api/cases`:**
   - Accept query params: `query` (string search), `status` (enum, multi-value), `owner` (user id), `stage`, `page` (default 1), `pageSize` (default 10, max 100), `sort` (column) and `direction`.
   - Join `client`, `iset_application`, and `staff_profiles` (plus optional `iset_evaluator_ptma` metadata) as needed for owner info, returning JSON `{ items: CaseRow[], page, pageSize, totalCount }` (optional `nextPage` for cursor-style pagination).
   - Apply RBAC filters so users only see permitted cases (existing role matrix rules). Supersedes the legacy unpaginated implementation in `isetadminserver.js`.
   - `CaseRow` (draft): `{ id, status, stage?, openedAt?, closedAt?, lastActivityAt?, applicationId, trackingId, submittedAt?, owner: { id?, name?, email? }, client: { id?, firstName?, lastName?, dob?, gender?, aboriginalGroup? }, financeStatus?, fyActuals?, fyVariance?, interventionCounts?, regionId? }`. Optional properties default to `null` when data is unavailable; finance/intervention metrics will be populated as downstream services come online.
   - During transition (until client backfill completes) fall back to extracting name/dob from `iset_application.payload_json` whenever `client_id` is `NULL`.
   - Pagination design: server accepts `page` + `pageSize`; response includes `totalCount` (via `SQL_CALC_FOUND_ROWS` alternative `COUNT(*) OVER()` window or second query) to keep Cloudscape table working. Sorting initially limited to `status`, `created_at`, `updated_at` (last activity fallback), and `client.last_name`.
   - Filtering: `query` matches on `client` names, tracking ID, assigned user name/email; `status` and `owner` filters translate to `WHERE` clauses (`IN` lists). `stage` filter remains optional until column exists; treat absent column as noop.
2. **GET `/api/cases/:id/workspace`:**
   - Returns the workspace summary used by the Case Header widget (case metadata, client/owner context, headline counters).
   - Applies the same RBAC rules as the listing endpoint (system/program admins see all, regional coordinators are restricted to their region or unassigned cases, assessors/adjudicators only see cases assigned to them; all other roles receive `403`).
   - Draft payload:
     ```json5
     {
       "id": 123,
       "caseNumber": "CRF-1234567",
       "status": "approved",
       "stage": "in_progress",
       "subStage": "documents",
       "priority": "high",
       "riskRating": "medium",
       "openedAt": "2025-05-01T13:22:11.000Z",
       "closedAt": null,
       "updatedAt": "2025-10-27T14:03:55.000Z",
       "nextActionDueAt": "2025-11-05T00:00:00.000Z",
       "agreementNumber": "ISET-20251027-C03D13",
       "applicationId": 456,
       "client": {
         "id": 789,
         "firstName": "William",
         "lastName": "Sillery",
         "fullName": "William Sillery",
         "dateOfBirth": "1971-03-10",
         "region": { "id": 14, "code": "PR", "name": "Prairies" }
       },
       "owner": {
         "id": 21,
         "name": "Shelley Stacey",
         "email": "shelley@example.ca",
         "role": "Program Administrator",
         "regionId": 14
       },
       "counts": {
         "openTasks": 2,
         "overdueTasks": 1,
         "openInterventions": 1,
         "totalInterventions": 3
       }
     }
     ```
   - The response can be extended with timeline/action-plan/finance/compliance data without introducing additional endpoints; consumers should treat unknown properties as optional.
   - Initial lifecycle handling: when a case transitions to `status = approved` via `PUT /api/cases/:id`, the server now seeds `stage = 'planning'` and `subStage = 'backlog'` so downstream widgets have a baseline value. Future case-management endpoints (action plan approval, intervention start, compliance review, closure) will be responsible for advancing these fields and recording corresponding `iset_case_event` entries.
   - Region values derive from the client’s captured address (province -> canonical label). If no address/province is available, the response returns `null` and the UI shows “Not set”; we no longer fall back to the assessor’s region for display.
   - Current implementation ignores `stage` filter (with console warning) because `iset_case` lacks that column; will be revisited when lifecycle fields are introduced.
2. **POST `/api/cases/:id/assign`:**
   - Body `{ toUserId }` (required). Only roles with assignment permission may invoke (System Admin, Program Admin, Regional Coordinator per current policy).
   - Validations: case must exist, not already assigned to `toUserId`, ensure assigner has scope over target user (region constraints for RC).
   - Persist assignment change, emit audit/event entry (`case.assignment.assigned`) with actor, target, case metadata.
   - Replaces legacy `PATCH /api/cases/:id/assign` (which accepted `assignee_id` or placeholder email). Old route retained temporarily for backwards compatibility.
3. **POST `/api/cases/:id/reassign`:**
   - Same body/validations as assign, plus: forbid when `currentUser.id === case.ownerId` (self-reassignment block for assessors), and require that case currently has an owner.
   - Emit `case.assignment.reassigned` event.
4. **Error handling:** use structured error payloads `{ message, detail?, field? }` that map cleanly to Cloudscape notifications or inline messaging.
5. **Unit tests:** cover happy path, RBAC denial, invalid payload, missing case, self-reassign block.
- Update `POST /api/cases` to require `client_id` (and optional `application_id`). For admin-created cases, payload is `{ clientId, applicationId?, assignedToUserId?, status? }`. Enforce referential integrity and return 422 if `client_id` missing.

### Frontend (React / Cloudscape)
1. **Data layer:** introduce `useCasesData` hook (e.g., in `src/pages/iset/portfolio/hooks/useCasesData.js`) handling fetch, pagination, sorting, filter state, debounced search, and Cloudscape preference persistence (still stored in `localStorage`/`sessionStorage`).
2. **Widget updates:** in `CasesTableWidget.jsx`:
   - Replace reliance on `PortfolioCaseContext` mock data; use hook results instead.
   - Support Cloudscape Table server-side pagination/sorting (update `Table` props for `sortingDisabled={false}` and handle `onSortingChange` etc.).
   - Update empty/loading states, show skeleton or progress indicator while fetching.
   - Surface `Unassigned` as a badge when no owner (admin-created cases) and highlight rows accordingly.
3. **Inline actions:** maintain existing `Assign` / `Reassign` links but open a modal (new component) that fetches eligible users. Respect RBAC check from hook’s `canAssign`/`canReassign` flags. Disable buttons when action is not allowed.
4. **RBAC wiring:** feed current user ID/role via `useCurrentUser`; hide `Reassign` when `ownerId === currentUserId`. Ensure assessors never see assignment actions.
5. **Notifications:** show success/error toasts based on API responses using existing notification infrastructure (if absent, create minimal scaffolding).
- **Demo toggle:** surface a “Use live case data” toggle in `DemoNavigation` (persisted to sessionStorage/localStorage) so developers can switch between mock and live responses while front-end integration iterates.
6. **Inline modal flow:** render a case assignment modal inside the portfolio widget that pulls `/api/staff/assignable` options, posts to `/api/cases/:id/assign|reassign`, and refreshes the server-backed table on success. Disable actions when live mode is off to keep scaffolds intact.
7. **User feedback:** show dismissible success alerts after assignment/reassignment and retain error messaging within the modal.
8. **Backfill dependency:** `client` table currently empty; existing cases still rely on application payload fallback for names (shows “Unknown client”). Need migration/service to populate clients and ensure future approvals insert into `client`.

### RBAC
- Extend existing role matrix / middleware to expose `canAssignCases` and `canReassignCases` booleans in `/api/auth/me` response.
- Server-side guards enforce role + region rules; frontend only consumes computed flags (no client-side security).
- Explicitly block `Application Assessor` from assignment endpoints (HTTP 403). Regional Coordinators can only assign within their region set.
- API changes will also provide the current user's `regionId` and `userId` (already exposed) plus assignment booleans so the frontend can hide inline actions early.

## Acceptance Criteria
1. Cases table renders live data with working pagination, sorting, search, and persisted column preferences (per browser storage).
2. `Assign` and `Reassign` actions complete end-to-end, persist ownership changes, and emit audit/event entries.
3. All existing cases after migration possess a valid `client_id`; newly created cases require `client_id` regardless of `application_id` presence.
4. `application_id` remains optional for admin-created cases, but `client_id` is mandatory.
5. RBAC prevents forbidden roles (e.g., Application Assessors) from seeing or invoking assignment actions.
6. Migrations are reversible, use named foreign keys, and maintain `utf8mb4`/`InnoDB` consistency.

## Dependencies & Assumptions
- Existing user directory or staff table provides assignable user IDs and region metadata.
- `iset_application.payload_json` and `iset_application_submission.intake_payload` contain sufficient client fields; for missing data, placeholder values (e.g., "Unknown") are acceptable pending manual remediation.
- Audit/events pipeline is already configured (as used by other modules); new events reuse existing publisher utilities.
- Network policies allow the frontend to reach `/api/cases` with standard credentials.

## Risks & Mitigations
- **Incomplete source data for clients:** Provide safe defaults, log warnings, and produce a remediation report.
- **Pagination performance on large datasets:** Add necessary indices (`status`, `owner_id`, `client_id`) and monitor query plans.
- **RBAC drift:** Centralize permission checks in shared middleware and ensure frontend only consumes computed flags.
- **Regression on case creation flows:** Update service layer to require `client_id`, add integration test for admin-created cases without applications.

## Implementation Plan (Iterative)
1. **Database migration + backfill script** (verify on staging snapshot).
2. **API layer updates** with unit/integration tests covering RBAC and happy path.
   - Replace `/api/cases` implementation with paginated query (MySQL window + LIMIT/OFFSET), joining `client`, `iset_application`, `staff_profiles`, and optionally `iset_evaluator_ptma`.
   - Introduce `/api/cases/:id/assign` and `/api/cases/:id/reassign` (POST). Retire legacy `PATCH` handler after frontend is migrated.
   - Update `/api/cases` (POST) to require `client_id`, honour region RBAC, and emit assignment events when `assignedToUserId` provided at creation.
   - Add unit tests (Jest) for new service helpers (query builder, assignment authorization) and integration tests hitting Express routes with mocked pool.
3. **Frontend data hook + table integration** with loading/error states.
4. **Assignment modal UX** and API wiring, including notifications.
5. **Regression + smoke tests** (manual) focusing on assignment scenarios and dashboard rendering.
6. **Documentation & rollout checklist** (update this CR and README/ops notes if needed).

## Open Questions
1. Do we have a definitive list of assignable roles/users, or should the modal filter by a specific group (e.g., AA + RC)?
2. Should audit events capture previous owner-region metadata for downstream analytics?
3. Any need for optimistic UI updates, or is full refetch acceptable post-action?
4. What SLA applies to new client backfill errors (e.g., missing DOB)?
5. `scopeCases` expects `region_id` on `iset_case`. Should we introduce that column now or temporarily relax region scoping (e.g., by joining staff_profiles.region_id)? Decision needed before locking RBAC behaviour.

## Tracking Log
| Date (UTC) | Update | Owner |
|------------|--------|-------|
| 2025-10-26 | Initial CR drafted; awaiting approval to begin implementation. | Codex |
| 2025-10-26 | Kick-off Step 0 — documented starting point and prepared to draft DB migration approach. | Codex |
| 2025-10-26 | Step 1a — created `sql/20251026_create_client_and_update_iset_case.sql` (client table + iset_case alterations; client_id currently nullable pending backfill). | Codex |
| 2025-10-26 | Step 1a follow-up — migration runner flagged combined ALTER syntax; split MODIFY/ADD into separate statements. Ready for re-run. | Codex |
| 2025-10-26 | Step 1a follow-up #2 — MySQL rejected `ADD COLUMN IF NOT EXISTS`; removed the guard since runner tolerates duplicate column errors. Awaiting next migration run. | Codex |
| 2025-10-26 | Step 1a validation — migration applied successfully (client table created, iset_case altered, FKs/indexes present); ready to design backfill/seed path. | Codex |
| 2025-10-26 | Step 2 kickoff — reviewing existing server routes and data models to plan `/api/cases` + assignment endpoints (RBAC + pagination requirements). | Codex |
| 2025-10-26 | Step 2 progress — implemented paginated `GET /api/cases`, new `POST /api/cases/:id/assign` & `/reassign`, and enforced `client_id` for case creation (with assignment event emission). | Codex |
| 2025-10-26 | Step 3 setup — added “Use live case data” toggle in `DemoNavigation` to control mock vs live feeds for the portfolio dashboard. | Codex |
| 2025-10-26 | Step 3 progress — `CasesTableWidget` now consumes live data and wires inline Assign/Reassign modals with success/error alerts (client name backfill still pending). | Codex |

_Maintain this log with each significant design/implementation update._
