CREATE TABLE IF NOT EXISTS privacy_erm_event_actor_scope_hardening_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  run_label VARCHAR(64) NOT NULL,
  event_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_type VARCHAR(32) NOT NULL,
  actor_id VARCHAR(64) DEFAULT NULL,
  captured_by VARCHAR(64) DEFAULT NULL,
  actor_staff_profile_id BIGINT UNSIGNED DEFAULT NULL,
  actor_applicant_user_id INT DEFAULT NULL,
  missing_required_typed_actor TINYINT(1) NOT NULL DEFAULT 0,
  dual_typed_actor TINYINT(1) NOT NULL DEFAULT 0,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_event_actor_scope_event (event_id),
  KEY idx_event_actor_scope_staff (actor_staff_profile_id),
  KEY idx_event_actor_scope_applicant (actor_applicant_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TEMPORARY TABLE privacy_erm_event_actor_staff_candidate (
  event_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  staff_profile_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (event_id, staff_profile_id)
) ENGINE=Memory;

INSERT IGNORE INTO privacy_erm_event_actor_staff_candidate (event_id, staff_profile_id)
SELECT e.id, sp.id
  FROM iset_event_entry e
  JOIN staff_profiles sp
    ON e.actor_type = 'staff'
   AND e.actor_staff_profile_id IS NULL
   AND (
        CAST(sp.cognito_sub AS BINARY) = CAST(e.actor_id AS BINARY)
     OR CAST(sp.cognito_sub AS BINARY) = CAST(e.captured_by AS BINARY)
     OR (e.actor_id REGEXP '^[0-9]+$' AND sp.id = CAST(e.actor_id AS UNSIGNED))
     OR (e.captured_by REGEXP '^[0-9]+$' AND sp.id = CAST(e.captured_by AS UNSIGNED))
     OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_id USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.captured_by USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_display_name USING utf8mb4) COLLATE utf8mb4_unicode_ci)
   );

INSERT IGNORE INTO privacy_erm_event_actor_staff_candidate (event_id, staff_profile_id)
SELECT e.id, sp.id
  FROM iset_event_entry e
  JOIN `user` u
    ON e.actor_type = 'staff'
   AND e.actor_staff_profile_id IS NULL
   AND (
        (e.actor_id REGEXP '^[0-9]+$' AND u.id = CAST(e.actor_id AS UNSIGNED))
     OR (e.captured_by REGEXP '^[0-9]+$' AND u.id = CAST(e.captured_by AS UNSIGNED))
     OR CAST(u.cognito_sub AS BINARY) = CAST(e.actor_id AS BINARY)
     OR CAST(u.cognito_sub AS BINARY) = CAST(e.captured_by AS BINARY)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_id USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.captured_by USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_display_name USING utf8mb4) COLLATE utf8mb4_unicode_ci)
   )
  JOIN staff_profiles sp
    ON (
        (u.cognito_sub IS NOT NULL AND CAST(sp.cognito_sub AS BINARY) = CAST(u.cognito_sub AS BINARY))
     OR LOWER(CONVERT(sp.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci)
   );

UPDATE iset_event_entry e
  JOIN (
    SELECT event_id, MIN(staff_profile_id) AS staff_profile_id, COUNT(DISTINCT staff_profile_id) AS candidate_count
      FROM privacy_erm_event_actor_staff_candidate
     GROUP BY event_id
    HAVING candidate_count = 1
  ) resolved ON resolved.event_id = e.id
   SET e.actor_staff_profile_id = resolved.staff_profile_id
 WHERE e.actor_type = 'staff'
   AND e.actor_staff_profile_id IS NULL;

CREATE TEMPORARY TABLE privacy_erm_event_actor_applicant_candidate (
  event_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  applicant_user_id INT NOT NULL,
  PRIMARY KEY (event_id, applicant_user_id)
) ENGINE=Memory;

INSERT IGNORE INTO privacy_erm_event_actor_applicant_candidate (event_id, applicant_user_id)
SELECT e.id, u.id
  FROM iset_event_entry e
  JOIN `user` u
    ON e.actor_type = 'applicant'
   AND e.actor_applicant_user_id IS NULL
   AND (
        (e.actor_id REGEXP '^[0-9]+$' AND u.id = CAST(e.actor_id AS UNSIGNED))
     OR (e.captured_by REGEXP '^[0-9]+$' AND u.id = CAST(e.captured_by AS UNSIGNED))
     OR CAST(u.cognito_sub AS BINARY) = CAST(e.actor_id AS BINARY)
     OR CAST(u.cognito_sub AS BINARY) = CAST(e.captured_by AS BINARY)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_id USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.captured_by USING utf8mb4) COLLATE utf8mb4_unicode_ci)
     OR LOWER(CONVERT(u.email USING utf8mb4) COLLATE utf8mb4_unicode_ci) = LOWER(CONVERT(e.actor_display_name USING utf8mb4) COLLATE utf8mb4_unicode_ci)
   );

