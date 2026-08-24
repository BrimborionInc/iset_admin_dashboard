-- Independent read-only verification for canonical feedback 182 closeout.

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 182
   AND admin_feedback_report.status = 'resolved'
   AND admin_feedback_report.updated_at = '2026-08-21 17:32:34';

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 193
   AND admin_feedback_report.status = 'closed'
   AND admin_feedback_report.updated_at = '2026-08-21 16:57:37';

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_staff_profile_id,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.id = 621
   AND admin_feedback_status_history.report_id = 182
   AND admin_feedback_status_history.previous_status = 'in_progress'
   AND admin_feedback_status_history.new_status = 'resolved'
   AND admin_feedback_status_history.changed_by_staff_profile_id IS NULL
   AND admin_feedback_status_history.changed_by_name = 'Codex'
   AND admin_feedback_status_history.changed_by_email = 'codex@openai.com'
   AND admin_feedback_status_history.changed_at = '2026-08-21 17:32:34';

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_staff_profile_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.id = 553
   AND admin_feedback_note.report_id = 182
   AND admin_feedback_note.author_staff_profile_id IS NULL
   AND admin_feedback_note.author_name = 'Codex'
   AND admin_feedback_note.author_email = 'codex@openai.com'
   AND admin_feedback_note.created_at = '2026-08-21 17:32:34';
