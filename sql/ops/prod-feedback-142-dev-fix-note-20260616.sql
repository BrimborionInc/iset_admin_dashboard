-- PROD feedback #142 DEV fix progress note for 2026-06-16.
-- Scope: admin_feedback_note only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 142, NULL, @actor_name, @actor_email,
       'Codex progress 2026-06-16: DEV workflow fix implemented for the submitted-assessment correction issue. Application assessments, new intervention proposals, and intervention revision/amendment proposals are now read-only while pending decision. The submitter has a Recall submission action before any decision is recorded; recall archives the active generated PDFs for the withdrawn submission, emits assessment_recalled, returns the workflow to editable review/draft, and keeps future redlines based on the last active non-recalled submission. Local verification passed: node --check isetadminserver.js; node --check src/widgets/CoordinatorAssessmentWidget.js; npm run lint -- --quiet src/widgets/CoordinatorAssessmentWidget.js src/pages/Caseworking/caseWorkspace/widgets/InterventionAssessmentWidget.jsx src/widgets/applicationEvents.js; git diff --check. Not deployed yet; report remains in_progress pending planned release and targeted live recheck.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 142)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 142
        AND note_text LIKE 'Codex progress 2026-06-16: DEV workflow fix implemented for the submitted-assessment correction issue%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 142;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 142
 ORDER BY id DESC
 LIMIT 5;
