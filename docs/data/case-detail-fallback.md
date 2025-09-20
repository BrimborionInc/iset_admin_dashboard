# Case Detail Endpoint Fallback

Date: 2025-09-20

## Problem
Environments missing newer evaluator/assessment schema (`iset_evaluators`, added columns like `priority`) caused `/api/cases/:id` to 500 with `ER_NO_SUCH_TABLE` or `ER_BAD_FIELD_ERROR`, leaving the Application Case dashboard stuck on "Loading...".

## Solution
`/api/cases/:id` now:
1. Attempts full enriched SELECT (joins evaluators, ptma, assessment fields).
2. On `ER_NO_SUCH_TABLE` or `ER_BAD_FIELD_ERROR`, logs a warning and builds a dynamic minimal query:
   - Introspects existing `iset_case` columns via `information_schema`.
   - Selects intersection of preferred fields (`id, application_id, assigned_to_user_id, status, priority, stage, opened_at, closed_at, last_activity_at`).
   - Joins only `iset_application` + `user` to obtain applicant identity and tracking id.
3. Returns the reduced row (never 500 for those schema gaps).

## Benefits
- Allows incremental rollout of new columns without blocking legacy DB snapshots.
- Keeps Supporting Documents widget functional (needs only `application_id` + `applicant_user_id`).

## Logs
Warning pattern: `[case:detail] falling back (reason=ER_BAD_FIELD_ERROR): building dynamic minimal query`

## Future Cleanup
Remove dynamic fallback once all target environments migrated with evaluator + assessment schema. Replace with a startup migration guard if strict schema is desired.

## Related Files
- `isetadminserver.js` (case detail route)
- `docs/dashboards/application-case-temporary-limit.md`
