CREATE TABLE IF NOT EXISTS privacy_erm_legacy_routine_retirement_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  routine_name VARCHAR(128) NOT NULL,
  routine_type VARCHAR(32) NOT NULL,
  retired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reason VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_privacy_erm_legacy_routine_retirement_name (routine_name, retired_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO privacy_erm_legacy_routine_retirement_audit (routine_name, routine_type, reason)
SELECT
  ROUTINE_NAME,
  ROUTINE_TYPE,
  'Retired legacy appointment/queue routine whose underlying tables are absent'
FROM information_schema.routines
WHERE ROUTINE_SCHEMA = DATABASE()
  AND ROUTINE_TYPE = 'PROCEDURE'
  AND ROUTINE_NAME IN (
    'CheckBILUsage',
    'CheckInUser',
    'GenerateTicketNumber',
    'PurgeAppointments',
    'PurgeSlots'
  );

DROP PROCEDURE IF EXISTS CheckBILUsage;
DROP PROCEDURE IF EXISTS CheckInUser;
DROP PROCEDURE IF EXISTS GenerateTicketNumber;
DROP PROCEDURE IF EXISTS PurgeAppointments;
DROP PROCEDURE IF EXISTS PurgeSlots;
