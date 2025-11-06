-- Adds conflict-of-interest declaration tracking to coordinator assessments

ALTER TABLE `iset_case_assessment`
  ADD COLUMN `conflict_declaration_signed` TINYINT(1) NULL AFTER `action_plan_result_date`,
  ADD COLUMN `conflict_declaration_signed_at` DATETIME NULL AFTER `conflict_declaration_signed`,
  ADD COLUMN `conflict_declaration_signed_by` BIGINT UNSIGNED NULL AFTER `conflict_declaration_signed_at`,
  ADD INDEX `idx_case_assessment_conflict_signed` (`conflict_declaration_signed`),
  ADD CONSTRAINT `fk_case_assessment_conflict_staff`
    FOREIGN KEY (`conflict_declaration_signed_by`) REFERENCES `staff_profiles`(`id`)
    ON DELETE SET NULL;
