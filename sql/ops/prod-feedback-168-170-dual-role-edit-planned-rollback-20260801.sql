-- Guarded rollback for the feedback-log qualification update only.
-- This does not modify or roll back application code or assessment data.

SET @actor_email := 'codex@openai.com';

DROP PROCEDURE IF EXISTS prod_feedback_168_170_planned_rollback_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_168_170_planned_rollback_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_history_count INT DEFAULT 0;
  DECLARE v_qualified_at DATETIME DEFAULT NULL;

  START TRANSACTION;

  SELECT COUNT(*), MAX(created_at)
    INTO v_note_count, v_qualified_at
    FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND note_text LIKE 'Codex implementation and qualification update 2026-08-01:%';

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE id IN (168, 170)
     AND status = 'planned'
     AND updated_at = v_qualified_at;

  SELECT COUNT(*)
    INTO v_history_count
    FROM admin_feedback_status_history
   WHERE report_id IN (168, 170)
     AND previous_status = 'triaging'
     AND new_status = 'planned'
     AND changed_by_email = @actor_email
     AND changed_at = v_qualified_at;

  IF v_note_count <> 2 OR v_report_count <> 2 OR v_history_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND created_at = v_qualified_at
     AND note_text LIKE 'Codex implementation and qualification update 2026-08-01:%';
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_notes';
  END IF;

  DELETE FROM admin_feedback_status_history
   WHERE report_id IN (168, 170)
     AND previous_status = 'triaging'
     AND new_status = 'planned'
     AND changed_by_email = @actor_email
     AND changed_at = v_qualified_at;
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'triaging', updated_at = '2026-07-30 20:23:58'
   WHERE id IN (168, 170)
     AND status = 'planned'
     AND updated_at = v_qualified_at;
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_reports';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_168_170_planned_rollback_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_168_170_planned_rollback_20260801;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (168, 170)
 ORDER BY id;
