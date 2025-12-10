-- Create signing_request and linking table for secure messaging attachments
CREATE TABLE IF NOT EXISTS `signing_request` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `workflow_id` BIGINT UNSIGNED NOT NULL,
  `workflow_name` VARCHAR(255) NOT NULL,
  `workflow_type` VARCHAR(64) NOT NULL DEFAULT 'consent-no-prefill',
  `case_id` BIGINT UNSIGNED NULL,
  `participant_user_id` BIGINT UNSIGNED NOT NULL,
  `created_by_user_id` BIGINT UNSIGNED NOT NULL,
  `status` ENUM('pending','viewed','signed','cancelled','expired') NOT NULL DEFAULT 'pending',
  `due_at` DATETIME NULL,
  `resolved_schema_json` JSON NULL,
  `signed_payload_json` JSON NULL,
  `artifact_url` VARCHAR(512) NULL,
  `checklist_doc_type` VARCHAR(128) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_signing_request_case` (`case_id`),
  KEY `idx_signing_request_participant` (`participant_user_id`),
  KEY `idx_signing_request_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `message_signing_request` (
  `message_id` BIGINT UNSIGNED NOT NULL,
  `signing_request_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`message_id`, `signing_request_id`),
  KEY `idx_msr_signing_request` (`signing_request_id`),
  CONSTRAINT `fk_msr_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msr_signing_request` FOREIGN KEY (`signing_request_id`) REFERENCES `signing_request` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
