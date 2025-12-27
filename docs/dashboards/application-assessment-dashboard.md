# ISET Application Assessment Dashboard

Author: system assistant
Created: 2025-09-20

## Purpose
Operational dashboard for reviewing and adjudicating individual ISET applications. Anchored to an `iset_case` record (route: `/application-case/:id`).

## Current Board Items (production)
| Title | File | Purpose / scope |
|-------|------|-----------------|
| Application Overview | `src/widgets/ApplicationOverviewWidget.js` | Case header with status badge, sysadmin-only status selector (others see read-only badge), and layout quick actions (Review application, Documents and messages, Notes and case calendar, View audit trail); shows reference # with copy control, province/territory, document checklist completeness, lock owner/expiry, assigned evaluator, timestamps. |
| ISET Application Form | `src/widgets/IsetApplicationFormWidget.js` | Read-only or lock-protected edit view of the submitted application; version history and restore; edit disabled when decision final or status=withdrawn. |
| Application Assessment | `src/widgets/CoordinatorAssessmentWidget.js` | Assessment workflow (declaration, recommendations, NWAC review) with status progression rules and locking; submits to `/api/cases/:id`. |
| Supporting Documents | `src/widgets/SupportingDocumentsWidget.js` | Unified document list across submissions and secure messages; refresh control. |
| Secure Messaging | `src/widgets/SecureMessagingWidget.js` | Inbox/Sent/Deleted tabs, thread view, compose/reply with attachment support. |
| Notes and Tasks | `src/widgets/CaseNotesWidget.js` | Case notes and lightweight tasks (current implementation surface). |
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

