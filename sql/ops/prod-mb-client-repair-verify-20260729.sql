-- Independent read-only verification for the Manitoba repair.
-- Run in a separate database session after the apply transaction commits.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

SELECT
  id,
  first_name,
  last_name,
  dob,
  applicant_account_email,
  applicant_account_status,
  applicant_cognito_sub,
  JSON_UNQUOTE(
    JSON_EXTRACT(address_json, '$.prod_mb_client_repair_20260729.run_id')
  ) AS repair_run_id
FROM client
WHERE id IN (20, 244)
ORDER BY id;

SELECT
  id,
  email,
  cognito_sub,
  suspended,
  deleted_at,
  last_login_at
FROM user
WHERE id IN (23, 180)
ORDER BY id;

SELECT
  id,
  case_number,
  client_id,
  assigned_staff_profile_id,
  portfolio_region_id,
  status,
  lifecycle_status,
  closure_reason,
  stage,
  JSON_UNQUOTE(
    JSON_EXTRACT(case_context_json, '$.prod_mb_client_repair_20260729.run_id')
  ) AS repair_run_id
FROM iset_case
WHERE id IN (20, 172)
ORDER BY id;

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
  SUM(client_id = 20) AS old_client_account_event_count,
  SUM(
    client_id = 244
    AND CAST(
      JSON_UNQUOTE(
        JSON_EXTRACT(
          metadata_json,
          '$.prod_mb_client_repair_20260729.previous_client_id'
        )
      ) AS UNSIGNED
    ) = 20
  ) AS moved_account_event_count
FROM client_applicant_account_event
WHERE client_id IN (20, 244);

SELECT
  COUNT(*) AS client_merge_audit_count
FROM iset_client_merge_audit
WHERE surviving_client_id = 244
  AND merged_client_id = 20
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
      'prod-mb-client-repair-20260729'
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.snapshot_id')) =
      'path-prod-mb-client-repair-20260729163423';

SELECT
  COUNT(*) AS case_merge_audit_count
FROM iset_case_merge_audit
WHERE surviving_case_id = 172
  AND merged_case_id = 20
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
      'prod-mb-client-repair-20260729'
  AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.snapshot_id')) =
      'path-prod-mb-client-repair-20260729163423';

SELECT
  claim.identity_key,
  claim.client_id,
  cl.first_name,
  cl.last_name,
  cl.dob,
  cl.applicant_account_email,
  cl.applicant_cognito_sub,
  c.id AS case_id,
  c.case_number,
  c.assigned_staff_profile_id,
  c.portfolio_region_id,
  c.status,
  c.lifecycle_status
FROM client_file_import_identity_claim claim
JOIN client cl
  ON cl.id = claim.client_id
JOIN iset_case c
  ON c.client_id = cl.id
WHERE claim.identity_key =
  'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';

SELECT
  COUNT(*) AS stephanie_application_count
FROM iset_application a
JOIN client_file_import_identity_claim claim
  ON claim.client_id = a.client_id
WHERE claim.identity_key =
  'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';

SELECT
  COUNT(*) AS stephanie_user_count
FROM user
WHERE LOWER(TRIM(name)) LIKE '%stephanie%swampy%'
   OR LOWER(TRIM(name)) LIKE '%swampy%stephanie%';

SELECT
  id,
  request_hash,
  status,
  actor_staff_profile_id,
  file_name,
  worksheet_name,
  JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.results[0].caseNumber'))
    AS created_case_number,
  JSON_UNQUOTE(JSON_EXTRACT(result_json, '$.prodRepair.runId'))
    AS repair_run_id,
  committed_at
FROM client_file_import_run
WHERE request_hash =
  '1d99f50a40dfed31ac9de0fa51c7f4e358bac187a620776824ee1c57ae3919d8';

SELECT
  case_id,
  event_type,
  summary,
  actor_staff_profile_id,
  source_system,
  JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.run_id')) AS repair_run_id
FROM iset_case_event
WHERE JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.run_id')) =
  'prod-mb-client-repair-20260729'
ORDER BY case_id, id;

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  acquired_at,
  expires_at
FROM application_lock
WHERE application_id = 103;

SELECT
  scope,
  k,
  JSON_EXTRACT(v, '$.enabled') AS enabled,
  JSON_EXTRACT(v, '$.surfaces') AS surfaces,
  updated_at
FROM iset_runtime_config
WHERE scope = 'runtime'
  AND k = 'service.announcement';
