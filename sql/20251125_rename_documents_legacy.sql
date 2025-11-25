-- Safely rename legacy documents table out of the active namespace.
-- This avoids hard drops while verifying no runtime dependencies remain.

SET @table_exists := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'documents'
);

SET @already_renamed := (
  SELECT COUNT(*) FROM information_schema.tables
  WHERE table_schema = DATABASE() AND table_name = 'zzz_legacy_documents'
);

SET @rename_sql := IF(
  @table_exists > 0 AND @already_renamed = 0,
  'RENAME TABLE `documents` TO `zzz_legacy_documents`',
  'SELECT 1'
);

PREPARE rename_stmt FROM @rename_sql;
EXECUTE rename_stmt;
DEALLOCATE PREPARE rename_stmt;
