# Reminder Events Plan

## Purpose
- Add event visibility and notification control for case reminders created via notes/tasks in the admin app.
- Keep timelines/audit concise: emit only lifecycle transitions, not recurring “today/overdue” spam.

## Proposed Event Category
- **reminders**
  - `reminder_created` – emitted when a note/task with follow-up is saved.
  - `reminder_due` – emitted once when the reminder’s date/time is reached (e.g., “due today”).
  - `reminder_overdue` – emitted once when the due date has passed and the reminder is still open (optional but recommended for admin visibility).
  - `reminder_completed` – emitted when the reminder is marked done/closed.

## Emission Points (backend)
- `reminder_created`: notes/tasks endpoint when `follow_up_at` (or equivalent) is set/updated.
- `reminder_due`: scheduled check (e.g., every 5–15 minutes) to find open reminders whose due time is now/past and not yet emitted as due.
- `reminder_overdue`: first detection of open reminders past due_at (can be combined with the due check; emit only once).
- `reminder_completed`: reminder close/delete endpoints; also when the parent note/task is hard-deleted.

## Payload Shape (captureCaseEvent)
- Common fields: `reminder_id`, `case_id`, `application_id` (if available), `note_id`/`task_id` (if applicable), `due_at`, `title/summary`, `is_pinned`, `created_by` (if available).
- `reminder_due`/`reminder_overdue`: include `overdue_reason` only if we distinguish due vs overdue in notifications.
- `reminder_completed`: include `completed_at`, `completed_by`.

## Notifications
- Add reminder event types to the notification settings if alerts are needed:
  - `reminder_due` (applicant/staff?) – likely staff only.
  - `reminder_overdue` (staff).
- Keep capture toggles authoritative; if capture is disabled, notifications won’t fire.

## UI Impact
- Event Capture dashboard: add “Reminders” category with the above types; toggles per type.
- ApplicationEvents timeline: will show reminder lifecycle transitions with concise messages.
- CaseCalendarWidget: continues to derive “Due today/Overdue/Coming up” from reminders directly (no change); events are for audit/notifications, not for UI calculations.

## Notes
- Emit each type once per reminder lifecycle stage to avoid duplicates.
- Guard scheduled emits with idempotency (e.g., store last_emitted flags).
- Keep messaging consistent: “Reminder created”, “Reminder due today”, “Reminder overdue”, “Reminder completed”.
