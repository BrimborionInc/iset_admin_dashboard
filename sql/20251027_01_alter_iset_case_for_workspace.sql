-- CR-0008 Case Workspace: extend iset_case with lifecycle metadata and counters

ALTER TABLE `iset_case`
  ADD COLUMN `case_number` VARCHAR(32) NULL AFTER `id`,
  ADD COLUMN `stage` VARCHAR(64) NULL AFTER `status`,
  ADD COLUMN `sub_stage` VARCHAR(64) NULL AFTER `stage`,
  ADD COLUMN `priority` VARCHAR(32) NULL AFTER `sub_stage`,
  ADD COLUMN `opened_at` DATETIME DEFAULT NULL AFTER `priority`,
  ADD COLUMN `closed_at` DATETIME DEFAULT NULL AFTER `opened_at`,
  ADD COLUMN `next_action_due_at` DATETIME DEFAULT NULL AFTER `closed_at`,
  ADD COLUMN `risk_rating` VARCHAR(32) DEFAULT NULL AFTER `next_action_due_at`,
  ADD COLUMN `portfolio_region_id` TINYINT UNSIGNED DEFAULT NULL AFTER `risk_rating`,
  ADD COLUMN `open_task_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `portfolio_region_id`,
  ADD COLUMN `overdue_task_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `open_task_count`,
  ADD COLUMN `open_intervention_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `overdue_task_count`,
  ADD COLUMN `total_intervention_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `open_intervention_count`,
  ADD COLUMN `created_by_staff_profile_id` BIGINT UNSIGNED DEFAULT NULL AFTER `total_intervention_count`,
  ADD COLUMN `updated_by_staff_profile_id` BIGINT UNSIGNED DEFAULT NULL AFTER `created_by_staff_profile_id`;

ALTER TABLE `iset_case`
  ADD UNIQUE KEY `uq_iset_case_case_number` (`case_number`),
  ADD INDEX `idx_iset_case_stage` (`stage`),
  ADD INDEX `idx_iset_case_priority` (`priority`),
  ADD INDEX `idx_iset_case_open_task_count` (`open_task_count`),
  ADD INDEX `idx_iset_case_next_action_due` (`next_action_due_at`);

ALTER TABLE `iset_case`
  ADD CONSTRAINT `fk_iset_case_portfolio_region`
    FOREIGN KEY (`portfolio_region_id`) REFERENCES `canada_region` (`region_id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_iset_case_created_by_profile`
    FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_iset_case_updated_by_profile`
    FOREIGN KEY (`updated_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL;
