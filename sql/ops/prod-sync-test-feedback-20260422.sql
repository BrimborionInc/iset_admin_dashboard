-- PROD one-off feedback-log sync prepared on 2026-04-22.
-- Purpose: merge the shared TEST admin-feedback queue into PROD after
-- comparing TEST and PROD exports for admin_feedback_report,
-- admin_feedback_note, admin_feedback_status_history, and
-- admin_feedback_attachment.
--
-- Findings from the comparison:
-- - all 27 TEST reports already exist in PROD as exact content matches
-- - TEST contributes no missing notes and no missing attachments
-- - PROD already has richer/newer status history for every shared report
--   except report #25, whose TEST copy was reopened to in_progress on
--   2026-04-21 after the earlier PROD closure
-- - this script intentionally reopens only that one conflicting shared
--   report, keeping the earlier PROD closure note for context

START TRANSACTION;

SET @actor_name = 'Codex';
SET @actor_email = 'codex@local';

SET @report_id = 25;
SET @expected_summary = 'Adding new action plan and Intervention';
SET @expected_submitted_at = '2026-04-16 12:11:29';
SET @merge_note = '2026-04-22 TEST->PROD merge: the TEST copy of this shared report was later moved to in_progress on 2026-04-21 19:24:56 after the earlier PROD closure. Reopened this PROD report to align the live feedback queue with the newer TEST triage state. The prior 2026-04-17 closure note is retained for context.';

SELECT id, status, summary, submitted_at, updated_at
FROM admin_feedback_report
WHERE id = @report_id
  AND summary = @expected_summary
  AND submitted_at = @expected_submitted_at
FOR UPDATE;

INSERT INTO admin_feedback_note
  (report_id, author_staff_profile_id, author_name, author_email, note_text, created_at)
SELECT
  r.id,
  NULL,
  @actor_name,
  @actor_email,
  @merge_note,
  NOW()
FROM admin_feedback_report r
WHERE r.id = @report_id
  AND r.summary = @expected_summary
  AND r.submitted_at = @expected_submitted_at
  AND r.status = 'closed'
  AND NOT EXISTS (
    SELECT 1
    FROM admin_feedback_note n
    WHERE n.report_id = r.id
      AND n.note_text = @merge_note
  );

INSERT INTO admin_feedback_status_history
  (report_id, previous_status, new_status, changed_by_staff_profile_id, changed_by_name, changed_by_email, changed_at)
SELECT
  r.id,
  r.status,
  'in_progress',
  NULL,
  @actor_name,
  @actor_email,
  NOW()
FROM admin_feedback_report r
WHERE r.id = @report_id
  AND r.summary = @expected_summary
  AND r.submitted_at = @expected_submitted_at
  AND r.status = 'closed';

UPDATE admin_feedback_report
SET status = 'in_progress',
    updated_at = NOW()
WHERE id = @report_id
  AND summary = @expected_summary
  AND submitted_at = @expected_submitted_at
  AND status = 'closed';

SELECT id, status, summary, submitted_at, updated_at
FROM admin_feedback_report
WHERE id = @report_id;

SELECT report_id, previous_status, new_status, changed_by_name, changed_by_email, changed_at
FROM admin_feedback_status_history
WHERE report_id = @report_id
ORDER BY changed_at, id;

SELECT report_id, author_name, author_email, note_text, created_at
FROM admin_feedback_note
WHERE report_id = @report_id
ORDER BY created_at, id;

COMMIT;
