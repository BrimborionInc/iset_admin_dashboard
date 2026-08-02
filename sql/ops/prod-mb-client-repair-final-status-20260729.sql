-- Final read-only status after controls are cleared.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT COUNT(*) AS repair_application_lock_count
FROM application_lock
WHERE application_id = 103
  AND owner_user_id = 'prod-mb-client-repair-20260729';

SELECT COUNT(*) AS service_announcement_count
FROM iset_runtime_config
WHERE scope = 'runtime'
  AND k = 'service.announcement';

SELECT COUNT(*) AS repair_procedure_count
FROM information_schema.routines
WHERE routine_schema = DATABASE()
  AND routine_type = 'PROCEDURE'
  AND routine_name IN (
    'prod_mb_client_repair_20260729',
    'prod_mb_client_repair_rollback_20260729'
  );

SELECT
  id,
  submission_id,
  client_id,
  case_id,
  status,
  lifecycle_status,
  decision_outcome,
  row_version,
  updated_at
FROM iset_application
WHERE id = 103;

SELECT
  c.id AS case_id,
  c.case_number,
  c.client_id,
  c.assigned_staff_profile_id,
  c.portfolio_region_id,
  c.status,
  c.lifecycle_status,
  cl.first_name,
  cl.last_name,
  cl.applicant_account_email,
  cl.applicant_cognito_sub
FROM client_file_import_identity_claim claim
JOIN client cl
  ON cl.id = claim.client_id
JOIN iset_case c
  ON c.client_id = cl.id
WHERE claim.identity_key =
  'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';
