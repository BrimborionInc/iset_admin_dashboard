# CR-0015 — Intake Input JSON Shared Persistence

## Summary
- Replace the per-instance in-memory “input JSON” store with a shared persistence layer so the public intake wizard behaves deterministically behind load balancing.
- Introduce a dedicated database table (working name: `iset_intake.input_json_state`) keyed by applicant session/user, storing the aggregate intake payload, navigation history, and timestamps.
- Update `/api/intake-json` GET/POST handlers to read/write through this shared store while keeping an optional in-process cache for short-lived performance benefits.
- Ensure both docbases (`X:\ISET\admin-dashboard\docs` and `X:\ISET\ISET-intake\docs`) capture the architecture change once implemented.

## Background
- The portal’s “input JSON” aggregation intentionally avoided local storage and React state to reduce privacy risk; answers and history live only server-side.
- Dev/testing previously ran on a single Node process, so the in-memory object keyed by user ID was effectively consistent.
- The test environment now runs multiple portal instances behind an ALB without sticky sessions, so each request may land on a different instance with a different in-memory state.
- Result: applicants see inconsistent histories/answers (e.g., consent data disappearing) whenever requests hit different nodes—a blocker for production readiness.
- Important distinction: `iset_application_draft_dynamic` is the recoverable draft store; historically it was populated only by explicit “Save and finish later”, and the legacy portal now also has a runtime-gated step-autosave path. It is still **not** the ephemeral store. The ephemeral store originally lived entirely in memory (`intakeAggregateData` / `intakeStepData`) and now lives in transient shared table `input_json_state`, which is still supposed to be wiped on logout, submission, save/finish, or after ~30 minutes of inactivity. Any persistent replacement must preserve these lifecycle guarantees.

## Pain Points / Risks
- Multi-instance inconsistency breaks back/forward navigation and jeopardises submission integrity.
- Failing to persist “input JSON” centrally also prevents horizontal scaling or rolling deploys; any process restart drops all progress mid-session.
- There is no audit trail or TTL enforcement beyond crude memory cleanup, making operational troubleshooting difficult.

## Decisions (Initial)
1. **Shared Store**: Use the existing Aurora cluster (same schema namespace) for persistence; no new datastore introduced.
2. **Schema**: Create `iset_intake.input_json_state` (exact name TBD) with columns for `user_id`, `session_id`, aggregate JSON payload, navigation history array, last step cursor, checksum/hash, `updated_at`, `expires_at`.
3. **Lifecycle**: Persist on every `/api/intake-json` POST (merge) and purge rows on submission, explicit logout, save-and-finish-later, or TTL expiry (default 30 minutes, configurable). The DB table must remain as ephemeral as the current memory store—no long-lived accumulation.
4. **Caching**: Allow an optional per-process cache keyed by `(user_id, session_id)` to reduce DB chatter, but treat the DB as source-of-truth and always reconcile on GET.
5. **Compatibility**: Maintain existing API contracts (request/response bodies) so the wizard renderer needs no immediate changes.
6. **Documentation**: Update both docbases after implementation, noting the retirement of purely in-memory aggregation and new operational considerations.

_These decisions may evolve; update this section as the work progresses._

