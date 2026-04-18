# Manage Notifications Dashboard

Last updated: 2026-04-18

> **Quick patch (2025-10-02):** Applicant email alerts for submissions, secure messages, and decisions are temporarily hardwired while the dashboard toggles remain read-only.

## Widgets

### Notification Settings
- Combines `/api/events`, `/api/roles`, `/api/templates`, and `/api/notifications`, normalising responses before rendering.
- Stores the PATH SES sender address in `iset_runtime_config` (`scope='notifications'`, `k='path.email'`) so PATH-generated emails share one configurable `From` address across the admin dashboard and portal.
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
- `bell_alert` toggles drive staff-facing internal notifications via `shared/events/notificationDispatcher`. `email_alert` now drives assignment and reassignment SES delivery from the same `notification_setting` + `notification_template` rows, using the shared runtime sender address stored in `iset_runtime_config`.
- For `Case assigned` and `Case reassigned`, email recipients are the actual assignee plus any case watchers. The assignee uses the template row for their real staff role, while watchers use the `ISET Coordinator` row for that event.
- Bell-alert headings now append the notification timestamp using `delivered_at` when present and otherwise `created_at`, formatted in the current viewer browser timezone with `America/Toronto` fallback. This is display-only; staff/applicant timezone preferences are not yet stored in PATH.
- When a template is assigned the intake service reads the `localized` JSON blob (English + French bodies) and picks the applicant’s preferred language. Leave both language blocks populated to ensure bilingual delivery; missing translations automatically fall back to English and log the fallback.

## Follow-ups
- Add an inline refresh button so administrators can rehydrate the matrix without reloading the board.
- Surface template audience/language metadata in the select once multi-language support lands.
- Auto-refresh the settings widget after template saves or creations so newly added templates appear without a manual reload.
- Hook the remaining applicant and non-assignment staff email pipelines to the stored `email_alert` and `template_id` values.
- Template authoring now lives on the dedicated Template Editor dashboard (`/template-editor`). Link from here after saving changes so configuration stays in sync.
