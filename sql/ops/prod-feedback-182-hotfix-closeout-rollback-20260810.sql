-- Guarded rollback for the feedback #182 log update only.
-- Use only if the feedback status/history/note update must be reversed.
-- This does not roll back the deployed application release.

DROP PROCEDURE IF EXISTS prod_feedback_182_hotfix_rollback_20260810;

DELIMITER //

CREATE PROCEDURE prod_feedback_182_hotfix_rollback_20260810()
BEGIN
  DECLARE v_report_id INT DEFAULT NULL;
  DECLARE v_note_count INT DEFAULT 0;
  DECLARE v_note_id INT DEFAULT NULL;
  DECLARE v_history_count INT DEFAULT 0;
  DECLARE v_history_id INT DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT r.id
    INTO v_report_id
    FROM admin_feedback_report AS r
   WHERE r.id = 182
     AND r.report_type = 'bug'
     AND r.severity = 'medium'
     AND r.status = 'in_progress'
     AND r.summary = 'Alyssa''s Approval Letter'
     AND r.submitted_by_staff_profile_id = 60
     AND r.submitted_by_email = 'iset@mmvi.ca'
     AND r.submitted_at = '2026-08-10 18:10:36'
   FOR UPDATE;

  SELECT COUNT(*), MAX(n.id)
    INTO v_note_count, v_note_id
    FROM admin_feedback_note AS n
   WHERE n.report_id = 182
     AND n.author_email = 'codex@openai.com'
     AND n.note_text LIKE 'Codex deployment update 2026-08-10 feedback 182:%';

  SELECT COUNT(*), MAX(h.id)
    INTO v_history_count, v_history_id
    FROM admin_feedback_status_history AS h
   WHERE h.report_id = 182
     AND h.previous_status = 'submitted'
     AND h.new_status = 'in_progress'
     AND h.changed_by_email = 'codex@openai.com';

  IF v_report_id IS NULL OR v_note_count <> 1 OR v_history_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_rollback_state';
  END IF;

  DELETE FROM admin_feedback_note
   WHERE id = v_note_id
     AND report_id = 182;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_rollback_note';
  END IF;

  DELETE FROM admin_feedback_status_history
   WHERE id = v_history_id
     AND report_id = 182;

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_rollback_history';
  END IF;

  UPDATE admin_feedback_report
     SET status = 'submitted',
         updated_at = '2026-08-10 18:10:36'
   WHERE id = 182
     AND status = 'in_progress';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_182_rollback_report';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_feedback_182_hotfix_rollback_20260810();
DROP PROCEDURE IF EXISTS prod_feedback_182_hotfix_rollback_20260810;

SELECT
  r.id,
  r.status,
  r.updated_at
FROM admin_feedback_report AS r
WHERE r.id = 182;

SELECT
  h.id,
  h.report_id,
  h.previous_status,
  h.new_status,
  h.changed_by_email,
  h.changed_at
FROM admin_feedback_status_history AS h
WHERE h.report_id = 182
ORDER BY h.id DESC
LIMIT 3;

SELECT
  n.id,
  n.report_id,
  n.author_email,
  n.note_text,
  n.created_at
FROM admin_feedback_note AS n
WHERE n.report_id = 182
ORDER BY n.id DESC
LIMIT 3;
