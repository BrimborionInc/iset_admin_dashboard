-- PROD feedback #124 actual blocker DEV fix note for 2026-05-27.
-- Records that the Residence Costs correction-path fix is prepared locally but not deployed.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.local';

INSERT INTO admin_feedback_note (
  report_id,
  author_staff_profile_id,
  author_name,
  author_email,
  note_text
)
SELECT 124, NULL, @actor_name, @actor_email,
       'Codex DEV fix note 2026-05-27: Follow-up correction for Kelly Hyde case 120 / report #124. Actual blocker is the residence/meal-plan payment-line correction path, not a saved >999-day intervention. Local patch prepared so Residence Costs is wired as a first-class payment type in fallback maps/payment requests/backloaded intervention entry, and Case Workspace/coordinator assessment cost-line modals can change the cost item while editing an existing line. Changing a recurring Living Allowance line to an intervention-start payment type such as Residence Costs now clears the carried monthly installment schedule by default and applies the institutional payee default where appropriate. Verification: node --check isetadminserver.js passed; git diff --check passed; focused Jest sweep passed 4 suites / 16 tests including residence-cost regression coverage; targeted eslint returned 0 errors with existing warnings only; CI=false npm run build completed with existing warnings only. Keep report in_progress until deployed to PROD and the case 120 revision path is rechecked live.'
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 124)
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 124
        AND note_text LIKE 'Codex DEV fix note 2026-05-27: Follow-up correction for Kelly Hyde case 120 / report #124. Actual blocker is the residence/meal-plan payment-line correction path%'
   );

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = NOW()
 WHERE id = 124;

SELECT id, status, updated_at
  FROM admin_feedback_report
 WHERE id = 124;

SELECT id, report_id, created_at, note_text
  FROM admin_feedback_note
 WHERE report_id = 124
 ORDER BY created_at DESC, id DESC
 LIMIT 3;
