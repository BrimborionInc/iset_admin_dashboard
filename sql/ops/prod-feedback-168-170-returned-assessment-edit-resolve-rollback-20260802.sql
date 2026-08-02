-- Guarded rollback for the feedback-log closeout only.
-- This does not roll back the deployed application artifact.

SET @actor_email := 'codex@openai.com';
SET @note_prefix := 'Codex PROD closeout 2026-08-02: Release 20260801-returned-assessment-edit';

DROP PROCEDURE IF EXISTS prod_feedback_168_170_resolve_rollback_20260802;

DELIMITER //

CREATE PROCEDURE prod_feedback_168_170_resolve_rollback_20260802()
BEGIN
  DECLARE v_resolved_at DATETIME DEFAULT NULL;
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_history_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

  SELECT MIN(created_at)
    INTO v_resolved_at
    FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND note_text LIKE CONCAT(@note_prefix, '%');

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE id IN (168, 170)
     AND status = 'resolved'
     AND updated_at = v_resolved_at;

  SELECT COUNT(*)
    INTO v_history_count
    FROM admin_feedback_status_history
   WHERE report_id IN (168, 170)
     AND previous_status = 'planned'
     AND new_status = 'resolved'
     AND changed_by_email = @actor_email
     AND changed_at = v_resolved_at;

  SELECT COUNT(*)
    INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND created_at = v_resolved_at
     AND note_text LIKE CONCAT(@note_prefix, '%');

  IF v_resolved_at IS NULL OR v_report_count <> 2 OR v_history_count <> 2 OR v_note_count <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_closeout_rollback';
  END IF;

  START TRANSACTION;

  DELETE FROM admin_feedback_note
   WHERE report_id IN (168, 170)
     AND author_email = @actor_email
     AND created_at = v_resolved_at
     AND note_text LIKE CONCAT(@note_prefix, '%');

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_notes';
  END IF;

  DELETE FROM admin_feedback_status_history
   WHERE report_id IN (168, 170)
     AND previous_status = 'planned'
     AND new_status = 'resolved'
     AND changed_by_email = @actor_email
     AND changed_at = v_resolved_at;

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'planned', updated_at = '2026-08-01 14:41:49'
   WHERE id IN (168, 170)
     AND status = 'resolved'
     AND updated_at = v_resolved_at;

  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_168_170_rollback_reports';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_168_170_resolve_rollback_20260802();
DROP PROCEDURE IF EXISTS prod_feedback_168_170_resolve_rollback_20260802;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (168, 170)
 ORDER BY id;
