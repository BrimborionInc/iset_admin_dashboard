CREATE TABLE IF NOT EXISTS privacy_erm_legacy_table_retirement_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  table_name VARCHAR(128) NOT NULL,
  row_count_before_drop BIGINT UNSIGNED NOT NULL,
  retired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_privacy_erm_legacy_table_retirement_table (table_name, retired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @legacy_jordan_application_exists = (
  SELECT 1 FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = 'jordan_application'
);
SET @legacy_jordan_application_exists = IFNULL(@legacy_jordan_application_exists, 0);
SET @legacy_jordan_application_count = 0;
SET @sql = IF(
  @legacy_jordan_application_exists > 0,
  'SELECT COUNT(*) INTO @legacy_jordan_application_count FROM jordan_application',
  'SELECT 0 INTO @legacy_jordan_application_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_jordan_application_draft_exists = (
  SELECT 1 FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = 'jordan_application_draft'
);
SET @legacy_jordan_application_draft_exists = IFNULL(@legacy_jordan_application_draft_exists, 0);
SET @legacy_jordan_application_draft_count = 0;
SET @sql = IF(
  @legacy_jordan_application_draft_exists > 0,
  'SELECT COUNT(*) INTO @legacy_jordan_application_draft_count FROM jordan_application_draft',
  'SELECT 0 INTO @legacy_jordan_application_draft_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS privacy_erm_jordan_drop_guard;
CREATE TEMPORARY TABLE privacy_erm_jordan_drop_guard (
  non_empty_legacy_jordan_tables_must_be_quarantined_before_drop TINYINT NOT NULL
);

INSERT INTO privacy_erm_jordan_drop_guard (
  non_empty_legacy_jordan_tables_must_be_quarantined_before_drop
)
SELECT CASE
  WHEN (@legacy_jordan_application_count + @legacy_jordan_application_draft_count) = 0 THEN 0
  ELSE NULL
END;

DROP TEMPORARY TABLE privacy_erm_jordan_drop_guard;

INSERT INTO privacy_erm_legacy_table_retirement_audit (table_name, row_count_before_drop, reason)
SELECT
  'jordan_application',
  @legacy_jordan_application_count,
  'Retired confirmed legacy Jordan application experiment table'
WHERE @legacy_jordan_application_exists > 0;

INSERT INTO privacy_erm_legacy_table_retirement_audit (table_name, row_count_before_drop, reason)
SELECT
  'jordan_application_draft',
  @legacy_jordan_application_draft_count,
  'Retired confirmed legacy Jordan application draft experiment table'
WHERE @legacy_jordan_application_draft_exists > 0;

DROP TABLE IF EXISTS jordan_application_draft;
DROP TABLE IF EXISTS jordan_application;
