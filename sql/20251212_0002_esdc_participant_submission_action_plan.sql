-- Add action plan linkage to participant submissions and shift uniqueness to action_plan_id.

ALTER TABLE `esdc_participant_submission`
  ADD COLUMN `action_plan_id` BIGINT UNSIGNED NULL AFTER `case_id`,
  ADD INDEX `idx_esdc_participant_submission_case` (`case_id`),
  ADD INDEX `idx_esdc_participant_submission_action_plan` (`action_plan_id`),
  ADD CONSTRAINT `fk_esdc_participant_submission_action_plan`
    FOREIGN KEY (`action_plan_id`) REFERENCES `iset_case_action_plan` (`id`) ON DELETE SET NULL;

-- Drop the case-level uniqueness so we can track multiple plans per case.
ALTER TABLE `esdc_participant_submission`
  DROP INDEX `uq_esdc_participant_submission_case`;

-- Backfill action_plan_id to the most relevant plan per case (prefer active, else latest non-archived, else latest).
UPDATE `esdc_participant_submission` eps
LEFT JOIN (
  SELECT ap.case_id, ap.id AS action_plan_id
  FROM (
    SELECT
      ap.case_id,
      ap.id,
      ROW_NUMBER() OVER (
        PARTITION BY ap.case_id
        ORDER BY
          (LOWER(COALESCE(ap.status, '')) = 'active') DESC,
          ap.archived_at IS NULL DESC,
          ap.updated_at DESC,
          ap.id DESC
      ) AS rn
    FROM iset_case_action_plan ap
  ) ranked
  WHERE ranked.rn = 1
) chosen ON chosen.case_id = eps.case_id
SET eps.action_plan_id = COALESCE(eps.action_plan_id, chosen.action_plan_id);

-- Enforce one submission per action plan (nulls permitted for legacy rows).
ALTER TABLE `esdc_participant_submission`
  ADD UNIQUE KEY `uq_esdc_participant_submission_plan` (`action_plan_id`);
