# Development Tasks Persistence & Migration

This document describes how to persist the UI development task tracker data into a database table using the provided export script.

## Table Definition (Example)
Adjust to your database (PostgreSQL assumed):
```sql
CREATE TABLE IF NOT EXISTS dev_tasks (
  id text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  status text NOT NULL,
  notes text NULL,
  next_steps jsonb NULL,
  doc_link text NULL,
  updated_at timestamptz DEFAULT now()
);
```

## Export Script
Source: `scripts/exportDevTasksMigration.js`

Generates idempotent UPSERT statements for all tasks defined in `src/devTasksData.js`.

### Run
```bash
node scripts/exportDevTasksMigration.js > dev_tasks.sql
```
(Use appropriate Windows PowerShell equivalent if needed.)

### Apply
```bash
psql "$DATABASE_URL" -f dev_tasks.sql
```
Or pipe directly:
```bash
node scripts/exportDevTasksMigration.js | psql "$DATABASE_URL"
```

## Workflow
1. Edit or add tasks in `src/devTasksData.js`.
2. Re-run export script to produce updated SQL.
3. Apply to target environment.
4. (Optional) Add a conventional migration wrapper that commits the SQL file into version control if desired.

## UI Loading (Future Enhancement)
Currently tasks are loaded from `sessionStorage` with merge enrichment. To load from DB instead:
1. Create endpoint `GET /api/admin/dev-tasks` returning array matching shape of `devTasks`.
2. On dashboard mount, fetch tasks; if 200, replace local state & sessionStorage.
3. For status updates, call `PATCH /api/admin/dev-tasks/:id { status }` and optimistically update UI.

## Data Versioning (Optional)
Add a `schema_version` field and store a version string in `sessionStorage`. If mismatch, force refresh from server or re-enrich from static file.

## Security Considerations
- Restrict endpoints to System Administrator role.
- Validate status values server-side (whitelist: planned, in-progress, blocked, done).
- Log changes for audit trail.

## JSONB Advantages
`next_steps` stored as JSONB allows flexible future additions (e.g., deadlines, owners) without immediate migrations.

---
This process keeps UI decoupled while enabling gradual server persistence.
