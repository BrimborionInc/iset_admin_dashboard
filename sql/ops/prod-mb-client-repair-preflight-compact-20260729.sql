-- Compact read-only guard inventory for the Manitoba repair. This avoids
-- returning application payloads or event bodies containing personal data.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

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

SELECT COUNT(*) AS survivor_application_lock_count
FROM application_lock
WHERE application_id = 103;

SELECT
  client_id,
  event_type,
  COUNT(*) AS event_count
FROM client_applicant_account_event
WHERE client_id IN (20, 244)
GROUP BY client_id, event_type
ORDER BY client_id, event_type;

SELECT
  SUM(subject_type = 'case' AND subject_id = '20') AS old_case_subject_count,
  SUM(actor_applicant_user_id = 23) AS old_user_actor_count,
  SUM(subject_type = 'case' AND subject_id = '172') AS survivor_case_subject_count,
  SUM(actor_applicant_user_id = 180) AS survivor_user_actor_count
FROM iset_event_entry
WHERE (subject_type = 'case' AND subject_id IN ('20', '172'))
   OR actor_applicant_user_id IN (23, 180);

SELECT
  SUM(audience_applicant_user_id = 23) AS old_user_audience_count,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) = '20') AS old_case_metadata_count,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) = 'CASE-2026-0000020')
    AS old_case_tracking_count,
  SUM(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) = 'CASE-2026-0000020')
    AS old_case_application_reference_count
FROM iset_internal_notification
WHERE audience_applicant_user_id = 23
   OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) = '20'
   OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) = 'CASE-2026-0000020'
   OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) = 'CASE-2026-0000020';

SELECT
  SUM(user_id = 23) AS old_user_state_count,
  SUM(client_id = 20) AS old_client_state_count,
  SUM(user_id = 180) AS survivor_user_state_count,
  SUM(client_id = 244) AS survivor_client_state_count
FROM input_json_state
WHERE user_id IN (23, 180)
   OR client_id IN (20, 244);

SELECT COUNT(*) AS prior_client_merge_audit_count
FROM iset_client_merge_audit
WHERE surviving_client_id = 244
  AND merged_client_id = 20;

SELECT COUNT(*) AS prior_case_merge_audit_count
FROM iset_case_merge_audit
WHERE surviving_case_id = 172
  AND merged_case_id = 20;

SELECT COUNT(*) AS stephanie_identity_claim_count
FROM client_file_import_identity_claim
WHERE identity_key =
  'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';

SELECT COUNT(*) AS stephanie_import_run_count
FROM client_file_import_run
WHERE request_hash =
  '1d99f50a40dfed31ac9de0fa51c7f4e358bac187a620776824ee1c57ae3919d8';

SELECT COUNT(*) AS stephanie_client_count
FROM client
WHERE LOWER(TRIM(first_name)) = 'stephanie'
  AND LOWER(TRIM(last_name)) = 'swampy';

SELECT COUNT(*) AS stephanie_user_count
FROM user
WHERE LOWER(TRIM(name)) LIKE '%stephanie%swampy%'
   OR LOWER(TRIM(name)) LIKE '%swampy%stephanie%';

SELECT
  id,
  display_name,
  primary_role,
  region_id,
  status
FROM staff_profiles
WHERE id IN (1, 55, 60)
ORDER BY id;

SELECT
  region_id,
  code,
  name_en
FROM canada_region
WHERE region_id = 3;

SELECT
  scope,
  k,
  v,
  updated_at
FROM iset_runtime_config
WHERE scope = 'runtime'
  AND k = 'service.announcement'
ORDER BY k;
