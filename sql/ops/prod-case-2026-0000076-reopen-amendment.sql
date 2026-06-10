DROP PROCEDURE IF EXISTS repair_case_2026_0000076_reopen_amendment;

DELIMITER //

CREATE PROCEDURE repair_case_2026_0000076_reopen_amendment()
BEGIN
  DECLARE v_case_count INT DEFAULT 0;
  DECLARE v_plan_count INT DEFAULT 0;
  DECLARE v_intervention_count INT DEFAULT 0;
  DECLARE v_submission_count INT DEFAULT 0;
  DECLARE v_blocking_proposals INT DEFAULT 0;
  DECLARE v_other_active_plans INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_case_count
    FROM iset_case
   WHERE id = 76
     AND case_number = 'CASE-2026-0000076'
     AND status = 'dormant'
     AND lifecycle_status = 'dormant'
     AND closed_at IS NULL
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_plan_count
    FROM iset_case_action_plan
   WHERE id = 3
     AND case_id = 76
     AND status = 'closed'
     AND archived_at IS NULL
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_intervention_count
    FROM iset_case_intervention
   WHERE id = 7
     AND case_id = 76
     AND action_plan_id = 3
     AND status = 'completed'
     AND delivery_status = 'completed'
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_submission_count
    FROM esdc_participant_submission
   WHERE id = 52
     AND case_id = 76
     AND action_plan_id = 3
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_blocking_proposals
    FROM iset_case_intervention
   WHERE case_id = 76
     AND status IN ('draft', 'submitted', 'in_review', 'changes_requested')
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_other_active_plans
    FROM iset_case_action_plan
   WHERE case_id = 76
     AND id <> 3
     AND status = 'active'
     AND archived_at IS NULL
   FOR UPDATE;

  IF v_case_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_case_state';
  END IF;
  IF v_plan_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_action_plan_state';
  END IF;
  IF v_intervention_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_intervention_state';
  END IF;
  IF v_submission_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_submission_state';
  END IF;
  IF v_blocking_proposals <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_open_intervention_proposal';
  END IF;
  IF v_other_active_plans <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_other_active_plan';
  END IF;

  UPDATE iset_case
     SET status = 'active',
         lifecycle_status = 'active',
         closure_reason = NULL,
         closed_at = NULL,
         open_intervention_count = 1,
         total_intervention_count = 1,
         updated_at = NOW()
   WHERE id = 76
     AND case_number = 'CASE-2026-0000076';

  UPDATE iset_case_action_plan
     SET status = 'active',
         closed_at = NULL,
         result_code = NULL,
         result_date = NULL,
         outcome_summary = NULL,
         closure_notes = NULL,
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.compliance.ilmp', 'pending',
           '$.reopenRecovery',
           JSON_OBJECT(
             'reason', 'change_in_circumstances_additional_funding_amendment',
             'reopenedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
             'performedBy', 'codex-prod-data-repair',
             'request', 'Reopen for Emilie to propose additional funding amendment for Joanna Nevers.'
           )
         ),
         esdc_action_plan_json = JSON_REMOVE(
           COALESCE(esdc_action_plan_json, JSON_OBJECT()),
           '$.actionPlanResultCode',
           '$.actionPlanResultDate',
           '$.actionPlanResultEducationLevel',
           '$.actionPlanFutureEducationLevel',
           '$.actionPlanResultRelatedNOC',
           '$.actionPlanResultRelatedNOCVersion'
         ),
         updated_at = NOW()
   WHERE id = 3
     AND case_id = 76;

  UPDATE iset_case_intervention
     SET status = 'in_progress',
         delivery_status = 'in_progress',
         closed_at = NULL,
         outcome_code = NULL,
         actual_amount = NULL,
         metadata_json = JSON_SET(
           JSON_REMOVE(
             COALESCE(metadata_json, JSON_OBJECT()),
             '$.outcome',
             '$.actualAmount',
             '$.compliance.ilmp',
             '$.compliance.finance'
           ),
           '$.compliance.ilmp', 'pending',
           '$.compliance.finance', 'pending',
           '$.reopenRecovery',
           JSON_OBJECT(
             'reason', 'change_in_circumstances_additional_funding_amendment',
             'reopenedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
             'performedBy', 'codex-prod-data-repair',
             'request', 'Reopen for Emilie to propose additional funding amendment for Joanna Nevers.'
           )
         ),
         esdc_intervention_json = JSON_REMOVE(
           COALESCE(esdc_intervention_json, JSON_OBJECT()),
           '$.interventionOutcome'
         ),
         updated_at = NOW()
   WHERE id = 7
     AND case_id = 76
     AND action_plan_id = 3;

  UPDATE esdc_participant_submission
     SET readiness_status = 'needs_review',
         readiness_summary = NULL,
         warnings = NULL,
         blocking_issues = NULL,
         last_validated_at = NULL,
         submission_status = 'pending',
         submitted_at = NULL,
         submitted_by_user_id = NULL,
         payload_snapshot = NULL,
         payload_storage_key = NULL,
         payload_checksum = NULL,
         rejection_reason = NULL,
         updated_at = NOW()
   WHERE id = 52
     AND case_id = 76
     AND action_plan_id = 3;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, actor_staff_profile_id, actor_user_id, source_system)
  VALUES
    (
      76,
      'data_repair',
      'Reopened action plan and intervention for additional funding amendment.',
      JSON_OBJECT(
        'caseNumber', 'CASE-2026-0000076',
        'actionPlanId', 3,
        'interventionId', 7,
        'participant', 'Joanna Nevers',
        'reason', 'Change in circumstances: additional funding needed after closeout.',
        'changes', JSON_ARRAY(
          'case active',
          'action plan active with closeout result cleared',
          'intervention in_progress with completion outcome cleared',
          'ILMP submission reset to needs_review'
        )
      ),
      NULL,
      NULL,
      'codex'
    );

  INSERT INTO iset_case_note
    (case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned)
  VALUES
    (
      76,
      NULL,
      NULL,
      'Data repair: reopened action plan 3 and intervention 7 for Joanna Nevers after a change in circumstances required an additional funding amendment. The prior closeout was not treated as staff error; closeout/result fields were cleared so Emilie can propose a revision through the intervention amendment workflow. ILMP readiness was reset to needs_review.',
      1,
      0
    );

  COMMIT;
END//

DELIMITER ;

CALL repair_case_2026_0000076_reopen_amendment();

DROP PROCEDURE IF EXISTS repair_case_2026_0000076_reopen_amendment;
