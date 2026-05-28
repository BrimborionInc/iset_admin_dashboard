-- Controlled PROD reset for Aaliyah Doxtator / ISET-20260429-680CB8.
-- Restore point: path-prod-aaliyah-assessment-reset-20260528164743
--
-- Purpose:
-- - Undo the live approval workflow artifacts so staff can reopen the application assessment.
-- - Preserve applicant messages and signed form history as audit evidence.
-- - Archive, rather than physically delete, approval-created plan/intervention/CFA/document rows.

DROP PROCEDURE IF EXISTS prod_reset_aaliyah_doxtator_assessment_20260528;

DELIMITER //

CREATE PROCEDURE prod_reset_aaliyah_doxtator_assessment_20260528()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260429-680CB8';
  DECLARE v_restore_point VARCHAR(128) DEFAULT 'path-prod-aaliyah-assessment-reset-20260528164743';
  DECLARE v_client_id BIGINT UNSIGNED DEFAULT 152;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 131;
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 52;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 52;
  DECLARE v_action_plan_id BIGINT UNSIGNED DEFAULT 29;
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_application_updates INT DEFAULT 0;
  DECLARE v_case_updates INT DEFAULT 0;
  DECLARE v_case_assessment_updates INT DEFAULT 0;
  DECLARE v_application_assessment_updates INT DEFAULT 0;
  DECLARE v_plan_updates INT DEFAULT 0;
  DECLARE v_intervention_updates INT DEFAULT 0;
  DECLARE v_proposal_updates INT DEFAULT 0;
  DECLARE v_cfa_updates INT DEFAULT 0;
  DECLARE v_document_updates INT DEFAULT 0;
  DECLARE v_note_inserts INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client cl
    JOIN iset_case c ON c.id = v_case_id AND c.client_id = cl.id
    JOIN iset_application a ON a.id = v_application_id AND a.client_id = cl.id AND a.case_id = c.id
    JOIN iset_application_submission s ON s.id = a.submission_id
    JOIN iset_case_assessment ca ON ca.case_id = c.id
    JOIN iset_application_assessment aa ON aa.application_id = a.id AND aa.case_id = c.id
   WHERE cl.id = v_client_id
     AND BINARY cl.first_name = BINARY 'Aaliyah'
     AND BINARY cl.last_name = BINARY 'Doxtator'
     AND a.submission_id = v_submission_id
     AND BINARY s.reference_number = BINARY v_reference
     AND BINARY c.case_number = BINARY v_reference
     AND c.assigned_staff_profile_id = 58
     AND c.status = 'active'
     AND c.lifecycle_status = 'active'
     AND a.status = 'completed'
     AND a.lifecycle_status = 'closed'
     AND a.decision_outcome IS NULL
     AND ca.recommendation = 'recommend'
     AND ca.nwac_review = 'agree'
     AND aa.recommendation = 'recommend'
     AND aa.nwac_review = 'agree'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."52".assessment_nwac_review_status')) = 'approve'
     AND EXISTS (
       SELECT 1
         FROM iset_case_action_plan ap
        WHERE ap.id = v_action_plan_id
          AND ap.case_id = v_case_id
          AND ap.status = 'active'
          AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'auto_assessment'
     )
     AND (
       SELECT COUNT(*)
         FROM iset_case_intervention ci
        WHERE ci.case_id = v_case_id
          AND ci.action_plan_id = v_action_plan_id
          AND ci.id IN (41, 42, 43, 125)
     ) = 4
     AND (
       SELECT COUNT(*)
         FROM iset_intervention_proposal p
        WHERE p.case_id = v_case_id
          AND p.action_plan_id = v_action_plan_id
          AND p.id IN (111, 216)
          AND p.archived_at IS NULL
     ) = 2
     AND (
       SELECT COUNT(*)
         FROM cfa_series cs
         JOIN cfa_version cv ON cv.series_id = cs.id
        WHERE cs.case_id = v_case_id
          AND cv.id IN (5, 13)
          AND cv.status IN ('sent', 'draft')
     ) = 2
     AND (
       SELECT COUNT(*)
         FROM iset_document d
        WHERE d.case_id = v_case_id
          AND d.application_id = v_application_id
          AND d.source = 'system_generated'
          AND d.status = 'active'
          AND d.document_category IN (
            'funding_agreement',
            'case_assessment_approved',
            'assessment_approval_letter',
            'EFT_form'
          )
     ) = 8
     AND (
       SELECT COUNT(*)
         FROM payment_packet pp
        WHERE pp.case_id = v_case_id
     ) = 0
     AND (
       SELECT COUNT(*)
         FROM finance_transaction ft
        WHERE ft.case_id = v_case_id
     ) = 0;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for Aaliyah Doxtator assessment reset; expected live approval state was not found.';
  END IF;

  UPDATE iset_application
     SET status = 'in_review',
         lifecycle_status = 'in_review',
         decision_outcome = NULL,
         awaiting_reason = 'none',
         closure_reason = NULL,
         row_version = COALESCE(row_version, 0) + 1,
         updated_at = NOW()
   WHERE id = v_application_id
     AND submission_id = v_submission_id
     AND client_id = v_client_id
     AND case_id = v_case_id
     AND status = 'completed'
     AND lifecycle_status = 'closed'
     AND decision_outcome IS NULL;

  SET v_application_updates = ROW_COUNT();

  UPDATE iset_case
     SET status = 'intake',
         lifecycle_status = 'intake',
         closure_reason = NULL,
         open_intervention_count = 0,
         total_intervention_count = 0,
         case_context_json = JSON_SET(
           JSON_REMOVE(
             COALESCE(case_context_json, JSON_OBJECT()),
             '$.applicationDecisionLetters."52"'
           ),
           '$.dataRepair.aaliyahAssessmentReset20260528',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'repairedAt', UTC_TIMESTAMP(3),
             'reason', 'Approval workflow reset for reassessment after regional manager reported the application should not have been approved.',
             'archivedActionPlanId', v_action_plan_id,
             'archivedInterventionIds', JSON_ARRAY(41, 42, 43, 125),
             'preservedSignedRequestIds', JSON_ARRAY(14, 15, 16)
           )
         ),
         updated_at = NOW()
   WHERE id = v_case_id
     AND client_id = v_client_id
     AND BINARY case_number = BINARY v_reference
     AND status = 'active'
     AND lifecycle_status = 'active';

  SET v_case_updates = ROW_COUNT();

  UPDATE iset_case_assessment
     SET nwac_review = NULL,
         nwac_reason = NULL,
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND recommendation = 'recommend'
     AND nwac_review = 'agree';

  SET v_case_assessment_updates = ROW_COUNT();

  UPDATE iset_application_assessment
     SET nwac_review = NULL,
         nwac_reason = NULL,
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND application_id = v_application_id
     AND recommendation = 'recommend'
     AND nwac_review = 'agree';

  SET v_application_assessment_updates = ROW_COUNT();

  UPDATE iset_case_action_plan
     SET status = 'archived',
         archived_at = COALESCE(archived_at, NOW()),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.dataRepair.aaliyahAssessmentReset.restorePoint', v_restore_point,
           '$.dataRepair.aaliyahAssessmentReset.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.aaliyahAssessmentReset.retiredReason', 'Approval workflow reset for reassessment.'
         ),
         updated_at = NOW()
   WHERE id = v_action_plan_id
     AND case_id = v_case_id
     AND status = 'active'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'auto_assessment';

  SET v_plan_updates = ROW_COUNT();

  UPDATE iset_case_intervention
     SET status = 'archived',
         delivery_status = NULL,
         closed_at = COALESCE(closed_at, NOW()),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.dataRepair.aaliyahAssessmentReset.restorePoint', v_restore_point,
           '$.dataRepair.aaliyahAssessmentReset.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.aaliyahAssessmentReset.retiredReason', 'Approval workflow reset for reassessment.'
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND action_plan_id = v_action_plan_id
     AND id IN (41, 42, 43, 125)
     AND status IN ('approved', 'in_progress', 'draft');

  SET v_intervention_updates = ROW_COUNT();

  UPDATE iset_intervention_proposal
     SET archived_at = COALESCE(archived_at, NOW()),
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.dataRepair.aaliyahAssessmentReset.restorePoint', v_restore_point,
           '$.dataRepair.aaliyahAssessmentReset.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.aaliyahAssessmentReset.retiredReason', 'Approval workflow reset for reassessment.'
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND action_plan_id = v_action_plan_id
     AND id IN (111, 216)
     AND archived_at IS NULL;

  SET v_proposal_updates = ROW_COUNT();

  UPDATE cfa_version cv
  JOIN cfa_series cs ON cs.id = cv.series_id
     SET cv.status = 'withdrawn',
         cv.change_summary = 'Withdrawn by PROD data repair after approval workflow reset for reassessment.',
         cv.metadata_json = JSON_SET(
           COALESCE(cv.metadata_json, JSON_OBJECT()),
           '$.dataRepair.aaliyahAssessmentReset.restorePoint', v_restore_point,
           '$.dataRepair.aaliyahAssessmentReset.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.aaliyahAssessmentReset.previousStatus', cv.status,
           '$.dataRepair.aaliyahAssessmentReset.previousChangeReason', cv.change_reason,
           '$.dataRepair.aaliyahAssessmentReset.previousChangeSummary', cv.change_summary,
           '$.dataRepair.aaliyahAssessmentReset.retiredReason', 'Approval workflow reset for reassessment.'
         )
   WHERE cs.case_id = v_case_id
     AND cv.id IN (5, 13)
     AND cv.status IN ('sent', 'draft');

  SET v_cfa_updates = ROW_COUNT();

  UPDATE iset_document
     SET status = 'archived',
         metadata = JSON_SET(
           COALESCE(metadata, JSON_OBJECT()),
           '$.dataRepair.aaliyahAssessmentReset.restorePoint', v_restore_point,
           '$.dataRepair.aaliyahAssessmentReset.repairedAt', UTC_TIMESTAMP(3),
           '$.dataRepair.aaliyahAssessmentReset.retiredReason', 'Approval-only artifact archived after assessment workflow reset.'
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND application_id = v_application_id
     AND source = 'system_generated'
     AND status = 'active'
     AND document_category IN (
       'funding_agreement',
       'case_assessment_approved',
       'assessment_approval_letter',
       'EFT_form'
     );

  SET v_document_updates = ROW_COUNT();

  INSERT INTO iset_case_note (
    case_id,
    author_staff_profile_id,
    author_user_id,
    body,
    is_internal,
    is_pinned,
    created_at,
    updated_at
  )
  VALUES (
    v_case_id,
    NULL,
    NULL,
    CONCAT(
      'PROD data repair 2026-05-28: reset approval workflow after regional manager reported this application should not have been approved and needs reassessment. ',
      'Archived action plan 29, interventions 41/42/43/125, intervention proposals 111/216, approval-only generated documents, and CFA versions 5/13. ',
      'Application 52 was moved back to In review and NWAC decision fields were cleared. Applicant messages and signed requests 14/15/16 were preserved as historical audit evidence. Restore point: ',
      v_restore_point,
      '.'
    ),
    1,
    0,
    NOW(3),
    NOW(3)
  );

  SET v_note_inserts = ROW_COUNT();

  INSERT INTO iset_event_entry (
    id, category, event_type, severity, source,
    subject_type, subject_id,
    actor_type, actor_id, actor_staff_profile_id, actor_applicant_user_id, actor_display_name,
    payload_json, tracking_id, correlation_id,
    captured_by, captured_at, ingested_at
  ) VALUES (
    UUID(), 'assessment', 'application_assessment_reset', 'warning', 'admin',
    'case', CAST(v_case_id AS CHAR),
    'system', 'codex-prod-operator', NULL, NULL, 'codex-prod-operator',
    JSON_OBJECT(
      'tracking_id', v_reference,
      'restore_point', v_restore_point,
      'application_id', v_application_id,
      'from_application_status', 'completed',
      'to_application_status', 'in_review',
      'message', 'Approval workflow reset for reassessment; previous approval artifacts archived.'
    ),
    v_reference, 'prod-reset-aaliyah-doxtator-assessment-20260528',
    'codex-prod-operator', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
  ), (
    UUID(), 'case_lifecycle', 'status_changed', 'info', 'admin',
    'case', CAST(v_case_id AS CHAR),
    'system', 'codex-prod-operator', NULL, NULL, 'codex-prod-operator',
    JSON_OBJECT(
      'tracking_id', v_reference,
      'restore_point', v_restore_point,
      'from', 'active',
      'to', 'intake',
      'message', 'Case returned to intake while application assessment is reopened.'
    ),
    v_reference, 'prod-reset-aaliyah-doxtator-assessment-20260528',
    'codex-prod-operator', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3)
  );

  IF v_application_updates <> 1
     OR v_case_updates <> 1
     OR v_case_assessment_updates <> 1
     OR v_application_assessment_updates <> 1
     OR v_plan_updates <> 1
     OR v_intervention_updates <> 4
     OR v_proposal_updates <> 2
     OR v_cfa_updates <> 2
     OR v_document_updates <> 8
     OR v_note_inserts <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Unexpected row counts during Aaliyah Doxtator assessment reset.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_reset_aaliyah_doxtator_assessment_20260528();

