# Manage Notifications Dashboard

Last updated: 2026-05-01

> **Quick patch (2025-10-02):** Applicant email alerts for submissions, secure messages, and decisions are temporarily hardwired while the dashboard toggles remain read-only.

## Widgets

### Notification Settings
- Combines `/api/events`, `/api/roles`, `/api/templates`, and `/api/notifications`, normalising responses before rendering.
- Backend template, notification matrix, and sender-settings APIs are restricted to System Administrator and NWAC Administrator roles; frontend route gating is not the only access control.
- Stores the PATH SES sender settings in `iset_runtime_config` (`scope='notifications'`, `k='path.email'`) so PATH-generated emails share one configurable `From` address, display name, and `Reply-To` across the admin dashboard and portal.
- Sender and `Reply-To` email identities are trimmed and validated but their casing is preserved, because SES email identity verification can be case-sensitive in sandboxed DEV testing.
- Roles are hydrated with `value`/`label` pairs; legacy `PTMA Staff` entries map to `Application Assessor`, and the synthetic `Applicant` row is injected when the API omits it so applicant toggles stay visible.
- Each row captures `enabled`, `template_id`, `email_alert`, and `bell_alert`; the Save action only posts rows whose state changed and refreshes from the API so new IDs or template edits flow through immediately.
- Success and error states surface through a `Flashbar`, and the Cancel button restores the last-saved matrix snapshot without reloading the page.

### Configure Notifications (disabled)
- The original reminder configuration widget is still commented out in the board definition for future use.

## Behavioural Notes
- Default language remains `en`; additional locales require widening both the admin API (template/settings queries) and the widget wiring.
- Role comparisons rely on canonical string values. Ensure backend payloads emit the normalised keys used in the widget (`ApplicationAssessor`, `applicant`, etc.).
- The side-navigation footer item labelled `Notifications` is not a link to this dashboard. It is a signed-in shell control that refreshes the current user's bell alerts, so it stays visible even when the route access matrix does not allow `/manage-notifications`.
- Templates are optional. When none is selected the backend stores `NULL`; bell notifications continue to use stock text, while email delivery suppresses that event/role until a template is assigned.
- `bell_alert` toggles drive staff-facing internal notifications via `shared/events/notificationDispatcher`. `email_alert` now drives staff SES delivery from the same `notification_setting` + `notification_template` rows, using the shared runtime sender settings stored in `iset_runtime_config`.
- Staff email delivery is generic for non-assignment events. NWAC review notifications are split into `nwac_review_approved`, `nwac_review_denied`, and `nwac_review_changes_requested` so each outcome can have its own role routing and template. Enabled staff rows with `email_alert=1` and a renderable template resolve recipients from the configured role/audience, case assignee context, and case watchers where the `ISET Coordinator` row applies. Recipients are deduplicated by staff profile/email so duplicate settings or overlapping audiences do not create duplicate sends.
- The renderer also prefers enabled email rows with an assigned template when duplicate event/role/language settings exist, so stale disabled duplicates do not suppress an active configured row.
- TEST remains protected from real SES delivery by the TEST post-load blocker that clears `email_alert` values, plus a SES runtime guard for TEST environment markers / TEST DB hosts. DEV may send through SES when settings are enabled and SES sandbox identities are verified.
- When the runtime config leaves sender name blank, PATH falls back to `NWAC PATH`. When the runtime config leaves `Reply-To` blank, PATH falls back to the support mailbox env vars if present (`NOTIFICATION_SUPPORT_EMAIL`, `SUPPORT_EMAIL`, `DEFAULT_SUPPORT_EMAIL`).
- `Auto assigned`, `Case assigned`, and `Case reassigned` are separate configurable events. `Auto assigned` is for system-driven assignment, `Case assigned` is for manual first assignment, and `Case reassigned` is for manual reassignment.
- For those assignment-family events, email recipients are the actual assignee plus any case watchers. The assignee uses the template row for their real staff role, while watchers use the `ISET Coordinator` row for that event.
- Bell-alert headings now append the notification timestamp using `delivered_at` when present and otherwise `created_at`, formatted in the current viewer browser timezone with `America/Toronto` fallback. This is display-only; staff/applicant timezone preferences are not yet stored in PATH.
- When a template is assigned the intake service reads the `localized` JSON blob (English + French bodies) and picks the applicant’s preferred language. Leave both language blocks populated to ensure bilingual delivery; missing translations automatically fall back to English and log the fallback.

## Follow-ups
- Add an inline refresh button so administrators can rehydrate the matrix without reloading the board.
- Surface template audience/language metadata in the select once multi-language support lands.
- Auto-refresh the settings widget after template saves or creations so newly added templates appear without a manual reload.
- Hook any remaining applicant-specific email pipelines to the stored `email_alert` and `template_id` values.
- Template authoring now lives on the dedicated Template Editor dashboard (`/template-editor`). Link from here after saving changes so configuration stays in sync.
