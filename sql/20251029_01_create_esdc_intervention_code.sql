-- Reference table for ILMP intervention codes (Schema 1.4)

CREATE TABLE IF NOT EXISTS `esdc_intervention_code` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` TINYINT UNSIGNED NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `schema_version` VARCHAR(16) NOT NULL DEFAULT '1.4',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `display_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_esdc_intervention_code_version` (`code`, `schema_version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `esdc_intervention_code` (`code`, `label`, `schema_version`, `is_active`, `display_order`) VALUES
  (1,  'Career research & exploration', '1.4', 1, 1),
  (2,  'Diagnostic assessment', '1.4', 1, 2),
  (3,  'Employment counselling', '1.4', 1, 3),
  (4,  'Skills development – essential skills', '1.4', 1, 4),
  (5,  'Skills development – academic upgrading', '1.4', 1, 5),
  (6,  'Work experience – job creation partnerships', '1.4', 1, 6),
  (7,  'Work experience – wage subsidy', '1.4', 1, 7),
  (8,  'Work experience – student employment', '1.4', 1, 8),
  (9,  'Occupational skills training – certificate', '1.4', 1, 9),
  (10, 'Occupational skills training – diploma', '1.4', 1, 10),
  (11, 'Occupational skills training – degree', '1.4', 1, 11),
  (12, 'Occupational skills training – apprenticeship', '1.4', 1, 12),
  (13, 'Occupational skills training – vocational', '1.4', 1, 13),
  (14, 'Self-employment', '1.4', 1, 14),
  (15, 'Job search preparation strategies', '1.4', 1, 15),
  (16, 'Job starts supports', '1.4', 1, 16),
  (17, 'Employer referral', '1.4', 1, 17),
  (18, 'Employment retention supports', '1.4', 1, 18),
  (19, 'Referral to agencies', '1.4', 1, 19),
  (20, 'Pre-career development', '1.4', 1, 20)
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `is_active` = VALUES(`is_active`),
  `display_order` = VALUES(`display_order`),
  `updated_at` = CURRENT_TIMESTAMP;
