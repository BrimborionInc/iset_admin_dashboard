-- Recovery for the feedback-only mutation in
-- prod-feedback-195-triage-apply-20260824.sql.
-- This recovery is append-only: it restores the report classification while
-- preserving the original triage status/note as audit evidence.
-- Re-run current identity, live-DDL, and exact-state preflight before use.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
 FOR UPDATE;

INSERT INTO admin_feedback_status_history
  (report_id,
   previous_status,
   new_status,
   changed_by_staff_profile_id,
   changed_by_name,
   changed_by_email)
SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       'submitted',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging';

INSERT INTO admin_feedback_note
  (report_id,
   author_staff_profile_id,
   author_name,
   author_email,
   note_text)
SELECT admin_feedback_report.id,
       NULL,
       'Codex',
       NULL,
       'Codex recovery: reverted feedback #195 from triaging/Medium to submitted/Low. The earlier triage note remains in the append-only audit trail.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging';

UPDATE admin_feedback_report
   SET status = 'submitted',
       severity = 'low'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'triaging';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;
