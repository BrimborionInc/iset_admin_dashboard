UPDATE messages m
JOIN iset_case c ON c.id = m.case_id
   SET m.application_id = c.application_id
 WHERE m.application_id IS NULL
   AND c.application_id IS NOT NULL;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_case'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_case', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_application'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_application', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_sender_user'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_sender_user', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_recipient_user'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_recipient_user', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_sender_staff_profile'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_sender_staff_profile', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'messages' AND constraint_name = 'fk_messages_recipient_staff_profile'
), 'ALTER TABLE messages DROP FOREIGN KEY fk_messages_recipient_staff_profile', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE messages
  MODIFY COLUMN sender_actor_type ENUM('applicant_user','staff_profile','local_user','system') NOT NULL,
  MODIFY COLUMN recipient_actor_type ENUM('applicant_user','staff_profile','local_user','system') NOT NULL,
  MODIFY COLUMN case_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE messages
  ADD CONSTRAINT fk_messages_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_sender_user
    FOREIGN KEY (sender_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_recipient_user
    FOREIGN KEY (recipient_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_sender_staff_profile
    FOREIGN KEY (sender_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_recipient_staff_profile
    FOREIGN KEY (recipient_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE RESTRICT;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_messages_sender_actor_scope'
), 'ALTER TABLE messages ADD CONSTRAINT chk_messages_sender_actor_scope CHECK ((sender_actor_type = ''applicant_user'' AND sender_user_id IS NOT NULL AND sender_staff_profile_id IS NULL) OR (sender_actor_type = ''staff_profile'' AND sender_user_id IS NOT NULL AND sender_staff_profile_id IS NOT NULL) OR (sender_actor_type = ''local_user'' AND sender_user_id IS NOT NULL AND sender_staff_profile_id IS NULL) OR (sender_actor_type = ''system'' AND sender_staff_profile_id IS NULL))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_messages_recipient_actor_scope'
), 'ALTER TABLE messages ADD CONSTRAINT chk_messages_recipient_actor_scope CHECK ((recipient_actor_type = ''applicant_user'' AND recipient_user_id IS NOT NULL AND recipient_staff_profile_id IS NULL) OR (recipient_actor_type = ''staff_profile'' AND recipient_user_id IS NOT NULL AND recipient_staff_profile_id IS NOT NULL) OR (recipient_actor_type = ''local_user'' AND recipient_user_id IS NOT NULL AND recipient_staff_profile_id IS NULL) OR (recipient_actor_type = ''system'' AND recipient_staff_profile_id IS NULL))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_messages_exactly_one_applicant_actor'
), 'ALTER TABLE messages ADD CONSTRAINT chk_messages_exactly_one_applicant_actor CHECK ((sender_actor_type = ''applicant_user'' AND recipient_actor_type <> ''applicant_user'') OR (recipient_actor_type = ''applicant_user'' AND sender_actor_type <> ''applicant_user''))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'message_attachment_ibfk_1'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY message_attachment_ibfk_1', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'fk_message_attachment_message'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY fk_message_attachment_message', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'fk_message_attachment_case'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY fk_message_attachment_case', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'fk_message_attachment_application'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY fk_message_attachment_application', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'fk_message_attachment_client'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY fk_message_attachment_client', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'message_attachment' AND constraint_name = 'fk_message_attachment_user'
), 'ALTER TABLE message_attachment DROP FOREIGN KEY fk_message_attachment_user', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE message_attachment
  MODIFY COLUMN case_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN client_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN user_id INT NOT NULL;

ALTER TABLE message_attachment
  ADD CONSTRAINT fk_message_attachment_message
    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_message_attachment_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_message_attachment_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_message_attachment_client
    FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_message_attachment_user
    FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE RESTRICT;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_message_attachment_required_scope'
), 'ALTER TABLE message_attachment ADD CONSTRAINT chk_message_attachment_required_scope CHECK (message_id IS NOT NULL AND case_id IS NOT NULL AND client_id IS NOT NULL AND user_id IS NOT NULL)', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_user'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_user', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_applicant_user'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_applicant_user', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_case'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_case', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_application'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_application', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_client'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_client', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'iset_document' AND constraint_name = 'fk_iset_document_origin_message'
), 'ALTER TABLE iset_document DROP FOREIGN KEY fk_iset_document_origin_message', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE iset_document
  ADD CONSTRAINT fk_iset_document_user
    FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_document_applicant_user
    FOREIGN KEY (applicant_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_document_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_document_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_document_client
    FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_document_origin_message
    FOREIGN KEY (origin_message_id) REFERENCES messages (id) ON DELETE RESTRICT;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_iset_document_application_submission_scope'
), 'ALTER TABLE iset_document ADD CONSTRAINT chk_iset_document_application_submission_scope CHECK (source <> ''application_submission'' OR (client_id IS NOT NULL AND case_id IS NOT NULL AND application_id IS NOT NULL AND applicant_user_id IS NOT NULL))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_iset_document_manual_upload_scope'
), 'ALTER TABLE iset_document DROP CHECK chk_iset_document_manual_upload_scope', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_iset_document_manual_upload_scope'
), 'ALTER TABLE iset_document ADD CONSTRAINT chk_iset_document_manual_upload_scope CHECK (source <> ''manual_upload'' OR (client_id IS NOT NULL AND case_id IS NOT NULL AND (application_id IS NULL OR applicant_user_id IS NOT NULL)))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_iset_document_secure_message_attachment_scope'
), 'ALTER TABLE iset_document ADD CONSTRAINT chk_iset_document_secure_message_attachment_scope CHECK (source <> ''secure_message_attachment'' OR (client_id IS NOT NULL AND case_id IS NOT NULL AND application_id IS NOT NULL AND applicant_user_id IS NOT NULL AND user_id IS NOT NULL AND origin_message_id IS NOT NULL))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE() AND constraint_name = 'chk_iset_document_system_generated_scope'
), 'ALTER TABLE iset_document ADD CONSTRAINT chk_iset_document_system_generated_scope CHECK (source <> ''system_generated'' OR (client_id IS NOT NULL AND case_id IS NOT NULL))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
