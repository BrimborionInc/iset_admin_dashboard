-- Fail-safe cleanup for the exact recovery lock. Use only if apply fails.

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
      SET MESSAGE_TEXT = 'denise_recovery_unlock_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_lock.application_id = 31
     AND application_lock.owner_user_id = 'prod-denise-assessment-recovery-20260819'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_unlock_guard_failed';
  END IF;

  DELETE FROM application_lock
   WHERE application_lock.application_id = 31
     AND application_lock.owner_user_id = 'prod-denise-assessment-recovery-20260819';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'denise_recovery_unlock_delete_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_denise_chalifoux_assessment_recovery_20260819();
DROP PROCEDURE prod_denise_chalifoux_assessment_recovery_20260819;

SELECT application_lock.application_id,
       application_lock.owner_user_id,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 31;
