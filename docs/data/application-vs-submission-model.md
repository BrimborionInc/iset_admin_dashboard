# Application vs Submission Data Model

Date: 2025-09-20

## Overview
Two related persistence layers store an applicant's data:
- `iset_application_submission` (immutable intake snapshot)
- `iset_application` (mutable admin-facing record)

This separation allows staff to correct obvious data issues or append administrative context without destroying the original applicant‑entered answers.

## `iset_application_submission`
Source of truth for what the applicant actually submitted at a specific point in time.
Characteristics:
- Inserted once at initial submit.
- Fields: `id`, `user_id` (applicant), `intake_payload` (raw authored form answers / metadata), timestamps.
- Never updated after creation (treat as append‑only). Future re-submissions create a new submission row (if multi‑submit ever allowed).
- Serves audit, dispute resolution, and compliance use cases.

## `iset_application`
Operational / working copy used on the admin dashboard.
Characteristics:
- Fields: `id`, `submission_id` (FK to immutable row), `payload_json` (normalized / enriched structure), plus evolving admin columns (status, tracking codes, etc.).
- May be updated by administrators or automated enrichment processes (e.g., merging missing `answers` from submission if legacy rows lacked them).
- Supports incremental corrections (typo fixes, normalization) while preserving original submission for audit.

## Enrichment Flow
1. Fetch `/api/applications/:id`.
2. Backend loads the `iset_application` row and joins the linked submission.
3. If `payload_json.answers` is missing keys present in `intake_payload.answers`, it merges them (non‑destructive: does not overwrite existing keys).
4. Response includes the enriched `payload_json` plus `case` data if available.

Pseudo logic excerpt (simplified):
```
if (submission.intake_payload.answers) {
  for (k,v) in submission.answers: if (!(k in application_payload.answers)) add k=v
}
```

## Editing Strategy
Current implemented editable field: `case_summary` (stored in `iset_case`).
Planned (not yet implemented) editable application answers would:
- Copy target answer(s) into `payload_json.answers` updates.
- Record who made the change & when (NOT YET IMPLEMENTED – would require audit columns or a sibling history table, e.g. `iset_application_edit_log`).
- Never mutate `iset_application_submission.intake_payload`.

## Rationale
- Audit Integrity: Regulators can always reconstruct original applicant statements.
- Operational Flexibility: Staff can correct clear data issues (formatting, obvious transpositions) without forcing a re‑submission workflow.
- Migration Safety: Legacy rows missing nested JSON answers can be progressively backfilled using the immutable snapshot.

## Future Enhancements
| Area | Need | Proposal |
|------|------|---------|
| Field-level Audit | Track who edited which answer | `iset_application_answer_history` with (application_id, key, old_value, new_value, edited_by, edited_at) |
| Diff Visualization | Show original vs current | Compute answer diff on load (submission vs payload) and surface changed badge |
| Partial Rollback | Undo a mistaken edit | Apply last entry from history table in reverse |
| Multi-Submit Support | Applicant resubmits | New submission row; application payload merges only missing answers unless flagged for full refresh |

## Related Docs
- `docs/dashboards/application-case-widgets-catalog.md`
- `docs/data/case-detail-fallback.md`

## Open Questions
- Do we need a strict policy for which fields staff may edit vs locked (e.g., identity vs narrative fields)?
- Should edits trigger a notification or require dual control for sensitive identity changes?

