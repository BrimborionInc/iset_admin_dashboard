# Case Detail Endpoint Fallback (Retired)

Date: 2025-09-20
Status: historical. Retired locally 2026-07-11 under engineering-audit R4b; not deployed.

## Problem
Environments missing newer evaluator/assessment schema (`iset_evaluators`, added columns like `priority`) caused `/api/cases/:id` to 500 with `ER_NO_SUCH_TABLE` or `ER_BAD_FIELD_ERROR`, leaving the Application Case dashboard stuck on "Loading...".

## Historical Solution
`/api/cases/:id` now:
1. Attempts full enriched SELECT (joins evaluators, ptma, assessment fields).
2. On `ER_NO_SUCH_TABLE` or `ER_BAD_FIELD_ERROR`, logs a warning and builds a dynamic minimal query:
   - Introspects existing `iset_case` columns via `information_schema`.
   - Selects intersection of preferred fields (`id, client_id, assigned_staff_profile_id`, `status`, `priority`, `stage`, `opened_at`, `closed_at`, `last_activity_at`).
   - Joins `iset_application` through `iset_application.case_id` plus `user` to obtain applicant identity and tracking id when an application exists.
3. Returns the reduced row (never 500 for those schema gaps).

## Benefits
- Allows incremental rollout of new columns without blocking legacy DB snapshots.
- Keeps Supporting Documents widget functional for application-backed and case-only workspaces.

## Logs
Warning pattern: `[case:detail] falling back (reason=ER_BAD_FIELD_ERROR): building dynamic minimal query`

## Current Contract

Canonical target schemas are now required. `ER_NO_SUCH_TABLE` or `ER_BAD_FIELD_ERROR` in Case Detail returns `503 case_detail_schema_not_ready`; the endpoint never presents reduced data as a normal `200`. Admin `/readyz` provides the schema-aware release/readiness gate. The old fallback body remains unreachable source archaeology pending later monolith cleanup.

## Related Files
- `isetadminserver.js` (case detail route)
- `docs/dashboards/application-case-temporary-limit.md`
