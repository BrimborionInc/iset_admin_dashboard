-- Metadata follow-up for Aaliyah Doxtator / ISET-20260429-680CB8 reset.
-- Restore point: path-prod-aaliyah-assessment-reset-20260528164743
--
-- The primary reset succeeded, but MySQL did not create missing intermediate
-- dataRepair objects for nested JSON_SET paths. This guarded follow-up restores
-- the audit markers without changing the workflow state again.

DROP PROCEDURE IF EXISTS prod_reset_aaliyah_doxtator_assessment_metadata_20260528;

DELIMITER //

CREATE PROCEDURE prod_reset_aaliyah_doxtator_assessment_metadata_20260528()
BEGIN
  DECLARE v_reference VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'ISET-20260429-680CB8';
  DECLARE v_restore_point VARCHAR(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'path-prod-aaliyah-assessment-reset-20260528164743';
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 131;
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 52;
  DECLARE v_action_plan_id BIGINT UNSIGNED DEFAULT 29;
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_case_updates INT DEFAULT 0;
  DECLARE v_plan_updates INT DEFAULT 0;
  DECLARE v_intervention_updates INT DEFAULT 0;
  DECLARE v_proposal_updates INT DEFAULT 0;
  DECLARE v_cfa_updates INT DEFAULT 0;
  DECLARE v_document_updates INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application a
    JOIN iset_application_submission s ON s.id = a.submission_id
    JOIN iset_case c ON c.id = a.case_id
    JOIN iset_case_action_plan ap ON ap.id = v_action_plan_id AND ap.case_id = c.id
   WHERE a.id = v_application_id
     AND c.id = v_case_id
     AND BINARY s.reference_number = BINARY v_reference
     AND BINARY c.case_number = BINARY v_reference
     AND a.status = 'in_review'
     AND a.lifecycle_status = 'in_review'
     AND a.decision_outcome IS NULL
     AND c.status = 'intake'
     AND c.lifecycle_status = 'intake'
     AND ap.status = 'archived'
     AND JSON_EXTRACT(c.case_context_json, '$.applicationDecisionLetters."52"') IS NULL
     AND (
       SELECT COUNT(*)
         FROM iset_case_intervention ci
        WHERE ci.case_id = v_case_id
          AND ci.action_plan_id = v_action_plan_id
          AND ci.id IN (41, 42, 43, 125)
          AND ci.status = 'archived'
     ) = 4
     AND (
       SELECT COUNT(*)
         FROM iset_intervention_proposal p
        WHERE p.case_id = v_case_id
          AND p.action_plan_id = v_action_plan_id
          AND p.id IN (111, 216)
          AND p.archived_at IS NOT NULL
     ) = 2
     AND (
       SELECT COUNT(*)
         FROM cfa_series cs
         JOIN cfa_version cv ON cv.series_id = cs.id
        WHERE cs.case_id = v_case_id
          AND cv.id IN (5, 13)
          AND cv.status = 'withdrawn'
     ) = 2
     AND (
       SELECT COUNT(*)
         FROM iset_document d
        WHERE d.case_id = v_case_id
          AND d.application_id = v_application_id
          AND d.source = 'system_generated'
          AND d.status = 'archived'
          AND d.document_category IN (
            'funding_agreement',
            'case_assessment_approved',
            'assessment_approval_letter',
            'EFT_form'
          )
     ) = 8;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for Aaliyah Doxtator reset metadata follow-up.';
  END IF;

  UPDATE iset_case
     SET case_context_json = JSON_MERGE_PATCH(
           COALESCE(case_context_json, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset20260528',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'reason', 'Approval workflow reset for reassessment after regional manager reported the application should not have been approved.',
                 'archivedActionPlanId', v_action_plan_id,
                 'archivedInterventionIds', JSON_ARRAY(41, 42, 43, 125),
                 'preservedSignedRequestIds', JSON_ARRAY(14, 15, 16)
               )
             )
           )
         ),
         updated_at = NOW()
   WHERE id = v_case_id
     AND status = 'intake'
     AND lifecycle_status = 'intake';

  SET v_case_updates = ROW_COUNT();

  UPDATE iset_case_action_plan
     SET metadata_json = JSON_MERGE_PATCH(
           COALESCE(metadata_json, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'previousStatus', 'active',
                 'retiredReason', 'Approval workflow reset for reassessment.'
               )
             )
           )
         ),
         updated_at = NOW()
   WHERE id = v_action_plan_id
     AND case_id = v_case_id
     AND status = 'archived';

  SET v_plan_updates = ROW_COUNT();

  UPDATE iset_case_intervention
     SET metadata_json = JSON_MERGE_PATCH(
           COALESCE(metadata_json, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'previousStatus',
                 CASE
                   WHEN id IN (41, 42) THEN 'approved'
                   WHEN id = 43 THEN 'in_progress'
                   WHEN id = 125 THEN 'draft'
                   ELSE NULL
                 END,
                 'previousDeliveryStatus',
                 CASE
                   WHEN id IN (41, 42) THEN 'planned'
                   WHEN id = 43 THEN 'in_progress'
                   ELSE NULL
                 END,
                 'retiredReason', 'Approval workflow reset for reassessment.'
               )
             )
           )
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND action_plan_id = v_action_plan_id
     AND id IN (41, 42, 43, 125)
     AND status = 'archived';

  SET v_intervention_updates = ROW_COUNT();

  UPDATE iset_intervention_proposal
     SET metadata_json = JSON_MERGE_PATCH(
           COALESCE(metadata_json, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'retiredReason', 'Approval workflow reset for reassessment.'
               )
             )
           )
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND action_plan_id = v_action_plan_id
     AND id IN (111, 216)
     AND archived_at IS NOT NULL;

  SET v_proposal_updates = ROW_COUNT();

  UPDATE cfa_version cv
  JOIN cfa_series cs ON cs.id = cv.series_id
     SET cv.metadata_json = JSON_MERGE_PATCH(
           COALESCE(cv.metadata_json, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'previousStatus', CASE WHEN cv.id = 5 THEN 'sent' WHEN cv.id = 13 THEN 'draft' ELSE NULL END,
                 'retiredReason', 'Approval workflow reset for reassessment.'
               )
             )
           )
         )
   WHERE cs.case_id = v_case_id
     AND cv.id IN (5, 13)
     AND cv.status = 'withdrawn';

  SET v_cfa_updates = ROW_COUNT();

  UPDATE iset_document
     SET metadata = JSON_MERGE_PATCH(
           COALESCE(metadata, JSON_OBJECT()),
           JSON_OBJECT(
             'dataRepair',
             JSON_OBJECT(
               'aaliyahAssessmentReset',
               JSON_OBJECT(
                 'restorePoint', v_restore_point,
                 'metadataRepairedAt', UTC_TIMESTAMP(3),
                 'previousStatus', 'active',
                 'retiredReason', 'Approval-only artifact archived after assessment workflow reset.'
               )
             )
           )
         ),
         updated_at = NOW()
   WHERE case_id = v_case_id
     AND application_id = v_application_id
     AND source = 'system_generated'
     AND status = 'archived'
     AND document_category IN (
       'funding_agreement',
       'case_assessment_approved',
       'assessment_approval_letter',
       'EFT_form'
     );

  SET v_document_updates = ROW_COUNT();

  IF v_case_updates <> 1
     OR v_plan_updates <> 1
     OR v_intervention_updates <> 4
     OR v_proposal_updates <> 2
     OR v_cfa_updates <> 2
     OR v_document_updates <> 8 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Unexpected row counts during Aaliyah Doxtator reset metadata follow-up.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_reset_aaliyah_doxtator_assessment_metadata_20260528();

