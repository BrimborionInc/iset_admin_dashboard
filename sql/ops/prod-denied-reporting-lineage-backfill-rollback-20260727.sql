-- Emergency rollback for prod-denied-reporting-lineage-backfill-20260727.
-- Use only after confirming no new downstream activity has relied on the restored links.

DROP PROCEDURE IF EXISTS prod_denied_reporting_lineage_backfill_rollback_20260727;

DELIMITER //

CREATE PROCEDURE prod_denied_reporting_lineage_backfill_rollback_20260727()
BEGIN
  DECLARE v_valid_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT COUNT(*) INTO v_valid_count
  FROM iset_case_action_plan plan
  WHERE (plan.id, plan.case_id, plan.application_id) IN (
    (55, 123, 43),
    (57, 145, 69)
  )
    AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'denied_reporting'
    AND (SELECT COUNT(*)
         FROM iset_case_event event
         WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
               'prod-denied-reporting-lineage-backfill-20260727'
           AND JSON_EXTRACT(event.payload_json, '$.actionPlanId') = plan.id) = 1;

  IF v_valid_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: denied-reporting repaired state changed.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_action_plan
  SET application_id = NULL
  WHERE (id, case_id, application_id) IN (
    (55, 123, 43),
    (57, 145, 69)
  );

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: denied-reporting rollback count did not equal 2.';
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
    plan.case_id,
    'data_repair',
    CONCAT('Rolled back application provenance repair for denied-reporting action plan ', plan.id),
    JSON_OBJECT(
      'repairId', 'prod-denied-reporting-lineage-backfill-rollback-20260727',
      'forwardRepairId', 'prod-denied-reporting-lineage-backfill-20260727',
      'actionPlanId', plan.id,
      'applicationIdRemoved', CASE plan.id WHEN 55 THEN 43 WHEN 57 THEN 69 END
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM iset_case_action_plan plan
  WHERE plan.id IN (55, 57);

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: denied-reporting rollback event count did not equal 2.';
  END IF;

  COMMIT;

  SELECT 2 AS rolled_back_action_plans, 2 AS inserted_rollback_audit_events;
END//

DELIMITER ;

CALL prod_denied_reporting_lineage_backfill_rollback_20260727();

DROP PROCEDURE IF EXISTS prod_denied_reporting_lineage_backfill_rollback_20260727;
