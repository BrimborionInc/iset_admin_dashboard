# File Uploads – Solution Architecture (Living Doc)

Status: Draft (shared across Admin + Public)
Owners: Admin Intake Editor + Case Management
Scope: Admin intake authoring, preview/testing, and future case dashboards

Refer to the primary spec in ISET-intake/docs/file-uploads-architecture.md. This copy highlights admin-specific needs. Terminal step mandate (pilot): all applicant uploads live only in a single `supporting-documents` step immediately before summary; omission = no uploads.

Reminder: Active TODO list
- Shared uploads TODO lives at `ISET-intake/docs/uploads-TODO.md`.

## Admin-specific considerations (Pilot + Forward)
- Document Type Catalog authoring
  - Create/edit types, allowed extensions/MIME, size limits, count limits
  - Conditional rules (required_when), visibility (public/admin/both)
  - Versioning with change history and safe rollout (preview before publish)
 - Intake Editor File Upload component
  - Visible when (conditional display rule; same rule model as validation panel)
  - Required (toggle) and Conditional required (rule builder like validation panel)
  - Allow multiple files, min/max files per component (min/max are static in V1)
   - Accepted types override; per-file max size override (bounded by global hard cap)
   - Per-component guidance text; optional storage key prefix/namespace
- Sandbox preview (Phase B+)
  - Generate sample pre-signed URLs against non-prod storage for test uploads (dev flag)
  - Simulate scan lifecycle states and error scenarios prior to real scanning integration
- Governance
  - Retention policy templates; legal hold markers (future)
  - Role-based permissions for catalog changes, overrides, and quarantined item handling
  - Storage provider selection widget (on‑prem vs AWS) per environment with audit trail; secrets referenced by named profiles
- Case dashboard integration (future)
  - Browse per-application document list, versions, and scan status
  - Request-missing-docs workflow (emails/portal tasks)
  - Redaction/annotation pipeline (phase 2+)

## Interfaces
- Admin UI -> Document Catalog Service (CRUD + publish)
- Admin UI -> Document Service (list/query docs by app/person, quarantine actions)
- Admin UI -> Presign API (preview/test uploads in non-prod)

## Admin widget: Document Settings
- Environment defaults with optional workflow/step defaults. No program-level overrides.
- Controls:
  - Allowed types: PDF, JPG/JPEG, PNG, HEIC (on by default); “Allow photos” toggle
  - Max size per file (MB) with server-enforced hard cap
  - Max files per type (global defaults)
  - Optional global total size cap per application (off by default; can derive from schema)
  - Virus scan required; scan scope (All uploads | PDFs only | PDFs + images); quarantine visibility
  - Retention policy presets (future)
  - Storage provider selection (links to provider widget)
  - Photo handling options: auto-rotate, resize/downscale, JPEG quality, strip EXIF (toggle; default off), optional HEIC→JPEG/PDF conversion
- Metrics (read-only): file count (total and per workflow), total storage (MB/GB), trends, avg/95th size, uploads last 24h/7d, failure and quarantine rates, scan backlog, provider health.
- RBAC: only privileged roles; full audit of changes.

## Open questions (admin)
1) Who can author/publish catalog changes (RBAC roles)?
2) Approval workflow needed for catalog updates?
3) Quarantine triage ownership and SLAs?
4) Audit/log export requirements?
5) Who can toggle storage provider; is a migration assistant required when switching?

## Decision log (admin)
 - 2025-09-06: On‑prem storage: MinIO (S3‑compatible) selected for Phase 1; environment-level toggle planned for AWS later.
 - 2025-09-06: Rules are configured at the component level; conditional visibility and conditional required are supported. No program-level rules.
 - 2025-09-12: Pilot restricts uploads to terminal `supporting-documents` step only; mid-flow placement deferred.

---

## Resume tomorrow – editor/admin quick start and progress

TL;DR status
- Backend upload skeleton is working locally (presign → PUT → finalize → list). Storage (MinIO) and registry are in place.
- No admin authoring UI for uploads yet; rules model finalized (component-level only; `visibleWhen`/`requiredWhen`, static `min/max` in V1).

Where to pick up (admin side)
Phase ordering (aligned with global phased plan):
Phase A (Portal Pilot): No admin authoring required; schema patched manually.
Phase B (Authoring Enablement):
  1) Add File Upload component controls in the intake editor (fields: label, componentId, accept, maxSizeMb, allowMultiple, minFiles, maxFiles, visibleWhen, requiredWhen, helpText, storagePrefix, groupId).
  2) Step-level metadata editing (title, introMarkdown, completionHelpText, emptyStateText); enforce single terminal step.
  3) Group management UI (add/reorder/delete) with referential validation.
  4) Environment defaults screen (initially read-only) exposing allowed types, hard cap, scan scope.
  5) Preview mode (dev flag) with stub or restricted presign to test UI.
Phase C (Scanning): Display scan status transitions; quarantine handling (read-only or action buttons if scope permits).
Phase D (Hardening): Audit visualization, rate limit metrics, stale cleanup summary.
Phase E (Policy UI): Editable environment defaults; detect overrides at component level.

Key code pointers (backend integration reference)
- API contracts to call from preview/test:
  - POST `/api/uploads/presign`
  - POST `/api/documents/finalize`
  - GET `/api/documents`
  - GET `/api/documents/:id/download-presign`
- Policy reference (allowed types and caps): `ISET-intake/upload/policy.js`
- Storage adapter (for understanding presign): `ISET-intake/storage/s3Provider.js`

Governance & RBAC reminders
- No program-level overrides. All rules authored at component level; environment defaults just bound maxima and toggles.
- Audit all changes; show before/after in the change log. Restrict authoring to privileged roles.

Quality snapshot
- Server endpoints live behind feature flags; dev-bypass supported locally.
- Frontend admin work is greenfield; no breaking changes expected.

Next admin tasks (Phase B readiness)
1) Draft JSON schema for FileUpload component and step metadata.
2) Implement editor UI and persistence for component settings + groups.
3) Read-only Document Settings screen.
4) Dev preview mode wiring.
