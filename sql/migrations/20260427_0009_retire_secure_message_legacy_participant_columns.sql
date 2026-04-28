CREATE TABLE IF NOT EXISTS privacy_erm_secure_message_participant_shadow_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  messages_total INT NOT NULL DEFAULT 0,
  sender_shadow_values INT NOT NULL DEFAULT 0,
  recipient_shadow_values INT NOT NULL DEFAULT 0,
  sender_shadow_drift INT NOT NULL DEFAULT 0,
  recipient_shadow_drift INT NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @sender_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'messages'
     AND column_name = 'sender_id'
);

SET @recipient_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'messages'
     AND column_name = 'recipient_id'
);

SET @sql = IF(@sender_shadow_exists > 0,
  'SELECT COUNT(*) INTO @sender_shadow_drift FROM messages WHERE sender_id IS NOT NULL AND (sender_user_id IS NULL OR sender_id <> sender_user_id)',
  'SELECT 0 INTO @sender_shadow_drift'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@recipient_shadow_exists > 0,
  'SELECT COUNT(*) INTO @recipient_shadow_drift FROM messages WHERE recipient_id IS NOT NULL AND (recipient_user_id IS NULL OR recipient_id <> recipient_user_id)',
  'SELECT 0 INTO @recipient_shadow_drift'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@sender_shadow_drift > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''messages.sender_id drift detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@recipient_shadow_drift > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''messages.recipient_id drift detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@sender_shadow_exists > 0 AND @recipient_shadow_exists > 0,
  'INSERT INTO privacy_erm_secure_message_participant_shadow_retirement_audit (run_label, messages_total, sender_shadow_values, recipient_shadow_values, sender_shadow_drift, recipient_shadow_drift) SELECT ''secure-message-shadow-retirement-20260427'', COUNT(*), COALESCE(SUM(sender_id IS NOT NULL), 0), COALESCE(SUM(recipient_id IS NOT NULL), 0), COALESCE(SUM(sender_id IS NOT NULL AND (sender_user_id IS NULL OR sender_id <> sender_user_id)), 0), COALESCE(SUM(recipient_id IS NOT NULL AND (recipient_user_id IS NULL OR recipient_id <> recipient_user_id)), 0) FROM messages',
  'INSERT INTO privacy_erm_secure_message_participant_shadow_retirement_audit (run_label, messages_total, sender_shadow_values, recipient_shadow_values, sender_shadow_drift, recipient_shadow_drift) SELECT ''secure-message-shadow-retirement-20260427'', COUNT(*), 0, 0, 0, 0 FROM messages'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_sender_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'messages'
     AND column_name = 'sender_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@legacy_sender_fk IS NOT NULL,
  CONCAT('ALTER TABLE messages DROP FOREIGN KEY `', REPLACE(@legacy_sender_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_recipient_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'messages'
     AND column_name = 'recipient_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@legacy_recipient_fk IS NOT NULL,
  CONCAT('ALTER TABLE messages DROP FOREIGN KEY `', REPLACE(@legacy_recipient_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@sender_shadow_exists > 0,
  'ALTER TABLE messages DROP COLUMN sender_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@recipient_shadow_exists > 0,
  'ALTER TABLE messages DROP COLUMN recipient_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
