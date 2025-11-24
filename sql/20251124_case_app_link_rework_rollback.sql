-- Roll back the case/application link rework:
-- - Reintroduce application_id on iset_case
-- - Drop case_id from iset_application

-- Add application_id to iset_case if missing.
SET @has_app_col := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case'
     AND COLUMN_NAME = 'application_id'
);
SET @add_app_col_sql := IF(@has_app_col > 0,
  'SELECT 1',
  'ALTER TABLE iset_case ADD COLUMN application_id BIGINT UNSIGNED NULL AFTER id'
);
PREPARE stmt FROM @add_app_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on application_id if missing.
SET @has_app_idx := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case'
     AND INDEX_NAME = 'idx_iset_case_application_id'
);
SET @add_app_idx_sql := IF(@has_app_idx > 0, 'SELECT 1', 'ALTER TABLE iset_case ADD INDEX idx_iset_case_application_id (application_id)');
PREPARE stmt FROM @add_app_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK iset_case.application_id -> iset_application.id if missing.
SET @has_app_fk := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case'
     AND COLUMN_NAME = 'application_id'
     AND REFERENCED_TABLE_NAME = 'iset_application'
);
SET @add_app_fk_sql := IF(@has_app_fk > 0,
  'SELECT 1',
  'ALTER TABLE iset_case ADD CONSTRAINT fk_iset_case_application_id FOREIGN KEY (application_id) REFERENCES iset_application(id) ON DELETE SET NULL'
);
PREPARE stmt FROM @add_app_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop FK from iset_application.case_id if exists.
SET @fk_case := (
  SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND COLUMN_NAME = 'case_id'
     AND REFERENCED_TABLE_NAME = 'iset_case'
   LIMIT 1
);
SET @drop_case_fk_sql := IF(@fk_case IS NULL, 'SELECT 1', CONCAT('ALTER TABLE iset_application DROP FOREIGN KEY ', @fk_case));
PREPARE stmt FROM @drop_case_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop index on case_id if present.
SET @has_case_idx := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND INDEX_NAME = 'idx_iset_application_case_id'
);
SET @drop_case_idx_sql := IF(@has_case_idx = 0, 'SELECT 1', 'ALTER TABLE iset_application DROP INDEX idx_iset_application_case_id');
PREPARE stmt FROM @drop_case_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop case_id column if present.
SET @has_case_col := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND COLUMN_NAME = 'case_id'
);
SET @drop_case_col_sql := IF(@has_case_col = 0, 'SELECT 1', 'ALTER TABLE iset_application DROP COLUMN case_id');
PREPARE stmt FROM @drop_case_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
