-- Adds conflict-of-interest declaration choice and details per staff signature
ALTER TABLE `iset_case_conflict_declaration`
  ADD COLUMN `declaration_choice` varchar(32) NOT NULL DEFAULT 'no_conflict' AFTER `staff_profile_id`,
  ADD COLUMN `conflict_details` text DEFAULT NULL AFTER `declaration_choice`,
  ADD INDEX `idx_case_conflict_choice` (`declaration_choice`);
