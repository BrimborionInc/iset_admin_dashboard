-- Guarded PROD repair for four deterministic Regional Snapshot action-plan links.
-- Action plan 15 is deliberately excluded because it mixes historical and renewal work.
--
-- Mutations:
-- - iset_case_action_plan.application_id: four NULL values -> exact application IDs
-- - iset_case_event: four data_repair audit events

DROP PROCEDURE IF EXISTS prod_regional_snapshot_lineage_backfill_20260728;

DELIMITER //

CREATE PROCEDURE prod_regional_snapshot_lineage_backfill_20260728()
BEGIN
  DECLARE v_valid_plan_count INT DEFAULT 0;
  DECLARE v_supported_plan_count INT DEFAULT 0;
  DECLARE v_proposal_conflict_count INT DEFAULT 0;
  DECLARE v_esdc_conflict_count INT DEFAULT 0;
  DECLARE v_existing_event_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_expected_snapshot_lineage_20260728;
  CREATE TEMPORARY TABLE tmp_expected_snapshot_lineage_20260728 (
    action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL,
    expected_status VARCHAR(32) NOT NULL,
    expected_source VARCHAR(64) NULL,
    expected_archived TINYINT(1) NOT NULL,
    expected_intervention_count INT NOT NULL,
    basis VARCHAR(255) NOT NULL
  );

  INSERT INTO tmp_expected_snapshot_lineage_20260728 VALUES
    (27, 90, 8, 'active', NULL, 0, 1, 'Proposal 97 and ESDC submission 32 both retain application 8'),
    (29, 131, 52, 'archived', 'auto_assessment', 1, 4, 'Proposals 111 and 216 both retain application 52'),
    (32, 127, 48, 'archived', 'auto_assessment', 1, 2, 'ESDC submission 21 retains application 48'),
    (53, 94, 12, 'closed', 'manual_backload', 0, 2, 'Proposals 175/176 and ESDC submission 115 retain application 12');

  SELECT COUNT(*) INTO v_valid_plan_count
  FROM tmp_expected_snapshot_lineage_20260728 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
  JOIN iset_application application
    ON application.id = expected.application_id
   AND application.case_id = expected.case_id
  WHERE plan.application_id IS NULL
    AND CAST(plan.status AS BINARY) = CAST(expected.expected_status AS BINARY)
    AND (
      CAST(JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) AS BINARY)
        <=> CAST(expected.expected_source AS BINARY)
    )
    AND ((plan.archived_at IS NOT NULL) <=> expected.expected_archived)
    AND (SELECT COUNT(*)
           FROM iset_case_intervention intervention
          WHERE intervention.action_plan_id = expected.action_plan_id)
        = expected.expected_intervention_count;

  IF v_valid_plan_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected four unchanged action-plan targets.';
  END IF;

  SELECT COUNT(*) INTO v_proposal_conflict_count
  FROM tmp_expected_snapshot_lineage_20260728 expected
  JOIN iset_intervention_proposal proposal
    ON proposal.action_plan_id = expected.action_plan_id
  WHERE proposal.application_id IS NOT NULL
    AND proposal.application_id <> expected.application_id;

  SELECT COUNT(*) INTO v_esdc_conflict_count
  FROM tmp_expected_snapshot_lineage_20260728 expected
  JOIN esdc_participant_submission submission
    ON submission.action_plan_id = expected.action_plan_id
  WHERE submission.application_id IS NOT NULL
    AND submission.application_id <> expected.application_id;

  IF v_proposal_conflict_count <> 0 OR v_esdc_conflict_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: dependent provenance conflicts with an expected application.';
  END IF;

  SELECT COUNT(DISTINCT expected.action_plan_id) INTO v_supported_plan_count
  FROM tmp_expected_snapshot_lineage_20260728 expected
  LEFT JOIN iset_intervention_proposal proposal
    ON proposal.action_plan_id = expected.action_plan_id
   AND proposal.application_id = expected.application_id
  LEFT JOIN esdc_participant_submission submission
    ON submission.action_plan_id = expected.action_plan_id
   AND submission.application_id = expected.application_id
  WHERE proposal.id IS NOT NULL OR submission.id IS NOT NULL;

  IF v_supported_plan_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: every plan must retain exact proposal or ESDC provenance.';
  END IF;

  SELECT COUNT(*) INTO v_existing_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-regional-snapshot-lineage-backfill-20260728';

  IF v_existing_event_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: this repair has already been recorded.';
  END IF;

  START TRANSACTION;

  SELECT
    plan.id,
    plan.case_id,
    plan.application_id,
    expected.application_id AS expected_application_id
  FROM iset_case_action_plan plan
  JOIN tmp_expected_snapshot_lineage_20260728 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
  ORDER BY plan.id
  FOR UPDATE;

  UPDATE iset_case_action_plan plan
  JOIN tmp_expected_snapshot_lineage_20260728 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
  SET plan.application_id = expected.application_id
  WHERE plan.application_id IS NULL;

  SET v_updated_count = ROW_COUNT();

  IF v_updated_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: action-plan update count did not equal four.';
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
      'Restored application provenance for action plan ',
      expected.action_plan_id,
      ' to application ',
      expected.application_id
    ),
    JSON_OBJECT(
      'repairId', 'prod-regional-snapshot-lineage-backfill-20260728',
      'actionPlanId', expected.action_plan_id,
      'applicationId', expected.application_id,
      'previousApplicationId', NULL,
      'basis', expected.basis,
      'reason', 'Historical application-derived action plan lacked direct application provenance.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM tmp_expected_snapshot_lineage_20260728 expected;

  SET v_event_count = ROW_COUNT();

  IF v_event_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: audit event count did not equal four.';
  END IF;

  COMMIT;

  SELECT
    v_updated_count AS updated_action_plans,
    v_event_count AS inserted_audit_events;

  SELECT
    expected.action_plan_id,
    expected.case_id,
    plan.application_id,
    expected.basis
  FROM tmp_expected_snapshot_lineage_20260728 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
   AND plan.application_id = expected.application_id
  ORDER BY expected.action_plan_id;
END//

DELIMITER ;

CALL prod_regional_snapshot_lineage_backfill_20260728();

DROP PROCEDURE IF EXISTS prod_regional_snapshot_lineage_backfill_20260728;
