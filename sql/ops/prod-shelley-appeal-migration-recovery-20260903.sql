-- Guarded recovery for the Jennifer Johnson and Veronica Basque interim
-- appeal-opening migration. This is permitted only before any staff member
-- takes another workflow action. It restores the former current state while
-- retaining the appeal-open audit events and notes and appending recovery
-- evidence; it never deletes the audit trail.

DROP PROCEDURE IF EXISTS prod_shelley_appeal_recovery_20260903;

DELIMITER //

CREATE PROCEDURE prod_shelley_appeal_recovery_20260903()
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
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_lock.application_id IN (199, 208)
     AND application_lock.expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_active_lock_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE iset_application.id IN (199, 208)
     AND (
       (iset_application.id = 199 AND iset_application.submission_id = 199 AND iset_application.client_id = 375 AND iset_application.case_id = 258 AND iset_application.row_version = 27)
       OR
       (iset_application.id = 208 AND iset_application.submission_id = 208 AND iset_application.client_id = 386 AND iset_application.case_id = 269 AND iset_application.row_version = 23)
     )
     AND iset_application.status = 'pending_approval'
     AND iset_application.lifecycle_status = 'pending_decision'
     AND iset_application.decision_outcome IS NULL
     AND iset_application.awaiting_reason = 'none'
     AND iset_application.closure_reason IS NULL
     AND iset_application.has_open_escalation = 0
     AND iset_application.current_escalation_id IS NULL
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE iset_case.id IN (258, 269)
     AND (
       (iset_case.id = 258 AND iset_case.case_number = 'ISET-20260728-7A85A9' AND iset_case.client_id = 375 AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199".appealRunId')) = 'prod-shelley-appeal-open-20260903')
       OR
       (iset_case.id = 269 AND iset_case.case_number = 'ISET-20260729-C87202' AND iset_case.client_id = 386 AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208".appealRunId')) = 'prod-shelley-appeal-open-20260903')
     )
     AND iset_case.assigned_staff_profile_id = 54
     AND iset_case.status = 'intake'
     AND iset_case.lifecycle_status = 'intake'
     AND iset_case.closure_reason IS NULL
     AND iset_case.closed_at = '2026-08-27 00:00:00'
     AND (
       (iset_case.id = 258
        AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."199".runId')) = 'prod-shelley-appeal-open-20260903'
        AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."199".status')) = 'pending'
        AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".assessment_nwac_review_status') IS NULL
        AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".decisionLetterSent') IS NULL)
       OR
       (iset_case.id = 269
        AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."208".runId')) = 'prod-shelley-appeal-open-20260903'
        AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."208".status')) = 'pending'
        AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".assessment_nwac_review_status') IS NULL
        AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".decisionLetterSent') IS NULL)
     )
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_case_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE iset_review_workflow.id IN (66, 90)
     AND (
       (iset_review_workflow.id = 66 AND iset_review_workflow.subject_key = 'application_assessment:application:199' AND iset_review_workflow.case_id = 258 AND iset_review_workflow.application_id = 199)
       OR
       (iset_review_workflow.id = 90 AND iset_review_workflow.subject_key = 'application_assessment:application:208' AND iset_review_workflow.case_id = 269 AND iset_review_workflow.application_id = 208)
     )
     AND iset_review_workflow.workflow_type = 'application_assessment'
     AND iset_review_workflow.current_stage = 'nwac_review'
     AND iset_review_workflow.current_owner_role = 'NWAC Administrator'
     AND iset_review_workflow.current_owner_staff_profile_id IS NULL
     AND iset_review_workflow.nwac_decided_by_staff_profile_id IS NULL
     AND iset_review_workflow.nwac_decided_at IS NULL
     AND iset_review_workflow.nwac_decision IS NULL
     AND iset_review_workflow.nwac_decision_note IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_review_workflow.metadata_json, '$.appealRunId')) = 'prod-shelley-appeal-open-20260903'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_review_workflow.metadata_json, '$.appealPending')) = 'true'
     AND iset_review_workflow.archived_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_workflow_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id = 66
   FOR UPDATE;
  IF v_guard_count <> 8 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_jennifer_history_changed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id = 90
   FOR UPDATE;
  IF v_guard_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_veronica_history_changed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id IN (66, 90)
     AND iset_review_workflow_event.action = 'interim_appeal_opened'
     AND iset_review_workflow_event.from_stage = 'final_decision_recorded'
     AND iset_review_workflow_event.to_stage = 'nwac_review'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_review_workflow_event.payload_json, '$.runId')) = 'prod-shelley-appeal-open-20260903'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_open_event_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE iset_case_action_plan.id IN (206, 211)
     AND (
       (iset_case_action_plan.id = 206 AND iset_case_action_plan.case_id = 258 AND iset_case_action_plan.application_id = 199)
       OR
       (iset_case_action_plan.id = 211 AND iset_case_action_plan.case_id = 269 AND iset_case_action_plan.application_id = 208)
     )
     AND iset_case_action_plan.status = 'archived'
     AND iset_case_action_plan.archived_at IS NOT NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.appeal.runId')) = 'prod-shelley-appeal-open-20260903'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.appeal.status')) = 'pending'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_reporting_plan_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE iset_case_action_plan.application_id IN (199, 208)
     AND iset_case_action_plan.id NOT IN (206, 211)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_new_plan_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE esdc_participant_submission.id IN (508, 513)
     AND esdc_participant_submission.submission_status = 'pending'
     AND esdc_participant_submission.submitted_at IS NULL
     AND esdc_participant_submission.submitted_by_user_id IS NULL
     AND esdc_participant_submission.payload_snapshot IS NULL
     AND esdc_participant_submission.payload_storage_key IS NULL
     AND esdc_participant_submission.payload_checksum IS NULL
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_esdc_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_note
   WHERE iset_case_note.case_id IN (258, 269)
     AND iset_case_note.body LIKE 'APPEAL_RECOVERY_20260903:%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_note_already_exists';
  END IF;

  UPDATE iset_application
     SET status = 'completed',
         lifecycle_status = 'closed',
         decision_outcome = 'denied',
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = row_version + 1
   WHERE iset_application.id IN (199, 208)
     AND iset_application.status = 'pending_approval'
     AND iset_application.lifecycle_status = 'pending_decision'
     AND iset_application.decision_outcome IS NULL;
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_application_update_failed';
  END IF;

  UPDATE iset_case
     SET status = 'closed',
         lifecycle_status = 'closed',
         closure_reason = 'application_denied',
         case_context_json = JSON_REMOVE(
           JSON_SET(
             iset_case.case_context_json,
             '$.reportingOnlyDenied', JSON_EXTRACT('true', '$'),
             '$.reportingCorrectionAllowed', JSON_EXTRACT('true', '$'),
             '$.excludeFromCaseworkQueues', JSON_EXTRACT('true', '$'),
             '$.reportingTrigger', 'denial',
             '$.reportingSeedSource', 'denied_reporting',
             '$.reportingSeededAt', '2026-08-27T13:25:28.639Z',
             '$.reportingLastSyncedAt', '2026-08-27T13:25:28.639Z',
             '$.reportingDeniedAt', '2026-08-27',
             '$.applicationId', 199,
             '$.applicationReportingArtifacts."199"',
             JSON_REMOVE(
               JSON_MERGE_PATCH(
                 JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199"'),
                 JSON_OBJECT(
                   'reportingOnly', JSON_EXTRACT('true', '$'),
                   'caseLevelReportingOnly', JSON_EXTRACT('true', '$'),
                   'reportingCorrectionAllowed', JSON_EXTRACT('true', '$')
                 )
               ),
               '$.appealPending',
               '$.appealRunId',
               '$.appealOriginalDecision'
             ),
             '$.applicationDecisionLetters."199"',
             JSON_EXTRACT(
               iset_case.case_context_json,
               '$.applicationAppealHistory."199".originalDecisionContext'
             )
           ),
           '$.applicationAppealHistory."199"'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case.id = 258
     AND iset_case.status = 'intake'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199".appealRunId')) = 'prod-shelley-appeal-open-20260903';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_jennifer_case_update_failed';
  END IF;

  UPDATE iset_case
     SET status = 'closed',
         lifecycle_status = 'closed',
         closure_reason = 'application_denied',
         case_context_json = JSON_REMOVE(
           JSON_SET(
             iset_case.case_context_json,
             '$.reportingOnlyDenied', JSON_EXTRACT('true', '$'),
             '$.reportingCorrectionAllowed', JSON_EXTRACT('true', '$'),
             '$.excludeFromCaseworkQueues', JSON_EXTRACT('true', '$'),
             '$.reportingTrigger', 'denial',
             '$.reportingSeedSource', 'denied_reporting',
             '$.reportingSeededAt', '2026-08-27T15:20:38.570Z',
             '$.reportingLastSyncedAt', '2026-08-27T15:20:38.570Z',
             '$.reportingDeniedAt', '2026-08-27',
             '$.applicationId', 208,
             '$.applicationReportingArtifacts."208"',
             JSON_REMOVE(
               JSON_MERGE_PATCH(
                 JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208"'),
                 JSON_OBJECT(
                   'reportingOnly', JSON_EXTRACT('true', '$'),
                   'caseLevelReportingOnly', JSON_EXTRACT('true', '$'),
                   'reportingCorrectionAllowed', JSON_EXTRACT('true', '$')
                 )
               ),
               '$.appealPending',
               '$.appealRunId',
               '$.appealOriginalDecision'
             ),
             '$.applicationDecisionLetters."208"',
             JSON_EXTRACT(
               iset_case.case_context_json,
               '$.applicationAppealHistory."208".originalDecisionContext'
             )
           ),
           '$.applicationAppealHistory."208"'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case.id = 269
     AND iset_case.status = 'intake'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208".appealRunId')) = 'prod-shelley-appeal-open-20260903';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_veronica_case_update_failed';
  END IF;

  UPDATE iset_case_action_plan
     SET status = 'closed',
         archived_at = NULL,
         metadata_json = JSON_REMOVE(iset_case_action_plan.metadata_json, '$.appeal'),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case_action_plan.id IN (206, 211)
     AND iset_case_action_plan.status = 'archived'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.appeal.runId')) = 'prod-shelley-appeal-open-20260903';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_reporting_plan_update_failed';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'final_decision_recorded',
         current_owner_role = NULL,
         current_owner_staff_profile_id = NULL,
         nwac_decided_by_staff_profile_id = 51,
         nwac_decided_at = '2026-08-27 13:25:28',
         nwac_decision = 'denied',
         nwac_decision_note = 'The client does not currently meet the minimum program eligibility as she is currently employed. The letter from her current employer is states that her title will stay the same, but the training will enhance her skills.',
         metadata_json = JSON_OBJECT(
           'source', 'application_assessment_nwac_decision',
           'assessmentReviewStatus', 'reject'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_review_workflow.id = 66
     AND iset_review_workflow.current_stage = 'nwac_review'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_review_workflow.metadata_json, '$.appealRunId')) = 'prod-shelley-appeal-open-20260903';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_jennifer_workflow_update_failed';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'final_decision_recorded',
         current_owner_role = NULL,
         current_owner_staff_profile_id = NULL,
         nwac_decided_by_staff_profile_id = 51,
         nwac_decided_at = '2026-08-27 15:20:38',
         nwac_decision = 'denied',
         nwac_decision_note = 'I need to understand how this course and the employment outcome will lead to her financial independence if the starting wage is $17.91/hr = $716/week --annually $37,000.',
         metadata_json = JSON_OBJECT(
           'source', 'application_assessment_nwac_decision',
           'assessmentReviewStatus', 'reject'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_review_workflow.id = 90
     AND iset_review_workflow.current_stage = 'nwac_review'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_review_workflow.metadata_json, '$.appealRunId')) = 'prod-shelley-appeal-open-20260903';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_veronica_workflow_update_failed';
  END IF;

  INSERT INTO iset_review_workflow_event (
    review_workflow_id,
    workflow_type,
    subject_key,
    action,
    from_stage,
    to_stage,
    actor_staff_profile_id,
    actor_role,
    note,
    payload_json
  ) VALUES
  (
    66,
    'application_assessment',
    'application_assessment:application:199',
    'interim_appeal_open_recovered',
    'nwac_review',
    'final_decision_recorded',
    NULL,
    'System Administrator',
    'The appeal-opening migration was recovered before any staff decision action. The appeal-open event and case note remain in history.',
    JSON_OBJECT('runId', 'prod-shelley-appeal-recovery-20260903', 'appealOpenRunId', 'prod-shelley-appeal-open-20260903', 'applicationId', 199)
  ),
  (
    90,
    'application_assessment',
    'application_assessment:application:208',
    'interim_appeal_open_recovered',
    'nwac_review',
    'final_decision_recorded',
    NULL,
    'System Administrator',
    'The appeal-opening migration was recovered before any staff decision action. The appeal-open event and case note remain in history.',
    JSON_OBJECT('runId', 'prod-shelley-appeal-recovery-20260903', 'appealOpenRunId', 'prod-shelley-appeal-open-20260903', 'applicationId', 208)
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_workflow_event_insert_failed';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  ) VALUES
  (
    258,
    'appeal_opening_recovered',
    'Appeal-opening migration recovered before staff action',
    JSON_OBJECT('runId', 'prod-shelley-appeal-recovery-20260903', 'appealOpenRunId', 'prod-shelley-appeal-open-20260903', 'applicationId', 199, 'reviewWorkflowId', 66),
    CURRENT_TIMESTAMP(3),
    NULL,
    NULL,
    'system_admin_recovery'
  ),
  (
    269,
    'appeal_opening_recovered',
    'Appeal-opening migration recovered before staff action',
    JSON_OBJECT('runId', 'prod-shelley-appeal-recovery-20260903', 'appealOpenRunId', 'prod-shelley-appeal-open-20260903', 'applicationId', 208, 'reviewWorkflowId', 90),
    CURRENT_TIMESTAMP(3),
    NULL,
    NULL,
    'system_admin_recovery'
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_case_event_insert_failed';
  END IF;

  INSERT INTO iset_case_note (
    case_id,
    author_staff_profile_id,
    author_user_id,
    body,
    is_internal,
    is_pinned,
    follow_up_at,
    reminder_id
  ) VALUES
  (258, NULL, NULL, 'APPEAL_RECOVERY_20260903: The appeal-opening migration for application 199 was recovered before any staff decision action. The appeal-open note and audit event remain in history.', 1, 0, NULL, NULL),
  (269, NULL, NULL, 'APPEAL_RECOVERY_20260903: The appeal-opening migration for application 208 was recovered before any staff decision action. The appeal-open note and audit event remain in history.', 1, 0, NULL, NULL);
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_recovery_case_note_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_shelley_appeal_recovery_20260903();
DROP PROCEDURE prod_shelley_appeal_recovery_20260903;
