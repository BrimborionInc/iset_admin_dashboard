-- Guarded PROD backfill for historical auto-assessment action-plan provenance.
--
-- Mutations:
-- - iset_case_action_plan.application_id: 14 NULL -> exact application IDs
-- - iset_intervention_proposal.application_id: 3 NULL -> their plan's exact application ID
-- - esdc_participant_submission.application_id: 2 NULL -> their plan's exact application ID
-- - iset_case_event: 14 data_repair audit events
--
-- No intervention, funding, status, document, application, assessment, or case values change.
-- Do not run without explicit current Bill approval and a clean preview.
--
-- Run with:
--   bash scripts/run-prod-sql-via-ssm.sh --sql-file \
--     sql/ops/prod-auto-assessment-lineage-backfill-apply-20260727.sql

DROP PROCEDURE IF EXISTS prod_auto_assessment_lineage_backfill_20260727;

DELIMITER //

CREATE PROCEDURE prod_auto_assessment_lineage_backfill_20260727()
BEGIN
  DECLARE v_expected_plan_count INT DEFAULT 14;
  DECLARE v_expected_intervention_count INT DEFAULT 44;
  DECLARE v_expected_proposal_count INT DEFAULT 3;
  DECLARE v_expected_esdc_count INT DEFAULT 2;
  DECLARE v_valid_plan_count INT DEFAULT 0;
  DECLARE v_intervention_count INT DEFAULT 0;
  DECLARE v_matched_intervention_count INT DEFAULT 0;
  DECLARE v_ambiguous_plan_count INT DEFAULT 0;
  DECLARE v_null_proposal_count INT DEFAULT 0;
  DECLARE v_null_esdc_count INT DEFAULT 0;
  DECLARE v_proposal_mismatch_count INT DEFAULT 0;
  DECLARE v_esdc_mismatch_count INT DEFAULT 0;
  DECLARE v_dependency_mismatch_count INT DEFAULT 0;
  DECLARE v_existing_event_count INT DEFAULT 0;
  DECLARE v_updated_plan_count INT DEFAULT 0;
  DECLARE v_updated_proposal_count INT DEFAULT 0;
  DECLARE v_updated_esdc_count INT DEFAULT 0;
  DECLARE v_inserted_event_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_expected_auto_assessment_lineage_20260727;
  CREATE TEMPORARY TABLE tmp_expected_auto_assessment_lineage_20260727 (
    action_plan_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    case_id BIGINT UNSIGNED NOT NULL,
    application_id BIGINT UNSIGNED NOT NULL
  );

  INSERT INTO tmp_expected_auto_assessment_lineage_20260727
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

  SELECT COUNT(*) INTO v_valid_plan_count
  FROM tmp_expected_auto_assessment_lineage_20260727 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
  JOIN iset_application application
    ON application.id = expected.application_id
   AND application.case_id = expected.case_id
  JOIN iset_application_assessment assessment
    ON assessment.application_id = expected.application_id
   AND assessment.case_id = expected.case_id
  WHERE plan.application_id IS NULL
    AND plan.archived_at IS NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'auto_assessment'
    AND EXISTS (
      SELECT 1
      FROM iset_case_intervention intervention
      WHERE intervention.action_plan_id = expected.action_plan_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM iset_case_intervention intervention
      WHERE intervention.action_plan_id = expected.action_plan_id
        AND (
          JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')) IS NULL
          OR JSON_SEARCH(
               assessment.proposed_interventions,
               'one',
               JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')),
               NULL,
               '$[*].id'
             ) IS NULL
        )
    );

  IF v_valid_plan_count <> v_expected_plan_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 14 exact auto-assessment action-plan mappings.';
  END IF;

  SELECT
    COUNT(*),
    SUM(
      JSON_SEARCH(
        assessment.proposed_interventions,
        'one',
        JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')),
        NULL,
        '$[*].id'
      ) IS NOT NULL
    )
  INTO v_intervention_count, v_matched_intervention_count
  FROM tmp_expected_auto_assessment_lineage_20260727 expected
  JOIN iset_application_assessment assessment
    ON assessment.application_id = expected.application_id
   AND assessment.case_id = expected.case_id
  JOIN iset_case_intervention intervention
    ON intervention.action_plan_id = expected.action_plan_id;

  IF v_intervention_count <> v_expected_intervention_count
     OR v_matched_intervention_count <> v_expected_intervention_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: all 44 interventions must match their exact assessment identifiers.';
  END IF;

  SELECT COUNT(*) INTO v_ambiguous_plan_count
  FROM (
    SELECT
      expected.action_plan_id
    FROM tmp_expected_auto_assessment_lineage_20260727 expected
    LEFT JOIN iset_case_intervention intervention
      ON intervention.action_plan_id = expected.action_plan_id
    LEFT JOIN iset_application_assessment discovered
      ON discovered.case_id = expected.case_id
     AND JSON_SEARCH(
           discovered.proposed_interventions,
           'one',
           JSON_UNQUOTE(JSON_EXTRACT(intervention.metadata_json, '$.proposedInterventionId')),
           NULL,
           '$[*].id'
         ) IS NOT NULL
    GROUP BY expected.action_plan_id, expected.application_id
    HAVING COUNT(DISTINCT discovered.application_id) <> 1
        OR MIN(discovered.application_id) <> expected.application_id
        OR MAX(discovered.application_id) <> expected.application_id
  ) ambiguous;

  IF v_ambiguous_plan_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: an action plan has ambiguous application provenance.';
  END IF;

  SELECT COUNT(*) INTO v_null_proposal_count
  FROM iset_intervention_proposal proposal
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = proposal.action_plan_id
   AND expected.case_id = proposal.case_id
  WHERE proposal.application_id IS NULL;

  IF v_null_proposal_count <> v_expected_proposal_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected exactly 3 null proposal application links.';
  END IF;

  SELECT COUNT(*) INTO v_null_esdc_count
  FROM esdc_participant_submission submission
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = submission.action_plan_id
   AND expected.case_id = submission.case_id
  WHERE submission.application_id IS NULL;

  IF v_null_esdc_count <> v_expected_esdc_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected exactly 2 null ESDC application links.';
  END IF;

  SELECT COUNT(*) INTO v_proposal_mismatch_count
  FROM iset_intervention_proposal proposal
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = proposal.action_plan_id
  WHERE proposal.application_id IS NOT NULL
    AND (
      proposal.case_id <> expected.case_id
      OR proposal.application_id <> expected.application_id
    );

  SELECT COUNT(*) INTO v_esdc_mismatch_count
  FROM esdc_participant_submission submission
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = submission.action_plan_id
  WHERE submission.application_id IS NOT NULL
    AND (
      submission.case_id <> expected.case_id
      OR submission.application_id <> expected.application_id
    );

  SET v_dependency_mismatch_count = v_proposal_mismatch_count + v_esdc_mismatch_count;

  IF v_dependency_mismatch_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: an existing dependent application link conflicts with the expected plan lineage.';
  END IF;

  SELECT COUNT(*) INTO v_existing_event_count
  FROM iset_case_event event
  WHERE JSON_UNQUOTE(JSON_EXTRACT(event.payload_json, '$.repairId')) =
        'prod-auto-assessment-lineage-backfill-20260727';

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
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
  ORDER BY plan.id
  FOR UPDATE;

  UPDATE iset_case_action_plan plan
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = plan.id
   AND expected.case_id = plan.case_id
  SET plan.application_id = expected.application_id
  WHERE plan.application_id IS NULL
    AND plan.archived_at IS NULL
    AND JSON_UNQUOTE(JSON_EXTRACT(plan.metadata_json, '$.source')) = 'auto_assessment';

  SET v_updated_plan_count = ROW_COUNT();

  IF v_updated_plan_count <> v_expected_plan_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: action-plan update count did not equal 14.';
  END IF;

  UPDATE iset_intervention_proposal proposal
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = proposal.action_plan_id
   AND expected.case_id = proposal.case_id
  SET proposal.application_id = expected.application_id
  WHERE proposal.application_id IS NULL;

  SET v_updated_proposal_count = ROW_COUNT();

  IF v_updated_proposal_count <> v_expected_proposal_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: proposal update count did not equal 3.';
  END IF;

  UPDATE esdc_participant_submission submission
  JOIN tmp_expected_auto_assessment_lineage_20260727 expected
    ON expected.action_plan_id = submission.action_plan_id
   AND expected.case_id = submission.case_id
  SET submission.application_id = expected.application_id
  WHERE submission.application_id IS NULL;

  SET v_updated_esdc_count = ROW_COUNT();

  IF v_updated_esdc_count <> v_expected_esdc_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: ESDC submission update count did not equal 2.';
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
      'repairId', 'prod-auto-assessment-lineage-backfill-20260727',
      'actionPlanId', expected.action_plan_id,
      'applicationId', expected.application_id,
      'previousApplicationId', NULL,
      'basis', 'Exact auto-assessment proposedInterventionId match',
      'reason', 'Historical application-derived action plan was created before application provenance was persisted.'
    ),
    CURRENT_TIMESTAMP(3),
    'codex-prod-data-repair'
  FROM tmp_expected_auto_assessment_lineage_20260727 expected;

  SET v_inserted_event_count = ROW_COUNT();

  IF v_inserted_event_count <> v_expected_plan_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: audit event count did not equal 14.';
  END IF;

  COMMIT;

  SELECT
    v_updated_plan_count AS updated_action_plans,
    v_updated_proposal_count AS updated_proposals,
    v_updated_esdc_count AS updated_esdc_submissions,
    v_inserted_event_count AS inserted_audit_events;

  SELECT
    expected.action_plan_id,
    expected.case_id,
    plan.application_id,
    COUNT(DISTINCT intervention.id) AS intervention_count
  FROM tmp_expected_auto_assessment_lineage_20260727 expected
  JOIN iset_case_action_plan plan
    ON plan.id = expected.action_plan_id
   AND plan.case_id = expected.case_id
   AND plan.application_id = expected.application_id
  JOIN iset_case_intervention intervention
    ON intervention.action_plan_id = expected.action_plan_id
  GROUP BY expected.action_plan_id, expected.case_id, plan.application_id
  ORDER BY expected.action_plan_id;
END//

DELIMITER ;

CALL prod_auto_assessment_lineage_backfill_20260727();

DROP PROCEDURE IF EXISTS prod_auto_assessment_lineage_backfill_20260727;
