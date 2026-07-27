-- Guarded PROD application-provenance backfill for denied-reporting plans 55 and 57.
-- The exact application is retained by each plan's unique same-case ESDC participant submission.
--
-- Mutations:
-- - iset_case_action_plan.application_id: plan 55 -> application 43; plan 57 -> application 69
-- - iset_case_event: two data_repair audit events
--
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file \
--     sql/ops/prod-denied-reporting-lineage-backfill-apply-20260727.sql

DROP PROCEDURE IF EXISTS prod_denied_reporting_lineage_backfill_20260727;

DELIMITER //

CREATE PROCEDURE prod_denied_reporting_lineage_backfill_20260727()
BEGIN
  DECLARE v_valid_count INT DEFAULT 0;
  DECLARE v_existing_event_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_expected_denied_reporting_lineage_20260727;
  CREATE TEMPORARY TABLE tmp_expected_denied_reporting_lineage_20260727 (
    action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    esdc_submission_id BIGINT UNSIGNED NOT NULL
  );

  INSERT INTO tmp_expected_denied_reporting_lineage_20260727
    (action_plan_id, case_id, application_id, esdc_submission_id)
  VALUES
    (55, 123, 43, 119),
    (57, 145, 69, 123);

  SELECT COUNT(*) INTO v_valid_count
  FROM tmp_expected_denied_reporting_lineage_20260727 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
  JOIN esdc_participant_submission submission
    ON submission.id = expected.esdc_submission_id
   AND submission.action_plan_id = expected.action_plan_id
   AND submission.case_id = expected.case_id
   AND submission.application_id = expected.application_id
  JOIN iset_application application
    ON application.id = expected.application_id
   AND application.case_id = expected.case_id
  WHERE plan.application_id IS NULL
    AND plan.archived_at IS NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'denied_reporting'
    AND (SELECT COUNT(*)
         FROM esdc_participant_submission scoped
         WHERE scoped.action_plan_id = expected.action_plan_id) = 1
    AND (SELECT COUNT(*)
         FROM iset_case_intervention intervention
         WHERE intervention.action_plan_id = expected.action_plan_id) = 2;

  IF v_valid_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected two exact denied-reporting provenance mappings.';
  END IF;

  SELECT COUNT(*) INTO v_existing_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-denied-reporting-lineage-backfill-20260727';

  IF v_existing_event_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: this denied-reporting repair has already been recorded.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_action_plan plan
  JOIN tmp_expected_denied_reporting_lineage_20260727 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
  SET plan.application_id = expected.application_id
  WHERE plan.application_id IS NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'denied_reporting';

  SET v_updated_count = ROW_COUNT();

  IF v_updated_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: denied-reporting action-plan update count did not equal 2.';
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
    CONCAT(
      'Restored application provenance for denied-reporting action plan ',
      expected.action_plan_id,
      ' to application ',
      expected.application_id
    ),
    JSON_OBJECT(
      'repairId', 'prod-denied-reporting-lineage-backfill-20260727',
      'actionPlanId', expected.action_plan_id,
      'applicationId', expected.application_id,
      'previousApplicationId', NULL,
      'basis', 'Unique same-case ESDC participant submission',
      'reason', 'Historical application-derived denied-reporting plan lacked application provenance.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM tmp_expected_denied_reporting_lineage_20260727 expected;

  SET v_event_count = ROW_COUNT();

  IF v_event_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: denied-reporting audit event count did not equal 2.';
  END IF;

  COMMIT;

  SELECT
    v_updated_count AS updated_action_plans,
    v_event_count AS inserted_audit_events;
END//

DELIMITER ;

CALL prod_denied_reporting_lineage_backfill_20260727();

DROP PROCEDURE IF EXISTS prod_denied_reporting_lineage_backfill_20260727;
