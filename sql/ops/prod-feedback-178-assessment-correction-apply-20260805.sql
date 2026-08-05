-- Guarded one-record PROD recovery for feedback #178.
-- The System Administrator restores the approved assessment to Regional Manager
-- review. Derry then uses the normal Return to Coordinator action, preserving
-- the business audit trail for the correction, resubmission, and renewed decision.
-- Recovery snapshot: path-prod-feedback-178-recovery-20260805-1606

DROP PROCEDURE IF EXISTS prod_feedback_178_recovery_20260805;

DELIMITER //

CREATE PROCEDURE prod_feedback_178_recovery_20260805()
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
      SET MESSAGE_TEXT = 'feedback_178_apply_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id = 61
     AND owner_user_id = 'prod-feedback-178-recovery-20260805'
     AND expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_lock_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 61
     AND case_id = 138
     AND client_id = 160
     AND status = 'approved'
     AND lifecycle_status = 'decision_recorded'
     AND decision_outcome = 'approved'
     AND awaiting_reason = 'none'
     AND closure_reason IS NULL
     AND row_version = 40
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = 138
     AND client_id = 160
     AND assigned_staff_profile_id = 5697
     AND portfolio_region_id = 1
     AND status = 'initiated'
     AND lifecycle_status = 'initiated'
     AND open_intervention_count = 0
     AND total_intervention_count = 0
     AND JSON_UNQUOTE(JSON_EXTRACT(
           case_context_json,
           '$.applicationDecisionLetters."61".assessment_nwac_review_status'
         )) = 'approve'
     AND JSON_EXTRACT(case_context_json, '$.assessment_nwac_review_status') IS NULL
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_case_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application_assessment
   WHERE id = 207
     AND application_id = 61
     AND case_id = 138
     AND intervention_budget_pot_id = 2000000000082
     AND posting_context = 'external'
     AND intervention_cost_total = 9988
     AND recommendation = 'recommend'
     AND nwac_review = 'agree'
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_assessment_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE id = 17
     AND workflow_type = 'application_assessment'
     AND subject_key = 'application_assessment:application:61'
     AND case_id = 138
     AND application_id = 61
     AND action_plan_id IS NULL
     AND intervention_id IS NULL
     AND proposal_id IS NULL
     AND current_stage = 'final_decision_recorded'
     AND current_owner_role IS NULL
     AND current_owner_staff_profile_id IS NULL
     AND submitted_by_staff_profile_id = 5697
     AND submitted_at = '2026-07-30 21:02:32'
     AND rm_reviewed_by_staff_profile_id = 995581
     AND rm_reviewed_at = '2026-07-30 22:02:43'
     AND nwac_decided_by_staff_profile_id = 51
     AND nwac_decided_at = '2026-08-04 18:12:27'
     AND nwac_decision = 'approved'
     AND nwac_decision_note IS NULL
     AND archived_at IS NULL
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_workflow_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE review_workflow_id = 17
   FOR UPDATE;
  IF v_guard_count <> 9 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_workflow_history_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE id = 239
     AND review_workflow_id = 17
     AND workflow_type = 'application_assessment'
     AND subject_key = 'application_assessment:application:61'
     AND action = 'nwac_approve'
     AND from_stage = 'nwac_review'
     AND to_stage = 'final_decision_recorded'
     AND actor_staff_profile_id = 51
     AND actor_role = 'NWAC Administrator'
     AND created_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_final_event_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE review_workflow_id = 17
     AND action = 'system_reopen_for_correction'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_recovery_event_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE application_id = 61
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_application_plan_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE id = 166
     AND case_id = 138
     AND application_id = 61
     AND status = 'draft'
     AND activated_at IS NULL
     AND closed_at IS NULL
     AND archived_at IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'auto_assessment'
     AND created_at = '2026-08-04 18:12:27'
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_plan_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE action_plan_id = 166
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_intervention_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE id IN (351, 352, 353)
     AND case_id = 138
     AND action_plan_id = 166
     AND status = 'approved'
     AND delivery_status = 'planned'
     AND actual_amount IS NULL
     AND closed_at IS NULL
     AND created_at = '2026-08-04 18:12:27'
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_intervention_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_series
   WHERE id = 41
     AND case_id = 138
     AND template_key = 'ISET_CFA_STANDARD'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_series_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_version
   WHERE series_id = 41
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_version_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_version
   WHERE id = 37
     AND series_id = 41
     AND version_number = 1
     AND status = 'draft'
     AND supersedes_version_id IS NULL
     AND change_reason = 'NEW_INTERVENTION_APPROVED'
     AND sent_at IS NULL
     AND sent_by_staff_profile_id IS NULL
     AND signed_at IS NULL
     AND signed_by_participant_id IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.plan.id')) = '166'
     AND created_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_version_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_version_documents
   WHERE cfa_version_id = 37
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_document_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_version_documents
   WHERE id = 39
     AND cfa_version_id = 37
     AND document_type = 'clean'
     AND document_id = 9195
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_document_link_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document
   WHERE action_plan_id = 166
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_plan_document_count_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document
   WHERE id = 9195
     AND case_id = 138
     AND client_id = 160
     AND application_id = 61
     AND action_plan_id = 166
     AND signing_request_id IS NULL
     AND source = 'system_generated'
     AND document_category = 'funding_agreement'
     AND visibility = 'internal'
     AND status = 'active'
     AND created_at = '2026-08-04 18:12:28'
     AND updated_at = '2026-08-04 18:12:28'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_document_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM signing_request
   WHERE case_id = 138
     AND checklist_doc_type = 'funding_agreement'
     AND JSON_UNQUOTE(JSON_EXTRACT(
           resolved_schema_json,
           '$.meta.cfaVersionId'
         )) = '37'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_signing_request_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE id = 433
     AND case_id = 138
     AND action_plan_id = 166
     AND application_id = 61
     AND readiness_status = 'needs_review'
     AND submission_status = 'pending'
     AND submitted_at IS NULL
     AND submitted_by_user_id IS NULL
     AND payload_snapshot IS NULL
     AND payload_storage_key IS NULL
     AND payload_checksum IS NULL
     AND rejection_reason IS NULL
     AND created_at = '2026-08-04 18:12:27'
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_esdc_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE action_plan_id = 166
      OR legacy_intervention_id IN (351, 352, 353)
      OR source_intervention_id IN (351, 352, 353)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_proposal_dependency_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document_intervention
   WHERE intervention_id IN (351, 352, 353)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_intervention_document_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM payment_packet
   WHERE intervention_id IN (351, 352, 353)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_payment_packet_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM payment_packet_line
   WHERE intervention_id IN (351, 352, 353)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_payment_line_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM finance_transaction
   WHERE case_intervention_id IN (351, 352, 353)
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_finance_transaction_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_report
   WHERE id = 178
     AND report_type = 'bug'
     AND severity = 'high'
     AND status = 'triaging'
     AND summary = 'Make a change on an approved application'
     AND submitted_by_staff_profile_id = 5697
     AND submitted_by_email = 'dburdett@iaaw.ca'
     AND updated_at = '2026-08-05 12:18:59'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_feedback_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_note
   WHERE report_id = 178
     AND note_text LIKE 'SYSTEM_ADMIN_RECOVERY_20260805_FEEDBACK_178:%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_feedback_note_exists';
  END IF;

  UPDATE iset_case_intervention
     SET status = 'cancelled',
         delivery_status = 'cancelled',
         updated_at = CURRENT_TIMESTAMP
   WHERE id IN (351, 352, 353)
     AND case_id = 138
     AND action_plan_id = 166
     AND status = 'approved'
     AND delivery_status = 'planned'
     AND actual_amount IS NULL
     AND closed_at IS NULL;
  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_intervention_update_failed';
  END IF;

  UPDATE iset_case_action_plan
     SET status = 'archived',
         archived_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 166
     AND case_id = 138
     AND application_id = 61
     AND status = 'draft'
     AND archived_at IS NULL;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_plan_update_failed';
  END IF;

  DELETE FROM esdc_participant_submission
   WHERE id = 433
     AND case_id = 138
     AND action_plan_id = 166
     AND application_id = 61
     AND readiness_status = 'needs_review'
     AND submission_status = 'pending'
     AND submitted_at IS NULL
     AND submitted_by_user_id IS NULL
     AND payload_snapshot IS NULL
     AND payload_storage_key IS NULL
     AND payload_checksum IS NULL
     AND rejection_reason IS NULL;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_esdc_delete_failed';
  END IF;

  UPDATE cfa_version
     SET status = 'withdrawn'
   WHERE id = 37
     AND series_id = 41
     AND status = 'draft'
     AND sent_at IS NULL
     AND signed_at IS NULL;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_cfa_update_failed';
  END IF;

  UPDATE iset_document
     SET status = 'archived',
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 9195
     AND case_id = 138
     AND client_id = 160
     AND application_id = 61
     AND action_plan_id = 166
     AND signing_request_id IS NULL
     AND source = 'system_generated'
     AND document_category = 'funding_agreement'
     AND status = 'active';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_document_update_failed';
  END IF;

  UPDATE iset_application
     SET status = 'pending_approval',
         lifecycle_status = 'pending_decision',
         decision_outcome = NULL,
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = row_version + 1,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 61
     AND case_id = 138
     AND client_id = 160
     AND status = 'approved'
     AND lifecycle_status = 'decision_recorded'
     AND decision_outcome = 'approved'
     AND row_version = 40;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_application_update_failed';
  END IF;

  UPDATE iset_case
     SET case_context_json = JSON_REMOVE(
           case_context_json,
           '$.assessmentOtherFunding',
           '$.assessment_nwac_review_status',
           '$.decisionLetterDrafts',
           '$.decision_letter_drafts',
           '$.decisionLetter',
           '$.decision_letter',
           '$.decisionLetterPackDrafts',
           '$.decision_letter_pack_drafts',
           '$.decisionLetterSent',
           '$.decision_letter_sent',
           '$.decisionLetterSentType',
           '$.decision_letter_sent_type',
           '$.decisionLetterSentAt',
           '$.decision_letter_sent_at',
           '$.fundingDecisionReasonCode',
           '$.fundingDecisionReasonLabel',
           '$.fundingDecisionReasonExplanation',
           '$.applicationDecisionLetters."61".assessment_nwac_review_status',
           '$.applicationDecisionLetters."61".decisionLetterDrafts',
           '$.applicationDecisionLetters."61".decision_letter_drafts',
           '$.applicationDecisionLetters."61".decisionLetter',
           '$.applicationDecisionLetters."61".decision_letter',
           '$.applicationDecisionLetters."61".decisionLetterPackDrafts',
           '$.applicationDecisionLetters."61".decision_letter_pack_drafts',
           '$.applicationDecisionLetters."61".decisionLetterSent',
           '$.applicationDecisionLetters."61".decision_letter_sent',
           '$.applicationDecisionLetters."61".decisionLetterSentType',
           '$.applicationDecisionLetters."61".decision_letter_sent_type',
           '$.applicationDecisionLetters."61".decisionLetterSentAt',
           '$.applicationDecisionLetters."61".decision_letter_sent_at',
           '$.applicationDecisionLetters."61".fundingDecisionReasonCode',
           '$.applicationDecisionLetters."61".fundingDecisionReasonLabel',
           '$.applicationDecisionLetters."61".fundingDecisionReasonExplanation'
         ),
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 138
     AND client_id = 160
     AND assigned_staff_profile_id = 5697
     AND JSON_UNQUOTE(JSON_EXTRACT(
           case_context_json,
           '$.applicationDecisionLetters."61".assessment_nwac_review_status'
         )) = 'approve';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_case_context_update_failed';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'rm_review',
         current_owner_role = 'Regional Manager',
         current_owner_staff_profile_id = NULL,
         rm_reviewed_by_staff_profile_id = NULL,
         rm_reviewed_at = NULL,
         rm_review_note = NULL,
         nwac_decided_by_staff_profile_id = NULL,
         nwac_decided_at = NULL,
         nwac_decision = NULL,
         nwac_decision_note = NULL,
         metadata_json = '{"source":"system_admin_post_decision_correction_recovery","feedbackReportId":178,"snapshotId":"path-prod-feedback-178-recovery-20260805-1606"}',
         archived_at = NULL,
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 17
     AND workflow_type = 'application_assessment'
     AND subject_key = 'application_assessment:application:61'
     AND case_id = 138
     AND application_id = 61
     AND current_stage = 'final_decision_recorded'
     AND nwac_decision = 'approved';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_workflow_update_failed';
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
  ) VALUES (
    17,
    'application_assessment',
    'application_assessment:application:61',
    'system_reopen_for_correction',
    'final_decision_recorded',
    'rm_review',
    NULL,
    'System Administrator',
    'System Administrator restored this approved assessment to Regional Manager review so it can be returned to the Coordinator for correction through the normal audited workflow.',
    '{"source":"prod_feedback_178_recovery","feedbackReportId":178,"caseId":138,"applicationId":61,"assessmentId":207,"archivedActionPlanId":166,"withdrawnCfaVersionId":37,"snapshotId":"path-prod-feedback-178-recovery-20260805-1606"}'
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_workflow_event_insert_failed';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  ) VALUES (
    138,
    'assessment_reopened_for_correction',
    'Approved assessment restored to Regional Manager review for correction',
    '{"runId":"prod-feedback-178-recovery-20260805","feedbackReportId":178,"applicationId":61,"reviewWorkflowId":17,"fromStage":"final_decision_recorded","toStage":"rm_review","snapshotId":"path-prod-feedback-178-recovery-20260805-1606"}',
    NULL,
    NULL,
    'system_administration'
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_case_event_insert_failed';
  END IF;

  INSERT INTO iset_case_note (
    case_id,
    author_staff_profile_id,
    author_user_id,
    body,
    is_internal,
    is_pinned
  ) VALUES (
    138,
    NULL,
    NULL,
    'SYSTEM_ADMIN_RECOVERY_20260805_FEEDBACK_178: The approved assessment was restored to Regional Manager review. The prior final-decision workflow events remain intact. The draft action plan, generated interventions, and unsigned Client Funding Agreement were withdrawn from current use. The Regional Manager must use Return to Coordinator before the Coordinator edits and resubmits.',
    1,
    0
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_case_note_insert_failed';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress',
         updated_at = CURRENT_TIMESTAMP
   WHERE id = 178
     AND status = 'triaging';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_feedback_update_failed';
  END IF;

  INSERT INTO admin_feedback_status_history (
    report_id,
    previous_status,
    new_status,
    changed_by_staff_profile_id,
    changed_by_name,
    changed_by_email
  ) VALUES (
    178,
    'triaging',
    'in_progress',
    NULL,
    'System Administrator',
    NULL
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_feedback_history_insert_failed';
  END IF;

  INSERT INTO admin_feedback_note (
    report_id,
    author_staff_profile_id,
    author_name,
    author_email,
    note_text
  ) VALUES (
    178,
    NULL,
    'System Administrator',
    NULL,
    'SYSTEM_ADMIN_RECOVERY_20260805_FEEDBACK_178: Restored the approved assessment to Regional Manager review under the approved exceptional recovery process. The prior final-decision workflow events remain intact. Draft action plan 166 and generated interventions 351-353 were archived or cancelled; unsigned CFA version 37 and its generated document were withdrawn or archived; the unsubmitted ESDC readiness seed was removed. Preflight found no linked proposal, intervention document, payment, finance, or signing activity. Derry Yellowfly must now use Return to Coordinator; Danielle Burdett can then correct and resubmit; Madison Coppola must record the renewed decision. This report remains in progress until that staff workflow and its replacement artifacts are verified.'
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_apply_feedback_note_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_178_recovery_20260805();
DROP PROCEDURE prod_feedback_178_recovery_20260805;
