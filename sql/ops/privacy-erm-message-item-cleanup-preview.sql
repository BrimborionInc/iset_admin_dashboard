-- Preview unsafe message_item rows before cleanup.
-- Read-only. Intended for DEV now and TEST/PROD rehearsal later.

SELECT
  CASE
    WHEN m.id IS NULL THEN 'missing_message'
    WHEN u.id IS NULL THEN 'missing_owner_user'
    WHEN mi.owner_user_id NOT IN (m.sender_id, m.recipient_id) THEN 'owner_not_sender_or_recipient'
    ELSE 'ok'
  END AS cleanup_reason,
  COUNT(*) AS row_count
FROM message_item mi
LEFT JOIN messages m ON m.id = mi.message_id
LEFT JOIN `user` u ON u.id = mi.owner_user_id
GROUP BY cleanup_reason
ORDER BY
  CASE cleanup_reason
    WHEN 'missing_message' THEN 10
    WHEN 'missing_owner_user' THEN 20
    WHEN 'owner_not_sender_or_recipient' THEN 30
    ELSE 90
  END;

SELECT
  mi.id AS message_item_id,
  mi.message_id,
  mi.owner_user_id,
  m.sender_id,
  m.recipient_id,
  mi.folder,
  CASE
    WHEN m.id IS NULL THEN 'missing_message'
    WHEN u.id IS NULL THEN 'missing_owner_user'
    WHEN mi.owner_user_id NOT IN (m.sender_id, m.recipient_id) THEN 'owner_not_sender_or_recipient'
    ELSE 'ok'
  END AS cleanup_reason
FROM message_item mi
LEFT JOIN messages m ON m.id = mi.message_id
LEFT JOIN `user` u ON u.id = mi.owner_user_id
WHERE m.id IS NULL
   OR u.id IS NULL
   OR mi.owner_user_id NOT IN (m.sender_id, m.recipient_id)
ORDER BY mi.id
LIMIT 250;
