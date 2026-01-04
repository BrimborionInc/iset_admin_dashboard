-- Migration: payment override registry
-- Purpose: log evidence/threshold overrides with reason and actor for audit

CREATE TABLE IF NOT EXISTS `payment_override` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_packet_line_id` BIGINT UNSIGNED DEFAULT NULL,
  `override_type` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` TEXT COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` INT DEFAULT NULL,
  `actor_role` VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_override_packet` (`payment_packet_id`),
  KEY `idx_payment_override_line` (`payment_packet_line_id`),
  KEY `idx_payment_override_actor` (`actor_user_id`),
  CONSTRAINT `fk_payment_override_packet`
    FOREIGN KEY (`payment_packet_id`) REFERENCES `payment_packet` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_override_line`
    FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_override_actor`
    FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
