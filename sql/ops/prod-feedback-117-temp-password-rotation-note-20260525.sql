-- PROD feedback #117 temporary password rotation note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @noted_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 117, NULL, @actor_name, @actor_email,
       'Codex support-exception update 2026-05-25: Rotated Krista Caspick / kaaylcee@gmail.com one-time temporary Cognito password to a simpler value at Bill request. Password value is intentionally not stored in the feedback note. Verified Cognito UserStatus remains FORCE_CHANGE_PASSWORD, so the public portal sign-in flow should require Krista to choose her own new password before continuing. Staff should not resend the PATH activation link before Krista signs in.',
       @noted_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 117
      AND note_text LIKE 'Codex support-exception update 2026-05-25: Rotated Krista Caspick%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 117;

SELECT report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 117
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
