SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND column_name = 'created_by_staff_profile_id'
), 'ALTER TABLE iset_application_version ADD COLUMN created_by_staff_profile_id BIGINT UNSIGNED NULL AFTER created_by_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND column_name = 'created_by_user_id'
), 'ALTER TABLE iset_application_version ADD COLUMN created_by_user_id INT NULL AFTER created_by_staff_profile_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND index_name = 'idx_application_version_created_by_staff_profile'
), 'CREATE INDEX idx_application_version_created_by_staff_profile ON iset_application_version (created_by_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND index_name = 'idx_application_version_created_by_user'
), 'CREATE INDEX idx_application_version_created_by_user ON iset_application_version (created_by_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iset_application_version v
JOIN staff_profiles sp
  ON v.created_by_id REGEXP '^[0-9]+$'
 AND sp.id = CAST(v.created_by_id AS UNSIGNED)
   SET v.created_by_staff_profile_id = sp.id
 WHERE v.created_by_staff_profile_id IS NULL;

UPDATE iset_application_version v
JOIN staff_profiles sp
  ON BINARY sp.cognito_sub = BINARY v.created_by_id
   SET v.created_by_staff_profile_id = sp.id
 WHERE v.created_by_staff_profile_id IS NULL;

UPDATE iset_application_version v
JOIN `user` u
  ON BINARY u.cognito_sub = BINARY v.created_by_id
   SET v.created_by_user_id = u.id
 WHERE v.created_by_user_id IS NULL;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND constraint_name = 'fk_iset_application_version_created_staff_profile'
), 'ALTER TABLE iset_application_version ADD CONSTRAINT fk_iset_application_version_created_staff_profile FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles(id) ON DELETE RESTRICT', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND constraint_name = 'fk_iset_application_version_created_user'
), 'ALTER TABLE iset_application_version ADD CONSTRAINT fk_iset_application_version_created_user FOREIGN KEY (created_by_user_id) REFERENCES `user`(id) ON DELETE RESTRICT', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
