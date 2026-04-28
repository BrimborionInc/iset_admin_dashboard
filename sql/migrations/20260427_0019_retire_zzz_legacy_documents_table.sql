CREATE TABLE IF NOT EXISTS privacy_erm_legacy_table_retirement_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  table_name VARCHAR(128) NOT NULL,
  row_count_before_drop BIGINT UNSIGNED NOT NULL,
  retired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_privacy_erm_legacy_table_retirement_table (table_name, retired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @legacy_zzz_documents_exists = (
  SELECT 1 FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = 'zzz_legacy_documents'
);
SET @legacy_zzz_documents_exists = IFNULL(@legacy_zzz_documents_exists, 0);
SET @legacy_zzz_documents_count = 0;
SET @sql = IF(
  @legacy_zzz_documents_exists > 0,
  'SELECT COUNT(*) INTO @legacy_zzz_documents_count FROM zzz_legacy_documents',
  'SELECT 0 INTO @legacy_zzz_documents_count'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TEMPORARY TABLE IF EXISTS privacy_erm_zzz_legacy_documents_drop_guard;
CREATE TEMPORARY TABLE privacy_erm_zzz_legacy_documents_drop_guard (
  non_empty_legacy_documents_must_be_quarantined_before_drop TINYINT NOT NULL
);

INSERT INTO privacy_erm_zzz_legacy_documents_drop_guard (
  non_empty_legacy_documents_must_be_quarantined_before_drop
)
SELECT CASE
  WHEN @legacy_zzz_documents_count = 0 THEN 0
  ELSE NULL
END;

DROP TEMPORARY TABLE privacy_erm_zzz_legacy_documents_drop_guard;

INSERT INTO privacy_erm_legacy_table_retirement_audit (table_name, row_count_before_drop, reason)
SELECT
  'zzz_legacy_documents',
  @legacy_zzz_documents_count,
  'Retired confirmed-empty legacy document upload experiment table'
WHERE @legacy_zzz_documents_exists > 0;

DROP TABLE IF EXISTS zzz_legacy_documents;
