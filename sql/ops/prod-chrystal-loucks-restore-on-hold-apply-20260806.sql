-- Guarded PROD restoration of Chrystal Loucks' June 24 application (117)
-- from Withdrawn to its previous On Hold state.
--
-- The August 5 withdrawal created reporting-only plan 173, interventions
-- 369/370, ESDC submission 443/history 2374, and the case-context reporting
-- marker. These generated artifacts are removed. Danielle's notes, the
-- original status-change event, active hold reminder 165, application 140,
-- manual plan 95, and intervention 205 are preserved.
--
-- Recovery snapshot: path-prod-chrystal-loucks-restore-20260806-1439

DROP PROCEDURE IF EXISTS prod_chrystal_loucks_restore_apply_20260806;

DELIMITER //

CREATE PROCEDURE prod_chrystal_loucks_restore_apply_20260806()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF BINARY DATABASE() <> BINARY 'iset_intake' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id IN (117, 140)
     AND owner_user_id = 'prod-chrystal-loucks-restore-20260806'
     AND expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_lock_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 117
     AND submission_id = 117
     AND client_id = 69
     AND case_id = 69
     AND status = 'withdrawn'
     AND lifecycle_status = 'closed'
     AND decision_outcome IS NULL
     AND awaiting_reason = 'none'
     AND closure_reason = 'withdrawn'
     AND row_version = 5
     AND updated_at = '2026-08-05 22:15:22'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_application_117_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 140
     AND submission_id = 140
     AND client_id = 69
     AND case_id = 69
     AND status = 'in_review'
     AND lifecycle_status = 'in_review'
     AND decision_outcome IS NULL
     AND awaiting_reason = 'none'
     AND closure_reason IS NULL
     AND row_version = 2
     AND updated_at = '2026-07-09 15:26:20'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_application_140_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = 69
     AND client_id = 69
     AND assigned_staff_profile_id = 5697
     AND status = 'active'
     AND lifecycle_status = 'active'
     AND closure_reason IS NULL
     AND open_intervention_count = 0
     AND total_intervention_count = 0
     AND updated_at = '2026-08-05 22:15:22'
     AND JSON_TYPE(JSON_EXTRACT(
           case_context_json,
           '$.applicationReportingArtifacts'
         )) = 'OBJECT'
     AND JSON_LENGTH(JSON_EXTRACT(
           case_context_json,
           '$.applicationReportingArtifacts'
         )) = 1
     AND JSON_UNQUOTE(JSON_EXTRACT(
           case_context_json,
           '$.applicationReportingArtifacts."117".reportingTrigger'
         )) = 'withdrawal'
     AND JSON_EXTRACT(
           case_context_json,
           '$.applicationReportingArtifacts."140"'
         ) IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_case_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE id = 173
     AND case_id = 69
     AND application_id = 117
     AND name = 'Actions leading to withdrawal'
     AND status = 'closed'
     AND funding_stream = 'CRF'
     AND effective_date = '2026-08-05'
     AND closed_at = '2026-08-05 00:00:00'
     AND result_code = '1'
     AND EIClaimant = 3
     AND result_date = '2026-08-05'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'withdrawn_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.applicationId')) = '117'
     AND created_at = '2026-08-05 22:15:22'
     AND updated_at = '2026-08-05 22:15:22'
     AND archived_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_plan_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE id IN (369, 370)
     AND case_id = 69
     AND action_plan_id = 173
     AND intervention_code IN (1, 3)
     AND status = 'completed'
     AND delivery_status = 'completed'
     AND start_date = '2026-08-05'
     AND end_date = '2026-08-05'
     AND outcome_code = 1
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'withdrawn_reporting'
     AND created_at = '2026-08-05 22:15:22'
     AND updated_at = '2026-08-05 22:15:22'
     AND closed_at = '2026-08-05 00:00:00'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_intervention_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE id = 443
     AND case_id = 69
     AND action_plan_id = 173
     AND application_id = 117
     AND readiness_status = 'ready'
     AND submission_status = 'pending'
     AND submitted_at IS NULL
     AND created_at = '2026-08-05 22:15:22'
     AND updated_at = '2026-08-05 22:15:22'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_esdc_submission_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission_history
   WHERE id = 2374
     AND participant_submission_id = 443
     AND event_type = 'validated'
     AND actor_user_id IS NULL
     AND occurred_at = '2026-08-05 22:15:22'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_esdc_history_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_reminder
   WHERE id = 165
     AND case_id = 69
     AND application_id = 117
     AND action_plan_id IS NULL
     AND intervention_id IS NULL
     AND title = 'Review parked application'
     AND category = 'Application hold review'
     AND status = 'open'
     AND due_at = '2026-08-07 09:00:00'
     AND assigned_staff_profile_id = 5697
     AND deleted_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_apply_hold_reminder_guard_failed';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_item
   WHERE action_plan_id = 173
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_action_item_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document
   WHERE action_plan_id = 173
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_document_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE action_plan_id = 173
      OR legacy_intervention_id IN (369, 370)
      OR source_intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_proposal_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_review_workflow
   WHERE action_plan_id = 173
      OR intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_workflow_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_reminder
   WHERE action_plan_id = 173
      OR intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_reminder_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM finance_transaction
   WHERE case_intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_finance_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document_intervention
   WHERE intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_document_intervention_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM payment_packet
   WHERE intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_payment_packet_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM payment_packet_line
   WHERE intervention_id IN (369, 370)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_payment_line_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_event
   WHERE case_id = 69
     AND event_type = 'data_repair'
     AND source_system = 'codex-prod-data-repair'
     AND summary = 'Restored application 117 to On Hold at the assigned coordinator request.'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_audit_event_exists';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_event_entry
   WHERE id = '41f40e75-5eec-4821-a082-8ca03b0f0e33'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_timeline_event_exists';
  END IF;

  DELETE FROM esdc_participant_submission
   WHERE id = 443
     AND action_plan_id = 173
     AND application_id = 117
     AND submission_status = 'pending'
     AND submitted_at IS NULL;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_esdc_delete_failed';
  END IF;

  DELETE FROM iset_case_intervention
   WHERE id IN (369, 370)
     AND case_id = 69
     AND action_plan_id = 173
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'withdrawn_reporting';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_intervention_delete_failed';
  END IF;

  DELETE FROM iset_case_action_plan
   WHERE id = 173
     AND case_id = 69
     AND application_id = 117
     AND name = 'Actions leading to withdrawal'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'withdrawn_reporting';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_plan_delete_failed';
  END IF;

  UPDATE iset_application
     SET status = 'on_hold',
         lifecycle_status = 'awaiting_applicant',
         decision_outcome = NULL,
         awaiting_reason = 'external_funding',
         closure_reason = NULL,
         row_version = row_version + 1,
         updated_at = NOW()
   WHERE id = 117
     AND case_id = 69
     AND status = 'withdrawn'
     AND lifecycle_status = 'closed'
     AND closure_reason = 'withdrawn'
     AND row_version = 5;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_application_restore_failed';
  END IF;

  UPDATE iset_case
     SET case_context_json = JSON_REMOVE(
           case_context_json,
           '$.applicationReportingArtifacts'
         ),
         updated_at = NOW()
   WHERE id = 69
     AND client_id = 69
     AND status = 'active'
     AND lifecycle_status = 'active';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_case_context_restore_failed';
  END IF;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, occurred_at,
     actor_staff_profile_id, actor_user_id, source_system)
  VALUES
    (
      69,
      'data_repair',
      'Restored application 117 to On Hold at the assigned coordinator request.',
      '{"repairId":"prod-chrystal-loucks-restore-20260806","applicationId":117,"unchangedApplicationId":140,"fromStatus":"withdrawn","toStatus":"on_hold","removedActionPlanId":173,"removedInterventionIds":[369,370],"removedEsdcSubmissionId":443,"preservedReminderId":165}',
      NOW(3),
      NULL,
      NULL,
      'codex-prod-data-repair'
    );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_audit_insert_failed';
  END IF;

  INSERT INTO iset_event_entry
    (id, category, event_type, severity, source, subject_type, subject_id,
     actor_type, actor_id, actor_staff_profile_id, actor_applicant_user_id,
     actor_display_name, payload_json, tracking_id, correlation_id,
     captured_by, notification_delivery_mode, captured_at, ingested_at)
  VALUES
    (
      '41f40e75-5eec-4821-a082-8ca03b0f0e33',
      'case_lifecycle',
      'status_changed',
      'info',
      'admin',
      'case',
      '69',
      'system',
      NULL,
      NULL,
      NULL,
      'PATH support',
      '{"to":"on_hold","from":"withdrawn","tracking_id":"ISET-20260624-205CDA","reason":"Restored at the assigned coordinator request so staff can complete the normal closing workflow.","repair_id":"prod-chrystal-loucks-restore-20260806"}',
      'ISET-20260624-205CDA',
      NULL,
      'codex-prod-data-repair',
      'suppressed',
      NOW(3),
      NOW(3)
    );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'chrystal_loucks_apply_timeline_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_chrystal_loucks_restore_apply_20260806();
DROP PROCEDURE prod_chrystal_loucks_restore_apply_20260806;

SELECT 'apply_complete' AS result;
