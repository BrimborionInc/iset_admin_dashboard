-- PROD guarded repair: Shayleen McNabb ILMP safe fields.
-- Restore point: path-prod-shayleen-ilmp-safe-repair-20260605151744
--
-- Scope:
--   - Case ISET-20260410-78062A / case_id 94 / action_plan_id 53 only.
--   - Fill only fields directly supported by the saved application answers or
--     linked intervention dates.
--   - Do not fill barrier, EI claimant category, or previous employment
--     NOC/version; those still need case-manager confirmation.

DELIMITER //

DROP PROCEDURE IF EXISTS prod_repair_shayleen_mcnabb_ilmp_safe_fields_20260605//

CREATE PROCEDURE prod_repair_shayleen_mcnabb_ilmp_safe_fields_20260605()
BEGIN
  DECLARE v_run_id VARCHAR(96) DEFAULT 'shayleen-mcnabb-ilmp-safe-fields-20260605';
  DECLARE v_restore_point VARCHAR(128) DEFAULT 'path-prod-shayleen-ilmp-safe-repair-20260605151744';
  DECLARE v_repaired_at DATETIME(3);
  DECLARE v_target_count INT DEFAULT 0;
  DECLARE v_conflict_count INT DEFAULT 0;
  DECLARE v_existing_audit_rows INT DEFAULT 0;
  DECLARE v_case_rows_updated INT DEFAULT 0;
  DECLARE v_plan_rows_updated INT DEFAULT 0;
  DECLARE v_submission_rows_reset INT DEFAULT 0;
  DECLARE v_verify_mismatch INT DEFAULT 0;
  DECLARE v_note_text TEXT;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SET v_repaired_at = UTC_TIMESTAMP(3);
  SET v_note_text = CONCAT(
    'Codex data repair update: applied guarded Shayleen McNabb safe-field repair after restore point ',
    v_restore_point,
    '. Filled root Participant Details fields that were directly supported by the application answers: marital status single, dependent children count 2 from ages 14 and 9, ages of children, social assistance No, employment status employed-full-time, education level bachelors_degree, education year 2019, and education province SK. Updated action plan 53 start/activation date from 2026-04-22 to 2026-04-21 to match the earliest linked intervention, and filled action-plan ILMP education level 10, education province 8, and socialAssistanceRecipient 0. Reset the cached ILMP readiness row so validation must be rerun. Left barrier to employment, EI claimant category, and previous employment NOC/version for Emilie because they are not safely derivable.'
  );

  CREATE TABLE IF NOT EXISTS prod_shayleen_ilmp_safe_repair_audit_20260605 (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    run_id VARCHAR(96) NOT NULL,
    restore_point VARCHAR(128) NOT NULL,
    case_id BIGINT UNSIGNED NOT NULL,
    case_number VARCHAR(64) NOT NULL,
    client_id BIGINT UNSIGNED NOT NULL,
    client_name VARCHAR(260) NOT NULL,
    application_id BIGINT UNSIGNED NULL,
    action_plan_id BIGINT UNSIGNED NOT NULL,
    esdc_submission_id BIGINT UNSIGNED NULL,
    before_case_context_json JSON NULL,
    after_case_context_json JSON NULL,
    before_action_plan_json JSON NULL,
    after_action_plan_json JSON NULL,
    before_action_plan_metadata_json JSON NULL,
    after_action_plan_metadata_json JSON NULL,
    before_effective_date DATE NULL,
    after_effective_date DATE NULL,
    before_activated_at DATETIME NULL,
    after_activated_at DATETIME NULL,
    before_submission_json JSON NULL,
    after_submission_json JSON NULL,
    repaired_at DATETIME(3) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_run_case_plan (run_id, case_id, action_plan_id)
  );

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_existing_audit_rows
    FROM prod_shayleen_ilmp_safe_repair_audit_20260605
   WHERE run_id = v_run_id;

  IF v_existing_audit_rows <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair audit already exists';
  END IF;

  SELECT COUNT(*)
    INTO v_target_count
    FROM iset_case c
    JOIN client cl ON cl.id = c.client_id
    JOIN iset_application a ON a.case_id = c.id AND a.id = 12
    JOIN iset_case_action_plan ap ON ap.case_id = c.id AND ap.id = 53
   WHERE c.id = 94
     AND c.case_number = 'ISET-20260410-78062A'
     AND cl.first_name = 'Shayleen'
     AND cl.last_name = 'McNabb'
     AND a.status = 'withdrawn'
     AND a.lifecycle_status = 'closed'
     AND ap.status = 'closed'
     AND ap.archived_at IS NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'manual_backload'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.entryMode')) = 'existing'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.postingContext')) = 'external'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."marital-status"')) = 'single'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."dependent-children"')) = '1'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."ages-of-children"')) = '14, 9'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."social-assistance"')) = '0'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."labour-force-status"')) = 'employed-full-time'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')) = 'bachelors_degree'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-year"')) = '2019'
     AND JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')) = 'sk'
     AND (
       SELECT MIN(i.start_date)
         FROM iset_case_intervention i
        WHERE i.action_plan_id = ap.id
     ) = '2026-04-21';

  IF v_target_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair target/source mismatch';
  END IF;

  SELECT COUNT(*)
    INTO v_conflict_count
    FROM iset_case c
    JOIN iset_case_action_plan ap ON ap.case_id = c.id AND ap.id = 53
   WHERE c.id = 94
     AND (
       COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.maritalStatus'))), ''), 'null'), 'single') <> 'single'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dependentChildren'))), ''), 'null'), '2') <> '2'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.agesOfChildren'))), ''), 'null'), '14, 9') <> '14, 9'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.socialAssistance'))), ''), 'null'), 'no') <> 'no'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.employmentStatus'))), ''), 'null'), 'employed-full-time') <> 'employed-full-time'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationLevel'))), ''), 'null'), 'bachelors_degree') <> 'bachelors_degree'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationYear'))), ''), 'null'), '2019') <> '2019'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationProvince'))), ''), 'null'), 'sk') <> 'sk'
       OR ap.effective_date NOT IN ('2026-04-21', '2026-04-22')
       OR DATE(ap.activated_at) NOT IN ('2026-04-21', '2026-04-22')
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel'))), ''), 'null'), '10') <> '10'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationProvince'))), ''), 'null'), '8') <> '8'
       OR COALESCE(NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.socialAssistanceRecipient'))), ''), 'null'), '0') <> '0'
       OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.BarrierToEmployment'))), ''), 'null') IS NOT NULL
       OR COALESCE(NULLIF(NULLIF(TRIM(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.EIClaimant')), CAST(ap.EIClaimant AS CHAR))), ''), 'null'), '') <> ''
       OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNoc'))), ''), 'null') IS NOT NULL
       OR NULLIF(NULLIF(TRIM(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNocVersion'))), ''), 'null') IS NOT NULL
     );

  IF v_conflict_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair conflicting staff-entered or unexpected values';
  END IF;

  INSERT INTO prod_shayleen_ilmp_safe_repair_audit_20260605 (
    run_id,
    restore_point,
    case_id,
    case_number,
    client_id,
    client_name,
    application_id,
    action_plan_id,
    esdc_submission_id,
    before_case_context_json,
    before_action_plan_json,
    before_action_plan_metadata_json,
    before_effective_date,
    before_activated_at,
    before_submission_json,
    repaired_at
  )
  SELECT
    v_run_id,
    v_restore_point,
    c.id,
    c.case_number,
    cl.id,
    CONCAT_WS(' ', cl.first_name, cl.last_name),
    a.id,
    ap.id,
    eps.id,
    c.case_context_json,
    ap.esdc_action_plan_json,
    ap.metadata_json,
    ap.effective_date,
    ap.activated_at,
    CASE
      WHEN eps.id IS NULL THEN NULL
      ELSE JSON_OBJECT(
        'id', eps.id,
        'readiness_status', eps.readiness_status,
        'readiness_summary', eps.readiness_summary,
        'warnings', eps.warnings,
        'blocking_issues', eps.blocking_issues,
        'last_validated_at', eps.last_validated_at,
        'submission_status', eps.submission_status,
        'payload_checksum', eps.payload_checksum,
        'rejection_reason', eps.rejection_reason
      )
    END,
    v_repaired_at
  FROM iset_case c
  JOIN client cl ON cl.id = c.client_id
  JOIN iset_application a ON a.case_id = c.id AND a.id = 12
  JOIN iset_case_action_plan ap ON ap.case_id = c.id AND ap.id = 53
  LEFT JOIN esdc_participant_submission eps ON eps.case_id = c.id AND eps.action_plan_id = ap.id
  WHERE c.id = 94;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair audit insert count';
  END IF;

  UPDATE iset_case c
     SET c.case_context_json = JSON_SET(
           JSON_SET(
             COALESCE(c.case_context_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(c.case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.maritalStatus', 'single',
           '$.dependentChildren', '2',
           '$.agesOfChildren', '14, 9',
           '$.socialAssistance', 'no',
           '$.employmentStatus', 'employed-full-time',
           '$.educationLevel', 'bachelors_degree',
           '$.educationYear', '2019',
           '$.educationProvince', 'sk',
           '$.dataRepair.shayleenIlmpSafeRepair20260605',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_restore_point,
             'feedbackReportId', 137,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'Saved application answers on case ISET-20260410-78062A.',
             'reason', 'Participant Details root fields were blank while the widget displayed application fallback values.',
             'mergePolicy', 'Filled only agreed safe fields; left ambiguous ILMP action-plan fields for case-manager confirmation.'
           )
         ),
         c.updated_at = v_repaired_at
   WHERE c.id = 94
     AND c.case_number = 'ISET-20260410-78062A';

  SET v_case_rows_updated = ROW_COUNT();
  IF v_case_rows_updated <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair case update count';
  END IF;

  UPDATE iset_case_action_plan ap
     SET ap.effective_date = '2026-04-21',
         ap.activated_at = '2026-04-21 00:00:00',
         ap.esdc_action_plan_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.esdc_action_plan_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.educationLevel', '10',
           '$.educationProvince', '8',
           '$.socialAssistanceRecipient', '0',
           '$.dataRepair.shayleenIlmpSafeRepair20260605',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_restore_point,
             'feedbackReportId', 137,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'source', 'Application answers for education/social assistance and earliest linked intervention start date.',
             'reason', 'Backloaded action plan was missing safe Appendix A fields and started one day after linked interventions.',
             'leftForCaseManager', JSON_ARRAY('BarrierToEmployment', 'EIClaimant', 'actionPlanPreviousEmploymentNoc', 'actionPlanPreviousEmploymentNocVersion')
           )
         ),
         ap.metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.shayleenIlmpSafeRepair20260605',
           JSON_OBJECT(
             'runId', v_run_id,
             'restorePoint', v_restore_point,
             'feedbackReportId', 137,
             'repairedAtUtc', DATE_FORMAT(v_repaired_at, '%Y-%m-%dT%H:%i:%s.%fZ'),
             'effectiveDate', JSON_OBJECT('from', '2026-04-22', 'to', '2026-04-21'),
             'activatedAt', JSON_OBJECT('from', '2026-04-22 00:00:00', 'to', '2026-04-21 00:00:00')
           )
         ),
         ap.updated_at = v_repaired_at
   WHERE ap.id = 53
     AND ap.case_id = 94
     AND ap.status = 'closed'
     AND ap.archived_at IS NULL;

  SET v_plan_rows_updated = ROW_COUNT();
  IF v_plan_rows_updated <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair action plan update count';
  END IF;

  UPDATE esdc_participant_submission eps
     SET eps.readiness_status = 'needs_review',
         eps.readiness_summary = NULL,
         eps.warnings = NULL,
         eps.blocking_issues = NULL,
         eps.last_validated_at = NULL,
         eps.submission_status = 'pending',
         eps.submitted_at = NULL,
         eps.submitted_by_user_id = NULL,
         eps.payload_snapshot = NULL,
         eps.payload_storage_key = NULL,
         eps.payload_checksum = NULL,
         eps.rejection_reason = NULL,
         eps.updated_at = v_repaired_at
   WHERE eps.case_id = 94
     AND eps.action_plan_id = 53
     AND eps.id = 115;

  SET v_submission_rows_reset = ROW_COUNT();
  IF v_submission_rows_reset <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair submission reset count';
  END IF;

  SELECT COUNT(*)
    INTO v_verify_mismatch
    FROM iset_case c
    JOIN iset_case_action_plan ap ON ap.case_id = c.id AND ap.id = 53
    JOIN esdc_participant_submission eps ON eps.case_id = c.id AND eps.action_plan_id = ap.id
   WHERE c.id = 94
     AND (
       JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.maritalStatus')) <> 'single'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dependentChildren')) <> '2'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.agesOfChildren')) <> '14, 9'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.socialAssistance')) <> 'no'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.employmentStatus')) <> 'employed-full-time'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationLevel')) <> 'bachelors_degree'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationYear')) <> '2019'
       OR JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationProvince')) <> 'sk'
       OR ap.effective_date <> '2026-04-21'
       OR ap.activated_at <> '2026-04-21 00:00:00'
       OR JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) <> '10'
       OR JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationProvince')) <> '8'
       OR JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.socialAssistanceRecipient')) <> '0'
       OR eps.readiness_status <> 'needs_review'
       OR eps.last_validated_at IS NOT NULL
       OR eps.blocking_issues IS NOT NULL
     );

  IF v_verify_mismatch <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_shayleen_safe_repair verification mismatch';
  END IF;

  UPDATE prod_shayleen_ilmp_safe_repair_audit_20260605 audit
  JOIN iset_case c ON c.id = audit.case_id
  JOIN iset_case_action_plan ap ON ap.id = audit.action_plan_id
  LEFT JOIN esdc_participant_submission eps ON eps.id = audit.esdc_submission_id
     SET audit.after_case_context_json = c.case_context_json,
         audit.after_action_plan_json = ap.esdc_action_plan_json,
         audit.after_action_plan_metadata_json = ap.metadata_json,
         audit.after_effective_date = ap.effective_date,
         audit.after_activated_at = ap.activated_at,
         audit.after_submission_json = CASE
           WHEN eps.id IS NULL THEN NULL
           ELSE JSON_OBJECT(
             'id', eps.id,
             'readiness_status', eps.readiness_status,
             'readiness_summary', eps.readiness_summary,
             'warnings', eps.warnings,
             'blocking_issues', eps.blocking_issues,
             'last_validated_at', eps.last_validated_at,
             'submission_status', eps.submission_status,
             'payload_checksum', eps.payload_checksum,
             'rejection_reason', eps.rejection_reason
           )
         END
   WHERE audit.run_id = v_run_id;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  )
  VALUES (
    94,
    'data_repair',
    'Applied safe ILMP repair for Shayleen McNabb.',
    JSON_OBJECT(
      'runId', v_run_id,
      'restorePoint', v_restore_point,
      'feedbackReportId', 137,
      'caseNumber', 'ISET-20260410-78062A',
      'actionPlanId', 53,
      'esdcSubmissionId', 115,
      'participantDetailsFields', JSON_ARRAY(
        'maritalStatus',
        'dependentChildren',
        'agesOfChildren',
        'socialAssistance',
        'employmentStatus',
        'educationLevel',
        'educationYear',
        'educationProvince'
      ),
      'actionPlanFields', JSON_ARRAY(
        'effective_date',
        'activated_at',
        'esdc_action_plan_json.educationLevel',
        'esdc_action_plan_json.educationProvince',
        'esdc_action_plan_json.socialAssistanceRecipient'
      ),
      'leftForCaseManager', JSON_ARRAY(
        'barrierToEmployment',
        'EIClaimant',
        'previousEmploymentNoc',
        'previousEmploymentNocVersion'
      ),
      'auditTable', 'prod_shayleen_ilmp_safe_repair_audit_20260605'
    ),
    v_repaired_at,
    NULL,
    NULL,
    'codex'
  );

  INSERT INTO admin_feedback_note (
    report_id,
    author_staff_profile_id,
    author_name,
    author_email,
    note_text,
    created_at
  )
  SELECT
    137,
    1,
    'Bill Sillery',
    'bill@sillery.co.uk',
    v_note_text,
    NOW()
  FROM DUAL
  WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 137)
    AND NOT EXISTS (
      SELECT 1
        FROM admin_feedback_note
       WHERE report_id = 137
         AND note_text = v_note_text
    );

  UPDATE admin_feedback_report
     SET status = CASE WHEN status IN ('resolved', 'closed') THEN status ELSE 'in_progress' END,
         updated_at = NOW()
   WHERE id = 137;

  COMMIT;

  SELECT
    v_run_id AS run_id,
    v_restore_point AS restore_point,
    v_case_rows_updated AS case_rows_updated,
    v_plan_rows_updated AS action_plan_rows_updated,
    v_submission_rows_reset AS esdc_submission_rows_reset,
    v_verify_mismatch AS verify_mismatches;

  SELECT
    c.id AS case_id,
    c.case_number,
    CONCAT_WS(' ', cl.first_name, cl.last_name) AS client_name,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.maritalStatus')) AS maritalStatus,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.dependentChildren')) AS dependentChildren,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.agesOfChildren')) AS agesOfChildren,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.socialAssistance')) AS socialAssistance,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.employmentStatus')) AS employmentStatus,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationLevel')) AS educationLevel,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationYear')) AS educationYear,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.educationProvince')) AS educationProvince
  FROM iset_case c
  JOIN client cl ON cl.id = c.client_id
  WHERE c.id = 94;

  SELECT
    ap.id AS action_plan_id,
    ap.status,
    ap.effective_date,
    ap.activated_at,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) AS educationLevel,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationProvince')) AS educationProvince,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.socialAssistanceRecipient')) AS socialAssistanceRecipient,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.BarrierToEmployment')) AS barrierToEmployment,
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.EIClaimant')), CAST(ap.EIClaimant AS CHAR)) AS EIClaimant,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNoc')) AS previousEmploymentNoc,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanPreviousEmploymentNocVersion')) AS previousEmploymentNocVersion
  FROM iset_case_action_plan ap
  WHERE ap.id = 53;

  SELECT
    eps.id AS esdc_submission_id,
    eps.readiness_status,
    eps.last_validated_at,
    eps.blocking_issues,
    eps.warnings
  FROM esdc_participant_submission eps
  WHERE eps.id = 115;
END//

CALL prod_repair_shayleen_mcnabb_ilmp_safe_fields_20260605()//

DROP PROCEDURE IF EXISTS prod_repair_shayleen_mcnabb_ilmp_safe_fields_20260605//

DELIMITER ;
