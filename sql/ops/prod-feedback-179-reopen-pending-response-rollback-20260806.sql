-- Recovery only: undo the pending-response reopen for feedback #179.
START TRANSACTION;

DELETE FROM admin_feedback_status_history
WHERE report_id = 179
  AND previous_status = 'closed'
  AND new_status = 'in_progress'
  AND changed_by_name = 'Codex';

DELETE FROM admin_feedback_note
WHERE report_id = 179
  AND author_name = 'Codex'
  AND note_text LIKE 'Codex correction 2026-08-06:%';

UPDATE admin_feedback_report
SET status = 'closed'
WHERE id = 179
  AND status = 'in_progress';

COMMIT;
