# Application Case Dashboard Temporary Limitation

Date: 2025-09-20

## Context
While stabilizing the Supporting Documents feature and resolving evaluator table absence in some environments, the application case dashboard (`applicationCaseDashboard.js`) contained several widgets whose API calls relied on tables or joins not yet migrated (e.g., `iset_evaluators`, related PTMA joins, secure messages, assessment fields).

## Interim Adjustment
The dashboard has been temporarily limited to ONLY the `SupportingDocumentsWidget` to:
- Eliminate noisy 401 / 500 errors from unimplemented or partially migrated endpoints.
- Focus validation on document dual-write (portal -> `iset_document`) and applicant linkage correctness.

## Backend Safeguards Added
- `/api/cases/:id` now includes a fallback minimal query if evaluator tables are missing (returns core case + applicant fields only). Logs a warning: `[case:detail] evaluator tables missing; using minimal fallback query`.
- `/api/intake-officers` gracefully returns `[]` with a warning if evaluator tables do not exist.

## Reversal Plan
Once evaluator tables and secure messaging dependencies are stable:
1. Restore original widget list in `applicationCaseDashboard.js` (application form, assessment, secure messages, events).
2. Remove or downgrade the fallback warning logs.
3. Update docs to reflect full dashboard capabilities.

## Verification Steps (Current Phase)
- Open a case dashboard: only Supporting Documents board item should render.
- Network: `/api/cases/:id` returns 200 even if evaluator tables absent.
- Upload new documents via portal; refresh case dashboard; documents appear with `source=application_submission`.

## Related Files
- `src/pages/applicationCaseDashboard.js`
- `isetadminserver.js` (case detail + intake officers endpoints)
- `docs/data/documents-model.md`

## Status
Temporary limitation active. Remove after evaluator schema migration and widget-by-widget hardening.
