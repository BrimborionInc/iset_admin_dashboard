-- Read-only PROD preview for feedback #190 triage metadata.
-- Live PROD identity and full DDL for all three tables must be captured in the
-- current task before this file is executed.

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 190
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 190
 ORDER BY admin_feedback_note.id;
