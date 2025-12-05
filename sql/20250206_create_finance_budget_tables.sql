-- Finance module foundational tables: budget pots, snapshots, allocations, and finance transactions.
-- Place in admin-dashboard/sql so the admin migration runner picks it up on startup.

CREATE TABLE IF NOT EXISTS `budget_pot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `parent_id` BIGINT UNSIGNED DEFAULT NULL,
  `agreement_code` VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fiscal_year` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pot_type` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'budget',
  `owner` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_admin_cap` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `approved_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `adjusted_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `committed_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `actual_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `forecast_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `admin_share_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_budget_pot_code_fiscal` (`code`,`fiscal_year`),
  KEY `idx_budget_pot_parent` (`parent_id`),
  KEY `idx_budget_pot_agreement` (`agreement_code`,`fiscal_year`),
  CONSTRAINT `fk_budget_pot_parent` FOREIGN KEY (`parent_id`) REFERENCES `budget_pot` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_snapshot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `label` VARCHAR(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `snapshot_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `agreement_code` VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fiscal_year` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `notes` TEXT COLLATE utf8mb4_unicode_ci,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_snapshot_at` (`snapshot_at`),
  KEY `idx_budget_snapshot_fiscal` (`fiscal_year`),
  CONSTRAINT `fk_budget_snapshot_user` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_snapshot_pot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `snapshot_id` BIGINT UNSIGNED NOT NULL,
  `budget_pot_id` BIGINT UNSIGNED NOT NULL,
  `parent_pot_id` BIGINT UNSIGNED DEFAULT NULL,
  `name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pot_type` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_admin_cap` TINYINT(1) NOT NULL DEFAULT 0,
  `approved_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `adjusted_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `committed_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `actual_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `forecast_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `admin_share_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `metadata` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_snapshot_pot` (`snapshot_id`,`budget_pot_id`),
  KEY `idx_snapshot_pot_parent` (`parent_pot_id`),
  CONSTRAINT `fk_snapshot_pot_snapshot` FOREIGN KEY (`snapshot_id`) REFERENCES `budget_snapshot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_pot_budget` FOREIGN KEY (`budget_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_snapshot_pot_parent` FOREIGN KEY (`parent_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `budget_allocation` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `source_pot_id` BIGINT UNSIGNED NOT NULL,
  `dest_pot_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `currency` CHAR(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CAD',
  `justification` TEXT COLLATE utf8mb4_unicode_ci,
  `status` ENUM('proposed','approved','applied','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'proposed',
  `proposed_by_user_id` INT DEFAULT NULL,
  `approved_by_user_id` INT DEFAULT NULL,
  `rejected_by_user_id` INT DEFAULT NULL,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `rejected_at` TIMESTAMP NULL DEFAULT NULL,
  `applied_at` TIMESTAMP NULL DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_allocation_source` (`source_pot_id`),
  KEY `idx_budget_allocation_dest` (`dest_pot_id`),
  KEY `idx_budget_allocation_status` (`status`),
  CONSTRAINT `fk_budget_allocation_source` FOREIGN KEY (`source_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_budget_allocation_dest` FOREIGN KEY (`dest_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_budget_allocation_proposed_by` FOREIGN KEY (`proposed_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_budget_allocation_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_budget_allocation_rejected_by` FOREIGN KEY (`rejected_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `finance_transaction` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `case_intervention_id` BIGINT UNSIGNED DEFAULT NULL,
  `budget_pot_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `currency` CHAR(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CAD',
  `status` ENUM('draft','submitted','approved','posted','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `transaction_date` DATE DEFAULT NULL,
  `posted_at` TIMESTAMP NULL DEFAULT NULL,
  `description` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `evidence_ref` VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_by_user_id` INT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_finance_tx_case` (`case_id`,`status`),
  KEY `idx_finance_tx_pot` (`budget_pot_id`),
  KEY `idx_finance_tx_intervention` (`case_intervention_id`),
  CONSTRAINT `fk_finance_tx_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_finance_tx_intervention` FOREIGN KEY (`case_intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_finance_tx_pot` FOREIGN KEY (`budget_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_finance_tx_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed the full demo hierarchy so Budgets UI can render while APIs are wired.
INSERT INTO `budget_pot` (
  `id`, `parent_id`, `agreement_code`, `fiscal_year`, `name`, `code`, `pot_type`, `owner`,
  `is_admin_cap`, `is_active`, `approved_amount`, `adjusted_amount`, `committed_amount`,
  `actual_amount`, `forecast_amount`, `admin_share_amount`, `metadata`
) VALUES
  (1, NULL, 'NWAC-AG-2024', '2024-2025', 'NWAC Master ISET Budget', 'GL-5000', 'funding_envelope', 'Madeleine Redfern', 0, 1, 2000000.00, 2075000.00, 1692000.00, 1598000.00, 2064000.00, 635000.00, JSON_OBJECT('nodeType','Funding envelope')),
  (2, 1, 'NWAC-AG-2024', '2024-2025', 'NWAC Administration', 'GL-5100', 'administration', 'Shelley Stacey', 1, 1, 280000.00, 295000.00, 240000.00, 225000.00, 295000.00, 280000.00, JSON_OBJECT('nodeType','Cost centre')),
  (3, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA British Columbia', 'PTMA-BC', 'region', 'BC PTMA Finance Lead', 0, 1, 380000.00, 392000.00, 335000.00, 318000.00, 395000.00, 80000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (4, 3, 'NWAC-AG-2024', '2024-2025', 'BC Administration & Stewardship', 'GL-BC-6100', 'administration', 'Priya Singh', 1, 1, 80000.00, 82000.00, 70000.00, 66000.00, 82000.00, 80000.00, JSON_OBJECT('nodeType','Administration')),
  (5, 3, 'NWAC-AG-2024', '2024-2025', 'BC Client Services', 'GL-BC-7100', 'client_delivery', 'Madison Coppola', 0, 1, 300000.00, 310000.00, 265000.00, 252000.00, 313000.00, 0.00, JSON_OBJECT('nodeType','Client delivery')),
  (6, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA Alberta', 'PTMA-AB', 'region', 'Alberta PTMA Finance', 0, 1, 340000.00, 352000.00, 290000.00, 276000.00, 348000.00, 70000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (7, 6, 'NWAC-AG-2024', '2024-2025', 'Alberta Administration & Stewardship', 'GL-AB-6100', 'administration', 'Priya Singh', 1, 1, 70000.00, 72000.00, 61000.00, 58000.00, 70000.00, 70000.00, JSON_OBJECT('nodeType','Administration')),
  (8, 6, 'NWAC-AG-2024', '2024-2025', 'Alberta Client Services', 'GL-AB-7100', 'client_delivery', 'Madison Coppola', 0, 1, 270000.00, 280000.00, 229000.00, 218000.00, 278000.00, 0.00, JSON_OBJECT('nodeType','Client delivery')),
  (9, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA Ontario', 'PTMA-ON', 'region', 'Ontario PTMA Finance', 0, 1, 400000.00, 412000.00, 332000.00, 310000.00, 408000.00, 85000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (10, 9, 'NWAC-AG-2024', '2024-2025', 'Ontario Administration & Stewardship', 'GL-ON-6100', 'administration', 'Priya Singh', 1, 1, 85000.00, 88000.00, 75000.00, 69000.00, 86000.00, 85000.00, JSON_OBJECT('nodeType','Administration')),
  (11, 9, 'NWAC-AG-2024', '2024-2025', 'Ontario Client Services', 'GL-ON-7100', 'client_delivery', 'Madison Coppola', 0, 1, 315000.00, 324000.00, 257000.00, 241000.00, 322000.00, 0.00, JSON_OBJECT('nodeType','Client delivery')),
  (12, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA Prairies (MB/SK)', 'PTMA-PRA', 'region', 'Prairies PTMA Finance', 0, 1, 260000.00, 268000.00, 209000.00, 196000.00, 266000.00, 55000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (13, 12, 'NWAC-AG-2024', '2024-2025', 'Prairies Administration & Stewardship', 'GL-PRA-6100', 'administration', 'Priya Singh', 1, 1, 55000.00, 56000.00, 46000.00, 43000.00, 55000.00, 55000.00, JSON_OBJECT('nodeType','Administration')),
  (14, 12, 'NWAC-AG-2024', '2024-2025', 'Prairies Client Services', 'GL-PRA-7100', 'client_delivery', 'Madison Coppola', 0, 1, 205000.00, 212000.00, 163000.00, 153000.00, 211000.00, 0.00, JSON_OBJECT('nodeType','Client delivery')),
  (15, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA Atlantic', 'PTMA-ATL', 'region', 'Atlantic PTMA Finance', 0, 1, 180000.00, 186000.00, 152000.00, 143000.00, 184000.00, 35000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (16, 15, 'NWAC-AG-2024', '2024-2025', 'Atlantic Administration & Stewardship', 'GL-ATL-6100', 'administration', 'Priya Singh', 1, 1, 35000.00, 36000.00, 30000.00, 28000.00, 35000.00, 35000.00, JSON_OBJECT('nodeType','Administration')),
  (17, 15, 'NWAC-AG-2024', '2024-2025', 'Atlantic Client Services', 'GL-ATL-7100', 'client_delivery', 'Madison Coppola', 0, 1, 145000.00, 150000.00, 122000.00, 115000.00, 149000.00, 0.00, JSON_OBJECT('nodeType','Client delivery')),
  (18, 1, 'NWAC-AG-2024', '2024-2025', 'PTMA Northern (YT/NT/NU)', 'PTMA-NTH', 'region', 'Northern PTMA Finance', 0, 1, 160000.00, 170000.00, 134000.00, 130000.00, 168000.00, 30000.00, JSON_OBJECT('nodeType','Region (PTMA)')),
  (19, 18, 'NWAC-AG-2024', '2024-2025', 'Northern Administration & Stewardship', 'GL-NTH-6100', 'administration', 'Priya Singh', 1, 1, 30000.00, 32000.00, 25000.00, 23000.00, 31000.00, 30000.00, JSON_OBJECT('nodeType','Administration')),
  (20, 18, 'NWAC-AG-2024', '2024-2025', 'Northern Client Services', 'GL-NTH-7100', 'client_delivery', 'Jordan Rivers', 0, 1, 130000.00, 138000.00, 109000.00, 107000.00, 137000.00, 0.00, JSON_OBJECT('nodeType','Client delivery'));

ALTER TABLE `budget_pot` AUTO_INCREMENT = 100;
