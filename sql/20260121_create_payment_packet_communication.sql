-- Payments module communications log (email + manual tracking).

CREATE TABLE IF NOT EXISTS `payment_packet_communication` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_id` BIGINT UNSIGNED NOT NULL,
  `payment_packet_line_id` BIGINT UNSIGNED DEFAULT NULL,
  `direction` ENUM('outbound','inbound') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'outbound',
  `channel` VARCHAR(16) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'email',
  `sender_user_id` INT DEFAULT NULL,
  `sender_label` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `recipients_json` JSON DEFAULT NULL,
  `subject` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `template_key` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attachments_json` JSON DEFAULT NULL,
  `status` ENUM('queued','sent','failed','logged') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'sent',
  `provider_message_id` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `error_message` TEXT COLLATE utf8mb4_unicode_ci,
  `sent_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_comm_packet` (`payment_packet_id`),
  KEY `idx_payment_comm_line` (`payment_packet_line_id`),
  KEY `idx_payment_comm_sent_at` (`sent_at`),
  CONSTRAINT `fk_payment_comm_packet` FOREIGN KEY (`payment_packet_id`) REFERENCES `payment_packet` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_comm_line` FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_comm_sender` FOREIGN KEY (`sender_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
