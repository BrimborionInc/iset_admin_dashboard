SET @has_applicant_cognito_username := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_cognito_username'
);
SET @sql_add_applicant_cognito_username := IF(
  @has_applicant_cognito_username = 0,
  'ALTER TABLE client ADD COLUMN applicant_cognito_username VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER applicant_cognito_sub',
  'SELECT 1'
);
PREPARE stmt_add_applicant_cognito_username FROM @sql_add_applicant_cognito_username;
EXECUTE stmt_add_applicant_cognito_username;
DEALLOCATE PREPARE stmt_add_applicant_cognito_username;

SET @has_applicant_account_status := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_account_status'
);
SET @sql_add_applicant_account_status := IF(
  @has_applicant_account_status = 0,
  'ALTER TABLE client ADD COLUMN applicant_account_status ENUM(''created'',''invitation_sent'',''activated'') NULL AFTER applicant_cognito_username',
  'SELECT 1'
);
PREPARE stmt_add_applicant_account_status FROM @sql_add_applicant_account_status;
EXECUTE stmt_add_applicant_account_status;
DEALLOCATE PREPARE stmt_add_applicant_account_status;

SET @has_applicant_account_email := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_account_email'
);
SET @sql_add_applicant_account_email := IF(
  @has_applicant_account_email = 0,
  'ALTER TABLE client ADD COLUMN applicant_account_email VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL AFTER applicant_account_status',
  'SELECT 1'
);
PREPARE stmt_add_applicant_account_email FROM @sql_add_applicant_account_email;
EXECUTE stmt_add_applicant_account_email;
DEALLOCATE PREPARE stmt_add_applicant_account_email;

SET @has_applicant_invited_at := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_invited_at'
);
SET @sql_add_applicant_invited_at := IF(
  @has_applicant_invited_at = 0,
  'ALTER TABLE client ADD COLUMN applicant_invited_at DATETIME NULL AFTER applicant_account_email',
  'SELECT 1'
);
PREPARE stmt_add_applicant_invited_at FROM @sql_add_applicant_invited_at;
EXECUTE stmt_add_applicant_invited_at;
DEALLOCATE PREPARE stmt_add_applicant_invited_at;

SET @has_applicant_invited_by_staff_profile_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_invited_by_staff_profile_id'
);
SET @sql_add_applicant_invited_by_staff_profile_id := IF(
  @has_applicant_invited_by_staff_profile_id = 0,
  'ALTER TABLE client ADD COLUMN applicant_invited_by_staff_profile_id BIGINT UNSIGNED NULL AFTER applicant_invited_at',
  'SELECT 1'
);
PREPARE stmt_add_applicant_invited_by_staff_profile_id FROM @sql_add_applicant_invited_by_staff_profile_id;
EXECUTE stmt_add_applicant_invited_by_staff_profile_id;
DEALLOCATE PREPARE stmt_add_applicant_invited_by_staff_profile_id;

SET @has_applicant_activated_at := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND column_name = 'applicant_activated_at'
);
SET @sql_add_applicant_activated_at := IF(
  @has_applicant_activated_at = 0,
  'ALTER TABLE client ADD COLUMN applicant_activated_at DATETIME NULL AFTER applicant_invited_by_staff_profile_id',
  'SELECT 1'
);
PREPARE stmt_add_applicant_activated_at FROM @sql_add_applicant_activated_at;
EXECUTE stmt_add_applicant_activated_at;
DEALLOCATE PREPARE stmt_add_applicant_activated_at;

SET @has_username_key := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND index_name = 'uq_client_applicant_cognito_username'
);
SET @sql_add_username_key := IF(
  @has_username_key = 0,
  'ALTER TABLE client ADD UNIQUE KEY uq_client_applicant_cognito_username (applicant_cognito_username)',
  'SELECT 1'
);
PREPARE stmt_add_username_key FROM @sql_add_username_key;
EXECUTE stmt_add_username_key;
DEALLOCATE PREPARE stmt_add_username_key;

SET @has_status_key := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND index_name = 'idx_client_applicant_account_status'
);
SET @sql_add_status_key := IF(
  @has_status_key = 0,
  'ALTER TABLE client ADD KEY idx_client_applicant_account_status (applicant_account_status)',
  'SELECT 1'
);
PREPARE stmt_add_status_key FROM @sql_add_status_key;
EXECUTE stmt_add_status_key;
DEALLOCATE PREPARE stmt_add_status_key;

SET @has_invited_by_key := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'client'
    AND index_name = 'idx_client_applicant_invited_by_staff_profile'
);
SET @sql_add_invited_by_key := IF(
  @has_invited_by_key = 0,
  'ALTER TABLE client ADD KEY idx_client_applicant_invited_by_staff_profile (applicant_invited_by_staff_profile_id)',
  'SELECT 1'
);
PREPARE stmt_add_invited_by_key FROM @sql_add_invited_by_key;
EXECUTE stmt_add_invited_by_key;
DEALLOCATE PREPARE stmt_add_invited_by_key;

CREATE TABLE IF NOT EXISTS client_applicant_account_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  client_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_staff_profile_id BIGINT UNSIGNED NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_client_applicant_account_event_client (client_id),
  KEY idx_client_applicant_account_event_type (event_type),
  KEY idx_client_applicant_account_event_actor (actor_staff_profile_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
