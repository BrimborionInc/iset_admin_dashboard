-- Independent read-only verification for the guarded 2026-08-19 PROD repair.

SELECT messages.id,
       messages.sender_actor_type,
       messages.sender_user_id,
       messages.sender_staff_profile_id,
       messages.recipient_actor_type,
       messages.recipient_user_id,
       messages.recipient_staff_profile_id,
       messages.case_id,
       messages.application_id,
       messages.status,
       messages.created_at,
       messages.deleted,
       message_item.folder,
       message_item.read_at,
       message_item.deleted_at,
       message_item.purged_at
  FROM messages
  JOIN message_item
    ON message_item.message_id = messages.id
   AND message_item.owner_user_id = messages.recipient_user_id
 WHERE messages.id IN (2573, 2587, 2590)
 ORDER BY messages.id;

SELECT target_message.id,
       applicant_message.id,
       applicant_message.case_id,
       applicant_message.sender_actor_type,
       applicant_message.sender_user_id,
       applicant_message.created_at
  FROM messages AS target_message
  JOIN messages AS applicant_message
    ON applicant_message.case_id = target_message.case_id
   AND applicant_message.sender_actor_type = 'applicant_user'
   AND applicant_message.sender_user_id = target_message.recipient_user_id
   AND applicant_message.created_at > target_message.created_at
 WHERE target_message.id IN (2573, 2587, 2590)
 ORDER BY target_message.id, applicant_message.created_at, applicant_message.id;

SELECT target_message.id,
       applicant_event.id,
       applicant_event.event_type,
       applicant_event.actor_type,
       applicant_event.actor_applicant_user_id,
       applicant_event.captured_at
  FROM messages AS target_message
  JOIN iset_event_entry AS applicant_event
    ON applicant_event.event_type = 'applicant_secure_message_received'
   AND (
        applicant_event.actor_applicant_user_id = target_message.recipient_user_id
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(applicant_event.payload_json, '$.sender_applicant_user_id')) AS UNSIGNED) = target_message.recipient_user_id
       )
   AND applicant_event.captured_at > target_message.created_at
 WHERE target_message.id IN (2573, 2587, 2590)
 ORDER BY target_message.id, applicant_event.captured_at, applicant_event.id;
