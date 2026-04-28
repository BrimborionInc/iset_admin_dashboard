SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_document_secure_message_attachment_scope'
), 'ALTER TABLE iset_document DROP CHECK chk_iset_document_secure_message_attachment_scope', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE iset_document
  ADD CONSTRAINT chk_iset_document_secure_message_attachment_scope
  CHECK (
    source <> 'secure_message_attachment'
    OR (
      client_id IS NOT NULL
      AND case_id IS NOT NULL
      AND applicant_user_id IS NOT NULL
      AND user_id IS NOT NULL
      AND origin_message_id IS NOT NULL
    )
  );
