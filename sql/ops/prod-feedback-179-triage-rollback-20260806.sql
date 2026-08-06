-- Recovery only: revert the 2026-08-06 Codex triage closeout for feedback #179.
START TRANSACTION;

DELETE FROM admin_feedback_status_history
WHERE report_id = 179
  AND previous_status = 'submitted'
  AND new_status = 'closed'
  AND changed_by_name = 'Codex';

DELETE FROM admin_feedback_note
WHERE report_id = 179
  AND author_name = 'Codex'
  AND note_text LIKE 'Codex triage 2026-08-06:%';

UPDATE admin_feedback_report
SET status = 'submitted'
WHERE id = 179
  AND status = 'closed';

COMMIT;
