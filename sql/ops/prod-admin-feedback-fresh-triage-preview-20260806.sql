-- Read-only PROD inventory for feedback submitted since the 2026-08-05 triage.
SELECT
  id,
  report_type,
  severity,
  status,
  summary,
  description,
  submitted_by_staff_profile_id,
  submitted_by_name,
  submitted_by_email,
  submitted_by_role,
  page_title,
  page_path,
  page_url,
  submitted_at,
  updated_at
FROM admin_feedback_report
WHERE id > 178 OR status = 'submitted'
ORDER BY id;

SELECT
  id,
  context_json
FROM admin_feedback_report
WHERE id = 179;

SELECT
  id,
  report_type,
  severity,
  status,
  summary,
  submitted_at,
  updated_at
FROM admin_feedback_report
WHERE status IN ('submitted', 'triaging', 'planned', 'in_progress')
ORDER BY severity, id;
