-- Read-only PROD lookup for report #193's earlier submission reference.
--
-- Execute only after current-task PROD identity proof and live metadata capture
-- for admin_feedback_report. Validate the finished statement against that
-- evidence immediately before execution.

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.description,
       admin_feedback_report.page_path,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.submitted_by_staff_profile_id = 60
 ORDER BY admin_feedback_report.submitted_at,
          admin_feedback_report.id;
