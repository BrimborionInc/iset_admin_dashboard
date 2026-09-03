-- Read-only PROD contact lookup for feedback #198.

SELECT admin_feedback_report.id,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.submitted_by_name,
       admin_feedback_report.submitted_by_email,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.submitted_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198;
