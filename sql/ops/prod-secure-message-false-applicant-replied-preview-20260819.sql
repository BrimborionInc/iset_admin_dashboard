-- Read-only, fail-closed PROD preview for false "Applicant replied" rows.
--
-- A row is included only when all of the following live evidence agrees:
--   * the target is an undeleted staff-origin message to an applicant;
--   * its current generic recipient status is replied;
--   * a later staff-origin message on the exact same case/application and actor
--     pair has a staff_secure_message_sent event whose reply_to_message_id is
--     the target;
--   * that follow-up was sent by the same staff profile that sent the target;
--   * no applicant-origin message from that applicant exists after the target;
--   * no applicant_secure_message_received event exists for that applicant
--     after the target, including an event whose message row was later removed;
--   * the applicant mailbox row still exists and supplies the authoritative
--     read/unread state to restore.
--
-- Any row with applicant-origin activity after the target is deliberately
-- excluded as ambiguous, even if a later staff follow-up also quoted it.

SELECT target_message.id,
       target_message.sender_actor_type,
       target_message.sender_user_id,
       target_message.sender_staff_profile_id,
       target_message.recipient_actor_type,
       target_message.recipient_user_id,
       target_message.recipient_staff_profile_id,
       target_message.case_id,
       target_message.application_id,
       target_message.subject,
       target_message.status,
       target_message.created_at,
       target_message.deleted,
       target_message.urgent,
       applicant_mailbox.folder,
       applicant_mailbox.read_at,
       applicant_mailbox.deleted_at,
       applicant_mailbox.purged_at,
       followup_event.id,
       followup_event.subject_type,
       followup_event.subject_id,
       followup_event.actor_type,
       followup_event.actor_staff_profile_id,
       followup_event.captured_at,
       followup_message.id,
       followup_message.status,
       followup_message.created_at,
       followup_message.deleted
  FROM messages AS target_message
  JOIN message_item AS applicant_mailbox
    ON applicant_mailbox.message_id = target_message.id
   AND applicant_mailbox.owner_user_id = target_message.recipient_user_id
  JOIN iset_event_entry AS followup_event
   ON followup_event.event_type = 'staff_secure_message_sent'
   AND followup_event.subject_type = 'case'
   AND followup_event.subject_id = CAST(target_message.case_id AS CHAR)
   AND followup_event.actor_type = 'staff'
   AND followup_event.actor_staff_profile_id = target_message.sender_staff_profile_id
   AND followup_event.captured_at > target_message.created_at
   AND CAST(JSON_UNQUOTE(JSON_EXTRACT(followup_event.payload_json, '$.reply_to_message_id')) AS UNSIGNED) = target_message.id
  JOIN messages AS followup_message
    ON followup_message.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(followup_event.payload_json, '$.message_id')) AS UNSIGNED)
   AND followup_message.case_id = target_message.case_id
   AND (
        followup_message.application_id = target_message.application_id
        OR (followup_message.application_id IS NULL AND target_message.application_id IS NULL)
       )
   AND followup_message.sender_actor_type IN ('staff_profile', 'local_user')
   AND followup_message.sender_user_id = target_message.sender_user_id
   AND followup_message.sender_staff_profile_id = target_message.sender_staff_profile_id
   AND followup_message.recipient_actor_type = 'applicant_user'
   AND followup_message.recipient_user_id = target_message.recipient_user_id
   AND followup_message.created_at > target_message.created_at
 WHERE target_message.sender_actor_type IN ('staff_profile', 'local_user')
   AND target_message.recipient_actor_type = 'applicant_user'
   AND target_message.status = 'replied'
   AND target_message.deleted = 0
   AND applicant_mailbox.folder = 'inbox'
   AND applicant_mailbox.deleted_at IS NULL
   AND applicant_mailbox.purged_at IS NULL
   AND NOT EXISTS (
       SELECT 1
         FROM messages AS applicant_message
        WHERE applicant_message.case_id = target_message.case_id
          AND applicant_message.sender_actor_type = 'applicant_user'
          AND applicant_message.sender_user_id = target_message.recipient_user_id
          AND applicant_message.created_at > target_message.created_at
     )
   AND NOT EXISTS (
       SELECT 1
         FROM iset_event_entry AS applicant_event
        WHERE applicant_event.event_type = 'applicant_secure_message_received'
          AND (
               applicant_event.actor_applicant_user_id = target_message.recipient_user_id
               OR CAST(JSON_UNQUOTE(JSON_EXTRACT(applicant_event.payload_json, '$.sender_applicant_user_id')) AS UNSIGNED) = target_message.recipient_user_id
              )
          AND applicant_event.captured_at > target_message.created_at
     )
 ORDER BY target_message.created_at, target_message.id;
