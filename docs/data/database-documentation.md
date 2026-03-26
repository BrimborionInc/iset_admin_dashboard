# Database Documentation Index (ISET Shared MySQL)

Purpose: Single entrypoint for database documentation across the admin dashboard and public intake portal. Use this first in future Codex sessions.

## Where to look
- `docs/data/database-overview.md` - Quick orientation, logical relationships, and demo-data guidance.
- `docs/data/case-finance-data-architecture.md` - Case/finance ERM narrative and key table relationships.
- `docs/data/documents-model.md` - Unified document model and linking rules.
- `docs/data/applicant-account-activation.md` - Applicant Cognito account linkage, invitation workflow fields on `client`, and applicant-account event audit records.
- `docs/data/finance-regional-salaries.md` - Annual province/territory salary entry records used by the Budgets and Finance salaries dashboard.
- `docs/data/regional-snapshot-reporting.md` - Saved Board-style regional snapshot report records and manual-input schema.
- `docs/data/tutorial-progress.md` - Hands-on tutorial completion/dismissal tracking (`staff_tutorial_progress`).
- `docs/planning/document-model-erm-adjustment.md` - ERM changes and rationale for document relationships.
- `docs/data/record-locking.md` - `application_lock` and optimistic/pessimistic concurrency tables.
- `docs/architecture/integrations/public-admin-integration-notes.md` - Cross-app data flow and shared-DB context.
- `../ISET-intake/docs/data/key-tables.md` - Portal-focused key tables and notes.

## Schema source of truth
- Admin dashboard schema changes are applied via the admin server migration runner reading `sql/` (tracked by `iset_migration`). See `docs/ops/migration-runner.md`.
- `db/migrations/` exists but is not applied by the admin server migration runner (treat as legacy/historical unless you have a separate runner).
- Portal DB artifacts live in `../ISET-intake/database/` (procedures) and `../ISET-intake/local_db_dump.sql` (historical dump).

## Schema snapshots (dev)
- Local schema dumps live in `docs/data/DB-Structure-Dump/` (not committed).
- Refresh with `npm run dump:dev-schema` after schema changes.

## Update checklist (when schema changes)
1. Update this index so future chats know where to look.
2. Update the relevant domain doc(s) listed above.
3. Regenerate `docs/data/DB-Structure-Dump/` if table/column shapes changed.
4. Add a note to `docs/meta/changelog.md` if the change is user-visible or operational.
