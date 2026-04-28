SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND column_name = 'actor_staff_profile_id'
), 'ALTER TABLE iset_event_entry ADD COLUMN actor_staff_profile_id BIGINT UNSIGNED NULL AFTER actor_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND column_name = 'actor_applicant_user_id'
), 'ALTER TABLE iset_event_entry ADD COLUMN actor_applicant_user_id INT NULL AFTER actor_staff_profile_id', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND index_name = 'idx_iset_event_entry_actor_staff_profile'
), 'CREATE INDEX idx_iset_event_entry_actor_staff_profile ON iset_event_entry (actor_staff_profile_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND index_name = 'idx_iset_event_entry_actor_applicant_user'
), 'CREATE INDEX idx_iset_event_entry_actor_applicant_user ON iset_event_entry (actor_applicant_user_id)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE iset_event_entry e
JOIN user u
  ON e.actor_type = 'applicant'
 AND e.actor_id REGEXP '^[0-9]+$'
 AND u.id = CAST(e.actor_id AS UNSIGNED)
   SET e.actor_applicant_user_id = u.id
 WHERE e.actor_applicant_user_id IS NULL;

UPDATE iset_event_entry e
JOIN staff_profiles sp
  ON e.actor_type = 'staff'
 AND e.actor_id REGEXP '^[0-9]+$'
 AND sp.id = CAST(e.actor_id AS UNSIGNED)
   SET e.actor_staff_profile_id = sp.id
 WHERE e.actor_staff_profile_id IS NULL;

UPDATE iset_event_entry e
JOIN staff_profiles sp
  ON e.actor_type = 'staff'
 AND BINARY sp.cognito_sub = BINARY e.actor_id
   SET e.actor_staff_profile_id = sp.id
 WHERE e.actor_staff_profile_id IS NULL;

UPDATE iset_event_entry e
JOIN staff_profiles sp
  ON e.actor_type = 'staff'
 AND BINARY sp.cognito_sub = BINARY e.captured_by
   SET e.actor_staff_profile_id = sp.id
 WHERE e.actor_staff_profile_id IS NULL;

UPDATE iset_event_entry e
JOIN messages m
  ON e.event_type = 'message_received'
 AND JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.message_id')) REGEXP '^[0-9]+$'
 AND m.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(e.payload_json, '$.message_id')) AS UNSIGNED)
   SET e.actor_staff_profile_id = m.sender_staff_profile_id
 WHERE e.actor_type = 'staff'
   AND e.actor_staff_profile_id IS NULL
   AND m.sender_staff_profile_id IS NOT NULL;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND constraint_name = 'fk_iset_event_entry_actor_staff_profile'
), 'ALTER TABLE iset_event_entry ADD CONSTRAINT fk_iset_event_entry_actor_staff_profile FOREIGN KEY (actor_staff_profile_id) REFERENCES staff_profiles(id) ON DELETE RESTRICT', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'iset_event_entry'
     AND constraint_name = 'fk_iset_event_entry_actor_applicant_user'
), 'ALTER TABLE iset_event_entry ADD CONSTRAINT fk_iset_event_entry_actor_applicant_user FOREIGN KEY (actor_applicant_user_id) REFERENCES user(id) ON DELETE RESTRICT', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
