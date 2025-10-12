# Record Locking (Admin Dashboard)

The dashboard now combines **pessimistic locks** with the existing optimistic concurrency checks to protect ISET application records. This document summarises how the pieces fit together, where the configuration lives, and how to test common scenarios.

---

## 1. High-level model

1. **Optimistic guard**  
   Every application row uses `row_version`. Save and restore endpoints require the client to send the version it last read and return `409 row_version_conflict` if another writer won the race.

2. **Pessimistic session lock**  
   When pessimistic mode is on, writers must acquire an entry in the `application_lock` table before mutating an application or case. API handlers respond with `423 Locked` when the caller does not own the row.

3. **Runtime knobs**  
   System administrators can toggle pessimistic mode and tune the TTL/heartbeat from **Configuration → Record Locking**. The backend serves these values from `iset_runtime_config`.

---

## 2. Schema & migrations

| Table/Column                     | Purpose                                                                |
|---------------------------------|------------------------------------------------------------------------|
| `iset_application.row_version`  | Optimistic concurrency token (auto-incremented on every write).       |
| `application_lock`              | Pessimistic lock record per application (`owner_*`, `acquired_at`, `expires_at`, optional JSON `metadata`). |

Migrations:

- `sql/20251011_add_application_row_version.sql`
- `sql/20251011_create_application_lock.sql`

The migration runner remains idempotent—replays simply skip duplicate column/table errors.

---

## 3. Runtime configuration

Endpoint: `GET /api/config/runtime/locking`

Example response:

```json
{
  "mode": "pessimistic",
  "lockTtlMinutes": 15,
  "heartbeatMinutes": 2,
  "source": "stored"
}
```

- `mode`: `"optimistic"` (pessimistic off) or `"pessimistic"` (both layers enforced).
- `lockTtlMinutes`: server-side expiry window. Locks are released automatically when the clock runs out.
- `heartbeatMinutes`: optional interval for re-acquiring/refreshing a lock while a user keeps the editor open.

`PATCH /api/config/runtime/locking` accepts the same shape. Only System Administrators may update it.

---

## 4. Backend request flow

### 4.1 Lock acquisition API

- `POST /api/locks/application/:id`
  - Body: optional `{ "ttlMinutes": 20, "force": true }`
  - Success: `200 { success: true, lock: { ...normalized metadata... } }`
  - Failure: `423` (`{ error: 'locked', reason: 'owned_by_other', lock: {...} }`) or `400 lock_identity_missing`
  - Side effects:
    * Validates staff identity (`resolveLockIdentity`).
    * Deletes expired locks before claiming a new one.
    * Force option available only to SysAdmins.

- `DELETE /api/locks/application/:id`
  - Releases the current owner’s lock, or force deletes when permitted.
  - Returns `423` if another user owns the lock and force is not set.

Locks are stored with `owner_user_id`, `owner_display_name`, `owner_email`, and `expires_at`. TTL enforcement happens in SQL using `NOW()` comparisons.

### 4.2 Enforcement

`enforceApplicationLock(connection, applicationId, req, lockConfig)` performs the guard inside every write transaction (save draft, restore version, case status changes, assessment updates, etc.). Failure paths:

| Reason             | Response           | Notes                                       |
|--------------------|--------------------|---------------------------------------------|
| `not_required`     | allowed            | Pessimistic mode disabled.                  |
| `identity_missing` | 423 / `lock_identity_missing` | Staff identity headers missing.            |
| `missing/expired`  | 423 / `lock_required`        | Lock must be reacquired.                    |
| `owned_by_other`   | 423 / `locked`             | Someone else owns the lock; payload contains holder metadata. |

All write handlers still return `409 row_version_conflict` if the optimistic token mismatches after the lock check succeeds.

### 4.3 Lock metadata propagation

- `GET /api/applications/:id`, `GET /api/cases/:id` and list endpoints include `lock_owner_*` fields and `lock_expires_at` so the UI can render availability badges without an extra call.

