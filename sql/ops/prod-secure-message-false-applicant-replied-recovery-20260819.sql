-- Emergency recovery for the 2026-08-19 false Applicant-replied status repair.
--
-- This intentionally restores the three known-bad replied values and therefore
-- reintroduces the false labels. Do not run unless the repair itself must be
-- reversed. It fails closed if any applicant-origin message or applicant event
-- has appeared since the original target message.

CREATE TEMPORARY TABLE tmp_false_reply_recovery_target (
  message_id int NOT NULL PRIMARY KEY,
  recipient_user_id int NOT NULL,
  case_id bigint unsigned NOT NULL,
  message_created_at timestamp NOT NULL,
  repaired_status varchar(16) NOT NULL
);

INSERT INTO tmp_false_reply_recovery_target
  (message_id, recipient_user_id, case_id, message_created_at, repaired_status)
VALUES
  (2573, 246, 178, '2026-08-07 20:29:00', 'unread'),
  (2587,  37,  34, '2026-08-10 13:15:52', 'read'),
  (2590, 383, 229, '2026-08-10 13:57:46', 'unread');

CREATE TEMPORARY TABLE tmp_false_reply_recovery_guard (
  guard_key varchar(64) NOT NULL PRIMARY KEY
);

START TRANSACTION;

SELECT messages.id,
       messages.status
  FROM messages
  JOIN tmp_false_reply_recovery_target
    ON tmp_false_reply_recovery_target.message_id = messages.id
 ORDER BY messages.id
 FOR UPDATE;

SET @recovery_target_count := (
  SELECT COUNT(*)
    FROM messages
    JOIN tmp_false_reply_recovery_target
      ON tmp_false_reply_recovery_target.message_id = messages.id
     AND tmp_false_reply_recovery_target.repaired_status = messages.status
   WHERE messages.sender_actor_type = 'staff_profile'
     AND messages.recipient_actor_type = 'applicant_user'
     AND messages.recipient_user_id = tmp_false_reply_recovery_target.recipient_user_id
     AND messages.case_id = tmp_false_reply_recovery_target.case_id
     AND messages.created_at = tmp_false_reply_recovery_target.message_created_at
     AND messages.deleted = 0
);

SET @recovery_applicant_message_count := (
  SELECT COUNT(*)
    FROM tmp_false_reply_recovery_target
    JOIN messages AS target_message
      ON target_message.id = tmp_false_reply_recovery_target.message_id
    JOIN messages AS applicant_message
      ON applicant_message.case_id = target_message.case_id
     AND applicant_message.sender_actor_type = 'applicant_user'
     AND applicant_message.sender_user_id = target_message.recipient_user_id
     AND applicant_message.created_at > target_message.created_at
);

SET @recovery_applicant_event_count := (
  SELECT COUNT(*)
    FROM tmp_false_reply_recovery_target
    JOIN messages AS target_message
      ON target_message.id = tmp_false_reply_recovery_target.message_id
    JOIN iset_event_entry AS applicant_event
      ON applicant_event.event_type = 'applicant_secure_message_received'
     AND (
          applicant_event.actor_applicant_user_id = target_message.recipient_user_id
          OR CAST(JSON_UNQUOTE(JSON_EXTRACT(applicant_event.payload_json, '$.sender_applicant_user_id')) AS UNSIGNED) = target_message.recipient_user_id
         )
     AND applicant_event.captured_at > target_message.created_at
);

SET @recovery_ready := (
  @recovery_target_count = 3
  AND @recovery_applicant_message_count = 0
  AND @recovery_applicant_event_count = 0
);

INSERT INTO tmp_false_reply_recovery_guard (guard_key)
VALUES ('recovery_ready');

INSERT INTO tmp_false_reply_recovery_guard (guard_key)
SELECT 'recovery_ready'
 WHERE @recovery_ready <> 1;

UPDATE messages
JOIN tmp_false_reply_recovery_target
  ON tmp_false_reply_recovery_target.message_id = messages.id
   SET messages.status = 'replied'
 WHERE messages.status = tmp_false_reply_recovery_target.repaired_status
   AND @recovery_ready = 1;

SET @recovered_row_count := ROW_COUNT();

INSERT INTO tmp_false_reply_recovery_guard (guard_key)
VALUES ('three_rows_recovered');

INSERT INTO tmp_false_reply_recovery_guard (guard_key)
SELECT 'three_rows_recovered'
 WHERE @recovered_row_count <> 3;

SELECT @recovery_target_count,
       @recovery_applicant_message_count,
       @recovery_applicant_event_count,
       @recovered_row_count;

SELECT messages.id,
       messages.status,
       messages.deleted
  FROM messages
 WHERE messages.id IN (2573, 2587, 2590)
 ORDER BY messages.id;

COMMIT;

DROP TEMPORARY TABLE tmp_false_reply_recovery_guard;
DROP TEMPORARY TABLE tmp_false_reply_recovery_target;
