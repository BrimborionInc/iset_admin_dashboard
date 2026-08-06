-- Release only the exact application-scoped locks acquired for this repair.

DROP PROCEDURE IF EXISTS prod_chrystal_loucks_restore_unlock_20260806;

DELIMITER //

CREATE PROCEDURE prod_chrystal_loucks_restore_unlock_20260806()
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
      SET MESSAGE_TEXT = 'chrystal_loucks_unlock_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id IN (117, 140)
     AND owner_user_id = 'prod-chrystal-loucks-restore-20260806'
   FOR UPDATE;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_unlock_exact_locks_missing';
  END IF;

  DELETE FROM application_lock
   WHERE application_id IN (117, 140)
     AND owner_user_id = 'prod-chrystal-loucks-restore-20260806';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'chrystal_loucks_unlock_delete_failed';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_chrystal_loucks_restore_unlock_20260806();
DROP PROCEDURE prod_chrystal_loucks_restore_unlock_20260806;

SELECT application_id,
       owner_user_id,
       owner_display_name,
       acquired_at,
       expires_at
  FROM application_lock
 WHERE application_id IN (117, 140)
 ORDER BY application_id;
