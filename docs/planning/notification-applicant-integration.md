# Applicant Notification Enablement Plan

Last updated: 2025-10-01

> **Quick patch (2025-10-02):** Temporarily hardwired applicant emails for submission receipts, new secure messages, and decision outcomes while we prepare the configurable pipeline.

## Goal
Keep applicant-facing notifications configurable from the same matrix used for staff, letting administrators toggle delivery per event/role and choose templates for secure messages and companion emails.

## Current Implementation
- The Notification Settings widget already renders applicant rows alongside staff roles. Legacy PTMA values are normalised to `ApplicationAssessor`, and a synthetic `applicant` row is injected if the API response omits it.
- `/api/notifications` accepts and returns applicant entries; the persisted settings capture `{ event, role, language, enabled, template_id, email_alert, bell_alert }`.
- `bell_alert` flags drive staff-facing in-app notifications through `shared/events/notificationDispatcher`, which fans out to `iset_internal_notification`.
- `email_alert` values are stored but not yet consumed; applicant confirmations (and other outbound emails) still need to source their content from these settings and templates.

## Configuration Model
- Applicant rows live in `notification_setting` with `role = 'applicant'`, sharing the existing composite key.
- Templates remain optional. When `template_id` is `NULL`, downstream services should fall back to stock messaging until template rendering ships.
- Default language support is limited to `en`. Additional locales require schema/API extensions and UI updates.

## Delivery Roadmap
1. **Submission Confirmations** - Update the intake service so `application_submitted` checks `notification_setting` for both applicant and staff roles, respecting `enabled`, `email_alert`, and `template_id`.
2. **Template Rendering** - Introduce a renderer that can merge template content with event metadata (tracking IDs, applicant names, etc.) for both secure messaging and email channels.
3. **Secure Messaging** - Align the secure message body with the chosen template when `enabled = 1`, falling back gracefully when no template is selected.
4. **Portal Alerts (Future)** - If we expose in-portal toasts for applicants, plan a dedicated table/API (e.g. `iset_portal_notification`) that references the same configuration.

## Implementation Plan
1. **Confirm Configuration Contract** - Keep the Notification Settings widget and `/api/notifications` as the source of truth for `{ event, role, enabled, email_alert, template_id }`; note any schema tweaks before wiring delivery so intake relies on a stable contract.
2. **Template Strategy** - Audit `notification_template` entries to agree on the rendering shape (HTML + text bodies, placeholder tokens). Document supported variables (tracking ID, applicant name, submission date) so templates stay predictable.
3. **Intake Resolver** - In the intake service, replace the removed hard-coded confirmation with a resolver that loads `notification_setting` rows for `application_submitted`, filters to enabled entries, fetches templates, and renders email content before calling `sendNotificationEmail`.
4. **Fallback Behaviour** - When a row has `email_alert = 1` but no template assigned, reuse the existing stock message so confirmations still go out. Log a warning to encourage template assignment.
5. **Test Coverage** - Add a small harness (unit test or script) that simulates a submission, stubs SES, and asserts the resolver honours the stored settings/template.
6. **Iterate to More Events** - After `application_submitted` is live, repeat the pattern for other applicant/staff events (document uploads, case assignments) by toggling the corresponding rows in `notification_setting`.

## Outstanding Work
- Seed sensible defaults for `role='applicant'` across key events (via migration or bootstrap script) so new environments expose toggles without manual setup.
- Wire the intake-side dispatchers (submission confirmation, document upload alerts, etc.) to consult `notification_setting` before sending emails.
- Add smoke/acceptance tests that exercise the applicant flow end-to-end once the email pipeline is connected.

## Collaboration Notes
- Context: Hard-coded applicant confirmation emails were removed from the intake service; delivery must now respect `notification_setting` and templates configured via the admin dashboard.
- SES: account still sandboxed in ca-central-1; use verified sender/recipient for all testing and keep the sandbox redirect in `sesMailer` until production access is granted.
- Admin configuration:
  - Notification Settings widget persists `{event, role, enabled, template_id, email_alert, bell_alert}` and normalises legacy roles (PTMA -> ApplicationAssessor, synthetic applicant row).
  - `/api/notifications` endpoints (GET/POST/DELETE) are the sole contract for stored settings.
  - Manage Templates widget is functional but needs UX polish; templates provide HTML + text bodies for notifications and will power email content once wired through intake.
- Intake plan overview:
  1. Build a resolver in the intake service for each event (starting with `application_submitted`) that loads settings, filters for enabled `email_alert` rows, grabs templates, renders content, and sends via SES.
  2. Provide fallback copy when templates are not selected; log warnings to ease debugging.
  3. Expand coverage to other events after submission flow is proven.
- Template editor upgrade goals:
  - First pass implemented: toolbar buttons for bold/italic/underline, list helpers, link insertion, portal link shortcut, expanded placeholder palette (`{tracking_id}`, `{portal_dashboard_url}`, `{support_email}`, `{assessor_name}`), inline Flashbar feedback, and save validation. Link prompts presently use `window.prompt`; plan a richer dialog later.
  - Session-backed draft cache added so in-progress edits survive dashboard refreshes (even without a recurring notification poll).
  - Add rich-text controls (bold, italic, underline, lists, link insertion) to make HTML authoring practical.
  - Expand "Insert Field" palette (tracking ID, applicant name, portal link, submission date, etc.) and ensure tokens align with the rendering engine.
  - Improve UX: inline save confirmations, validation, reload notification settings after template changes, preserve edits when switching rows.
  - Focus on email channel first; SMS/robocall options deliberately deferred.
- Outstanding decisions/questions:
  - Finalise placeholder token syntax and how templates reference portal URLs or other dynamic data.
  - Define default enabled states for applicant/staff email alerts once resolver is live.
  - Determine how to surface template/render errors to admins (logs vs UI alert).
- Next concrete tasks (tracked in this chat):
  1. Audit existing template editor implementation to understand component options and API gaps.
  2. Implement first wave improvements (rich-text toolbar, expanded insert fields, save UX enhancements).
  3. Wire intake resolver to consume configured templates for applicant submission confirmations.
