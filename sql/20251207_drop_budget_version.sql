-- Roll back budget versioning: remove version_id links and drop budget_version.

-- budget_pot: remove FK, index, column.
ALTER TABLE `budget_pot`
  DROP FOREIGN KEY `fk_budget_pot_version`;

ALTER TABLE `budget_pot`
  DROP INDEX `idx_budget_pot_version`;

ALTER TABLE `budget_pot`
  DROP COLUMN `version_id`;

-- budget_snapshot: remove FK, index, column.
ALTER TABLE `budget_snapshot`
  DROP FOREIGN KEY `fk_budget_snapshot_version`;

ALTER TABLE `budget_snapshot`
  DROP INDEX `idx_budget_snapshot_version`;

ALTER TABLE `budget_snapshot`
  DROP COLUMN `version_id`;

-- budget_pot_draft: remove FK, index, column.
ALTER TABLE `budget_pot_draft`
  DROP FOREIGN KEY `fk_budget_pot_draft_version`;

ALTER TABLE `budget_pot_draft`
  DROP INDEX `idx_budget_pot_draft_version`;

ALTER TABLE `budget_pot_draft`
  DROP COLUMN `version_id`;

-- Drop header table.
DROP TABLE IF EXISTS `budget_version`;
