-- PROD guarded data repair for application ISET-20260429-B2679D.
-- Restore point: path-prod-tanisha-denial-20260507170032
-- Purpose:
-- - Correct Tanisha Saddleback's application decision from approved to denied.
-- - Preserve the case manager recommendation (`no_recommend`) and approver assurance (`agree`).
-- - Retire approval-only artifacts created by the incorrect approval decision.

DROP PROCEDURE IF EXISTS prod_fix_tanisha_saddleback_denial_20260507;

DELIMITER //

CREATE PROCEDURE prod_fix_tanisha_saddleback_denial_20260507()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260429-B2679D';
  DECLARE v_restore_point VARCHAR(128) DEFAULT 'path-prod-tanisha-denial-20260507170032';
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 48;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 48;
  DECLARE v_client_id BIGINT UNSIGNED DEFAULT 147;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 127;
  DECLARE v_action_plan_id BIGINT UNSIGNED DEFAULT 32;
  DECLARE v_cfa_version_id BIGINT UNSIGNED DEFAULT 8;
  DECLARE v_denial_reason_code VARCHAR(64) DEFAULT 'training_not_aligned';
  DECLARE v_denial_reason_label VARCHAR(255) DEFAULT 'Training not aligned with employment goal or labour-market outcomes';
  DECLARE v_denial_reason TEXT DEFAULT NULL;
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_application_updates INT DEFAULT 0;
  DECLARE v_case_updates INT DEFAULT 0;
  DECLARE v_assessment_updates INT DEFAULT 0;
  DECLARE v_plan_updates INT DEFAULT 0;
  DECLARE v_intervention_updates INT DEFAULT 0;
  DECLARE v_document_updates INT DEFAULT 0;
  DECLARE v_cfa_updates INT DEFAULT 0;

  START TRANSACTION;

  SELECT ca.justification
    INTO v_denial_reason
    FROM iset_case_assessment ca
   WHERE ca.case_id = v_case_id
   LIMIT 1
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application a
    JOIN iset_application_submission s ON s.id = a.submission_id
    JOIN iset_case c ON c.id = a.case_id
    JOIN client cl ON cl.id = a.client_id
    JOIN iset_case_assessment ca ON ca.case_id = c.id
   WHERE a.id = v_application_id
     AND a.submission_id = v_submission_id
     AND a.client_id = v_client_id
     AND a.case_id = v_case_id
     AND BINARY s.reference_number = BINARY v_reference
     AND BINARY c.case_number = BINARY v_reference
     AND BINARY cl.first_name = BINARY 'Tanisha'
     AND BINARY cl.last_name = BINARY 'Saddleback'
     AND a.status = 'approved'
     AND a.lifecycle_status = 'decision_recorded'
     AND a.decision_outcome = 'approved'
     AND c.status = 'initiated'
     AND c.lifecycle_status = 'initiated'
     AND ca.recommendation = 'no_recommend'
     AND ca.nwac_review = 'agree'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.assessment_nwac_review_status')) = 'approve'
     AND EXISTS (
       SELECT 1
         FROM iset_case_action_plan ap
        WHERE ap.id = v_action_plan_id
          AND ap.case_id = v_case_id
          AND ap.status = 'draft'
          AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'auto_assessment'
     )
     AND (
       SELECT COUNT(*)
         FROM iset_case_intervention ci
        WHERE ci.case_id = v_case_id
          AND ci.action_plan_id = v_action_plan_id
          AND ci.status = 'approved'
          AND ci.delivery_status = 'planned'
          AND JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.source')) = 'auto_assessment'
     ) = 2
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for Tanisha Saddleback denial repair; expected approved auto-assessment state was not found.';
  END IF;

  UPDATE iset_application
     SET status = 'rejected',
         lifecycle_status = 'decision_recorded',
         decision_outcome = 'denied',
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = COALESCE(row_version, 0) + 1,
         updated_at = NOW()
   WHERE id = v_application_id
     AND submission_id = v_submission_id
     AND client_id = v_client_id
     AND case_id = v_case_id
     AND status = 'approved'
     AND lifecycle_status = 'decision_recorded'
     AND decision_outcome = 'approved';

  SET v_application_updates = ROW_COUNT();

  UPDATE iset_case
     SET status = 'closed',
         lifecycle_status = 'closed',
         closure_reason = 'administrative',
         case_context_json = JSON_SET(
           COALESCE(case_context_json, JSON_OBJECT()),
           '$.assessment_nwac_review_status', 'reject',
           '$.fundingDecisionReasonCode', v_denial_reason_code,
           '$.fundingDecisionReasonLabel', v_denial_reason_label,
           '$.fundingDecisionReasonExplanation', COALESCE(v_denial_reason, 'Case manager recommended not funding this application.'),
           '$.prodDataRepairTanishaDenial20260507',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'reason', 'Corrected incorrect approved decision to denied while preserving case manager no-recommend assessment and approver agreement.'
           )
         ),
         updated_at = NOW()
   WHERE id = v_case_id
     AND BINARY case_number = BINARY v_reference
     AND status = 'initiated'
     AND lifecycle_status = 'initiated';

  SET v_case_updates = ROW_COUNT();

  UPDATE iset_case_assessment
     SET nwac_review = 'agree',
         nwac_reason = COALESCE(NULLIF(nwac_reason, ''), v_denial_reason),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND recommendation = 'no_recommend'
     AND nwac_review = 'agree';

  SET v_assessment_updates = ROW_COUNT();

  UPDATE iset_case_action_plan
     SET status = 'archived',
         archived_at = COALESCE(archived_at, NOW()),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.prodDataRepairTanishaDenial20260507',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'retiredReason', 'Application decision corrected from approved to denied.'
           )
         ),
         updated_at = NOW()
   WHERE id = v_action_plan_id
     AND case_id = v_case_id
     AND status = 'draft'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'auto_assessment';

  SET v_plan_updates = ROW_COUNT();

  UPDATE iset_case_intervention
     SET status = 'archived',
         delivery_status = NULL,
         closed_at = COALESCE(closed_at, NOW()),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.prodDataRepairTanishaDenial20260507',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'retiredReason', 'Application decision corrected from approved to denied.'
           )
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND action_plan_id = v_action_plan_id
     AND status = 'approved'
     AND delivery_status = 'planned'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'auto_assessment';

  SET v_intervention_updates = ROW_COUNT();

  UPDATE iset_document
     SET status = 'archived',
         metadata = JSON_SET(
           COALESCE(metadata, JSON_OBJECT()),
           '$.prodDataRepairTanishaDenial20260507',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'retiredReason', 'Approval-only artifact retired after application decision was corrected to denied.'
           )
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND application_id = v_application_id
     AND source = 'system_generated'
     AND document_category IN ('case_assessment_approved', 'funding_agreement')
     AND status = 'active';

  SET v_document_updates = ROW_COUNT();

  UPDATE cfa_version
     SET status = 'withdrawn',
         change_reason = COALESCE(change_reason, 'ADMIN_REISSUE'),
         change_summary = 'Withdrawn by PROD data repair after application decision correction to denied.',
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.prodDataRepairTanishaDenial20260507',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'retiredReason', 'Application decision corrected from approved to denied.'
           )
         )
   WHERE id = v_cfa_version_id
     AND series_id = v_cfa_version_id
     AND status = 'draft'
     AND EXISTS (
       SELECT 1
         FROM cfa_series cs
        WHERE cs.id = cfa_version.series_id
          AND cs.case_id = v_case_id
     );

  SET v_cfa_updates = ROW_COUNT();

  INSERT INTO iset_event_entry (
    id, category, event_type, severity, source,
    subject_type, subject_id,
    actor_type, actor_id, actor_staff_profile_id, actor_applicant_user_id, actor_display_name,
    payload_json, tracking_id, correlation_id,
    captured_by, captured_at, ingested_at
  ) VALUES (
    UUID(), 'case_lifecycle', 'status_changed', 'info', 'admin',
    'case', CAST(v_case_id AS CHAR),
    'system', 'codex-prod-operator', NULL, NULL, 'codex-prod-operator',
    JSON_OBJECT(
      'from', 'approved',
      'to', 'rejected',
      'tracking_id', v_reference,
      'restore_point', v_restore_point,
      'message', 'Application decision corrected from approved to denied by PROD data repair.'
    ),
    v_reference, 'prod-fix-tanisha-saddleback-denial-20260507',
    'codex-prod-operator', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
  );

  INSERT INTO iset_event_entry (
    id, category, event_type, severity, source,
    subject_type, subject_id,
    actor_type, actor_id, actor_staff_profile_id, actor_applicant_user_id, actor_display_name,
    payload_json, tracking_id, correlation_id,
    captured_by, captured_at, ingested_at
  ) VALUES (
    UUID(), 'assessment', 'nwac_review_denied', 'warning', 'admin',
    'case', CAST(v_case_id AS CHAR),
    'system', 'codex-prod-operator', NULL, NULL, 'codex-prod-operator',
    JSON_OBJECT(
      'tracking_id', v_reference,
      'outcome', 'reject',
      'outcome_label', 'denied',
      'reason', COALESCE(v_denial_reason, 'Case manager recommended not funding this application.'),
      'approval_cost_total', 0,
      'budget_pot_id', NULL,
      'budget_pot_code', NULL,
      'budget_pot_name', NULL,
      'posting_context', NULL,
      'restore_point', v_restore_point,
      'message', 'Application denied by PROD data repair; approver assurance remains agree with the case manager no-funding recommendation.'
    ),
    v_reference, 'prod-fix-tanisha-saddleback-denial-20260507',
    'codex-prod-operator', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
  );

  IF v_application_updates <> 1
     OR v_case_updates <> 1
     OR v_assessment_updates <> 1
     OR v_plan_updates <> 1
     OR v_intervention_updates <> 2
     OR v_document_updates <> 2
     OR v_cfa_updates <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Unexpected row counts during Tanisha Saddleback denial repair.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_tanisha_saddleback_denial_20260507();

