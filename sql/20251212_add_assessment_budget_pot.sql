-- Add budget pot to assessments for gating and finance seeding

ALTER TABLE `iset_case_assessment`
  ADD COLUMN `intervention_budget_pot_id` BIGINT UNSIGNED NULL AFTER `intervention_end_date`;

-- Optional: index for quick lookups on pot
ALTER TABLE `iset_case_assessment`
  ADD INDEX `idx_case_assessment_pot` (`intervention_budget_pot_id`);
