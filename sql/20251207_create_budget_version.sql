-- Budget versioning support: introduce budget_version and link existing pots/snapshots.

CREATE TABLE IF NOT EXISTS `budget_version` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `agreement_code` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `fiscal_year` varchar(16) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `label` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `status` enum('draft','published','archived') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'published',
  `metadata` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_budget_version_fiscal` (`agreement_code`,`fiscal_year`),
  KEY `idx_budget_version_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Link budget pots to versions.
ALTER TABLE `budget_pot`
  ADD COLUMN `version_id` bigint unsigned DEFAULT NULL AFTER `fiscal_year`;

ALTER TABLE `budget_pot`
  ADD KEY `idx_budget_pot_version` (`version_id`);

ALTER TABLE `budget_pot`
  ADD CONSTRAINT `fk_budget_pot_version` FOREIGN KEY (`version_id`) REFERENCES `budget_version` (`id`) ON DELETE SET NULL;

-- Seed versions from existing pots (one per agreement_code + fiscal_year).
INSERT INTO `budget_version` (`agreement_code`, `fiscal_year`, `label`, `status`)
SELECT DISTINCT
  IFNULL(`agreement_code`, ''),
  IFNULL(`fiscal_year`, ''),
  CONCAT(IFNULL(`fiscal_year`, 'Unspecified'), ' (imported)'),
  'published'
FROM `budget_pot`
WHERE `version_id` IS NULL;

-- Backfill pot version references.
UPDATE `budget_pot` bp
JOIN `budget_version` bv
  ON IFNULL(bp.`agreement_code`, '') = IFNULL(bv.`agreement_code`, '')
 AND IFNULL(bp.`fiscal_year`, '') = IFNULL(bv.`fiscal_year`, '')
SET bp.`version_id` = bv.`id`
WHERE bp.`version_id` IS NULL;

-- Snapshots: attach to budget_version (based on agreement_code + fiscal_year).
ALTER TABLE `budget_snapshot`
  ADD COLUMN `version_id` bigint unsigned DEFAULT NULL AFTER `fiscal_year`;

ALTER TABLE `budget_snapshot`
  ADD KEY `idx_budget_snapshot_version` (`version_id`);

ALTER TABLE `budget_snapshot`
  ADD CONSTRAINT `fk_budget_snapshot_version` FOREIGN KEY (`version_id`) REFERENCES `budget_version` (`id`) ON DELETE SET NULL;

UPDATE `budget_snapshot` bs
JOIN `budget_version` bv
  ON IFNULL(bs.`agreement_code`, '') = IFNULL(bv.`agreement_code`, '')
 AND IFNULL(bs.`fiscal_year`, '') = IFNULL(bv.`fiscal_year`, '')
SET bs.`version_id` = bv.`id`
WHERE bs.`version_id` IS NULL;

-- Drafts: track target version explicitly.
ALTER TABLE `budget_pot_draft`
  ADD COLUMN `version_id` bigint unsigned DEFAULT NULL AFTER `notes`;

ALTER TABLE `budget_pot_draft`
  ADD KEY `idx_budget_pot_draft_version` (`version_id`);

ALTER TABLE `budget_pot_draft`
  ADD CONSTRAINT `fk_budget_pot_draft_version` FOREIGN KEY (`version_id`) REFERENCES `budget_version` (`id`) ON DELETE SET NULL;
