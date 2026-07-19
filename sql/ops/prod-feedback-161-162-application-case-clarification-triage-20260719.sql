-- Record initial triage for Amanda Curtis's application/case clarification reports.

START TRANSACTION;

SET @actor_id := 1;
SET @actor_name := 'Bill Sillery';
SET @actor_email := 'bill@sillery.co.uk';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, r.status, 'triaging', @actor_id, @actor_name, @actor_email, NOW()
  FROM admin_feedback_report r
 WHERE r.id IN (161, 162)
   AND r.status = 'submitted'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'submitted'
        AND h.new_status = 'triaging'
   );

UPDATE admin_feedback_report
   SET status = 'triaging', updated_at = NOW()
 WHERE id IN (161, 162)
   AND status = 'submitted';

SET @note_161 := CONCAT(
  'Codex triage 2026-07-19: Confirmed this report was submitted by Amanda Curtis (active Regional Manager staff profile 54). ',
  'Ashlee Barner activated her PATH account on 2026-04-13 and separately submitted application ISET-20260414-82726E on 2026-04-14. Account activation is client/account activity and does not create an application. ',
  'The client file is currently moving toward closure rather than closed, while the submitted application remains under review. Current evidence therefore suggests possible confusion between the client-file and application lifecycles rather than a proven defect. ',
  'Bill is emailing Amanda to ask whether Ashlee submitted the application accidentally while trying to access PATH or whether it is a valid application that Amanda no longer needs in her current work list. Keep open in triaging pending her answer; no application or client data has been changed.'
);

SET @note_162 := CONCAT(
  'Codex triage 2026-07-19: Confirmed this report was submitted by Amanda Curtis (active Regional Manager staff profile 54). ',
  'Mya Somerville activated her PATH account on 2026-04-13 and separately submitted application ISET-20260428-17825F on 2026-04-28, fifteen days later. Account activation is client/account activity and does not create an application. ',
  'The client file is active and the submitted application remains under review. Current evidence therefore suggests possible confusion between the client-file and application lifecycles rather than a proven defect. ',
  'Bill is emailing Amanda to ask whether Mya submitted the application accidentally while trying to access PATH or whether it is a valid application that Amanda no longer needs in her current work list. Keep open in triaging pending her answer; no application or client data has been changed.'
);

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 161, @actor_id, @actor_name, @actor_email, @note_161, NOW()
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 161)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note WHERE report_id = 161 AND note_text = @note_161
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 162, @actor_id, @actor_name, @actor_email, @note_162, NOW()
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 162)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note WHERE report_id = 162 AND note_text = @note_162
   );

COMMIT;

SELECT id, status, summary, submitted_by_email, updated_at
  FROM admin_feedback_report
 WHERE id IN (161, 162)
 ORDER BY id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id IN (161, 162)
 ORDER BY report_id, id DESC;

SELECT report_id, author_name, note_text, created_at
  FROM admin_feedback_note
 WHERE report_id IN (161, 162)
 ORDER BY report_id, id DESC;
