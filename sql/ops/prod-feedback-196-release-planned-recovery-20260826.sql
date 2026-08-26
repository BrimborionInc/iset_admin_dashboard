-- Audit-preserving recovery for the feedback #196 planned-release update.
-- Use only if release 20260825-signing-lineage-r2 is withdrawn before PROD
-- deployment. Existing history and notes remain visible.

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
       'triaging',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.severity = 'high'
   AND admin_feedback_report.status = 'planned'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Release plan 2026-08-26: The systematic signing-lineage repair%'
     );

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.severity = 'high'
   AND admin_feedback_report.status = 'planned'
   AND EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Release plan 2026-08-26: The systematic signing-lineage repair%'
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
       'Release recovery 2026-08-26: Release 20260825-signing-lineage-r2 was withdrawn before PROD deployment. The report returned to triaging; the preceding release-plan history is retained for audit.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196
   AND admin_feedback_report.status = 'triaging'
   AND admin_feedback_report.severity = 'high'
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 196
          AND admin_feedback_note.note_text LIKE 'Release recovery 2026-08-26: Release 20260825-signing-lineage-r2 was withdrawn%'
     );

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 196;
