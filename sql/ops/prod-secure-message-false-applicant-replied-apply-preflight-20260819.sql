-- Read-only preflight for the exact guarded PROD repair. This intentionally
-- reproduces the apply artifact's temporary-table collations and evidence joins
-- without starting a transaction or mutating a persistent table.

CREATE TEMPORARY TABLE tmp_false_reply_preflight_target (
  message_id int NOT NULL PRIMARY KEY,
  sender_user_id int NOT NULL,
  sender_staff_profile_id bigint unsigned NOT NULL,
  recipient_user_id int NOT NULL,
  case_id bigint unsigned NOT NULL,
  application_id bigint unsigned NOT NULL,
  message_created_at timestamp NOT NULL,
  expected_read_at datetime NULL,
  followup_event_id char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  followup_message_id int NOT NULL,
  repaired_status varchar(16) NOT NULL
);

INSERT INTO tmp_false_reply_preflight_target
  (message_id,
   sender_user_id,
   sender_staff_profile_id,
   recipient_user_id,
   case_id,
   application_id,
   message_created_at,
   expected_read_at,
   followup_event_id,
   followup_message_id,
   repaired_status)
VALUES
  (2573, 94, 55, 246, 178, 109, '2026-08-07 20:29:00', NULL, '94ce210a-c97c-4613-941c-1f0b0f85773a', 3073, 'unread'),
  (2587, 94, 55,  37,  34, 224, '2026-08-10 13:15:52', '2026-08-10 13:19:28', '04aff01f-90de-4c8e-a6f7-7af4a5291cc4', 3047, 'read'),
  (2590, 94, 55, 383, 229, 168, '2026-08-10 13:57:46', NULL, 'ccb39274-0478-4c97-ab98-6ae545bda56c', 3046, 'unread');

SET @preflight_message_guard_count := (
  SELECT COUNT(*)
    FROM messages
    JOIN tmp_false_reply_preflight_target
      ON tmp_false_reply_preflight_target.message_id = messages.id
     AND tmp_false_reply_preflight_target.sender_user_id = messages.sender_user_id
     AND tmp_false_reply_preflight_target.sender_staff_profile_id = messages.sender_staff_profile_id
     AND tmp_false_reply_preflight_target.recipient_user_id = messages.recipient_user_id
     AND tmp_false_reply_preflight_target.case_id = messages.case_id
     AND tmp_false_reply_preflight_target.application_id = messages.application_id
     AND tmp_false_reply_preflight_target.message_created_at = messages.created_at
   WHERE messages.sender_actor_type = 'staff_profile'
     AND messages.recipient_actor_type = 'applicant_user'
     AND messages.recipient_staff_profile_id IS NULL
     AND messages.status = 'replied'
     AND messages.deleted = 0
);

SET @preflight_mailbox_guard_count := (
  SELECT COUNT(*)
    FROM message_item
    JOIN tmp_false_reply_preflight_target
      ON tmp_false_reply_preflight_target.message_id = message_item.message_id
     AND tmp_false_reply_preflight_target.recipient_user_id = message_item.owner_user_id
   WHERE message_item.folder = 'inbox'
     AND message_item.deleted_at IS NULL
     AND message_item.purged_at IS NULL
     AND (
          (tmp_false_reply_preflight_target.expected_read_at IS NULL AND message_item.read_at IS NULL)
          OR
          (tmp_false_reply_preflight_target.expected_read_at IS NOT NULL
           AND message_item.read_at = tmp_false_reply_preflight_target.expected_read_at)
         )
);

SET @preflight_staff_followup_guard_count := (
  SELECT COUNT(*)
    FROM tmp_false_reply_preflight_target
    JOIN messages AS target_message
      ON target_message.id = tmp_false_reply_preflight_target.message_id
    JOIN iset_event_entry AS followup_event
      ON followup_event.id = tmp_false_reply_preflight_target.followup_event_id
     AND followup_event.event_type = 'staff_secure_message_sent'
     AND followup_event.subject_type = 'case'
     AND followup_event.subject_id = CAST(target_message.case_id AS CHAR)
     AND followup_event.actor_type = 'staff'
     AND followup_event.actor_staff_profile_id = target_message.sender_staff_profile_id
     AND followup_event.captured_at > target_message.created_at
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(followup_event.payload_json, '$.reply_to_message_id')) AS UNSIGNED) = target_message.id
     AND CAST(JSON_UNQUOTE(JSON_EXTRACT(followup_event.payload_json, '$.message_id')) AS UNSIGNED) = tmp_false_reply_preflight_target.followup_message_id
    JOIN messages AS followup_message
      ON followup_message.id = tmp_false_reply_preflight_target.followup_message_id
     AND followup_message.case_id = target_message.case_id
     AND followup_message.application_id = target_message.application_id
     AND followup_message.sender_actor_type = 'staff_profile'
     AND followup_message.sender_user_id = target_message.sender_user_id
     AND followup_message.sender_staff_profile_id = target_message.sender_staff_profile_id
     AND followup_message.recipient_actor_type = 'applicant_user'
     AND followup_message.recipient_user_id = target_message.recipient_user_id
     AND followup_message.created_at > target_message.created_at
     AND followup_message.deleted = 0
);

SET @preflight_applicant_message_count := (
  SELECT COUNT(*)
    FROM tmp_false_reply_preflight_target
    JOIN messages AS target_message
      ON target_message.id = tmp_false_reply_preflight_target.message_id
    JOIN messages AS applicant_message
      ON applicant_message.case_id = target_message.case_id
     AND applicant_message.sender_actor_type = 'applicant_user'
     AND applicant_message.sender_user_id = target_message.recipient_user_id
     AND applicant_message.created_at > target_message.created_at
);

SET @preflight_applicant_event_count := (
  SELECT COUNT(*)
    FROM tmp_false_reply_preflight_target
    JOIN messages AS target_message
      ON target_message.id = tmp_false_reply_preflight_target.message_id
    JOIN iset_event_entry AS applicant_event
      ON applicant_event.event_type = 'applicant_secure_message_received'
     AND (
          applicant_event.actor_applicant_user_id = target_message.recipient_user_id
          OR CAST(JSON_UNQUOTE(JSON_EXTRACT(applicant_event.payload_json, '$.sender_applicant_user_id')) AS UNSIGNED) = target_message.recipient_user_id
         )
     AND applicant_event.captured_at > target_message.created_at
);

SELECT @preflight_message_guard_count,
       @preflight_mailbox_guard_count,
       @preflight_staff_followup_guard_count,
       @preflight_applicant_message_count,
       @preflight_applicant_event_count;

DROP TEMPORARY TABLE tmp_false_reply_preflight_target;
