# Client File Imports

Date: 2026-04-05

## Summary

- The schema can represent a client file without a historical application.
- Do not create placeholder application, submission, assessment, action-plan, or intervention rows just to satisfy referential integrity.
- A true client-file import should be modeled as `client` + `iset_case` + seeded `case_context_json`.
- Core case creation, case updates, and case listing now support that model, but some participant-facing features still depend on an applicant account even when no historical application exists.

> Entity-model note: this import flow should be read alongside `docs/planning/client-case-application-target-model.md`. Client-file import is the approved exception path where a case may validly exist without any application because the imported record represents historical casework rather than a submitted PATH intake event.

## Current source of truth

- Participant identity and contact details now live primarily in `iset_case.case_context_json`.
- The Case Workspace participant editor writes those values back through `PUT /api/cases/:id`.
- Action plans, interventions, notes, tasks, reminders, and most case operations are case-linked rather than application-linked.

## What the schema allows

- `iset_case` has no direct `application_id` pointer in DEV; `client_id` is the real ownership link.
- Application-backed cases are discovered through `iset_application.case_id`.
- `iset_case_assessment` is keyed by `case_id`.
- `iset_case_action_plan` is keyed by `case_id`.
- `iset_case_intervention` is keyed by `case_id` and optionally linked to an action plan.
- `iset_case_note` and `iset_case_task` are keyed by `case_id`.
- `iset_case_reminder` and `iset_document` can carry an `application_id`, but that link is optional.

This means the database does not require a fake intake history just to preserve integrity.

## What the runtime still assumes today

- `POST /api/cases` now supports a client-file case with `client_id` only.
- `PUT /api/cases/:id` now works for application-less cases when the change is truly case-level (`case_context_json`, assessment, case status). Application-specific fields still require an application link.
- `GET /api/cases` now includes application-less cases in the main cases dashboard list.
- Secure messaging now resolves the participant recipient from either the normal `case -> application -> submission -> user` chain or the imported client's linked applicant account (`client.applicant_cognito_sub` / `client.applicant_account_email`). The workspace suppresses message actions when no participant account is linked.
- Supporting Documents now has a real case-based mode for client-file-only cases:
  - reads from `GET /api/cases/:id/documents`
  - uploads through `POST /api/cases/:id/documents/upload`
  - allows `client`, `case`, and `action_plan` document types without fabricating applicant/application rows
  - intentionally hides the checklist tab when there is no linked application checklist context
- If an imported client later gets a linked PATH account but still has no linked application, Supporting Documents must stay in that same case-based mode. A participant account does not imply historical application context.
- This means missing assessments, action plans, or interventions are not what governs document upload. The widget now distinguishes between applicant-driven checklist mode and case-based document mode.
- Application-form/version widgets are inherently not available for a client-file-only case, because there is no original intake payload to show.

## Current backload operating model

- Imported client files are operationally usable on day one without fabricating historical intake, assessment, or approval data.
- The Case Workspace now exposes explicit backload quick actions for application-less cases:
  - `Add existing action plan`
  - `Add existing intervention`
  - `Upload existing documents`
- Those actions are for recording pre-go-live reality only. They create real action-plan, intervention, and document records, but they do so silently:
  - no applicant emails
  - no approval routing
  - no checklist progression
  - no client-notification side effects
  - no payment-packet, validation, finance-email, or CFA side effects for `manual_backload` interventions when they are later edited or closed in the workspace
- Backloaded intervention finance handling is now explicitly historical-only:
  - `actual amount` on a `manual_backload` intervention writes a posted historical `finance_transaction` so budget burn and finance reporting can reflect legacy spend
  - that historical record is read-only finance history, not a live payment request
  - new `manual_backload` interventions stamp `reviewed_at` from the entered intervention start date, so approval-date financial reporting places them in the inferred historical fiscal year while preserving the PATH entry date in `created_at`
  - `manual_backload` interventions are blocked from payment-packet creation in Program Payments
  - if there is unpaid work that must now be managed in PATH, staff should create a new live intervention for the remaining amount instead of sending the backloaded intervention through the live payments workflow
- Backloaded action plans now carry the entered historical dates into the lifecycle timestamps the workspace reads:
  - active plans seed `activated_at` from the entered start date
  - closed plans seed `activated_at` from the entered start date and `closed_at` from the entered result date
