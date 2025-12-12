-- Fix backfill for action_plan_id on participant submissions and add per-plan uniqueness.

-- Backfill action_plan_id to the most relevant plan per case (prefer active, else latest non-archived, else latest updated).
UPDATE esdc_participant_submission eps
LEFT JOIN (
  SELECT ap.case_id, ap.id AS action_plan_id
  FROM iset_case_action_plan ap
  WHERE ap.id = (
    SELECT ap2.id
    FROM iset_case_action_plan ap2
    WHERE ap2.case_id = ap.case_id
    ORDER BY
      (LOWER(COALESCE(ap2.status, '')) = 'active') DESC,
      (ap2.archived_at IS NULL) DESC,
      ap2.updated_at DESC,
      ap2.id DESC
    LIMIT 1
  )
  GROUP BY ap.case_id
) chosen ON chosen.case_id = eps.case_id
SET eps.action_plan_id = COALESCE(eps.action_plan_id, chosen.action_plan_id);

-- Enforce one submission per action plan (nulls permitted for legacy rows).
ALTER TABLE esdc_participant_submission
  ADD UNIQUE KEY `uq_esdc_participant_submission_plan` (`action_plan_id`);
