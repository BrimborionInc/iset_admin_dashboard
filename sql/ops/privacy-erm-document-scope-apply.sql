-- Backfill deterministic iset_document scope gaps after preview.
-- Preserves old/new scope values in privacy_erm_document_scope_cleanup_audit.
-- Intended for DEV now and TEST/PROD rehearsal later.

CREATE TABLE IF NOT EXISTS privacy_erm_document_scope_cleanup_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cleanup_run_id VARCHAR(64) NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  source VARCHAR(64) NOT NULL,
  old_client_id BIGINT UNSIGNED NULL,
  new_client_id BIGINT UNSIGNED NULL,
  old_case_id BIGINT UNSIGNED NULL,
  new_case_id BIGINT UNSIGNED NULL,
  old_application_id BIGINT UNSIGNED NULL,
  new_application_id BIGINT UNSIGNED NULL,
  old_user_id BIGINT UNSIGNED NULL,
  new_user_id BIGINT UNSIGNED NULL,
  user_id_missing_target TINYINT(1) NOT NULL DEFAULT 0,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_privacy_erm_document_scope_cleanup_run (cleanup_run_id),
  KEY idx_privacy_erm_document_scope_cleanup_doc (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @privacy_erm_document_scope_run_id = CONCAT('document-scope-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_privacy_erm_document_scope_cleanup AS
SELECT
  d.id AS document_id,
  d.source,
  d.client_id AS old_client_id,
  COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  ) AS new_client_id,
  d.case_id AS old_case_id,
  COALESCE(d.case_id, a.case_id, m.case_id, a_from_message.case_id, single_case.case_id) AS new_case_id,
  d.application_id AS old_application_id,
  COALESCE(d.application_id, m.application_id, c_from_case.application_id, single_application.application_id) AS new_application_id,
  d.user_id AS old_user_id,
  CASE WHEN d.user_id IS NOT NULL AND u.id IS NULL THEN NULL ELSE d.user_id END AS new_user_id,
  CASE WHEN d.user_id IS NOT NULL AND u.id IS NULL THEN 1 ELSE 0 END AS user_id_missing_target
FROM iset_document d
LEFT JOIN `user` u ON u.id = d.user_id
LEFT JOIN `user` applicant_user ON applicant_user.id = d.applicant_user_id
LEFT JOIN client client_from_applicant_sub
  ON client_from_applicant_sub.applicant_cognito_sub = applicant_user.cognito_sub
LEFT JOIN client client_from_applicant_email
  ON LOWER(client_from_applicant_email.applicant_account_email) = LOWER(applicant_user.email)
LEFT JOIN iset_case c_from_case ON c_from_case.id = d.case_id
LEFT JOIN iset_application a ON a.id = d.application_id
LEFT JOIN messages m ON m.id = d.origin_message_id
LEFT JOIN iset_case c_from_message ON c_from_message.id = m.case_id
LEFT JOIN iset_application a_from_message ON a_from_message.id = m.application_id
LEFT JOIN (
  SELECT client_id, MIN(id) AS case_id, COUNT(*) AS case_count
  FROM iset_case
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_case
  ON single_case.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_case.case_count = 1
LEFT JOIN (
  SELECT client_id, MIN(id) AS application_id, COUNT(*) AS application_count
  FROM iset_application
  WHERE client_id IS NOT NULL
  GROUP BY client_id
) single_application
  ON single_application.client_id = COALESCE(
    d.client_id,
    c_from_case.client_id,
    a.client_id,
    c_from_message.client_id,
    a_from_message.client_id,
    client_from_applicant_sub.id,
    client_from_applicant_email.id
  )
 AND single_application.application_count = 1
WHERE (
    d.client_id IS NULL
    OR d.case_id IS NULL
    OR d.application_id IS NULL
    OR (d.user_id IS NOT NULL AND u.id IS NULL)
  )
  AND (
    COALESCE(d.client_id, c_from_case.client_id, a.client_id, c_from_message.client_id, a_from_message.client_id, client_from_applicant_sub.id, client_from_applicant_email.id) IS NOT NULL
    OR COALESCE(d.case_id, a.case_id, m.case_id, a_from_message.case_id, single_case.case_id) IS NOT NULL
    OR COALESCE(d.application_id, m.application_id, c_from_case.application_id, single_application.application_id) IS NOT NULL
    OR (d.user_id IS NOT NULL AND u.id IS NULL)
  );

SELECT
  COUNT(*) AS rows_to_update,
  SUM(old_client_id IS NULL AND new_client_id IS NOT NULL) AS client_id_backfills,
  SUM(old_case_id IS NULL AND new_case_id IS NOT NULL) AS case_id_backfills,
  SUM(old_application_id IS NULL AND new_application_id IS NOT NULL) AS application_id_backfills,
  SUM(user_id_missing_target = 1) AS invalid_user_ids_cleared
FROM tmp_privacy_erm_document_scope_cleanup;

INSERT INTO privacy_erm_document_scope_cleanup_audit (
  cleanup_run_id,
  document_id,
  source,
  old_client_id,
  new_client_id,
  old_case_id,
  new_case_id,
  old_application_id,
  new_application_id,
  old_user_id,
  new_user_id,
  user_id_missing_target
)
SELECT
  @privacy_erm_document_scope_run_id,
  document_id,
  source,
  old_client_id,
  new_client_id,
  old_case_id,
  new_case_id,
  old_application_id,
  new_application_id,
  old_user_id,
  new_user_id,
  user_id_missing_target
FROM tmp_privacy_erm_document_scope_cleanup;

UPDATE iset_document d
JOIN tmp_privacy_erm_document_scope_cleanup scoped
  ON scoped.document_id = d.id
SET
  d.client_id = scoped.new_client_id,
  d.case_id = scoped.new_case_id,
  d.application_id = scoped.new_application_id,
  d.user_id = scoped.new_user_id,
  d.updated_at = CURRENT_TIMESTAMP
WHERE (
    NOT (d.client_id <=> scoped.new_client_id)
    OR NOT (d.case_id <=> scoped.new_case_id)
    OR NOT (d.application_id <=> scoped.new_application_id)
    OR NOT (d.user_id <=> scoped.new_user_id)
  );

SET @privacy_erm_updated_documents = ROW_COUNT();

SELECT
  @privacy_erm_document_scope_run_id AS cleanup_run_id,
  @privacy_erm_updated_documents AS updated_documents;

COMMIT;
