-- PROD feedback #145 follow-up after broadening the Overdue EI badge/count fix.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex follow-up 2026-06-22: Broadened the prepared #145 fix after Bill asked to verify all Overdue badge/count paths, not only the homepage row builder. Frontend status/timeline rendering now uses a shared EI eligibility resolver across the homepage Work Queue, Work Queue Items table, Manage Applications table, and Application Overview, preserving snake_case and camelCase EI result fields. Backend server-side /api/applications?bucket=overdue filtering now uses all application SLA rows for the Overdue bucket instead of assigned-only rows, so assignment-stage overdue records are not dropped. Verification: npm test -- --watchAll=false --runTestsByPath src/utils/applicationAssessmentEligibility.test.js src/pages/home/__tests__/homeApplicationQueueFields.test.js src/utils/applicationStatus.test.js src/utils/applicationSla.test.js src/lib/__tests__/applicationOverdueQueueCoverage.test.js passed (27 tests); node --check isetadminserver.js passed; npm run build completed successfully with existing source-map/Browserslist warnings only. Report remains planned pending next PROD deployment and live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex follow-up 2026-06-22: Broadened the prepared #145 fix%'
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
