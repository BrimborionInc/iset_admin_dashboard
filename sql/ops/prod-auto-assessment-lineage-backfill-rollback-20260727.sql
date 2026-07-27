-- Emergency rollback for prod-auto-assessment-lineage-backfill-20260727.
--
-- Use only immediately after the repair and only after confirming that no new downstream
-- activity has relied on these restored links. The rollback restores the exact pre-repair
-- NULL application links and records a separate rollback audit event.
--
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file \
--     sql/ops/prod-auto-assessment-lineage-backfill-rollback-20260727.sql

DROP PROCEDURE IF EXISTS prod_auto_assessment_lineage_backfill_rollback_20260727;

DELIMITER //

CREATE PROCEDURE prod_auto_assessment_lineage_backfill_rollback_20260727()
BEGIN
  DECLARE v_plan_count INT DEFAULT 0;
  DECLARE v_proposal_count INT DEFAULT 0;
  DECLARE v_esdc_count INT DEFAULT 0;
  DECLARE v_repair_event_count INT DEFAULT 0;
  DECLARE v_rollback_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_expected_auto_assessment_lineage_rollback_20260727;
  CREATE TEMPORARY TABLE tmp_expected_auto_assessment_lineage_rollback_20260727 (
    action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL
  );

  INSERT INTO tmp_expected_auto_assessment_lineage_rollback_20260727
    (action_plan_id, case_id, application_id)
  VALUES
    (12, 88, 6),
    (28, 84, 2),
    (30, 79, 42),
    (31, 98, 16),
    (34, 85, 3),
    (54, 134, 56),
    (56, 120, 39),
    (71, 16, 54),
    (83, 103, 21),
    (101, 166, 97),
    (105, 60, 72),
    (108, 133, 55),
    (109, 65, 38),
    (112, 97, 15);

  SELECT COUNT(*) INTO v_plan_count
  FROM iset_case_action_plan plan
  JOIN tmp_expected_auto_assessment_lineage_rollback_20260727 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
   AND expected.application_id = plan.application_id;

  SELECT COUNT(*) INTO v_proposal_count
  FROM iset_intervention_proposal proposal
  WHERE (proposal.id, proposal.action_plan_id, proposal.application_id) IN (
    (354, 108, 55),
    (355, 108, 55),
    (356, 108, 55)
  );

  SELECT COUNT(*) INTO v_esdc_count
  FROM esdc_participant_submission submission
  WHERE (submission.id, submission.action_plan_id, submission.application_id) IN (
    (13, 28, 2),
    (25, 34, 3)
  );

  SELECT COUNT(*) INTO v_repair_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-auto-assessment-lineage-backfill-20260727';

  SELECT COUNT(*) INTO v_rollback_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-auto-assessment-lineage-backfill-rollback-20260727';

  IF v_plan_count <> 14
     OR v_proposal_count <> 3
     OR v_esdc_count <> 2
     OR v_repair_event_count <> 14
     OR v_rollback_event_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: repaired state no longer exactly matches the expected immediate post-repair state.';
  END IF;

  START TRANSACTION;

  UPDATE iset_intervention_proposal
  SET application_id = NULL
  WHERE (id, action_plan_id, application_id) IN (
    (354, 108, 55),
    (355, 108, 55),
    (356, 108, 55)
  );

  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: proposal rollback count did not equal 3.';
  END IF;

  UPDATE esdc_participant_submission
  SET application_id = NULL
  WHERE (id, action_plan_id, application_id) IN (
    (13, 28, 2),
    (25, 34, 3)
  );

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: ESDC rollback count did not equal 2.';
  END IF;

  UPDATE iset_case_action_plan plan
  JOIN tmp_expected_auto_assessment_lineage_rollback_20260727 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
   AND expected.application_id = plan.application_id
  SET plan.application_id = NULL;

  IF ROW_COUNT() <> 14 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: action-plan rollback count did not equal 14.';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    source_system
  )
  SELECT
    expected.case_id,
    'data_repair',
    CONCAT('Rolled back application provenance repair for action plan ', expected.action_plan_id),
    JSON_OBJECT(
      'repairId', 'prod-auto-assessment-lineage-backfill-rollback-20260727',
      'forwardRepairId', 'prod-auto-assessment-lineage-backfill-20260727',
      'actionPlanId', expected.action_plan_id,
      'applicationIdRemoved', expected.application_id,
      'reason', 'Emergency rollback of the historical provenance backfill.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM tmp_expected_auto_assessment_lineage_rollback_20260727 expected;

  IF ROW_COUNT() <> 14 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: rollback audit event count did not equal 14.';
  END IF;

  COMMIT;

  SELECT
    14 AS rolled_back_action_plans,
    3 AS rolled_back_proposals,
    2 AS rolled_back_esdc_submissions,
    14 AS inserted_rollback_audit_events;
END//

DELIMITER ;

CALL prod_auto_assessment_lineage_backfill_rollback_20260727();

DROP PROCEDURE IF EXISTS prod_auto_assessment_lineage_backfill_rollback_20260727;
