-- Preview PROD containment for feedback #154 / secure message 1128.
-- Read-only. Verifies the exact message, mailbox rows, and related event payload.

SET @message_id := 1128;
SET @recipient_user_id := 189;
SET @sender_user_id := 94;
SET @case_id := 129;
SET @event_id := '7ec162a2-5624-4cc3-b942-248c5177e518';
SET @expected_subject_sha256 := '42cd0ffb38e0708629881d9aa8dcf5417eb4b4d07c73fb8b0f16a2f800ab0ef2';
SET @expected_body_sha256 := '98123bdef9377bf660159039d677ab60874e62da7a0b5247b0941d30bc535e51';

SELECT
  'message_guard' AS section,
  m.id,
  m.case_id,
  m.sender_user_id,
  m.sender_staff_profile_id,
  m.recipient_user_id,
  m.subject,
  SHA2(m.subject, 256) AS subject_sha256,
  SHA2(m.body, 256) AS body_sha256,
  m.status,
  m.deleted,
  m.created_at,
  CASE
    WHEN m.id = @message_id
     AND m.case_id = @case_id
     AND m.sender_user_id = @sender_user_id
     AND m.sender_staff_profile_id = 55
     AND m.recipient_user_id = @recipient_user_id
     AND SHA2(m.subject, 256) = @expected_subject_sha256
     AND SHA2(m.body, 256) = @expected_body_sha256
    THEN 'ready'
    ELSE 'block'
  END AS guard_status
FROM messages m
WHERE m.id = @message_id;

SELECT
  'mailbox_rows' AS section,
  mi.id,
  mi.message_id,
  mi.owner_user_id,
  u.email AS owner_email,
  mi.folder,
  mi.folder_before_deleted,
  mi.read_at,
  mi.deleted_at,
  mi.purged_at,
  mi.updated_at
FROM message_item mi
LEFT JOIN user u ON u.id = mi.owner_user_id
WHERE mi.message_id = @message_id
ORDER BY mi.id;

SELECT
  'related_counts' AS section,
  (SELECT COUNT(*) FROM message_attachment WHERE message_id = @message_id) AS attachment_count,
  (SELECT COUNT(*) FROM message_signing_request WHERE message_id = @message_id) AS signing_request_count,
  (SELECT COUNT(*) FROM iset_internal_notification
    WHERE JSON_EXTRACT(metadata, '$.messageId') = @message_id
       OR JSON_EXTRACT(metadata, '$.message_id') = @message_id
       OR message LIKE CONCAT('%', @message_id, '%')) AS notification_count;

SELECT
  'event_guard' AS section,
  e.id,
  e.event_type,
  e.subject_type,
  e.subject_id,
  JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.message_subject')) AS message_subject,
  SHA2(JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.message_subject')), 256) AS event_subject_sha256,
  JSON_EXTRACT(e.payload_json, '$.message_id') AS event_message_id,
  JSON_EXTRACT(e.payload_json, '$.recipient_user_id') AS event_recipient_user_id,
  CASE
    WHEN e.id = @event_id
     AND e.event_type = 'staff_secure_message_sent'
     AND e.subject_type = 'case'
     AND e.subject_id = CAST(@case_id AS CHAR)
     AND JSON_EXTRACT(e.payload_json, '$.message_id') = @message_id
     AND JSON_EXTRACT(e.payload_json, '$.recipient_user_id') = @recipient_user_id
     AND SHA2(JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.message_subject')), 256) = @expected_subject_sha256
    THEN 'ready'
    ELSE 'block'
  END AS guard_status
FROM iset_event_entry e
WHERE e.id = @event_id;
