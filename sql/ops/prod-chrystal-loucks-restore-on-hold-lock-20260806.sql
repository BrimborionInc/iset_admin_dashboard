-- Acquire application-scoped PROD locks for Chrystal Loucks' shared case
-- before snapshot/apply.

DROP PROCEDURE IF EXISTS prod_chrystal_loucks_restore_lock_20260806;

DELIMITER //

CREATE PROCEDURE prod_chrystal_loucks_restore_lock_20260806()
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
      SET MESSAGE_TEXT = 'chrystal_loucks_lock_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 117
     AND submission_id = 117
     AND client_id = 69
     AND case_id = 69
     AND status = 'withdrawn'
     AND lifecycle_status = 'closed'
     AND decision_outcome IS NULL
     AND awaiting_reason = 'none'
     AND closure_reason = 'withdrawn'
     AND row_version = 5
     AND updated_at = '2026-08-05 22:15:22'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_lock_application_117_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 140
     AND submission_id = 140
     AND client_id = 69
     AND case_id = 69
     AND status = 'in_review'
     AND lifecycle_status = 'in_review'
     AND decision_outcome IS NULL
     AND awaiting_reason = 'none'
     AND closure_reason IS NULL
     AND row_version = 2
     AND updated_at = '2026-07-09 15:26:20'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_lock_application_140_guard_failed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id IN (117, 140)
     AND expires_at > CURRENT_TIMESTAMP
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_lock_active_lock_exists';
  END IF;

  DELETE FROM application_lock
   WHERE application_id IN (117, 140)
     AND expires_at <= CURRENT_TIMESTAMP;

  INSERT INTO application_lock (
    application_id,
    owner_user_id,
    owner_display_name,
    owner_email,
    acquired_at,
    expires_at,
    metadata
  ) VALUES
    (
      117,
      'prod-chrystal-loucks-restore-20260806',
      'System Administrator recovery',
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL 60 MINUTE,
      '{"source":"prod_chrystal_loucks_restore","caseId":69,"applicationId":117}'
    ),
    (
      140,
      'prod-chrystal-loucks-restore-20260806',
      'System Administrator recovery',
      NULL,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP + INTERVAL 60 MINUTE,
      '{"source":"prod_chrystal_loucks_restore","caseId":69,"applicationId":140}'
    );
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_lock_insert_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_chrystal_loucks_restore_lock_20260806();
DROP PROCEDURE prod_chrystal_loucks_restore_lock_20260806;

SELECT application_id,
       owner_user_id,
       owner_display_name,
       owner_email,
       acquired_at,
       expires_at
  FROM application_lock
 WHERE application_id IN (117, 140)
 ORDER BY application_id;
