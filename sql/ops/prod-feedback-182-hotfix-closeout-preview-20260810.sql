-- PROD feedback #182 hotfix closeout preview, 2026-08-10.
-- Live target/DDL re-proved immediately before use:
-- database iset_intake; MySQL 8.0.42; CURRENT_USER() app_admin@%.
-- Read-only scope: admin_feedback_report, admin_feedback_status_history,
-- and admin_feedback_note for report_id/id 182 only.

SELECT DISTINCT
  r.status
FROM admin_feedback_report AS r
ORDER BY r.status;

SELECT
  r.id,
  r.report_type,
  r.severity,
  r.status,
  r.summary,
  r.description,
  r.submitted_by_staff_profile_id,
  r.submitted_by_name,
  r.submitted_by_email,
  r.submitted_by_role,
  r.page_title,
  r.page_path,
  r.page_url,
  r.context_json,
  r.submitted_at,
  r.updated_at
FROM admin_feedback_report AS r
WHERE r.id = 182;

SELECT
  h.id,
  h.report_id,
  h.previous_status,
  h.new_status,
  h.changed_by_staff_profile_id,
  h.changed_by_name,
  h.changed_by_email,
  h.changed_at
FROM admin_feedback_status_history AS h
WHERE h.report_id = 182
ORDER BY h.id;

SELECT
  n.id,
  n.report_id,
  n.author_staff_profile_id,
  n.author_name,
  n.author_email,
  n.note_text,
  n.created_at
FROM admin_feedback_note AS n
WHERE n.report_id = 182
ORDER BY n.id;
