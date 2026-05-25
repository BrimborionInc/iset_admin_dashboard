-- PROD feedback #121 correction after access-control source-of-truth clarification.
-- Scope: admin_feedback_* only. No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @note_at := NOW();

START TRANSACTION;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 121
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'in_progress',
       updated_at = @note_at
 WHERE id = 121
   AND status <> 'in_progress';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 121, @previous_status, 'in_progress', NULL, @actor_name, @actor_email, @note_at
 WHERE COALESCE(@previous_status, '') <> 'in_progress'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 121
        AND previous_status = @previous_status
        AND new_status = 'in_progress'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 121, NULL, @actor_name, @actor_email,
       'Codex correction 2026-05-25: Bill clarified that the Access Control matrix/dashboard should be the source of truth for this access. The earlier config-only mitigation hid the Template Editor from Regional Managers but is not the durable fix. Local code now changes notification template/settings APIs to honor the runtime route matrix: template authoring follows /template-editor, notification settings follows /manage-notifications, and the shared template list can be read by either dashboard permission. Keep this report in_progress until the code ships in a planned release and the intended matrix permissions are restored/rechecked live.',
       @note_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 121
      AND note_text LIKE 'Codex correction 2026-05-25: Bill clarified that the Access Control matrix/dashboard should be the source of truth%'
 );

COMMIT;

SELECT id, report_type, severity, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id = 121;

SELECT report_id, previous_status, new_status, changed_by_name, changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 121
 ORDER BY changed_at DESC, id DESC;

SELECT report_id, author_name, created_at, LEFT(note_text, 320) AS note_excerpt
  FROM admin_feedback_note
 WHERE report_id = 121
 ORDER BY created_at DESC, id DESC
 LIMIT 5;
