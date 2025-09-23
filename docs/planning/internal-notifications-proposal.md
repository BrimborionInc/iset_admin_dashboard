# Internal Notifications Proposal

Last updated: 2025-09-23

## Goal
Provide in-app notices for staff that mirror the existing Notification Settings configuration, using Cloudscape alerts for prominent reminders and the Flashbar for dismissible detail.

## Data Model
- `iset_internal_notification`
  - `id`, `severity`, `title`, `message`, `event_key`
  - `audience_type`: `role`, `user`, `global`
  - `audience_role` / `audience_user_id` (nullable depending on type)
  - `dismissible`, `requires_ack`, `starts_at`, `expires_at`, `created_by`
  - `delivered_at`, `metadata` (JSON payload for templating)
- `iset_internal_notification_dismissal`
  - `notification_id`, `user_id`, `dismissed_at`

## Backend Flow
1. **Configuration**: `notification_setting` continues to store enable/disable state per event/role (managed in Notification Settings widget).
2. **Event Trigger**: When an event fires (e.g. `case_assigned`), the dispatcher checks `notification_setting` and, if enabled for a role/user, creates rows in `iset_internal_notification`.
3. **Delivery**:
   - `GET /api/me/notifications` returns all active, non-dismissed notifications for the signed-in user (role + direct audience).
   - `POST /api/me/notifications/:id/dismiss` records the user’s dismissal.
4. **Counts**: expose an aggregate (e.g. `GET /api/me/notifications?summary=true`) for nav badges.

## Frontend Integration
- Move notification fetch into `AppContent` (or a provider) after auth resolves.
- Spread result into two channels:
  - **Banner**: render critical alerts as Cloudscape `<Alert>` at the top of the layout.
  - **Flashbar**: render the full list (excluding banner items or duplicates) in the existing Flashbar component.
- Keep notifications in React context for reuse (e.g. side nav badge, dedicated notifications page).
- Side nav placeholder uses the summary count; clicking it routes to `/manage-notifications` or opens a panel.

## Behavioural Notes
- Email dispatch remains aligned with `notification_setting.email_alert` (separate path).
- Dismissals are per user; role-wide alerts persist for other admins.
- Expired notifications (`expires_at`) are filtered server-side.

## Next Steps
1. Add the tables + migrations.
2. Extend event dispatcher to honour enabled settings and enqueue notifications.
3. Build the `GET/POST /api/me/notifications` endpoints.
4. Wire AppContent banner + Flashbar to the new API.
