-- Read-only PROD inventory for Judy Cook's reported Kelly Pashe assessment-submit error.
-- Target identity proved 2026-08-18 by SSM e5383efc-e2f7-4721-b142-ee7f82586d8c:
--   iset_intake / app_admin@% / ip-172-16-0-77:3306 / MySQL 8.0.42.
-- Full live DDL proved by SSM d984f88b-11a5-415c-b0eb-49d7752865c6 for:
--   iset_application_submission, iset_application, iset_case, iset_review_workflow.
-- Full live DDL proved by SSM 6332dc5d-b539-41d7-b31c-f9788ac8b1ed for:
--   client, user, staff_profiles.
-- This artifact performs no mutation.

START TRANSACTION READ ONLY;

SELECT
  client.id,
  client.first_name,
  client.last_name,
  iset_application.id,
  iset_application.submission_id,
  iset_application.case_id,
  iset_application.status,
  iset_application.lifecycle_status,
  iset_application.decision_outcome,
  iset_application.awaiting_reason,
  iset_application.row_version,
  iset_application.updated_at,
  iset_application_submission.reference_number,
  iset_case.status,
  iset_case.lifecycle_status,
  iset_review_workflow.id,
  iset_review_workflow.workflow_type,
  iset_review_workflow.current_stage,
  iset_review_workflow.current_owner_role,
  iset_review_workflow.submitted_by_staff_profile_id,
  iset_review_workflow.submitted_at,
  iset_review_workflow.updated_at,
  iset_review_workflow.archived_at
FROM client
JOIN iset_application
  ON iset_application.client_id = client.id
JOIN iset_case
  ON iset_case.id = iset_application.case_id
LEFT JOIN iset_application_submission
  ON iset_application_submission.id = iset_application.submission_id
LEFT JOIN iset_review_workflow
  ON iset_review_workflow.application_id = iset_application.id
 AND iset_review_workflow.workflow_type = 'application_assessment'
WHERE client.first_name = 'Kelly'
  AND client.last_name = 'Pashe'
ORDER BY iset_application.created_at, iset_application.id;

COMMIT;
