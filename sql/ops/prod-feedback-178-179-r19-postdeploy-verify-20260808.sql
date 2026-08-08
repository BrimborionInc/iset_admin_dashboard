-- Independent read-only verification for the r19 post-deploy feedback notes.

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

SELECT h.id,
       h.report_id,
       h.previous_status,
       h.new_status,
       h.changed_by_name,
       h.changed_at
  FROM admin_feedback_status_history AS h
 WHERE h.report_id IN (178, 179)
 ORDER BY h.report_id, h.id;
