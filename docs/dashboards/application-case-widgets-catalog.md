# Application Case Dashboard Widgets Catalog

Purpose: Track the Application Case Dashboard widget line-up and note readiness of additional modules as they are reintroduced after the stabilization phase.

## Current State (2025-09-25)
Active widgets on the default board:
- ApplicationOverviewWidget (`application-overview`) – case summary header.
- IsetApplicationFormWidget (`iset-application-form`) – read-only application viewer.
- CoordinatorAssessmentWidget (`coordinator-assessment`) – assessment inputs for adjudicators.
- SupportingDocumentsWidget (`supporting-documents`) – unified document list with refresh controls.
- SecureMessagingWidget (`secure-messaging`) – inbox/sent/deleted tabs plus compose modal.

### Application Overview status colours
The `ApplicationOverviewWidget` displays status badges using Cloudscape colours with this mapping:
- Green – approved, completed
- Blue – submitted, in review, in_review, in progress, pending, assigned
- Orange – docs requested, docs_requested, action required, action required (docs requested)
- Red – rejected, declined, errored
- Grey – withdrawn, closed, inactive, or any unrecognised status
These widgets are wired in `src/pages/applicationCaseDashboard.js` and rely on `/api/cases/:id` exposing `application_id`, applicant identity, and the assigned evaluator.

## Widget Inventory (additional candidates)
Below each widget: purpose, critical backend dependencies, and enablement notes.

1. SecureMessagingWidget (id: `secure-messaging`) – **ACTIVE**
   - Purpose: Cloudscape-driven messaging workspace (Inbox/Sent/Deleted tabs, tab actions, modal viewer, compose with urgent flag).
   - Data sources: `/api/admin/messages`, `/api/admin/messages/:id/attachments?case_id=...`, `/api/cases/:id`.
   - 2025-09-21 updates: restored legacy UX; optimistic read receipts; reply quoting; dispatches Supporting Documents refresh when attachments adopt.
   - Follow-ups: bulk delete actions once server endpoints exist (currently placeholders).
   - 2025-09-25 updates: admin sends now persist case/application IDs; applicant portal displays booking reference sourced from submission reference.

2. SupportingDocumentsWidget (id: `supporting-documents`) – **ACTIVE**
   - Purpose: Unified document library spanning submissions and secure message attachments.
   - Data source: `/api/applicants/:applicant_user_id/documents` (backed by `iset_document`).
   - 2025-09-21 updates: header refresh button, listens for `iset:supporting-documents:refresh`, simplified columns (File, Source, Uploaded, Actions), dismissible error messaging.
   - Follow-ups: staff upload entry point and soft-delete controls.

3. IsetApplicationFormWidget (id: `iset-application-form`) – **ACTIVE**
   - Purpose: Read-only rendering of the submitted application (dynamic JSON driven).
   - Data Source: `/api/applications/:id` via `apiFetch`.
   - 2025-09-20 refactor: resilient resolver for nested payloads, tabular income/expense helpers, friendly defaults, safe parsing.
   - Follow-ups: update mapping arrays if submission schema changes.

4. CoordinatorAssessmentWidget (id: `coordinator-assessment`)
   - Purpose: Capture/edit assessment fields (employment goals, barriers, recommendations, program dates, wage, etc.).
   - Depends on: Writable `/api/cases/:id` (PUT) or dedicated endpoint; assessment columns present in `iset_case`; RBAC for edit rights.
   - Prereqs: finalize assessment schema migration; confirm auth scopes.

5. CaseUpdates (`case-updates`)
   - Purpose: Timeline of recent case events (submission, document adoption, assignments).
   - Depends on: `/api/cases/:id/events` & `/api/events/feed` with pagination and read/unread semantics.
   - Prereqs: event emission audit and taxonomy lock-down.

6. CaseTasks (`case-tasks`)
   - Purpose: Surface actionable tasks tied to case events or manual creation.
   - Depends on: tasks table + CRUD endpoints (planned).
   - Prereqs: decide lifecycle (open/complete/auto-close) and notification triggers.

7. NotificationSettingsWidget (`notification-settings`)
   - Purpose: Configure which workflow events trigger secure messages / email nudges.
   - Depends on: `/api/events`, notification templates, localization assets.
   - Prereqs: finalize event registry + template linkage; confirm RBAC.

8. IsetEvaluatorsWidget (`evaluators`)
   - Purpose: Display evaluator availability, allow case assignment.
   - Depends on: canonical evaluator roster (`iset_evaluators` vs `staff_profiles`).
   - Prereqs: converge staff schema to avoid dual maintenance.

9. (Future) Combined Application Overview widget bundling key stats + shortcuts once case data model stabilizes.

## Suggested Enablement Order for Remaining Widgets
1. CaseUpdates (observability for subsequent work).
2. CoordinatorAssessmentWidget (after schema + RBAC confirmation).
3. CaseTasks (after task lifecycle endpoints exist).
4. IsetEvaluatorsWidget (after staff schema decision).
5. NotificationSettingsWidget (after event taxonomy & templates stabilize).

## Technical Guardrails
- Each widget must: (a) be feature-flag friendly, (b) call `apiFetch`, (c) degrade gracefully when optional fields absent, (d) avoid blocking the whole board on failure.
- `/api/cases/:id` should always return the minimal payload (`id`, `application_id`, `status`, applicant identity or explicit nulls).
- Use progressive enhancement: attempt richer joins only when columns confirmed present.

## File References
- Dashboard composition: `src/pages/applicationCaseDashboard.js`
- Widgets directory: `src/widgets/`
  - Application overview: `ApplicationOverviewWidget.js`
  - Application form: `IsetApplicationFormWidget.js`
  - Assessment: `CoordinatorAssessmentWidget.js`
  - Secure messaging: `SecureMessagingWidget.js`
  - Supporting documents: `SupportingDocumentsWidget.js`
  - Case updates: `caseUpdates.js`
  - Tasks: `caseTasks.js`
  - Evaluators: `IsetEvaluatorsWidget.js`
  - Notification settings: `notificationSettingsWidget.js`

## Open Questions
- Canonical applicant identity source when submission lacks `user_id`.
- Assessment persistence model vs future versioning.
- Task lifecycle + notification strategy.
- Evaluator roster convergence.
- Event taxonomy + notification template governance.

---
Updated: 2025-09-25
