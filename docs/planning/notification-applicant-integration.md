# Applicant Notification Enablement Plan

## Goal
Extend the Manage Notifications dashboard so administrators can configure notification delivery for applicants alongside internal staff, while keeping the existing data model as simple as possible.

## Current State
- Notification matrix only lists staff roles pulled from the `role` table.
- `notification_setting` rows are keyed on `{event, role, language, enabled, template_id, email_alert}`.
- Applicant-facing notifications (secure messages, emails) are triggered ad hoc with no central toggles.
- New `description`/`sort_order` metadata now exists on `iset_event_type`.

## Revised Approach
Treat the applicant as a synthetic “role” inside the existing table instead of introducing new `audience` or `channel` columns.

### Data Model
- Seed a literal `role = 'applicant'` entry wherever we need to control applicant notifications.
- Continue to store staff roles using `role.RoleName`; document that `role` can either reference a staff role or the literal `applicant`.
- Keep using `email_alert` to indicate whether an email should accompany the message; secure messaging remains the default channel for both staff and applicants.

### Event Coverage
- Reuse the existing event taxonomy (now enriched with descriptions and ordering).
- Decide which events should surface to applicants (e.g., `application_submitted`, `case_assigned`, `document_uploaded`, etc.) and create default settings for `role='applicant'`.

### Widget UX
- Group rows by audience:
  * **Staff roles** – current behaviour.
  * **Applicant** – single row representing the synthetic role.
- Controls per row:
  * Enable toggle.
  * Template selector (secure message/email share the same content for now).
  * Email toggle (reuses existing `email_alert` flag).
- Consider adding visual cues for channel (icons/badges) even though the backend logic is implicit.

### API / Backend Work
- Ensure `/api/notifications` returns any rows where `role='applicant'`.
- When saving, allow `role='applicant'` to pass validation (no foreign key).
- Seed applicant rows via migration so the widget shows defaults immediately.

### Delivery Workflow
- Update the intake-side dispatcher so when an event fires it:
  * Finds staff rows (existing behaviour).
  * Finds applicant rows and, when enabled, sends secure messages and optional emails to the applicant tied to the event/application.
- For future portal alerts, we can extend the dispatcher later without changing the saved settings.

### Portal Experience (Future)
- When we want dismissible alerts inside the public portal, plan a small notification table/API (`iset_portal_alert` + `/api/me/notifications`) and render it in the applicant dashboard.

### Templates
- Add applicant-friendly templates to the existing catalogue (flag them by audience in naming/description).
- Ensure SES/secure message rendering paths can pick the right template based on `role`.

## Implementation Notes
1. Migration to seed `notification_setting` rows for `role='applicant'` across the key events (with sensible defaults for secure message + email).
2. Update `/api/notifications` handlers to accept/save the literal applicant role.
3. Adjust the widget to display the synthetic role, keeping all other UI logic intact.
4. Extend the intake notification dispatcher to honour applicant rows (secure message + optional email).
5. Optional: design portal alert feature before enabling that channel.

## Next Steps
1. Draft migration seeding applicant rows in `notification_setting`.
2. Update admin server `/api/notifications` validation (allow `role='applicant'`).
3. Modify the widget to show the applicant row and tweak labels/tooltips accordingly.
4. Wire up intake service delivery for applicant notifications.
5. Plan portal alert UX (if required for MVP).
