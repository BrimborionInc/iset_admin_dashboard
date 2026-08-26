# Secure Messaging Integration

Updated: 2026-08-25

## Overview
Secure messaging is shared between the public intake portal and the admin dashboard. Messages live in the shared MySQL database (`iset_intake.messages`) so both applications can render the same case thread.

The current model is case-thread scoped, with optional application scope only when the user deliberately performs an application-owned operation such as sending a managed form. A secure message is not treated as a personal applicant-to-assigned-staff mailbox item. It must belong to the applicant's case, carry typed actor fields, and contain exactly one applicant actor. Historical typed actors remain the authority for reading or replying to an existing conversation; a later case-account relink does not rewrite that history.

## Database Fields
- `messages.case_id`: required link to `iset_case.id`.
- `messages.application_id`: optional link to `iset_application.id` when the send itself is deliberately application scoped. Ordinary case-thread messages remain applicationless even if the case has applications.
- `messages.sender_actor_type` / `recipient_actor_type`: one of `applicant_user`, `staff_profile`, `local_user`, or `system`.
- `messages.sender_user_id` / `recipient_user_id`: shared `user.id` actor values used for applicant/local-user mailbox state and staff compatibility.
- `messages.sender_staff_profile_id` / `recipient_staff_profile_id`: `staff_profiles.id` for staff actors.
- `message_item.message_id` / `owner_user_id`: per-user mailbox state for the typed message participants.
- `message_attachment.message_id`, `case_id`, `client_id`, `application_id`, `user_id`: attachment lineage before adoption into the document model.
- `iset_document.origin_message_id`: original message when a secure-message attachment is promoted into the case file.
- `message_send_operation`: optional client-operation ledger for staff sends. Its unique scope is the resolved shared-user sender, case, and client operation ID; it stores the canonical request hash and the original committed response/message link.

## Constraints
As of migration `20260426_0007_harden_secure_message_scope_constraints.sql` in DEV:

- `messages.case_id`, `sender_actor_type`, and `recipient_actor_type` are required.
- CHECK constraints require valid typed sender/recipient actor fields.
- A message must have exactly one applicant actor.
- Typed actor FKs use `ON DELETE RESTRICT` so actor deletion cannot silently detach message history.
- `message_attachment.case_id`, `client_id`, and `user_id` are required.
- `message_attachment.message_id` cascades when a message is deleted; attachment case/application/client/user parents are protected by `RESTRICT`.
- `secure_message_attachment` documents require proven case/client/applicant/uploader/origin-message ownership. Application lineage is optional compatibility evidence, not a precondition for reading an authorized historical attachment.
- Migration `20260825_0002_add_secure_message_send_idempotency.sql` adds the exact `message_send_operation` shape through its dedicated checksum-pinned executor. Runtime readiness requires the full table contract before the admin server starts.

## Durable Staff Send Retry

- Current admin compose and direct decision-letter callers generate a client operation ID for each intentional send. They retain the exact payload and ID after an unknown/lost response, reject a same-tick duplicate activation locally, and create a fresh ID after confirmed success or a material draft change.
- `clientOperationId` remains optional at the API boundary for older callers. When supplied, the backend resolves fresh staff/case/application/applicant scope, hashes the canonical resolved request, and claims the operation inside the same transaction as the message, mailbox state, signing package, version transition, and decision-letter transition.
- A retry of the same key and canonical payload returns the original committed HTTP status/body. Reusing the key for a different body, application, attachment set, workflow scope, row version, or reply target returns `409` without new product writes.
- The transactional unique claim happens before mutable reply/workflow/version/decision guards. A concurrent duplicate therefore waits for the first transaction and replays it instead of being rejected because the first send changed that mutable state.
- Clear Test Data deletes `message_send_operation` before `messages`; ordinary product deletion is audit-preserving and does not hard-delete message rows.

