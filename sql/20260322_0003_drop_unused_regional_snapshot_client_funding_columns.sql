SET @schema_name = DATABASE();

SET @drop_crf_sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'iset_regional_snapshot_report'
      AND COLUMN_NAME = 'crf_funding_amount'
  ),
  'ALTER TABLE iset_regional_snapshot_report DROP COLUMN crf_funding_amount',
  'SELECT 1'
);
PREPARE drop_crf_stmt FROM @drop_crf_sql;
EXECUTE drop_crf_stmt;
DEALLOCATE PREPARE drop_crf_stmt;

SET @drop_ei_sql = IF(
  EXISTS (
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = @schema_name
      AND TABLE_NAME = 'iset_regional_snapshot_report'
      AND COLUMN_NAME = 'ei_funding_amount'
  ),
  'ALTER TABLE iset_regional_snapshot_report DROP COLUMN ei_funding_amount',
  'SELECT 1'
);
PREPARE drop_ei_stmt FROM @drop_ei_sql;
EXECUTE drop_ei_stmt;
DEALLOCATE PREPARE drop_ei_stmt;
