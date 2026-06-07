-- PROD guarded repair: Sarah Froese CASE-2026-0000040 future action plan.
-- Restore point: path-prod-sarah-froese-plan6-planned-20260605022919
--
-- Plan 6 starts in the future and should not be active while plan 5 is active.
-- Action plan "Planned" is stored as status = 'draft'.
-- Intervention "Planned" is stored as status = 'approved', delivery_status = 'planned'.

START TRANSACTION;

SELECT
  'before' AS phase,
  ap.id AS action_plan_id,
  ap.status,
  ap.effective_date,
  ap.activated_at,
  ap.updated_at
FROM iset_case_action_plan ap
WHERE ap.case_id = 40
ORDER BY ap.id;

SELECT
  'before' AS phase,
  ci.id AS intervention_id,
  ci.action_plan_id,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.updated_at
FROM iset_case_intervention ci
WHERE ci.case_id = 40
ORDER BY ci.action_plan_id, ci.id;

UPDATE iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
JOIN client cl ON cl.id = c.client_id
SET
  ap.status = 'draft',
  ap.activated_at = NULL,
  ap.closed_at = NULL,
  ap.metadata_json = JSON_SET(
    COALESCE(ap.metadata_json, JSON_OBJECT()),
    '$.dataRepair.sarahFroesePlan6Planned20260605',
    JSON_OBJECT(
      'runId', 'sarah-froese-plan6-planned-20260605',
      'restorePoint', 'path-prod-sarah-froese-plan6-planned-20260605022919',
      'reason', 'Future-dated action plan was incorrectly active while earlier plan remained active.',
      'previousStatus', 'active',
      'newStatus', 'draft',
      'repairedAt', UTC_TIMESTAMP()
    )
  ),
  ap.updated_at = NOW()
WHERE ap.id = 6
  AND ap.case_id = 40
  AND c.case_number = 'CASE-2026-0000040'
  AND cl.first_name = 'Sarah'
  AND cl.last_name = 'Froese'
  AND ap.status = 'active'
  AND ap.effective_date > CURDATE()
  AND ap.archived_at IS NULL;

SELECT ROW_COUNT() AS action_plan_rows_updated;

UPDATE iset_case_intervention ci
JOIN iset_case_action_plan ap ON ap.id = ci.action_plan_id
JOIN iset_case c ON c.id = ci.case_id
JOIN client cl ON cl.id = c.client_id
SET
  ci.status = 'approved',
  ci.delivery_status = 'planned',
  ci.closed_at = NULL,
  ci.metadata_json = JSON_SET(
    COALESCE(ci.metadata_json, JSON_OBJECT()),
    '$.dataRepair.sarahFroesePlan6Planned20260605',
    JSON_OBJECT(
      'runId', 'sarah-froese-plan6-planned-20260605',
      'restorePoint', 'path-prod-sarah-froese-plan6-planned-20260605022919',
      'reason', 'Future-dated intervention was incorrectly in progress because its future parent plan auto-activated.',
      'previousStatus', 'in_progress',
      'previousDeliveryStatus', 'in_progress',
      'newStatus', 'approved',
      'newDeliveryStatus', 'planned',
      'repairedAt', UTC_TIMESTAMP()
    )
  ),
  ci.updated_at = NOW()
WHERE ci.id = 37
  AND ci.case_id = 40
  AND ci.action_plan_id = 6
  AND c.case_number = 'CASE-2026-0000040'
  AND cl.first_name = 'Sarah'
  AND cl.last_name = 'Froese'
  AND ci.status = 'in_progress'
  AND ci.delivery_status = 'in_progress'
  AND ci.start_date > CURDATE();

SELECT ROW_COUNT() AS intervention_rows_updated;

UPDATE esdc_participant_submission eps
SET
  eps.readiness_status = 'needs_review',
  eps.readiness_summary = NULL,
  eps.warnings = NULL,
  eps.blocking_issues = NULL,
  eps.last_validated_at = NULL,
  eps.submission_status = 'pending',
  eps.submitted_at = NULL,
  eps.submitted_by_user_id = NULL,
  eps.payload_snapshot = NULL,
  eps.payload_storage_key = NULL,
  eps.payload_checksum = NULL,
  eps.rejection_reason = NULL,
  eps.updated_at = NOW()
WHERE eps.case_id = 40
  AND eps.action_plan_id = 6
  AND eps.submission_status IN ('pending', 'rejected');

SELECT ROW_COUNT() AS esdc_submission_rows_reset;

INSERT INTO iset_case_event
  (case_id, event_type, summary, payload_json, actor_user_id, source_system)
VALUES
  (
    40,
    'data_repair',
    'Moved future Sarah Froese action plan back to planned/draft.',
    JSON_OBJECT(
      'runId', 'sarah-froese-plan6-planned-20260605',
      'restorePoint', 'path-prod-sarah-froese-plan6-planned-20260605022919',
      'caseNumber', 'CASE-2026-0000040',
      'actionPlanId', 6,
      'interventionId', 37,
      'reason', 'Plan 6 starts in the future and should not be active while plan 5 remains active.',
      'actionPlanStatus', JSON_OBJECT('from', 'active', 'to', 'draft'),
      'interventionStatus', JSON_OBJECT('from', 'in_progress', 'to', 'approved'),
      'interventionDeliveryStatus', JSON_OBJECT('from', 'in_progress', 'to', 'planned')
    ),
    NULL,
    'codex'
  );

SELECT
  'after' AS phase,
  ap.id AS action_plan_id,
  ap.status,
  ap.effective_date,
  ap.activated_at,
  ap.updated_at
FROM iset_case_action_plan ap
WHERE ap.case_id = 40
ORDER BY ap.id;

SELECT
  'after' AS phase,
  ci.id AS intervention_id,
  ci.action_plan_id,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.updated_at
FROM iset_case_intervention ci
WHERE ci.case_id = 40
ORDER BY ci.action_plan_id, ci.id;

SELECT
  'duplicate_active_check' AS check_name,
  ap.case_id,
  COUNT(*) AS active_count,
  GROUP_CONCAT(ap.id ORDER BY ap.id) AS active_plan_ids
FROM iset_case_action_plan ap
WHERE ap.case_id = 40
  AND ap.status = 'active'
  AND ap.archived_at IS NULL
GROUP BY ap.case_id;

COMMIT;
