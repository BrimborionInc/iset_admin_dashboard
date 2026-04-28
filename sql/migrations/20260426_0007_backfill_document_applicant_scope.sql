CREATE TABLE IF NOT EXISTS privacy_erm_document_applicant_scope_backfill_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(64) NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  old_applicant_user_id INT NULL,
  new_applicant_user_id INT NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_document_applicant_scope_backfill_doc (document_id),
  KEY idx_document_applicant_scope_backfill_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO privacy_erm_document_applicant_scope_backfill_audit (
  document_id,
  source,
  application_id,
  old_applicant_user_id,
  new_applicant_user_id
)
SELECT
  d.id,
  d.source,
  d.application_id,
  d.applicant_user_id,
  s.user_id
FROM iset_document d
JOIN iset_application a ON a.id = d.application_id
JOIN iset_application_submission s ON s.id = a.submission_id
WHERE d.source IN ('manual_upload', 'system_generated')
  AND d.application_id IS NOT NULL
  AND d.applicant_user_id IS NULL
  AND s.user_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  source = VALUES(source),
  application_id = VALUES(application_id),
  new_applicant_user_id = VALUES(new_applicant_user_id);

UPDATE iset_document d
JOIN iset_application a ON a.id = d.application_id
JOIN iset_application_submission s ON s.id = a.submission_id
   SET d.applicant_user_id = s.user_id,
       d.updated_at = CURRENT_TIMESTAMP
 WHERE d.source IN ('manual_upload', 'system_generated')
   AND d.application_id IS NOT NULL
   AND d.applicant_user_id IS NULL
   AND s.user_id IS NOT NULL;

SET @remaining_document_applicant_scope_violations = (
  SELECT COUNT(*)
    FROM iset_document
   WHERE source IN ('manual_upload', 'system_generated')
     AND application_id IS NOT NULL
     AND applicant_user_id IS NULL
);

SET @sql = IF(@remaining_document_applicant_scope_violations > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''application-linked document applicant scope blockers remain''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
