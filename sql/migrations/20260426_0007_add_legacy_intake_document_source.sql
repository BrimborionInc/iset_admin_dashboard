ALTER TABLE iset_document
  MODIFY COLUMN source ENUM('secure_message_attachment','application_submission','manual_upload','system_generated','legacy_intake_upload') NOT NULL;

CREATE TABLE IF NOT EXISTS privacy_erm_legacy_intake_document_quarantine_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NOT NULL,
  old_source VARCHAR(64) NOT NULL,
  new_source VARCHAR(64) NOT NULL,
  old_client_id BIGINT UNSIGNED NULL,
  old_case_id BIGINT UNSIGNED NULL,
  old_application_id BIGINT UNSIGNED NULL,
  applicant_user_id INT NULL,
  quarantine_reason VARCHAR(128) NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_legacy_intake_document_quarantine_doc (document_id),
  KEY idx_legacy_intake_document_quarantine_reason (quarantine_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

UPDATE iset_document d
JOIN iset_application a ON a.id = d.application_id
   SET d.client_id = COALESCE(d.client_id, a.client_id),
       d.case_id = COALESCE(d.case_id, a.case_id),
       d.updated_at = CURRENT_TIMESTAMP
 WHERE d.source = 'application_submission'
   AND (d.client_id IS NULL OR d.case_id IS NULL)
   AND (a.client_id IS NOT NULL OR a.case_id IS NOT NULL);

UPDATE iset_document d
JOIN iset_case c ON c.id = d.case_id
   SET d.client_id = COALESCE(d.client_id, c.client_id),
       d.updated_at = CURRENT_TIMESTAMP
 WHERE d.source = 'application_submission'
   AND d.client_id IS NULL
   AND c.client_id IS NOT NULL;

UPDATE iset_document d
JOIN (
  SELECT resolved.document_id, resolved.application_id
    FROM (
      SELECT
        d2.id AS document_id,
        MIN(a.id) AS application_id
      FROM iset_document d2
      JOIN iset_application a
        ON a.case_id = d2.case_id
       AND (d2.client_id IS NULL OR a.client_id = d2.client_id)
      WHERE d2.source = 'application_submission'
        AND d2.application_id IS NULL
        AND d2.case_id IS NOT NULL
      GROUP BY d2.id
      HAVING COUNT(DISTINCT a.id) = 1
    ) resolved
) app_scope ON app_scope.document_id = d.id
   SET d.application_id = COALESCE(d.application_id, app_scope.application_id),
       d.updated_at = CURRENT_TIMESTAMP
 WHERE d.source = 'application_submission'
   AND d.application_id IS NULL;

INSERT INTO privacy_erm_legacy_intake_document_quarantine_audit (
  document_id,
  old_source,
  new_source,
  old_client_id,
  old_case_id,
  old_application_id,
  applicant_user_id,
  quarantine_reason
)
SELECT
  d.id,
  d.source,
  'legacy_intake_upload',
  d.client_id,
  d.case_id,
  d.application_id,
  d.applicant_user_id,
  CASE
    WHEN d.case_id IS NULL AND d.application_id IS NULL THEN 'missing_case_and_application'
    WHEN d.case_id IS NULL THEN 'missing_case'
    WHEN d.application_id IS NULL THEN 'missing_application'
    ELSE 'application_submission_scope_gap'
  END
FROM iset_document d
WHERE d.source = 'application_submission'
  AND (d.client_id IS NULL OR d.case_id IS NULL OR d.application_id IS NULL)
ON DUPLICATE KEY UPDATE
  old_client_id = VALUES(old_client_id),
  old_case_id = VALUES(old_case_id),
  old_application_id = VALUES(old_application_id),
  applicant_user_id = VALUES(applicant_user_id),
  quarantine_reason = VALUES(quarantine_reason);

UPDATE iset_document d
   SET d.source = 'legacy_intake_upload',
       d.metadata = JSON_SET(
         COALESCE(d.metadata, JSON_OBJECT()),
         '$.legacy_source',
         'application_submission',
         '$.legacy_quarantine_reason',
         CASE
           WHEN d.case_id IS NULL AND d.application_id IS NULL THEN 'missing_case_and_application'
           WHEN d.case_id IS NULL THEN 'missing_case'
           WHEN d.application_id IS NULL THEN 'missing_application'
           ELSE 'application_submission_scope_gap'
         END
       ),
       d.updated_at = CURRENT_TIMESTAMP
 WHERE d.source = 'application_submission'
   AND (d.client_id IS NULL OR d.case_id IS NULL OR d.application_id IS NULL);

SET @remaining_application_submission_scope_violations = (
  SELECT COUNT(*)
    FROM iset_document
   WHERE source = 'application_submission'
     AND (client_id IS NULL OR case_id IS NULL OR application_id IS NULL OR applicant_user_id IS NULL)
);

SET @sql = IF(@remaining_application_submission_scope_violations > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''application submission document scope blockers remain after legacy quarantine''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
