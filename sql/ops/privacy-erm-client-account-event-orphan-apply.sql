-- Delete orphan client applicant-account event rows after preview.
-- Preserves deleted row identifiers in privacy_erm_client_account_event_orphan_cleanup_audit.
-- Intended for DEV now and TEST/PROD rehearsal only after snapshot/preflight approval.

CREATE TABLE IF NOT EXISTS privacy_erm_client_account_event_orphan_cleanup_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cleanup_run_id VARCHAR(64) NOT NULL,
  event_id BIGINT UNSIGNED NOT NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  actor_staff_profile_id BIGINT UNSIGNED NULL,
  metadata_sha256 CHAR(64) NULL,
  event_created_at TIMESTAMP NULL,
  cleanup_reason VARCHAR(64) NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_client_account_event_orphan_run (cleanup_run_id),
  KEY idx_client_account_event_orphan_event (event_id),
  KEY idx_client_account_event_orphan_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @privacy_erm_cleanup_run_id = CONCAT('client-account-event-orphan-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_privacy_erm_client_account_event_orphan AS
SELECT
  e.id AS event_id,
  e.client_id,
  e.event_type,
  e.actor_staff_profile_id,
  SHA2(COALESCE(CAST(e.metadata_json AS CHAR), ''), 256) AS metadata_sha256,
  e.created_at AS event_created_at,
  'missing_client' AS cleanup_reason
FROM client_applicant_account_event e
LEFT JOIN client c ON c.id = e.client_id
WHERE c.id IS NULL;

SELECT cleanup_reason, COUNT(*) AS rows_to_delete
FROM tmp_privacy_erm_client_account_event_orphan
GROUP BY cleanup_reason
ORDER BY cleanup_reason;

INSERT INTO privacy_erm_client_account_event_orphan_cleanup_audit (
  cleanup_run_id,
  event_id,
  client_id,
  event_type,
  actor_staff_profile_id,
  metadata_sha256,
  event_created_at,
  cleanup_reason
)
SELECT
  @privacy_erm_cleanup_run_id,
  event_id,
  client_id,
  event_type,
  actor_staff_profile_id,
  metadata_sha256,
  event_created_at,
  cleanup_reason
FROM tmp_privacy_erm_client_account_event_orphan;

DELETE e
FROM client_applicant_account_event e
JOIN tmp_privacy_erm_client_account_event_orphan doomed
  ON doomed.event_id = e.id;

SET @privacy_erm_deleted_client_account_events = ROW_COUNT();

SELECT
  @privacy_erm_cleanup_run_id AS cleanup_run_id,
  @privacy_erm_deleted_client_account_events AS deleted_client_account_events;

COMMIT;
