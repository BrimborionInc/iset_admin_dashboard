# Secure Messaging Integration (2025-09-25)

## Overview
Secure messaging is shared between the public intake portal and the admin dashboard. Messages live in the shared MySQL database (`iset_intake.messages`) so both applications can render the same threads. A case-bound message must carry enough metadata for either side to resolve the applicant, case and submission tracking reference.

## Database Fields
- `messages.case_id` — nullable link to `iset_case.id`. Added in migration `20250925_add_case_columns_to_messages.sql`.
- `messages.application_id` — nullable link to `iset_application.id` for cases where the row is known but a case has not yet been generated.
- `message_attachment.case_id` — mirrors the owning message to support document adoption.
- `iset_document.origin_message_id` — records the original message when an attachment is promoted into the case file.

When both `case_id` and `application_id` exist the portal can recover the booking reference (`iset_application_submission.reference_number`) and display it in the message details view.

## Message Flow
1. **Admin dashboard** sends a message via `POST /api/cases/:id/messages`.
   - The handler resolves the case, applicant user id, and application id.
   - Inserts into `messages` with `case_id`, `application_id`, and standard fields (`sender_id`, `recipient_id`, `subject`, `body`, etc.).
2. **Applicant portal** reads messages through `/api/messages/:id`.
   - Joins `messages` -> `iset_case` -> `iset_application` -> `iset_application_submission` to grab the booking reference.
   - Response includes `tracking_id`, allowing the UI to show "Booking reference" in the summary list.
3. **Attachments** continue to adopt into `iset_document` when the admin widget hits `/api/admin/messages/:id/attachments?case_id=...`.
   - Adoption now uses the stored `case_id` and `application_id`, so repeat openings repair missing metadata.

## UI Behaviour (2025-09-25)
- **Admin SecureMessagingWidget** requires a case context. It filters messages to the active case and can compose new replies. Because the backend now writes the case/application fields, all new messages satisfy the portal join requirements.
- **Applicant MessageDetails page** renders a "Booking reference" row whenever `tracking_id` is present. With the new joins, any admin-originated message tied to a case displays that reference.

## Operational Notes
- Data purges should clear both `message_attachment` and `messages` (in that order) and optionally `iset_document` rows with `source='secure_message_attachment'`.
- Environments must keep `messages.case_id` populated for staff replies; otherwise booking references disappear from the applicant view.
- For applicants composing new messages directly in the portal, future work should ensure the composer forces selection of a case so the same metadata is captured.

## Open Questions
- Do we ever allow applicant-initiated messages outside of an active case? If not, the portal composer should be disabled until a submission exists.
- Should we expose audit history (who sent what) in the admin UI beyond the current direction flag?
- Should booking references also appear in the admin widget list rows for quick scanning?
