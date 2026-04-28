CREATE TABLE IF NOT EXISTS privacy_erm_case_application_pointer_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  case_id BIGINT UNSIGNED DEFAULT NULL,
  legacy_application_id BIGINT UNSIGNED DEFAULT NULL,
  case_client_id BIGINT UNSIGNED DEFAULT NULL,
  legacy_application_pre_case_id BIGINT UNSIGNED DEFAULT NULL,
  legacy_application_pre_client_id BIGINT UNSIGNED DEFAULT NULL,
  legacy_application_post_case_id BIGINT UNSIGNED DEFAULT NULL,
  legacy_application_post_client_id BIGINT UNSIGNED DEFAULT NULL,
  canonical_application_ids_before TEXT DEFAULT NULL,
  canonical_application_ids_after TEXT DEFAULT NULL,
  mismatch_before TINYINT(1) NOT NULL DEFAULT 0,
  mismatch_after TINYINT(1) NOT NULL DEFAULT 0,
  client_mismatch_before TINYINT(1) NOT NULL DEFAULT 0,
  client_mismatch_after TINYINT(1) NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_case_application_pointer_audit_case (case_id),
  KEY idx_case_application_pointer_audit_legacy_app (legacy_application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @case_application_pointer_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND column_name = 'application_id'
);

SET @sql = IF(@case_application_pointer_exists > 0,
  'SELECT COUNT(*) INTO @case_application_duplicate_pointer_groups FROM (SELECT application_id FROM iset_case WHERE application_id IS NOT NULL GROUP BY application_id HAVING COUNT(*) > 1) duplicate_pointer_groups',
  'SELECT 0 INTO @case_application_duplicate_pointer_groups'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_duplicate_pointer_groups > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''duplicate iset_case.application_id pointer groups detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'SELECT COUNT(*) INTO @case_application_missing_pointer_apps FROM iset_case c LEFT JOIN iset_application a ON a.id = c.application_id WHERE c.application_id IS NOT NULL AND a.id IS NULL',
  'SELECT 0 INTO @case_application_missing_pointer_apps'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_missing_pointer_apps > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_case.application_id points at missing applications before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'INSERT INTO privacy_erm_case_application_pointer_retirement_audit (
     run_label,
     case_id,
     legacy_application_id,
     case_client_id,
     legacy_application_pre_case_id,
     legacy_application_pre_client_id,
     canonical_application_ids_before,
     mismatch_before,
     client_mismatch_before
   )
   SELECT
     ''case-application-pointer-retirement-20260427'',
     c.id,
     c.application_id,
     c.client_id,
     legacy_app.case_id,
     legacy_app.client_id,
     (
       SELECT GROUP_CONCAT(a_before.id ORDER BY COALESCE(a_before.updated_at, a_before.created_at) DESC, a_before.id DESC)
         FROM iset_application a_before
        WHERE a_before.case_id = c.id
     ) AS canonical_application_ids_before,
     CASE
       WHEN c.application_id IS NOT NULL
        AND (legacy_app.id IS NULL OR (legacy_app.case_id IS NOT NULL AND legacy_app.case_id <> c.id))
       THEN 1 ELSE 0
     END AS mismatch_before,
     CASE
       WHEN c.application_id IS NOT NULL
        AND c.client_id IS NOT NULL
        AND legacy_app.client_id IS NOT NULL
        AND legacy_app.client_id <> c.client_id
       THEN 1 ELSE 0
     END AS client_mismatch_before
   FROM iset_case c
   LEFT JOIN iset_application legacy_app ON legacy_app.id = c.application_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'UPDATE iset_application a
      JOIN iset_case c ON c.application_id = a.id
     SET a.case_id = COALESCE(a.case_id, c.id),
         a.client_id = COALESCE(a.client_id, c.client_id),
         a.lifecycle_status = COALESCE(a.lifecycle_status, ''submitted''),
         a.awaiting_reason = COALESCE(a.awaiting_reason, ''none''),
         a.updated_at = NOW()
   WHERE c.application_id IS NOT NULL
     AND (a.case_id IS NULL OR a.client_id IS NULL OR a.lifecycle_status IS NULL OR a.awaiting_reason IS NULL)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'SELECT COUNT(*) INTO @case_application_pointer_mismatch_after
     FROM iset_case c
     JOIN iset_application a ON a.id = c.application_id
    WHERE a.case_id <> c.id
       OR (a.client_id IS NOT NULL AND c.client_id IS NOT NULL AND a.client_id <> c.client_id)',
  'SELECT 0 INTO @case_application_pointer_mismatch_after'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_mismatch_after > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_case.application_id mismatches canonical application ownership after backfill''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'SELECT COUNT(*) INTO @applications_missing_case_after FROM iset_application WHERE case_id IS NULL',
  'SELECT 0 INTO @applications_missing_case_after'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@applications_missing_case_after > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_application rows without case_id remain after case/application pointer backfill''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'UPDATE privacy_erm_case_application_pointer_retirement_audit audit_row
      LEFT JOIN iset_application legacy_app ON legacy_app.id = audit_row.legacy_application_id
     SET audit_row.legacy_application_post_case_id = legacy_app.case_id,
         audit_row.legacy_application_post_client_id = legacy_app.client_id,
         audit_row.canonical_application_ids_after = (
           SELECT GROUP_CONCAT(a_after.id ORDER BY COALESCE(a_after.updated_at, a_after.created_at) DESC, a_after.id DESC)
             FROM iset_application a_after
            WHERE a_after.case_id = audit_row.case_id
         ),
         audit_row.mismatch_after = CASE
           WHEN audit_row.legacy_application_id IS NOT NULL
            AND (legacy_app.id IS NULL OR legacy_app.case_id <> audit_row.case_id)
           THEN 1 ELSE 0
         END,
         audit_row.client_mismatch_after = CASE
           WHEN audit_row.legacy_application_id IS NOT NULL
            AND audit_row.case_client_id IS NOT NULL
            AND legacy_app.client_id IS NOT NULL
            AND legacy_app.client_id <> audit_row.case_client_id
           THEN 1 ELSE 0
         END
    WHERE audit_row.run_label = ''case-application-pointer-retirement-20260427''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_case_application_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND column_name = 'application_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@case_application_pointer_exists > 0 AND @legacy_case_application_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_case DROP FOREIGN KEY `', REPLACE(@legacy_case_application_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_application_pointer_exists > 0,
  'ALTER TABLE iset_case DROP COLUMN application_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
