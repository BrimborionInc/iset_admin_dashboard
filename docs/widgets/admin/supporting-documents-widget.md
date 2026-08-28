# Supporting Documents widget

Date: 2026-08-28

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
- `POST /api/documents/:id/restore`
- `POST /api/documents/:id/duplicate`

## Key UI behavior

- Shared widget: the same component is used in both Application Workspace and Case Workspace.
- Documents tab: includes a `Find documents` text filter over document label, filename, type label, source, reference label, and scope before the sorted/resizable table is rendered.
- Table behavior: document sorting applies to the full filtered in-memory document list before rows are displayed, and column width/preference changes are persisted through the existing preferences path.
- Current UI cleanup backlog: the Application Workspace browser smokes record a React unique-key warning from this widget's modal/`SpaceBetween` composition during workspace render. The warning is captured for diagnosis but is not currently treated as a workflow-blocking smoke failure.
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
- Delete behavior:
  - all four PATH staff roles can use `Delete` when they already have access to the file and the file is an eligible staff upload or a document shown with source `Applicant upload`
  - `Delete` is reversible: PATH marks the document deleted, removes it from normal document lists and checklist/process matching, and leaves the stored file in place
  - deleting an applicant upload does not alter the submitted application's answers, payload, ownership, or history, and it does not make applicant uploads eligible for Duplicate
  - generated files, documents linked to PATH signing requests, secure-message attachments, version evidence, payment evidence, legacy/unknown-source files, and other authoritative records cannot be deleted through the widget; the disabled action explains why in plain language
  - deleting a document does not undo a signature, payment, approval, submission, or any other business event
- Deleted view:
  - only `System Administrator` sees the `Deleted` tab and can view, download, or restore files deleted through this lifecycle
  - historical rows that already had `iset_document.status='deleted'` before this feature are not treated as lifecycle deletions and do not appear in the tab
  - restore checks that the stored object still exists and matches the recorded size/checksum before returning the document to active lists and processes
  - PATH has no permanent-delete action for supporting documents, including for System Administrators; the file and document row remain available for restore
  - any exceptional physical removal is a separately reviewed database/storage operation outside the product workflow
- View behavior:
  - most files open from the presigned object URL returned by `GET /api/documents/:id/presign-download`
  - Word files (`.doc`, `.docx`) now take a different path: the backend generates or reuses a cached internal preview and returns that preview URL instead of the original Office object
  - the preferred preview artifact is PDF, but the backend now falls back to a self-contained HTML preview if the server cannot render PDF on that host
  - this avoids browser-dependent handoff to Microsoft 365 / Office Online for sensitive supporting documents
- Inline label edits:
  - the table sends `PUT /api/documents/:id` with only `{ label }`
  - the backend treats label-only requests as a rename only and preserves existing case/application/action-plan/client scope without re-running attachment resolution
  - the Edit document details modal allows authorized staff to correct both the display title and document type for application submissions, secure-message attachments, staff uploads, generated documents, and records with older/unknown source values
  - changing title/type never changes the stored file, checksum, source, originating message, signing request, uploader, or other provenance
  - edit-modal saves continue to validate active document types, destination access, client/case/application coherence, and concurrent changes
  - source-bound documents retain their original case/application ownership; the application selector is read-only when that exact origin is already known
  - Action Plan/intervention organization remains editable for ordinary evidence, but PATH blocks an actual attachment change when the document has a signing-request, CFA/Funding Overview version, or payment dependency; title and type remain editable
  - client-scoped modal saves and duplicate-document saves include hidden case/application context only so the backend can validate access and resolve client scope; staff are not asked to attach client-scoped documents to an application
  - application-submission documents keep their source-required `application_id` lineage when edited through the modal, even when the selected document type is client-scoped
  - the modal preloads an existing application/action-plan attachment even when the document is not classified yet; when an older unscoped row is edited, it defaults attachment controls from the current workspace filter/context when possible
  - duplicate and delete remain separate operations and retain the stricter source/dependency integrity guard
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
- If document classification fails with `document_attachment_immutable`, verify whether the request also changes the Action Plan/intervention attachment. The title and document type alone are allowed; only reassignment of signing-, version-, or payment-dependent evidence is blocked.
- If an edit attempts to move a source-bound document to another case or application, expect `document_case_lineage_immutable` or `document_application_lineage_immutable`. Correct its title/type in place; do not rewrite where applicant-, message-, generated-, or unknown-source evidence originated.
- If an edit-details or duplicate save fails for a client-scoped type such as `identity_document` or `status_card`, verify the widget request includes `caseId` or `applicationId` even though the document remains client-scoped in storage. If the row has `source='application_submission'`, also verify the backend preserves the existing `application_id`; PROD's source-lineage CHECK constraint requires submission documents to keep `client_id`, `case_id`, `application_id`, and `applicant_user_id`.
- If `chk_iset_document_manual_upload_scope` fails for a staff upload, treat it as a backend context-resolution bug first. Manual uploads must carry `client_id` and `case_id`; application-linked uploads must also carry `application_id` and `applicant_user_id`.
- If `Delete` is disabled, use the reason shown by PATH. Do not detach, reclassify, or rewrite provenance merely to make an authoritative file deletable.
- If a newly deleted file is missing from the `Deleted` tab, verify the lifecycle schema migration is present and the delete transaction wrote `iset_document_lifecycle`; do not backfill older `status='deleted'` rows by assumption.
- Release gate: current admin uploads store and verify `path-sha256` object metadata, but older `manual_upload` objects may predate it. Do not roll out reversible Delete until PATH either verifies object identity before allowing Delete (and gives a plain refusal for unverifiable legacy files) or supports a reviewed full-object checksum fallback. Otherwise an older file could be hidden successfully and then fail the restore check.
- Release gate: assessment and intervention-decision paths that rely on an active manual document must lock and recheck that document inside their write transaction. A pre-transaction check alone can race Delete and commit a decision against a document that has just become hidden.
- Release gate: payment evidence must remain protected after it enters finance history, even if a user later removes the visible packet link. Prospective unlink/packet/line operations can be blocked once normalized payment transactions exist; protecting already-stale historical document IDs requires a reviewed normalized finance-transaction/document history record and guarded backfill rather than relying on JSON or comma-separated IDs.
- A preview/download URL issued before Delete remains usable until its short expiry. Delete prevents new ordinary-user access after the lifecycle change, but it cannot revoke a URL or copy that was already issued.
- Do not add placeholder application, assessment, or action-plan rows just to make document management work.
