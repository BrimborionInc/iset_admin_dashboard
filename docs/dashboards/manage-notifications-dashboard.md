# Manage Notifications Dashboard

Last updated: 2025-10-01

> **Quick patch (2025-10-02):** Applicant email alerts for submissions, secure messages, and decisions are temporarily hardwired while the dashboard toggles remain read-only.

## Widgets

### Notification Settings
- Combines `/api/events`, `/api/roles`, `/api/templates`, and `/api/notifications`, normalising responses before rendering.
- Roles are hydrated with `value`/`label` pairs; legacy `PTMA Staff` entries map to `Application Assessor`, and the synthetic `Applicant` row is injected when the API omits it so applicant toggles stay visible.
- Each row captures `enabled`, `template_id`, `email_alert`, and `bell_alert`; the Save action only posts rows whose state changed and refreshes from the API so new IDs or template edits flow through immediately.
- Success and error states surface through a `Flashbar`, and the Cancel button restores the last-saved matrix snapshot without reloading the page.

### Manage Templates
- Sits beside the settings matrix for quick edits to notification/reminder templates.
- Uses the shared API client (`apiFetch`) to list, load, update, and delete templates; changes become available to the settings widget after its next refresh.

### Configure Notifications (disabled)
- The original reminder configuration widget is still commented out in the board definition for future use.

## Behavioural Notes
- Default language remains `en`; additional locales require widening both the admin API (template/settings queries) and the widget wiring.
- Role comparisons rely on canonical string values. Ensure backend payloads emit the normalised keys used in the widget (`ApplicationAssessor`, `applicant`, etc.).
- Templates are optional. When none is selected the backend stores `NULL`; dispatchers fall back to stock messaging until template rendering is implemented.
- `bell_alert` toggles currently drive staff-facing internal notifications via `shared/events/notificationDispatcher`. `email_alert` values are persisted for each role/event and will power SES delivery once the intake service hooks into the same configuration.

## Follow-ups
- Add an inline refresh button so administrators can rehydrate the matrix without reloading the board.
- Surface template audience/language metadata in the select once multi-language support lands.
- Auto-refresh the settings widget after template saves or creations so newly added templates appear without a manual reload.
- Hook the applicant/staff email pipelines to the stored `email_alert` and `template_id` values (tracked separately in the intake service).
