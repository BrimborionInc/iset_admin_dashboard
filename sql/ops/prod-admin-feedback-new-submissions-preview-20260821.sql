-- Read-only PROD inventory for feedback reports still awaiting triage.
--
-- Execute only after the current task has proved the exact PROD identity and
-- captured the live SHOW CREATE TABLE, SHOW FULL COLUMNS, and SHOW INDEX
-- metadata for admin_feedback_report. Immediately before execution, validate
-- every identifier and the submitted status literal against that evidence.

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.description,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_name,
       admin_feedback_report.submitted_by_email,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_title,
       admin_feedback_report.page_path,
       admin_feedback_report.page_url,
       admin_feedback_report.context_json,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.status = 'submitted'
 ORDER BY admin_feedback_report.submitted_at,
          admin_feedback_report.id;
