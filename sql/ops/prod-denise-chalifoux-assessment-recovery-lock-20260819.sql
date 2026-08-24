-- Acquire an exact application lock for Denise Chalifoux application 31.
-- Run only after the same-turn PROD identity, DDL, and preview checks.

DROP PROCEDURE IF EXISTS prod_denise_chalifoux_assessment_recovery_20260819;

DELIMITER //

CREATE PROCEDURE prod_denise_chalifoux_assessment_recovery_20260819()
BEGIN
  DECLARE v_guard_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF BINARY DATABASE() <> BINARY 'iset_intake' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_lock_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE iset_application.id = 31
     AND iset_application.submission_id = 31
     AND iset_application.client_id = 108
     AND iset_application.case_id = 113
     AND iset_application.status = 'in_review'
     AND iset_application.lifecycle_status = 'in_review'
     AND iset_application.decision_outcome IS NULL
     AND iset_application.awaiting_reason = 'none'
     AND iset_application.closure_reason IS NULL
     AND iset_application.row_version = 28
     AND iset_application.updated_at = '2026-08-19 13:54:53'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_lock_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_review_workflow
   WHERE iset_review_workflow.id = 59
     AND iset_review_workflow.application_id = 31
     AND iset_review_workflow.current_stage = 'final_decision_recorded'
     AND iset_review_workflow.nwac_decision = 'denied'
     AND iset_review_workflow.updated_at = '2026-08-19 13:18:48'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_lock_workflow_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_lock.application_id = 31
     AND application_lock.expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_lock_active_lock_exists';
  END IF;

  DELETE FROM application_lock
   WHERE application_lock.application_id = 31
     AND application_lock.expires_at <= CURRENT_TIMESTAMP;

  INSERT INTO application_lock (
    application_id,
    owner_user_id,
    owner_display_name,
    owner_email,
    acquired_at,
    expires_at,
    metadata
  ) VALUES (
    31,
    'prod-denise-assessment-recovery-20260819',
    'System Administrator accidental-denial recovery',
    NULL,
    CURRENT_TIMESTAMP,
    DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 120 MINUTE),
    '{"source":"prod_denise_assessment_recovery","caseId":113,"applicationId":31,"snapshotId":"path-prod-denise-assessment-recovery-20260819-150930"}'
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_lock_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_denise_chalifoux_assessment_recovery_20260819();
DROP PROCEDURE prod_denise_chalifoux_assessment_recovery_20260819;

SELECT application_lock.application_id,
       application_lock.owner_user_id,
       application_lock.owner_display_name,
       application_lock.owner_email,
       application_lock.acquired_at,
       application_lock.expires_at,
       application_lock.metadata
  FROM application_lock
 WHERE application_lock.application_id = 31;
