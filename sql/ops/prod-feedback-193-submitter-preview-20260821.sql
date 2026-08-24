-- Read-only submitter lookup for closed duplicate feedback report 193.

SELECT admin_feedback_report.id,
       admin_feedback_report.submitted_by_staff_profile_id,
       admin_feedback_report.submitted_by_name,
       admin_feedback_report.submitted_by_email,
       admin_feedback_report.status
  FROM admin_feedback_report
 WHERE admin_feedback_report.id = 193;
