-- PROD feedback #136 raw-status audit note for 2026-06-05.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       'Codex audit update 2026-06-05: Reviewed adjacent application-status resolver usage for the same raw-status/display-status class of bug. Local fix expanded so resolveApplicationStateFields preserves and prefers applicationStatusRaw/application_status_raw, Application Overview gates quick actions on raw status, Secure Messaging resumes review from raw docs_requested rather than display awaiting_applicant, and Coordinator Assessment / Application Form / Secure Message Compose re-resolution prefers raw case status before display status. Verification passed: node --check on changed .js files; git diff --check; CI=true npm test -- --runTestsByPath src/lib/__tests__/applicationOverviewApplicationScope.test.js src/lib/__tests__/applicationStatusRawWorkflowGuards.test.js src/utils/applicationStatus.test.js --runInBand. Keep in_progress pending deploy and live recheck.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 136)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE 'Codex audit update 2026-06-05: Reviewed adjacent application-status resolver usage%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 136;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 136
 ORDER BY id DESC
 LIMIT 5;
