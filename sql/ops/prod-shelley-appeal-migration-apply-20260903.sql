-- Guarded PROD apply for the agreed interim appeal process.
-- Jennifer Johnson: case 258, application 199, assessment 1622, workflow 66.
-- Veronica Basque: case 269, application 208, assessment 1770, workflow 90.
--
-- This opens a new decision pass without changing the assessment or deleting
-- the original denial evidence. The denial-only reporting plans are archived
-- while the appeals are pending so a contested outcome cannot enter an ESDC
-- batch. A renewed denial will cause the normal decision path to reuse and
-- unarchive the exact reporting plan; an approval leaves it as history.

DROP PROCEDURE IF EXISTS prod_shelley_appeal_open_20260903;

DELIMITER //

CREATE PROCEDURE prod_shelley_appeal_open_20260903()
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
      SET MESSAGE_TEXT = 'shelley_appeal_open_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM staff_profiles
   WHERE staff_profiles.id = 50
     AND staff_profiles.email = 'sstacey@nwac.ca'
     AND staff_profiles.primary_role = 'NWAC Administrator'
     AND staff_profiles.status = 'active'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_requester_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_lock.application_id IN (199, 208)
     AND application_lock.expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_active_lock_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE iset_application.id = 199
     AND iset_application.submission_id = 199
     AND iset_application.client_id = 375
     AND iset_application.case_id = 258
     AND iset_application.status = 'completed'
     AND iset_application.lifecycle_status = 'closed'
     AND iset_application.decision_outcome = 'denied'
     AND iset_application.awaiting_reason = 'none'
     AND iset_application.closure_reason IS NULL
     AND iset_application.row_version = 26
     AND iset_application.has_open_escalation = 0
     AND iset_application.current_escalation_id IS NULL
     AND iset_application.docs_requested_active = 0
     AND iset_application.updated_at = '2026-09-01 13:37:20'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE iset_application.id = 208
     AND iset_application.submission_id = 208
     AND iset_application.client_id = 386
     AND iset_application.case_id = 269
     AND iset_application.status = 'completed'
     AND iset_application.lifecycle_status = 'closed'
     AND iset_application.decision_outcome = 'denied'
     AND iset_application.awaiting_reason = 'none'
     AND iset_application.closure_reason IS NULL
     AND iset_application.row_version = 22
     AND iset_application.has_open_escalation = 0
     AND iset_application.current_escalation_id IS NULL
     AND iset_application.docs_requested_active = 0
     AND iset_application.updated_at = '2026-09-01 12:55:14'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE iset_case.id = 258
     AND iset_case.case_number = 'ISET-20260728-7A85A9'
     AND iset_case.client_id = 375
     AND iset_case.assigned_staff_profile_id = 54
     AND iset_case.status = 'closed'
     AND iset_case.lifecycle_status = 'closed'
     AND iset_case.closure_reason = 'application_denied'
     AND iset_case.closed_at = '2026-08-27 00:00:00'
     AND iset_case.updated_at = '2026-09-01 13:37:20'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingCorrectionAllowed')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger')) = 'denial'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationId')) = '199'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199".reportingCorrectionAllowed')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".assessment_nwac_review_status')) = 'reject'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".decisionLetterSent.denial')) = '2026-08-27T13:30:19.583Z'
     AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".decisionLetterDrafts.denial') IS NOT NULL
     AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."199"') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_case_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE iset_case.id = 269
     AND iset_case.case_number = 'ISET-20260729-C87202'
     AND iset_case.client_id = 386
     AND iset_case.assigned_staff_profile_id = 54
     AND iset_case.status = 'closed'
     AND iset_case.lifecycle_status = 'closed'
     AND iset_case.closure_reason = 'application_denied'
     AND iset_case.closed_at = '2026-08-27 00:00:00'
     AND iset_case.updated_at = '2026-09-01 12:55:14'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingCorrectionAllowed')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger')) = 'denial'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationId')) = '208'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208".reportingCorrectionAllowed')) = 'true'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".assessment_nwac_review_status')) = 'reject'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".decisionLetterSent.denial')) = '2026-09-01T12:55:14.425Z'
     AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".decisionLetterDrafts.denial') IS NOT NULL
     AND JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."208"') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_case_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application_assessment
   WHERE iset_application_assessment.id = 1622
     AND iset_application_assessment.application_id = 199
     AND iset_application_assessment.case_id = 258
     AND iset_application_assessment.intervention_cost_total = 18950
     AND iset_application_assessment.recommendation = 'recommend'
     AND iset_application_assessment.nwac_review = 'disagree'
     AND iset_application_assessment.updated_at = '2026-08-27 13:25:28'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_assessment_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application_assessment
   WHERE iset_application_assessment.id = 1770
     AND iset_application_assessment.application_id = 208
     AND iset_application_assessment.case_id = 269
     AND iset_application_assessment.intervention_cost_total = 19125
     AND iset_application_assessment.recommendation = 'recommend'
     AND iset_application_assessment.nwac_review = 'disagree'
     AND iset_application_assessment.updated_at = '2026-08-27 15:20:38'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_assessment_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE iset_review_workflow.id = 66
     AND iset_review_workflow.workflow_type = 'application_assessment'
     AND iset_review_workflow.subject_key = 'application_assessment:application:199'
     AND iset_review_workflow.case_id = 258
     AND iset_review_workflow.application_id = 199
     AND iset_review_workflow.action_plan_id IS NULL
     AND iset_review_workflow.intervention_id IS NULL
     AND iset_review_workflow.proposal_id IS NULL
     AND iset_review_workflow.current_stage = 'final_decision_recorded'
     AND iset_review_workflow.current_owner_role IS NULL
     AND iset_review_workflow.current_owner_staff_profile_id IS NULL
     AND iset_review_workflow.submitted_by_staff_profile_id = 54
     AND iset_review_workflow.submitted_at = '2026-08-24 19:03:48'
     AND iset_review_workflow.rm_reviewed_by_staff_profile_id = 54
     AND iset_review_workflow.rm_reviewed_at = '2026-08-24 19:04:24'
     AND iset_review_workflow.nwac_decided_by_staff_profile_id = 51
     AND iset_review_workflow.nwac_decided_at = '2026-08-27 13:25:28'
     AND iset_review_workflow.nwac_decision = 'denied'
     AND iset_review_workflow.archived_at IS NULL
     AND iset_review_workflow.updated_at = '2026-08-27 13:25:28'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_workflow_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE iset_review_workflow.id = 90
     AND iset_review_workflow.workflow_type = 'application_assessment'
     AND iset_review_workflow.subject_key = 'application_assessment:application:208'
     AND iset_review_workflow.case_id = 269
     AND iset_review_workflow.application_id = 208
     AND iset_review_workflow.action_plan_id IS NULL
     AND iset_review_workflow.intervention_id IS NULL
     AND iset_review_workflow.proposal_id IS NULL
     AND iset_review_workflow.current_stage = 'final_decision_recorded'
     AND iset_review_workflow.current_owner_role IS NULL
     AND iset_review_workflow.current_owner_staff_profile_id IS NULL
     AND iset_review_workflow.submitted_by_staff_profile_id = 54
     AND iset_review_workflow.submitted_at = '2026-08-25 17:34:03'
     AND iset_review_workflow.rm_reviewed_by_staff_profile_id = 54
     AND iset_review_workflow.rm_reviewed_at = '2026-08-25 17:37:42'
     AND iset_review_workflow.nwac_decided_by_staff_profile_id = 51
     AND iset_review_workflow.nwac_decided_at = '2026-08-27 15:20:38'
     AND iset_review_workflow.nwac_decision = 'denied'
     AND iset_review_workflow.archived_at IS NULL
     AND iset_review_workflow.updated_at = '2026-08-27 15:20:38'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_workflow_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id = 66
   FOR UPDATE;
  IF v_guard_count <> 7 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_history_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.id = 509
     AND iset_review_workflow_event.review_workflow_id = 66
     AND iset_review_workflow_event.action = 'nwac_deny'
     AND iset_review_workflow_event.from_stage = 'nwac_review'
     AND iset_review_workflow_event.to_stage = 'final_decision_recorded'
     AND iset_review_workflow_event.actor_staff_profile_id = 51
     AND iset_review_workflow_event.created_at = '2026-08-27 13:25:28'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_final_event_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id = 90
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_history_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.id = 529
     AND iset_review_workflow_event.review_workflow_id = 90
     AND iset_review_workflow_event.action = 'nwac_deny'
     AND iset_review_workflow_event.from_stage = 'nwac_review'
     AND iset_review_workflow_event.to_stage = 'final_decision_recorded'
     AND iset_review_workflow_event.actor_staff_profile_id = 51
     AND iset_review_workflow_event.created_at = '2026-08-27 15:20:38'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_final_event_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE iset_review_workflow_event.review_workflow_id IN (66, 90)
     AND iset_review_workflow_event.action = 'interim_appeal_opened'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_event_already_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_note
   WHERE iset_case_note.case_id IN (258, 269)
     AND iset_case_note.body LIKE 'APPEAL_OPENED_20260903:%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_note_already_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_event
   WHERE iset_case_event.case_id IN (258, 269)
     AND iset_case_event.event_type = 'appeal_opened_for_decision'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_event.payload_json, '$.runId')) = 'prod-shelley-appeal-open-20260903'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_case_event_already_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document
   WHERE iset_document.id IN (12864, 12865, 13614, 13625, 13854)
     AND iset_document.client_id = 375
     AND iset_document.application_id = 199
     AND iset_document.case_id = 258
     AND iset_document.status = 'active'
   FOR UPDATE;
  IF v_guard_count <> 5 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_document_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document
   WHERE iset_document.id IN (12943, 13620)
     AND iset_document.client_id = 386
     AND iset_document.application_id = 208
     AND iset_document.case_id = 269
     AND iset_document.status = 'active'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_document_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE iset_case_action_plan.id IN (206, 211)
     AND (
       (iset_case_action_plan.id = 206 AND iset_case_action_plan.case_id = 258 AND iset_case_action_plan.application_id = 199 AND iset_case_action_plan.updated_at = '2026-08-27 13:25:28')
       OR
       (iset_case_action_plan.id = 211 AND iset_case_action_plan.case_id = 269 AND iset_case_action_plan.application_id = 208 AND iset_case_action_plan.updated_at = '2026-08-27 15:20:38')
     )
     AND iset_case_action_plan.status = 'closed'
     AND iset_case_action_plan.archived_at IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.reportingOnly')) = 'true'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_reporting_plan_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE iset_case_intervention.id IN (449, 450, 461, 462)
     AND (
       (iset_case_intervention.id IN (449, 450) AND iset_case_intervention.case_id = 258 AND iset_case_intervention.action_plan_id = 206 AND iset_case_intervention.updated_at = '2026-08-27 13:25:28')
       OR
       (iset_case_intervention.id IN (461, 462) AND iset_case_intervention.case_id = 269 AND iset_case_intervention.action_plan_id = 211 AND iset_case_intervention.updated_at = '2026-08-27 15:20:38')
     )
     AND iset_case_intervention.status = 'completed'
     AND iset_case_intervention.delivery_status = 'completed'
     AND iset_case_intervention.actual_amount IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_intervention.metadata_json, '$.source')) = 'denied_reporting'
   FOR UPDATE;
  IF v_guard_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_reporting_intervention_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE esdc_participant_submission.id IN (508, 513)
     AND (
       (esdc_participant_submission.id = 508 AND esdc_participant_submission.case_id = 258 AND esdc_participant_submission.action_plan_id = 206 AND esdc_participant_submission.application_id = 199 AND esdc_participant_submission.updated_at = '2026-08-27 13:25:28')
       OR
       (esdc_participant_submission.id = 513 AND esdc_participant_submission.case_id = 269 AND esdc_participant_submission.action_plan_id = 211 AND esdc_participant_submission.application_id = 208 AND esdc_participant_submission.updated_at = '2026-08-27 15:20:38')
     )
     AND esdc_participant_submission.submission_status = 'pending'
     AND esdc_participant_submission.submitted_at IS NULL
     AND esdc_participant_submission.submitted_by_user_id IS NULL
     AND esdc_participant_submission.payload_snapshot IS NULL
     AND esdc_participant_submission.payload_storage_key IS NULL
     AND esdc_participant_submission.payload_checksum IS NULL
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_esdc_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM funding_overview_version
   WHERE funding_overview_version.id = 44
     AND funding_overview_version.series_id = 25
     AND funding_overview_version.application_id = 199
     AND funding_overview_version.version_number = 1
     AND funding_overview_version.status = 'signed'
     AND funding_overview_version.signed_at = '2026-09-01 13:37:18'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_funding_overview_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM signing_request
   WHERE (signing_request.id = 220 AND signing_request.case_id = 258 AND signing_request.status = 'viewed' AND signing_request.checklist_doc_type = 'assessment_denial_letter')
      OR (signing_request.id = 274 AND signing_request.case_id = 258 AND signing_request.status = 'signed' AND signing_request.checklist_doc_type = 'financial_overview')
      OR (signing_request.id = 190 AND signing_request.case_id = 269 AND signing_request.status = 'cancelled' AND signing_request.checklist_doc_type = 'financial_overview')
      OR (signing_request.id = 191 AND signing_request.case_id = 269 AND signing_request.status = 'signed' AND signing_request.checklist_doc_type = 'financial_overview')
      OR (signing_request.id = 275 AND signing_request.case_id = 269 AND signing_request.status = 'viewed' AND signing_request.checklist_doc_type = 'assessment_denial_letter')
   FOR UPDATE;
  IF v_guard_count <> 5 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_signing_guard_failed';
  END IF;

  UPDATE iset_case_action_plan
     SET status = 'archived',
         archived_at = CURRENT_TIMESTAMP,
         metadata_json = JSON_SET(
           COALESCE(iset_case_action_plan.metadata_json, JSON_OBJECT()),
           '$.appeal',
           JSON_OBJECT(
             'status', 'pending',
             'runId', 'prod-shelley-appeal-open-20260903',
             'requestedByStaffProfileId', 50,
             'originalDecision', 'denied'
           )
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case_action_plan.id IN (206, 211)
     AND iset_case_action_plan.status = 'closed'
     AND iset_case_action_plan.archived_at IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_action_plan.metadata_json, '$.source')) = 'denied_reporting';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_reporting_plan_update_failed';
  END IF;

  UPDATE iset_application
     SET status = 'pending_approval',
         lifecycle_status = 'pending_decision',
         decision_outcome = NULL,
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = row_version + 1
   WHERE iset_application.id IN (199, 208)
     AND iset_application.status = 'completed'
     AND iset_application.lifecycle_status = 'closed'
     AND iset_application.decision_outcome = 'denied';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_application_update_failed';
  END IF;

  UPDATE iset_case
     SET status = 'intake',
         lifecycle_status = 'intake',
         closure_reason = NULL,
         case_context_json = JSON_SET(
           JSON_REMOVE(
             iset_case.case_context_json,
             '$.reportingOnlyDenied',
             '$.reportingOnlyDeniedIneligible',
             '$.reportingOnlyWithdrawal',
             '$.reportingCorrectionAllowed',
             '$.excludeFromCaseworkQueues',
             '$.reportingTrigger',
             '$.reportingSeedSource',
             '$.reportingSeededAt',
             '$.reportingLastSyncedAt',
             '$.reportingDeniedAt',
             '$.reportingWithdrawnAt',
             '$.reportingDate',
             '$.applicationId',
             '$.applicationDecisionLetters."199".assessment_nwac_review_status',
             '$.applicationDecisionLetters."199".decisionLetterDrafts',
             '$.applicationDecisionLetters."199".decision_letter_drafts',
             '$.applicationDecisionLetters."199".decisionLetter',
             '$.applicationDecisionLetters."199".decision_letter',
             '$.applicationDecisionLetters."199".decisionLetterPackDrafts',
             '$.applicationDecisionLetters."199".decision_letter_pack_drafts',
             '$.applicationDecisionLetters."199".decisionLetterSent',
             '$.applicationDecisionLetters."199".decision_letter_sent',
             '$.applicationDecisionLetters."199".decisionLetterSentType',
             '$.applicationDecisionLetters."199".decision_letter_sent_type',
             '$.applicationDecisionLetters."199".decisionLetterSentAt',
             '$.applicationDecisionLetters."199".decision_letter_sent_at',
             '$.applicationDecisionLetters."199".fundingDecisionReasonCode',
             '$.applicationDecisionLetters."199".fundingDecisionReasonLabel',
             '$.applicationDecisionLetters."199".fundingDecisionReasonExplanation'
           ),
           '$.applicationReportingArtifacts."199"',
           JSON_MERGE_PATCH(
             JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199"'),
             JSON_OBJECT(
               'reportingOnly', JSON_EXTRACT('false', '$'),
               'caseLevelReportingOnly', JSON_EXTRACT('false', '$'),
               'reportingCorrectionAllowed', JSON_EXTRACT('false', '$'),
               'appealPending', JSON_EXTRACT('true', '$'),
               'appealRunId', 'prod-shelley-appeal-open-20260903',
               'appealOriginalDecision', 'denied'
             )
           ),
           '$.applicationAppealHistory."199"',
           JSON_OBJECT(
             'runId', 'prod-shelley-appeal-open-20260903',
             'status', 'pending',
             'requestedByStaffProfileId', 50,
             'originalDecision', 'denied',
             'originalDecisionEventId', 509,
             'originalDecisionContext', JSON_EXTRACT(
               iset_case.case_context_json,
               '$.applicationDecisionLetters."199"'
             )
           )
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case.id = 258
     AND iset_case.status = 'closed'
     AND iset_case.lifecycle_status = 'closed'
     AND iset_case.closure_reason = 'application_denied';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_case_update_failed';
  END IF;

  UPDATE iset_case
     SET status = 'intake',
         lifecycle_status = 'intake',
         closure_reason = NULL,
         case_context_json = JSON_SET(
           JSON_REMOVE(
             iset_case.case_context_json,
             '$.reportingOnlyDenied',
             '$.reportingOnlyDeniedIneligible',
             '$.reportingOnlyWithdrawal',
             '$.reportingCorrectionAllowed',
             '$.excludeFromCaseworkQueues',
             '$.reportingTrigger',
             '$.reportingSeedSource',
             '$.reportingSeededAt',
             '$.reportingLastSyncedAt',
             '$.reportingDeniedAt',
             '$.reportingWithdrawnAt',
             '$.reportingDate',
             '$.applicationId',
             '$.applicationDecisionLetters."208".assessment_nwac_review_status',
             '$.applicationDecisionLetters."208".decisionLetterDrafts',
             '$.applicationDecisionLetters."208".decision_letter_drafts',
             '$.applicationDecisionLetters."208".decisionLetter',
             '$.applicationDecisionLetters."208".decision_letter',
             '$.applicationDecisionLetters."208".decisionLetterPackDrafts',
             '$.applicationDecisionLetters."208".decision_letter_pack_drafts',
             '$.applicationDecisionLetters."208".decisionLetterSent',
             '$.applicationDecisionLetters."208".decision_letter_sent',
             '$.applicationDecisionLetters."208".decisionLetterSentType',
             '$.applicationDecisionLetters."208".decision_letter_sent_type',
             '$.applicationDecisionLetters."208".decisionLetterSentAt',
             '$.applicationDecisionLetters."208".decision_letter_sent_at',
             '$.applicationDecisionLetters."208".fundingDecisionReasonCode',
             '$.applicationDecisionLetters."208".fundingDecisionReasonLabel',
             '$.applicationDecisionLetters."208".fundingDecisionReasonExplanation'
           ),
           '$.applicationReportingArtifacts."208"',
           JSON_MERGE_PATCH(
             JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208"'),
             JSON_OBJECT(
               'reportingOnly', JSON_EXTRACT('false', '$'),
               'caseLevelReportingOnly', JSON_EXTRACT('false', '$'),
               'reportingCorrectionAllowed', JSON_EXTRACT('false', '$'),
               'appealPending', JSON_EXTRACT('true', '$'),
               'appealRunId', 'prod-shelley-appeal-open-20260903',
               'appealOriginalDecision', 'denied'
             )
           ),
           '$.applicationAppealHistory."208"',
           JSON_OBJECT(
             'runId', 'prod-shelley-appeal-open-20260903',
             'status', 'pending',
             'requestedByStaffProfileId', 50,
             'originalDecision', 'denied',
             'originalDecisionEventId', 529,
             'originalDecisionContext', JSON_EXTRACT(
               iset_case.case_context_json,
               '$.applicationDecisionLetters."208"'
             )
           )
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_case.id = 269
     AND iset_case.status = 'closed'
     AND iset_case.lifecycle_status = 'closed'
     AND iset_case.closure_reason = 'application_denied';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_case_update_failed';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'nwac_review',
         current_owner_role = 'NWAC Administrator',
         current_owner_staff_profile_id = NULL,
         nwac_decided_by_staff_profile_id = NULL,
         nwac_decided_at = NULL,
         nwac_decision = NULL,
         nwac_decision_note = NULL,
         metadata_json = JSON_OBJECT(
           'source', 'interim_appeal_open',
           'appealPending', JSON_EXTRACT('true', '$'),
           'appealRunId', 'prod-shelley-appeal-open-20260903',
           'appealRequestedByStaffProfileId', 50,
           'appealOriginalDecision', 'denied',
           'appealOriginalDecisionMakerStaffProfileId', 51,
           'appealOriginalDecisionAt', '2026-08-27T13:25:28Z'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_review_workflow.id = 66
     AND iset_review_workflow.current_stage = 'final_decision_recorded'
     AND iset_review_workflow.nwac_decision = 'denied';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_jennifer_workflow_update_failed';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'nwac_review',
         current_owner_role = 'NWAC Administrator',
         current_owner_staff_profile_id = NULL,
         nwac_decided_by_staff_profile_id = NULL,
         nwac_decided_at = NULL,
         nwac_decision = NULL,
         nwac_decision_note = NULL,
         metadata_json = JSON_OBJECT(
           'source', 'interim_appeal_open',
           'appealPending', JSON_EXTRACT('true', '$'),
           'appealRunId', 'prod-shelley-appeal-open-20260903',
           'appealRequestedByStaffProfileId', 50,
           'appealOriginalDecision', 'denied',
           'appealOriginalDecisionMakerStaffProfileId', 51,
           'appealOriginalDecisionAt', '2026-08-27T15:20:38Z'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE iset_review_workflow.id = 90
     AND iset_review_workflow.current_stage = 'final_decision_recorded'
     AND iset_review_workflow.nwac_decision = 'denied';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_veronica_workflow_update_failed';
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
    'interim_appeal_opened',
    'final_decision_recorded',
    'nwac_review',
    NULL,
    'System Administrator',
    'Appeal opened for a new Decision Maker review at Shelley Stacey''s request. The original denial remains in the workflow history.',
    JSON_OBJECT(
      'runId', 'prod-shelley-appeal-open-20260903',
      'caseId', 258,
      'applicationId', 199,
      'assessmentId', 1622,
      'requestedByStaffProfileId', 50,
      'originalDecision', 'denied',
      'originalDecisionEventId', 509,
      'originalDecisionMakerStaffProfileId', 51,
      'originalDecisionAt', '2026-08-27T13:25:28Z',
      'originalFinalPacketDocumentId', 12864,
      'originalDenialLetterDocumentId', 12865,
      'appealDocumentId', 13854,
      'preservedFundingOverviewVersionId', 44,
      'preservedFundingOverviewSigningRequestId', 274,
      'suspendedDenialReportingPlanId', 206,
      'preservedDenialReportingInterventionIds', JSON_ARRAY(449, 450),
      'preservedEsdcSubmissionId', 508
    )
  ),
  (
    90,
    'application_assessment',
    'application_assessment:application:208',
    'interim_appeal_opened',
    'final_decision_recorded',
    'nwac_review',
    NULL,
    'System Administrator',
    'Appeal opened for a new Decision Maker review at Shelley Stacey''s request. The original denial remains in the workflow history.',
    JSON_OBJECT(
      'runId', 'prod-shelley-appeal-open-20260903',
      'caseId', 269,
      'applicationId', 208,
      'assessmentId', 1770,
      'requestedByStaffProfileId', 50,
      'originalDecision', 'denied',
      'originalDecisionEventId', 529,
      'originalDecisionMakerStaffProfileId', 51,
      'originalDecisionAt', '2026-08-27T15:20:38Z',
      'originalFinalPacketDocumentId', 12943,
      'originalDenialLetterDocumentId', 13620,
      'appealEvidenceSource', 'Shelley Stacey email',
      'suspendedDenialReportingPlanId', 211,
      'preservedDenialReportingInterventionIds', JSON_ARRAY(461, 462),
      'preservedEsdcSubmissionId', 513
    )
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_workflow_event_insert_failed';
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
    'appeal_opened_for_decision',
    'Appeal opened for Decision Maker review',
    JSON_OBJECT(
      'runId', 'prod-shelley-appeal-open-20260903',
      'applicationId', 199,
      'reviewWorkflowId', 66,
      'fromStage', 'final_decision_recorded',
      'toStage', 'nwac_review',
      'requestedByStaffProfileId', 50,
      'originalDecisionEventId', 509,
      'suspendedDenialReportingPlanId', 206
    ),
    CURRENT_TIMESTAMP(3),
    NULL,
    NULL,
    'system_admin_recovery'
  ),
  (
    269,
    'appeal_opened_for_decision',
    'Appeal opened for Decision Maker review',
    JSON_OBJECT(
      'runId', 'prod-shelley-appeal-open-20260903',
      'applicationId', 208,
      'reviewWorkflowId', 90,
      'fromStage', 'final_decision_recorded',
      'toStage', 'nwac_review',
      'requestedByStaffProfileId', 50,
      'originalDecisionEventId', 529,
      'suspendedDenialReportingPlanId', 211
    ),
    CURRENT_TIMESTAMP(3),
    NULL,
    NULL,
    'system_admin_recovery'
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_case_event_insert_failed';
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
  (
    258,
    NULL,
    NULL,
    'APPEAL_OPENED_20260903: Appeal received for application 199. Shelley Stacey requested a new Decision Maker review under the interim appeal process. This is an appeal, not a correction of the original record. Madison Coppola''s 2026-08-27 denial, decision event 509, final assessment packet 12864, and denial letter 12865 remain historical evidence. The appeal letter is document 13854. Denial-only reporting plan 206 is suspended while the appeal is pending.',
    1,
    0,
    NULL,
    NULL
  ),
  (
    269,
    NULL,
    NULL,
    'APPEAL_OPENED_20260903: Appeal received for application 208. Shelley Stacey requested a new Decision Maker review under the interim appeal process. This is an appeal, not a correction of the original record. Madison Coppola''s 2026-08-27 denial, decision event 529, final assessment packet 12943, and denial letter 13620 remain historical evidence. Shelley''s email is the recorded appeal source; no appeal document was stored in PATH when this migration was prepared. Denial-only reporting plan 211 is suspended while the appeal is pending.',
    1,
    0,
    NULL,
    NULL
  );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'shelley_appeal_open_case_note_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_shelley_appeal_open_20260903();
DROP PROCEDURE prod_shelley_appeal_open_20260903;
