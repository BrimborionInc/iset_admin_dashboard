# Admin Console Migration Runner

Status: current canonical PATH shared-schema migration guidance.
Last reviewed: 2026-08-09 after the DEV migration plan was made fail-closed and genuinely read-only.

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

## Read-only plan flow

`npm run db:migrate:plan -- --target-env dev` is the mandatory release-qualification planner. It has a stricter contract than apply/startup:

1. Load the configured DEV connection without issuing ordinary SQL.
2. Run the native-label identity probe first: `DATABASE()`, `@@hostname`, `@@port`, `CURRENT_USER()`, and `VERSION()` must match the current pinned DEV contract.
3. Discover `iset_migration` as an optional live object. If it exists, capture `SHOW CREATE TABLE`, `SHOW FULL COLUMNS`, `SHOW INDEX`, and live constraint/key-column metadata before any ledger read.
4. If the ledger is absent, report every canonical filesystem migration as pending. Planning does not create the ledger.
5. If the ledger exists, route one fully qualified `SELECT` through the live-schema guard. Every selected and ordered column belongs explicitly to `iset_migration`; the statement uses no invented output alias or function.
6. Compare the guarded ledger rows to canonical filenames/checksums. Identity or metadata failure stops immediately, closes the connection, and permits no ordinary read, cleanup, or mutation.

The exact DEV identity contract was revalidated through metadata on 2026-08-09, including `VERSION() = 8.0.40`. Any host, principal, port, database, or MySQL-version drift is a hard stop; refresh the pinned contract only from a new approved metadata-only probe.

## Apply/startup execution flow

Apply/startup is a separate, explicitly mutating command boundary. It does not inherit permission from a read-only plan:

1. Skip entirely if `DISABLE_AUTO_MIGRATIONS=true`.
2. Ensure `admin-dashboard/sql/migrations` exists. If empty, the runner logs that there are no pending migrations and exits.
3. Create the tracking table `iset_migration` if needed. Each row records `filename`, `checksum`, execution duration, and success/error notes.
4. Enumerate all `*.sql` files in `admin-dashboard/sql/migrations/` (non-recursive) in alphabetical order.
5. For each file:
   - Compute a SHA-256 checksum of the file contents.
   - If a successful row exists for the filename but none matches the current checksum, stop with `schema_migration_checksum_drift`.
   - If `iset_migration` already stores the same `filename+checksum` with `success=1`, skip it. Historical environments may retain more than one earlier successful checksum, but the current file must match one of them.
   - A failed row for the same `filename+checksum` does not count as applied; the file remains pending until a successful run records `success=1`.
6. Execute each pending file inside a transaction, splitting on `;` followed by newline/EOF. Duplicate column/index errors are logged and skipped; other errors abort the file and mark the migration as failed.
7. Record the outcome in `iset_migration`. On failure the runner stops further files.

`AUTO_MIGRATIONS_DRY_RUN=true` delegates to the guarded read-only plan contract and therefore never creates the ledger. A programmatic startup dry run must supply the same live-schema guard; otherwise it fails closed with `schema_migration_plan_guard_required`. Prefer the explicit DEV CLI plan for release evidence.

## Adding a migration

1. Drop a new SQL file into `admin-dashboard/sql/migrations/` (for example `20251015_create_pending_uploads.sql`). Use an ordered prefix so files apply deterministically.
2. Once a filename has succeeded in TEST or PROD, never edit it. Put every correction in a new forward filename. Local drafting may rewrite a file only before its first durable-environment success.
3. Keep scripts simple (no stored procedure delimiters); the runner performs a naive split on `;`.
4. Prefer explicit DEV preflight first:
   ```
   npm run db:migrate:inventory
   npm run db:migrate:plan
   ```
5. Apply with either:
   - `npm run db:migrate:apply`
   - `npm run db:migrate:apply -- --target-env prod --yes`
   - admin server startup
6. Logs should include:
   ```
   [migrations] Applying 1 migration(s): 20251015_create_pending_uploads.sql
   [migrations] Applied 20251015_create_pending_uploads.sql
   ```
7. Do not place one-off data-copy, seeding, or environment-sync SQL in `sql/migrations/`. Those belong in `sql/ops/`.

## Environment switches

| Variable | Default | Effect |
| --- | --- | --- |
| `DISABLE_AUTO_MIGRATIONS` | `false` in local/dev | When `true`, the runner is skipped entirely. Deployed TEST/PROD admin envs now force this to `true`. |
| `AUTO_MIGRATIONS_DRY_RUN` | `false` | When `true`, use the guarded read-only planner. A caller without a live-schema guard fails closed. |

## Failure handling

- Errors are logged as `[migrations] FAILED <file>: <message>` and stop subsequent migrations.
- The runner still records the failure row in `iset_migration` (with `success=0` and error snippet) so you have an audit trail.
- After recording the failed attempt, the shared runner throws `SchemaMigrationApplyError` with code `schema_migration_apply_failed`. `path-schema-migrate` therefore exits nonzero rather than serializing a false-success apply result.
- `path:deploy` and `test:db:refresh` also validate the parsed schema child result defensively. A zero-exit child payload containing `haltedOnFailure=true` or any failed attempt still fails the parent step, stops later mutation, and prevents a successful manifest.
- If a never-successful attempt failed, correct it before its first durable success. If the filename has ever succeeded in TEST/PROD, create a new forward migration; editing the old file is rejected as checksum drift.
- Retrying the exact same `filename+checksum` now updates the existing tracking row instead of failing on the unique key, so local/dev recovery from a failed migration does not require manual tracker cleanup.

## Operational tips

- The runner uses the same MySQL connection pool as the app; ensure database credentials are valid before startup.
- Remote target support exists for `test` and `prod` through SSM SQL helpers on an app host because the Aurora clusters only accept connections from the app security group.
- **Open safety gap:** the TEST/PROD remote `plan` implementation has not yet been moved onto the reusable live-identity/DDL/per-statement guard used by the DEV planner. Do not execute those remote plan modes or treat their output as release evidence until that gap is closed and exercised with target-specific identity/DDL fixtures. This 2026-08-09 hardening changed only the mandatory DEV qualifier path; it performed no TEST or PROD operation.
- Remote `apply` remains a mutating operational command that records success/failure rows in the target ledger. It requires its own target-specific approval, identity/schema proof, and deployment runbook; DEV planning is not authorization to run it.
- Large remote SQL bundles are staged through the environment artifact bucket before the target instance runs them, so canonical migration/data-sync payloads are not constrained by SSM document size.
- Deployed admin note: TEST bootstrap/in-place deploy and PROD bootstrap now force `DISABLE_AUTO_MIGRATIONS=true`, so startup mutation is no longer the intended schema path in deployed environments.
- Runtime schema ownership: admin, portal, and shared request paths use read-only probes and `/readyz`; they do not create/alter tables. Add new required tables/columns/indexes/enums through this canonical directory, then update readiness. PROD normal-routing smoke uses `/readyz`; `/healthz` remains a shallow process probe.
- Use the explicit guarded DEV CLI plan to see what would execute. Do not use startup dry-run mode as a substitute for retained release-qualification evidence.
- Keep destructive operations isolated and use expand/backfill/cutover patterns for prod instead of destructive same-release edits where possible.
- Portal runtime note: deployed test/prod portal environments now force `AUTO_MIGRATE=false`; do not treat `../ISET-intake/db/migrations/` as an active deploy path for PATH shared-schema work.
- **Pitfall:** a file in `sql/ops/` is intentionally invisible to the auto-runner. If the server did not apply your SQL, confirm it was placed in `sql/migrations/`, not the ops bucket.
