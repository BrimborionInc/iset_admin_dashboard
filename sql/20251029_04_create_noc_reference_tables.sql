-- Reference tables for NOC versions and codes (partial seed)

CREATE TABLE IF NOT EXISTS `noc_version` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(8) NOT NULL,
  `label` VARCHAR(128) NOT NULL,
  `description` VARCHAR(512) DEFAULT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_noc_version_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `noc_code` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(8) NOT NULL,
  `version_code` VARCHAR(8) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `search_title` VARCHAR(255) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_noc_code_version` (`code`, `version_code`),
  KEY `idx_noc_code_search` (`version_code`, `code`),
  CONSTRAINT `fk_noc_code_version` FOREIGN KEY (`version_code`) REFERENCES `noc_version` (`code`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `noc_version` (`code`, `label`, `description`, `is_active`, `display_order`) VALUES
  ('2021', 'National Occupational Classification 2021', 'Five-digit TEER structure released September 2022', 1, 1),
  ('2016', 'National Occupational Classification 2016', 'Four-digit skill type/level structure', 1, 2)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;

-- Seed subset of NOC 2021 codes frequently used in ILMP contexts
INSERT INTO `noc_code` (`code`, `version_code`, `title`, `search_title`, `is_active`, `display_order`) VALUES
  ('42201', '2021', 'Social and community service workers', LOWER('Social and community service workers'), 1, 1),
  ('42202', '2021', 'Early childhood educators', LOWER('Early childhood educators'), 1, 2),
  ('52200', '2021', 'Graphic designers and illustrators', LOWER('Graphic designers and illustrators'), 1, 3),
  ('63210', '2021', 'Chefs', LOWER('Chefs'), 1, 4),
  ('94102', '2021', 'Assemblers, electrical equipment manufacturing', LOWER('Assemblers electrical equipment manufacturing'), 1, 5),
  ('94107', '2021', 'Plastics processing labourers', LOWER('Plastics processing labourers'), 1, 6)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `search_title` = VALUES(`search_title`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;

-- Seed subset of NOC 2016 codes
INSERT INTO `noc_code` (`code`, `version_code`, `title`, `search_title`, `is_active`, `display_order`) VALUES
  ('4212', '2016', 'Social and community service workers', LOWER('Social and community service workers'), 1, 1),
  ('4214', '2016', 'Early childhood educators and assistants', LOWER('Early childhood educators and assistants'), 1, 2),
  ('5241', '2016', 'Graphic designers and illustrators', LOWER('Graphic designers and illustrators'), 1, 3),
  ('6321', '2016', 'Chefs', LOWER('Chefs'), 1, 4),
  ('9612', '2016', 'Labourers in metal fabrication', LOWER('Labourers in metal fabrication'), 1, 5),
  ('9619', '2016', 'Other labourers in processing and manufacturing', LOWER('Other labourers in processing and manufacturing'), 1, 6)
ON DUPLICATE KEY UPDATE
  `title` = VALUES(`title`),
  `search_title` = VALUES(`search_title`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;
