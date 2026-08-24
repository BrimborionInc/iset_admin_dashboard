-- Append-only recovery for the feedback #190 closeout note.
-- Audit notes are not deleted. If the closeout note must be corrected, this
-- artifact records a compensating note and leaves the original history intact.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.status
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 190
 FOR UPDATE;

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
SELECT 190,
       NULL,
       'Codex',
       NULL,
       'Codex correction notice 2026-08-19: The preceding repair closeout note has been superseded. Review the current live evidence and add the corrected outcome before relying on that note.'
 WHERE EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 190
          AND admin_feedback_note.note_text LIKE 'Codex repair closeout 2026-08-19:%'
     )
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE admin_feedback_note.report_id = 190
          AND admin_feedback_note.note_text LIKE 'Codex correction notice 2026-08-19:%'
     );

COMMIT;

SELECT admin_feedback_note.id,
       admin_feedback_note.report_id,
       admin_feedback_note.author_name,
       admin_feedback_note.note_text,
       admin_feedback_note.created_at
  FROM admin_feedback_note
 WHERE admin_feedback_note.report_id = 190
 ORDER BY admin_feedback_note.id DESC
 LIMIT 2;
