CREATE TABLE IF NOT EXISTS privacy_erm_relationship_fk_hardening_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  relationship_name VARCHAR(96) NOT NULL,
  source_table VARCHAR(96) NOT NULL,
  source_id BIGINT UNSIGNED DEFAULT NULL,
  source_value VARCHAR(128) DEFAULT NULL,
  target_table VARCHAR(96) NOT NULL,
  target_id VARCHAR(128) DEFAULT NULL,
  missing_target TINYINT(1) NOT NULL DEFAULT 0,
  scope_mismatch TINYINT(1) NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_relationship_fk_audit_run (run_label),
  KEY idx_relationship_fk_audit_relationship (relationship_name),
  KEY idx_relationship_fk_audit_source (source_table, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELETE FROM privacy_erm_relationship_fk_hardening_audit
 WHERE run_label = 'application-cfa-relationship-fk-hardening-20260427';

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'iset_application_submission',
  'iset_application',
  a.id,
  CAST(a.submission_id AS CHAR),
  'iset_application_submission',
  CAST(s.id AS CHAR),
  CASE WHEN a.submission_id IS NOT NULL AND s.id IS NULL THEN 1 ELSE 0 END,
  0
FROM iset_application a
LEFT JOIN iset_application_submission s ON s.id = a.submission_id
WHERE a.submission_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'iset_application_version_application',
  'iset_application_version',
  av.id,
  CAST(av.application_id AS CHAR),
  'iset_application',
  CAST(a.id AS CHAR),
  CASE WHEN a.id IS NULL THEN 1 ELSE 0 END,
  0
FROM iset_application_version av
LEFT JOIN iset_application a ON a.id = av.application_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_series_case',
  'cfa_series',
  cs.id,
  CAST(cs.case_id AS CHAR),
  'iset_case',
  CAST(c.id AS CHAR),
  CASE WHEN c.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_series cs
LEFT JOIN iset_case c ON c.id = cs.case_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_series',
  'cfa_version',
  cv.id,
  CAST(cv.series_id AS CHAR),
  'cfa_series',
  CAST(cs.id AS CHAR),
  CASE WHEN cs.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_version cv
LEFT JOIN cfa_series cs ON cs.id = cv.series_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_supersedes',
  'cfa_version',
  cv.id,
  CAST(cv.supersedes_version_id AS CHAR),
  'cfa_version',
  CAST(sup.id AS CHAR),
  CASE WHEN cv.supersedes_version_id IS NOT NULL AND sup.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_version cv
LEFT JOIN cfa_version sup ON sup.id = cv.supersedes_version_id
WHERE cv.supersedes_version_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_signed_participant',
  'cfa_version',
  cv.id,
  CAST(cv.signed_by_participant_id AS CHAR),
  'user',
  CAST(u.id AS CHAR),
  CASE WHEN cv.signed_by_participant_id IS NOT NULL AND u.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_version cv
LEFT JOIN `user` u ON u.id = cv.signed_by_participant_id
WHERE cv.signed_by_participant_id IS NOT NULL;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_document_version',
  'cfa_version_documents',
  cvd.id,
  CAST(cvd.cfa_version_id AS CHAR),
  'cfa_version',
  CAST(cv.id AS CHAR),
  CASE WHEN cv.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_version_documents cvd
LEFT JOIN cfa_version cv ON cv.id = cvd.cfa_version_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_document_document',
  'cfa_version_documents',
  cvd.id,
  CAST(cvd.document_id AS CHAR),
  'iset_document',
  CAST(d.id AS CHAR),
  CASE WHEN d.id IS NULL THEN 1 ELSE 0 END,
  0
FROM cfa_version_documents cvd
LEFT JOIN iset_document d ON d.id = cvd.document_id;

INSERT INTO privacy_erm_relationship_fk_hardening_audit (
  run_label, relationship_name, source_table, source_id, source_value,
  target_table, target_id, missing_target, scope_mismatch
)
SELECT
  'application-cfa-relationship-fk-hardening-20260427',
  'cfa_version_document_case_scope',
  'cfa_version_documents',
  cvd.id,
  CAST(cvd.document_id AS CHAR),
  'iset_document/cfa_series',
  CONCAT(
    'document:', COALESCE(CAST(d.id AS CHAR), 'missing'),
    ';case:', COALESCE(CAST(cs.case_id AS CHAR), 'missing')
  ),
  CASE WHEN cv.id IS NULL OR cs.id IS NULL OR d.id IS NULL THEN 1 ELSE 0 END,
  CASE
    WHEN cv.id IS NOT NULL
     AND cs.id IS NOT NULL
     AND d.id IS NOT NULL
     AND (
          d.case_id IS NULL
       OR d.client_id IS NULL
       OR d.case_id <> cs.case_id
       OR c.id IS NULL
       OR d.client_id <> c.client_id
     )
    THEN 1 ELSE 0
  END
FROM cfa_version_documents cvd
LEFT JOIN cfa_version cv ON cv.id = cvd.cfa_version_id
LEFT JOIN cfa_series cs ON cs.id = cv.series_id
LEFT JOIN iset_case c ON c.id = cs.case_id
LEFT JOIN iset_document d ON d.id = cvd.document_id;

SELECT COUNT(*)
  INTO @relationship_fk_blockers
  FROM privacy_erm_relationship_fk_hardening_audit
 WHERE run_label = 'application-cfa-relationship-fk-hardening-20260427'
   AND (missing_target = 1 OR scope_mismatch = 1);

SET @sql = IF(@relationship_fk_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''application/CFA relationship FK blockers remain before hardening''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @cfa_series_case_type = (
  SELECT LOWER(column_type)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_series'
     AND column_name = 'case_id'
);

SET @sql = IF(@cfa_series_case_type <> 'bigint unsigned',
  'ALTER TABLE cfa_series MODIFY case_id BIGINT UNSIGNED NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @cfa_document_id_type = (
  SELECT LOWER(column_type)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version_documents'
     AND column_name = 'document_id'
);

SET @sql = IF(@cfa_document_id_type <> 'bigint unsigned',
  'ALTER TABLE cfa_version_documents MODIFY document_id BIGINT UNSIGNED NOT NULL',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND index_name = 'idx_cfa_version_supersedes_version_id'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE cfa_version ADD KEY idx_cfa_version_supersedes_version_id (supersedes_version_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @idx_exists = (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND index_name = 'idx_cfa_version_signed_by_participant_id'
);
SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE cfa_version ADD KEY idx_cfa_version_signed_by_participant_id (signed_by_participant_id)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_iset_application_submission_id'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE iset_application ADD CONSTRAINT fk_iset_application_submission_id FOREIGN KEY (submission_id) REFERENCES iset_application_submission (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_iset_application_version_application'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE iset_application_version ADD CONSTRAINT fk_iset_application_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_series_case'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_series ADD CONSTRAINT fk_cfa_series_case FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_version_series'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_series FOREIGN KEY (series_id) REFERENCES cfa_series (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_version_supersedes'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_supersedes FOREIGN KEY (supersedes_version_id) REFERENCES cfa_version (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_version_signed_participant'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_signed_participant FOREIGN KEY (signed_by_participant_id) REFERENCES `user` (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_version_documents_version'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_version_documents ADD CONSTRAINT fk_cfa_version_documents_version FOREIGN KEY (cfa_version_id) REFERENCES cfa_version (id) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'fk_cfa_version_documents_document'
);
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE cfa_version_documents ADD CONSTRAINT fk_cfa_version_documents_document FOREIGN KEY (document_id) REFERENCES iset_document (id) ON DELETE RESTRICT',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
