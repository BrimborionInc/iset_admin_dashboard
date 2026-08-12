-- Recovery artifact for the exact feedback #181 closeout made by the paired
-- 2026-08-10 apply artifact. Do not execute unless that update must be undone.

DROP PROCEDURE IF EXISTS prod_feedback_181_document_upload_resolve_rollback_20260810;

DELIMITER //

CREATE PROCEDURE prod_feedback_181_document_upload_resolve_rollback_20260810()
BEGIN
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_history_count INT DEFAULT 0;
  DECLARE v_current_status VARCHAR(32) DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT status
    INTO v_current_status
    FROM admin_feedback_report
   WHERE id = 181
     AND report_type = 'bug'
     AND summary = 'Failed to upload documents'
   FOR UPDATE;

  SELECT COUNT(*)
    INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 181
     AND author_email = 'codex@openai.com'
     AND note_text LIKE 'Codex resolved 2026-08-10 feedback 181:%';

  SELECT COUNT(*)
    INTO v_history_count
    FROM admin_feedback_status_history
   WHERE report_id = 181
     AND previous_status = 'submitted'
     AND new_status = 'resolved'
     AND changed_by_email = 'codex@openai.com';

  IF v_current_status IS NULL OR v_current_status <> 'resolved' OR
     v_note_count <> 1 OR v_history_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_181_rollback_state';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE report_id = 181
     AND author_email = 'codex@openai.com'
     AND note_text LIKE 'Codex resolved 2026-08-10 feedback 181:%';

  DELETE FROM admin_feedback_status_history
   WHERE report_id = 181
     AND previous_status = 'submitted'
     AND new_status = 'resolved'
     AND changed_by_email = 'codex@openai.com';

  UPDATE admin_feedback_report
     SET status = 'submitted'
   WHERE id = 181
     AND status = 'resolved';

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_181_document_upload_resolve_rollback_20260810();
DROP PROCEDURE IF EXISTS prod_feedback_181_document_upload_resolve_rollback_20260810;

SELECT id,
       report_type,
       severity,
       status,
       summary,
       updated_at
  FROM admin_feedback_report
 WHERE id = 181;
