# Level 0: Document Checklist Widget (Notes)

## Purpose
Working log for implementing document labeling and future checklist support across admin + portal. Use this to resume work if context is lost.

## Scope (initial)
- Add label support to Supporting Documents widget upload flow (admin).
- Persist label (and future metadata container) in API/database.
- Plan for portal intake and secure messaging adoption (later).

## Current facts
- Admin upload endpoint `/api/applicants/:id/documents/upload` already accepts `label` and stores it in `iset_document.label`; UI currently sends filename and does not display label.
- SupportingDocumentsWidget table renders `file_name` only; uploads set `label = file.name`.
- Secure message attachment adoption inserts into `iset_document` with label `"Secure Message Attachment"` (hardcoded; to revisit later).
- Portal intake dual-write into `iset_document` (public server) omits `label`; `iset_document` has `label` column available.

## Decisions / direction
- Labels are required (no legacy fallback). For multi-file uploads in a single component: use base label, suffix with `(1..n)` when multiple files are uploaded; single file gets base label.
- Store metadata in a future-proof sub-JSON field (e.g., `metadata` with `label`, `virtual_path` placeholder) when adding API fields; hierarchy comes later.
- Avoid adding legacy branches or compatibility shims.

## Open items
- Define precise API contract for admin upload request body (label + optional metadata JSON) and response shape with `label`/`metadata`.
- Update SupportingDocumentsWidget to collect user-provided label (base label) and display stored label in the table.
- Decide how label flows into portal intake renderer and schema publishing; align component template (`src/component-lib/file-upload.template.json`) and workflow JSON.
- Plan secure messaging compose/request flow for labeled attachments (deferred).

## Pointers
- Admin widget: `src/widgets/SupportingDocumentsWidget.js` (UI) and `/api/applicants/:id/documents/upload` in `isetadminserver.js` (label already persisted).
- Secure message adoption: `app.get('/api/admin/messages/:id/attachments?case_id=...')` around line ~24390 in `isetadminserver.js` (hardcoded label).
- Portal dual-write: `server.js` in `ISET-intake` around file finalize handler (dual-writes to `iset_document`).
- Data store: `iset_document` includes `label`; see db dumps under `docs/data/DB-Structure-Dump/` for schema reference.

## Next steps (for admin upload path)
1) Add label input in SupportingDocumentsWidget (base label, apply suffixing for multiple files in a batch).
2) Ensure upload request sends label (and metadata envelope if added) and response/refresh shows label.
3) Display label column in Supporting Documents table (fall back to filename only if label missing, though new uploads must supply label).
4) Extend API (if needed) to accept metadata JSON for future hierarchy.

## Progress log
- 2025-11-25: Supporting Documents widget now opens a label modal before file selection; uploads send the provided label and reset after upload; table shows label as first column (falls back to filename only if label absent). Metadata envelope still pending.
- 2025-11-25: Supporting Documents table upgraded to Cloudscape standard: column preferences (cog) with required columns (File Name, Actions) locked on, resizable columns with persisted widths, sticky header, keyboard navigation; filtering intentionally omitted for now.
- 2025-11-25: Added inline label editing on Supporting Documents table (Cloudscape editConfig on label column); actions now View first, Delete placeholder; label update still depends on backend endpoint.
- 2025-11-25: Migration hygiene: renamed legacy `documents` table via safe rename migration (`sql/20251125_rename_documents_legacy.sql` for admin runner; `ISET-intake/db/migrations/20251125_rename_documents_legacy.sql` for portal). Runner applied admin migration successfully.
- 2025-11-25: Prepared metadata column migration for `iset_document` (`sql/20251125_add_iset_document_metadata.sql` admin; `ISET-intake/db/migrations/20251125_add_iset_document_metadata.sql` portal) to hold structured label/virtual path in future.
- 2025-11-25: Admin API extended: `/api/documents/:id` PUT to update label+metadata; `/api/documents/:id` DELETE to soft-delete (status=deleted); manual upload now writes metadata JSON with label.
- 2025-11-25: Inline label edit now optimistically updates UI and reloads after PUT; delete action hits new DELETE endpoint.
- 2025-11-25: Fixed inline edit handler signature to match Cloudscape submitEdit (item, column, newValue) so label edits invoke the PUT endpoint.
- 2025-11-25: Delete flow now uses confirmation modal with “delete” text gate; delete action calls DELETE endpoint with per-row loading state.
- 2025-11-25: Admin manual uploads now respect UPLOAD_MODE/UPLOAD_DRIVER; in s3 mode files stream to object store via presigned PUT using shared s3Provider, with file_path set to the object key.
- 2025-11-25: Intake authoring updated: file-upload template/schema includes `documentLabel` (display name) and emits data attribute; portal renderer passes `document_label` through presign/finalize; portal finalize writes label/metadata into `iset_document`.
- 2025-11-25: Workflow publish normalization now emits `documentLabel` for file-upload components so published schemas deliver display labels to the portal.
- 2025-11-25: Portal file-upload renderer suffixes document labels for multi-file uploads (label, label (1), label (2)...) and sends per-file labels to presign/finalize.
