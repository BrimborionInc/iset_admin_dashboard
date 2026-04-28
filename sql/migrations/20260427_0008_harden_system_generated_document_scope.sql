UPDATE iset_document d
JOIN iset_application a
  ON a.id = d.application_id
LEFT JOIN iset_application_submission s
  ON s.id = a.submission_id
   SET d.applicant_user_id = s.user_id
 WHERE d.source = 'system_generated'
   AND d.application_id IS NOT NULL
   AND d.applicant_user_id IS NULL
   AND s.user_id IS NOT NULL;

SET @system_generated_document_scope_violations = (
  SELECT COUNT(*)
    FROM iset_document
   WHERE source = 'system_generated'
     AND (
       client_id IS NULL
       OR case_id IS NULL
       OR (application_id IS NOT NULL AND applicant_user_id IS NULL)
     )
);

DROP TEMPORARY TABLE IF EXISTS privacy_erm_system_generated_document_scope_guard;
CREATE TEMPORARY TABLE privacy_erm_system_generated_document_scope_guard (
  system_generated_application_documents_require_applicant_scope TINYINT NOT NULL
);

INSERT INTO privacy_erm_system_generated_document_scope_guard (
  system_generated_application_documents_require_applicant_scope
)
SELECT CASE
  WHEN @system_generated_document_scope_violations = 0 THEN 0
  ELSE NULL
END;

DROP TEMPORARY TABLE privacy_erm_system_generated_document_scope_guard;

SET @sql = (SELECT IF(EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_document_system_generated_scope'
), 'ALTER TABLE iset_document DROP CHECK chk_iset_document_system_generated_scope', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(NOT EXISTS (
  SELECT 1 FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_document_system_generated_scope'
), 'ALTER TABLE iset_document ADD CONSTRAINT chk_iset_document_system_generated_scope CHECK (source <> ''system_generated'' OR (client_id IS NOT NULL AND case_id IS NOT NULL AND (application_id IS NULL OR applicant_user_id IS NOT NULL)))', 'SELECT 1'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
