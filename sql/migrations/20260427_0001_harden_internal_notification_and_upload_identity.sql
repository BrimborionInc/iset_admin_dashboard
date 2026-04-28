SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND column_name = 'audience_actor_type'
), 'ALTER TABLE iset_internal_notification ADD COLUMN audience_actor_type ENUM(''staff_profile'',''applicant_user'') DEFAULT NULL AFTER audience_type', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND column_name = 'audience_staff_profile_id'
), 'ALTER TABLE iset_internal_notification ADD COLUMN audience_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER audience_user_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND column_name = 'audience_applicant_user_id'
), 'ALTER TABLE iset_internal_notification ADD COLUMN audience_applicant_user_id INT DEFAULT NULL AFTER audience_staff_profile_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iset_internal_notification n
LEFT JOIN staff_profiles sp ON sp.id = n.audience_user_id
LEFT JOIN `user` u ON u.id = n.audience_user_id
   SET n.audience_actor_type = CASE
         WHEN n.audience_type = 'user' AND sp.id IS NOT NULL THEN 'staff_profile'
         WHEN n.audience_type = 'user' AND u.id IS NOT NULL THEN 'applicant_user'
         ELSE NULL
       END,
       n.audience_staff_profile_id = CASE
         WHEN n.audience_type = 'user' AND sp.id IS NOT NULL THEN sp.id
         ELSE NULL
       END,
       n.audience_applicant_user_id = CASE
         WHEN n.audience_type = 'user' AND sp.id IS NULL AND u.id IS NOT NULL THEN u.id
         ELSE NULL
       END;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND index_name = 'idx_internal_notification_actor'
), 'ALTER TABLE iset_internal_notification ADD KEY idx_internal_notification_actor (audience_actor_type, audience_staff_profile_id, audience_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND index_name = 'idx_internal_notification_staff_profile'
), 'ALTER TABLE iset_internal_notification ADD KEY idx_internal_notification_staff_profile (audience_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND index_name = 'idx_internal_notification_applicant_user'
), 'ALTER TABLE iset_internal_notification ADD KEY idx_internal_notification_applicant_user (audience_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND constraint_name = 'fk_internal_notification_staff_profile'
), 'ALTER TABLE iset_internal_notification ADD CONSTRAINT fk_internal_notification_staff_profile FOREIGN KEY (audience_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_internal_notification'
     AND constraint_name = 'fk_internal_notification_applicant_user'
), 'ALTER TABLE iset_internal_notification ADD CONSTRAINT fk_internal_notification_applicant_user FOREIGN KEY (audience_applicant_user_id) REFERENCES `user` (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_audience_scope'
), 'ALTER TABLE iset_internal_notification ADD CONSTRAINT chk_internal_notification_audience_scope CHECK (((audience_type = ''user'') AND (((audience_actor_type = ''staff_profile'') AND (audience_staff_profile_id IS NOT NULL) AND (audience_applicant_user_id IS NULL) AND (audience_user_id = audience_staff_profile_id)) OR ((audience_actor_type = ''applicant_user'') AND (audience_applicant_user_id IS NOT NULL) AND (audience_staff_profile_id IS NULL) AND (audience_user_id = audience_applicant_user_id)))) OR ((audience_type <> ''user'') AND (audience_actor_type IS NULL) AND (audience_user_id IS NULL) AND (audience_staff_profile_id IS NULL) AND (audience_applicant_user_id IS NULL)))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'id'
), 'ALTER TABLE iset_internal_notification_dismissal DROP PRIMARY KEY, ADD COLUMN id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT FIRST, ADD COLUMN viewer_actor_type ENUM(''staff_profile'',''applicant_user'') DEFAULT NULL AFTER user_id, ADD COLUMN viewer_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER viewer_actor_type, ADD COLUMN viewer_applicant_user_id INT DEFAULT NULL AFTER viewer_staff_profile_id, ADD PRIMARY KEY (id), ADD KEY idx_internal_notification_dismissal_notification (notification_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'viewer_actor_type'
), 'ALTER TABLE iset_internal_notification_dismissal ADD COLUMN viewer_actor_type ENUM(''staff_profile'',''applicant_user'') DEFAULT NULL AFTER user_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'viewer_staff_profile_id'
), 'ALTER TABLE iset_internal_notification_dismissal ADD COLUMN viewer_staff_profile_id BIGINT UNSIGNED DEFAULT NULL AFTER viewer_actor_type', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND column_name = 'viewer_applicant_user_id'
), 'ALTER TABLE iset_internal_notification_dismissal ADD COLUMN viewer_applicant_user_id INT DEFAULT NULL AFTER viewer_staff_profile_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iset_internal_notification_dismissal d
LEFT JOIN staff_profiles sp ON sp.id = d.user_id
LEFT JOIN `user` u ON u.id = d.user_id
   SET d.viewer_actor_type = CASE
         WHEN sp.id IS NOT NULL THEN 'staff_profile'
         WHEN u.id IS NOT NULL THEN 'applicant_user'
         ELSE NULL
       END,
       d.viewer_staff_profile_id = CASE
         WHEN sp.id IS NOT NULL THEN sp.id
         ELSE NULL
       END,
       d.viewer_applicant_user_id = CASE
         WHEN sp.id IS NULL AND u.id IS NOT NULL THEN u.id
         ELSE NULL
       END;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND index_name = 'uniq_internal_notification_dismissal_staff'
), 'ALTER TABLE iset_internal_notification_dismissal ADD UNIQUE KEY uniq_internal_notification_dismissal_staff (notification_id, viewer_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND index_name = 'uniq_internal_notification_dismissal_applicant'
), 'ALTER TABLE iset_internal_notification_dismissal ADD UNIQUE KEY uniq_internal_notification_dismissal_applicant (notification_id, viewer_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND index_name = 'idx_internal_notification_dismissal_staff'
), 'ALTER TABLE iset_internal_notification_dismissal ADD KEY idx_internal_notification_dismissal_staff (viewer_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND index_name = 'idx_internal_notification_dismissal_applicant'
), 'ALTER TABLE iset_internal_notification_dismissal ADD KEY idx_internal_notification_dismissal_applicant (viewer_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND constraint_name = 'fk_internal_notification_dismissal_staff_profile'
), 'ALTER TABLE iset_internal_notification_dismissal ADD CONSTRAINT fk_internal_notification_dismissal_staff_profile FOREIGN KEY (viewer_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_internal_notification_dismissal'
     AND constraint_name = 'fk_internal_notification_dismissal_applicant_user'
), 'ALTER TABLE iset_internal_notification_dismissal ADD CONSTRAINT fk_internal_notification_dismissal_applicant_user FOREIGN KEY (viewer_applicant_user_id) REFERENCES `user` (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_internal_notification_dismissal_viewer_scope'
), 'ALTER TABLE iset_internal_notification_dismissal ADD CONSTRAINT chk_internal_notification_dismissal_viewer_scope CHECK (((viewer_actor_type = ''staff_profile'') AND (viewer_staff_profile_id IS NOT NULL) AND (viewer_applicant_user_id IS NULL) AND (user_id = viewer_staff_profile_id)) OR ((viewer_actor_type = ''applicant_user'') AND (viewer_applicant_user_id IS NOT NULL) AND (viewer_staff_profile_id IS NULL) AND (user_id = viewer_applicant_user_id)))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'pending_uploads'
     AND constraint_name = 'fk_pending_uploads_user'
), 'ALTER TABLE pending_uploads ADD CONSTRAINT fk_pending_uploads_user FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'application_lock'
     AND constraint_name = 'fk_application_lock_application'
), 'ALTER TABLE application_lock ADD CONSTRAINT fk_application_lock_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE CASCADE', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
