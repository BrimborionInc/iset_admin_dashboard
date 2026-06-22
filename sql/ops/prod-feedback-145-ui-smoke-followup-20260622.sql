-- PROD feedback #145 UI-smoke follow-up after Home Overdue browser verification.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex UI verification follow-up 2026-06-22: Added and ran npm run smoke:home-overdue:browser against the local DEV React bundle. The smoke opens the real Home dashboard, selects the Overdue Work Queue card, and verifies rendered badge labels: an overdue row with saved assessment_esdc_eligibility renders as In Review without a false Awaiting EI Validation badge, while a row with blank EI eligibility still renders Submitted / Awaiting EI Validation. The smoke also confirms /api/applications settles after initial dashboard loading. This strengthens the #145 verification beyond unit/source tests; report remains planned pending PROD patch and live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex UI verification follow-up 2026-06-22:%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 145;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 145
 ORDER BY id DESC
 LIMIT 5;
