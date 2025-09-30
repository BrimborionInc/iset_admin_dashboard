-- Event store schema for new capture pipeline (idempotent)
SET FOREIGN_KEY_CHECKS = 0;

-- Drop legacy case events tables (no data retained)
DROP TABLE IF EXISTS `iset_case_event`;
DROP TABLE IF EXISTS `iset_event_type`;

CREATE TABLE IF NOT EXISTS `iset_event_entry` (
  `id` CHAR(36) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `severity` ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  `source` VARCHAR(32) DEFAULT NULL,
  `subject_type` VARCHAR(64) NOT NULL,
  `subject_id` VARCHAR(64) NOT NULL,
  `actor_type` VARCHAR(32) NOT NULL,
  `actor_id` VARCHAR(64) DEFAULT NULL,
  `actor_display_name` VARCHAR(255) DEFAULT NULL,
  `payload_json` JSON NOT NULL,
  `tracking_id` VARCHAR(128) DEFAULT NULL,
  `correlation_id` VARCHAR(128) DEFAULT NULL,
  `captured_by` VARCHAR(64) DEFAULT NULL,
  `captured_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ingested_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_event_entry_subject` (`subject_type`, `subject_id`, `captured_at`),
  KEY `idx_event_entry_type_captured` (`event_type`, `captured_at`),
  KEY `idx_event_entry_captured_at` (`captured_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iset_event_receipt` (
  `event_id` CHAR(36) NOT NULL,
  `recipient_id` VARCHAR(64) NOT NULL,
  `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`event_id`, `recipient_id`),
  KEY `idx_event_receipt_read_at` (`read_at`),
  CONSTRAINT `fk_event_receipt_entry` FOREIGN KEY (`event_id`) REFERENCES `iset_event_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iset_event_outbox` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` CHAR(36) NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('pending','delivering','delivered','failed') NOT NULL DEFAULT 'pending',
  `attempts` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `next_attempt_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_error` TEXT DEFAULT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_event_outbox_status_next` (`status`, `next_attempt_at`),
  CONSTRAINT `fk_event_outbox_entry` FOREIGN KEY (`event_id`) REFERENCES `iset_event_entry` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
