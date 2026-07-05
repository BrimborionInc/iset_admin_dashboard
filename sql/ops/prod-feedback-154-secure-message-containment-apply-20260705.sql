-- Apply PROD containment for feedback #154 / secure message 1128.
-- Scope:
-- - Redacts the live secure-message subject/body so the wrong recipient and staff case thread no longer expose the offending content.
-- - Marks the message and recipient mailbox copy as withdrawn/deleted without hard-deleting the master row.
-- - Redacts the message subject in the central event payload.
-- - Adds an internal feedback note for incident follow-up.
--
-- This script intentionally does not copy the sensitive original body into the repo, feedback note, or docs.

START TRANSACTION;

SET @message_id := 1128;
SET @recipient_user_id := 189;
SET @sender_user_id := 94;
SET @case_id := 129;
SET @sender_staff_profile_id := 55;
SET @event_id := '7ec162a2-5624-4cc3-b942-248c5177e518';
SET @feedback_report_id := 154;
SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @now := NOW();
SET @expected_subject_sha256 := '42cd0ffb38e0708629881d9aa8dcf5417eb4b4d07c73fb8b0f16a2f800ab0ef2';
SET @expected_body_sha256 := '98123bdef9377bf660159039d677ab60874e62da7a0b5247b0941d30bc535e51';
SET @withdrawn_subject := 'Message withdrawn';
SET @withdrawn_body := 'This secure message has been withdrawn. Please disregard it. No action is required.';
SET @event_subject := '[withdrawn] Message withdrawn';

SET @message_guard_count := (
  SELECT COUNT(*)
    FROM messages
   WHERE id = @message_id
     AND case_id = @case_id
     AND sender_user_id = @sender_user_id
     AND sender_staff_profile_id = @sender_staff_profile_id
     AND recipient_user_id = @recipient_user_id
     AND recipient_actor_type = 'applicant_user'
     AND SHA2(subject, 256) = @expected_subject_sha256
     AND SHA2(body, 256) = @expected_body_sha256
);

SET @recipient_item_guard_count := (
  SELECT COUNT(*)
    FROM message_item
   WHERE message_id = @message_id
     AND owner_user_id = @recipient_user_id
     AND folder = 'inbox'
     AND purged_at IS NULL
);

SET @sender_item_guard_count := (
  SELECT COUNT(*)
    FROM message_item
   WHERE message_id = @message_id
     AND owner_user_id = @sender_user_id
     AND folder = 'deleted'
);

SET @attachment_count := (
  SELECT COUNT(*)
    FROM message_attachment
   WHERE message_id = @message_id
);

SET @signing_request_count := (
  SELECT COUNT(*)
    FROM message_signing_request
   WHERE message_id = @message_id
);

SET @event_guard_count := (
  SELECT COUNT(*)
    FROM iset_event_entry
   WHERE id = @event_id
     AND event_type = 'staff_secure_message_sent'
     AND subject_type = 'case'
     AND subject_id = CAST(@case_id AS CHAR)
     AND JSON_EXTRACT(payload_json, '$.message_id') = @message_id
     AND JSON_EXTRACT(payload_json, '$.recipient_user_id') = @recipient_user_id
     AND SHA2(JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.message_subject')), 256) = @expected_subject_sha256
);

SET @feedback_guard_count := (
  SELECT COUNT(*)
    FROM admin_feedback_report
   WHERE id = @feedback_report_id
     AND status = 'in_progress'
);

SET @all_guards_ready := (
  @message_guard_count = 1
  AND @recipient_item_guard_count = 1
  AND @sender_item_guard_count = 1
  AND @attachment_count = 0
  AND @signing_request_count = 0
  AND @event_guard_count = 1
  AND @feedback_guard_count = 1
);

CREATE TEMPORARY TABLE tmp_feedback_154_guard (
  guard_name VARCHAR(64) PRIMARY KEY
) ENGINE=Memory;

INSERT INTO tmp_feedback_154_guard (guard_name) VALUES ('ready');

-- Deliberately fail with a duplicate-key error if any guard is not exactly ready.
INSERT INTO tmp_feedback_154_guard (guard_name)
SELECT 'ready'
WHERE @all_guards_ready <> 1;

UPDATE messages
   SET subject = @withdrawn_subject,
       body = @withdrawn_body,
       status = 'archived',
       deleted = 1
 WHERE id = @message_id
   AND @all_guards_ready = 1;

UPDATE message_item
   SET folder_before_deleted = CASE
         WHEN folder IN ('inbox','sent') THEN folder
         ELSE folder_before_deleted
       END,
       folder = 'deleted',
       deleted_at = COALESCE(deleted_at, @now),
       purged_at = NULL,
       updated_at = @now
 WHERE message_id = @message_id
   AND owner_user_id IN (@sender_user_id, @recipient_user_id)
   AND @all_guards_ready = 1;

UPDATE iset_event_entry
   SET payload_json = JSON_SET(payload_json, '$.message_subject', @event_subject)
 WHERE id = @event_id
   AND @all_guards_ready = 1;

INSERT INTO admin_feedback_note (
  report_id,
  author_staff_profile_id,
  author_name,
  author_email,
  note_text,
  created_at
)
SELECT
  @feedback_report_id,
  NULL,
  @actor_name,
  @actor_email,
  CONCAT(
    'Codex containment 2026-07-05: With Bill approval, contained wrong-recipient secure message ',
    @message_id,
    ' on case ',
    @case_id,
    '. The live message subject/body were replaced with a neutral withdrawal notice, the master message was marked deleted/archived, the sender and recipient mailbox rows were kept in deleted state, and the central send-event subject was redacted. No attachments, signing requests, or internal notification rows were linked to this message. Original sensitive body content was not copied into this note or repo artifacts. Report remains in_progress pending privacy/business follow-up and product fix for true recall/delete-for-everyone plus stronger recipient confirmation.'
  ),
  @now
WHERE @all_guards_ready = 1
  AND NOT EXISTS (
    SELECT 1
      FROM admin_feedback_note
     WHERE report_id = @feedback_report_id
       AND note_text LIKE CONCAT('Codex containment 2026-07-05: With Bill approval, contained wrong-recipient secure message ', @message_id, '%')
  );

SELECT
  'guard_summary' AS section,
  @message_guard_count AS message_guard_count,
  @recipient_item_guard_count AS recipient_item_guard_count,
  @sender_item_guard_count AS sender_item_guard_count,
  @attachment_count AS attachment_count,
  @signing_request_count AS signing_request_count,
  @event_guard_count AS event_guard_count,
  @feedback_guard_count AS feedback_guard_count,
  @all_guards_ready AS all_guards_ready;

SELECT
  'message_after' AS section,
  id,
  case_id,
  recipient_user_id,
  subject,
  body,
  status,
  deleted
FROM messages
WHERE id = @message_id;

SELECT
  'mailbox_after' AS section,
  id,
  message_id,
  owner_user_id,
  folder,
  folder_before_deleted,
  read_at,
  deleted_at,
  purged_at,
  updated_at
FROM message_item
WHERE message_id = @message_id
ORDER BY id;

SELECT
  'event_after' AS section,
  id,
  JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.message_subject')) AS message_subject
FROM iset_event_entry
WHERE id = @event_id;

SELECT
  'feedback_note_after' AS section,
  report_id,
  author_name,
  author_email,
  created_at,
  LEFT(note_text, 500) AS note_preview
FROM admin_feedback_note
WHERE report_id = @feedback_report_id
ORDER BY created_at DESC, id DESC
LIMIT 3;

COMMIT;
