-- PROD feedback #145 planned status after Overdue EI badge fix.
-- Scope: admin_feedback_* only. No client/case/application/document data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

UPDATE admin_feedback_report
   SET status = 'planned'
 WHERE id = 145
   AND status = 'triaging'
   AND summary = 'Overdue Items';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 145, 'triaging', 'planned', NULL, @actor_name, @actor_email, @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND status = 'planned'
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_status_history
        WHERE report_id = 145
          AND previous_status = 'triaging'
          AND new_status = 'planned'
     );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 145, NULL, @actor_name, @actor_email,
       'Codex planned fix 2026-06-22: Confirmed this is a UI badge bug, not Shelley misreading the Overdue queue. PROD Overdue rows currently rebuild application row objects without carrying assessment_esdc_eligibility, so the Status badge treats the EI result as missing and falsely adds Awaiting EI Validation to rows whose real overdue reason is assessment timing, applicant/document wait, assignment, or pending decision. Local fix prepared: shared homepage queue status-field builder now preserves assessment_esdc_eligibility/assessmentEsdcEligibility when rows are rebuilt, including Overdue rows. Verification: npm test -- --watchAll=false --runTestsByPath src/pages/home/__tests__/homeApplicationQueueFields.test.js src/utils/applicationStatus.test.js src/utils/applicationSla.test.js passed (20 tests); npm run build completed successfully with existing source-map/Browserslist warnings only. Report moved to planned pending next PROD deployment and live recheck.',
       @note_at
 WHERE EXISTS (
       SELECT 1 FROM admin_feedback_report
        WHERE id = 145
          AND summary = 'Overdue Items'
     )
   AND NOT EXISTS (
       SELECT 1 FROM admin_feedback_note
        WHERE report_id = 145
          AND note_text LIKE 'Codex planned fix 2026-06-22: Confirmed this is a UI badge bug%'
     );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 145;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 145
 ORDER BY changed_at DESC;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 900) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 145
 ORDER BY id DESC
 LIMIT 4;
