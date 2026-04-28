CREATE TABLE IF NOT EXISTS privacy_erm_event_actor_system_reclass_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id CHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  old_actor_type VARCHAR(32) NOT NULL,
  old_actor_id VARCHAR(64) NULL,
  old_captured_by VARCHAR(64) NULL,
  old_actor_staff_profile_id BIGINT UNSIGNED NULL,
  old_actor_applicant_user_id INT NULL,
  reclass_reason VARCHAR(128) NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_event_actor_system_reclass_event (event_id),
  KEY idx_event_actor_system_reclass_reason (reclass_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO privacy_erm_event_actor_system_reclass_audit (
  event_id,
  event_type,
  old_actor_type,
  old_actor_id,
  old_captured_by,
  old_actor_staff_profile_id,
  old_actor_applicant_user_id,
  reclass_reason
)
SELECT
  e.id,
  e.event_type,
  e.actor_type,
  e.actor_id,
  e.captured_by,
  e.actor_staff_profile_id,
  e.actor_applicant_user_id,
  CASE
    WHEN e.actor_type = 'staff' AND e.actor_staff_profile_id IS NULL THEN 'legacy_staff_actor_unresolved'
    WHEN e.actor_type = 'applicant' AND e.actor_applicant_user_id IS NULL THEN 'legacy_applicant_actor_unresolved'
    ELSE 'legacy_actor_scope_mismatch'
  END
FROM iset_event_entry e
WHERE (e.actor_type = 'staff' AND (e.actor_staff_profile_id IS NULL OR e.actor_applicant_user_id IS NOT NULL))
   OR (e.actor_type = 'applicant' AND (e.actor_applicant_user_id IS NULL OR e.actor_staff_profile_id IS NOT NULL))
   OR (e.actor_type NOT IN ('staff', 'applicant') AND (e.actor_staff_profile_id IS NOT NULL OR e.actor_applicant_user_id IS NOT NULL))
ON DUPLICATE KEY UPDATE
  event_type = VALUES(event_type),
  old_actor_type = VALUES(old_actor_type),
  old_actor_id = VALUES(old_actor_id),
  old_captured_by = VALUES(old_captured_by),
  old_actor_staff_profile_id = VALUES(old_actor_staff_profile_id),
  old_actor_applicant_user_id = VALUES(old_actor_applicant_user_id),
  reclass_reason = VALUES(reclass_reason);

UPDATE iset_event_entry e
   SET e.actor_type = 'system',
       e.actor_staff_profile_id = NULL,
       e.actor_applicant_user_id = NULL
 WHERE (e.actor_type = 'staff' AND (e.actor_staff_profile_id IS NULL OR e.actor_applicant_user_id IS NOT NULL))
    OR (e.actor_type = 'applicant' AND (e.actor_applicant_user_id IS NULL OR e.actor_staff_profile_id IS NOT NULL))
    OR (e.actor_type NOT IN ('staff', 'applicant') AND (e.actor_staff_profile_id IS NOT NULL OR e.actor_applicant_user_id IS NOT NULL));

SET @remaining_event_actor_scope_blockers = (
  SELECT COUNT(*)
    FROM iset_event_entry
   WHERE (actor_type = 'staff' AND (actor_staff_profile_id IS NULL OR actor_applicant_user_id IS NOT NULL))
      OR (actor_type = 'applicant' AND (actor_applicant_user_id IS NULL OR actor_staff_profile_id IS NOT NULL))
      OR (actor_type NOT IN ('staff', 'applicant') AND (actor_staff_profile_id IS NOT NULL OR actor_applicant_user_id IS NOT NULL))
);

SET @sql = IF(@remaining_event_actor_scope_blockers > 0,
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''event actor scope blockers remain after unresolved legacy reclass''',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
