CREATE TABLE IF NOT EXISTS privacy_erm_internal_notification_shadow_retirement_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  notifications_total INT NOT NULL DEFAULT 0,
  audience_shadow_values INT NOT NULL DEFAULT 0,
  audience_canonical_values INT NOT NULL DEFAULT 0,
  audience_shadow_drift INT NOT NULL DEFAULT 0,
  dismissals_total INT NOT NULL DEFAULT 0,
  dismissal_shadow_values INT NOT NULL DEFAULT 0,
  dismissal_canonical_values INT NOT NULL DEFAULT 0,
  dismissal_shadow_drift INT NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @notification_audience_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND column_name = 'audience_user_id'
);

SET @notification_dismissal_shadow_exists = (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'user_id'
);

SELECT COUNT(*) INTO @notifications_total
  FROM iset_internal_notification;

SELECT COUNT(*) INTO @dismissals_total
  FROM iset_internal_notification_dismissal;

SELECT COALESCE(SUM(audience_staff_profile_id IS NOT NULL OR audience_applicant_user_id IS NOT NULL), 0)
  INTO @audience_canonical_values
  FROM iset_internal_notification;

SELECT COALESCE(SUM(viewer_staff_profile_id IS NOT NULL OR viewer_applicant_user_id IS NOT NULL), 0)
  INTO @dismissal_canonical_values
  FROM iset_internal_notification_dismissal;

SET @sql = IF(@notification_audience_shadow_exists > 0,
  'SELECT COALESCE(SUM(audience_user_id IS NOT NULL), 0) INTO @audience_shadow_values FROM iset_internal_notification',
  'SELECT 0 INTO @audience_shadow_values'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@notification_audience_shadow_exists > 0,
  'SELECT COUNT(*) INTO @audience_shadow_drift
     FROM iset_internal_notification
    WHERE (audience_type = ''user'' AND NOT (
            (audience_actor_type = ''staff_profile''
             AND audience_staff_profile_id IS NOT NULL
             AND audience_applicant_user_id IS NULL
             AND audience_user_id = audience_staff_profile_id)
         OR (audience_actor_type = ''applicant_user''
             AND audience_applicant_user_id IS NOT NULL
             AND audience_staff_profile_id IS NULL
             AND audience_user_id = audience_applicant_user_id)
          ))
       OR (audience_type <> ''user'' AND audience_user_id IS NOT NULL)',
  'SELECT 0 INTO @audience_shadow_drift'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@notification_dismissal_shadow_exists > 0,
  'SELECT COALESCE(SUM(user_id IS NOT NULL), 0) INTO @dismissal_shadow_values FROM iset_internal_notification_dismissal',
  'SELECT 0 INTO @dismissal_shadow_values'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@notification_dismissal_shadow_exists > 0,
  'SELECT COUNT(*) INTO @dismissal_shadow_drift
     FROM iset_internal_notification_dismissal
    WHERE NOT (
            (viewer_actor_type = ''staff_profile''
             AND viewer_staff_profile_id IS NOT NULL
             AND viewer_applicant_user_id IS NULL
             AND user_id = viewer_staff_profile_id)
         OR (viewer_actor_type = ''applicant_user''
             AND viewer_applicant_user_id IS NOT NULL
             AND viewer_staff_profile_id IS NULL
             AND user_id = viewer_applicant_user_id)
          )',
  'SELECT 0 INTO @dismissal_shadow_drift'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@audience_shadow_drift > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_internal_notification.audience_user_id drift detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@dismissal_shadow_drift > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_internal_notification_dismissal.user_id drift detected before retirement''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

INSERT INTO privacy_erm_internal_notification_shadow_retirement_audit (
  run_label,
  notifications_total,
  audience_shadow_values,
  audience_canonical_values,
  audience_shadow_drift,
  dismissals_total,
  dismissal_shadow_values,
  dismissal_canonical_values,
  dismissal_shadow_drift
) VALUES (
  'internal-notification-shadow-retirement-20260427',
  @notifications_total,
  @audience_shadow_values,
  @audience_canonical_values,
  @audience_shadow_drift,
  @dismissals_total,
  @dismissal_shadow_values,
  @dismissal_canonical_values,
  @dismissal_shadow_drift
);

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_audience_scope'
), 'ALTER TABLE iset_internal_notification DROP CHECK chk_internal_notification_audience_scope', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_dismissal_viewer_scope'
), 'ALTER TABLE iset_internal_notification_dismissal DROP CHECK chk_internal_notification_dismissal_viewer_scope', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_audience_typed_scope'
), 'ALTER TABLE iset_internal_notification ADD CONSTRAINT chk_internal_notification_audience_typed_scope CHECK (((audience_type = ''user'') AND (((audience_actor_type = ''staff_profile'') AND (audience_staff_profile_id IS NOT NULL) AND (audience_applicant_user_id IS NULL)) OR ((audience_actor_type = ''applicant_user'') AND (audience_applicant_user_id IS NOT NULL) AND (audience_staff_profile_id IS NULL)))) OR ((audience_type <> ''user'') AND (audience_actor_type IS NULL) AND (audience_staff_profile_id IS NULL) AND (audience_applicant_user_id IS NULL)))', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_dismissal_typed_viewer_scope'
), 'ALTER TABLE iset_internal_notification_dismissal ADD CONSTRAINT chk_internal_notification_dismissal_typed_viewer_scope CHECK (((viewer_actor_type = ''staff_profile'') AND (viewer_staff_profile_id IS NOT NULL) AND (viewer_applicant_user_id IS NULL)) OR ((viewer_actor_type = ''applicant_user'') AND (viewer_applicant_user_id IS NOT NULL) AND (viewer_staff_profile_id IS NULL)))', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @notification_audience_shadow_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND column_name = 'audience_user_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@notification_audience_shadow_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_internal_notification DROP FOREIGN KEY `', REPLACE(@notification_audience_shadow_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @notification_dismissal_shadow_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'user_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@notification_dismissal_shadow_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_internal_notification_dismissal DROP FOREIGN KEY `', REPLACE(@notification_dismissal_shadow_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND index_name = 'idx_iset_internal_notification_user'
), 'ALTER TABLE iset_internal_notification DROP INDEX idx_iset_internal_notification_user', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND index_name = 'idx_iset_internal_notification_dismissal_user'
), 'ALTER TABLE iset_internal_notification_dismissal DROP INDEX idx_iset_internal_notification_dismissal_user', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@notification_audience_shadow_exists > 0,
  'ALTER TABLE iset_internal_notification DROP COLUMN audience_user_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@notification_dismissal_shadow_exists > 0,
  'ALTER TABLE iset_internal_notification_dismissal DROP COLUMN user_id',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
