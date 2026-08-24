-- Read-only PROD feedback-log evidence for report #193 and its earlier report
-- #182. Execute only after current-task PROD identity proof and full live
-- metadata capture for each referenced table. Validate every finished
-- statement identifier against that evidence immediately before execution.

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_staff_profile_id,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_by_email,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id IN (182, 193)
 ORDER BY admin_feedback_status_history.report_id,
          admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_staff_profile_id,
       admin_feedback_note.author_name,
       admin_feedback_note.author_email,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id IN (182, 193)
 ORDER BY admin_feedback_note.report_id,
          admin_feedback_note.id;

SELECT admin_feedback_attachment.id,
       admin_feedback_attachment.report_id,
       admin_feedback_attachment.file_name,
       admin_feedback_attachment.mime_type,
       admin_feedback_attachment.size_bytes,
       admin_feedback_attachment.checksum_sha256,
       admin_feedback_attachment.uploaded_by_staff_profile_id,
       admin_feedback_attachment.uploaded_at
  FROM admin_feedback_attachment
 WHERE admin_feedback_attachment.report_id IN (182, 193)
 ORDER BY admin_feedback_attachment.report_id,
          admin_feedback_attachment.id;
