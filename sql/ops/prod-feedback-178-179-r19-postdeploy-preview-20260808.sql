-- Read-only PROD preview for r19 post-deploy feedback reconciliation.
-- Every table and column below was re-proved from live PROD DDL immediately
-- before this artifact was executed.

SELECT r.id,
       r.report_type,
       r.severity,
       r.status,
       r.summary,
       r.submitted_by_staff_profile_id,
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
