-- Read-only preview for two historical denied-reporting action plans with null provenance.
-- Their existing one-to-one ESDC participant submissions retain the exact same-case application.
--
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file \
--     sql/ops/prod-denied-reporting-lineage-backfill-preview-20260727.sql

SELECT
  plan.id AS action_plan_id,
  plan.case_id,
  plan.application_id AS current_application_id,
  submission.application_id AS expected_application_id,
  application.case_id AS application_case_id,
  JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) AS plan_source,
  COUNT(DISTINCT intervention.id) AS intervention_count,
  MIN(intervention.start_date) AS earliest_intervention_start,
  MAX(intervention.start_date) AS latest_intervention_start,
  COUNT(DISTINCT submission.id) AS esdc_submission_count,
  COUNT(DISTINCT submission.application_id) AS esdc_application_count
FROM iset_case_action_plan plan
JOIN esdc_participant_submission submission
  ON submission.action_plan_id = plan.id
 AND submission.case_id = plan.case_id
JOIN iset_application application
  ON application.id = submission.application_id
 AND application.case_id = plan.case_id
JOIN iset_case_intervention intervention
  ON intervention.action_plan_id = plan.id
WHERE plan.id IN (55, 57)
GROUP BY
  plan.id,
  plan.case_id,
  plan.application_id,
  submission.application_id,
  application.case_id,
  plan.metadata_json
ORDER BY plan.id;

SELECT
  'blocking_condition' AS section,
  plan.id AS action_plan_id,
  CASE
    WHEN plan.application_id IS NOT NULL THEN 'plan_already_linked'
    WHEN JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) <> 'denied_reporting'
      THEN 'unexpected_plan_source'
    WHEN COUNT(DISTINCT submission.id) <> 1 THEN 'esdc_submission_count_not_one'
    WHEN COUNT(DISTINCT submission.application_id) <> 1 THEN 'esdc_application_count_not_one'
    WHEN MIN(application.case_id) <> plan.case_id OR MAX(application.case_id) <> plan.case_id
      THEN 'application_case_mismatch'
    WHEN COUNT(DISTINCT intervention.id) <> 2 THEN 'intervention_count_not_two'
    ELSE NULL
  END AS blocker
FROM iset_case_action_plan plan
LEFT JOIN esdc_participant_submission submission
  ON submission.action_plan_id = plan.id
 AND submission.case_id = plan.case_id
LEFT JOIN iset_application application
  ON application.id = submission.application_id
LEFT JOIN iset_case_intervention intervention
  ON intervention.action_plan_id = plan.id
WHERE plan.id IN (55, 57)
GROUP BY plan.id, plan.case_id, plan.application_id, plan.metadata_json
HAVING blocker IS NOT NULL;

SELECT
  COUNT(*) AS existing_repair_events
FROM iset_case_event event
WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
      'prod-denied-reporting-lineage-backfill-20260727';