DROP PROCEDURE IF EXISTS prod_fix_tanisha_saddleback_denial_20260507;

SELECT
  s.reference_number,
  a.id AS application_id,
  a.status AS application_status,
  a.lifecycle_status AS application_lifecycle_status,
  a.decision_outcome,
  a.awaiting_reason,
  a.row_version,
  c.id AS case_id,
  c.status AS case_status,
  c.lifecycle_status AS case_lifecycle_status,
  c.closure_reason AS case_closure_reason,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.assessment_nwac_review_status')) AS assessment_nwac_review_status,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.fundingDecisionReasonCode')) AS funding_decision_reason_code,
  ca.recommendation,
  ca.nwac_review,
  LEFT(ca.nwac_reason, 180) AS nwac_reason
FROM iset_application a
JOIN iset_application_submission s ON s.id = a.submission_id
JOIN iset_case c ON c.id = a.case_id
JOIN iset_case_assessment ca ON ca.case_id = c.id
WHERE a.id = 48
  AND BINARY s.reference_number = BINARY 'ISET-20260429-B2679D';

SELECT
  ap.id,
  ap.status,
  ap.archived_at,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.prodDataRepairTanishaDenial20260507.restorePoint')) AS restore_point
FROM iset_case_action_plan ap
WHERE ap.id = 32;

SELECT
  ci.id,
  ci.status,
  ci.delivery_status,
  ci.closed_at,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.prodDataRepairTanishaDenial20260507.restorePoint')) AS restore_point
FROM iset_case_intervention ci
WHERE ci.case_id = 127
ORDER BY ci.id;

SELECT
  d.id,
  d.document_category,
  d.status,
  JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.prodDataRepairTanishaDenial20260507.restorePoint')) AS restore_point
FROM iset_document d
WHERE d.case_id = 127
  AND d.application_id = 48
  AND d.source = 'system_generated'
ORDER BY d.id;

SELECT
  v.id,
  v.status,
  JSON_UNQUOTE(JSON_EXTRACT(v.metadata_json, '$.prodDataRepairTanishaDenial20260507.restorePoint')) AS restore_point
FROM cfa_version v
WHERE v.id = 8;
