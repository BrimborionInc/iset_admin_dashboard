-- Move PROD feedback #160 into triage after confirming the intended RM assignment policy.

START TRANSACTION;

SET @report_id := 160;
SET @actor_id := 1;
SET @actor_name := 'Bill Sillery';
SET @actor_email := 'bill@sillery.co.uk';
SET @note := CONCAT(
  'Codex triage 2026-07-19: Bill confirmed the intended policy is that Regional Managers have full case reassignment authority and may assign or reassign a file to any assignable staff member, including another Regional Manager outside their own region. ',
  'Current code restricts an RM target to the RM''s own region in both assignment UIs and in the shared backend ensureCanAssignCase guard; that shared guard also affects conflict-driven reassignment. Report moved to triaging for design review before implementation.'
);

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, r.status, 'triaging', @actor_id, @actor_name, @actor_email, NOW()
  FROM admin_feedback_report r
 WHERE r.id = @report_id
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
 WHERE id = @report_id
   AND status = 'submitted';

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT @report_id, @actor_id, @actor_name, @actor_email, @note, NOW()
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = @report_id)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = @report_id
        AND n.note_text = @note
   );

COMMIT;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = @report_id;

SELECT previous_status, new_status, changed_by_name, changed_by_email, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 3;

SELECT author_name, author_email, note_text, created_at
  FROM admin_feedback_note
 WHERE report_id = @report_id
 ORDER BY id DESC
 LIMIT 3;
