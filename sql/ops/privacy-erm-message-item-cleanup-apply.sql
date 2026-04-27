-- Delete unsafe message_item rows after preview.
-- Preserves deleted rows in privacy_erm_message_item_cleanup_audit.
-- Intended for DEV now and TEST/PROD rehearsal later.

CREATE TABLE IF NOT EXISTS privacy_erm_message_item_cleanup_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cleanup_run_id VARCHAR(64) NOT NULL,
  message_item_id BIGINT UNSIGNED NOT NULL,
  message_id INT NOT NULL,
  owner_user_id INT NOT NULL,
  folder VARCHAR(16) NOT NULL,
  folder_before_deleted VARCHAR(16) NULL,
  read_at DATETIME NULL,
  deleted_at DATETIME NULL,
  purged_at DATETIME NULL,
  message_sender_id INT NULL,
  message_recipient_id INT NULL,
  cleanup_reason VARCHAR(64) NOT NULL,
  captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_privacy_erm_message_item_cleanup_run (cleanup_run_id),
  KEY idx_privacy_erm_message_item_cleanup_item (message_item_id),
  KEY idx_privacy_erm_message_item_cleanup_reason (cleanup_reason)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @privacy_erm_cleanup_run_id = CONCAT('message-item-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));

START TRANSACTION;

CREATE TEMPORARY TABLE tmp_privacy_erm_message_item_cleanup AS
SELECT
  mi.id AS message_item_id,
  mi.message_id,
  mi.owner_user_id,
  mi.folder,
  mi.folder_before_deleted,
  mi.read_at,
  mi.deleted_at,
  mi.purged_at,
  m.sender_id AS message_sender_id,
  m.recipient_id AS message_recipient_id,
  CASE
    WHEN m.id IS NULL THEN 'missing_message'
    WHEN u.id IS NULL THEN 'missing_owner_user'
    WHEN mi.owner_user_id NOT IN (m.sender_id, m.recipient_id) THEN 'owner_not_sender_or_recipient'
    ELSE 'ok'
  END AS cleanup_reason
FROM message_item mi
LEFT JOIN messages m ON m.id = mi.message_id
LEFT JOIN `user` u ON u.id = mi.owner_user_id
WHERE m.id IS NULL
   OR u.id IS NULL
   OR mi.owner_user_id NOT IN (m.sender_id, m.recipient_id);

SELECT cleanup_reason, COUNT(*) AS rows_to_delete
FROM tmp_privacy_erm_message_item_cleanup
GROUP BY cleanup_reason
ORDER BY cleanup_reason;

INSERT INTO privacy_erm_message_item_cleanup_audit (
  cleanup_run_id,
  message_item_id,
  message_id,
  owner_user_id,
  folder,
  folder_before_deleted,
  read_at,
  deleted_at,
  purged_at,
  message_sender_id,
  message_recipient_id,
  cleanup_reason
)
SELECT
  @privacy_erm_cleanup_run_id,
  message_item_id,
  message_id,
  owner_user_id,
  folder,
  folder_before_deleted,
  read_at,
  deleted_at,
  purged_at,
  message_sender_id,
  message_recipient_id,
  cleanup_reason
FROM tmp_privacy_erm_message_item_cleanup;

DELETE mi
FROM message_item mi
JOIN tmp_privacy_erm_message_item_cleanup doomed
  ON doomed.message_item_id = mi.id;

SET @privacy_erm_deleted_message_items = ROW_COUNT();

SELECT
  @privacy_erm_cleanup_run_id AS cleanup_run_id,
  @privacy_erm_deleted_message_items AS deleted_message_items;

COMMIT;
