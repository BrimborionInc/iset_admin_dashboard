# Internal Notifications Overview

Last updated: 2025-10-01

## Goal
Provide staff with in-app notifications that mirror the Notification Settings matrix, using Cloudscape UI components for surfaced alerts and allowing per-role control via `notification_setting`.

## Data Model
- `iset_internal_notification`
  - `id`, `event_key`, `severity`, `title`, `message`
  - `audience_type` (`global` | `role` | `user`), `audience_role`, `audience_user_id`
  - `dismissible`, `requires_ack`, optional `starts_at`/`expires_at`
  - `metadata` JSON payload (stores event/case identifiers), `created_by`, timestamps
- `iset_internal_notification_dismissal`
  - Composite primary key on `(notification_id, user_id)` plus `dismissed_at`

## What's Implemented
1. **Configuration Bridge** - `notification_setting` now stores `bell_alert` per event/role. The shared dispatcher (`shared/events/notificationDispatcher`) queries these rows and inserts notifications when enabled.
2. **Event Hook** - `isetadminserver.js` registers the dispatcher with the shared event service, so emissions such as `application_submitted` and `case_assigned` can create bell notifications.
3. **API Surface** - `/api/me/notifications` returns active, non-dismissed notifications for the signed-in user (combining role and direct audiences). `/api/me/notifications/:id/dismiss` records per-user dismissals.
4. **Frontend Consumption** - `AppContent` fetches notifications during initial load (and when the auth session changes), renders dismissible items in a top-level `Flashbar`, and wires dismiss actions back to the API.

## Behavioural Notes
- Notifications are dismissible by default; a dismissal hides the entry for that user only.
- Unresolved audiences (e.g. a role entry without an assigned user) are skipped gracefully.
- Severity is mapped to Flashbar variants (`info`, `success`, `warning`, `error`).
- Expiry filtering happens in SQL; expired rows are not returned to clients.

## Remaining Enhancements
- Expose a lightweight summary endpoint (nav badge counts) when the UI is ready.
- Support non-dismissible/ack-required alerts if workflow needs escalate (requires UI affordances).
- Add richer metadata to the client (e.g. deep links to cases) once the dispatcher populates `metadata` consistently.
- Evaluate batching or pagination if notification volume grows beyond the current use cases.
