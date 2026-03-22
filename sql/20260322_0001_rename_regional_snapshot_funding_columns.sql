SET @schema_name = DATABASE();

SET @has_old_crf = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'iset_regional_snapshot_report'
    AND COLUMN_NAME = 'er_funding_amount'
);
SET @has_new_crf = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'iset_regional_snapshot_report'
    AND COLUMN_NAME = 'crf_funding_amount'
);
SET @rename_crf_sql = IF(
  @has_old_crf > 0 AND @has_new_crf = 0,
  'ALTER TABLE iset_regional_snapshot_report CHANGE COLUMN er_funding_amount crf_funding_amount DECIMAL(14,2) NULL',
  'SELECT 1'
);
PREPARE rename_crf_stmt FROM @rename_crf_sql;
EXECUTE rename_crf_stmt;
DEALLOCATE PREPARE rename_crf_stmt;

SET @has_old_ei = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'iset_regional_snapshot_report'
    AND COLUMN_NAME = 'if_funding_amount'
);
SET @has_new_ei = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = @schema_name
    AND TABLE_NAME = 'iset_regional_snapshot_report'
    AND COLUMN_NAME = 'ei_funding_amount'
);
SET @rename_ei_sql = IF(
  @has_old_ei > 0 AND @has_new_ei = 0,
  'ALTER TABLE iset_regional_snapshot_report CHANGE COLUMN if_funding_amount ei_funding_amount DECIMAL(14,2) NULL',
  'SELECT 1'
);
PREPARE rename_ei_stmt FROM @rename_ei_sql;
EXECUTE rename_ei_stmt;
DEALLOCATE PREPARE rename_ei_stmt;
