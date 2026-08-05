-- Acquire an application-scoped PROD lock before snapshot/apply for feedback #178.

DROP PROCEDURE IF EXISTS prod_feedback_178_lock_20260805;

DELIMITER //

CREATE PROCEDURE prod_feedback_178_lock_20260805()
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
      SET MESSAGE_TEXT = 'feedback_178_lock_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 61
     AND case_id = 138
     AND client_id = 160
     AND status = 'approved'
     AND lifecycle_status = 'decision_recorded'
     AND decision_outcome = 'approved'
     AND awaiting_reason = 'none'
     AND closure_reason IS NULL
     AND row_version = 40
     AND updated_at = '2026-08-04 18:12:27'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_lock_application_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id = 61
     AND expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_lock_active_lock_exists';
  END IF;

  DELETE FROM application_lock
   WHERE application_id = 61
     AND expires_at <= CURRENT_TIMESTAMP;

  INSERT INTO application_lock (
    application_id,
    owner_user_id,
    owner_display_name,
    owner_email,
    acquired_at,
    expires_at,
    metadata
  ) VALUES (
    61,
    'prod-feedback-178-recovery-20260805',
    'System Administrator recovery',
    NULL,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL 60 MINUTE,
    '{"source":"prod_feedback_178_recovery","caseId":138,"feedbackReportId":178}'
  );
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'feedback_178_lock_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_178_lock_20260805();
DROP PROCEDURE prod_feedback_178_lock_20260805;

SELECT application_id,
       owner_user_id,
       owner_display_name,
       owner_email,
       acquired_at,
       expires_at
  FROM application_lock
 WHERE application_id = 61;
