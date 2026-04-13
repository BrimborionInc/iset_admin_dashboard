# Supporting Documents widget

Date: 2026-04-10

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
- `GET /api/documents/:id/presign-download`
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
- View behavior:
  - most files open from the presigned object URL returned by `GET /api/documents/:id/presign-download`
  - Word files (`.doc`, `.docx`) now take a different path: the backend generates or reuses a cached internal preview and returns that preview URL instead of the original Office object
  - the preferred preview artifact is PDF, but the backend now falls back to a self-contained HTML preview if the server cannot render PDF on that host
  - this avoids browser-dependent handoff to Microsoft 365 / Office Online for sensitive supporting documents
- Download behavior:
  - the inline `Download` action is shown only to `System Administrator` and `NWAC Administrator`
  - it requires an explicit privacy warning confirmation
  - it calls `GET /api/documents/:id/presign-download?mode=original`, which forces an attachment download of the original stored object instead of the preview path
- Imported/application-less case mode:
  - enables upload and refresh without `applicant_user_id`
  - also remains the correct mode when the imported client has a linked PATH account but the case still has no linked `application_id`
  - allows `client`, `case`, `action_plan`, and `application` document categories
  - stores application-type uploads against a real application when one exists, or falls them back to an action plan / case when the file has no linked application
  - hides the checklist tab
  - treats uploads as silent casework backload actions

## Critical derived state

- `applicant_user_id` is resolved from the workspace/case payload.
- `caseId` and `applicationId` are also derived from the workspace/case payload and are used to prefill upload associations.
- In Case Workspace, a linked `applicationId` is what decides whether the widget uses applicant/application mode with checklist support.
- When the case has no linked `applicationId`, the widget uses case-based document mode even if `applicant_user_id` exists because the client already has a PATH account.
- The checklist tab is intentionally unavailable in case-based mode because there is no applicant/application checklist context.

## Client-file import support

- Client Batch Import intentionally creates `iset_case` rows with `application_id = NULL`.
- Those imported cases may or may not later have a linked applicant account, but they still remain application-less until a real `application_id` exists.
- The widget handles those cases directly through case-based document mode instead of disabling upload or forcing application selection.
- Application-style paper forms and assessments can still be uploaded on those files without fabricating an application record.
- This is not caused by missing assessments, action plans, or interventions.

## Practical debugging checklist

- If an imported client file shows no checklist tab, that is expected.
- If an imported client has a PATH account but still no linked application, the widget should still use case-based mode and should not ask staff to pick an application for application-scoped uploads.
- If a Word document view now fails, inspect `GET /api/documents/:id/presign-download` rather than browser download settings first; the expected success path is an internal preview artifact (PDF when available, otherwise HTML), not a raw `.doc/.docx` open in Office Online.
- If a privileged user reports that `Download` is missing, verify their canonical role/group resolves to `System Administrator` / `NWAC Administrator` (`System_Administrator` / `NWAC_Administrator`) before debugging the widget.
- If a case-backed upload fails, inspect `caseData.id`, the selected document type scope, and the `/api/cases/:id/documents/upload` response code first.
- If a normal applicant-backed case cannot upload or refresh, inspect `caseData.applicant_user_id` / `caseData.applicantUserId` and the `/api/applicants/:id/*` endpoints.
- Do not add placeholder application, assessment, or action-plan rows just to make document management work.
