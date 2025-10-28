-- Add lifecycle and closure metadata to action plans
ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `activated_at` datetime NULL AFTER `review_date`;

ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `closed_at` datetime NULL AFTER `activated_at`;

ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `result_code` varchar(32) NULL AFTER `closed_at`;

ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `result_date` date NULL AFTER `result_code`;

ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `outcome_summary` text NULL AFTER `result_date`;

ALTER TABLE `iset_case_action_plan`
  ADD COLUMN `closure_notes` text NULL AFTER `outcome_summary`;
