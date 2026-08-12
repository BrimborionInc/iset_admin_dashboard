-- Read-only preview for feedback #180 before the guarded status update.
-- Live PROD identity and full DDL for all three referenced tables were proved
-- on 2026-08-10 before this statement was executed.

SELECT id,
       report_type,
       severity,
       status,
       summary,
       description,
       submitted_by_email,
       submitted_by_role,
       page_path,
       submitted_at,
       updated_at
  FROM admin_feedback_report
 WHERE id = 180;

SELECT id,
       report_id,
       previous_status,
       new_status,
       changed_by_name,
       changed_by_email,
       changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 180
 ORDER BY id;

SELECT id,
       report_id,
       author_name,
       author_email,
       note_text,
       created_at
  FROM admin_feedback_note
 WHERE report_id = 180
 ORDER BY id;
