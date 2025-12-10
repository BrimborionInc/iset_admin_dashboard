-- Ensure the linking table exists even if earlier migration ran before it was added.
CREATE TABLE IF NOT EXISTS `message_signing_request` (
  `message_id` BIGINT UNSIGNED NOT NULL,
  `signing_request_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`message_id`, `signing_request_id`),
  KEY `idx_msr_signing_request` (`signing_request_id`),
  CONSTRAINT `fk_msr_message` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_msr_signing_request` FOREIGN KEY (`signing_request_id`) REFERENCES `signing_request` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
