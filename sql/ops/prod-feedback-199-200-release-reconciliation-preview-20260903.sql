-- Read-only pre-release state for feedback reports 199 and 200.
-- Run only after exact PROD identity and live DDL have been proved for each
-- referenced feedback table.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT
  admin_feedback_report.id,
  admin_feedback_report.report_type,
  admin_feedback_report.severity,
  admin_feedback_report.status,
  admin_feedback_report.summary,
  admin_feedback_report.submitted_by_staff_profile_id,
  admin_feedback_report.submitted_by_email,
  admin_feedback_report.page_title,
  admin_feedback_report.page_path,
  admin_feedback_report.submitted_at,
  admin_feedback_report.updated_at
FROM admin_feedback_report
WHERE admin_feedback_report.id IN (199, 200)
ORDER BY admin_feedback_report.id;

SELECT
  admin_feedback_note.id,
  admin_feedback_note.report_id,
  admin_feedback_note.author_staff_profile_id,
  admin_feedback_note.author_name,
  admin_feedback_note.author_email,
  admin_feedback_note.note_text,
  admin_feedback_note.created_at
FROM admin_feedback_note
WHERE admin_feedback_note.report_id IN (199, 200)
ORDER BY admin_feedback_note.report_id,
         admin_feedback_note.created_at,
         admin_feedback_note.id;

SELECT
  admin_feedback_status_history.id,
  admin_feedback_status_history.report_id,
  admin_feedback_status_history.previous_status,
  admin_feedback_status_history.new_status,
  admin_feedback_status_history.changed_by_staff_profile_id,
  admin_feedback_status_history.changed_by_name,
  admin_feedback_status_history.changed_by_email,
  admin_feedback_status_history.changed_at
FROM admin_feedback_status_history
WHERE admin_feedback_status_history.report_id IN (199, 200)
ORDER BY admin_feedback_status_history.report_id,
         admin_feedback_status_history.changed_at,
         admin_feedback_status_history.id;
