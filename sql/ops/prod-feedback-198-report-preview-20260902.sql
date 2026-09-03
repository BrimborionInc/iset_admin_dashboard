-- Read-only PROD reporter/context confirmation for feedback #198.

SELECT admin_feedback_report.id,
       admin_feedback_report.report_type,
       admin_feedback_report.severity,
       admin_feedback_report.status,
       admin_feedback_report.summary,
       admin_feedback_report.description,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_role,
       admin_feedback_report.page_path,
       admin_feedback_report.submitted_at,
       admin_feedback_report.updated_at
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 198;
