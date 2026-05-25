-- PROD feedback #120 staff-response note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       'Codex note 2026-05-25: Drafted Bill-facing response for Emilie: issue found in Shelly Van Loon Re-assessment Letter report; revised CFA had correct amounts but reassessment/funding revision letter used original approval amounts. Advise not to resend yet. Report remains in_progress until deployment, full packet recheck, and corrected-resend decision are complete.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 120 AND note_text LIKE 'Codex note 2026-05-25: Drafted Bill-facing response for Emilie:%'
 );

COMMIT;

SELECT report_id, author_name, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 120
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
