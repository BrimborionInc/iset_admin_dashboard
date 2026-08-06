-- Reopen feedback #179 because the reporter has not yet received the triage response.
DROP PROCEDURE IF EXISTS reopen_feedback_179;

DELIMITER //

CREATE PROCEDURE reopen_feedback_179()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT COUNT(*)
    INTO v_report_count
    FROM admin_feedback_report
   WHERE id = 179
     AND status = 'closed'
     AND submitted_by_staff_profile_id = 54
   FOR UPDATE;

  IF v_report_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_179_closed_state';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text)
  VALUES
    (
      179,
      NULL,
      'Codex',
      NULL,
      'Codex correction 2026-08-06: Reopened because the reporter has not yet received the verified workflow instructions. Keep this item open until Amanda Curtis has been told to open the returned application assessment from Pending Review and use Forward changes to Coordinator, and that communication has been confirmed.'
    );

  INSERT INTO admin_feedback_status_history
    (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
  VALUES
    (179, 'closed', 'in_progress', NULL, 'Codex', NULL);

  UPDATE admin_feedback_report
     SET status = 'in_progress'
   WHERE id = 179
     AND status = 'closed';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_179_reopen_update';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL reopen_feedback_179();
DROP PROCEDURE IF EXISTS reopen_feedback_179;

SELECT id, status, updated_at
FROM admin_feedback_report
WHERE id = 179;

SELECT id, report_id, author_name, note_text, created_at
FROM admin_feedback_note
WHERE report_id = 179
ORDER BY id;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
FROM admin_feedback_status_history
WHERE report_id = 179
ORDER BY id;
