-- Guarded rollback for the feedback #171 closeout only.
-- Use only if the feedback-log status/note/history closeout must be reversed.
-- This does not roll back the deployed application release.

SET @actor_email := 'codex@openai.com';
SET @release_id := '20260801-assessment-document-lineage-r2';

DROP PROCEDURE IF EXISTS prod_feedback_171_closeout_rollback_20260801;

DELIMITER //

CREATE PROCEDURE prod_feedback_171_closeout_rollback_20260801()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_status VARCHAR(32) DEFAULT NULL;
  DECLARE v_note_id BIGINT DEFAULT NULL;
  DECLARE v_note_at DATETIME DEFAULT NULL;
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_history_id BIGINT DEFAULT NULL;
  DECLARE v_history_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*), MAX(status)
    INTO v_report_count, v_status
    FROM admin_feedback_report
   WHERE id = 171
     AND report_type = 'bug'
     AND summary = 'Assessment Required'
     AND page_url = 'https://nwac-console.awentech.ca/application-case/76'
   FOR UPDATE;

  SELECT COUNT(*), MAX(id), MAX(created_at)
    INTO v_note_count, v_note_id, v_note_at
    FROM admin_feedback_note
   WHERE report_id = 171
     AND author_email = @actor_email
     AND note_text LIKE CONCAT('Codex resolved 2026-08-01 after deployed verification: Release ', @release_id, '%');

  SELECT COUNT(*), MAX(id)
    INTO v_history_count, v_history_id
    FROM admin_feedback_status_history
   WHERE report_id = 171
     AND previous_status = 'planned'
     AND new_status = 'resolved'
     AND changed_by_email = @actor_email
     AND changed_at = v_note_at;

  IF v_report_count <> 1
     OR v_status <> 'resolved'
     OR v_note_count <> 1
     OR v_history_count <> 1
     OR NOT EXISTS (
       SELECT 1
         FROM admin_feedback_report
        WHERE id = 171
          AND updated_at = v_note_at
     ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_closeout_rollback';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE id = v_note_id
     AND report_id = 171;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_rollback_note';
  END IF;

  DELETE FROM admin_feedback_status_history
   WHERE id = v_history_id
     AND report_id = 171;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_rollback_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'planned',
         updated_at = '2026-07-31 19:37:21'
   WHERE id = 171
     AND status = 'resolved'
     AND updated_at = v_note_at;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_171_rollback_report';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_171_closeout_rollback_20260801();

DROP PROCEDURE IF EXISTS prod_feedback_171_closeout_rollback_20260801;

SELECT id, report_type, severity, status, summary, page_url, updated_at
  FROM admin_feedback_report
 WHERE id = 171;

SELECT id, report_id, previous_status, new_status,
       changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 5;

SELECT id, report_id, author_name, author_email, created_at,
       LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 171
 ORDER BY id DESC
 LIMIT 5;
