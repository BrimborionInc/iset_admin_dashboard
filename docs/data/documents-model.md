# Unified Documents Model (iset_document)

Date: 2026-08-24
Status: current model overview with explicitly historical sections marked below.

## Summary
The unified `iset_document` table now anchors every document to a single `client_id`, with optional links to applications, cases, or action plans. Intervention links are stored in the `iset_document_intervention` join table, and payment evidence attachments live in `payment_packet_document`.

> Entity-model note: the agreed PATH core relationship model is tracked in `docs/planning/client-case-application-target-model.md`. This document describes document ownership/scoping within that broader model and, where noted, distinguishes the current implementation from the target relationship shape.

## Drivers
- Need a single list of all supporting documents for an applicant regardless of origin.
- Support auto-adoption of secure message attachments into the case file.
- Support manual staff uploads and application-ingest artifacts.
- Provide traceability (source + origin_message_id) and future extensibility (checksums, MIME types, status lifecycle).

## Table Definition
See migration script: `sql/20250919_create_iset_document.sql`.
Key columns:
- `client_id` for ownership; current source-specific constraints require it for application submissions, manual uploads, secure-message attachments, and system-generated documents.
- `applicant_user_id` plus `application_id`, `case_id`, or `action_plan_id` for scoping.
- `origin_message_id` + `source` to trace provenance.
- `file_path` canonical relative path (unique) + `file_name` original display name.
- `status` distinguishes active rows, workflow-superseded `archived` rows, and user-deleted `deleted` rows. Do not reuse workflow archive as the user-delete state.

Related tables:
- `iset_document_intervention` (`document_id`, `intervention_id`) stores action-plan intervention links (many-to-many).
- `payment_packet_document` stores payment packet evidence links (packet-level; line-level inferred).
- `iset_document_lifecycle` stores the reversible delete state for a document.
- `iset_document_lifecycle_event` stores immutable delete and restore transition evidence with actor snapshots.

## Delete and Restore

- `DELETE /api/documents/:id` is a soft delete despite the HTTP method: it changes an eligible active row to `status='deleted'`, writes/updates its lifecycle row, and records a delete event in one database transaction. The stored object is untouched.
- Normal lists, checklist matching, and active-only processes ignore `status='deleted'`. All four PATH staff roles can request this action within their existing case/object scope.
- Only ordinary `source='manual_upload'` files can enter this user-delete lifecycle. Applicant submissions, legacy intake uploads, secure-message attachments, PATH-generated files, signing-request documents, CFA/Funding Overview version documents, and payment evidence are protected records.
- A delete never reverses a submission, signature, approval, payment, message, or other business event.
- `GET .../documents?view=deleted`, deleted-file preview/download, and `POST /api/documents/:id/restore` are `System Administrator`-only. Restore proves the source object still exists and matches the recorded size and available checksum before setting the row active again.
- PATH has no permanent-delete UI or API for supporting documents, including manual uploads. The database row and stored bytes remain available for restore.
- Any exceptional physical removal is a separately reviewed, guarded database/storage operation outside the product workflow.
- The additive migration `sql/migrations/20260824_0001_add_document_lifecycle_audit.sql` deliberately does not backfill older `status='deleted'` rows because their provenance and reason are unknown.

## Scope Rules
- `document_type.scope` supports: `client`, `application`, `case`, `action_plan`, `payment_packet`.
- Action plan documents attach to `action_plan_id`, preserve the owning `case_id`, and optionally link to one or more interventions via `iset_document_intervention`.
- Case documents attach to `case_id`.
- Application documents normally attach to `application_id` and preserve the owning `case_id`. In case-based uploads for imported/application-less files they can fall back to `action_plan_id` when a plan is selected, or `case_id` otherwise. The requested scope is preserved in document metadata as a fallback note; PATH does not fabricate an application row.
- Source-specific database CHECK constraints now protect privacy-sensitive lineage:
  - `application_submission` requires `client_id`, `case_id`, `application_id`, and `applicant_user_id`.
  - `legacy_intake_upload` is a quarantined historical source for older portal uploads that were written before a deterministic application/case existed; current upload flows should not create new rows with this source.
  - `manual_upload` requires `client_id` and `case_id`; when it is linked to an application, it also requires `applicant_user_id`. Do not loosen `chk_iset_document_manual_upload_scope`; upload code must resolve the real case scope.
  - `secure_message_attachment` requires `client_id`, `case_id`, `applicant_user_id`, `user_id`, and `origin_message_id`; `application_id` is optional so secure messaging can attach to application-less case files without fabricating an application row.
  - `system_generated` requires `client_id` and `case_id`; when it is linked to an application, it also requires `applicant_user_id`.
