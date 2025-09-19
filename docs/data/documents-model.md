# Unified Documents Model (iset_document)

Date: 2025-09-19

## Summary
Replaced the previously dropped `iset_case_document` table with a generalized `iset_document` table that can represent any uploaded or adopted file associated with an applicant, application, case, or secure message.

## Drivers
- Need a single list of all supporting documents for an applicant regardless of origin.
- Support auto-adoption of secure message attachments into the case file.
- Prepare for future manual staff uploads and application-ingest artifacts.
- Provide traceability (source + origin_message_id) and future extensibility (checksums, MIME types, status lifecycle).

## Table Definition
See migration script: `sql/20250919_create_iset_document.sql`.
Key columns:
- `applicant_user_id`, `application_id`, `case_id` for scoping.
- `origin_message_id` + `source` to trace provenance.
- `file_path` canonical relative path (unique) + `file_name` original display name.
- `status` for archival / soft delete.

## Endpoint Changes
- `GET /api/applicants/:id/documents` now queries `iset_document` where `applicant_user_id = :id AND status='active'`.
- `GET /api/admin/messages/:id/attachments` auto-inserts (upserts) each attachment into `iset_document` when a `case_id` query param is provided.

## Widget Updates
`SupportingDocumentsWidget` now displays an added `Source` column and uses `created_at AS uploaded_at` from the new table. File URL normalization improved to be resilient to trailing/leading slashes.

## Adoption Logic Notes
- Attachments adoption only occurs when the attachments endpoint is called with `?case_id=...`.
- Applicant linkage derived via `case -> application -> user` resolution.
- Idempotency: enforced via `UNIQUE (file_path)` + `ON DUPLICATE KEY UPDATE origin_message_id`.

## Future Enhancements
- Add an upload endpoint for manual staff uploads: `POST /api/cases/:id/documents`.
- Add checksum calculation on file write for dedupe.
- Enforce authorization checks (scope applicant/case) in endpoints (current implementation assumes prior auth middleware + future scoping additions).
- Optionally move storage to S3; `file_path` can become object key.

## Topology & Integration Notes (Updated: Shared DB Confirmed 2025-09-19)
The public intake portal and the admin dashboard SHARE the same MySQL database cluster. This simplifies integration:

- Dual-write strategy: Portal upload endpoints can insert directly into `iset_document` within the same transaction (or a best-effort follow-up) after they persist rows to the legacy `iset_application_file` table.
- No HTTP bridge needed: Previous contingency task to call an admin API for ingestion can be deprecated in favor of direct SQL insert.
- Consistency approach: A failure to insert into `iset_document` must NOT block the user upload. Log error and continue; an async reconciliation script can later backfill from `iset_application_file` for any missed rows.
- Removal / soft delete: Portal deletion (or mark-removed) operations should update `iset_document.status='deleted'` rather than hard deleting the unified record.

### Planned Portal Changes
1. Augment upload finalize logic: After writing the file and inserting into `iset_application_file`, perform an INSERT IGNORE (or ON DUPLICATE KEY UPDATE to refresh metadata) into `iset_document` with:
	- `applicant_user_id` (resolved from session / application context)
	- `application_id`
	- `file_path` (canonical relative path used today in portal storage)
	- `file_name`
	- `source='application_submission'`
	- `status='active'`
2. Add soft delete path: On removal, attempt `UPDATE iset_document SET status='deleted', updated_at=NOW() WHERE file_path=?`.
3. Backfill job (one-off/script): Insert any historical rows missing from `iset_document` by selecting from `iset_application_file` NOT IN existing document `file_path`s.

### Deprecation Considerations
Once portal writes reliably populate `iset_document`, UI or services needing applicant documents should stop querying `iset_application_file` directly. That table can remain for historical audit until confidence is established.

## Migration / Backfill
If legacy rows existed in `iset_case_document` prior to its drop, they can be re-imported (none currently retained after destructive reset). A historical backfill from `message_attachment` can be performed by re-calling the attachments endpoint for each message with a case context.

## Rollback Plan
1. Drop `iset_document`.
2. Recreate minimal legacy `iset_case_document` (see historical schema) and revert endpoint queries.
3. Remove `source` column rendering in widget.

## Security Considerations
- Do not trust `file_path` from client requests; all creation done server-side.
- Before exposing streaming/download endpoint, add authorization guard verifying user access to the referenced case/application.
