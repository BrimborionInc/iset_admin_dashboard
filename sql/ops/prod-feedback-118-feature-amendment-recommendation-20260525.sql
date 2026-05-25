-- PROD feedback #118 feature recommendation note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 118, NULL, @actor_name, @actor_email,
       'Codex feature recommendation 2026-05-25: Amend the Other Funding feature so each other-funder row has a status field: Confirmed, Pending, Denied, Unknown / not confirmed. Keep funder name required, make What this funder covers required only for Confirmed funding, add optional Amount when known, and add Notes for pending/denied/unknown details. Pending/denied/unknown rows should not reduce PATH/NWAC cost totals and should not generate other-funder letters. Preserve/carry forward prior assessment other-funding notes when opening an intervention revision so staff do not have to recreate context.',
       @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 118
      AND note_text LIKE 'Codex feature recommendation 2026-05-25: Amend the Other Funding feature%'
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
