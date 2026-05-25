-- PROD feedback #120 progress note/status update for 2026-05-25.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @progress_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'in_progress', updated_at = @progress_at
 WHERE id = 120
   AND status = 'planned';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 120, 'planned', 'in_progress', NULL, @actor_name, @actor_email, @progress_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 120 AND status = 'in_progress')
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_status_history
      WHERE report_id = 120
        AND previous_status = 'planned'
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 120, NULL, @actor_name, @actor_email,
       'Codex progress 2026-05-25: Local code patch prepared for the full funding-revision packet. Root cause confirmed: intervention-level approval/revision sends used workflow 46, but backend signing-request generation filled that workflow from the stale application decision-letter draft while the secure-message body and CFA v2 were already correct. Patch changes intervention approval/revision letter signing requests to render from the reviewed secure-message body, leaving normal application approval/denial letters on the existing decision-draft path. Focused tests pass: npm test -- --watchAll=false --runTestsByPath src/lib/decisionLetterMessageBody.test.js; backend syntax check passes: node -c isetadminserver.js. Local transform against Shelly message body preserves revised $3350/$8700/$112 amounts and excludes old $3550/$200-month values. Not resolved until deployed and a PROD packet recheck/corrected-resend decision is complete.',
       @progress_at
 WHERE NOT EXISTS (
   SELECT 1 FROM admin_feedback_note
    WHERE report_id = 120 AND note_text LIKE 'Codex progress 2026-05-25:%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 120;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 120
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 220) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 120
 ORDER BY created_at DESC, id DESC;
