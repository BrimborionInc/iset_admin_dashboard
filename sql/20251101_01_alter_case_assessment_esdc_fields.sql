-- Extend assessment table with ILMP-aligned intervention metadata and childcare details

ALTER TABLE `iset_case_assessment`
  ADD COLUMN `intervention_code` TINYINT UNSIGNED NULL AFTER `intervention_end_date`,
  ADD COLUMN `intervention_outcome_code` TINYINT UNSIGNED NULL AFTER `intervention_code`,
  ADD COLUMN `intervention_duration_days` SMALLINT UNSIGNED NULL AFTER `intervention_outcome_code`,
  ADD COLUMN `intervention_cost_total` INT UNSIGNED NULL AFTER `intervention_duration_days`,
  ADD COLUMN `intervention_related_noc` VARCHAR(10) NULL AFTER `intervention_cost_total`,
  ADD COLUMN `intervention_related_noc_version` VARCHAR(16) NULL AFTER `intervention_related_noc`,
  ADD COLUMN `childcare_need` TINYINT(1) NULL AFTER `intervention_related_noc_version`,
  ADD COLUMN `childcare_funding_details` TEXT NULL AFTER `childcare_need`,
  ADD COLUMN `action_plan_result_code` VARCHAR(64) NULL AFTER `childcare_funding_details`,
  ADD COLUMN `action_plan_result_date` DATE NULL AFTER `action_plan_result_code`;