DROP PROCEDURE IF EXISTS prod_reset_aaliyah_doxtator_assessment_metadata_20260528;

SELECT
  JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dataRepair.aaliyahAssessmentReset20260528.restorePoint')) AS case_restore_point
FROM iset_case c
WHERE c.id = 131;

SELECT
  ap.id,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS plan_restore_point
FROM iset_case_action_plan ap
WHERE ap.id = 29;

SELECT
  ci.id,
  JSON_UNQUOTE(JSON_EXTRACT(ci.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS intervention_restore_point
FROM iset_case_intervention ci
WHERE ci.case_id = 131
ORDER BY ci.id;

SELECT
  p.id,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS proposal_restore_point
FROM iset_intervention_proposal p
WHERE p.case_id = 131
ORDER BY p.id;

SELECT
  v.id,
  JSON_UNQUOTE(JSON_EXTRACT(v.metadata_json, '$.dataRepair.aaliyahAssessmentReset.restorePoint')) AS cfa_restore_point
FROM cfa_version v
WHERE v.id IN (5, 13)
ORDER BY v.id;

SELECT
  d.document_category,
  COUNT(*) AS count,
  MIN(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.dataRepair.aaliyahAssessmentReset.restorePoint'))) AS min_restore_point,
  MAX(JSON_UNQUOTE(JSON_EXTRACT(d.metadata, '$.dataRepair.aaliyahAssessmentReset.restorePoint'))) AS max_restore_point
FROM iset_document d
WHERE d.case_id = 131
  AND d.application_id = 52
  AND d.source = 'system_generated'
  AND d.document_category IN ('funding_agreement', 'case_assessment_approved', 'assessment_approval_letter', 'EFT_form')
GROUP BY d.document_category
ORDER BY d.document_category;
