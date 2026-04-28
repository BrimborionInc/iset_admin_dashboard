SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND column_name = 'viewer_staff_profile_id'
), 'ALTER TABLE iset_event_receipt ADD COLUMN viewer_staff_profile_id BIGINT UNSIGNED NULL AFTER recipient_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND column_name = 'viewer_applicant_user_id'
), 'ALTER TABLE iset_event_receipt ADD COLUMN viewer_applicant_user_id INT NULL AFTER viewer_staff_profile_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND index_name = 'idx_iset_event_receipt_viewer_staff_profile'
), 'CREATE INDEX idx_iset_event_receipt_viewer_staff_profile ON iset_event_receipt (viewer_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND index_name = 'idx_iset_event_receipt_viewer_applicant_user'
), 'CREATE INDEX idx_iset_event_receipt_viewer_applicant_user ON iset_event_receipt (viewer_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iset_event_receipt r
JOIN staff_profiles sp
  ON r.recipient_id REGEXP '^[0-9]+$'
 AND sp.id = CAST(r.recipient_id AS UNSIGNED)
LEFT JOIN `user` u
  ON u.id = CAST(r.recipient_id AS UNSIGNED)
   SET r.viewer_staff_profile_id = sp.id
 WHERE r.viewer_staff_profile_id IS NULL
   AND u.id IS NULL;

UPDATE iset_event_receipt r
JOIN staff_profiles sp
  ON BINARY sp.cognito_sub = BINARY r.recipient_id
   SET r.viewer_staff_profile_id = sp.id
 WHERE r.viewer_staff_profile_id IS NULL;

UPDATE iset_event_receipt r
JOIN `user` u
  ON r.recipient_id REGEXP '^[0-9]+$'
 AND u.id = CAST(r.recipient_id AS UNSIGNED)
LEFT JOIN staff_profiles sp
  ON sp.id = CAST(r.recipient_id AS UNSIGNED)
   SET r.viewer_applicant_user_id = u.id
 WHERE r.viewer_staff_profile_id IS NULL
   AND r.viewer_applicant_user_id IS NULL
   AND sp.id IS NULL;

UPDATE iset_event_receipt r
JOIN `user` u
  ON BINARY u.cognito_sub = BINARY r.recipient_id
   SET r.viewer_applicant_user_id = u.id
 WHERE r.viewer_staff_profile_id IS NULL
   AND r.viewer_applicant_user_id IS NULL;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND constraint_name = 'fk_iset_event_receipt_viewer_staff_profile'
), 'ALTER TABLE iset_event_receipt ADD CONSTRAINT fk_iset_event_receipt_viewer_staff_profile FOREIGN KEY (viewer_staff_profile_id) REFERENCES staff_profiles(id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_event_receipt'
     AND constraint_name = 'fk_iset_event_receipt_viewer_applicant_user'
), 'ALTER TABLE iset_event_receipt ADD CONSTRAINT fk_iset_event_receipt_viewer_applicant_user FOREIGN KEY (viewer_applicant_user_id) REFERENCES `user`(id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_event_receipt_single_typed_viewer'
), 'ALTER TABLE iset_event_receipt ADD CONSTRAINT chk_iset_event_receipt_single_typed_viewer CHECK (viewer_staff_profile_id IS NULL OR viewer_applicant_user_id IS NULL)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
