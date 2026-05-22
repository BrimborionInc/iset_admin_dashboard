-- PROD guarded data repair for denied-reporting ILMP action-plan fields.
-- Restore point: path-prod-denied-reporting-ilmp-fix-20260522151230
-- Purpose:
-- - The 2026-05-20 denied-reporting PROD backfill created closed "Actions leading to denial"
--   plans with actionPlanResultCode/actionPlanResultDate only.
-- - ILMP validation requires a real EI/CRF agreement number, action-plan start
--   education level, and result education level for those closed plans.
-- - For denial-reporting records with no explicit EI claimant value, use CRF / EIClaimant=3.

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_ilmp_action_plan_fields;

DELIMITER //

CREATE PROCEDURE prod_fix_denied_reporting_ilmp_action_plan_fields()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_verified_count INT DEFAULT 0;

  DROP TEMPORARY TABLE IF EXISTS tmp_denied_reporting_ilmp_fix;
  CREATE TEMPORARY TABLE tmp_denied_reporting_ilmp_fix AS
  SELECT
    ap.id AS action_plan_id,
    ap.case_id,
    ap.application_id,
    c.case_number,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')) AS highest_education,
    JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')) AS education_location,
    CASE LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."highest-education"')))
      WHEN 'no_formal_education' THEN '1'
      WHEN 'up_to_grade_7_8' THEN '2'
      WHEN 'grade_9_10' THEN '3'
      WHEN 'grade_11_12' THEN '4'
      WHEN 'secondary_school_diploma_or_ged' THEN '5'
      WHEN 'post_secondary_training' THEN '6'
      WHEN 'apprenticeship_trades' THEN '7'
      WHEN 'college' THEN '8'
      WHEN 'university_certificate' THEN '9'
      WHEN 'bachelors_degree' THEN '10'
      WHEN 'masters_degree' THEN '11'
      WHEN 'doctorate_degree' THEN '12'
      ELSE NULL
    END AS education_level_code,
    CASE UPPER(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."education-location"')))
      WHEN 'NL' THEN '1'
      WHEN 'NS' THEN '2'
      WHEN 'NB' THEN '3'
      WHEN 'PE' THEN '4'
      WHEN 'QC' THEN '5'
      WHEN 'ON' THEN '6'
      WHEN 'MB' THEN '7'
      WHEN 'SK' THEN '8'
      WHEN 'AB' THEN '9'
      WHEN 'NT' THEN '10'
      WHEN 'BC' THEN '11'
      WHEN 'YT' THEN '12'
      WHEN 'US' THEN '13'
      WHEN 'OT' THEN '14'
      WHEN 'NU' THEN '16'
      ELSE NULL
    END AS education_province_code,
    CASE LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."labour-force-status"')))
      WHEN 'unemployed' THEN '1'
      WHEN 'underemployed' THEN '1'
      WHEN 'student' THEN '9'
      WHEN 'employed-full-time' THEN '2'
      WHEN 'employed-part-time' THEN '2'
      WHEN 'self-employed' THEN '2'
      ELSE NULL
    END AS prev_employment_code,
    CASE LOWER(JSON_UNQUOTE(JSON_EXTRACT(c.case_context_json, '$.applicationAnswers."social-assistance"')))
      WHEN '1' THEN '1'
      WHEN 'true' THEN '1'
      WHEN 'yes' THEN '1'
      WHEN '0' THEN '0'
      WHEN 'false' THEN '0'
      WHEN 'no' THEN '0'
      ELSE NULL
    END AS social_assistance_code
  FROM iset_case_action_plan ap
  JOIN iset_case c ON c.id = ap.case_id
  WHERE ap.id BETWEEN 38 AND 47
    AND ap.name = 'Actions leading to denial'
    AND ap.status = 'closed'
    AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
    AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backfillRunId')) = 'prod-denied-application-reporting-backfill-20260520'
    AND (
      ap.agreement_number IS NULL
      OR ap.funding_stream IS NULL
      OR ap.EIClaimant IS NULL
      OR JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel') IS NULL
      OR JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel') IS NULL
    );

  SELECT COUNT(*) INTO v_guard_count
    FROM tmp_denied_reporting_ilmp_fix
   WHERE education_level_code IS NOT NULL;

  IF v_guard_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for denied-reporting ILMP repair; expected 10 repairable plans with education codes.';
  END IF;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan ap
    JOIN tmp_denied_reporting_ilmp_fix fix ON fix.action_plan_id = ap.id
   WHERE ap.name = 'Actions leading to denial'
     AND ap.status = 'closed'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backfillRunId')) = 'prod-denied-application-reporting-backfill-20260520'
   FOR UPDATE;

  IF v_guard_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Lock guard failed for denied-reporting ILMP repair; expected 10 target plans.';
  END IF;

  UPDATE iset_case_action_plan ap
  JOIN tmp_denied_reporting_ilmp_fix fix ON fix.action_plan_id = ap.id
     SET ap.agreement_number = '16535841',
         ap.funding_stream = 'CRF',
         ap.EIClaimant = 3,
         ap.prev_employment = COALESCE(ap.prev_employment, fix.prev_employment_code),
         ap.esdc_action_plan_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.esdc_action_plan_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.agreementNumber', '16535841',
           '$.fundingStream', 'CRF',
           '$.EIClaimant', '3',
           '$.educationLevel', fix.education_level_code,
           '$.educationProvince', fix.education_province_code,
           '$.socialAssistanceRecipient', fix.social_assistance_code,
           '$.actionPlanPreviousEmployment', fix.prev_employment_code,
           '$.actionPlanResultEducationLevel', fix.education_level_code,
           '$.dataRepair.deniedReportingIlmpFix', JSON_OBJECT(
             'restorePoint', 'path-prod-denied-reporting-ilmp-fix-20260522151230',
             'reason', 'Fill ILMP-required agreement and education fields omitted by the 2026-05-20 denied-reporting backfill.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.agreementNumber', '16535841',
           '$.fundingStream', 'CRF',
           '$.EIClaimant', '3',
           '$.educationLevel', fix.education_level_code,
           '$.actionPlanResultEducationLevel', fix.education_level_code,
           '$.dataRepair.deniedReportingIlmpFix', JSON_OBJECT(
             'restorePoint', 'path-prod-denied-reporting-ilmp-fix-20260522151230',
             'reason', 'Fill ILMP-required agreement and education fields omitted by the 2026-05-20 denied-reporting backfill.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.updated_at = NOW();

  SET v_updated_count = ROW_COUNT();
  IF v_updated_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denied-reporting ILMP repair updated an unexpected number of action plans.';
  END IF;

  SELECT COUNT(*) INTO v_verified_count
    FROM iset_case_action_plan ap
    JOIN tmp_denied_reporting_ilmp_fix fix ON fix.action_plan_id = ap.id
   WHERE ap.agreement_number = '16535841'
     AND ap.funding_stream = 'CRF'
     AND ap.EIClaimant = 3
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.agreementNumber')) = '16535841'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.fundingStream')) = 'CRF'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.EIClaimant')) = '3'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) = fix.education_level_code
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) = fix.education_level_code;

  IF v_verified_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denied-reporting ILMP repair verification failed.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_denied_reporting_ilmp_action_plan_fields();

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_ilmp_action_plan_fields;

SELECT
  ap.id AS plan_id,
  c.case_number,
  ap.agreement_number,
  ap.funding_stream,
  ap.EIClaimant,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) AS education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationProvince')) AS education_province,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) AS result_education_level,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) AS restore_point
FROM iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
WHERE ap.id BETWEEN 38 AND 47
ORDER BY ap.id;
