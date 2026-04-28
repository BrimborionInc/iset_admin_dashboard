CREATE TABLE IF NOT EXISTS privacy_erm_application_scope_hardening_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  application_id BIGINT UNSIGNED NOT NULL,
  application_client_id BIGINT UNSIGNED DEFAULT NULL,
  application_case_id BIGINT UNSIGNED DEFAULT NULL,
  case_client_id BIGINT UNSIGNED DEFAULT NULL,
  missing_application_client TINYINT(1) NOT NULL DEFAULT 0,
  missing_application_case TINYINT(1) NOT NULL DEFAULT 0,
  missing_case_client TINYINT(1) NOT NULL DEFAULT 0,
  client_mismatch TINYINT(1) NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_application_scope_hardening_app (application_id),
  KEY idx_application_scope_hardening_case (application_case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

UPDATE iset_application a
  JOIN iset_case c ON c.id = a.case_id
   SET a.client_id = c.client_id,
       a.updated_at = NOW()
 WHERE a.client_id IS NULL
   AND c.client_id IS NOT NULL;

UPDATE iset_case c
  JOIN (
    SELECT
      case_id,
      MIN(client_id) AS resolved_client_id,
      COUNT(DISTINCT client_id) AS distinct_client_count
    FROM iset_application
    WHERE case_id IS NOT NULL
      AND client_id IS NOT NULL
    GROUP BY case_id
  ) app_scope ON app_scope.case_id = c.id
   SET c.client_id = app_scope.resolved_client_id,
       c.updated_at = NOW()
 WHERE c.client_id IS NULL
   AND app_scope.distinct_client_count = 1;

INSERT INTO privacy_erm_application_scope_hardening_audit (
  run_label,
  application_id,
  application_client_id,
  application_case_id,
  case_client_id,
  missing_application_client,
  missing_application_case,
  missing_case_client,
  client_mismatch
)
SELECT
  'application-scope-hardening-20260427',
  a.id,
  a.client_id,
  a.case_id,
  c.client_id,
  CASE WHEN a.client_id IS NULL THEN 1 ELSE 0 END,
  CASE WHEN a.case_id IS NULL OR c.id IS NULL THEN 1 ELSE 0 END,
  CASE WHEN c.id IS NOT NULL AND c.client_id IS NULL THEN 1 ELSE 0 END,
  CASE
    WHEN a.client_id IS NOT NULL
     AND c.client_id IS NOT NULL
     AND a.client_id <> c.client_id
    THEN 1 ELSE 0
  END
FROM iset_application a
LEFT JOIN iset_case c ON c.id = a.case_id;

SELECT COUNT(*)
  INTO @application_scope_hardening_blockers
  FROM iset_application a
  LEFT JOIN iset_case c ON c.id = a.case_id
 WHERE a.client_id IS NULL
    OR a.case_id IS NULL
    OR c.id IS NULL
    OR c.client_id IS NULL
    OR a.client_id <> c.client_id;

SET @sql = IF(@application_scope_hardening_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_application client/case scope blockers remain before NOT NULL hardening''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @application_client_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application'
     AND column_name = 'client_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@application_client_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_application DROP FOREIGN KEY `', REPLACE(@application_client_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @application_case_fk = (
  SELECT constraint_name
    FROM information_schema.key_column_usage
   WHERE table_schema = DATABASE()
     AND table_name = 'iset_application'
     AND column_name = 'case_id'
     AND referenced_table_name IS NOT NULL
   LIMIT 1
);

SET @sql = IF(@application_case_fk IS NOT NULL,
  CONCAT('ALTER TABLE iset_application DROP FOREIGN KEY `', REPLACE(@application_case_fk, '`', '``'), '`'),
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE iset_application
  MODIFY COLUMN client_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN case_id BIGINT UNSIGNED NOT NULL;

ALTER TABLE iset_application
  ADD CONSTRAINT fk_iset_application_client_id
  FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT;

ALTER TABLE iset_application
  ADD CONSTRAINT fk_iset_application_case_id
  FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT;
