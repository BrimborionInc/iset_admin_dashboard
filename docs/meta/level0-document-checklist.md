# Level 0: Document Checklist Widget (Notes)

## Purpose
Working log for implementing document labeling and future checklist support across admin + portal. Use this to resume work if context is lost.

## Scope (initial)
- Add label support to Supporting Documents widget upload flow (admin).
- Persist label (and future metadata container) in API/database.
- Plan for portal intake and secure messaging adoption (later).

## Current facts
- Admin manual upload endpoint `/api/applicants/:id/documents/upload` accepts `label` + `documentType` and writes `label`, `document_category`, and `metadata.document_type` into `iset_document`.
- SupportingDocumentsWidget shows label-first, inline editable; actions View/Delete; upload/edit modals collect label + document type; delete gated by “delete” confirm.
- Secure message attachment adoption still hardcodes label `"Secure Message Attachment"`; caseworkers can relabel in Supporting Documents.
- Portal intake upload now sends `document_label` (display name) and `document_type`; finalize writes label + document_category + metadata to `iset_document`; multi-file uploads auto-suffix `(1..n)`.

## Decisions / direction
- Labels are required (no legacy fallback). For multi-file uploads in a single component: base label, suffix `(1..n)` when multiple files; single file gets base label.
- Document types are mandatory for uploads/edits; checklist matching uses `document_category` (or metadata.document_type).
- Store metadata in `metadata` JSON for future expansion (virtual path, etc.); no legacy shims.
- Checklist items hide when not required (UI filters required=false); Required column removed; checklist columns resizable.

## Open items
- (Deferred) Secure messaging compose/request flow for pre-labeled attachments.
- (Deferred) Overrides: not implemented; auto-checker only. If added, persist per-applicant/item with reason.

## Pointers
- Admin widget: `src/widgets/SupportingDocumentsWidget.js` (UI) and `/api/applicants/:id/documents/upload` in `isetadminserver.js` (label + documentType persisted).
- Checklist API: `/api/applicants/:id/document-checklist` in `isetadminserver.js` uses runtime checklist config (`iset_runtime_config`, scope checklist, k checklist.compliance.iset); also reads assessment/case for conditional items.
- Secure message adoption: `app.get('/api/admin/messages/:id/attachments?case_id=...')` ~24390 in `isetadminserver.js` (hardcoded label).
- Portal dual-write: `ISET-intake/server.js` finalize handler writes label + document_category; presign receives `document_label` and `document_type`.
- Data store: `iset_document` includes `label`, `document_category`, `metadata`; see dumps in `docs/data/DB-Structure-Dump/`.

## Checklist doc types (in UI dropdown)
application_form (legacy), ei_consent, ei_verification, indigenous_declaration, conflict_of_interest, identity_document, supporting_evidence, client_acknowledgement, release_student_info, media_consent, financial_overview, financial_records (income evidence), financial_evidence (expense evidence), statement_of_account, acceptance_letter, band_funding_confirmation, band_funding_denial, medical_documentation, resume, case_assessment, funding_agreement, attendance_form, receipt.

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
- 2025-11-25: Help panels updated for Supporting Documents (label editing, delete gate, multi-file suffixing) and Secure Messaging (attachments flow to Supporting Documents; labels editable there).
- 2025-11-25: Supporting Documents widget scaffolded with tabs (Documents, Checklist) and header badge; checklist currently uses placeholder data pending real checklist wiring.
- 2025-11-25: Seeded compliance checklist catalog at `src/server/config/checklists/iset-compliance.json`; intended to be stored in `iset_runtime_config` (scope='checklist', k='checklist.compliance.iset') for runtime use.
- 2025-11-25: Checklist wiring started: admin API `/api/applicants/:id/document-checklist` reads runtime_config checklist and computes status from `iset_document` (document_category/metadata.document_type); Supporting Documents checklist tab now loads real data and badge reflects missing-required count.
- 2025-11-25: Manual upload/edit now capture document type (document_category) alongside label; portal finalize writes document_category from document_type for checklist matching.
- 2025-11-25: Checklist rules added: conditional required for Acceptance Letter and Statement of Account (skills_development target-program only); Case Manager Assessment satisfied by submitted assessment (recommendation + date) and case status pending_approval/final; Attendance Forms required only when living allowance > 0 and expected count = ceil(duration_days/30); Medical documentation required only when disability support requested. Non-required items hidden in UI; “Required” column removed; checklist columns resizable.
- 2025-11-25: Document type list expanded (acceptance_letter, statement_of_account, band_funding_confirmation/denial, medical_documentation). Removed “Other documents” checklist item.

## Status
- Level 0 task (document labeling + Supporting Documents + checklist) is complete; checklist currently auto-computed with the rules above; overrides not implemented.
