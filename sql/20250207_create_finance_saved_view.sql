-- Saved views for Finance Budgets dashboards (per budget version).
-- Tracks filters/presets and export format preferences.

CREATE TABLE IF NOT EXISTS `finance_saved_view` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `budget_version_id` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` TEXT COLLATE utf8mb4_unicode_ci,
  `audience` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `filters_json` JSON DEFAULT NULL,
  `export_formats_json` JSON DEFAULT NULL,
  `is_shared` TINYINT(1) NOT NULL DEFAULT 0,
  `owner_user_id` INT DEFAULT NULL,
  `last_used_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_saved_view_budget_version` (`budget_version_id`),
  KEY `idx_finance_saved_view_owner` (`owner_user_id`),
  CONSTRAINT `fk_finance_saved_view_owner` FOREIGN KEY (`owner_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