---

## 5. Frontend implementation

### 5.1 Shared hook

`src/hooks/useApplicationLock.js`

Features:

- `acquireLock({ force, ttlMinutes })`, `releaseLock({ force })`, and `refreshLock()`.
- Normalises lock payloads from the API and exposes `lockState` (status, lock, error, reason, ownership flags).
- Auto-heartbeat using `window.setInterval` when `autoHeartbeat` is enabled and the current user owns the lock.
- Cleans up on unmount and when navigating between application IDs.
- Utility helpers like `buildLockConflictMessage` (consistent user messaging) and `formatLockOwner`.

### 5.2 Widgets using the hook

- **Application form (`IsetApplicationFormWidget`)**  
  Acquires a lock before entering edit mode, keeps the heartbeat alive while editing, releases on save/cancel, and responds to `423/409` by showing flashbars and reloading.

- **Coordinator assessment (`CoordinatorAssessmentWidget`)**  
  Blocks edit/submit actions when another user holds the lock, presents a banner while locked, and releases once the workflow finishes.

- **Application overview (`ApplicationOverviewWidget`)**  
  Disables status changes when the lock belongs to someone else, and surfaces the lock holder in the info alert.

- **Applications list (`ApplicationsWidget`)**  
  Renders a lock status column and now disables Assign/Reassign actions when a different user owns the lock, showing inline context.

- **Helper hook (`useCurrentUser`)**  
  Shared utility that reads `/api/auth/me` (with dev fallbacks) so components can compare lock ownership without duplicating fetch logic.

### 5.3 Error UX

- API `423` responses are translated via `buildLockConflictMessage` so all widgets show consistent copy (“Locked by Alex — expires 2:15 PM”).
- `ApplicationsWidget` also posts a dismissible alert if a user attempts a blocked assignment.

---

## 6. Configuration UI

Path: `src/pages/configurationSettings.js`

- Adds a **Record Locking** card with mode selector, TTL and heartbeat inputs.
- Pulls current values via `/api/config/runtime/locking` and displays validation feedback (positive numbers, heartbeat ≤ TTL).
- Save and Reset buttons honour dirty state and deal with loading/error scenarios.
- Help panel content updated (`lockingSettingsHelp.js`) to explain both modes and the effect of each input.

---

## 7. QA checklist

1. **Lock acquisition & release**
   - Session A: open an application, click *Edit*. Verify lock alert shows your name.
   - Session B: attempt *Edit* → expect info banner and API `423`.
   - Session A: Save or Cancel → lock disappears. Session B can now edit.

2. **Heartbeat**
   - Stay in edit mode past the configured heartbeat. Observe `/api/locks/application/:id` re-acquisitions in the network panel and TTL extending server-side.

3. **Expiry**
   - Shorten TTL via config (e.g., 1 minute). Acquire lock, wait for expiry, confirm backend removes row and UI messaging prompts re-acquisition.

4. **Applications list gating**
   - While Session A holds the lock, check the Applications list in Session B: Assign/Reassign buttons disabled, tooltip text shows “Locked by …”.

5. **Config UI**
   - Change mode to Optimistic-only, save, then verify writes succeed without calling the lock endpoints.
   - Switch back to Pessimistic, adjust TTL/heartbeat, confirm new values present in subsequent lock payloads.

6. **Force release**
   - As SysAdmin, call `DELETE /api/locks/application/:id?force=true` (e.g., via Postman) and ensure the lock clears even when another user owns it.

---

## 8. Follow-ups / ideas

- Add a dedicated heartbeat endpoint (`PATCH /api/locks/application/:id/heartbeat`) to avoid full re-acquisition.
- Extend lock metadata (`metadata` JSON) with tab/session IDs to help with stale browser recovery.
- Consider surfacing lock owner info in other edit-capable widgets (attachments, tasks).
- Add automated API tests for lock lifecycle and UI integration tests once the pipeline supports multi-session flows.
