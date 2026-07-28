-- Emergency rollback for the immediate post-repair state created by
-- prod-regional-snapshot-lineage-backfill-apply-20260728.sql.
--
-- Do not run after new dependent activity without a fresh review.

DROP PROCEDURE IF EXISTS prod_regional_snapshot_lineage_rollback_20260728;

DELIMITER //

CREATE PROCEDURE prod_regional_snapshot_lineage_rollback_20260728()
BEGIN
  DECLARE v_plan_count INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_deleted_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_expected_snapshot_lineage_rollback_20260728;
  CREATE TEMPORARY TABLE tmp_expected_snapshot_lineage_rollback_20260728 (
    action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL
  );

  INSERT INTO tmp_expected_snapshot_lineage_rollback_20260728 VALUES
    (27, 90, 8),
    (29, 131, 52),
    (32, 127, 48),
    (53, 94, 12);

  SELECT COUNT(*) INTO v_plan_count
  FROM tmp_expected_snapshot_lineage_rollback_20260728 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
   AND plan.application_id = expected.application_id;

  SELECT COUNT(*) INTO v_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-regional-snapshot-lineage-backfill-20260728';

  IF v_plan_count <> 4 OR v_event_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: expected immediate four-plan/four-event repair state.';
  END IF;

  START TRANSACTION;

  UPDATE iset_case_action_plan plan
  JOIN tmp_expected_snapshot_lineage_rollback_20260728 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
   AND expected.application_id = plan.application_id
  SET plan.application_id = NULL;

  SET v_updated_count = ROW_COUNT();

  DELETE FROM iset_case_event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) =
        'prod-regional-snapshot-lineage-backfill-20260728';

  SET v_deleted_event_count = ROW_COUNT();

  IF v_updated_count <> 4 OR v_deleted_event_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Rollback guard failed: mutation counts did not equal four.';
  END IF;

  COMMIT;

  SELECT
    v_updated_count AS reverted_action_plans,
    v_deleted_event_count AS deleted_audit_events;
END//

DELIMITER ;

CALL prod_regional_snapshot_lineage_rollback_20260728();

DROP PROCEDURE IF EXISTS prod_regional_snapshot_lineage_rollback_20260728;
