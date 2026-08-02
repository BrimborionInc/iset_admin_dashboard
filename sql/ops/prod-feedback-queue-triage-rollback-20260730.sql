-- Guarded rollback for prod-feedback-queue-triage-20260730.sql.
-- Use only if the feedback-log triage itself must be reversed.
-- Guards avoid overwriting later status work.

SET @actor_email := 'codex@openai.com';
SET @note_prefix := 'Codex queue triage 2026-07-30:';

START TRANSACTION;

UPDATE admin_feedback_report r
   SET r.status = 'submitted',
       r.updated_at = UTC_TIMESTAMP()
 WHERE r.id IN (168,169,170,171,172,174,175)
   AND r.status = 'triaging'
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'submitted'
        AND h.new_status = 'triaging'
        AND h.changed_by_email = @actor_email
   )
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = r.id
        AND n.author_email = @actor_email
        AND n.note_text LIKE CONCAT(@note_prefix, '%')
   );

UPDATE admin_feedback_report r
   SET r.status = 'submitted',
       r.updated_at = UTC_TIMESTAMP()
 WHERE r.id = 176
   AND r.status = 'closed'
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_status_history h
      WHERE h.report_id = r.id
        AND h.previous_status = 'submitted'
        AND h.new_status = 'closed'
        AND h.changed_by_email = @actor_email
   )
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = r.id
        AND n.author_email = @actor_email
        AND n.note_text LIKE CONCAT(@note_prefix, '%')
   );

DELETE h
  FROM admin_feedback_status_history h
 WHERE h.report_id IN (168,169,170,171,172,174,175)
   AND h.previous_status = 'submitted'
   AND h.new_status = 'triaging'
   AND h.changed_by_email = @actor_email
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = h.report_id
        AND n.author_email = @actor_email
        AND n.note_text LIKE CONCAT(@note_prefix, '%')
   );

DELETE h
  FROM admin_feedback_status_history h
 WHERE h.report_id = 176
   AND h.previous_status = 'submitted'
   AND h.new_status = 'closed'
   AND h.changed_by_email = @actor_email
   AND EXISTS (
     SELECT 1
       FROM admin_feedback_note n
      WHERE n.report_id = h.report_id
        AND n.author_email = @actor_email
        AND n.note_text LIKE CONCAT(@note_prefix, '%')
   );

DELETE FROM admin_feedback_note
 WHERE report_id IN (96,97,123,154,163,165,166,168,169,170,171,172,173,174,175,176)
   AND author_email = @actor_email
   AND note_text LIKE CONCAT(@note_prefix, '%');

COMMIT;

SELECT id, status, summary, updated_at
  FROM admin_feedback_report
 WHERE id IN (96,97,123,154,163,165,166,168,169,170,171,172,173,174,175,176)
 ORDER BY id;
