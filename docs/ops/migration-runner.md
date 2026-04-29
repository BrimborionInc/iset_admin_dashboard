# Admin Console Migration Runner

Status: current canonical PATH shared-schema migration guidance.
Last reviewed: 2026-04-29 during ops documentation cleanup.

The admin console owns the canonical PATH shared-schema migration runner. This note documents the canonical runner used by `isetadminserver.js` startup and by the explicit CLI in `scripts/path-schema-migrate.js`.

## Where migrations live

- Canonical migration directory: `admin-dashboard/sql/migrations/`
- Ops-only SQL directory: `admin-dashboard/sql/ops/` (not auto-run)
- Legacy archive: `admin-dashboard/db/migrations/` (reference only)
- Tracking table: `iset_migration`
- Runner module: `src/lib/sharedSchemaMigrationRunner.js`
- Startup entry: `isetadminserver.js`
- CLI entry: `scripts/path-schema-migrate.js`

The admin server can execute canonical migrations automatically at startup when local/dev env allows it, but deployed TEST/PROD admin environments now force `DISABLE_AUTO_MIGRATIONS=true`. For deploy work, use the CLI instead of relying on startup side effects.

## Execution flow

1. Skip entirely if `DISABLE_AUTO_MIGRATIONS=true`.
2. Ensure `admin-dashboard/sql/migrations` exists. If empty, the runner logs that there are no pending migrations and exits.
3. Create the tracking table `iset_migration` if needed. Each row records `filename`, `checksum`, execution duration, and success/error notes.
4. Enumerate all `*.sql` files in `admin-dashboard/sql/migrations/` (non-recursive) in alphabetical order.
5. For each file:
   - Compute a SHA-256 checksum of the file contents.
   - If `iset_migration` already stores the same `filename+checksum` with `success=1`, skip it.
   - A failed row for the same `filename+checksum` does not count as applied; the file remains pending until a successful run records `success=1`.
6. If `AUTO_MIGRATIONS_DRY_RUN=true`, log the pending filenames and stop (useful in preflight checks).
7. Otherwise, execute each pending file inside a transaction, splitting on `;` followed by newline/EOF. Duplicate column/index errors are logged and skipped; other errors abort the file and mark the migration as failed.
8. Record the outcome in `iset_migration`. On failure the runner stops further files.

## Adding a migration

1. Drop a new SQL file into `admin-dashboard/sql/migrations/` (for example `20251015_create_pending_uploads.sql`). Use an ordered prefix so files apply deterministically.
2. Keep scripts simple (no stored procedure delimiters); the runner performs a naive split on `;`.
3. Prefer explicit preflight first:
   ```
   npm run db:migrate:inventory
   npm run db:migrate:plan
   npm run db:migrate:plan -- --target-env test
   ```
4. Apply with either:
   - `npm run db:migrate:apply`
   - `npm run db:migrate:apply -- --target-env prod --yes`
   - admin server startup
5. Logs should include:
   ```
   [migrations] Applying 1 migration(s): 20251015_create_pending_uploads.sql
   [migrations] Applied 20251015_create_pending_uploads.sql
   ```
6. Do not place one-off data-copy, seeding, or environment-sync SQL in `sql/migrations/`. Those belong in `sql/ops/`.

## Environment switches

| Variable | Default | Effect |
| --- | --- | --- |
| `DISABLE_AUTO_MIGRATIONS` | `false` in local/dev | When `true`, the runner is skipped entirely. Deployed TEST/PROD admin envs now force this to `true`. |
| `AUTO_MIGRATIONS_DRY_RUN` | `false` | When `true`, list pending files without executing them. |

## Failure handling

- Errors are logged as `[migrations] FAILED <file>: <message>` and stop subsequent migrations.
- The runner still records the failure row in `iset_migration` (with `success=0` and error snippet) so you have an audit trail.
- Fix the SQL, edit/re-save the file, and restart. The checksum change triggers a new attempt.
- Retrying the exact same `filename+checksum` now updates the existing tracking row instead of failing on the unique key, so local/dev recovery from a failed migration does not require manual tracker cleanup.

## Operational tips

- The runner uses the same MySQL connection pool as the app; ensure database credentials are valid before startup.
- Remote target support now exists for `test` and `prod`. Those modes execute through the SSM SQL helpers on an app host because the Aurora clusters only accept connections from the app security group.
- Remote `plan` is read-only and compares the target `iset_migration` table to the local canonical filesystem state. Remote `apply` records success/failure rows in the same tracking table on the target environment.
- Large remote SQL bundles are staged through the environment artifact bucket before the target instance runs them, so canonical migration/data-sync payloads are not constrained by SSM document size.
- Deployed admin note: TEST bootstrap/in-place deploy and PROD bootstrap now force `DISABLE_AUTO_MIGRATIONS=true`, so startup mutation is no longer the intended schema path in deployed environments.
- For long deployments, consider running with `AUTO_MIGRATIONS_DRY_RUN=true` first to see what will execute, then remove the flag and restart.
- Keep destructive operations isolated and use expand/backfill/cutover patterns for prod instead of destructive same-release edits where possible.
- Portal runtime note: deployed test/prod portal environments now force `AUTO_MIGRATE=false`; do not treat `../ISET-intake/db/migrations/` as an active deploy path for PATH shared-schema work.
- **Pitfall:** a file in `sql/ops/` is intentionally invisible to the auto-runner. If the server did not apply your SQL, confirm it was placed in `sql/migrations/`, not the ops bucket.
