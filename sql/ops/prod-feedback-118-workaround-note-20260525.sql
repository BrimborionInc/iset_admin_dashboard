-- PROD feedback #118 workaround note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       'Codex workaround note 2026-05-25: Kelly can proceed without a deploy by not adding a row under Other funders when there is no confirmed outside funding amount/coverage. Use Other funding involved = Unknown if Inspire/Band funding is pending or uncertain, or No if there is no active outside funding, then put the Band/Inspire explanation in Additional notes. The Costs step still requires dollar amounts for PATH/NWAC cost lines. A code change is still recommended so the Other Funding step can explicitly record denied/pending/unknown funder status without staff having to use notes as the workaround.',
       @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE 'Codex workaround note 2026-05-25: Kelly can proceed without a deploy%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 118;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 118
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
