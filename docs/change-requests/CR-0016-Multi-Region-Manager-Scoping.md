# CR-0016: Multi-Region Regional Managers (Dev)

Status: Historical implementation note; core multi-region behavior has shipped
Owner: Codex + Wilson
Last updated: 2026-04-30

## Goal
Enable Regional Managers to be assigned to multiple provinces/territories and have that scope applied everywhere region-based access is enforced (lists, dashboards, assignments, escalations, action plans, interventions, etc.). ISET Coordinators remain single-province.

## Historical baseline
- A single `custom:region_id` flows from Cognito -> `req.auth.regionId` -> `staff_profiles.region_id`.
- Regional Manager scoping uses a single `region_id` in multiple places:
  - RBAC helpers (`src/lib/rbac.js`, `src/lib/dbScope.js`).
  - Assignment checks (e.g., `ensureCanAssignCase`).
  - Case/app listing endpoints and dashboard widgets.
  - Escalations and other queue endpoints.
- Regions are province/territory rows in `canada_region`.

Current implementation note: staff region access is DB-backed. Cognito `custom:region_id` is historical metadata only and must not be used as an auth or profile backfill fallback.

## Requirements
- Regional Managers can have **multiple** provinces/territories.
- All region-scoped behavior for Regional Managers must expand to this list.
- ISET Coordinators remain single-province.
- Management should be done in Admin UI (User Management).
  - Regional Manager assignments are a direct list of provinces/territories (no extra region-group layer).

## Non-goals
- No new “region groups” layer.
- No changes to applicant portal.
- No changes to Cognito attribute storage for multi-region (DB only).

## Proposed design
### Data model
- Add a mapping table for staff -> region:
  - `staff_region` (approved name)
  - Columns: `staff_profile_id` (FK staff_profiles.id), `region_id` (FK canada_region.region_id), `created_at`, `updated_at`.
  - Unique composite index `(staff_profile_id, region_id)`.
- Keep `staff_profiles.region_id` for single-province users and as a compatibility fallback.
- Regional Managers use `staff_region` for multi-region; ISET Coordinators continue to use `staff_profiles.region_id` (single).

### Backend changes
- Add helpers to resolve **region list** for a staff member:
  - For Regional Manager: list of region_ids from `staff_region`, fallback to `staff_profiles.region_id` if none.
  - For ISET Coordinator: still single `staff_profiles.region_id`.
- Replace all `region_id = ?` scoping for Regional Manager with `region_id IN (?)` using the resolved list.
- Update assignment checks to allow assigning to staff in any region in the manager’s list.
- Update escalations, work queues, dashboards, conflict declarations, approvals, interventions, case listings, etc.

### Admin UI
- User Management:
  - For Regional Manager: multi-select list of provinces/territories.
  - For ISET Coordinator: single-select (existing behavior).
- Persist changes to DB via new API endpoints.

## Migration plan
1. Create `staff_region` table and backfill from `staff_profiles.region_id` for all staff with a region.
2. Implement backend helpers + query updates for Regional Manager scope.
3. Add/extend API endpoints to read/write multi-region assignments.
4. Update admin UI to edit region lists.
5. Verify in dev with representative users and region lists.

## Risks
- Missed scope filters causing data leakage or missing items.
- Performance impact on large `IN` lists (mitigate with indexes and caching).

## Test plan
- Dev DB: create a Regional Manager with multiple provinces and verify:
  - Can see applications/cases in those provinces.
  - Can assign/reassign to ISET Coordinators in those provinces only.
  - Dashboard widgets counts reflect combined provinces.
  - Escalations and other queues reflect combined provinces.
- Verify ISET Coordinator remains single-province scoped.

## Decisions
- Table name remains `staff_region`.

## Progress
- 2026-01-27: Added `staff_region` migration + backfill, updated backend scoping for regional roles, and extended admin user management to support multi-region assignments.
- 2026-04-30: Removed the remaining auth middleware fallback that could hydrate staff region scope from Cognito `region_id` / `custom:region_id` claims.
