-- Add reviewer/eligibility metadata to interventions for approval workflow

ALTER TABLE `iset_case_intervention`
  ADD COLUMN `reviewed_by_staff_profile_id` BIGINT UNSIGNED NULL AFTER `created_by_staff_profile_id`,
  ADD COLUMN `reviewed_at` DATETIME NULL AFTER `reviewed_by_staff_profile_id`,
  ADD COLUMN `review_notes` TEXT NULL AFTER `reviewed_at`,
  ADD COLUMN `eligibility_result` VARCHAR(64) NULL AFTER `review_notes`,
  ADD COLUMN `funding_stream_decision` VARCHAR(64) NULL AFTER `eligibility_result`,
  ADD COLUMN `required_docs_flags` JSON NULL AFTER `funding_stream_decision`,
  ADD CONSTRAINT `fk_case_intervention_reviewed_by`
    FOREIGN KEY (`reviewed_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL;
