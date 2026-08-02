-- Record the reporter follow-up for feedback #174.
-- Scope: one admin_feedback_note row only.

SET @note_text := 'Investigation update 2026-07-31: Bill has asked Kelly the decisive workflow question: after the cost items appeared in the Step 10 table, did she click Next, Previous, or Save Progress before leaving the application, or did she leave the application directly; and did PATH show an error or warning? Current code and DEV reproduction confirm that successful wizard navigation persists added cost lines. The retained database state cannot distinguish a direct exit from a failed silent save. No code or Case 248 / Application 187 data change is justified until Kelly answers.';

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 174, NULL, 'Codex', 'codex@openai.com', @note_text, UTC_TIMESTAMP()
 WHERE EXISTS (
       SELECT 1
         FROM admin_feedback_report
        WHERE id = 174
          AND status = 'triaging'
 )
   AND NOT EXISTS (
       SELECT 1
         FROM admin_feedback_note
        WHERE report_id = 174
          AND note_text = @note_text
 );

SELECT ROW_COUNT() AS inserted_note_rows;

COMMIT;
