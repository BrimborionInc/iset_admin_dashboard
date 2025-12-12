-- Retry backfill for action_plan_id on participant submissions with window function (ONLY_FULL_GROUP_BY safe).

UPDATE esdc_participant_submission eps
LEFT JOIN (
  SELECT case_id, id AS action_plan_id
  FROM (
    SELECT
      ap.case_id,
      ap.id,
      ROW_NUMBER() OVER (
        PARTITION BY ap.case_id
        ORDER BY
          (LOWER(COALESCE(ap.status, '')) = 'active') DESC,
          (ap.archived_at IS NULL) DESC,
          ap.updated_at DESC,
          ap.id DESC
      ) AS rn
    FROM iset_case_action_plan ap
  ) ranked
  WHERE ranked.rn = 1
) chosen ON chosen.case_id = eps.case_id
SET eps.action_plan_id = COALESCE(eps.action_plan_id, chosen.action_plan_id);

-- Enforce one submission per action plan (nulls permitted for legacy rows). Skip if it already exists.
ALTER TABLE esdc_participant_submission
  ADD UNIQUE KEY `uq_esdc_participant_submission_plan` (`action_plan_id`);
