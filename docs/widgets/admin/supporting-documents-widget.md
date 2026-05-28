# Supporting Documents widget

Date: 2026-05-22

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
- Application Workspace `All documents` still sends scoped context for non-admin-safe document reads. When the current case is known, the widget queries applicant documents with `caseId`; the backend treats that as the authorized case document set and includes documents linked directly to the case, action plans, the case's primary application, and narrow historical intake-upload matches proven by the primary application's submission payload.
- Case Workspace filter: builds intervention options from `caseData.actionPlans[].interventions` and narrows the list to documents relevant to the selected intervention; it is a view filter, not an attachment target.
- Checklist in applicant-backed Case Workspace: only loads after an intervention is selected.
- Upload flow:
  - opens a label/document-type modal first
  - enforces `document_type.scope` rules (`client`, `application`, `case`, `action_plan`, `payment_packet`)
  - the backend resolver must preserve or resolve the real `case_id` for manual uploads, including application-scoped uploads that also write `application_id`
  - then uploads through either:
    - `/api/applicants/:applicant_user_id/documents/upload` for applicant/application mode
    - `/api/cases/:case_id/documents/upload` for case-backed document mode when the file has no safe applicant account context
- Refresh behavior: listens for `iset:supporting-documents:refresh`, mainly from Secure Messaging attachment adoption.
- View behavior:
  - most files open from the presigned object URL returned by `GET /api/documents/:id/presign-download`
  - Word files (`.doc`, `.docx`) now take a different path: the backend generates or reuses a cached internal preview and returns that preview URL instead of the original Office object
  - the preferred preview artifact is PDF, but the backend now falls back to a self-contained HTML preview if the server cannot render PDF on that host
  - this avoids browser-dependent handoff to Microsoft 365 / Office Online for sensitive supporting documents
- Inline label edits:
  - the table sends `PUT /api/documents/:id` with only `{ label }`
  - the backend treats label-only requests as a rename only and preserves existing case/application/action-plan/client scope without re-running attachment resolution
  - full edit-modal saves still send document type and attachment fields and continue to validate scope
  - client-scoped modal saves and duplicate-document saves include hidden case/application context only so the backend can validate access and resolve client scope; staff are not asked to attach client-scoped documents to an application
  - when an older unscoped row is edited, the modal defaults application/action-plan attachment controls from the current workspace filter/context when possible
- Download behavior:
  - the inline `Download` action is shown only to `System Administrator` and `NWAC Administrator`
  - it requires an explicit privacy warning confirmation
  - it calls `GET /api/documents/:id/presign-download?mode=original`, which forces an attachment download of the original stored object instead of the preview path
- Case-backed document mode:
  - enables upload and refresh without `applicant_user_id`
  - also remains the correct mode when the imported client has a linked PATH account but no `iset_application` row points at the case
  - also applies when a case has an application row but the submission user resolves to a different client than the case client; do not expose that user as the case applicant account
  - allows `client`, `case`, `action_plan`, and `application` document categories
  - stores application-type uploads under an action plan or case when there is no safe applicant account context, even if an unsafe linked application exists
  - hides the checklist tab
  - treats uploads as silent casework backload actions

## Critical derived state

- `applicant_user_id` is resolved from the workspace/case payload only when the applicant-account identity is safe for that case.
- `caseId` and `applicationId` are also derived from the workspace/case payload and are used to prefill upload associations. When an upload has an `applicationId`, the backend still resolves and stores that application's real `case_id`.
- In Case Workspace, applicant/application mode requires a safe `applicant_user_id`; otherwise the widget uses case-backed document mode even when a linked `applicationId` exists.
- When the case has no linked `applicationId`, the widget uses case-backed document mode even if `applicant_user_id` exists because the client already has a PATH account.
- The checklist tab is intentionally unavailable in case-based mode because there is no applicant/application checklist context.

## Client-file import support

- Client Batch Import intentionally creates `iset_case` rows without application records.
- Those imported cases may or may not later have a linked applicant account, but they still remain application-less until a real application exists for that case.
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
- If `/api/applicants/:id/documents/upload` returns `client_id_mismatch`, compare the URL applicant user, the case client, and the application/submission user. A submission user that maps to another client is an unsafe applicant context; the Case Workspace should fall back to `/api/cases/:case_id/documents/upload`.
- If a document label inline edit does not stick, inspect `PUT /api/documents/:id` first. A label-only request should not fail because an older submission upload lacks modern attachment scope; only document-type or attachment changes should run scope resolution.
- If an edit-details or duplicate save fails for a client-scoped type such as `identity_document` or `status_card`, verify the widget request includes `caseId` or `applicationId` even though the document remains client-scoped in storage.
- If `chk_iset_document_manual_upload_scope` fails for a staff upload, treat it as a backend context-resolution bug first. Manual uploads must carry `client_id` and `case_id`; application-linked uploads must also carry `application_id` and `applicant_user_id`.
- Do not add placeholder application, assessment, or action-plan rows just to make document management work.
