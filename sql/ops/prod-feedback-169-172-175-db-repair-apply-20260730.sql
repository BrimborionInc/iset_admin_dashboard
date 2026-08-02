-- Guarded PROD database-only repair for:
-- - Feedback #169: accidental denial, Case 109 / Application 27 / workflow 11
-- - Feedback #172: accidental backloaded Intervention 316 on Action Plan 146
-- - Feedback #175: accidental denial, Case 160 / Application 90 / workflow 26
-- - Feedback #176: already-closed duplicate of #175
--
-- Required before execution:
-- - run prod-feedback-169-172-175-db-repair-discovery-20260730.sql;
-- - verify PROD identity/database/host/user;
-- - create an Aurora cluster restore-point snapshot.
--
-- All business-record changes are one transaction. The audit table DDL is
-- intentionally outside it because MySQL DDL commits implicitly.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prod_feedback_169_172_175_repair_audit_20260730 (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id VARCHAR(96) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  captured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_feedback_169_172_175_repair_entity
    (run_id, entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_feedback_169_172_175_db_repair_20260730;

DELIMITER //

CREATE PROCEDURE prod_feedback_169_172_175_db_repair_20260730()
BEGIN
  DECLARE v_run_id VARCHAR(96)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'prod-feedback-169-172-175-db-repair-20260730';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_changed_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM prod_feedback_169_172_175_repair_audit_20260730
   WHERE run_id = v_run_id;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_feedback_repair_already_recorded';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_report
   WHERE (id = 169 AND submitted_by_email = 'emarion@nwac.ca' AND status = 'triaging')
      OR (id = 172 AND submitted_by_email = 'emarion@nwac.ca' AND status = 'triaging')
      OR (id = 175 AND submitted_by_email = 'dburdett@iaaw.ca' AND status = 'triaging')
      OR (id = 176 AND submitted_by_email = 'dburdett@iaaw.ca' AND status = 'closed')
   FOR UPDATE;
  IF v_guard_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_report_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE (id = 109
          AND case_number = 'ISET-20260418-D6CEEE'
          AND status = 'closed'
          AND lifecycle_status = 'closed'
          AND closure_reason = 'administrative'
          AND closed_at = '2026-07-27 00:00:00'
          AND assigned_staff_profile_id = 60
          AND JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingOnlyDenied')) = 'true'
          AND JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingSeedSource')) = 'denied_reporting')
      OR (id = 160
          AND case_number = 'ISET-20260602-33080C'
          AND status = 'closed'
          AND lifecycle_status = 'closed'
          AND closure_reason = 'administrative'
          AND closed_at = '2026-07-29 00:00:00'
          AND assigned_staff_profile_id = 5697
          AND JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingOnlyDenied')) = 'true'
          AND JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingSeedSource')) = 'denied_reporting')
      OR (id = 30
          AND case_number = 'CASE-2026-0000030'
          AND status = 'active'
          AND lifecycle_status = 'active'
          AND assigned_staff_profile_id = 60)
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_case_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE (id = 27 AND case_id = 109 AND status = 'rejected'
          AND lifecycle_status = 'decision_recorded'
          AND decision_outcome = 'denied' AND awaiting_reason = 'none'
          AND closure_reason IS NULL AND row_version = 73)
      OR (id = 90 AND case_id = 160 AND status = 'rejected'
          AND lifecycle_status = 'decision_recorded'
          AND decision_outcome = 'denied' AND awaiting_reason = 'none'
          AND closure_reason IS NULL AND row_version = 40)
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_application_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application_assessment
   WHERE (id = 30 AND case_id = 109 AND application_id = 27
          AND recommendation = 'recommend' AND nwac_review = 'disagree'
          AND nwac_reason LIKE '%Overall, I am fine to approve%')
      OR (id = 487 AND case_id = 160 AND application_id = 90
          AND recommendation = 'recommend' AND nwac_review = 'disagree'
          AND nwac_reason LIKE '%adjust Brooklyn%')
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_assessment_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE (id = 11 AND workflow_type = 'application_assessment'
          AND subject_key = 'application_assessment:application:27'
          AND case_id = 109 AND application_id = 27
          AND current_stage = 'final_decision_recorded'
          AND current_owner_role IS NULL
          AND submitted_by_staff_profile_id = 60
          AND rm_reviewed_by_staff_profile_id = 55
          AND nwac_decided_by_staff_profile_id = 50
          AND nwac_decision = 'denied'
          AND archived_at IS NULL)
      OR (id = 26 AND workflow_type = 'application_assessment'
          AND subject_key = 'application_assessment:application:90'
          AND case_id = 160 AND application_id = 90
          AND current_stage = 'final_decision_recorded'
          AND current_owner_role IS NULL
          AND submitted_by_staff_profile_id = 5697
          AND rm_reviewed_by_staff_profile_id = 995581
          AND nwac_decided_by_staff_profile_id = 51
          AND nwac_decision = 'denied'
          AND archived_at IS NULL)
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_review_workflow_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE (review_workflow_id = 11 AND action = 'nwac_deny'
          AND from_stage = 'nwac_review' AND to_stage = 'final_decision_recorded'
          AND actor_staff_profile_id = 50 AND created_at = '2026-07-27 16:22:24')
      OR (review_workflow_id = 26 AND action = 'nwac_deny'
          AND from_stage = 'nwac_review' AND to_stage = 'final_decision_recorded'
          AND actor_staff_profile_id = 51 AND created_at = '2026-07-29 19:24:19');
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_denial_event_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE (id = 145 AND case_id = 109 AND application_id = 27
          AND name = 'Actions leading to denial' AND status = 'closed'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting'
          AND archived_at IS NULL)
      OR (id = 147 AND case_id = 160 AND application_id = 90
          AND name = 'Actions leading to denial' AND status = 'closed'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting'
          AND archived_at IS NULL)
      OR (id = 146 AND case_id = 30 AND application_id IS NULL
          AND name = 'Social Services Worker – Year 2' AND status = 'active'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
          AND archived_at IS NULL)
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_action_plan_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE (id IN (314, 315) AND case_id = 109 AND action_plan_id = 145
          AND status = 'completed' AND delivery_status = 'completed'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting')
      OR (id = 316 AND case_id = 30 AND action_plan_id = 146
          AND intervention_code = 10 AND status = 'completed'
          AND delivery_status = 'completed'
          AND intervention_cost IS NULL AND budget_amount IS NULL
          AND approved_amount IS NULL AND actual_amount IS NULL
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload')
      OR (id IN (319, 320) AND case_id = 160 AND action_plan_id = 147
          AND status = 'completed' AND delivery_status = 'completed'
          AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting')
   FOR UPDATE;
  IF v_guard_count <> 5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_intervention_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE (id = 390 AND case_id = 109 AND action_plan_id = 145
          AND application_id = 27 AND submission_status = 'pending'
          AND submitted_at IS NULL AND payload_storage_key IS NULL
          AND payload_checksum IS NULL)
      OR (id = 406 AND case_id = 160 AND action_plan_id = 147
          AND application_id = 90 AND submission_status = 'pending'
          AND submitted_at IS NULL AND payload_storage_key IS NULL
          AND payload_checksum IS NULL)
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_esdc_reporting_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE id = 389
     AND case_id = 30
     AND action_plan_id = 146
     AND application_id IS NULL
     AND legacy_intervention_id = 316
     AND source_intervention_id IS NULL
     AND proposal_kind = 'new'
     AND review_status = 'approved'
     AND proposed_cost = 0.00
     AND archived_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_intervention_316_proposal';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE action_plan_id IN (145, 146, 147)
      OR application_id IN (27, 90)
      OR legacy_intervention_id IN (314, 315, 316, 319, 320)
      OR source_intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_proposal_dependency_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_item
   WHERE action_plan_id IN (145, 146, 147);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_action_item_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document
   WHERE action_plan_id IN (145, 146, 147);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_plan_document_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_document_intervention
   WHERE intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_intervention_document_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM finance_transaction
   WHERE case_intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_finance_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM payment_packet
   WHERE intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_payment_packet_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM payment_packet_line
   WHERE intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_payment_line_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_reminder
   WHERE action_plan_id IN (145, 146, 147)
      OR intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_reminder_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE action_plan_id IN (145, 146, 147)
      OR intervention_id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_linked_workflow_dependency';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM cfa_series
   WHERE case_id = 30;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_case30_cfa_dependency';
  END IF;

  -- Compact before snapshots for all updated entities.
  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'case', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'status', status, 'lifecycle_status', lifecycle_status,
           'closure_reason', closure_reason, 'closed_at', closed_at,
           'case_context_json', case_context_json, 'updated_at', updated_at)
    FROM iset_case
   WHERE id IN (30, 109, 160);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'application', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'status', status, 'lifecycle_status', lifecycle_status,
           'decision_outcome', decision_outcome, 'awaiting_reason', awaiting_reason,
           'closure_reason', closure_reason, 'row_version', row_version,
           'updated_at', updated_at)
    FROM iset_application
   WHERE id IN (27, 90);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'review_workflow', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'current_stage', current_stage,
           'current_owner_role', current_owner_role,
           'current_owner_staff_profile_id', current_owner_staff_profile_id,
           'nwac_decided_by_staff_profile_id', nwac_decided_by_staff_profile_id,
           'nwac_decided_at', nwac_decided_at, 'nwac_decision', nwac_decision,
           'nwac_decision_note', nwac_decision_note,
           'metadata_json', metadata_json, 'updated_at', updated_at)
    FROM iset_review_workflow
   WHERE id IN (11, 26);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'feedback_report', CAST(id AS CHAR),
         JSON_OBJECT('id', id, 'status', status, 'updated_at', updated_at)
    FROM admin_feedback_report
   WHERE id IN (169, 172, 175, 176);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'action_plan', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'case_id', case_id, 'application_id', application_id,
           'name', name, 'status', status, 'agreement_number', agreement_number,
           'budget_pot', budget_pot, 'funding_stream', funding_stream,
           'version', version, 'owner_staff_profile_id', owner_staff_profile_id,
           'owner_user_id', owner_user_id, 'effective_date', effective_date,
           'review_date', review_date, 'activated_at', activated_at,
           'closed_at', closed_at, 'result_code', result_code,
           'EIClaimant', EIClaimant, 'prev_employment', prev_employment,
           'result_date', result_date, 'outcome_summary', outcome_summary,
           'closure_notes', closure_notes, 'notes', notes,
           'metadata_json', metadata_json, 'esdc_action_plan_json', esdc_action_plan_json,
           'created_at', created_at, 'updated_at', updated_at, 'archived_at', archived_at)
    FROM iset_case_action_plan
   WHERE id IN (145, 146, 147);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'intervention', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'case_id', case_id, 'action_plan_id', action_plan_id,
           'intervention_code', intervention_code, 'related_noc_version', related_noc_version,
           'related_noc', related_noc, 'status', status,
           'delivery_status', delivery_status, 'start_date', start_date,
           'end_date', end_date, 'duration_days', duration_days,
           'intervention_cost', intervention_cost, 'budget_amount', budget_amount,
           'approved_amount', approved_amount, 'actual_amount', actual_amount,
           'outcome_code', outcome_code, 'notes', notes,
           'metadata_json', metadata_json, 'esdc_intervention_json', esdc_intervention_json,
           'created_by_staff_profile_id', created_by_staff_profile_id,
           'reviewed_by_staff_profile_id', reviewed_by_staff_profile_id,
           'reviewed_at', reviewed_at, 'review_notes', review_notes,
           'eligibility_result', eligibility_result,
           'funding_stream_decision', funding_stream_decision,
           'required_docs_flags', required_docs_flags,
           'created_at', created_at, 'updated_at', updated_at, 'closed_at', closed_at)
    FROM iset_case_intervention
   WHERE id IN (314, 315, 316, 319, 320);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'esdc_submission', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'case_id', case_id, 'action_plan_id', action_plan_id,
           'application_id', application_id, 'readiness_status', readiness_status,
           'readiness_summary', readiness_summary, 'warnings', warnings,
           'blocking_issues', blocking_issues, 'last_validated_at', last_validated_at,
           'submission_status', submission_status, 'submitted_at', submitted_at,
           'submitted_by_user_id', submitted_by_user_id,
           'payload_snapshot', payload_snapshot, 'payload_storage_key', payload_storage_key,
           'payload_checksum', payload_checksum, 'rejection_reason', rejection_reason,
           'created_at', created_at, 'updated_at', updated_at)
    FROM esdc_participant_submission
   WHERE id IN (390, 406);

  INSERT INTO prod_feedback_169_172_175_repair_audit_20260730
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'intervention_proposal', CAST(id AS CHAR),
         JSON_OBJECT(
           'id', id, 'case_id', case_id, 'action_plan_id', action_plan_id,
           'application_id', application_id, 'legacy_intervention_id', legacy_intervention_id,
           'source_intervention_id', source_intervention_id,
           'proposal_kind', proposal_kind, 'review_status', review_status,
           'title', title, 'intervention_code', intervention_code,
           'start_date', start_date, 'end_date', end_date,
           'proposed_cost', proposed_cost, 'decision_reason', decision_reason,
           'decision_notes', decision_notes, 'payload_json', payload_json,
           'metadata_json', metadata_json,
           'submitted_by_staff_profile_id', submitted_by_staff_profile_id,
           'reviewed_by_staff_profile_id', reviewed_by_staff_profile_id,
           'submitted_at', submitted_at, 'reviewed_at', reviewed_at,
           'created_at', created_at, 'updated_at', updated_at, 'archived_at', archived_at)
    FROM iset_intervention_proposal
   WHERE id = 389;

  -- Remove the denial-only reporting records. They are unsubmitted and have no
  -- finance, document, payment, reminder, proposal, CFA, or workflow dependencies.
  DELETE FROM esdc_participant_submission
   WHERE id IN (390, 406)
     AND submission_status = 'pending'
     AND submitted_at IS NULL;
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'delete_failed_denial_esdc_rows';
  END IF;

  DELETE FROM iset_case_intervention
   WHERE id IN (314, 315, 319, 320)
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting';
  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'delete_failed_denial_interventions';
  END IF;

  DELETE FROM iset_case_action_plan
   WHERE id IN (145, 147)
     AND name = 'Actions leading to denial'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'denied_reporting';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'delete_failed_denial_action_plans';
  END IF;

  -- Match the normal intervention-delete behavior for the accidental backload:
  -- delete its compatibility proposal before deleting the intervention.
  DELETE FROM iset_intervention_proposal
   WHERE id = 389
     AND legacy_intervention_id = 316;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'delete_failed_intervention_316_proposal';
  END IF;

  DELETE FROM iset_case_intervention
   WHERE id = 316
     AND case_id = 30
     AND action_plan_id = 146
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'delete_failed_intervention_316';
  END IF;

  UPDATE iset_case_action_plan
     SET updated_at = NOW()
   WHERE id = 146
     AND case_id = 30
     AND status = 'active';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_action_plan_146_touch';
  END IF;

  -- Restore the two applications to the exact state produced by a Decision
  -- Maker request-changes action. The Regional Manager is the current owner.
  UPDATE iset_application
     SET status = 'pending_approval',
         lifecycle_status = 'pending_decision',
         decision_outcome = NULL,
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = row_version + 1,
         updated_at = NOW()
   WHERE id IN (27, 90)
     AND status = 'rejected'
     AND lifecycle_status = 'decision_recorded'
     AND decision_outcome = 'denied';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_application_recovery';
  END IF;

  UPDATE iset_review_workflow
     SET current_stage = 'returned_to_rm',
         current_owner_role = 'Regional Manager',
         current_owner_staff_profile_id = NULL,
         nwac_decision = 'changes_requested',
         metadata_json = JSON_OBJECT(
           'source', 'application_assessment_nwac_decision',
           'assessmentReviewStatus', 'push_back',
           'dataRepair', JSON_OBJECT(
             'repairId', v_run_id,
             'reason', 'Recovered an accidental denial to the intended request-changes state.'
           )
         ),
         updated_at = NOW()
   WHERE id IN (11, 26)
     AND current_stage = 'final_decision_recorded'
     AND nwac_decision = 'denied';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_workflow_recovery';
  END IF;

  UPDATE iset_case
     SET status = 'intake',
         lifecycle_status = 'intake',
         closure_reason = NULL,
         closed_at = NULL,
         case_context_json = JSON_SET(
           JSON_REMOVE(
             case_context_json,
             '$.reportingTrigger',
             '$.reportingSeedSource',
             '$.reportingDeniedAt',
             '$.reportingSeededAt',
             '$.reportingLastSyncedAt',
             '$.reportingOnlyDenied',
             '$.reportingOnlyDeniedIneligible',
             '$.reportingCorrectionAllowed',
             '$.excludeFromCaseworkQueues',
             '$.fundingDecisionReasonCode',
             CASE
               WHEN id = 109 THEN '$.applicationReportingArtifacts."27"'
               ELSE '$.applicationReportingArtifacts."90"'
             END
           ),
           CASE
             WHEN id = 109 THEN '$.applicationDecisionLetters."27".assessment_nwac_review_status'
             ELSE '$.applicationDecisionLetters."90".assessment_nwac_review_status'
           END,
           'push_back'
         ),
         updated_at = NOW()
   WHERE id IN (109, 160)
     AND status = 'closed'
     AND lifecycle_status = 'closed';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_case_recovery';
  END IF;

  UPDATE iset_case
     SET case_context_json = JSON_REMOVE(case_context_json, '$.applicationReportingArtifacts'),
         updated_at = NOW()
   WHERE id IN (109, 160)
     AND JSON_TYPE(JSON_EXTRACT(case_context_json, '$.applicationReportingArtifacts')) = 'OBJECT'
     AND JSON_LENGTH(JSON_EXTRACT(case_context_json, '$.applicationReportingArtifacts')) = 0;

  INSERT INTO iset_review_workflow_event
    (review_workflow_id, workflow_type, subject_key, action,
     from_stage, to_stage, actor_staff_profile_id, actor_role,
     note, payload_json)
  SELECT rw.id, rw.workflow_type, rw.subject_key, 'nwac_request_changes',
         'final_decision_recorded', 'returned_to_rm', NULL, 'System data repair',
         rw.nwac_decision_note,
         JSON_OBJECT(
           'source', 'codex_prod_sql',
           'repairId', v_run_id,
           'feedbackReportId', CASE WHEN rw.id = 11 THEN 169 ELSE 175 END,
           'recoveredFromAction', 'nwac_deny',
           'assessmentReviewStatus', 'push_back'
         )
    FROM iset_review_workflow rw
   WHERE rw.id IN (11, 26);
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'insert_failed_workflow_repair_events';
  END IF;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, occurred_at,
     actor_staff_profile_id, actor_user_id, source_system)
  VALUES
    (
      109,
      'data_repair',
      'Recovered accidental denial to the intended request-changes workflow.',
      JSON_OBJECT(
        'repairId', v_run_id, 'feedbackReportId', 169,
        'applicationId', 27, 'reviewWorkflowId', 11,
        'removedActionPlanId', 145,
        'removedInterventionIds', JSON_ARRAY(314, 315),
        'removedEsdcSubmissionId', 390,
        'fromApplicationStatus', 'rejected',
        'toApplicationStatus', 'pending_approval',
        'fromWorkflowStage', 'final_decision_recorded',
        'toWorkflowStage', 'returned_to_rm'
      ),
      NOW(3), NULL, NULL, 'codex_prod_sql'
    ),
    (
      160,
      'data_repair',
      'Recovered accidental denial to the intended request-changes workflow.',
      JSON_OBJECT(
        'repairId', v_run_id, 'feedbackReportId', 175,
        'duplicateFeedbackReportId', 176,
        'applicationId', 90, 'reviewWorkflowId', 26,
        'removedActionPlanId', 147,
        'removedInterventionIds', JSON_ARRAY(319, 320),
        'removedEsdcSubmissionId', 406,
        'fromApplicationStatus', 'rejected',
        'toApplicationStatus', 'pending_approval',
        'fromWorkflowStage', 'final_decision_recorded',
        'toWorkflowStage', 'returned_to_rm'
      ),
      NOW(3), NULL, NULL, 'codex_prod_sql'
    ),
    (
      30,
      'data_repair',
      'Removed accidental dependency-free manual-backload intervention.',
      JSON_OBJECT(
        'repairId', v_run_id, 'feedbackReportId', 172,
        'actionPlanId', 146, 'interventionId', 316,
        'compatibilityProposalId', 389,
        'reason', 'Staff reported the existing intervention was entered without its financial portion and requested to start over.'
      ),
      NOW(3), NULL, NULL, 'codex_prod_sql'
    );
  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'insert_failed_case_repair_events';
  END IF;

  INSERT INTO admin_feedback_status_history
    (report_id, previous_status, new_status, changed_by_staff_profile_id,
     changed_by_name, changed_by_email, changed_at)
  SELECT id, status, 'closed', NULL, 'Codex', 'codex@openai.com', NOW()
    FROM admin_feedback_report
   WHERE id IN (169, 172, 175)
     AND status = 'triaging';
  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'insert_failed_feedback_close_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'closed',
         updated_at = NOW()
   WHERE id IN (169, 172, 175)
     AND status = 'triaging';
  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_feedback_close';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
  VALUES
    (
      169, NULL, 'Codex', 'codex@openai.com',
      CONCAT(
        '[', v_run_id, '] Closed after guarded PROD database repair. ',
        'Case 109 / Application 27 / workflow 11 was restored from the accidental denial ',
        'to returned_to_rm with changes_requested. Application status is pending_approval, ',
        'the case is back in intake, and the false denial-only plan, two reporting interventions, ',
        'unsubmitted ESDC row, reporting flags, and application reporting artifact were removed. ',
        'The Regional Manager can now use the normal Forward requested changes action for Judy.'
      ),
      NOW()
    ),
    (
      172, NULL, 'Codex', 'codex@openai.com',
      CONCAT(
        '[', v_run_id, '] Closed after guarded PROD database repair. ',
        'Removed accidental manual-backload Intervention 316 and its compatibility proposal 389 ',
        'from Case 30 / Action Plan 146. Dependency guards confirmed there were no finance, payment, ',
        'document, reminder, CFA, ESDC, action-item, or review-workflow records tied to the intervention. ',
        'The action plan remains active so the existing intervention can be entered again with its financial details.'
      ),
      NOW()
    ),
    (
      175, NULL, 'Codex', 'codex@openai.com',
      CONCAT(
        '[', v_run_id, '] Closed after guarded PROD database repair. ',
        'Case 160 / Application 90 / workflow 26 was restored from the accidental denial ',
        'to returned_to_rm with changes_requested. Application status is pending_approval, ',
        'the case is back in intake, and the false denial-only plan, two reporting interventions, ',
        'unsubmitted ESDC row, reporting flags, and application reporting artifact were removed. ',
        'Derry can now use the normal Forward requested changes action for Danielle. Duplicate #176 remains closed.'
      ),
      NOW()
    ),
    (
      176, NULL, 'Codex', 'codex@openai.com',
      CONCAT(
        '[', v_run_id, '] The database recovery tracked under #175 is complete. ',
        'Case 160 / Application 90 is no longer denied and is back with the Regional Manager ',
        'in the normal request-changes workflow. This duplicate remains closed.'
      ),
      NOW()
    );
  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'insert_failed_feedback_repair_notes';
  END IF;

  -- Record compact post-state evidence.
  UPDATE prod_feedback_169_172_175_repair_audit_20260730 a
  JOIN iset_case c
    ON a.run_id = v_run_id
   AND a.entity_type = 'case'
   AND a.entity_id = CAST(c.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'id', c.id, 'status', c.status, 'lifecycle_status', c.lifecycle_status,
       'closure_reason', c.closure_reason, 'closed_at', c.closed_at,
       'case_context_json', c.case_context_json, 'updated_at', c.updated_at);

  UPDATE prod_feedback_169_172_175_repair_audit_20260730 a
  JOIN iset_application app
    ON a.run_id = v_run_id
   AND a.entity_type = 'application'
   AND a.entity_id = CAST(app.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'id', app.id, 'status', app.status, 'lifecycle_status', app.lifecycle_status,
       'decision_outcome', app.decision_outcome, 'awaiting_reason', app.awaiting_reason,
       'closure_reason', app.closure_reason, 'row_version', app.row_version,
       'updated_at', app.updated_at);

  UPDATE prod_feedback_169_172_175_repair_audit_20260730 a
  JOIN iset_review_workflow rw
    ON a.run_id = v_run_id
   AND a.entity_type = 'review_workflow'
   AND a.entity_id = CAST(rw.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'id', rw.id, 'current_stage', rw.current_stage,
       'current_owner_role', rw.current_owner_role,
       'current_owner_staff_profile_id', rw.current_owner_staff_profile_id,
       'nwac_decision', rw.nwac_decision, 'metadata_json', rw.metadata_json,
       'updated_at', rw.updated_at);

  UPDATE prod_feedback_169_172_175_repair_audit_20260730 a
  JOIN iset_case_action_plan ap
    ON a.run_id = v_run_id
   AND a.entity_type = 'action_plan'
   AND a.entity_id = CAST(ap.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'id', ap.id, 'status', ap.status, 'updated_at', ap.updated_at);

  UPDATE prod_feedback_169_172_175_repair_audit_20260730
     SET after_json = JSON_OBJECT('deleted', TRUE)
   WHERE run_id = v_run_id
     AND (
       (entity_type = 'action_plan' AND entity_id IN ('145', '147'))
       OR entity_type IN ('intervention', 'esdc_submission', 'intervention_proposal')
     );

  UPDATE prod_feedback_169_172_175_repair_audit_20260730 a
  JOIN admin_feedback_report r
    ON a.run_id = v_run_id
   AND a.entity_type = 'feedback_report'
   AND a.entity_id = CAST(r.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'id', r.id, 'status', r.status, 'updated_at', r.updated_at);

  COMMIT;

  SELECT v_run_id AS repair_id, COUNT(*) AS audit_rows
    FROM prod_feedback_169_172_175_repair_audit_20260730
   WHERE run_id = v_run_id;
END//

DELIMITER ;

CALL prod_feedback_169_172_175_db_repair_20260730();

DROP PROCEDURE IF EXISTS prod_feedback_169_172_175_db_repair_20260730;

SELECT id, status, lifecycle_status, closure_reason, closed_at,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingOnlyDenied')) AS reporting_only_denied,
       JSON_UNQUOTE(JSON_EXTRACT(case_context_json, '$.reportingSeedSource')) AS reporting_seed_source
  FROM iset_case
 WHERE id IN (30, 109, 160)
 ORDER BY id;

SELECT id, case_id, status, lifecycle_status, decision_outcome,
       awaiting_reason, closure_reason, row_version
  FROM iset_application
 WHERE id IN (27, 90)
 ORDER BY id;

SELECT id, current_stage, current_owner_role, current_owner_staff_profile_id,
       nwac_decision, nwac_decided_by_staff_profile_id, nwac_decided_at
  FROM iset_review_workflow
 WHERE id IN (11, 26)
 ORDER BY id;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (169, 172, 175, 176)
 ORDER BY id;
