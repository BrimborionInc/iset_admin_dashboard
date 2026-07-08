# ISET Application Assessment Dashboard

Author: system assistant
Created: 2025-09-20
Last reviewed for stale model references: 2026-06-10
Status: current for dashboard composition, first-pass shell/widget review, and deterministic browser coverage of the main Application Assessment workflow path. Continue targeted cleanup of the recorded Supporting Documents React key warning before broad refactors.

## Purpose
Operational dashboard for reviewing and adjudicating individual ISET applications. The route remains case-keyed (`/application-case/:id`) and resolves application context from the current case/application relationship.

> Current implementation note: DEV has retired physical `iset_case.application_id`; current code derives the primary application context from `iset_application.case_id` where needed. The agreed target entity model is tracked in `docs/planning/client-case-application-target-model.md`.

## Current Board Items (production)
| Title | File | Purpose / scope |
|-------|------|-----------------|
| Application Overview | `src/widgets/ApplicationOverviewWidget.js` | Case header with status badge, manual status selector for `System Administrator` and `NWAC Administrator` users (others see a read-only badge), `Quick layouts` for Review application / Documents and messages / Notes and case calendar / View audit trail, `Quick actions` for mutating workflow actions, and stage-aware timeline status. The timeline badge now routes files through `Assignment -> EI Status Verification -> Assessment -> Program decision` based on assignment state, application status, and `assessment_esdc_eligibility`. |
| ISET Application Form | `src/widgets/IsetApplicationFormWidget.js` | Read-only or lock-protected edit view of the submitted application; version history and restore; edit disabled when decision final or status=withdrawn. |
| Application Assessment | `src/widgets/CoordinatorAssessmentWidget.js` | Assessment workflow (declaration, recommendations, NWAC review) with status progression rules and locking; submits to `/api/cases/:id`. |
| Supporting Documents | `src/widgets/SupportingDocumentsWidget.js` | Unified document list across submissions and secure messages; text search over document metadata, sortable/resizable table, preferences, and refresh control. |
| Secure Messaging | `src/widgets/SecureMessagingWidget.js` | Inbox/Sent/Deleted tabs, sortable/resizable message tables, thread view, compose/reply with attachment support. |
| Notes and Reminders | `src/widgets/CaseNotesWidget.js` | Case notes, reminders, and refresh control. |
| Case Calendar | `src/widgets/CaseCalendarWidget.js` | Calendar/list view of reminders and deadlines; supports demo mode when live reminders unavailable. |
| Application Events | `src/widgets/applicationEvents.js` | Timeline of events such as `status_changed`, submissions, document updates. |

## Planned / Backlog Widgets
| Working Name | Intent / Function | Notes | Status |
|--------------|-------------------|-------|-------|
| Evaluator assignment | Assign / change evaluator(s) | Requires evaluator roster endpoint | Not started |
| Decision record | Capture decision (approve/deny/defer) + rationale | Depends on data model | Deferred |
| Risk flags | Surface automated/manual risk indicators | Needs rules layer | Deferred |
| Summary snapshot | Concise top-level summary | Needs design | Deferred |

## Data Sources
- Application: current implementation should derive application context from `iset_application.case_id`; do not add new dependencies on a physical `iset_case.application_id` column.
- Submission reference: `iset_application_submission` (hydration + `schema_snapshot.fields`).
- Documents: `iset_document` (linked by application / submission) [SupportingDocumentsWidget].
- Case metadata: `iset_case`.

## Timing Notes
- The `Manage ISET Applications` table `Overdue` column and the `Application Overview` widget use the same shared frontend helper: `src/utils/applicationSla.js`.
- Current milestone model remains submission-based. The stage changes with status/eligibility, but due dates are still measured from the original application submission/creation timestamp until a dedicated stage-timestamp model exists.
- `Awaiting EI Validation` is not a standalone stored application status. It is a derived qualifier driven by an assigned file with no recorded `assessment_esdc_eligibility`.
- The EI status dropdown remains the correction surface for authorized users. Regional Managers, NWAC Administrators, and System Administrators may correct EI status after submission while the application is not final/locked; `/api/cases/:id` blocks the change once action-plan or intervention dependencies exist.

## Local Browser Smokes

- `npm run smoke:application-overview:browser` covers the Application Overview Docs Requested toggle and stale selected-application row-version conflict regression.
- `npm run smoke:application-workspace:browser` covers the default Application Workspace render, idle API settling, Supporting Documents search, Secure Messaging sort toggling, and Notes refresh behavior.
- `npm run smoke:application-assessment:workflow:browser` covers conflict declaration signing, coordinator assessment submission, NWAC approval decision commit, approval-letter send with application-scoped context, and funding-documents completion.

The 2026-06-10 workspace review found the default widget set is task-appropriate for application assessment, but the default board remains very scroll-heavy and the route-level `Job Search`, `Add widget`, and `Reset layout` controls still make the page feel more like a generic configurable dashboard than a focused casework workspace. Treat changing that chrome/default layout as a product decision rather than a silent cleanup.
The 2026-06-10 workflow smoke also caught and fixed a React render-phase warning in row-version propagation: `CoordinatorAssessmentWidget` must call the parent row-version updater outside its child state updater.

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
| Workspace React key warning | `npm run smoke:application-workspace:browser` records a unique-key warning from `SupportingDocumentsWidget` modal/`SpaceBetween` composition during workspace render. Target this widget in a future UI cleanup pass. | dev | Pending |
| Default workspace layout/chrome | Decide whether Application Workspace should keep global board customization controls and the full vertical default board, or move toward task-focused presets/defaults. | product/dev | Pending |

## Editing Guidelines
- Update this document when adding/removing widgets or making structural dashboard decisions.
- Keep tables concise; move detailed specs to separate docs if necessary.

