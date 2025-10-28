-- Reference table for intervention funding streams

CREATE TABLE IF NOT EXISTS `funding_stream` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `description` VARCHAR(512) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_funding_stream_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `funding_stream` (`code`, `label`, `description`, `is_active`, `display_order`) VALUES
  ('EI', 'Employment Insurance (EI)', 'EI-funded interventions under contribution agreements', 1, 1),
  ('CRF', 'Consolidated Revenue Fund (CRF)', 'CRF-funded interventions under contribution agreements', 1, 2)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;
