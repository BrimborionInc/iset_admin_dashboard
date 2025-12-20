-- Capture regions associated with budget pots at snapshot time.
-- Mirrors budget_pot_region but scoped to budget snapshots.

CREATE TABLE IF NOT EXISTS `budget_snapshot_pot_region` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `snapshot_id` BIGINT UNSIGNED NOT NULL,
  `budget_pot_id` BIGINT UNSIGNED NOT NULL,
  `region_code` CHAR(2) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot_pot_region` (`snapshot_id`, `budget_pot_id`, `region_code`),
  KEY `idx_snapshot_pot_region_snapshot` (`snapshot_id`),
  KEY `idx_snapshot_pot_region_pot` (`budget_pot_id`),
  KEY `idx_snapshot_pot_region_code` (`region_code`),
  CONSTRAINT `fk_snapshot_pot_region_snapshot` FOREIGN KEY (`snapshot_id`) REFERENCES `budget_snapshot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_pot_region_pot` FOREIGN KEY (`budget_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_pot_region_region` FOREIGN KEY (`region_code`) REFERENCES `canada_region` (`code`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
