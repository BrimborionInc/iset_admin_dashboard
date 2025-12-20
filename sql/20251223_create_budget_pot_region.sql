-- Map budget pots to zero or more Canada regions (optional association).
-- Uses canada_region.code (char(2)) as the region reference.

CREATE TABLE IF NOT EXISTS `budget_pot_region` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `pot_id` BIGINT UNSIGNED NOT NULL,
  `region_code` CHAR(2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_pot_region` (`pot_id`, `region_code`),
  KEY `idx_budget_pot_region_pot` (`pot_id`),
  KEY `idx_budget_pot_region_code` (`region_code`),
  CONSTRAINT `fk_budget_pot_region_pot` FOREIGN KEY (`pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_budget_pot_region_region` FOREIGN KEY (`region_code`) REFERENCES `canada_region` (`code`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
