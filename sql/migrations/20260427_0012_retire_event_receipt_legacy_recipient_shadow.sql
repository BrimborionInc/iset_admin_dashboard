CREATE TABLE IF NOT EXISTS privacy_erm_event_receipt_shadow_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  receipts_total INT NOT NULL DEFAULT 0,
  legacy_recipient_values INT NOT NULL DEFAULT 0,
  typed_viewer_values INT NOT NULL DEFAULT 0,
  unresolved_legacy_viewers INT NOT NULL DEFAULT 0,
  staff_duplicate_groups INT NOT NULL DEFAULT 0,
  applicant_duplicate_groups INT NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @event_receipt_recipient_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND column_name = 'recipient_id'
);

SELECT COUNT(*) INTO @event_receipts_total
  FROM iset_event_receipt;

SELECT COALESCE(SUM(viewer_staff_profile_id IS NOT NULL OR viewer_applicant_user_id IS NOT NULL), 0)
  INTO @event_receipt_typed_viewer_values
  FROM iset_event_receipt;

SET @sql = IF(@event_receipt_recipient_shadow_exists > 0,
  'SELECT COALESCE(SUM(recipient_id IS NOT NULL AND recipient_id <> ''''), 0) INTO @event_receipt_legacy_recipient_values FROM iset_event_receipt',
  'SELECT 0 INTO @event_receipt_legacy_recipient_values'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@event_receipt_recipient_shadow_exists > 0,
  'SELECT COUNT(*) INTO @event_receipt_unresolved_legacy_viewers
     FROM iset_event_receipt
    WHERE (recipient_id IS NOT NULL AND recipient_id <> '''')
      AND NOT (
            (viewer_staff_profile_id IS NOT NULL AND viewer_applicant_user_id IS NULL)
         OR (viewer_applicant_user_id IS NOT NULL AND viewer_staff_profile_id IS NULL)
          )',
  'SELECT 0 INTO @event_receipt_unresolved_legacy_viewers'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @event_receipt_staff_duplicate_groups
  FROM (
    SELECT event_id, viewer_staff_profile_id, COUNT(*) AS duplicate_count
      FROM iset_event_receipt
     WHERE viewer_staff_profile_id IS NOT NULL
     GROUP BY event_id, viewer_staff_profile_id
    HAVING COUNT(*) > 1
  ) duplicates;

SELECT COUNT(*) INTO @event_receipt_applicant_duplicate_groups
  FROM (
    SELECT event_id, viewer_applicant_user_id, COUNT(*) AS duplicate_count
      FROM iset_event_receipt
     WHERE viewer_applicant_user_id IS NOT NULL
     GROUP BY event_id, viewer_applicant_user_id
    HAVING COUNT(*) > 1
  ) duplicates;

SET @sql = IF(@event_receipt_unresolved_legacy_viewers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_event_receipt.recipient_id unresolved typed viewer values detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@event_receipt_staff_duplicate_groups > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_event_receipt duplicate staff viewer receipts detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@event_receipt_applicant_duplicate_groups > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_event_receipt duplicate applicant viewer receipts detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO privacy_erm_event_receipt_shadow_retirement_audit (
  run_label,
  receipts_total,
  legacy_recipient_values,
  typed_viewer_values,
  unresolved_legacy_viewers,
  staff_duplicate_groups,
  applicant_duplicate_groups
) VALUES (
  'event-receipt-shadow-retirement-20260427',
  @event_receipts_total,
  @event_receipt_legacy_recipient_values,
  @event_receipt_typed_viewer_values,
  @event_receipt_unresolved_legacy_viewers,
  @event_receipt_staff_duplicate_groups,
  @event_receipt_applicant_duplicate_groups
);

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_event_receipt_single_typed_viewer'
), 'ALTER TABLE iset_event_receipt DROP CHECK chk_iset_event_receipt_single_typed_viewer', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_event_receipt_exactly_one_typed_viewer'
), 'ALTER TABLE iset_event_receipt ADD CONSTRAINT chk_iset_event_receipt_exactly_one_typed_viewer CHECK (((viewer_staff_profile_id IS NOT NULL) AND (viewer_applicant_user_id IS NULL)) OR ((viewer_applicant_user_id IS NOT NULL) AND (viewer_staff_profile_id IS NULL)))', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND index_name = 'idx_iset_event_receipt_event_id'
), 'ALTER TABLE iset_event_receipt ADD INDEX idx_iset_event_receipt_event_id (event_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @event_receipt_id_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND column_name = 'id'
);

SET @sql = IF(@event_receipt_id_exists = 0,
  'ALTER TABLE iset_event_receipt DROP PRIMARY KEY, ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND index_name = 'uniq_iset_event_receipt_staff_viewer'
), 'ALTER TABLE iset_event_receipt ADD UNIQUE KEY uniq_iset_event_receipt_staff_viewer (event_id, viewer_staff_profile_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND index_name = 'uniq_iset_event_receipt_applicant_viewer'
), 'ALTER TABLE iset_event_receipt ADD UNIQUE KEY uniq_iset_event_receipt_applicant_viewer (event_id, viewer_applicant_user_id)', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@event_receipt_recipient_shadow_exists > 0,
  'ALTER TABLE iset_event_receipt DROP COLUMN recipient_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
