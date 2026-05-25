-- PROD feedback #121 access-control repair for 2026-05-25.
-- Scope: iset_runtime_config admin/accessControlMatrix and admin_feedback_* only.
-- No client/case/application data is mutated.

SET @actor_name := 'Codex';
SET @actor_email := 'codex@openai.com';
SET @repair_at := NOW();

START TRANSACTION;

SELECT v
  INTO @matrix
  FROM iset_runtime_config
 WHERE scope = 'admin'
   AND k = 'accessControlMatrix'
 LIMIT 1
 FOR UPDATE;

SET @template_editor_rm_path := JSON_UNQUOTE(
  JSON_SEARCH(@matrix, 'one', 'Regional Manager', NULL, '$.routes."/template-editor"[*]')
);

UPDATE iset_runtime_config
   SET v = JSON_REMOVE(v, @template_editor_rm_path),
       updated_at = @repair_at
 WHERE scope = 'admin'
   AND k = 'accessControlMatrix'
   AND @template_editor_rm_path IS NOT NULL;

SELECT v
  INTO @matrix_after_template
  FROM iset_runtime_config
 WHERE scope = 'admin'
   AND k = 'accessControlMatrix'
 LIMIT 1;

SET @manage_notifications_rm_path := JSON_UNQUOTE(
  JSON_SEARCH(@matrix_after_template, 'one', 'Regional Manager', NULL, '$.routes."/manage-notifications"[*]')
);

UPDATE iset_runtime_config
   SET v = JSON_REMOVE(v, @manage_notifications_rm_path),
       updated_at = @repair_at
 WHERE scope = 'admin'
   AND k = 'accessControlMatrix'
   AND @manage_notifications_rm_path IS NOT NULL;

SELECT status
  INTO @previous_status
  FROM admin_feedback_report
 WHERE id = 121
 LIMIT 1
 FOR UPDATE;

UPDATE admin_feedback_report
   SET status = 'resolved',
       updated_at = @repair_at
 WHERE id = 121
   AND status <> 'resolved';

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT 121, @previous_status, 'resolved', NULL, @actor_name, @actor_email, @repair_at
 WHERE COALESCE(@previous_status, '') <> 'resolved'
   AND NOT EXISTS (
     SELECT 1
       FROM admin_feedback_status_history
      WHERE report_id = 121
        AND new_status = 'resolved'
        AND changed_by_name = @actor_name
   );

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT 121, NULL, @actor_name, @actor_email,
       CONCAT(
         'Codex resolution 2026-05-25: Root cause was access-control drift, not a broken Template Editor field/example engine. ',
         'Amanda submitted the report as a Regional Manager from /template-editor. Local route defaults and the backend /api/templates and /api/templates/:id routes restrict template authoring to System Administrator and NWAC Administrator. ',
         'PROD runtime accessControlMatrix had Regional Manager on /template-editor and /manage-notifications, so the page shell could appear while template APIs were forbidden, making the editor look empty or incomplete compared with a fully authorized user view. ',
         'Applied a narrow PROD config repair removing Regional Manager from /template-editor and /manage-notifications only. These routes now align with the backend notification-template API permissions. ',
         'If Regional Managers should edit notification templates in future, that should be a deliberate permission-design change with matching backend authorization, not an access-matrix override.'
       ),
       @repair_at
 WHERE NOT EXISTS (
   SELECT 1
     FROM admin_feedback_note
    WHERE report_id = 121
      AND note_text LIKE 'Codex resolution 2026-05-25: Root cause was access-control drift,%'
 );

COMMIT;

SELECT JSON_EXTRACT(v, '$.routes."/template-editor"') AS template_editor_roles,
       JSON_EXTRACT(v, '$.routes."/manage-notifications"') AS manage_notifications_roles,
       updated_at
  FROM iset_runtime_config
 WHERE scope = 'admin'
   AND k = 'accessControlMatrix';

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
