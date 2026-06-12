DROP PROCEDURE IF EXISTS repair_case_2026_0000044_reopen_new_intervention;

DELIMITER //

CREATE PROCEDURE repair_case_2026_0000044_reopen_new_intervention()
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
   WHERE id = 44
     AND case_number = 'CASE-2026-0000044'
     AND status = 'dormant'
     AND lifecycle_status = 'dormant'
     AND closed_at IS NULL
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_plan_count
    FROM iset_case_action_plan
   WHERE id = 15
     AND case_id = 44
     AND status = 'closed'
     AND archived_at IS NULL
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_intervention_count
    FROM iset_case_intervention
   WHERE id = 24
     AND case_id = 44
     AND action_plan_id = 15
     AND status = 'completed'
     AND delivery_status = 'completed'
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_submission_count
    FROM esdc_participant_submission
   WHERE id = 59
     AND case_id = 44
     AND action_plan_id = 15
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_blocking_proposals
    FROM iset_case_intervention
   WHERE case_id = 44
     AND status IN ('draft', 'submitted', 'in_review', 'changes_requested')
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_other_active_plans
    FROM iset_case_action_plan
   WHERE case_id = 44
     AND id <> 15
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
         open_intervention_count = 0,
         total_intervention_count = 1,
         updated_at = NOW()
   WHERE id = 44
     AND case_number = 'CASE-2026-0000044';

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
             'reason', 'change_in_circumstances_new_intervention_needed',
             'reopenedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
             'performedBy', 'codex-prod-data-repair',
             'request', 'Reopen for Amanda to propose a new intervention for Kaitlyn Kitson.'
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
   WHERE id = 15
     AND case_id = 44;

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
   WHERE id = 59
     AND case_id = 44
     AND action_plan_id = 15;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, actor_staff_profile_id, actor_user_id, source_system)
  VALUES
    (
      44,
      'data_repair',
      'Reopened action plan for new intervention proposal.',
      JSON_OBJECT(
        'caseNumber', 'CASE-2026-0000044',
        'actionPlanId', 15,
        'existingCompletedInterventionId', 24,
        'participant', 'Kaitlyn Kitson',
        'reason', 'Change in circumstances: new intervention proposal needed after closeout.',
        'changes', JSON_ARRAY(
          'case active',
          'action plan active with closeout result cleared',
          'existing completed intervention left unchanged',
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
      44,
      NULL,
      NULL,
      'Data repair: reopened action plan 15 for Kaitlyn Kitson after a change in circumstances required Amanda to propose a new intervention. Existing completed intervention 24 was left completed; only the action-plan closeout/result fields were cleared. ILMP readiness was reset to needs_review.',
      1,
      0
    );

  COMMIT;
END//

DELIMITER ;

CALL repair_case_2026_0000044_reopen_new_intervention();

DROP PROCEDURE IF EXISTS repair_case_2026_0000044_reopen_new_intervention;
