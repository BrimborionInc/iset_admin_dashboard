# Migration Runner Overview

Last updated: 2026-04-04

## Behaviour
- `isetadminserver.js` can apply canonical shared-schema migrations on startup in local/dev, but deployed TEST/PROD admin environments now force `DISABLE_AUTO_MIGRATIONS=true`.
- Canonical migrations live in `sql/migrations/` and are tracked in `iset_migration`.
- One-off/manual SQL lives in `sql/ops/` and is intentionally excluded from the startup runner.
- The reusable implementation lives in `src/lib/sharedSchemaMigrationRunner.js`, and the same logic is available explicitly through `scripts/path-schema-migrate.js`.

## Usage
1. Add a timestamped migration file to `sql/migrations/`.
2. Run `npm run db:migrate:plan`.
3. Apply with `npm run db:migrate:apply` (or `--target-env test|prod` for deployed environments).
4. Watch for `[migrations] Applied <filename>` in the logs.

## Notes
- The runner only executes `.sql` files in `sql/migrations/`.
- Files are processed in sorted order and tracked by `filename + checksum`.
- Scripts should be idempotent; use `IF NOT EXISTS`, guarded renames, and expand/backfill/cutover patterns where possible.
- Deployed portal environments now force `AUTO_MIGRATE=false`, so PATH shared-schema work should not be added to `../ISET-intake/db/migrations/`.