UPDATE iset_event_entry e
  JOIN (
    SELECT event_id, MIN(applicant_user_id) AS applicant_user_id, COUNT(DISTINCT applicant_user_id) AS candidate_count
      FROM privacy_erm_event_actor_applicant_candidate
     GROUP BY event_id
    HAVING candidate_count = 1
  ) resolved ON resolved.event_id = e.id
   SET e.actor_applicant_user_id = resolved.applicant_user_id
 WHERE e.actor_type = 'applicant'
   AND e.actor_applicant_user_id IS NULL;

INSERT INTO privacy_erm_event_actor_scope_hardening_audit (
  run_label,
  event_id,
  event_type,
  actor_type,
  actor_id,
  captured_by,
  actor_staff_profile_id,
  actor_applicant_user_id,
  missing_required_typed_actor,
  dual_typed_actor
)
SELECT
  'event-actor-scope-hardening-20260427',
  id,
  event_type,
  actor_type,
  actor_id,
  captured_by,
  actor_staff_profile_id,
  actor_applicant_user_id,
  CASE
    WHEN actor_type = 'staff' AND actor_staff_profile_id IS NULL THEN 1
    WHEN actor_type = 'applicant' AND actor_applicant_user_id IS NULL THEN 1
    ELSE 0
  END,
  CASE
    WHEN actor_staff_profile_id IS NOT NULL AND actor_applicant_user_id IS NOT NULL THEN 1
    ELSE 0
  END
FROM iset_event_entry;

SELECT COUNT(*)
  INTO @event_actor_scope_blockers
  FROM iset_event_entry
 WHERE (actor_type = 'staff' AND (actor_staff_profile_id IS NULL OR actor_applicant_user_id IS NOT NULL))
    OR (actor_type = 'applicant' AND (actor_applicant_user_id IS NULL OR actor_staff_profile_id IS NOT NULL))
    OR (actor_type NOT IN ('staff', 'applicant') AND (actor_staff_profile_id IS NOT NULL OR actor_applicant_user_id IS NOT NULL));

SET @sql = IF(@event_actor_scope_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''iset_event_entry typed actor blockers remain before actor-scope CHECK hardening''',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @event_actor_scope_check_exists = (
  SELECT COUNT(*)
    FROM information_schema.check_constraints
   WHERE constraint_schema = DATABASE()
     AND constraint_name = 'chk_iset_event_entry_typed_actor_scope'
);

SET @sql = IF(@event_actor_scope_check_exists = 0,
  'ALTER TABLE iset_event_entry ADD CONSTRAINT chk_iset_event_entry_typed_actor_scope CHECK (((actor_type = ''staff'') AND (actor_staff_profile_id IS NOT NULL) AND (actor_applicant_user_id IS NULL)) OR ((actor_type = ''applicant'') AND (actor_applicant_user_id IS NOT NULL) AND (actor_staff_profile_id IS NULL)) OR ((actor_type NOT IN (''staff'', ''applicant'')) AND (actor_staff_profile_id IS NULL) AND (actor_applicant_user_id IS NULL)))',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