- Backloaded interventions are now lifecycle-validated against their parent plan:
  - archived plans cannot receive existing interventions
  - closed plans can receive only `completed` or `cancelled` interventions
  - `in_progress` and `suspended` interventions require an `active` plan
  - `completed` and `cancelled` interventions must include an end date, which is also stored as `closed_at`
- New post-go-live activity should still use the normal PATH workflow, for example `Propose new intervention`.

## Recommendation

- Treat spreadsheet backloads like this as client-file imports, not historical-application imports.
- Create or match the `client` first.
- Create a real `iset_case` for that client without fabricating any application row.
- Seed `case_context_json` with the participant profile fields imported from the spreadsheet.
- Create a `user` only when an email is present and there is an actual business reason to support login, secure messaging, or applicant-linked document flows.
- Leave assessment rows absent unless they truly existed and need to be modeled explicitly.
- Allow action plans, interventions, funding/cost lines, and documents to be backloaded later through the explicit case-workspace backload actions rather than by inventing fake intake history.
- If the organization later decides historical applications matter, import them as a second phase with their own explicit rules rather than fabricating them during client-file setup.
- Do not create placeholder application, submission, approval, or applicant-account records just to unlock later case-management features.

## Current dashboard implementation

- Route: `/iset/imports/client-files`
- Current navigation label: `Configuration > Client Batch Import`
- Upload support: `.xlsx`, `.xlsm`, `.csv`
- Current limits: 5 MB and 500 data rows per run
- Current flow: upload -> dry run -> review blocked/warning rows -> commit
- Current matching order:
  - raw `SIN`
  - case/submission `SIN` fallback
  - normalized email
  - name + DOB when DOB is available, otherwise a stricter name-only fallback
- Current commit actions:
  - create a new `client` + application-less `iset_case`
  - create an application-less `iset_case` for an existing client
  - update the single existing case already linked to the matched client
- Commit safety:
  - the server derives a stable request hash and transactionally claims one import-run row, so a transport retry returns the first committed result
  - each row claims a hashed import identity before client creation, preventing concurrent commits from creating separate clients for the same import identity
  - after the client is locked, case cardinality is reloaded inside the write transaction; a concurrent create becomes an update, while multiple cases fail closed for review
  - canonical migration `20260711_0002_harden_client_file_import_concurrency.sql` owns the run and identity-claim tables, and `/readyz` requires them before traffic opens
- Current block conditions:
  - missing required name fields or required headers
  - duplicate rows in the uploaded file
  - conflicting matches to more than one client
  - multiple existing cases for the matched client
- Current DOB rule:
  - blank DOB is allowed
  - invalid DOB becomes a warning and imports as blank
- Current non-goals:
  - no applicant `user` creation
  - no historical application recreation
  - no placeholder assessment/action-plan/intervention/document rows
  - no global one-case-per-client unique constraint until historical exceptions and cleanup are separately proven

## Code touchpoints

- `isetadminserver.js`:
  - `POST /api/cases`
  - `PUT /api/cases/:id`
  - `GET /api/cases`
  - `GET /api/cases/:id/workspace`
  - `GET/POST /api/cases/:id/messages`
- `isetadminserver.js`:
  - `POST /api/imports/client-files/dry-run`
  - `POST /api/imports/client-files/commit`
- `src/pages/imports/ClientFileImportDashboard.jsx`
- `src/pages/imports/widgets/ClientFileImportWidget.jsx`
- `src/pages/Caseworking/caseWorkspace/widgets/ParticipantDetailsWidget.jsx`
- `src/pages/Caseworking/caseWorkspace/widgets/CaseHeaderWidget.jsx`
- `src/pages/Caseworking/caseWorkspace/modals/ExistingActionPlanModal.jsx`
- `src/pages/Caseworking/caseWorkspace/modals/ExistingInterventionModal.jsx`
- `src/pages/finance/widgets/PaymentRequestsWidget.jsx`
- `src/utils/backloadInterventionRules.js`
- `src/widgets/SupportingDocumentsWidget.js`
- `src/widgets/caseWorkspace/SecureMessagingWidget.js`
- `docs/dashboards/client-file-import-dashboard.md`
- `docs/guides/case-workspace-guidance.md`