- Privacy-sensitive document FKs for user, applicant user, client, case, application, and origin message use `ON DELETE RESTRICT` so parent deletion cannot silently un-scope document records.

## Source Values
- `application_submission`: Uploaded or generated as part of the original application submission.
- `legacy_intake_upload`: Historical portal upload metadata that could not be safely attached to an application/case during migration.
- `secure_message_attachment`: Attached to a secure message in the admin workspace.
- `system_generated`: Generated case/client artifacts such as signed digital forms, assessment PDFs, and payment packet bundles.
- `manual_upload`: Uploaded directly by staff in the admin workspace.

## Endpoint Changes
- `GET /api/applicants/:id/documents` now returns action plan context (`action_plan_id`, `intervention_ids`) alongside case/application references.
- `POST /api/applicants/:id/documents/upload` enforces `document_type.scope` rules, requires `client_id`, preserves or resolves real `case_id` for manual uploads, and accepts action plan + intervention links.
- `GET /api/cases/:id/documents` now supports application-less case workspaces by returning client/case/action-plan documents keyed from the case.
- `POST /api/cases/:id/documents/upload` now supports manual staff uploads for application-less client-file cases without requiring an applicant-user chain, including application-type documents that fall back to action-plan or case storage when no real application exists while still writing the real `case_id`.
- In Case Workspace, "application-less" means there is no `iset_application` row whose `case_id` points at the case. If an imported client later gets a participant PATH account, the workspace should still use this case-based document mode until a real application exists.
- `PUT /api/documents/:id` and `/api/documents/:id/duplicate` update action plan + intervention associations (no `linked_intervention_id`) and preserve the same application-scope fallback rules in case-based mode.
- `GET /api/documents/:id/presign-download` now treats Word documents specially: for `.doc` / `.docx`, the admin backend generates or reuses a cached PDF preview under the object-storage prefix `WORD_PREVIEW_OBJECT_PREFIX` (default `previews/word`) and returns a presigned URL for that preview instead of the original Office object. Preview artifacts stay out of `iset_document`.
- `GET /api/documents/:id/presign-download?mode=original` is a separate staff-admin path that bypasses Word preview substitution and forces attachment download of the original stored object. It is server-side restricted to `System Administrator` / `NWAC Administrator`.
- `GET /api/documents/:id/presign-download` can return a lifecycle-deleted file only to `System Administrator` while it remains restorable.
- `DELETE /api/documents/:id` and `POST /api/documents/:id/restore` implement the reversible lifecycle described above.
- `GET /api/admin/messages/:id/attachments` upserts attachments into `iset_document` with message, client, case, application, applicant, and uploader context when a `case_id` query param is provided.
- `POST /api/finance/payment-packets/:id/documents` validates `iset_document.client_id` matches the packet.

## Widget Updates
`SupportingDocumentsWidget` supports action plan scoping with optional multi-intervention links, updates scope labels (client/application/case/action plan/payment packet), and continues to refresh from the `iset:supporting-documents:refresh` event fired by Secure Messaging.
As of 2026-03-23, the widget has two real operating modes:
- applicant/application mode: full document list plus checklist, keyed by `/api/applicants/:id/*`
- case-based mode for imported/application-less client files: document list plus upload, keyed by `/api/cases/:id/documents*`

