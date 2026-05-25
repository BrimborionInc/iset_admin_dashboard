-- PROD feedback #120 maintenance-batch planning note for 2026-05-25.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       'Codex note 2026-05-25: Deployment planning correction after Bill review. The #120 fix is prepared and locally tested, but it should not be treated as an immediate standalone PROD deploy. Keep the report in_progress and batch the fix into the next planned PROD maintenance release unless Bill explicitly approves emergency hotfix handling. Do not mark resolved until the release is deployed and the funding-revision letter/signing-request packet is rechecked live.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 120 AND note_text LIKE 'Codex note 2026-05-25: Deployment planning correction after Bill review.%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 120;

SELECT report_id, author_name, created_at, LEFT(note_text, 260) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 120
 ORDER BY created_at DESC, id DESC
 LIMIT 6;
