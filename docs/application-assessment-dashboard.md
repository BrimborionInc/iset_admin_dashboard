# ISET Application Assessment Dashboard

Author: system assistant
Created: 2025-09-20

## Purpose
Operational dashboard for reviewing and adjudicating individual ISET applications. Anchored to an `iset_case` record (route: `/application-case/:id`).

## Current Board Items
| Widget ID | Title | File | Status |
|-----------|-------|------|--------|
| iset-application-form | ISET Application Form | `src/widgets/IsetApplicationFormWidget.js` | Implemented (editable answers, schema-enriched) |
| supporting-documents | Supporting Documents | `src/widgets/SupportingDocumentsWidget.js` | Implemented |

## Planned / Backlog Widgets
| Working Name | Intent / Function | Notes | Status |
|--------------|-------------------|-------|--------|
| evaluator-assignment | Assign / change evaluator(s) | Uses future endpoint listing evaluators; fallback empty list. | Not started |
| application-summary (recovery) | Concise top-level summary snapshot | File name removed; needs git history lookup. | Not started |
| decision-record | Capture decision (approve/deny/defer) + rationale | Not yet modeled in DB. | Deferred |
| risk-flags | Surface automated/manual risk indicators | Requires rule layer. | Deferred |
| timeline/events | Chronological events (status changes, edits) | Needs events source. | Deferred |

## Data Sources
- Application: `iset_application` (joined via `iset_case.application_id`).
- Submission reference: `iset_application_submission` (hydration + `schema_snapshot.fields`).
- Documents: `iset_document` (linked by application / submission) [SupportingDocumentsWidget].
- Case metadata: `iset_case`.

## Key Decisions (chronological)
1. Immutable vs mutable application data: `iset_application_submission` immutable; `iset_application.payload_json` mutable with patch endpoint for answers.
2. Added `schema_snapshot` to submission to map values to labels historically.
3. Hydration of sparse payloads before saving edits to prevent data loss.
4. Application form widget refactored to table layout; removed status column on request.

## Open Questions / Actions
| Item | Description | Owner | Status |
|------|-------------|-------|--------|
| Recover removed summary widget | Identify prior filename and reinstate or replace | dev | Pending |
| Evaluator assignment widget | Define API shape (list, assign/unassign) | dev | Pending |
| Decision capture | Data model for decisions, audit trail | dev | Pending |
| Events/timeline | Source of case/application events for timeline | dev | Pending |
| Document deletion propagation | Sync portal deletions to admin docs | dev | Pending |

## Editing Guidelines
- Update this document when adding/removing widgets or making structural dashboard decisions.
- Keep tables concise; move detailed specs to separate docs if necessary.

