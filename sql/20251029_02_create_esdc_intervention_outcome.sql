-- Reference table for ILMP intervention outcomes (Schema 1.4)

CREATE TABLE IF NOT EXISTS `esdc_intervention_outcome` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` TINYINT UNSIGNED NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `schema_version` VARCHAR(16) NOT NULL DEFAULT '1.4',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_esdc_intervention_outcome_version` (`code`, `schema_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `esdc_intervention_outcome` (`code`, `label`, `schema_version`, `is_active`, `display_order`) VALUES
  (1, 'Complete', '1.4', 1, 1),
  (2, 'In progress', '1.4', 1, 2),
  (3, 'Incomplete', '1.4', 1, 3),
  (4, 'Failed to report', '1.4', 1, 4),
  (5, 'Cancelled', '1.4', 1, 5),
  (6, 'Rescheduled', '1.4', 1, 6)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;
