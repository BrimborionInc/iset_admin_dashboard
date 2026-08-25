-- Append-only recovery for the feedback-only mutation in
-- prod-feedback-195-release-closeout-apply-20260824.sql.
-- Re-prove current identity, live DDL, and exact report state before use.

START TRANSACTION;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
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
       'triaging',
       NULL,
       'Codex',
       NULL
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'resolved'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-25 00:39:38';

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
       'Codex recovery: returned feedback #195 from resolved to triaging. The release closeout remains in the append-only audit trail; review the new evidence recorded after deployment before closing the report again.'
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'resolved'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-25 00:39:38';

UPDATE admin_feedback_report
   SET status = 'triaging'
 WHERE admin_feedback_report.id = 195
   AND admin_feedback_report.report_type = 'bug'
   AND admin_feedback_report.severity = 'medium'
   AND admin_feedback_report.status = 'resolved'
   AND admin_feedback_report.summary = '''Application-scoped changes must include the exact selected application id.'''
   AND admin_feedback_report.submitted_by_staff_profile_id = 55
   AND admin_feedback_report.submitted_at = '2026-08-24 17:20:24'
   AND admin_feedback_report.updated_at = '2026-08-25 00:39:38';

COMMIT;

SELECT admin_feedback_report.id,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 195;