## Message Flow
1. Admin dashboard sends through `POST /api/cases/:id/messages`.
   - The handler validates case access, resolves the case applicant user, and writes a `staff_profile -> applicant_user` message when the staff profile is known. It does not derive hidden application or Action Plan authority from the case or the currently browsed widget selection; ordinary messages are case-only, while managed forms carry an explicit application/plan chosen by the visible workflow.
   - A populated case-client Cognito subject is current participant authority. `NULL`, empty, or whitespace-only legacy values are genuinely unlinked and may use the exact selected application's submission user; a populated subject that no shared user resolves is an account-link repair condition and never falls through to an older submission author. That condition blocks only a new message/form target. Historical text replies continue to use their immutable typed participant, and other casework remains available.
   - Staff compose now treats the `To` display as read-only and requires recipient/case confirmation before send; routing remains derived from the case's linked applicant account, not from editable display text.
   - Reply status follows the locked target's direction. A staff reply can mark an applicant-origin target as replied, but a staff follow-up that quotes a staff-origin target must not claim that the applicant replied; the target keeps its existing applicant-facing sent/read state.
2. Public portal sends through `/api/messages/reply` or `/api/messages/reply-with-attachments`.
   - The backend derives the allowed case/application and staff recipient from the applicant messaging context or typed reply counterpart.
   - The portal no longer supplies legacy recipient authority when replying to an existing message.
3. Attachments are adopted into `iset_document` when the admin widget calls `/api/admin/messages/:id/attachments?case_id=...`.
   - The read first proves message/case access and hard case/client/applicant ownership. A different or missing historical application does not block an otherwise authorized attachment: adoption is skipped for that row and the attachment remains readable. Existing document rows with another source or other non-ownership lineage are preserved rather than reparented. Only a proven ownership contradiction blocks disclosure; an indexing/adoption failure is logged and does not turn the message read into an outage.

## Withdrawal And Deleted Items

- `message_item.folder='deleted'` / `purged_at` is mailbox state for one owner only. It must not be described as recalling or deleting the message for other actors.
- Staff can explicitly withdraw a plain staff-to-applicant message through `POST /api/admin/messages/:id/withdraw` when they are the original sender or a System/NWAC Administrator with case access.
- Withdrawal is audit-preserving: it replaces `messages.subject` / `messages.body` with a neutral withdrawal notice, marks the master message deleted/archived, moves the sender and applicant mailbox rows to Deleted, redacts the original `staff_secure_message_sent` event subject, and emits a `message_deleted` event with withdrawal metadata and hashes only.
- Withdrawal currently fails closed for messages with `message_attachment` rows or linked `message_signing_request` rows. Those cases need a reviewed support repair because forms, generated documents, and signing state may have downstream effects.
- Admin `GET /api/cases/:id/messages` classifies master-deleted messages as Deleted even when the staff viewer is not a message participant, so withdrawn messages do not reappear in the ordinary case-thread tabs for case-access viewers.

## API Response Contract
- Admin `GET /api/cases/:id/messages` returns a case/application `thread` object at the response root and on each item.
- Admin and portal message items expose canonical `sender` and `recipient` actor objects with `actorType`, `userId`, `staffProfileId`, and `applicantUserId` aliases where applicable.
- Staff and applicant UIs should classify direction, inbox/sent buckets, display names, and read-state actions from canonical actor objects or typed actor fields, not from legacy `sender_id` / `recipient_id`.
- In DEV, migration `20260427_0009_retire_secure_message_legacy_participant_columns.sql` physically retires `messages.sender_id` and `messages.recipient_id` after recording aggregate drift counts. TEST/PROD must run the same migration only after typed actor backfill and 0-drift preflight.

## Operational Notes
- Run `npm run audit:privacy-erm -- --out docs/data/privacy-erm-audits/<env-date>.md` before promoting secure-message migrations outside DEV.
- Do not add new secure-message write paths that insert or depend on legacy `sender_id` / `recipient_id`.
- When a shared `user.id` must be associated with a `staff_profiles.id`, resolve by Cognito subject only. Do not reintroduce email fallback for routing, display-name, or event payload helpers.
- Do not infer applicant visibility from assigned staff. Applicant visibility is derived from the case/application/client and typed applicant actor.
- Data purges should consider `message_item`, `message_attachment`, `messages`, and any `iset_document` rows with `source='secure_message_attachment'`; avoid broad hard deletes without an audit-preserving runbook.
- If content exposure has already happened, first contain the live message body, preserve audit evidence, and record the repair in the PROD feedback/repair logs before closing the staff report.

## Remaining Work
- Rehearse physical legacy sender/recipient column retirement in TEST/PROD with the audit and aggregate retirement table before promoting outside DEV.
- Decide whether the long-term storage model remains evolved `messages` rows or moves to explicit case-thread tables.
