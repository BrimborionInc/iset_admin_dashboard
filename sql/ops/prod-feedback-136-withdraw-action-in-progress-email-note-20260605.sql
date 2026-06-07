-- PROD feedback #136 in-progress follow-up for 2026-06-05.
-- Scope: admin_feedback_* tables only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @progress_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status_136
  FROM admin_feedback_report
 WHERE id = 136
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @progress_at
 WHERE id = 136
   AND @previous_status_136 IS NOT NULL
   AND @previous_status_136 <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 136, @previous_status_136, 'in_progress', NULL, @actor_name, @actor_email, @progress_at
 WHERE @previous_status_136 IS NOT NULL
   AND @previous_status_136 <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 136
        AND previous_status = @previous_status_136
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 136, NULL, @actor_name, @actor_email,
       'Codex progress 2026-06-05: Bill is emailing Emilie to recheck Jaimee Lee Gray / ISET-20260410-0D4C68 after refreshing/reopening the Application Workspace. PROD data and deployed code both indicate Withdraw application should now be visible for application 7 in closure_notice. Keep in_progress pending Emilie/browser confirmation; if still missing after refresh, inspect live browser payload/state rather than changing case data.',
       @progress_at
 WHERE @previous_status_136 IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_note
      WHERE report_id = 136
        AND note_text LIKE 'Codex progress 2026-06-05: Bill is emailing Emilie to recheck Jaimee Lee Gray%'
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