## Change Plan
**Increment 1 — Schema & Infrastructure**
- Design the DDL for `input_json_state`, including indexes (primary key on `(user_id, session_token)` or equivalent) and automatic TTL support (scheduled purge job or DB event). Target columns:
  - `user_id` INT FK → `iset_intake.user`.
  - `session_token` CHAR(64) NULL (reserved for multi-session; default NULL).
  - `workflow_id` VARCHAR(64) DEFAULT `'iset-v1'`.
  - `step_cursor` VARCHAR(128) NULL.
  - `input_payload` JSON NOT NULL (full aggregate “input JSON” blob).
  - `history` JSON NULL (mirrors the array shown in the debug panel).
  - `doc_refs` JSON NULL (future-friendly; aligns with draft metadata).
  - `checksum_sha256` CHAR(64) NULL (detect out-of-order patches / dedupe).
  - `version` INT NOT NULL DEFAULT 1.
  - `created_at` / `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3).
  - `expires_at` DATETIME(3) NOT NULL (set to `NOW() + TTL`; indexed for purges).
- Land migrations/scripts via the **admin-dashboard migration runner** (`admin-dashboard/sql/migrations/*`, tracked by `iset_migration`) so schema changes remain centralized. Portal repo will not run its standalone runner for this table.
- Document schema in both docbases once approved.

**Increment 2 — Server Abstraction**
- Add a repository/service module around the new table (CRUD, merge semantics, TTL handling, purge helper).
- Build unit tests for merge semantics (history dedupe, null-handling, checksum updates).
- Decide on JSON column types (e.g., `JSON` vs `LONGTEXT`) and ensure MySQL driver handles them reliably.

**Increment 3 — API Integration**
- Update `/api/intake-json` GET/POST handlers in the portal server to:
  - Load from the shared store (with cache fallback).
  - Apply deep-merge logic server-side, then persist back to DB.
  - Enforce TTL (load failure returns 404/empty, prompting restart).
- Add logging/metrics for misses, stale entries, and purge events.

**Increment 4 — Session Lifecycle Hooks**
- Hook save-and-finish-later, logout, and successful submission flows so they explicitly clear rows for that user/session.
- Add a periodic cleanup job (cron/worker) to delete expired rows and emit audit entries.
- Validate behaviour during rolling deploys and ASG scale events.

**Increment 5 — Documentation & Operationalization**
- Update both docbases with:
  - Architecture description of the shared input JSON store.
  - Operational runbooks (purge commands, monitoring).
  - Privacy statement updates (data now transiently stored in DB).
- Capture test evidence (load-balanced run, failover scenario).
- Close the CR only after both docbases reflect the change.

> _Reminder: After each significant increment, append a note to the “Status Updates” section below so future sessions can resume with context._

## Open Questions / Follow-ups
- Precise keying strategy: Cognito user ID alone vs `(user_id, device fingerprint)` to support multiple simultaneous sessions?
- Maximum payload size and whether compression is needed.
- Should history remain inside the same JSON blob or move to its own table for analytics?
- Do we expose admin tooling to inspect/clear stuck input JSON rows?

## Status Updates & Learnings
- _2025-11-14_: CR drafted following discovery that multi-instance load balancing breaks the in-memory input JSON cache. Pending review/approval before starting Increment 1.
- _2025-11-14 (later)_: Reviewed both docbases and migration runners. We have two separate runners, but for this effort we’ll favour the admin-dashboard migration path so schema changes are logged in one place and rolled out via the existing admin deployment tooling. Portal docs still need updating after implementation; note to ensure both repositories mention the new table.
- _2025-11-14 (Increment 1 kick-off)_: Confirmed `iset_application_draft_dynamic` already stores partial drafts per user; new `input_json_state` table will be more transient (per-session, includes history) and can reuse similar JSON column patterns. Next step: draft concrete SQL migration (admin runner) with TTL-friendly indexes.
- _2025-11-14 (ephemeral lifecycle review)_: Re-read the current in-memory implementation: aggregate data lives in `intakeAggregateData`/`intakeStepData`, is cleared on logout, draft delete, submission, and automatically after ~30 minutes of inactivity. Reminder: the DB replacement must hook into those same lifecycle events and auto-expire rows so payloads never accumulate like long-lived drafts.
- _2025-11-14 (schema sketch)_: Locked column list (user/session IDs, workflow cursor, payload/history/doc refs JSON, checksum/version, timestamps, expires_at) and chose PK `(user_id, session_token)` for future multi-session support. TTL enforcement will rely on `expires_at` + scheduled purge job plus immediate deletes on logout/submission.
- _2025-11-14 (schema migration drafted)_: Added `sql/20251114_create_input_json_state.sql` (admin-dashboard runner) to create the transient `input_json_state` table with FK to `user`, PK `(user_id, session_token)`, JSON payload/history/doc refs, checksum/version fields, and an indexed `expires_at` for TTL purges.
- _2025-11-14 (migration retry note)_: First attempt to run the migration failed because MySQL disallows NULL columns in a primary key (our `session_token` defaulted to NULL). Updated the script so `session_token` is `NOT NULL DEFAULT ''`, keeping backward compatibility (single-session store) while preserving the composite key. Second restart applied the migration successfully.
- _2025-11-14 (Increment 2 in progress)_: ISET-intake server now reads/writes `input_json_state`: added repository helpers with TTL refresh/pruner, upgraded `/api/intake-json` GET/POST to persist/merge via DB, hydrate drafts/submission flows from the shared store, and hooked logout/draft-delete/submission purges into the new table. In-memory cache still exists for intra-process flows but DB is now the source of truth for load-balanced sessions.
- _2025-11-14 (docs update)_ : Admin docbase (`docs/features/public-portal-security-features.md`) now documents the shared `input_json_state` and TTL behaviour; portal docbase (`ISET-intake/docs/features/intake-form.md`) details how `/api/intake-json` leverages the new table and how drafts hydrate from it.
- _2025-11-14 (save-for-later purge tweak)_ : `/api/draft` now accepts `saveForLater` and purges both caches + `input_json_state` when the user explicitly saves and exits. The DELETE draft endpoint no longer clears the ephemeral store to match the ApplicationCard behaviour; TTL/background jobs still prevent stale rows.
- _2025-11-14_: Legacy `/api/save-draft` (Save & Finish Later path in current portal) now also clears `input_json_state` after persisting `iset_application_draft` so the DB-backed input JSON never lingers when the user returns to the dashboard.
- _2026-04-11_: Legacy portal draft recovery now has a rollout-gated step autosave path (`POST /api/draft/autosave`, runtime key `intake.draft_autosave`). `input_json_state` remains the transient source of truth during the wizard; autosave refreshes `iset_application_draft_dynamic` only after successful step transitions and is intended for code-first, flag-later rollout in PROD.

_(Add more entries chronologically as work proceeds.)_
