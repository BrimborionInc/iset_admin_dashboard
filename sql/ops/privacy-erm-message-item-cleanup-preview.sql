-- Preview unsafe message_item rows before cleanup.
-- Read-only. Intended for DEV now and TEST/PROD rehearsal later.

SET @privacy_erm_has_message_actor_columns = (
  SELECT COUNT(*) = 2
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'messages'
    AND column_name IN ('sender_user_id', 'recipient_user_id')
);

SET @privacy_erm_has_message_legacy_columns = (
  SELECT COUNT(*) = 2
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'messages'
    AND column_name IN ('sender_id', 'recipient_id')
);

SET @privacy_erm_message_participants_sql = IF(
  @privacy_erm_has_message_actor_columns,
  'CREATE TEMPORARY TABLE tmp_privacy_erm_message_participants AS SELECT id AS message_id, sender_user_id, recipient_user_id FROM messages',
  IF(
    @privacy_erm_has_message_legacy_columns,
    'CREATE TEMPORARY TABLE tmp_privacy_erm_message_participants AS SELECT id AS message_id, sender_id AS sender_user_id, recipient_id AS recipient_user_id FROM messages',
    'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''messages lacks expected participant columns'''
  )
);

PREPARE privacy_erm_message_participants_stmt FROM @privacy_erm_message_participants_sql;
EXECUTE privacy_erm_message_participants_stmt;
DEALLOCATE PREPARE privacy_erm_message_participants_stmt;

SELECT
  CASE
    WHEN mp.message_id IS NULL THEN 'missing_message'
    WHEN u.id IS NULL THEN 'missing_owner_user'
    WHEN
      (mp.sender_user_id IS NULL OR mi.owner_user_id <> mp.sender_user_id)
      AND (mp.recipient_user_id IS NULL OR mi.owner_user_id <> mp.recipient_user_id)
      THEN 'owner_not_sender_or_recipient'
    ELSE 'ok'
  END AS cleanup_reason,
  COUNT(*) AS row_count
FROM message_item mi
LEFT JOIN tmp_privacy_erm_message_participants mp ON mp.message_id = mi.message_id
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
  mp.sender_user_id,
  mp.recipient_user_id,
  mi.folder,
  CASE
    WHEN mp.message_id IS NULL THEN 'missing_message'
    WHEN u.id IS NULL THEN 'missing_owner_user'
    WHEN
      (mp.sender_user_id IS NULL OR mi.owner_user_id <> mp.sender_user_id)
      AND (mp.recipient_user_id IS NULL OR mi.owner_user_id <> mp.recipient_user_id)
      THEN 'owner_not_sender_or_recipient'
    ELSE 'ok'
  END AS cleanup_reason
FROM message_item mi
LEFT JOIN tmp_privacy_erm_message_participants mp ON mp.message_id = mi.message_id
LEFT JOIN `user` u ON u.id = mi.owner_user_id
WHERE mp.message_id IS NULL
   OR u.id IS NULL
   OR (
        (mp.sender_user_id IS NULL OR mi.owner_user_id <> mp.sender_user_id)
    AND (mp.recipient_user_id IS NULL OR mi.owner_user_id <> mp.recipient_user_id)
   )
ORDER BY mi.id
LIMIT 250;
