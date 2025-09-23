# Manage Notifications Dashboard

Last updated: 2025-09-23

## Widgets

### Notification Settings
- Combines `/api/events`, `/api/roles`, `/api/templates`, and `/api/notifications`, normalising responses before rendering.
- Roles are hydrated with `value`/`label` pairs; legacy `PTMA Staff` entries map to `Application Assessor`, and the synthetic `Applicant` row is appended (default disabled, no template, no email alert) when the API doesn't return it.
- All network calls flow through `apiFetch`, so Cognito bearer tokens or dev bypass headers are attached automatically.
- Save operations post only rows that changed and refresh the matrix to pick up new IDs; success or failure messages appear via `Flashbar`.

### Manage Templates
- Available alongside the settings matrix for quick template edits.
- Uses the shared API client for optimistic updates; see `manageTemplates.js` for schema details.

### Configure Notifications (disabled)
- The legacy configuration widget remains commented out in the board definition for future re-enablement.

## Behavioural Notes
- Default language remains `en`; supporting additional locales requires expanding both backend queries and UI wiring.
- Role comparisons rely on string equality—ensure backend payloads emit the canonical `role.value`.
- Templates are optional; toggles can be saved without a selected template.
- Event descriptions live in `iset_event_type.description`; migration 20250924 seeds blank defaults.

## Follow-ups
- Add a lightweight refresh action once granular endpoints exist.
- Surface template metadata (language/type) in the select when multi-language support lands.
- Hook template creation so the settings widget refreshes automatically after saves.
