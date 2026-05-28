-- PROD guarded data repair for denied-reporting action plan result education.
-- Target:
-- - Case MI-MOD8SONV-D56651
-- - Action plan 55, "Actions leading to denial"
-- - Source denied_reporting
--
-- Purpose:
-- - The denied-reporting generator carried the applicant's bachelor's degree into
--   action-plan start education, but missed actionPlanResultEducationLevel because
--   a display-label education variant was not recognized by the mapper.
-- - For reporting-only denial plans, result education should match start education.
--
-- Expected effect:
-- - Exactly one action plan updated.
-- - esdc_action_plan_json.actionPlanResultEducationLevel becomes "10".
-- - Audit metadata is added under both esdc_action_plan_json and metadata_json.

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_plan55_result_education;

DELIMITER //

CREATE PROCEDURE prod_fix_denied_reporting_plan55_result_education()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_verified_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_plan55_result_education;
  CREATE TEMPORARY TABLE tmp_denied_reporting_plan55_result_education AS
  SELECT
    ap.id AS action_plan_id,
    ap.case_id,
    c.case_number,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')) AS highest_education,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) AS existing_start_education,
    JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) AS existing_result_education,
    CASE LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')))
      WHEN 'no_formal_education' THEN '1'
      WHEN 'grade_7_8' THEN '2'
      WHEN 'up_to_grade_7_8' THEN '2'
      WHEN 'grade_9_10' THEN '3'
      WHEN 'grade_11_12' THEN '4'
      WHEN 'secondary_school_diploma_or_ged' THEN '5'
      WHEN 'post_secondary_training' THEN '6'
      WHEN 'apprenticeship_trades' THEN '7'
      WHEN 'cegep' THEN '8'
      WHEN 'college' THEN '8'
      WHEN 'university_certificate' THEN '9'
      WHEN 'bachelors_degree' THEN '10'
      WHEN 'masters_degree' THEN '11'
      WHEN 'doctorate' THEN '12'
      WHEN 'doctorate_degree' THEN '12'
      ELSE NULL
    END AS mapped_education_level
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE ap.id = 55
    AND c.case_number = 'MI-MOD8SONV-D56651'
    AND ap.name = 'Actions leading to denial'
    AND ap.status = 'closed'
    AND ap.agreement_number = '16535841'
    AND ap.funding_stream = 'CRF'
    AND ap.EIClaimant = 3
    AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
    AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) IS NULL;

  SELECT COUNT(*) INTO v_guard_count
    FROM tmp_denied_reporting_plan55_result_education
   WHERE mapped_education_level = '10'
     AND existing_start_education = mapped_education_level
     AND highest_education = 'bachelors_degree';

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for plan 55 result education repair; expected exactly one bachelor-degree denied-reporting plan.';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan ap
    JOIN iset_case c ON c.id = ap.case_id
    JOIN tmp_denied_reporting_plan55_result_education fix ON fix.action_plan_id = ap.id
   WHERE ap.id = 55
     AND c.case_number = 'MI-MOD8SONV-D56651'
     AND ap.name = 'Actions leading to denial'
     AND ap.status = 'closed'
     AND ap.agreement_number = '16535841'
     AND ap.funding_stream = 'CRF'
     AND ap.EIClaimant = 3
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) = fix.mapped_education_level
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) IS NULL
   FOR UPDATE;

  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Lock guard failed for plan 55 result education repair.';
  END IF;

  UPDATE iset_case_action_plan ap
  JOIN tmp_denied_reporting_plan55_result_education fix ON fix.action_plan_id = ap.id
     SET ap.esdc_action_plan_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.esdc_action_plan_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.actionPlanResultEducationLevel',
           fix.mapped_education_level,
           '$.dataRepair.deniedReportingPlan55ResultEducationFix',
           JSON_OBJECT(
             'reason', 'Set reporting-only denial result education to match action-plan start education after mapper missed bachelors_degree label variant.',
             'caseNumber', fix.case_number,
             'actionPlanId', fix.action_plan_id,
             'highestEducation', fix.highest_education,
             'educationLevelCode', fix.mapped_education_level,
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.deniedReportingPlan55ResultEducationFix',
           JSON_OBJECT(
             'reason', 'Set reporting-only denial result education to match action-plan start education after mapper missed bachelors_degree label variant.',
             'caseNumber', fix.case_number,
             'actionPlanId', fix.action_plan_id,
             'highestEducation', fix.highest_education,
             'educationLevelCode', fix.mapped_education_level,
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.updated_at = NOW()
   WHERE ap.id = 55;

  SET v_updated_count = ROW_COUNT();
  IF v_updated_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Plan 55 result education repair updated an unexpected number of rows.';
  END IF;

  SELECT COUNT(*) INTO v_verified_count
    FROM iset_case_action_plan ap
    JOIN iset_case c ON c.id = ap.case_id
   WHERE ap.id = 55
     AND c.case_number = 'MI-MOD8SONV-D56651'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) = '10'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) = '10'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingPlan55ResultEducationFix.educationLevelCode')) = '10'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair.deniedReportingPlan55ResultEducationFix.educationLevelCode')) = '10';

  IF v_verified_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Plan 55 result education repair verification failed.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_denied_reporting_plan55_result_education();

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_plan55_result_education;

SELECT
  ap.id AS action_plan_id,
  c.case_number,
  ap.agreement_number,
  ap.funding_stream,
  ap.EIClaimant,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) AS education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) AS result_education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingPlan55ResultEducationFix.repairedAtUtc')) AS repaired_at_utc
FROM iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
WHERE ap.id = 55
  AND c.case_number = 'MI-MOD8SONV-D56651';
