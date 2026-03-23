# Supporting Documents widget

Date: 2026-03-23

## Workflow

Application Assessment; Case Management

## Source

- `src/widgets/SupportingDocumentsWidget.js`
- Help panel: `src/helpPanelContents/supportingDocumentsHelp.js`

## Primary Route Context

- `/application-case/:id`
- `/cases/:caseId`

## Purpose

Unified document library for a participant/client. The widget lists documents from submissions, secure message attachments,
manual uploads, and generated forms, then compares them against the relevant checklist.

## Core APIs

- `GET /api/document-types`
- `GET /api/applicants/:id/applications`
- `GET /api/applicants/:id/documents`
- `GET /api/applicants/:id/document-checklist`
- `POST /api/applicants/:id/documents/upload`
- `GET /api/cases/:id/documents`
- `POST /api/cases/:id/documents/upload`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`
- `POST /api/documents/:id/duplicate`

## Key UI behavior

- Shared widget: the same component is used in both Application Workspace and Case Workspace.
- Application Workspace filter: loads applicant applications and filters documents by `application_id`.
- Case Workspace filter: builds intervention options from `caseData.actionPlans[].interventions` and narrows the list to documents relevant to the selected intervention; it is a view filter, not an attachment target.
- Checklist in applicant-backed Case Workspace: only loads after an intervention is selected.
- Upload flow:
  - opens a label/document-type modal first
  - enforces `document_type.scope` rules (`client`, `application`, `case`, `action_plan`, `payment_packet`)
  - then uploads through either:
    - `/api/applicants/:applicant_user_id/documents/upload` for applicant/application mode
    - `/api/cases/:case_id/documents/upload` for application-less case mode
- Refresh behavior: listens for `iset:supporting-documents:refresh`, mainly from Secure Messaging attachment adoption.
- Imported/application-less case mode:
  - enables upload and refresh without `applicant_user_id`
  - allows `client`, `case`, `action_plan`, and `application` document categories
  - stores application-type uploads against a real application when one exists, or falls them back to an action plan / case when the file has no linked application
  - hides the checklist tab
  - treats uploads as silent casework backload actions

## Critical derived state

- `applicant_user_id` is resolved from the workspace/case payload.
- `caseId` and `applicationId` are also derived from the workspace/case payload and are used to prefill upload associations.
- When `applicant_user_id` exists, the widget uses applicant/application mode with checklist support.
- When `applicant_user_id` is absent but `caseId` exists in Case Workspace, the widget uses case-based document mode.
- The checklist tab is intentionally unavailable in case-based mode because there is no applicant/application checklist context.

## Client-file import support

- Client Batch Import intentionally creates `iset_case` rows with `application_id = NULL`.
- Those imported cases normally also have no submission and no applicant `user`, so `applicant_user_id` resolves to `NULL`.
- The widget now handles those cases directly through case-based document mode instead of disabling upload.
- Application-style paper forms and assessments can still be uploaded on those files without fabricating an application record.
- This is not caused by missing assessments, action plans, or interventions.

## Practical debugging checklist

- If an imported client file shows no checklist tab, that is expected.
- If a case-backed upload fails, inspect `caseData.id`, the selected document type scope, and the `/api/cases/:id/documents/upload` response code first.
- If a normal applicant-backed case cannot upload or refresh, inspect `caseData.applicant_user_id` / `caseData.applicantUserId` and the `/api/applicants/:id/*` endpoints.
- Do not add placeholder application, assessment, or action-plan rows just to make document management work.
