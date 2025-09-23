# Migration Runner Overview

Last updated: 2025-09-23

## Behaviour
- `server.js` automatically applies SQL migrations on startup. When the server boots, it logs:
  - `[migrate] Starting migration check`
  - `[migrate] All migrations up to date` (or a list of applied files).
- Migrations live in `db/migrations` and are executed in sorted order. New files should follow the existing timestamped naming pattern (e.g. `20250923_0005_add_internal_notifications.sql`).

## Usage
1. Drop the migration file into `db/migrations`.
2. Restart the admin server via `npm run server` (or whichever process manager you use).
3. Watch the console for the `[migrate]` log lines to confirm the SQL ran.

## Notes
- The runner only executes files with an `.sql` extension.
- Scripts should be idempotent; wrap DDL in `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` checks when possible.
- If a migration fails, startup logs will show the error and the server will exit—fix the SQL, restart, and it will retry.
