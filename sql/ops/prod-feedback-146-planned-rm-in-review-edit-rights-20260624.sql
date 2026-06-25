-- PROD feedback #146 planned status after RM in-review assessment edit fix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE id = 146
   AND status = 'triaging'
   AND summary = 'Can''t make edits to assessment';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 146, 'triaging', 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 146
          AND status = 'planned'
          AND summary = 'Can''t make edits to assessment'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 146
          AND previous_status = 'triaging'
          AND new_status = 'planned'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 146, NULL, @actor_name, @actor_email,
       'Codex planned fix 2026-06-24: Confirmed the two-step assessment rollout unintentionally removed Regional Manager draft-edit access. The reported file is still application status in_review and has no review workflow row, so it should be editable by the assigned RM before submission. Local fix prepared in CoordinatorAssessmentWidget: Regional Managers can edit application-assessment drafts only while the selected application status is in_review and no two-step review workflow exists; submitted assessments remain read-only and must move through RM review actions. Verification passed: npm test -- --runTestsByPath src/lib/reviewWorkflow.test.js src/lib/__tests__/coordinatorAssessmentHighValueDecisionGuard.test.js --watchAll=false (10 tests); npx eslint src/widgets/CoordinatorAssessmentWidget.js src/lib/__tests__/coordinatorAssessmentHighValueDecisionGuard.test.js; git diff --check for touched files. Not deployed yet; report moved to planned pending next PROD release and targeted live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 146
          AND summary = 'Can''t make edits to assessment'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 146
          AND note_text LIKE 'Codex planned fix 2026-06-24: Confirmed the two-step assessment rollout unintentionally removed Regional Manager draft-edit access%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 146;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 146
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 146
 ORDER BY id DESC
 LIMIT 4;
