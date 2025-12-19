-- Purpose: add classification/tag fields to budget pots and snapshot pots (funding_source, is_restricted, agreement_id, fiscal_year) so tags can persist across drafts/publish/snapshots.
-- Tables altered: budget_pot, budget_snapshot_pot.
-- Nullability/defaults: columns allow NULL to avoid breaking existing data; is_restricted defaults to 0 for convenience. Constraints are permissive (nullable) with basic format checks.
-- TODO (backend wiring): update snapshot copy/publish/restore queries in isetadminserver.js to populate/read these new columns when endpoints are adjusted.

ALTER TABLE `budget_pot`
  ADD COLUMN `agreement_id` VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `agreement_code`,
  ADD COLUMN `funding_source` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `pot_type`,
  ADD COLUMN `is_restricted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `funding_source`,
  ADD COLUMN `fiscal_year_tag` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `fiscal_year`,
  ADD CONSTRAINT `chk_budget_pot_funding_source` CHECK (`funding_source` IN ('EI','CRF','OTHER') OR `funding_source` IS NULL),
  ADD CONSTRAINT `chk_budget_pot_fiscal_year_tag` CHECK (`fiscal_year_tag` IS NULL OR `fiscal_year_tag` REGEXP '^[0-9]{4}(-[0-9]{4})?$');

CREATE INDEX `idx_budget_pot_funding_source` ON `budget_pot` (`funding_source`);
CREATE INDEX `idx_budget_pot_is_restricted` ON `budget_pot` (`is_restricted`);

ALTER TABLE `budget_snapshot_pot`
  ADD COLUMN `agreement_id` VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `code`,
  ADD COLUMN `funding_source` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `agreement_id`,
  ADD COLUMN `is_restricted` TINYINT(1) NOT NULL DEFAULT 0 AFTER `funding_source`,
  ADD COLUMN `fiscal_year_tag` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `is_admin_cap`,
  ADD CONSTRAINT `chk_budget_snapshot_pot_funding_source` CHECK (`funding_source` IN ('EI','CRF','OTHER') OR `funding_source` IS NULL),
  ADD CONSTRAINT `chk_budget_snapshot_pot_fiscal_year_tag` CHECK (`fiscal_year_tag` IS NULL OR `fiscal_year_tag` REGEXP '^[0-9]{4}(-[0-9]{4})?$');
