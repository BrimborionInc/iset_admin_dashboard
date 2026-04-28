# Internal Notifications Overview

Last updated: 2026-04-27

## Goal
Provide staff with in-app notifications that mirror the Notification Settings matrix, using Cloudscape UI components for surfaced alerts and allowing per-role control via `notification_setting`.

## Data Model
- `iset_internal_notification`
  - `id`, `event_key`, `severity`, `title`, `message`
  - `audience_type` (`global` | `role` | `user`), `audience_role`
  - Typed direct-audience authority: `audience_actor_type`, `audience_staff_profile_id`, `audience_applicant_user_id`
  - The old physical `audience_user_id` shadow is retired in DEV by `20260427_0011`; do not reintroduce it for direct-audience routing
  - `dismissible`, `requires_ack`, optional `starts_at`/`expires_at`
  - `metadata` JSON payload (stores event/case identifiers), `created_by`, timestamps
- `iset_internal_notification_dismissal`
  - Surrogate `id` primary key, `notification_id`, typed viewer authority (`viewer_actor_type`, `viewer_staff_profile_id`, `viewer_applicant_user_id`), and `dismissed_at`
  - Unique typed viewer keys prevent a staff profile and applicant user with the same numeric ID from colliding on dismissals

## What's Implemented
1. **Configuration Bridge** - `notification_setting` now stores `bell_alert` per event/role. The shared dispatcher (`shared/events/notificationDispatcher`) queries these rows and inserts notifications when enabled.
2. **Event Hook** - `isetadminserver.js` registers the dispatcher with the shared event service, so emissions such as `application_submitted` and `case_assigned` can create bell notifications.
3. **API Surface** - `/api/me/notifications` returns active, non-dismissed notifications for the signed-in user (combining role and typed direct audiences). `/api/me/notifications/:id/dismiss` records typed per-viewer dismissals.
4. **Frontend Consumption** - `AppContent` fetches notifications during initial load (and when the auth session changes), renders dismissible items in a top-level `Flashbar`, and wires dismiss actions back to the API.

## Behavioural Notes
- Notifications are dismissible by default; a dismissal hides the entry for that user only.
- Staff direct notifications and dismissals use `staff_profiles.id`; applicant direct notifications and dismissals use shared `user.id`.
- Unresolved audiences (e.g. a role entry without an assigned user) are skipped gracefully.
- Severity is mapped to Flashbar variants (`info`, `success`, `warning`, `error`).
- Expiry filtering happens in SQL; expired rows are not returned to clients.

## Remaining Enhancements
- Expose a lightweight summary endpoint (nav badge counts) when the UI is ready.
- Support non-dismissible/ack-required alerts if workflow needs escalate (requires UI affordances).
- Add richer metadata to the client (e.g. deep links to cases) once the dispatcher populates `metadata` consistently.
- Evaluate batching or pagination if notification volume grows beyond the current use cases.
