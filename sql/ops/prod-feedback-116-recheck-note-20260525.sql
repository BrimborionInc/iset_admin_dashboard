-- PROD feedback #116 recheck note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 116, NULL, @actor_name, @actor_email,
       'Codex recheck 2026-05-25: Reviewed as next actionable report after #120. Status remains planned, not resolved, because the cents-validation fix is prepared in the code line but still needs deployment and PROD recheck. Holistic verification target is not only the reported Edit intervention planned-cost field; recheck edit intervention, close intervention, and existing/backloaded intervention amount entry paths with dollars-and-cents values and confirm persisted values retain cents.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 116 AND note_text LIKE 'Codex recheck 2026-05-25:%'
 );

COMMIT;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 116;

SELECT report_id, author_name, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 116
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
