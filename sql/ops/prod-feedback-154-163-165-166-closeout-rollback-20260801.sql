-- Guarded rollback for the 2026-08-01 feedback-log closeout only.
-- This does not reverse any earlier application, message, case, or document repair.

SET @actor_email := 'codex@openai.com';

DROP PROCEDURE IF EXISTS prod_feedback_154_163_165_166_closeout_rollback_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_154_163_165_166_closeout_rollback_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_history_count INT DEFAULT 0;
  DECLARE v_closeout_at DATETIME DEFAULT NULL;

  START TRANSACTION;

  SELECT COUNT(*), MAX(created_at)
    INTO v_note_count, v_closeout_at
    FROM admin_feedback_note
   WHERE report_id IN (154, 163, 165, 166)
     AND author_email = @actor_email
     AND note_text LIKE 'Codex queue closeout 2026-08-01:%';

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE (id = 154 AND status = 'resolved' AND updated_at = v_closeout_at)
      OR (id = 163 AND status = 'closed' AND updated_at = v_closeout_at)
      OR (id = 165 AND status = 'resolved' AND updated_at = v_closeout_at)
      OR (id = 166 AND status = 'resolved' AND updated_at = v_closeout_at);

  SELECT COUNT(*)
    INTO v_history_count
    FROM admin_feedback_status_history
   WHERE changed_by_email = @actor_email
     AND changed_at = v_closeout_at
     AND (
       (report_id = 154 AND previous_status = 'in_progress' AND new_status = 'resolved')
       OR (report_id = 163 AND previous_status = 'triaging' AND new_status = 'closed')
       OR (report_id = 165 AND previous_status = 'in_progress' AND new_status = 'resolved')
       OR (report_id = 166 AND previous_status = 'in_progress' AND new_status = 'resolved')
     );

  IF v_note_count <> 4 OR v_report_count <> 4 OR v_history_count <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_rollback';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE report_id IN (154, 163, 165, 166)
     AND author_email = @actor_email
     AND created_at = v_closeout_at
     AND note_text LIKE 'Codex queue closeout 2026-08-01:%';
  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_rollback_notes';
  END IF;

  DELETE FROM admin_feedback_status_history
   WHERE changed_by_email = @actor_email
     AND changed_at = v_closeout_at
     AND (
       (report_id = 154 AND previous_status = 'in_progress' AND new_status = 'resolved')
       OR (report_id = 163 AND previous_status = 'triaging' AND new_status = 'closed')
       OR (report_id = 165 AND previous_status = 'in_progress' AND new_status = 'resolved')
       OR (report_id = 166 AND previous_status = 'in_progress' AND new_status = 'resolved')
     );
  IF ROW_COUNT() <> 4 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_closeout_rollback_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress', updated_at = '2026-07-05 13:47:29'
   WHERE id = 154 AND status = 'resolved' AND updated_at = v_closeout_at;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_154_rollback';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'triaging', updated_at = '2026-07-23 15:33:44'
   WHERE id = 163 AND status = 'closed' AND updated_at = v_closeout_at;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_163_rollback';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress', updated_at = '2026-07-27 12:45:44'
   WHERE id = 165 AND status = 'resolved' AND updated_at = v_closeout_at;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_165_rollback';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'in_progress', updated_at = '2026-07-27 12:09:47'
   WHERE id = 166 AND status = 'resolved' AND updated_at = v_closeout_at;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_166_rollback';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_154_163_165_166_closeout_rollback_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_154_163_165_166_closeout_rollback_20260801;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (154, 163, 165, 166)
 ORDER BY id;
