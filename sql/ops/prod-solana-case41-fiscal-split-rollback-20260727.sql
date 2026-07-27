-- Emergency rollback for prod-solana-case41-fiscal-split-20260727.
-- Use only if the matching apply committed and postflight identified a defect.
-- The guarded rollback restores compact before snapshots, removes only the two
-- rows created by the repair, and removes the two repair audit events.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_solana_case41_fiscal_split_rollback_20260727;

DELIMITER //

CREATE PROCEDURE prod_solana_case41_fiscal_split_rollback_20260727()
BEGIN
  DECLARE v_run_id VARCHAR(96)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'prod-solana-case41-fiscal-split-20260727';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_created_submission_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_created_finance_id BIGINT UNSIGNED DEFAULT NULL;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM prod_solana_case41_repair_audit_20260727
   WHERE run_id = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 15 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_solana_audit_inventory';
  END IF;

  SELECT CAST(entity_id AS UNSIGNED)
    INTO v_created_submission_id
    FROM prod_solana_case41_repair_audit_20260727
   WHERE run_id = v_run_id
     AND entity_type = 'created_esdc_submission'
   LIMIT 1;

  SELECT CAST(entity_id AS UNSIGNED)
    INTO v_created_finance_id
    FROM prod_solana_case41_repair_audit_20260727
   WHERE run_id = v_run_id
     AND entity_type = 'created_finance_transaction'
   LIMIT 1;

  SELECT COUNT(*) INTO v_guard_count
    FROM finance_transaction
   WHERE id = v_created_finance_id
     AND case_id = 41
     AND case_intervention_id = 311
     AND amount = 3077.21
     AND status = 'posted'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.repairId')) = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_solana_created_finance';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM esdc_participant_submission
   WHERE id = v_created_submission_id
     AND case_id = 41
     AND action_plan_id = 143
     AND readiness_status = 'needs_review'
     AND submission_status = 'pending'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_solana_created_submission';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_event
   WHERE case_id = 41
     AND event_type = 'data_repair'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_solana_case_event';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_review_workflow_event
   WHERE review_workflow_id = 40
     AND action = 'withdraw'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_solana_workflow_event';
  END IF;

  DELETE FROM finance_transaction
   WHERE id = v_created_finance_id
     AND case_id = 41
     AND case_intervention_id = 311;

  DELETE FROM esdc_participant_submission
   WHERE id = v_created_submission_id
     AND case_id = 41
     AND action_plan_id = 143;

  DELETE FROM iset_review_workflow_event
   WHERE review_workflow_id = 40
     AND action = 'withdraw'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id;

  DELETE FROM iset_case_event
   WHERE case_id = 41
     AND event_type = 'data_repair'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id;

  UPDATE iset_case c
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'case'
   AND a.entity_id = CAST(c.id AS CHAR)
     SET c.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         c.lifecycle_status =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.lifecycle_status')), 'null'),
         c.closure_reason =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closure_reason')), 'null'),
         c.closed_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closed_at')), 'null'),
         c.open_intervention_count =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.open_intervention_count')) AS UNSIGNED),
         c.total_intervention_count =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.total_intervention_count')) AS UNSIGNED),
         c.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE c.id = 41;

  UPDATE iset_case_action_plan ap
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'action_plan'
   AND a.entity_id = CAST(ap.id AS CHAR)
     SET ap.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         ap.agreement_number =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.agreement_number')), 'null'),
         ap.budget_pot =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.budget_pot')), 'null'),
         ap.funding_stream =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.funding_stream')), 'null'),
         ap.EIClaimant =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.EIClaimant')), 'null') AS UNSIGNED),
         ap.effective_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.effective_date')), 'null'),
         ap.activated_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.activated_at')), 'null'),
         ap.closed_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closed_at')), 'null'),
         ap.result_code =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.result_code')), 'null'),
         ap.result_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.result_date')), 'null'),
         ap.outcome_summary =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.outcome_summary')), 'null'),
         ap.closure_notes =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closure_notes')), 'null'),
         ap.notes =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.notes')), 'null'),
         ap.metadata_json = JSON_EXTRACT(a.before_json, '$.metadata_json'),
         ap.esdc_action_plan_json = JSON_EXTRACT(a.before_json, '$.esdc_action_plan_json'),
         ap.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE ap.id IN (23, 143);

  UPDATE iset_case_intervention ci
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'intervention'
   AND a.entity_id = CAST(ci.id AS CHAR)
     SET ci.action_plan_id =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.action_plan_id')) AS UNSIGNED),
         ci.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         ci.delivery_status =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.delivery_status')), 'null'),
         ci.start_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.start_date')), 'null'),
         ci.end_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.end_date')), 'null'),
         ci.duration_days =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.duration_days')), 'null') AS SIGNED),
         ci.intervention_cost =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.intervention_cost')), 'null') AS DECIMAL(14,2)),
         ci.budget_amount =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.budget_amount')), 'null') AS DECIMAL(14,2)),
         ci.approved_amount =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.approved_amount')), 'null') AS DECIMAL(14,2)),
         ci.actual_amount =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.actual_amount')), 'null') AS DECIMAL(14,2)),
         ci.outcome_code =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.outcome_code')), 'null') AS UNSIGNED),
         ci.metadata_json = JSON_EXTRACT(a.before_json, '$.metadata_json'),
         ci.esdc_intervention_json = JSON_EXTRACT(a.before_json, '$.esdc_intervention_json'),
         ci.reviewed_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.reviewed_at')), 'null'),
         ci.closed_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closed_at')), 'null'),
         ci.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE ci.id IN (32, 311);

  UPDATE iset_intervention_proposal p
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'proposal'
   AND a.entity_id = CAST(p.id AS CHAR)
     SET p.action_plan_id =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.action_plan_id')) AS UNSIGNED),
         p.review_status =
           JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.review_status')),
         p.start_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.start_date')), 'null'),
         p.end_date =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.end_date')), 'null'),
         p.proposed_cost =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.proposed_cost')), 'null') AS DECIMAL(14,2)),
         p.payload_json = JSON_EXTRACT(a.before_json, '$.payload_json'),
         p.metadata_json = JSON_EXTRACT(a.before_json, '$.metadata_json'),
         p.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE p.id IN (69, 382);

  UPDATE iset_review_workflow rw
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'review_workflow'
   AND a.entity_id = CAST(rw.id AS CHAR)
     SET rw.current_stage =
           JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.current_stage')),
         rw.current_owner_role =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.current_owner_role')), 'null'),
         rw.current_owner_staff_profile_id =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(
             a.before_json, '$.current_owner_staff_profile_id')), 'null') AS UNSIGNED),
         rw.metadata_json = JSON_EXTRACT(a.before_json, '$.metadata_json'),
         rw.archived_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.archived_at')), 'null'),
         rw.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE rw.id = 40;

  UPDATE iset_document d
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'document'
   AND a.entity_id = CAST(d.id AS CHAR)
     SET d.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         d.metadata = JSON_EXTRACT(a.before_json, '$.metadata'),
         d.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE d.id = 7312;

  UPDATE esdc_participant_submission eps
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'esdc_submission'
   AND a.entity_id = CAST(eps.id AS CHAR)
     SET eps.readiness_status =
           JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.readiness_status')),
         eps.readiness_summary = JSON_EXTRACT(a.before_json, '$.readiness_summary'),
         eps.warnings = JSON_EXTRACT(a.before_json, '$.warnings'),
         eps.blocking_issues = JSON_EXTRACT(a.before_json, '$.blocking_issues'),
         eps.last_validated_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.last_validated_at')), 'null'),
         eps.submission_status =
           JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.submission_status')),
         eps.submitted_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.submitted_at')), 'null'),
         eps.submitted_by_user_id =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(
             a.before_json, '$.submitted_by_user_id')), 'null') AS SIGNED),
         eps.payload_snapshot = JSON_EXTRACT(a.before_json, '$.payload_snapshot'),
         eps.payload_storage_key =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.payload_storage_key')), 'null'),
         eps.payload_checksum =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.payload_checksum')), 'null'),
         eps.rejection_reason =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.rejection_reason')), 'null'),
         eps.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE eps.id = 70;

  UPDATE budget_pot bp
  JOIN prod_solana_case41_repair_audit_20260727 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'budget_pot'
   AND a.entity_id = CAST(bp.id AS CHAR)
     SET bp.actual_amount =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.actual_amount')) AS DECIMAL(14,2)),
         bp.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE bp.id IN (2000000000086, 2000000000067, 2000000000062);

  COMMIT;

  SELECT
    v_run_id AS rolled_back_repair_id,
    v_created_submission_id AS deleted_esdc_submission_id,
    v_created_finance_id AS deleted_finance_transaction_id;
END//

DELIMITER ;

CALL prod_solana_case41_fiscal_split_rollback_20260727();

DROP PROCEDURE IF EXISTS prod_solana_case41_fiscal_split_rollback_20260727;
