CREATE TABLE IF NOT EXISTS privacy_erm_case_assignment_shadow_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  cases_total INT NOT NULL DEFAULT 0,
  legacy_shadow_values INT NOT NULL DEFAULT 0,
  explicit_values INT NOT NULL DEFAULT 0,
  assignment_shadow_drift INT NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @case_assignment_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND column_name = 'assigned_to_user_id'
);

SET @sql = IF(@case_assignment_shadow_exists > 0,
  'SELECT COUNT(*) INTO @assignment_shadow_drift FROM iset_case WHERE assigned_to_user_id IS NOT NULL AND (assigned_staff_profile_id IS NULL OR assigned_to_user_id <> assigned_staff_profile_id)',
  'SELECT 0 INTO @assignment_shadow_drift'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@assignment_shadow_drift > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_case.assigned_to_user_id drift detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_assignment_shadow_exists > 0,
  'INSERT INTO privacy_erm_case_assignment_shadow_retirement_audit (run_label, cases_total, legacy_shadow_values, explicit_values, assignment_shadow_drift) SELECT ''case-assignment-shadow-retirement-20260427'', COUNT(*), COALESCE(SUM(assigned_to_user_id IS NOT NULL), 0), COALESCE(SUM(assigned_staff_profile_id IS NOT NULL), 0), COALESCE(SUM(assigned_to_user_id IS NOT NULL AND (assigned_staff_profile_id IS NULL OR assigned_to_user_id <> assigned_staff_profile_id)), 0) FROM iset_case',
  'INSERT INTO privacy_erm_case_assignment_shadow_retirement_audit (run_label, cases_total, legacy_shadow_values, explicit_values, assignment_shadow_drift) SELECT ''case-assignment-shadow-retirement-20260427'', COUNT(*), 0, COALESCE(SUM(assigned_staff_profile_id IS NOT NULL), 0), 0 FROM iset_case'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @legacy_assignment_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND column_name = 'assigned_to_user_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@legacy_assignment_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_case DROP FOREIGN KEY `', REPLACE(@legacy_assignment_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND index_name = 'idx_iset_case_assigned_to_user_id'
), 'ALTER TABLE iset_case DROP INDEX idx_iset_case_assigned_to_user_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND index_name = 'idx_iset_case_lifecycle_owner'
), 'ALTER TABLE iset_case DROP INDEX idx_iset_case_lifecycle_owner', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_case'
     AND index_name = 'idx_iset_case_status_owner'
), 'ALTER TABLE iset_case DROP INDEX idx_iset_case_status_owner', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@case_assignment_shadow_exists > 0,
  'ALTER TABLE iset_case DROP COLUMN assigned_to_user_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