DROP PROCEDURE IF EXISTS prod_reset_aaliyah_doxtator_assessment_20260528;

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
  c.closure_reason,
  JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."52"') AS application_decision_context,
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dataRepair.aaliyahAssessmentReset20260528.restorePoint')) AS reset_restore_point,
  ca.recommendation AS legacy_recommendation,
  ca.nwac_review AS legacy_nwac_review,
  aa.recommendation AS application_recommendation,
  aa.nwac_review AS application_nwac_review
FROM iset_application a
JOIN iset_application_submission s ON s.id = a.submission_id
JOIN iset_case c ON c.id = a.case_id
JOIN iset_case_assessment ca ON ca.case_id = c.id
JOIN iset_application_assessment aa ON aa.application_id = a.id
WHERE a.id = 52
  AND BINARY s.reference_number = BINARY 'ISET-20260429-680CB8';

SELECT
  ap.id,
  ap.status,
  ap.archived_at,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS restore_point
FROM iset_case_action_plan ap
WHERE ap.id = 29;

SELECT
  ci.id,
  ci.status,
  ci.delivery_status,
  ci.closed_at,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS restore_point
FROM iset_case_intervention ci
WHERE ci.case_id = 131
ORDER BY ci.id;

SELECT
  p.id,
  p.review_status,
  p.archived_at,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS restore_point
FROM iset_intervention_proposal p
WHERE p.case_id = 131
ORDER BY p.id;

SELECT
  d.document_category,
  d.status,
  COUNT(*) AS count,
  GROUP_CONCAT(d.id ORDER BY d.id) AS ids
FROM iset_document d
WHERE d.case_id = 131
  AND d.application_id = 52
  AND d.source = 'system_generated'
  AND d.document_category IN ('funding_agreement', 'case_assessment_approved', 'assessment_approval_letter', 'EFT_form')
GROUP BY d.document_category, d.status
ORDER BY d.document_category, d.status;

SELECT
  v.id,
  v.status,
  v.change_summary,
  JSON_UNQUOTE(JSON_EXTRACT(v.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS restore_point
FROM cfa_version v
WHERE v.id IN (5, 13)
ORDER BY v.id;
