-- PROD feedback #157 implementation progress note for 2026-07-07.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 157, NULL, @actor_name, @actor_email,
       'Codex implementation update 2026-07-07: Local UI/API fix prepared for feedback #157. The existing Application Assessment EI Status dropdown remains the correction surface; Regional Manager, NWAC Administrator, and System Administrator users can change EI status after submission while the application is not final or locked. The backend blocks changed EI status once the case has action-plan or intervention dependencies, marks ILMP readiness stale through the existing assessment save path, bumps application row version, and writes a quiet case-event audit row for true corrections. Verification passed: npm test -- --runTestsByPath src/lib/__tests__/coordinatorAssessmentEiCorrection.test.js src/lib/__tests__/coordinatorAssessmentHighValueDecisionGuard.test.js --watchAll=false; node -c isetadminserver.js; node -c src/widgets/CoordinatorAssessmentWidget.js; git diff --check. Not deployed to PROD yet; report remains in_progress pending deployment and live recheck.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 157)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 157
        AND note_text LIKE 'Codex implementation update 2026-07-07: Local UI/API fix prepared for feedback #157%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 157;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 700) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 157
 ORDER BY id DESC
 LIMIT 5;
