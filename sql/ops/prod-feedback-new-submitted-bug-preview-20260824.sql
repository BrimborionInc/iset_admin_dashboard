-- Read-only PROD inventory for newly submitted bug reports on 2026-08-24.
-- Execute only after current-task PROD identity proof and live metadata capture
-- for admin_feedback_report.

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.description,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_name,
       admin_feedback_report.submitted_by_email,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_title,
       admin_feedback_report.page_path,
       admin_feedback_report.page_url,
       admin_feedback_report.context_json,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.status = 'submitted'
 ORDER BY admin_feedback_report.submitted_at DESC;

SELECT admin_feedback_attachment.id,
       admin_feedback_attachment.report_id,
       admin_feedback_attachment.file_name,
       admin_feedback_attachment.storage_key,
       admin_feedback_attachment.mime_type,
       admin_feedback_attachment.size_bytes,
       admin_feedback_attachment.checksum_sha256,
       admin_feedback_attachment.uploaded_by_staff_profile_id,
       admin_feedback_attachment.uploaded_at
  FROM admin_feedback_attachment
 WHERE admin_feedback_attachment.report_id = 195
 ORDER BY admin_feedback_attachment.id;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_staff_profile_id,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 195
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_staff_profile_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 195
 ORDER BY admin_feedback_note.id;
