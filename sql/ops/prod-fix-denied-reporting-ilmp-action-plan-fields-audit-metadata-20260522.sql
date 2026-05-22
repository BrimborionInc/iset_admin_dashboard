-- PROD guarded audit-metadata follow-up for denied-reporting ILMP action-plan field repair.
-- Restore point: path-prod-denied-reporting-ilmp-fix-20260522151230
-- Purpose:
-- - The primary repair filled the ILMP-required agreement and education fields.
-- - Add the restore-point marker under dataRepair after MySQL did not create the nested
--   audit object in the original JSON_SET call.

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_ilmp_audit_metadata;

DELIMITER //

CREATE PROCEDURE prod_fix_denied_reporting_ilmp_audit_metadata()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_verified_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case_action_plan ap
   WHERE ap.id BETWEEN 38 AND 47
     AND ap.name = 'Actions leading to denial'
     AND ap.status = 'closed'
     AND ap.agreement_number = '16535841'
     AND ap.funding_stream = 'CRF'
     AND ap.EIClaimant = 3
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backfillRunId')) = 'prod-denied-application-reporting-backfill-20260520'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.educationLevel')) IS NOT NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.actionPlanResultEducationLevel')) IS NOT NULL
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) IS NULL
   FOR UPDATE;

  IF v_guard_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed for denied-reporting ILMP audit metadata follow-up; expected 10 repaired plans.';
  END IF;

  UPDATE iset_case_action_plan ap
     SET ap.esdc_action_plan_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.esdc_action_plan_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.deniedReportingIlmpFix',
           JSON_OBJECT(
             'restorePoint', 'path-prod-denied-reporting-ilmp-fix-20260522151230',
             'reason', 'Fill ILMP-required agreement and education fields omitted by the 2026-05-20 denied-reporting backfill.',
             'auditFollowup', 'Added after primary repair because nested JSON_SET did not create the missing dataRepair parent.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(ap.metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.deniedReportingIlmpFix',
           JSON_OBJECT(
             'restorePoint', 'path-prod-denied-reporting-ilmp-fix-20260522151230',
             'reason', 'Fill ILMP-required agreement and education fields omitted by the 2026-05-20 denied-reporting backfill.',
             'auditFollowup', 'Added after primary repair because nested JSON_SET did not create the missing dataRepair parent.',
             'repairedAtUtc', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         ap.updated_at = NOW()
   WHERE ap.id BETWEEN 38 AND 47
     AND ap.name = 'Actions leading to denial'
     AND ap.status = 'closed'
     AND ap.agreement_number = '16535841'
     AND ap.funding_stream = 'CRF'
     AND ap.EIClaimant = 3
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.source')) = 'denied_reporting'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.backfillRunId')) = 'prod-denied-application-reporting-backfill-20260520'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) IS NULL;

  SET v_updated_count = ROW_COUNT();
  IF v_updated_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denied-reporting ILMP audit metadata follow-up updated an unexpected number of plans.';
  END IF;

  SELECT COUNT(*) INTO v_verified_count
    FROM iset_case_action_plan ap
   WHERE ap.id BETWEEN 38 AND 47
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) = 'path-prod-denied-reporting-ilmp-fix-20260522151230'
     AND JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) = 'path-prod-denied-reporting-ilmp-fix-20260522151230';

  IF v_verified_count <> 10 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Denied-reporting ILMP audit metadata verification failed.';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_fix_denied_reporting_ilmp_audit_metadata();

DROP PROCEDURE IF EXISTS prod_fix_denied_reporting_ilmp_audit_metadata;

SELECT
  ap.id AS plan_id,
  c.case_number,
  JSON_UNQUOTE(JSON_EXTRACT(ap.esdc_action_plan_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) AS esdc_restore_point,
  JSON_UNQUOTE(JSON_EXTRACT(ap.metadata_json, '$.dataRepair.deniedReportingIlmpFix.restorePoint')) AS metadata_restore_point
FROM iset_case_action_plan ap
JOIN iset_case c ON c.id = ap.case_id
WHERE ap.id BETWEEN 38 AND 47
ORDER BY ap.id;
