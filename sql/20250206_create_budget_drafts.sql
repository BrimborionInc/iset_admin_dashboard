CREATE TABLE IF NOT EXISTS `budget_pot_draft` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `label` VARCHAR(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `notes` TEXT COLLATE utf8mb4_unicode_ci,
  `payload_json` JSON NOT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_pot_draft_created` (`created_at`),
  CONSTRAINT `fk_budget_pot_draft_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
