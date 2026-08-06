-- Guarded PROD triage closeout for feedback #179.
-- Classification: by-design/support-only; reporter opened the wrong queue item.

DROP PROCEDURE IF EXISTS triage_feedback_179;

DELIMITER //

CREATE PROCEDURE triage_feedback_179()
BEGIN
  DECLARE v_report_count INT DEFAULT 0;
  DECLARE v_note_count INT DEFAULT 0;

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
     AND report_type = 'bug'
     AND severity = 'medium'
     AND status = 'submitted'
     AND submitted_by_staff_profile_id = 54
   FOR UPDATE;

  IF v_report_count <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_179_state';
  END IF;

  SELECT COUNT(*)
    INTO v_note_count
    FROM admin_feedback_note
   WHERE report_id = 179
     AND note_text LIKE 'Codex triage 2026-08-06:%';

  IF v_note_count <> 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_179_note_exists';
  END IF;

  INSERT INTO admin_feedback_note
    (report_id, author_staff_profile_id, author_name, author_email, note_text)
  VALUES
    (
      179,
      NULL,
      'Codex',
      NULL,
      CONCAT(
        'Codex triage 2026-08-06: Verified this as a support/navigation issue rather than an edit-permission defect. ',
        'Case 76 / Application 123 is in_review and review workflow 56 is at returned_to_rm after Madison Coppola requested household income on the Financial Overview. ',
        'The Regional Manager path is Home > Pending Review > the application assessment, where Amanda Curtis can review the Decision Maker note and use Forward changes to Coordinator. ',
        'That creates the audited return path and then unlocks assessment editing for the submitting Coordinator. ',
        'The captured URL instead opened Case 76 / Action Plan 3 / Intervention 7 from Pending Completion; that is an already approved/in-progress intervention and is correctly read-only for assessment changes. ',
        'No application, assessment, intervention, or workflow data was changed.'
      )
    );

  INSERT INTO admin_feedback_status_history
    (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email)
  VALUES
    (179, 'submitted', 'closed', NULL, 'Codex', NULL);

  UPDATE admin_feedback_report
     SET status = 'closed'
   WHERE id = 179
     AND status = 'submitted';

  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'guard_failed_feedback_179_update';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL triage_feedback_179();
DROP PROCEDURE IF EXISTS triage_feedback_179;

SELECT id, report_type, severity, status, summary, updated_at
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
