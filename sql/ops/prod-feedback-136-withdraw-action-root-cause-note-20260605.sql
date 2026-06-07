-- PROD feedback #136 corrected root-cause note for 2026-06-05.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       'Codex corrected diagnosis 2026-06-05: Emilie confirmed Withdraw application is still missing. Root cause is not a stale browser bundle. Jaimee''s raw persisted application status is closure_notice, but Application Workspace normalizes that to the display status Awaiting Applicant. Application Overview quick-action eligibility was using the display-normalized status, so closure_notice lost the Withdraw eligibility. Local fix prepared: preserve applicationStatusRaw/application_status_raw from resolveApplicationStateFields and gate quick actions on the raw status while continuing to display Awaiting Applicant. Verification passed: node --check src/widgets/ApplicationOverviewWidget.js; node --check src/utils/applicationStatus.js; CI=true npm test -- --runTestsByPath src/lib/__tests__/applicationOverviewApplicationScope.test.js src/utils/applicationStatus.test.js --runInBand. Keep in_progress pending deploy and Emilie recheck.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 136)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE 'Codex corrected diagnosis 2026-06-05: Emilie confirmed Withdraw application is still missing.%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 136;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 136
 ORDER BY id DESC
 LIMIT 4;
