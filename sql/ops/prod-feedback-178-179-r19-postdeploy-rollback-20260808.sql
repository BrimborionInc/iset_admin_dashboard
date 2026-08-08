-- Recovery only: remove the two r19 post-deploy notes.
-- No report status/history/client/case/application/workflow row is changed.

START TRANSACTION;

DELETE FROM admin_feedback_note
 WHERE (admin_feedback_note.id = 527
        AND admin_feedback_note.report_id = 178
        AND admin_feedback_note.author_name = 'Codex'
        AND admin_feedback_note.note_text LIKE 'Codex PROD deployment update 2026-08-08:%')
    OR (admin_feedback_note.id = 528
        AND admin_feedback_note.report_id = 179
        AND admin_feedback_note.author_name = 'Codex'
        AND admin_feedback_note.note_text LIKE 'Codex PROD deployment update 2026-08-08:%');

COMMIT;

SELECT r.id,
       r.status,
       r.updated_at
  FROM admin_feedback_report AS r
 WHERE r.id IN (178, 179)
 ORDER BY r.id;

SELECT n.id,
       n.report_id,
       n.author_name,
       n.note_text,
       n.created_at
  FROM admin_feedback_note AS n
 WHERE n.report_id IN (178, 179)
   AND n.author_name = 'Codex'
   AND n.note_text LIKE 'Codex PROD deployment update 2026-08-08:%'
 ORDER BY n.report_id, n.id;
