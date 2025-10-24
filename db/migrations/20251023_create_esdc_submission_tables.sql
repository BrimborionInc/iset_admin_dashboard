CREATE TABLE IF NOT EXISTS `esdc_participant_submission` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `application_id` BIGINT UNSIGNED DEFAULT NULL,
  `readiness_status` ENUM('ready','needs_review','blocked') NOT NULL DEFAULT 'needs_review',
  `readiness_summary` JSON DEFAULT NULL,
  `warnings` JSON DEFAULT NULL,
  `blocking_issues` JSON DEFAULT NULL,
  `last_validated_at` TIMESTAMP NULL DEFAULT NULL,
  `submission_status` ENUM('pending','submitted','accepted','rejected') NOT NULL DEFAULT 'pending',
  `submitted_at` TIMESTAMP NULL DEFAULT NULL,
  `submitted_by_user_id` INT DEFAULT NULL,
  `payload_snapshot` JSON DEFAULT NULL,
  `payload_storage_key` VARCHAR(255) DEFAULT NULL,
  `payload_checksum` CHAR(64) DEFAULT NULL,
  `rejection_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_esdc_participant_submission_case` (`case_id`),
  KEY `idx_esdc_participant_submission_readiness` (`readiness_status`),
  KEY `idx_esdc_participant_submission_submission_status` (`submission_status`),
  KEY `idx_esdc_participant_submission_last_validated` (`last_validated_at`),
  CONSTRAINT `fk_esdc_participant_submission_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_esdc_participant_submission_application` FOREIGN KEY (`application_id`) REFERENCES `iset_application` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_esdc_participant_submission_user` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `esdc_participant_submission_history` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `participant_submission_id` BIGINT UNSIGNED NOT NULL,
  `event_type` ENUM('validated','ready','prepared','submitted','accepted','rejected') NOT NULL,
  `payload_checksum` CHAR(64) DEFAULT NULL,
  `actor_user_id` INT DEFAULT NULL,
  `event_details` JSON DEFAULT NULL,
  `occurred_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esdc_participant_history_submission` (`participant_submission_id`,`occurred_at`),
  CONSTRAINT `fk_esdc_participant_history_submission` FOREIGN KEY (`participant_submission_id`) REFERENCES `esdc_participant_submission` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_esdc_participant_history_user` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `esdc_reporting_package` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporting_period` VARCHAR(32) NOT NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `due_date` DATE NOT NULL,
  `status` ENUM('draft','in_review','ready','submitted','accepted','rejected') NOT NULL DEFAULT 'draft',
  `owner_team` VARCHAR(32) DEFAULT NULL,
  `checklist_state` JSON DEFAULT NULL,
  `package_storage_key` VARCHAR(255) DEFAULT NULL,
  `submitted_at` TIMESTAMP NULL DEFAULT NULL,
  `submitted_by_user_id` INT DEFAULT NULL,
  `rejection_reason` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_esdc_reporting_period` (`reporting_period`),
  KEY `idx_esdc_reporting_status` (`status`),
  KEY `idx_esdc_reporting_due_date` (`due_date`),
  CONSTRAINT `fk_esdc_reporting_submitted_by` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `esdc_reporting_note` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `reporting_package_id` BIGINT UNSIGNED NOT NULL,
  `author_user_id` INT DEFAULT NULL,
  `note_text` TEXT NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esdc_reporting_note_package` (`reporting_package_id`,`created_at`),
  CONSTRAINT `fk_esdc_reporting_note_package` FOREIGN KEY (`reporting_package_id`) REFERENCES `esdc_reporting_package` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_esdc_reporting_note_author` FOREIGN KEY (`author_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
