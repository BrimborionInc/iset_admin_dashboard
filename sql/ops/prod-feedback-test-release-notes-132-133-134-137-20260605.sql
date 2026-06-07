-- PROD feedback notes for TEST release 20260605-test-ilmp-casework-batch.
-- Scope: admin_feedback_note only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 132, NULL, @actor_name, @actor_email,
       'Codex release note 2026-06-05: Prepared fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch. Status remains planned pending PROD deployment and targeted recheck on the denied-application document checklist path.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 132)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 132
        AND note_text LIKE 'Codex release note 2026-06-05: Prepared fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 133, NULL, @actor_name, @actor_email,
       'Codex release note 2026-06-05: Prepared Regional Snapshots export/totals fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch. Status remains planned pending PROD deployment and targeted recheck of dashboard totals and Excel regional tabs.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 133)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 133
        AND note_text LIKE 'Codex release note 2026-06-05: Prepared Regional Snapshots export/totals fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 134, NULL, @actor_name, @actor_email,
       'Codex release note 2026-06-05: Prepared decision-letter applicant-name fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch. Status remains planned pending PROD deployment and targeted recheck that generated letters use the applicant salutation/name correctly.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 134)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 134
        AND note_text LIKE 'Codex release note 2026-06-05: Prepared decision-letter applicant-name fix is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch%'
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 137, NULL, @actor_name, @actor_email,
       'Codex release note 2026-06-05: Related ILMP/backloaded-action-plan code is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch. Status remains in_progress pending Emilie/staff confirmation of non-derivable Shayleen fields, PROD deployment of the remaining code path, rerun of ILMP validation, and targeted recheck.',
       @note_at
 WHERE EXISTS (SELECT 1 FROM admin_feedback_report WHERE id = 137)
   AND NOT EXISTS (
     SELECT 1 FROM admin_feedback_note
      WHERE report_id = 137
        AND note_text LIKE 'Codex release note 2026-06-05: Related ILMP/backloaded-action-plan code is now deployed to the Test and Training environment in release 20260605-test-ilmp-casework-batch%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (132, 133, 134, 137)
 ORDER BY id;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id IN (132, 133, 134, 137)
 ORDER BY id DESC
 LIMIT 8;
