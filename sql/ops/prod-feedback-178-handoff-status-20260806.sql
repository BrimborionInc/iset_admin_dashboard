-- Read-only handoff check for feedback 178.
-- Target verified immediately before execution:
-- AWS account 468278742295, PROD database iset_intake,
-- database host ip-172-16-0-77, database user app_admin@%.
-- Every identifier below was checked against live SHOW CREATE TABLE output
-- for iset_application, iset_review_workflow, staff_profiles, and
-- admin_feedback_report on 2026-08-06.

SELECT
  a.id,
  a.case_id,
  a.status,
  a.lifecycle_status,
  a.decision_outcome,
  a.row_version,
  a.updated_at
FROM iset_application AS a
WHERE a.id = 61
  AND a.case_id = 138;

SELECT
  rw.id,
  rw.workflow_type,
  rw.application_id,
  rw.current_stage,
  rw.current_owner_role,
  rw.current_owner_staff_profile_id,
  rw.submitted_by_staff_profile_id,
  rw.metadata_json,
  rw.updated_at,
  sp.email AS submitter_email,
  sp.primary_role AS submitter_role,
  sp.status AS submitter_status,
  sp.last_login_at AS submitter_last_login_at
FROM iset_review_workflow AS rw
LEFT JOIN staff_profiles AS sp
  ON sp.id = rw.submitted_by_staff_profile_id
WHERE rw.id = 17
  AND rw.application_id = 61
  AND rw.archived_at IS NULL;

SELECT
  afr.id,
  afr.status,
  afr.severity,
  afr.summary,
  afr.updated_at
FROM admin_feedback_report AS afr
WHERE afr.id = 178;
