-- Roll back only the exact note created by the 2026-07-31 feedback #174 update.

DELETE FROM admin_feedback_note
 WHERE report_id = 174
   AND author_email = 'codex@openai.com'
   AND note_text = 'Investigation update 2026-07-31: Bill has asked Kelly the decisive workflow question: after the cost items appeared in the Step 10 table, did she click Next, Previous, or Save Progress before leaving the application, or did she leave the application directly; and did PATH show an error or warning? Current code and DEV reproduction confirm that successful wizard navigation persists added cost lines. The retained database state cannot distinguish a direct exit from a failed silent save. No code or Case 248 / Application 187 data change is justified until Kelly answers.';

SELECT ROW_COUNT() AS deleted_note_rows;
