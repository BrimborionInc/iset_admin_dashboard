-- Escalation tracking tables and helper flags for applications

CREATE TABLE IF NOT EXISTS `iset_application_escalation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `case_id` BIGINT UNSIGNED DEFAULT NULL,
  `state` VARCHAR(32) NOT NULL,
  `current_owner_role` VARCHAR(64) DEFAULT NULL,
  `current_owner_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `requester_user_id` BIGINT UNSIGNED NOT NULL,
  `requester_role` VARCHAR(64) NOT NULL,
  `target_role` VARCHAR(64) DEFAULT NULL,
  `reason` VARCHAR(255) DEFAULT NULL,
  `details` TEXT DEFAULT NULL,
  `disposition` VARCHAR(64) DEFAULT NULL,
  `last_action_note` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL DEFAULT NULL,
  `resolved_by_user_id` BIGINT UNSIGNED DEFAULT NULL,
  `resolved_by_role` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_app_state` (`application_id`, `state`),
  KEY `idx_owner_state` (`current_owner_role`, `state`),
  KEY `idx_requester` (`requester_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `iset_application`
  ADD COLUMN `has_open_escalation` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN `current_escalation_id` BIGINT UNSIGNED DEFAULT NULL;

ALTER TABLE `iset_application`
  ADD INDEX `idx_has_open_escalation` (`has_open_escalation`),
  ADD INDEX `idx_current_escalation_id` (`current_escalation_id`);
