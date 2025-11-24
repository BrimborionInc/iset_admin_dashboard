-- Rework case/application relationship: move link onto iset_application.case_id
-- and drop the one-to-one pointer from iset_case.

-- Drop FK from iset_case -> iset_application if it exists, then drop the column.
SET @fk := (
  SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case'
     AND COLUMN_NAME = 'application_id'
     AND REFERENCED_TABLE_NAME = 'iset_application'
   LIMIT 1
);
SET @drop_fk_sql := IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE iset_case DROP FOREIGN KEY ', @fk));
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop the application_id column if present.
SET @has_app_col := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case'
     AND COLUMN_NAME = 'application_id'
);
SET @drop_col_sql := IF(@has_app_col = 0, 'SELECT 1', 'ALTER TABLE iset_case DROP COLUMN application_id');
PREPARE stmt FROM @drop_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add case_id to iset_application if missing.
SET @has_case_col := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND COLUMN_NAME = 'case_id'
);
SET @add_case_col_sql := IF(@has_case_col > 0,
  'SELECT 1',
  'ALTER TABLE iset_application ADD COLUMN case_id BIGINT UNSIGNED NULL AFTER submission_id'
);
PREPARE stmt FROM @add_case_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index on case_id if missing.
SET @has_case_idx := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND INDEX_NAME = 'idx_iset_application_case_id'
);
SET @add_case_idx_sql := IF(@has_case_idx > 0, 'SELECT 1', 'ALTER TABLE iset_application ADD INDEX idx_iset_application_case_id (case_id)');
PREPARE stmt FROM @add_case_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add FK from iset_application.case_id -> iset_case.id if missing.
SET @has_case_fk := (
  SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_application'
     AND COLUMN_NAME = 'case_id'
     AND REFERENCED_TABLE_NAME = 'iset_case'
);
SET @add_case_fk_sql := IF(@has_case_fk > 0,
  'SELECT 1',
  'ALTER TABLE iset_application ADD CONSTRAINT fk_iset_application_case_id FOREIGN KEY (case_id) REFERENCES iset_case(id) ON DELETE SET NULL'
);
PREPARE stmt FROM @add_case_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
