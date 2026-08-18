-- Read-only PROD proof for Kelly Pashe's recalled assessment workflow.
-- Target identity proved 2026-08-18 by SSM c3a58e17-4a13-493d-bb9f-de53e12d3413:
--   iset_intake / app_admin@% / ip-172-16-0-77:3306 / MySQL 8.0.42.
-- Full live DDL proved by SSM c3a58e17-4a13-493d-bb9f-de53e12d3413 for:
--   iset_review_workflow_event.
-- Full live DDL proved by SSM 6e35c8a9-1de6-4b0b-8189-06b27ccadacb for:
--   staff_profiles.
-- The exact workflow/application identity was proved by SSM
-- cb7f2e58-4697-4097-a429-62c2430e36ff.
-- This artifact performs no mutation.

START TRANSACTION READ ONLY;

SELECT
  iset_review_workflow_event.id,
  iset_review_workflow_event.review_workflow_id,
  iset_review_workflow_event.workflow_type,
  iset_review_workflow_event.subject_key,
  iset_review_workflow_event.action,
  iset_review_workflow_event.from_stage,
  iset_review_workflow_event.to_stage,
  iset_review_workflow_event.actor_staff_profile_id,
  iset_review_workflow_event.actor_role,
  iset_review_workflow_event.note,
  iset_review_workflow_event.created_at,
  staff_profiles.email,
  staff_profiles.name,
  staff_profiles.display_name,
  staff_profiles.primary_role,
  staff_profiles.status
FROM iset_review_workflow_event
LEFT JOIN staff_profiles
  ON staff_profiles.id = iset_review_workflow_event.actor_staff_profile_id
WHERE iset_review_workflow_event.review_workflow_id = 68
  AND iset_review_workflow_event.subject_key = 'application_assessment:application:71'
ORDER BY iset_review_workflow_event.created_at, iset_review_workflow_event.id;

SELECT
  staff_profiles.id,
  staff_profiles.email,
  staff_profiles.name,
  staff_profiles.display_name,
  staff_profiles.primary_role,
  staff_profiles.status
FROM staff_profiles
WHERE staff_profiles.id = 60;

COMMIT;
