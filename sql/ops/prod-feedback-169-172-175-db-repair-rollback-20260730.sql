-- Emergency rollback for prod-feedback-169-172-175-db-repair-20260730.
-- Use only if the matching apply committed and independent verification found
-- a defect. This restores exact before snapshots captured by the apply.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_feedback_169_172_175_db_rollback_20260730;

DELIMITER //

CREATE PROCEDURE prod_feedback_169_172_175_db_rollback_20260730()
BEGIN
  DECLARE v_run_id VARCHAR(96)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'prod-feedback-169-172-175-db-repair-20260730';
  DECLARE v_guard_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM prod_feedback_169_172_175_repair_audit_20260730
   WHERE run_id = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 22 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_audit_inventory';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE (id = 27 AND case_id = 109 AND status = 'pending_approval'
          AND lifecycle_status = 'pending_decision' AND decision_outcome IS NULL
          AND row_version = 74)
      OR (id = 90 AND case_id = 160 AND status = 'pending_approval'
          AND lifecycle_status = 'pending_decision' AND decision_outcome IS NULL
          AND row_version = 41)
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_application_state';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE id IN (11, 26)
     AND current_stage = 'returned_to_rm'
     AND current_owner_role = 'Regional Manager'
     AND nwac_decision = 'changes_requested'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.dataRepair.repairId')) = v_run_id
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_workflow_state';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM admin_feedback_report
   WHERE id IN (169, 172, 175, 176)
     AND status = 'closed'
   FOR UPDATE;
  IF v_guard_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_feedback_state';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_action_plan
   WHERE id IN (145, 147);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_deleted_plan_ids_reused';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_intervention
   WHERE id IN (314, 315, 316, 319, 320);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_deleted_intervention_ids_reused';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM esdc_participant_submission
   WHERE id IN (390, 406);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_deleted_esdc_ids_reused';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_intervention_proposal
   WHERE id = 389;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_guard_failed_deleted_proposal_id_reused';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE report_id IN (169, 172, 175, 176)
     AND author_name = 'Codex'
     AND author_email = 'codex@openai.com'
     AND note_text LIKE CONCAT('[', v_run_id, ']%');

  DELETE FROM admin_feedback_status_history
   WHERE report_id IN (169, 172, 175)
     AND previous_status = 'triaging'
     AND new_status = 'closed'
     AND changed_by_name = 'Codex'
     AND changed_by_email = 'codex@openai.com';

  DELETE FROM iset_review_workflow_event
   WHERE review_workflow_id IN (11, 26)
     AND action = 'nwac_request_changes'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id;
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_delete_failed_workflow_events';
  END IF;

  DELETE FROM iset_case_event
   WHERE case_id IN (30, 109, 160)
     AND event_type = 'data_repair'
     AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.repairId')) = v_run_id;
  IF ROW_COUNT() <> 3 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_delete_failed_case_events';
  END IF;

  -- Restore the deleted denial-only plans first so their child rows can be
  -- restored with the original foreign keys.
  INSERT INTO iset_case_action_plan
    (id, case_id, application_id, name, status, agreement_number, budget_pot,
     funding_stream, version, owner_staff_profile_id, owner_user_id,
     effective_date, review_date, activated_at, closed_at, result_code,
     EIClaimant, prev_employment, result_date, outcome_summary, closure_notes,
     notes, metadata_json, esdc_action_plan_json, created_at, updated_at, archived_at)
  SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.id')) AS UNSIGNED),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.case_id')) AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.application_id')), 'null') AS UNSIGNED),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.name')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.status')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.agreement_number')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.budget_pot')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.funding_stream')), 'null'),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.version')) AS SIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.owner_staff_profile_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.owner_user_id')), 'null') AS SIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.effective_date')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.review_date')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.activated_at')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.closed_at')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.result_code')), 'null'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.EIClaimant')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.prev_employment')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.result_date')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.outcome_summary')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.closure_notes')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.notes')), 'null'),
    JSON_EXTRACT(before_json, '$.metadata_json'),
    JSON_EXTRACT(before_json, '$.esdc_action_plan_json'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.created_at')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.updated_at')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.archived_at')), 'null')
  FROM prod_feedback_169_172_175_repair_audit_20260730
  WHERE run_id = v_run_id
    AND entity_type = 'action_plan'
    AND entity_id IN ('145', '147')
  ORDER BY CAST(entity_id AS UNSIGNED);
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_insert_failed_action_plans';
  END IF;

  INSERT INTO iset_case_intervention
    (id, case_id, action_plan_id, intervention_code, related_noc_version,
     related_noc, status, delivery_status, start_date, end_date, duration_days,
     intervention_cost, budget_amount, approved_amount, actual_amount,
     outcome_code, notes, metadata_json, esdc_intervention_json,
     created_by_staff_profile_id, reviewed_by_staff_profile_id, reviewed_at,
     review_notes, eligibility_result, funding_stream_decision,
     required_docs_flags, created_at, updated_at, closed_at)
  SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.id')) AS UNSIGNED),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.case_id')) AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.action_plan_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.intervention_code')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.related_noc_version')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.related_noc')), 'null'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.status')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.delivery_status')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.start_date')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.end_date')), 'null'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.duration_days')), 'null') AS SIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.intervention_cost')), 'null') AS DECIMAL(14,2)),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.budget_amount')), 'null') AS DECIMAL(14,2)),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.approved_amount')), 'null') AS DECIMAL(14,2)),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.actual_amount')), 'null') AS DECIMAL(14,2)),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.outcome_code')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.notes')), 'null'),
    JSON_EXTRACT(before_json, '$.metadata_json'),
    JSON_EXTRACT(before_json, '$.esdc_intervention_json'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.created_by_staff_profile_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.reviewed_by_staff_profile_id')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.reviewed_at')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.review_notes')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.eligibility_result')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.funding_stream_decision')), 'null'),
    JSON_EXTRACT(before_json, '$.required_docs_flags'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.created_at')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.updated_at')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.closed_at')), 'null')
  FROM prod_feedback_169_172_175_repair_audit_20260730
  WHERE run_id = v_run_id
    AND entity_type = 'intervention'
    AND entity_id IN ('314', '315', '316', '319', '320')
  ORDER BY CAST(entity_id AS UNSIGNED);
  IF ROW_COUNT() <> 5 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_insert_failed_interventions';
  END IF;

  INSERT INTO iset_intervention_proposal
    (id, case_id, action_plan_id, application_id, legacy_intervention_id,
     source_intervention_id, proposal_kind, review_status, title,
     intervention_code, start_date, end_date, proposed_cost, decision_reason,
     decision_notes, payload_json, metadata_json, submitted_by_staff_profile_id,
     reviewed_by_staff_profile_id, submitted_at, reviewed_at, created_at,
     updated_at, archived_at)
  SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.id')) AS UNSIGNED),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.case_id')) AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.action_plan_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.application_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.legacy_intervention_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.source_intervention_id')), 'null') AS UNSIGNED),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.proposal_kind')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.review_status')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.title')), 'null'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.intervention_code')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.start_date')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.end_date')), 'null'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.proposed_cost')), 'null') AS DECIMAL(14,2)),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.decision_reason')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.decision_notes')), 'null'),
    JSON_EXTRACT(before_json, '$.payload_json'),
    JSON_EXTRACT(before_json, '$.metadata_json'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.submitted_by_staff_profile_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.reviewed_by_staff_profile_id')), 'null') AS UNSIGNED),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.submitted_at')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.reviewed_at')), 'null'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.created_at')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.updated_at')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.archived_at')), 'null')
  FROM prod_feedback_169_172_175_repair_audit_20260730
  WHERE run_id = v_run_id
    AND entity_type = 'intervention_proposal'
    AND entity_id = '389';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_insert_failed_proposal';
  END IF;

  INSERT INTO esdc_participant_submission
    (id, case_id, action_plan_id, application_id, readiness_status,
     readiness_summary, warnings, blocking_issues, last_validated_at,
     submission_status, submitted_at, submitted_by_user_id, payload_snapshot,
     payload_storage_key, payload_checksum, rejection_reason, created_at, updated_at)
  SELECT
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.id')) AS UNSIGNED),
    CAST(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.case_id')) AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.action_plan_id')), 'null') AS UNSIGNED),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.application_id')), 'null') AS UNSIGNED),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.readiness_status')),
    JSON_EXTRACT(before_json, '$.readiness_summary'),
    JSON_EXTRACT(before_json, '$.warnings'),
    JSON_EXTRACT(before_json, '$.blocking_issues'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.last_validated_at')), 'null'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.submission_status')),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.submitted_at')), 'null'),
    CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.submitted_by_user_id')), 'null') AS SIGNED),
    JSON_EXTRACT(before_json, '$.payload_snapshot'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.payload_storage_key')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.payload_checksum')), 'null'),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.rejection_reason')), 'null'),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.created_at')),
    JSON_UNQUOTE(JSON_EXTRACT(before_json, '$.updated_at'))
  FROM prod_feedback_169_172_175_repair_audit_20260730
  WHERE run_id = v_run_id
    AND entity_type = 'esdc_submission'
    AND entity_id IN ('390', '406')
  ORDER BY CAST(entity_id AS UNSIGNED);
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rollback_insert_failed_esdc_rows';
  END IF;

  UPDATE iset_case c
  JOIN prod_feedback_169_172_175_repair_audit_20260730 a
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
         c.case_context_json = JSON_EXTRACT(a.before_json, '$.case_context_json'),
         c.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE c.id IN (30, 109, 160);

  UPDATE iset_application app
  JOIN prod_feedback_169_172_175_repair_audit_20260730 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'application'
   AND a.entity_id = CAST(app.id AS CHAR)
     SET app.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         app.lifecycle_status =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.lifecycle_status')), 'null'),
         app.decision_outcome =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.decision_outcome')), 'null'),
         app.awaiting_reason =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.awaiting_reason')), 'null'),
         app.closure_reason =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.closure_reason')), 'null'),
         app.row_version =
           CAST(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.row_version')) AS UNSIGNED),
         app.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE app.id IN (27, 90);

  UPDATE iset_review_workflow rw
  JOIN prod_feedback_169_172_175_repair_audit_20260730 a
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
         rw.nwac_decided_by_staff_profile_id =
           CAST(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(
             a.before_json, '$.nwac_decided_by_staff_profile_id')), 'null') AS UNSIGNED),
         rw.nwac_decided_at =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.nwac_decided_at')), 'null'),
         rw.nwac_decision =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.nwac_decision')), 'null'),
         rw.nwac_decision_note =
           NULLIF(JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.nwac_decision_note')), 'null'),
         rw.metadata_json = JSON_EXTRACT(a.before_json, '$.metadata_json'),
         rw.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE rw.id IN (11, 26);

  UPDATE iset_case_action_plan ap
  JOIN prod_feedback_169_172_175_repair_audit_20260730 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'action_plan'
   AND a.entity_id = '146'
   AND ap.id = 146
     SET ap.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'));

  UPDATE admin_feedback_report r
  JOIN prod_feedback_169_172_175_repair_audit_20260730 a
    ON a.run_id = v_run_id
   AND a.entity_type = 'feedback_report'
   AND a.entity_id = CAST(r.id AS CHAR)
     SET r.status = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.status')),
         r.updated_at = JSON_UNQUOTE(JSON_EXTRACT(a.before_json, '$.updated_at'))
   WHERE r.id IN (169, 172, 175, 176);

  COMMIT;

  SELECT v_run_id AS rolled_back_repair_id;
END//

DELIMITER ;

CALL prod_feedback_169_172_175_db_rollback_20260730();

DROP PROCEDURE IF EXISTS prod_feedback_169_172_175_db_rollback_20260730;
