# Hands-on Tutorial Progress (Admin Console)

Purpose: Document how the admin dashboard tracks Cloudscape hands-on tutorial completion/dismissal per staff account.

## Table: `staff_tutorial_progress`

Use: Per-staff tutorial state so progress follows the staff member across browsers/devices.

Columns (key fields):
- `staff_profile_id` (INT, required): Links to the staff identity (`staff_profiles.id`) used by `/api/me/*` endpoints.
- `tutorial_id` (VARCHAR(128), required): Stable string ID for a tutorial (example: `iset-coordinator-intro-v1`).
- `status` (VARCHAR(32), required): One of:
  - `completed` (user finished the tutorial)
  - `dismissed` (user chose "Not now" or exited early; suppress auto-prompt)
- `completed_at` / `dismissed_at` (DATETIME, nullable): Timestamp for the current status.
- `created_at` / `updated_at` (DATETIME): Audit timestamps.

Constraints / indexes:
- Unique: (`staff_profile_id`, `tutorial_id`)
- Indexes: `staff_profile_id`, `tutorial_id`, `status`

Notes:
- `dismissed` is intentionally distinct from `completed` so a future Tutorials dashboard can still show tutorials as incomplete but not auto-prompted.

## Tutorial ID strategy

- Use stable IDs with explicit versions: `*-v1`, `*-v2`, etc.
- Bump the version suffix when step/hotspot structure changes incompatibly (so progress is tracked separately).

## Related API endpoints

Server routes (for the current signed-in staff member):
- `GET /api/me/tutorial-progress`
- `POST /api/me/tutorial-progress` (upsert `{ tutorialId, status }`)
- `POST /api/me/tutorial-progress/bulk-complete` (migration helper)

Migration runner:
- The admin server auto-runs `admin-dashboard/sql/*.sql` once per checksum (tracked in `iset_migration`). See `docs/ops/migration-runner.md`.

