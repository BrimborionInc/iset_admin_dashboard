# Unified Documents Model (iset_document)

Date: 2026-01-08

## Summary
The unified `iset_document` table now anchors every document to a single `client_id`, with optional links to applications, cases, or action plans. Intervention links are stored in the `iset_document_intervention` join table, and payment evidence attachments live in `payment_packet_document`.

## Drivers
- Need a single list of all supporting documents for an applicant regardless of origin.
- Support auto-adoption of secure message attachments into the case file.
- Prepare for future manual staff uploads and application-ingest artifacts.
- Provide traceability (source + origin_message_id) and future extensibility (checksums, MIME types, status lifecycle).

## Table Definition
See migration script: `sql/20250919_create_iset_document.sql`.
Key columns:
- `client_id` (required) for ownership; every document belongs to exactly one client.
- `applicant_user_id` plus optional `application_id`, `case_id`, or `action_plan_id` for scoping.
- `origin_message_id` + `source` to trace provenance.
- `file_path` canonical relative path (unique) + `file_name` original display name.
- `status` for archival / soft delete.

Related tables:
- `iset_document_intervention` (`document_id`, `intervention_id`) stores action-plan intervention links (many-to-many).
- `payment_packet_document` stores payment packet evidence links (packet-level; line-level inferred).

## Scope Rules
- `document_type.scope` supports: `client`, `application`, `case`, `action_plan`, `payment_packet`.
- Action plan documents attach to `action_plan_id` and optionally link to one or more interventions via `iset_document_intervention`.
- Application and case documents attach to their respective IDs only.

## Source Values
- `application_submission`: Uploaded or generated as part of the original application submission.
- `secure_message_attachment`: Attached to a secure message in the admin workspace.
- `system_generated`: Generated from signed digital forms (displayed as "Digitally signed" in the UI).
- `manual_upload`: Uploaded directly by staff in the admin workspace.

## Endpoint Changes
- `GET /api/applicants/:id/documents` now returns action plan context (`action_plan_id`, `intervention_ids`) alongside case/application references.
- `POST /api/applicants/:id/documents/upload` enforces `document_type.scope` rules, requires `client_id`, and accepts action plan + intervention links.
- `PUT /api/documents/:id` and `/api/documents/:id/duplicate` update action plan + intervention associations (no `linked_intervention_id`).
- `GET /api/admin/messages/:id/attachments` upserts attachments into `iset_document` with `client_id` + case/application context when a `case_id` query param is provided.
- `POST /api/finance/payment-packets/:id/documents` validates `iset_document.client_id` matches the packet.

## Widget Updates
`SupportingDocumentsWidget` supports action plan scoping with optional multi-intervention links, updates scope labels (client/application/case/action plan/payment packet), and continues to refresh from the `iset:supporting-documents:refresh` event fired by Secure Messaging.

## Cross-widget Hooks (2025-09-21)
- SecureMessagingWidget dispatches `iset:supporting-documents:refresh` after attachments load, giving SupportingDocumentsWidget an immediate view of newly adopted files.
- The admin API now back-fills `applicant_user_id`, `application_id`, and `user_id` when re-adopting attachments so the unified list stays filtered correctly.

## Adoption Logic Notes
- Attachments adoption only occurs when the attachments endpoint is called with `?case_id=...`.
- Applicant linkage derived via `case -> application -> user` resolution; `client_id` is resolved from the case/application/applicant_user_id chain.
- Idempotency: enforced via `UNIQUE (file_path)` + `ON DUPLICATE KEY UPDATE` for applicant/application/user/origin fields so re-opening a message repairs missing metadata.

## Future Enhancements
- Add an upload endpoint for manual staff uploads: `POST /api/cases/:id/documents`.
- Add checksum calculation on file write for dedupe.
- Enforce authorization checks (scope applicant/case) in endpoints (current implementation assumes prior auth middleware + future scoping additions).
- Optionally move storage to S3; `file_path` can become object key.

## Topology & Integration Notes (Updated: Shared DB Confirmed 2025-09-19)
The public intake portal and the admin dashboard SHARE the same MySQL database cluster. This simplifies integration:

- Dual-write strategy: Portal upload endpoints can insert directly into `iset_document` within the same transaction (or a best-effort follow-up) after they persist rows to the legacy `iset_application_file` table.
- No HTTP bridge needed: Previous contingency task to call an admin API for ingestion can be deprecated in favor of direct SQL insert.
- Consistency approach: Uploads must resolve `client_id` before writing documents, and inserts into `iset_document` are required (no best-effort fallback). If the insert fails, the upload should fail and surface the error.
- Removal / soft delete: Portal deletion (or mark-removed) operations should update `iset_document.status='deleted'` rather than hard deleting the unified record.

### Planned Portal Changes
1. Resolve or create the `client_id` before uploads (via intake JSON + Cognito fallback), and store it in `input_json_state` for reuse.
2. Insert into `iset_document` in the same upload flow with:
	- `client_id` (required)
	- `applicant_user_id` (from session context)
	- `application_id` (when scope is application)
	- `file_path` (canonical relative path used today in portal storage)
	- `file_name`
	- `source='application_submission'`
	- `status='active'`
3. Add soft delete path: On removal, attempt `UPDATE iset_document SET status='deleted', updated_at=NOW() WHERE file_path=?`.
4. Backfill job: not planned for dev (no legacy documents expected).

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
