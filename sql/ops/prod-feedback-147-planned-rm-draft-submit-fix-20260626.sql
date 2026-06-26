-- PROD feedback #147 planned status after RM draft application-assessment submit fix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SET @previous_147 := (SELECT status FROM admin_feedback_report WHERE id = 147 FOR UPDATE);

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE id = 147
   AND summary = '''Review workflow transition forbidden"'
   AND status <> 'planned';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 147, @previous_147, 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE COALESCE(@previous_147, '') <> 'planned'
   AND EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 147
          AND status = 'planned'
          AND summary = '''Review workflow transition forbidden"'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 147
          AND previous_status = @previous_147
          AND new_status = 'planned'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 147, NULL, @actor_name, @actor_email,
       'Codex planned fix 2026-06-26: Confirmed report #147 is a real regression in the two-step application-assessment workflow. Live PROD report context is /application-case/129 from Emilie Marion, Regional Manager, with error review_workflow_transition_forbidden at 2026-06-25 18:31:20 UTC. Live data check showed case 129 / active application 50 is in_review, assigned to Emilie, has an application assessment row, and has no iset_review_workflow row. The 2026-06-24 RM draft-edit hotfix allowed this pre-workflow RM draft edit path, but the shared transition helper still rejected Regional Manager actors when starting submit_for_rm_review. DEV fix prepared: start-review transitions now allow Regional Managers to start application_assessment review only; intervention proposal/revision starts remain guarded, and Regional Managers still cannot record final Decision Maker decisions. Verification passed: node --check src/lib/reviewWorkflow.js and isetadminserver.js; npx eslint --quiet src/lib/reviewWorkflow.js src/lib/reviewWorkflow.test.js scripts/application-assessment-workflow-browser-smoke.js; CI=true npm test -- --runInBand src/lib/reviewWorkflow.test.js; npm run smoke:application-assessment:workflow:browser with new regional-manager-submit-draft-assessment coverage and API-stub transition enforcement. Not deployed to PROD yet; report moved to planned pending release and targeted live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 147
          AND summary = '''Review workflow transition forbidden"'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 147
          AND note_text LIKE 'Codex planned fix 2026-06-26: Confirmed report #147 is a real regression%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 147;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 147
 ORDER BY changed_at DESC, id DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 147
 ORDER BY id DESC
 LIMIT 4;
