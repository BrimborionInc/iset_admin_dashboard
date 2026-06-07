-- PROD feedback #136 triage for 2026-06-05.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @triage_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status_136
  FROM admin_feedback_report
 WHERE id = 136
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'triaging',
       updated_at = @triage_at
 WHERE id = 136
   AND @previous_status_136 = 'submitted';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 136, @previous_status_136, 'triaging', NULL, @actor_name, @actor_email, @triage_at
 WHERE @previous_status_136 = 'submitted'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 136
        AND previous_status = 'submitted'
        AND new_status = 'triaging'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       'Codex triage 2026-06-05: Report is for Jaimee Lee Gray / ISET-20260410-0D4C68 on /application-case/89. PROD data has one linked application only: application 7, status closure_notice, lifecycle awaiting_applicant, assigned to Emilie Marion. Under the current deployed rule, closure_notice is eligible for Withdraw application and the quick action is role-neutral for staff with normal Application Workspace access. PROD release 20260605-prod-ilmp-social-assistance-hotfix has the role-neutral source rule deployed, and the compiled bundle contains the Withdraw application UI text. No data reason found for the action to be hidden now. Keep triaging pending an Emilie/browser recheck; if still missing after refresh, inspect the live payload/browser state rather than changing case data.',
       @triage_at
 WHERE @previous_status_136 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE 'Codex triage 2026-06-05: Report is for Jaimee Lee Gray%'
   );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 136;

SELECT id, report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 136
 ORDER BY id DESC
 LIMIT 3;

SELECT id, report_id, author_name, created_at, LEFT(note_text, 500) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 136
 ORDER BY id DESC
 LIMIT 3;
