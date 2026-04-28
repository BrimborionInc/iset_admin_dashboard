CREATE TABLE IF NOT EXISTS privacy_erm_application_version_author_shadow_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  version_id BIGINT UNSIGNED NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  legacy_created_by_id VARCHAR(128) DEFAULT NULL,
  created_by_staff_profile_id BIGINT UNSIGNED DEFAULT NULL,
  created_by_user_id INT DEFAULT NULL,
  unresolved_legacy_author TINYINT(1) NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_app_version_author_shadow_version (version_id),
  KEY idx_app_version_author_shadow_application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @application_version_author_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application_version'
     AND column_name = 'created_by_id'
);

SET @sql = IF(@application_version_author_shadow_exists > 0,
  'INSERT INTO privacy_erm_application_version_author_shadow_retirement_audit (
     run_label,
     version_id,
     application_id,
     legacy_created_by_id,
     created_by_staff_profile_id,
     created_by_user_id,
     unresolved_legacy_author
   )
   SELECT
     ''application-version-author-shadow-retirement-20260427'',
     id,
     application_id,
     created_by_id,
     created_by_staff_profile_id,
     created_by_user_id,
     CASE
       WHEN created_by_id IS NOT NULL
        AND created_by_id <> ''''
        AND created_by_staff_profile_id IS NULL
        AND created_by_user_id IS NULL
       THEN 1 ELSE 0
     END
   FROM iset_application_version',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@application_version_author_shadow_exists > 0,
  'SELECT COUNT(*) INTO @application_version_unresolved_author_shadows
     FROM iset_application_version
    WHERE created_by_id IS NOT NULL
      AND created_by_id <> ''''
      AND created_by_staff_profile_id IS NULL
      AND created_by_user_id IS NULL',
  'SELECT 0 INTO @application_version_unresolved_author_shadows'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@application_version_unresolved_author_shadows > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_application_version.created_by_id has unresolved legacy author values before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@application_version_author_shadow_exists > 0,
  'ALTER TABLE iset_application_version DROP COLUMN created_by_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