In case-based mode, the widget intentionally hides the checklist tab because checklist logic remains applicant/application driven. It still allows application-type document categories, but stores them against an action plan or the case when there is no linked application.
Admin-side manual uploads now also allow Word files (`.doc`, `.docx`) in addition to PDF and common image formats.

## Cross-widget Hooks (2025-09-21)
- SecureMessagingWidget dispatches `iset:supporting-documents:refresh` after attachments load, giving SupportingDocumentsWidget an immediate view of newly adopted files.
- The admin API now back-fills `applicant_user_id`, `application_id`, and `user_id` when re-adopting attachments so the unified list stays filtered correctly.

## Adoption Logic Notes
- Attachments adoption only occurs when the attachments endpoint is called with `?case_id=...`.
- Applicant linkage derived via `case -> application -> user` resolution; `client_id` is resolved from the case/application/applicant_user_id chain.
- Idempotency: enforced via `UNIQUE (file_path)` + `ON DUPLICATE KEY UPDATE` for applicant/application/user/origin fields so re-opening a message repairs missing metadata.
- Secure-message attachment adoption now rejects case/application/client scope mismatches before inserting or repairing an `iset_document` row.

## Future Enhancements
- Add checksum calculation on file write for dedupe.
- Keep route-level authorization denial tests and smoke checks current as document scope rules evolve.
- Continue tightening object-storage metadata and retention rules where workflow-specific artifacts should stay outside `iset_document`.

## Topology & Integration Notes (Updated: Shared DB Confirmed 2025-09-19)
The public intake portal and the admin dashboard SHARE the same MySQL database cluster. This simplifies integration:

- Dual-write strategy: Portal upload endpoints insert directly into `iset_document` only when the upload already has deterministic `client_id`, `case_id`, `application_id`, and `applicant_user_id` scope. Pre-submission intake uploads remain in `iset_application_file` plus `input_json_state.doc_refs`; `/api/intake/complete` materializes those references into `iset_document` after creating or resolving the application/case.
- No HTTP bridge needed: Previous contingency task to call an admin API for ingestion can be deprecated in favor of direct SQL insert.
- Consistency approach: Uploads must resolve `client_id` before accepting a portal file, but `source='application_submission'` rows are written to `iset_document` only after full application/case scope is available. If a scoped insert fails, the upload or submission should fail and surface the error.
- Removal: the public portal may physically remove only the signed-in applicant's own pre-submission draft upload while it still exists solely in intake upload/draft state. Once a file has been materialized into `iset_document` or referenced by a submission, the portal removal route must refuse it; staff lifecycle actions happen through the admin API.

### Historical Portal Plan
This section was previously titled `Planned Portal Changes`. The current portal model no longer writes every upload directly into `iset_document` at upload time. Pre-submission portal uploads remain in intake upload state (`iset_application_file` plus intake `doc_refs`) until the application/case scope is deterministic; completion then materializes those scoped references into `iset_document`.

Do not revive direct pre-submission `iset_document` writes unless the route can prove full client/case/application/applicant scope at insert time.

### Deprecation Considerations
`iset_application_file` remains part of the portal intake upload pipeline before deterministic case/application scope exists. Do not remove it merely because `iset_document` is the unified supporting-document table after materialization.

## Migration / Backfill
If legacy rows existed in `iset_case_document` prior to its drop, they can be re-imported (none currently retained after destructive reset). A historical backfill from `message_attachment` can be performed by re-calling the attachments endpoint for each message with a case context.

## Historical Rollback Sketch
This is not a current rollback plan for the hardened privacy/document model. Do not use it for TEST/PROD without a reviewed migration and privacy/security plan.

1. Drop `iset_document`.
2. Recreate minimal legacy `iset_case_document` (see historical schema) and revert endpoint queries.
3. Remove `source` column rendering in widget.

## Security Considerations
- Do not trust `file_path` from client requests; all creation done server-side.
- Do not expose streaming/download by raw document ID alone. Verify access through case/application/action-plan/intervention/client/payment scope before metadata or presign return.
- Do not insert global exports into `iset_document`. Artifacts without owning case/client scope should stay in their owning workflow metadata, not Supporting Documents.
