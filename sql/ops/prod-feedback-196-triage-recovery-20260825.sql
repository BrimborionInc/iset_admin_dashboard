-- Audit-preserving recovery for the feedback #196 triage metadata update.
-- Use only if the 2026-08-25 diagnosis or priority must be withdrawn before a
-- later status transition. The original triage note/history remains visible.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
 FOR UPDATE;

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       'submitted',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.severity = 'high'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.author_name = 'Codex'
          AND admin_feedback_note.note_text LIKE 'Codex triage 2026-08-25: Confirmed PROD defect%'
     );

UPDATE admin_feedback_report
   SET status = 'submitted',
       severity = 'medium'
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.severity = 'high'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.author_name = 'Codex'
          AND admin_feedback_note.note_text LIKE 'Codex triage 2026-08-25: Confirmed PROD defect%'
     );

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
SELECT admin_feedback_report.id,
       NULL,
       'Codex',
       NULL,
       'Codex recovery 2026-08-25: The preceding high-priority triage classification was returned to submitted/medium for renewed investigation. The original diagnosis remains in the audit trail and must not be relied on without a new evidence review.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'submitted'
   AND admin_feedback_report.severity = 'medium'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_status_history
        WHERE admin_feedback_status_history.report_id = 196
          AND admin_feedback_status_history.previous_status = 'triaging'
          AND admin_feedback_status_history.new_status = 'submitted'
          AND admin_feedback_status_history.changed_by_name = 'Codex'
     )
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Codex recovery 2026-08-25: The preceding high-priority triage classification%'
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196;

SELECT admin_feedback_status_history.id,
       admin_feedback_status_history.report_id,
       admin_feedback_status_history.previous_status,
       admin_feedback_status_history.new_status,
       admin_feedback_status_history.changed_by_name,
       admin_feedback_status_history.changed_at
  FROM admin_feedback_status_history
 WHERE admin_feedback_status_history.report_id = 196
 ORDER BY admin_feedback_status_history.id;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 196
 ORDER BY admin_feedback_note.id;
