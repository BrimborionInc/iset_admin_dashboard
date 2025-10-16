# Admin Console Migration Runner

The admin console (`admin-dashboard/isetadminserver.js`) includes its own SQL migration runner. Because the admin service manages a different schema and keeps its migrations in a separate directory, this note spells out how the runner behaves and how to work with it safely.

## Where migrations live

- SQL directory: `admin-dashboard/sql/`
- Tracking table: `iset_migration`
- Runner location: inline IIFE near the bottom of `isetadminserver.js`

The runner executes automatically at startup unless disabled (details below).

## Execution flow

1. Skip entirely if `DISABLE_AUTO_MIGRATIONS=true`.
2. Ensure `admin-dashboard/sql` exists. If empty, the runner logs `[migrations] No .sql files found` and exits.
3. Create the tracking table `iset_migration` if needed. Each row records `filename`, `checksum`, execution duration, and success/error notes.
4. Enumerate all `*.sql` files in `admin-dashboard/sql/` (non-recursive) in alphabetical order.
5. For each file:
   - Compute a SHA-256 checksum of the file contents.
   - If `iset_migration` already stores the same `filename+checksum` with `success=1`, skip it (this enables safe edits to existing files: changing the file changes the checksum, so it reruns once).
6. If `AUTO_MIGRATIONS_DRY_RUN=true`, log the pending filenames and stop (useful in preflight checks).
7. Otherwise, execute each pending file inside a transaction, splitting on `;` followed by newline/EOF. Duplicate column/index errors are logged and skipped; other errors abort the file and mark the migration as failed.
8. Record the outcome in `iset_migration`. On failure the runner stops further files.

## Adding a migration

1. Drop a new SQL file into `admin-dashboard/sql/` (e.g. `20251015_create_pending_uploads.sql`). Use an ordered prefix so files apply deterministically.
2. Keep scripts simple (no stored procedure delimiters); the runner performs a naive split on `;`.
3. Restart the admin server. Startup logs should include:
   ```
   [migrations] Applying 1 migration(s): 20251015_create_pending_uploads.sql
   [migrations] Applied 20251015_create_pending_uploads.sql (N statements)
   ```
4. To rerun a file, delete its row from `iset_migration` (or modify the SQL so the checksum changes).

## Environment switches

| Variable | Default | Effect |
| --- | --- | --- |
| `DISABLE_AUTO_MIGRATIONS` | `false` | When `true`, the runner is skipped entirely. |
| `AUTO_MIGRATIONS_DRY_RUN` | `false` | When `true`, list pending files without executing them. |

## Failure handling

- Errors are logged as `[migrations] FAILED <file>: <message>` and stop subsequent migrations.
- The runner still records the failure row in `iset_migration` (with `success=0` and error snippet) so you have an audit trail.
- Fix the SQL, edit/re-save the file, and restart. The checksum change triggers a new attempt.

## Operational tips

- The runner uses the same MySQL connection pool as the app; ensure database credentials are valid before startup.
- For long deployments, consider running with `AUTO_MIGRATIONS_DRY_RUN=true` first to see what will execute, then remove the flag and restart.
- Keep destructive operations (drops, truncates) in their own migration files so you can review logs to confirm they ran.
