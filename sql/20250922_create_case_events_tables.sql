-- Create case event logging tables (safe, idempotent)
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `iset_event_type` (
  `event_type` VARCHAR(64) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `alert_variant` ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  PRIMARY KEY (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iset_case_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `event_data` JSON NOT NULL,
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_id` (`case_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_event_type` (`event_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed common event types (INSERT IGNORE for idempotency)
INSERT IGNORE INTO `iset_event_type` (`event_type`, `label`, `alert_variant`) VALUES
  ('application_created', 'Application created', 'success'),
  ('application_submitted', 'Application submitted', 'success'),
  ('application_saved_draft', 'Application draft saved', 'info'),
  ('application_draft_deleted', 'Application draft deleted', 'warning'),
  ('document_uploaded', 'Document uploaded', 'success'),
  ('message_sent', 'Message sent', 'info'),
  ('message_received', 'Message received', 'info'),
  ('message_deleted', 'Message deleted', 'warning'),
  ('case_assigned', 'Case assigned', 'info'),
  ('case_unassigned', 'Case unassigned', 'warning'),
  ('system_error', 'System error', 'error');

SET FOREIGN_KEY_CHECKS = 1;

