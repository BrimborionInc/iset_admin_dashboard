-- Close feedback #161/#162 as support/by-design after Bill's owner guidance.

START TRANSACTION;

SET @actor_id := 1;
SET @actor_name := 'Bill Sillery';
SET @actor_email := 'bill@sillery.co.uk';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT r.id, r.status, 'closed', @actor_id, @actor_name, @actor_email, NOW()
  FROM admin_feedback_report r
 WHERE r.id IN (161, 162)
   AND r.status = 'triaging'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'triaging'
        AND h.new_status = 'closed'
   );

UPDATE admin_feedback_report
   SET status = 'closed', updated_at = NOW()
 WHERE id IN (161, 162)
   AND status = 'triaging';

SET @note_161 := CONCAT(
  'Bill owner communication 2026-07-19: Emailed Amanda Curtis regarding Ashlee Barner. Explained that activating a PATH account and submitting an application are separate actions; Ashlee has a substantive signed application still In Review. ',
  'Closing a client file does not automatically close its applications because each application needs its own recorded outcome. Directed Amanda to open the application and use Quick Actions > Withdraw application, including the required withdrawal note, if the client file is being closed out. ',
  'This will remove the application from active lists while preserving its record. Closed as support/by-design; no client or application data was changed by Codex.'
);

SET @note_162 := CONCAT(
  'Bill owner communication 2026-07-19: Emailed Amanda Curtis regarding Mya Somerville. Explained that activating a PATH account and submitting an application are separate actions; Mya has a substantive signed application still In Review. ',
  'Closing a client file does not automatically close its applications because each application needs its own recorded outcome. Directed Amanda to open the application and use Quick Actions > Withdraw application, including the required withdrawal note, if the client file is being closed out. ',
  'This will remove the application from active lists while preserving its record. Closed as support/by-design; no client or application data was changed by Codex.'
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

SELECT id, status, summary, updated_at
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
 ORDER BY report_id, id DESC
 LIMIT 4;
