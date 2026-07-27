-- Guarded PROD apply for the complete Solana Henderson Case 41 fiscal-period repair.
-- Run the matching preview first and create an RDS cluster snapshot before this apply.
--
-- This is one transaction for all business-record changes. The audit table DDL is
-- intentionally outside the transaction because MySQL DDL commits implicitly.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prod_solana_case41_repair_audit_20260727 (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  run_id VARCHAR(96) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id VARCHAR(64) NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  captured_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_solana_case41_repair_entity (run_id, entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_solana_case41_fiscal_split_repair_20260727;

DELIMITER //

CREATE PROCEDURE prod_solana_case41_fiscal_split_repair_20260727()
BEGIN
  DECLARE v_run_id VARCHAR(96)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'prod-solana-case41-fiscal-split-20260727';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_update_count INT DEFAULT 0;
  DECLARE v_new_submission_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_new_finance_transaction_id BIGINT UNSIGNED DEFAULT NULL;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM prod_solana_case41_repair_audit_20260727
   WHERE run_id = v_run_id;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_solana_case41_repair_already_recorded';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case c
    JOIN client cl ON cl.id = c.client_id
   WHERE c.id = 41
     AND c.case_number = 'CASE-2026-0000041'
     AND c.client_id = 41
     AND c.assigned_staff_profile_id = 54
     AND cl.first_name = 'Solana'
     AND cl.last_name = 'Henderson'
     AND c.status = 'active'
     AND c.lifecycle_status = 'active'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_case41_identity';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan
   WHERE case_id = 41
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_case41_plan_count';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan
   WHERE id = 23
     AND case_id = 41
     AND status = 'active'
     AND agreement_number = '16535866'
     AND budget_pot = '2000000000086'
     AND funding_stream = 'EI'
     AND EIClaimant = 2
     AND prev_employment = 9
     AND effective_date = '2026-01-05'
     AND result_code IS NULL
     AND result_date IS NULL
     AND archived_at IS NULL
     AND updated_at = '2026-07-23 17:23:34'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_prior_plan';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan
   WHERE id = 143
     AND case_id = 41
     AND status = 'draft'
     AND agreement_number = '16535866'
     AND budget_pot = '2000000000086'
     AND funding_stream = 'EI'
     AND EIClaimant = 1
     AND prev_employment = 9
     AND effective_date = '2026-04-01'
     AND activated_at IS NULL
     AND archived_at IS NULL
     AND updated_at = '2026-07-23 17:30:05'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_renewal_plan';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_intervention
   WHERE case_id = 41
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_case41_intervention_count';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_intervention
   WHERE id = 32
     AND case_id = 41
     AND action_plan_id = 23
     AND status = 'completed'
     AND delivery_status = 'completed'
     AND start_date = '2026-01-05'
     AND end_date = '2026-03-31'
     AND duration_days = 86
     AND intervention_cost = 900.00
     AND budget_amount = 900.00
     AND approved_amount IS NULL
     AND actual_amount = 900.00
     AND outcome_code = 1
     AND reviewed_at = '2026-01-05 00:00:00'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
     AND updated_at = '2026-07-23 17:30:05'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_prior_intervention';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_intervention
   WHERE id = 311
     AND case_id = 41
     AND action_plan_id = 23
     AND status = 'in_progress'
     AND delivery_status = 'in_progress'
     AND start_date = '2026-04-01'
     AND end_date = '2026-06-19'
     AND duration_days = 80
     AND intervention_cost IS NULL
     AND budget_amount IS NULL
     AND approved_amount IS NULL
     AND actual_amount IS NULL
     AND outcome_code IS NULL
     AND reviewed_at = '2026-04-01 00:00:00'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'manual_backload'
     AND updated_at = '2026-07-23 17:30:05'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_renewal_intervention';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE case_id = 41
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_case41_proposal_count';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE id = 69
     AND case_id = 41
     AND action_plan_id = 23
     AND legacy_intervention_id = 32
     AND proposal_kind = 'new'
     AND review_status = 'approved'
     AND proposed_cost = 900.00
     AND updated_at = '2026-07-22 13:30:53'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_prior_proposal';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE id = 382
     AND case_id = 41
     AND action_plan_id = 23
     AND legacy_intervention_id = 311
     AND proposal_kind = 'new'
     AND review_status = 'approved'
     AND proposed_cost = 0.00
     AND updated_at = '2026-07-23 17:20:50'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_renewal_proposal';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_intervention
   WHERE id = 301;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_deleted_revision_intervention';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE id = 363;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_deleted_revision_proposal';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_review_workflow
   WHERE id = 40
     AND workflow_type = 'intervention_revision'
     AND subject_key = 'intervention_revision:proposal:363'
     AND case_id = 41
     AND action_plan_id = 23
     AND proposal_id IS NULL
     AND intervention_id IS NULL
     AND current_stage = 'returned_to_rm'
     AND current_owner_role = 'Regional Manager'
     AND nwac_decision = 'changes_requested'
     AND archived_at IS NULL
     AND updated_at = '2026-07-23 16:35:25'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_orphan_workflow';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE review_workflow_id = 40
   FOR UPDATE;
  IF v_guard_count <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_workflow_event_count';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document
   WHERE id = 7312
     AND case_id = 41
     AND status = 'active'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.intervention_id')) = '301'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.assessment_source')) =
         'intervention_revision_submission'
     AND updated_at = '2026-07-22 13:27:21'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_orphan_document';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM finance_transaction
   WHERE case_id = 41
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_case41_finance_count';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM finance_transaction
   WHERE id = 12
     AND case_id = 41
     AND case_intervention_id = 32
     AND budget_pot_id = 2000000000086
     AND posting_context = 'internal'
     AND gl_project_code_used = 'INT-BC-EI-001'
     AND amount = 900.00
     AND status = 'posted'
     AND transaction_date = '2026-03-31'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.source')) = 'manual_backload_history'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_prior_finance';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM finance_transaction
   WHERE case_intervention_id = 311;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_renewal_finance_exists';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM esdc_participant_submission
   WHERE id = 70
     AND case_id = 41
     AND action_plan_id = 23
     AND application_id IS NULL
     AND readiness_status = 'needs_review'
     AND submission_status = 'pending'
     AND updated_at = '2026-07-23 17:30:05'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_prior_esdc_submission';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM esdc_participant_submission
   WHERE action_plan_id = 143;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_renewal_esdc_submission_exists';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM budget_pot
   WHERE id = 2000000000086
     AND actual_amount = 74543.00
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_bc_ei_pot';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM budget_pot
   WHERE id = 2000000000067
     AND actual_amount = 102052.00
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_bc_program_pot';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM budget_pot
   WHERE id = 2000000000062
     AND actual_amount = 159020.62
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_nwac_program_pot';
  END IF;

  SELECT COUNT(*) INTO v_guard_count FROM payment_packet WHERE case_id = 41 FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_payment_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count FROM iset_case_reminder WHERE case_id = 41 FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_reminder_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document_intervention di
    JOIN iset_case_intervention ci ON ci.id = di.intervention_id
   WHERE ci.case_id = 41
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_document_link_dependency';
  END IF;

  SELECT COUNT(*) INTO v_guard_count FROM iset_application WHERE case_id = 41 FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_solana_application_dependency';
  END IF;

  -- Store compact before snapshots for recovery and review.
  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'case', CAST(id AS CHAR),
         JSON_OBJECT(
           'status', status,
           'lifecycle_status', lifecycle_status,
           'closure_reason', closure_reason,
           'closed_at', closed_at,
           'open_intervention_count', open_intervention_count,
           'total_intervention_count', total_intervention_count,
           'updated_at', updated_at
         )
    FROM iset_case
   WHERE id = 41;

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'action_plan', CAST(id AS CHAR),
         JSON_OBJECT(
           'status', status,
           'agreement_number', agreement_number,
           'budget_pot', budget_pot,
           'funding_stream', funding_stream,
           'EIClaimant', EIClaimant,
           'effective_date', effective_date,
           'activated_at', activated_at,
           'closed_at', closed_at,
           'result_code', result_code,
           'result_date', result_date,
           'outcome_summary', outcome_summary,
           'closure_notes', closure_notes,
           'notes', notes,
           'metadata_json', metadata_json,
           'esdc_action_plan_json', esdc_action_plan_json,
           'updated_at', updated_at
         )
    FROM iset_case_action_plan
   WHERE id IN (23, 143);

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'intervention', CAST(id AS CHAR),
         JSON_OBJECT(
           'action_plan_id', action_plan_id,
           'status', status,
           'delivery_status', delivery_status,
           'start_date', start_date,
           'end_date', end_date,
           'duration_days', duration_days,
           'intervention_cost', intervention_cost,
           'budget_amount', budget_amount,
           'approved_amount', approved_amount,
           'actual_amount', actual_amount,
           'outcome_code', outcome_code,
           'metadata_json', metadata_json,
           'esdc_intervention_json', esdc_intervention_json,
           'reviewed_at', reviewed_at,
           'closed_at', closed_at,
           'updated_at', updated_at
         )
    FROM iset_case_intervention
   WHERE id IN (32, 311);

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'proposal', CAST(id AS CHAR),
         JSON_OBJECT(
           'action_plan_id', action_plan_id,
           'review_status', review_status,
           'start_date', start_date,
           'end_date', end_date,
           'proposed_cost', proposed_cost,
           'payload_json', payload_json,
           'metadata_json', metadata_json,
           'updated_at', updated_at
         )
    FROM iset_intervention_proposal
   WHERE id IN (69, 382);

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'review_workflow', CAST(id AS CHAR),
         JSON_OBJECT(
           'current_stage', current_stage,
           'current_owner_role', current_owner_role,
           'current_owner_staff_profile_id', current_owner_staff_profile_id,
           'metadata_json', metadata_json,
           'archived_at', archived_at,
           'updated_at', updated_at
         )
    FROM iset_review_workflow
   WHERE id = 40;

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'document', CAST(id AS CHAR),
         JSON_OBJECT(
           'status', status,
           'metadata', metadata,
           'updated_at', updated_at
         )
    FROM iset_document
   WHERE id = 7312;

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'esdc_submission', CAST(id AS CHAR),
         JSON_OBJECT(
           'readiness_status', readiness_status,
           'readiness_summary', readiness_summary,
           'warnings', warnings,
           'blocking_issues', blocking_issues,
           'last_validated_at', last_validated_at,
           'submission_status', submission_status,
           'submitted_at', submitted_at,
           'submitted_by_user_id', submitted_by_user_id,
           'payload_snapshot', payload_snapshot,
           'payload_storage_key', payload_storage_key,
           'payload_checksum', payload_checksum,
           'rejection_reason', rejection_reason,
           'updated_at', updated_at
         )
    FROM esdc_participant_submission
   WHERE id = 70;

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  SELECT v_run_id, 'budget_pot', CAST(id AS CHAR),
         JSON_OBJECT('actual_amount', actual_amount, 'updated_at', updated_at)
    FROM budget_pot
   WHERE id IN (2000000000086, 2000000000067, 2000000000062);

  -- Close the January-March plan with Amanda's confirmed Returned to school result.
  UPDATE iset_case_action_plan
     SET status = 'closed',
         activated_at = '2026-01-05 00:00:00',
         closed_at = '2026-03-31 00:00:00',
         result_code = '4',
         result_date = '2026-03-31',
         outcome_summary =
           'Returned to school; training continued under the renewal action plan beginning April 1, 2026.',
         closure_notes =
           'Funding agreement 16535866 was split at fiscal year-end. This plan covers January 5 through March 31, 2026.',
         esdc_action_plan_json = JSON_SET(
           COALESCE(esdc_action_plan_json, JSON_OBJECT()),
           '$.EIClaimant', 2,
           '$.actionPlanResultCode', '4',
           '$.actionPlanResultDate', '2026-03-31',
           '$.actionPlanResultEducationLevel', '8',
           '$.actionPlanFutureEducationLevel', '8',
           '$.actionPlanResultRelatedNOC', NULL,
           '$.actionPlanResultRelatedNOCVersion', NULL
         ),
         updated_at = NOW()
   WHERE id = 23;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_prior_plan';
  END IF;

  -- Activate the already-created April renewal plan and correct EI classification.
  UPDATE iset_case_action_plan
     SET status = 'active',
         EIClaimant = 2,
         activated_at = '2026-04-01 00:00:00',
         closed_at = NULL,
         result_code = NULL,
         result_date = NULL,
         outcome_summary = NULL,
         closure_notes = NULL,
         notes =
           'Client has been approved for tuition, residence fees and living allowance through June 19, 2026.',
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.source', 'manual_backload',
           '$.entryMode', 'existing',
           '$.postingContext', 'internal',
           '$.summary',
             'Client has been approved for tuition, residence fees and living allowance through June 19, 2026.'
         ),
         esdc_action_plan_json = JSON_SET(
           COALESCE(esdc_action_plan_json, JSON_OBJECT()),
           '$.agreementNumber', '16535866',
           '$.budgetPot', 2000000000086,
           '$.fundingStream', 'EI',
           '$.postingContext', 'internal',
           '$.EIClaimant', '2',
           '$.actionPlanResultCode', NULL,
           '$.actionPlanResultDate', NULL,
           '$.actionPlanResultEducationLevel', NULL,
           '$.actionPlanFutureEducationLevel', NULL,
           '$.actionPlanResultRelatedNOC', NULL,
           '$.actionPlanResultRelatedNOCVersion', NULL
         ),
         updated_at = NOW()
   WHERE id = 143;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_renewal_plan';
  END IF;

  -- Remove revision contamination from the January-March intervention while
  -- preserving its authoritative $900 top-level and posted finance history.
  UPDATE iset_case_intervention
     SET metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.cost', 900.00,
           '$.actualAmount', 900.00,
           '$.outcome', '1',
           '$.postingContext', 'internal',
           '$.fundingStream', 'EI',
           '$.costLines', JSON_ARRAY(),
           '$.snapshot.startDate', '2026-01-05',
           '$.snapshot.endDate', '2026-03-31',
           '$.snapshot.costLines', JSON_ARRAY(),
           '$.snapshot.programName', 'Heavy Mechanical Foundation Certificate Program',
           '$.programName', 'Heavy Mechanical Foundation Certificate Program',
           '$.compliance.ilmp', 'pending',
           '$.compliance.finance', 'ok'
         ),
         esdc_intervention_json = JSON_SET(
           COALESCE(esdc_intervention_json, JSON_OBJECT()),
           '$.postingContext', 'internal',
           '$.interventionStartDate', '2026-01-05',
           '$.interventionEndDate', '2026-03-31',
           '$.interventionDuration', 86,
           '$.interventionCost', 900.00,
           '$.interventionOutcome', '1'
         ),
         updated_at = NOW()
   WHERE id = 32;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_prior_intervention';
  END IF;

  UPDATE iset_intervention_proposal p
  JOIN iset_case_intervention ci ON ci.id = 32
     SET p.action_plan_id = 23,
         p.start_date = '2026-01-05',
         p.end_date = '2026-03-31',
         p.proposed_cost = 900.00,
         p.payload_json = JSON_SET(
           COALESCE(p.payload_json, JSON_OBJECT()),
           '$.startDate', '2026-01-05',
           '$.endDate', '2026-03-31',
           '$.proposedCost', 900.00,
           '$.reviewStatus', 'approved',
           '$.legacyStatus', 'completed',
           '$.deliveryStatus', 'completed',
           '$.legacyInterventionId', 32
         ),
         p.metadata_json = ci.metadata_json,
         p.updated_at = NOW()
   WHERE p.id = 69;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_prior_proposal';
  END IF;

  -- Move and complete the April-June intervention under the renewal plan.
  UPDATE iset_case_intervention
     SET action_plan_id = 143,
         status = 'completed',
         delivery_status = 'completed',
         intervention_cost = 3077.21,
         budget_amount = 3077.21,
         approved_amount = NULL,
         actual_amount = 3077.21,
         outcome_code = 1,
         closed_at = '2026-06-19 00:00:00',
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.cost', 3077.21,
           '$.actualAmount', 3077.21,
           '$.outcome', '1',
           '$.postingContext', 'internal',
           '$.fundingStream', 'EI',
           '$.costLines', JSON_ARRAY(
             JSON_OBJECT(
               'id', 'repair-residence-20260401-20260619',
               'type', 'OtherEligibleCost',
               'notes', 'Residence payment: $2,177.21 paid June 9, 2026.',
               'payee', JSON_OBJECT(
                 'name', 'Okanagan College',
                 'type', 'Institution',
                 'reference', '1252629'
               ),
               'amount', 2177.21,
               'recurrence', NULL
             ),
             JSON_OBJECT(
               'id', 'repair-living-allowance-20260401-20260619',
               'type', 'LivingAllowance',
               'notes', 'Monthly living allowance: $300 per month for three months.',
               'payee', JSON_OBJECT(
                 'name', 'Solana Henderson',
                 'type', 'ParticipantClient',
                 'reference', NULL
               ),
               'amount', 900.00,
               'recurrence', JSON_OBJECT(
                 'enabled', TRUE,
                 'startDate', '2026-04-01',
                 'endDate', '2026-06-19',
                 'occurrences', 3,
                 'amountPerPeriod', 300.00
               )
             )
           ),
           '$.snapshot.startDate', '2026-04-01',
           '$.snapshot.endDate', '2026-06-19',
           '$.snapshot.costLines', JSON_ARRAY(
             JSON_OBJECT(
               'id', 'repair-residence-20260401-20260619',
               'type', 'OtherEligibleCost',
               'notes', 'Residence payment: $2,177.21 paid June 9, 2026.',
               'payee', JSON_OBJECT(
                 'name', 'Okanagan College',
                 'type', 'Institution',
                 'reference', '1252629'
               ),
               'amount', 2177.21,
               'recurrence', NULL
             ),
             JSON_OBJECT(
               'id', 'repair-living-allowance-20260401-20260619',
               'type', 'LivingAllowance',
               'notes', 'Monthly living allowance: $300 per month for three months.',
               'payee', JSON_OBJECT(
                 'name', 'Solana Henderson',
                 'type', 'ParticipantClient',
                 'reference', NULL
               ),
               'amount', 900.00,
               'recurrence', JSON_OBJECT(
                 'enabled', TRUE,
                 'startDate', '2026-04-01',
                 'endDate', '2026-06-19',
                 'occurrences', 3,
                 'amountPerPeriod', 300.00
               )
             )
           ),
           '$.snapshot.programName', 'Heavy Mechanical Foundation Certificate Program',
           '$.programName', 'Heavy Mechanical Foundation Certificate Program',
           '$.compliance.ilmp', 'pending',
           '$.compliance.finance', 'ok'
         ),
         esdc_intervention_json = JSON_SET(
           COALESCE(esdc_intervention_json, JSON_OBJECT()),
           '$.postingContext', 'internal',
           '$.interventionStartDate', '2026-04-01',
           '$.interventionEndDate', '2026-06-19',
           '$.interventionDuration', 80,
           '$.interventionCost', 3077.21,
           '$.interventionOutcome', '1'
         ),
         updated_at = NOW()
   WHERE id = 311;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_renewal_intervention';
  END IF;

  UPDATE iset_intervention_proposal p
  JOIN iset_case_intervention ci ON ci.id = 311
     SET p.action_plan_id = 143,
         p.start_date = '2026-04-01',
         p.end_date = '2026-06-19',
         p.proposed_cost = 3077.21,
         p.payload_json = JSON_SET(
           COALESCE(p.payload_json, JSON_OBJECT()),
           '$.startDate', '2026-04-01',
           '$.endDate', '2026-06-19',
           '$.proposedCost', 3077.21,
           '$.reviewStatus', 'approved',
           '$.legacyStatus', 'completed',
           '$.deliveryStatus', 'completed',
           '$.legacyInterventionId', 311
         ),
         p.metadata_json = ci.metadata_json,
         p.updated_at = NOW()
   WHERE p.id = 382;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_renewal_proposal';
  END IF;

  -- Retain the deleted-revision audit trail but remove it from live workflow/document views.
  UPDATE iset_review_workflow
     SET current_stage = 'withdrawn',
         current_owner_role = NULL,
         current_owner_staff_profile_id = NULL,
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.dataRepair.repairId', v_run_id,
           '$.dataRepair.reason',
             'The returned revision was deleted and replaced by a separate historical renewal intervention.',
           '$.dataRepair.repairedAtUtc',
             DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
         ),
         archived_at = NOW(),
         updated_at = NOW()
   WHERE id = 40;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_orphan_workflow';
  END IF;

  INSERT INTO iset_review_workflow_event
    (review_workflow_id, workflow_type, subject_key, action, from_stage, to_stage,
     actor_staff_profile_id, actor_role, note, payload_json, created_at)
  VALUES
    (40, 'intervention_revision', 'intervention_revision:proposal:363',
     'withdraw', 'returned_to_rm', 'withdrawn', NULL, 'data_repair',
     'Archived orphaned returned revision after the separate April-June historical intervention was recorded.',
     JSON_OBJECT(
       'source', 'codex_prod_sql',
       'repairId', v_run_id,
       'replacementActionPlanId', 143,
       'replacementInterventionId', 311
     ),
     NOW());

  UPDATE iset_document
     SET status = 'archived',
         metadata = JSON_SET(
           COALESCE(metadata, JSON_OBJECT()),
           '$.dataRepair.repairId', v_run_id,
           '$.dataRepair.reason',
             'Generated packet belonged to the deleted revision and was superseded by the separate historical renewal intervention.',
           '$.dataRepair.replacementActionPlanId', 143,
           '$.dataRepair.replacementInterventionId', 311,
           '$.dataRepair.archivedAtUtc',
             DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
         ),
         updated_at = NOW()
   WHERE id = 7312;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_orphan_document';
  END IF;

  -- Reset the original plan's ILMP record and create an independent renewal record.
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
   WHERE id = 70;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_prior_esdc_submission';
  END IF;

  INSERT INTO esdc_participant_submission
    (case_id, action_plan_id, application_id, readiness_status, readiness_summary,
     warnings, blocking_issues, last_validated_at, submission_status, submitted_at,
     submitted_by_user_id, payload_snapshot, payload_storage_key, payload_checksum,
     rejection_reason)
  VALUES
    (41, 143, NULL, 'needs_review', NULL, NULL, NULL, NULL, 'pending', NULL,
     NULL, NULL, NULL, NULL, NULL);
  SET v_new_submission_id = LAST_INSERT_ID();

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  VALUES
    (v_run_id, 'created_esdc_submission', CAST(v_new_submission_id AS CHAR), NULL);

  -- Record the verified historical actual against the same approved BC EI pot.
  INSERT INTO finance_transaction
    (case_id, case_intervention_id, budget_pot_id, posting_context,
     gl_project_code_used, amount, currency, status, transaction_date, posted_at,
     description, evidence_ref, metadata, created_by_user_id, created_at, updated_at)
  VALUES
    (41, 311, 2000000000086, 'internal', 'INT-BC-EI-001', 3077.21, 'CAD',
     'posted', '2026-06-19', NOW(),
     'Occupational skills training – diploma', NULL,
     JSON_OBJECT(
       'source', 'manual_backload_history',
       'workflow', 'historical_only',
       'entryMode', 'existing',
       'historical', JSON_OBJECT(
         'endDate', '2026-06-19',
         'startDate', '2026-04-01',
         'actualAmount', 3077.21,
         'interventionId', '311',
         'interventionStatus', 'completed'
       ),
       'fundingStream', 'EI',
       'reportingUnit', 'BC',
       'backloadSource', 'manual_backload',
       'interventionTitle', 'Occupational skills training – diploma',
       'liveWorkflowEligible', FALSE,
       'repairId', v_run_id
     ),
     104, NOW(), NOW());
  SET v_new_finance_transaction_id = LAST_INSERT_ID();

  INSERT INTO prod_solana_case41_repair_audit_20260727
    (run_id, entity_type, entity_id, before_json)
  VALUES
    (v_run_id, 'created_finance_transaction',
     CAST(v_new_finance_transaction_id AS CHAR), NULL);

  UPDATE budget_pot
     SET actual_amount = 77620.21,
         updated_at = NOW()
   WHERE id = 2000000000086;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_bc_ei_pot';
  END IF;

  UPDATE budget_pot
     SET actual_amount = 105129.21,
         updated_at = NOW()
   WHERE id = 2000000000067;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_bc_program_pot';
  END IF;

  UPDATE budget_pot
     SET actual_amount = 162097.83,
         updated_at = NOW()
   WHERE id = 2000000000062;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_nwac_program_pot';
  END IF;

  UPDATE iset_case c
     SET status = 'active',
         lifecycle_status = 'active',
         closure_reason = NULL,
         closed_at = NULL,
         open_intervention_count = (
           SELECT COUNT(*)
             FROM iset_case_intervention ci
            WHERE ci.case_id = c.id
              AND (
                LOWER(TRIM(COALESCE(ci.delivery_status, ''))) IN
                  ('planned', 'in_progress', 'suspended')
                OR (
                  LOWER(TRIM(COALESCE(ci.delivery_status, ''))) = ''
                  AND LOWER(TRIM(COALESCE(ci.status, ''))) IN
                    ('approved', 'in_progress', 'suspended')
                )
              )
         ),
         total_intervention_count = (
           SELECT COUNT(*)
             FROM iset_case_intervention ci
            WHERE ci.case_id = c.id
              AND (
                LOWER(TRIM(COALESCE(ci.delivery_status, ''))) IN
                  ('planned', 'in_progress', 'suspended', 'completed', 'cancelled')
                OR (
                  LOWER(TRIM(COALESCE(ci.delivery_status, ''))) = ''
                  AND LOWER(TRIM(COALESCE(ci.status, ''))) IN
                    ('approved', 'in_progress', 'suspended', 'completed', 'cancelled')
                )
              )
         ),
         updated_at = NOW()
   WHERE c.id = 41;
  SET v_update_count = ROW_COUNT();
  IF v_update_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'update_failed_solana_case_rollup';
  END IF;

  INSERT INTO iset_case_event
    (case_id, event_type, summary, payload_json, occurred_at,
     actor_staff_profile_id, actor_user_id, source_system)
  VALUES
    (41, 'data_repair',
     'Repaired fiscal-year action-plan and intervention split.',
     JSON_OBJECT(
       'repairId', v_run_id,
       'agreementNumber', '16535866',
       'priorPeriod', JSON_OBJECT(
         'actionPlanId', 23,
         'interventionId', 32,
         'startDate', '2026-01-05',
         'endDate', '2026-03-31',
         'actionPlanResultCode', '4',
         'actionPlanResultLabel', 'Returned to school',
         'actualAmount', 900.00
       ),
       'renewalPeriod', JSON_OBJECT(
         'actionPlanId', 143,
         'interventionId', 311,
         'startDate', '2026-04-01',
         'endDate', '2026-06-19',
         'eiClaimantCode', '2',
         'eiClaimantLabel', 'EI Reach Back',
         'interventionOutcomeCode', '1',
         'interventionOutcomeLabel', 'Complete',
         'actualAmount', 3077.21,
         'financeTransactionId', v_new_finance_transaction_id,
         'esdcSubmissionId', v_new_submission_id
       ),
       'retiredRevision', JSON_OBJECT(
         'deletedInterventionId', 301,
         'deletedProposalId', 363,
         'archivedReviewWorkflowId', 40,
         'archivedDocumentId', 7312
       ),
       'reason',
         'The historical funding agreement crosses fiscal year-end and must be represented as two linked plan/intervention periods.'
     ),
     NOW(3), NULL, NULL, 'codex_prod_sql');

  -- Capture compact after snapshots for the same recovery inventory.
  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_case c ON a.entity_type = 'case'
                  AND a.entity_id = CAST(c.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'status', c.status,
       'lifecycle_status', c.lifecycle_status,
       'closure_reason', c.closure_reason,
       'closed_at', c.closed_at,
       'open_intervention_count', c.open_intervention_count,
       'total_intervention_count', c.total_intervention_count,
       'updated_at', c.updated_at
     )
   WHERE a.run_id = v_run_id
     AND c.id = 41;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_case_action_plan ap ON a.entity_type = 'action_plan'
                               AND a.entity_id = CAST(ap.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'status', ap.status,
       'agreement_number', ap.agreement_number,
       'budget_pot', ap.budget_pot,
       'funding_stream', ap.funding_stream,
       'EIClaimant', ap.EIClaimant,
       'effective_date', ap.effective_date,
       'activated_at', ap.activated_at,
       'closed_at', ap.closed_at,
       'result_code', ap.result_code,
       'result_date', ap.result_date,
       'outcome_summary', ap.outcome_summary,
       'closure_notes', ap.closure_notes,
       'notes', ap.notes,
       'metadata_json', ap.metadata_json,
       'esdc_action_plan_json', ap.esdc_action_plan_json,
       'updated_at', ap.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_case_intervention ci ON a.entity_type = 'intervention'
                                AND a.entity_id = CAST(ci.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'action_plan_id', ci.action_plan_id,
       'status', ci.status,
       'delivery_status', ci.delivery_status,
       'start_date', ci.start_date,
       'end_date', ci.end_date,
       'duration_days', ci.duration_days,
       'intervention_cost', ci.intervention_cost,
       'budget_amount', ci.budget_amount,
       'approved_amount', ci.approved_amount,
       'actual_amount', ci.actual_amount,
       'outcome_code', ci.outcome_code,
       'metadata_json', ci.metadata_json,
       'esdc_intervention_json', ci.esdc_intervention_json,
       'reviewed_at', ci.reviewed_at,
       'closed_at', ci.closed_at,
       'updated_at', ci.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_intervention_proposal p ON a.entity_type = 'proposal'
                                   AND a.entity_id = CAST(p.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'action_plan_id', p.action_plan_id,
       'review_status', p.review_status,
       'start_date', p.start_date,
       'end_date', p.end_date,
       'proposed_cost', p.proposed_cost,
       'payload_json', p.payload_json,
       'metadata_json', p.metadata_json,
       'updated_at', p.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_review_workflow rw ON a.entity_type = 'review_workflow'
                              AND a.entity_id = CAST(rw.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'current_stage', rw.current_stage,
       'current_owner_role', rw.current_owner_role,
       'current_owner_staff_profile_id', rw.current_owner_staff_profile_id,
       'metadata_json', rw.metadata_json,
       'archived_at', rw.archived_at,
       'updated_at', rw.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN iset_document d ON a.entity_type = 'document'
                      AND a.entity_id = CAST(d.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'status', d.status,
       'metadata', d.metadata,
       'updated_at', d.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN esdc_participant_submission eps ON a.entity_type = 'esdc_submission'
                                      AND a.entity_id = CAST(eps.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'readiness_status', eps.readiness_status,
       'readiness_summary', eps.readiness_summary,
       'warnings', eps.warnings,
       'blocking_issues', eps.blocking_issues,
       'last_validated_at', eps.last_validated_at,
       'submission_status', eps.submission_status,
       'submitted_at', eps.submitted_at,
       'submitted_by_user_id', eps.submitted_by_user_id,
       'payload_snapshot', eps.payload_snapshot,
       'payload_storage_key', eps.payload_storage_key,
       'payload_checksum', eps.payload_checksum,
       'rejection_reason', eps.rejection_reason,
       'updated_at', eps.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727 a
  JOIN budget_pot bp ON a.entity_type = 'budget_pot'
                    AND a.entity_id = CAST(bp.id AS CHAR)
     SET a.after_json = JSON_OBJECT(
       'actual_amount', bp.actual_amount,
       'updated_at', bp.updated_at
     )
   WHERE a.run_id = v_run_id;

  UPDATE prod_solana_case41_repair_audit_20260727
     SET after_json = JSON_OBJECT(
       'id', v_new_submission_id,
       'case_id', 41,
       'action_plan_id', 143,
       'readiness_status', 'needs_review',
       'submission_status', 'pending'
     )
   WHERE run_id = v_run_id
     AND entity_type = 'created_esdc_submission'
     AND entity_id = CAST(v_new_submission_id AS CHAR);

  UPDATE prod_solana_case41_repair_audit_20260727
     SET after_json = JSON_OBJECT(
       'id', v_new_finance_transaction_id,
       'case_id', 41,
       'case_intervention_id', 311,
       'budget_pot_id', 2000000000086,
       'amount', 3077.21,
       'status', 'posted'
     )
   WHERE run_id = v_run_id
     AND entity_type = 'created_finance_transaction'
     AND entity_id = CAST(v_new_finance_transaction_id AS CHAR);

  COMMIT;

  SELECT
    v_run_id AS repair_id,
    v_new_submission_id AS created_esdc_submission_id,
    v_new_finance_transaction_id AS created_finance_transaction_id;
END//

DELIMITER ;

CALL prod_solana_case41_fiscal_split_repair_20260727();

DROP PROCEDURE IF EXISTS prod_solana_case41_fiscal_split_repair_20260727;

-- Immediate postflight.
SELECT
  ap.id AS action_plan_id,
  ap.status,
  ap.agreement_number,
  ap.budget_pot,
  ap.funding_stream,
  ap.EIClaimant,
  ap.effective_date,
  ap.activated_at,
  ap.closed_at,
  ap.result_code,
  ap.result_date,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel'))
    AS result_education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanFutureEducationLevel'))
    AS future_education_level
FROM iset_case_action_plan ap
WHERE ap.case_id = 41
ORDER BY ap.effective_date, ap.id;

SELECT
  ci.id AS intervention_id,
  ci.action_plan_id,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.intervention_cost,
  ci.budget_amount,
  ci.approved_amount,
  ci.actual_amount,
  ci.outcome_code,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.postingContext')) AS posting_context,
  JSON_LENGTH(COALESCE(JSON_EXTRACT(ci.metadata_json, '$.costLines'), JSON_ARRAY()))
    AS cost_line_count
FROM iset_case_intervention ci
WHERE ci.case_id = 41
ORDER BY ci.start_date, ci.id;

SELECT
  ft.id,
  ft.case_intervention_id,
  ft.budget_pot_id,
  ft.posting_context,
  ft.gl_project_code_used,
  ft.amount,
  ft.status,
  ft.transaction_date,
  JSON_UNQUOTE(JSON_EXTRACT(ft.metadata, '$.source')) AS source
FROM finance_transaction ft
WHERE ft.case_id = 41
ORDER BY ft.id;

SELECT
  eps.id,
  eps.action_plan_id,
  eps.readiness_status,
  eps.submission_status
FROM esdc_participant_submission eps
WHERE eps.case_id = 41
ORDER BY eps.action_plan_id, eps.id;

SELECT
  rw.id,
  rw.current_stage,
  rw.current_owner_role,
  rw.proposal_id,
  rw.intervention_id,
  rw.archived_at,
  d.id AS document_id,
  d.status AS document_status
FROM iset_review_workflow rw
JOIN iset_document d ON d.id = 7312
WHERE rw.id = 40;

SELECT
  c.id,
  c.status,
  c.lifecycle_status,
  c.open_intervention_count,
  c.total_intervention_count
FROM iset_case c
WHERE c.id = 41;

SELECT
  CASE WHEN
    (SELECT COUNT(*)
       FROM iset_case_action_plan
      WHERE id = 23
        AND status = 'closed'
        AND result_code = '4'
        AND result_date = '2026-03-31'
        AND JSON_UNQUOTE(JSON_EXTRACT(
              esdc_action_plan_json, '$.actionPlanResultEducationLevel')) = '8'
        AND JSON_UNQUOTE(JSON_EXTRACT(
              esdc_action_plan_json, '$.actionPlanFutureEducationLevel')) = '8') = 1
    AND (SELECT COUNT(*)
           FROM iset_case_action_plan
          WHERE id = 143
            AND status = 'active'
            AND EIClaimant = 2
            AND effective_date = '2026-04-01') = 1
    AND (SELECT COUNT(*)
           FROM iset_case_intervention
          WHERE id = 32
            AND action_plan_id = 23
            AND status = 'completed'
            AND delivery_status = 'completed'
            AND actual_amount = 900.00
            AND outcome_code = 1) = 1
    AND (SELECT COUNT(*)
           FROM iset_case_intervention
          WHERE id = 311
            AND action_plan_id = 143
            AND status = 'completed'
            AND delivery_status = 'completed'
            AND intervention_cost = 3077.21
            AND budget_amount = 3077.21
            AND actual_amount = 3077.21
            AND outcome_code = 1
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.postingContext')) =
                'internal'
            AND JSON_LENGTH(JSON_EXTRACT(metadata_json, '$.costLines')) = 2) = 1
    AND (SELECT COUNT(*)
           FROM iset_intervention_proposal
          WHERE id = 382
            AND action_plan_id = 143
            AND proposed_cost = 3077.21
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.legacyStatus')) =
                'completed'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.deliveryStatus')) =
                'completed') = 1
    AND (SELECT COUNT(*)
           FROM finance_transaction
          WHERE case_id = 41
            AND case_intervention_id = 311
            AND budget_pot_id = 2000000000086
            AND posting_context = 'internal'
            AND amount = 3077.21
            AND status = 'posted'
            AND transaction_date = '2026-06-19'
            AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.source')) =
                'manual_backload_history') = 1
    AND (SELECT COUNT(*)
           FROM esdc_participant_submission
          WHERE case_id = 41
            AND action_plan_id IN (23, 143)
            AND readiness_status = 'needs_review'
            AND submission_status = 'pending') = 2
    AND (SELECT COUNT(*)
           FROM iset_review_workflow
          WHERE id = 40
            AND current_stage = 'withdrawn'
            AND current_owner_role IS NULL
            AND archived_at IS NOT NULL) = 1
    AND (SELECT COUNT(*)
           FROM iset_document
          WHERE id = 7312
            AND status = 'archived') = 1
    AND (SELECT COUNT(*)
           FROM budget_pot
          WHERE id = 2000000000086
            AND actual_amount = 77620.21) = 1
    AND (SELECT COUNT(*)
           FROM budget_pot
          WHERE id = 2000000000067
            AND actual_amount = 105129.21) = 1
    AND (SELECT COUNT(*)
           FROM budget_pot
          WHERE id = 2000000000062
            AND actual_amount = 162097.83) = 1
    AND (SELECT COUNT(*)
           FROM iset_case
          WHERE id = 41
            AND status = 'active'
            AND lifecycle_status = 'active'
            AND open_intervention_count = 0
            AND total_intervention_count = 2) = 1
  THEN 'PASS'
  ELSE 'FAIL'
  END AS repair_postflight;
