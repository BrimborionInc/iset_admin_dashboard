-- Guarded PROD repair for:
--   1. Susan Guimond's imported typo-email identity -> current portal identity.
--   2. Stephanie Swampy's missing application-less Manitoba client file.
--
-- Recovery point:
--   path-prod-mb-client-repair-20260729163423
--
-- This file deliberately leaves Susan's current application/submission payload
-- untouched. It also creates no application, submission, assessment, action
-- plan, intervention, payment, finance, or applicant-user row for Stephanie.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_mb_client_repair_20260729;

DELIMITER //

CREATE PROCEDURE prod_mb_client_repair_20260729()
BEGIN
  DECLARE v_run_id VARCHAR(96)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'prod-mb-client-repair-20260729';
  DECLARE v_snapshot_id VARCHAR(128)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT 'path-prod-mb-client-repair-20260729163423';
  DECLARE v_identity_key VARCHAR(80)
    CHARACTER SET ascii COLLATE ascii_bin
    DEFAULT 'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';
  DECLARE v_request_hash CHAR(64)
    CHARACTER SET ascii COLLATE ascii_bin
    DEFAULT '1d99f50a40dfed31ac9de0fa51c7f4e358bac187a620776824ee1c57ae3919d8';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_import_run_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_stephanie_client_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_stephanie_case_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_stephanie_case_number VARCHAR(32)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF BINARY DATABASE() <> BINARY 'iset_intake' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_wrong_database';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM application_lock
   WHERE application_id = 103
     AND owner_user_id = 'prod-mb-client-repair-20260729'
     AND expires_at > NOW()
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_repair_application_lock';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_runtime_config
   WHERE scope = 'runtime'
     AND k = 'service.announcement'
     AND JSON_EXTRACT(v, '$.enabled') = TRUE
     AND JSON_CONTAINS(JSON_EXTRACT(v, '$.surfaces'), JSON_QUOTE('admin')) = 1
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_admin_maintenance_warning';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client
   WHERE id = 244
     AND first_name = 'Susa'
     AND last_name = 'Guimond'
     AND dob = '1972-11-19'
     AND applicant_account_email = 'sguimond1972@gmail.com'
     AND applicant_account_status = 'activated'
     AND applicant_cognito_sub = '5c2df5d8-a011-7002-a9b4-4b43e23f27d4'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_survivor_client';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client
   WHERE id = 20
     AND first_name = 'Susan'
     AND last_name = 'Guimond'
     AND dob = '1972-11-19'
     AND applicant_account_email = 'shuimond1972@gmail.com'
     AND applicant_account_status = 'created'
     AND applicant_cognito_sub = '3c1d7578-8001-7050-6db4-4a12b6640d47'
     AND JSON_EXTRACT(address_json, '$.prod_mb_client_repair_20260729') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_imported_client';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM user
   WHERE id = 180
     AND email = 'sguimond1972@gmail.com'
     AND cognito_sub = '5c2df5d8-a011-7002-a9b4-4b43e23f27d4'
     AND suspended = 0
     AND deleted_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_survivor_user';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM user
   WHERE id = 23
     AND email = 'shuimond1972@gmail.com'
     AND cognito_sub = '3c1d7578-8001-7050-6db4-4a12b6640d47'
     AND suspended = 0
     AND deleted_at IS NULL
     AND last_login_at IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_imported_user';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = 172
     AND case_number = 'ISET-20260616-9C760A'
     AND client_id = 244
     AND assigned_staff_profile_id = 60
     AND portfolio_region_id IS NULL
     AND status = 'intake'
     AND lifecycle_status = 'intake'
     AND closure_reason IS NULL
     AND JSON_EXTRACT(case_context_json, '$.prod_mb_client_repair_20260729') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_survivor_case';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = 20
     AND case_number = 'CASE-2026-0000020'
     AND client_id = 20
     AND assigned_staff_profile_id IS NULL
     AND portfolio_region_id = 3
     AND status = 'initiated'
     AND lifecycle_status = 'initiated'
     AND closure_reason IS NULL
     AND stage IS NULL
     AND closed_at IS NULL
     AND JSON_EXTRACT(case_context_json, '$.prod_mb_client_repair_20260729') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_imported_case';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 103
     AND submission_id = 103
     AND client_id = 244
     AND case_id = 172
     AND status = 'in_review'
     AND lifecycle_status = 'in_review'
     AND decision_outcome IS NULL
     AND row_version = 49
     AND updated_at = '2026-07-29 16:16:40'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_survivor_application';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_applicant_account_event
   WHERE client_id = 20
     AND event_type = 'account_created'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.accountEmail')) =
         'shuimond1972@gmail.com'
     AND JSON_EXTRACT(metadata_json, '$.prod_mb_client_repair_20260729') IS NULL
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_imported_account_event';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_client_merge_audit
   WHERE surviving_client_id = 244
     AND merged_client_id = 20
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_client_already_merged';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_merge_audit
   WHERE surviving_case_id = 172
     AND merged_case_id = 20
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_susan_case_already_merged';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client
   WHERE LOWER(TRIM(first_name)) = 'stephanie'
     AND LOWER(TRIM(last_name)) = 'swampy'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_stephanie_client_already_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM user
   WHERE LOWER(TRIM(name)) LIKE '%stephanie%swampy%'
      OR LOWER(TRIM(name)) LIKE '%swampy%stephanie%'
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_stephanie_user_already_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_file_import_identity_claim
   WHERE identity_key = v_identity_key
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_stephanie_identity_already_claimed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_file_import_run
   WHERE request_hash = v_request_hash
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_stephanie_import_already_recorded';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM staff_profiles
   WHERE id = 1
     AND status = 'active';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_repair_actor_profile';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM staff_profiles
   WHERE id = 60
     AND display_name = 'Judy Cook'
     AND primary_role = 'ISET Coordinator'
     AND region_id = 3
     AND status = 'active';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_stephanie_assignee_profile';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM canada_region
   WHERE region_id = 3
     AND code = 'MB'
     AND name_en = 'Manitoba';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'guard_failed_manitoba_region';
  END IF;

  INSERT INTO iset_client_merge_audit (
    surviving_client_id,
    merged_client_id,
    merged_by_staff_profile_id,
    merge_reason,
    notes,
    metadata_json,
    merged_at
  )
  VALUES (
    244,
    20,
    1,
    'Imported typo-email identity superseded by the applicant active portal identity.',
    'The imported client row is retained for traceability. Its one account event is moved to the canonical client, its local user is suspended, and its empty case is archived and detached. The current portal application and submission are not modified.',
    JSON_OBJECT(
      'run_id', v_run_id,
      'snapshot_id', v_snapshot_id,
      'surviving_user_id', 180,
      'merged_user_id', 23,
      'surviving_case_id', 172,
      'merged_case_id', 20,
      'surviving_application_id', 103,
      'surviving_submission_id', 103,
      'surviving_email', 'sguimond1972@gmail.com',
      'merged_email', 'shuimond1972@gmail.com',
      'moved_account_event_count', 1,
      'current_application_modified', FALSE
    ),
    NOW()
  );

  INSERT INTO iset_case_merge_audit (
    surviving_case_id,
    merged_case_id,
    surviving_client_id,
    merged_client_id,
    merged_by_staff_profile_id,
    merge_reason,
    repointed_application_count,
    notes,
    metadata_json,
    merged_at
  )
  VALUES (
    172,
    20,
    244,
    20,
    1,
    'Empty imported typo-email case retired into the current portal application case.',
    0,
    'No application or operational casework was attached to imported case 20. The case shell is retained as an archived merged duplicate.',
    JSON_OBJECT(
      'run_id', v_run_id,
      'snapshot_id', v_snapshot_id,
      'surviving_case_number', 'ISET-20260616-9C760A',
      'merged_case_number', 'CASE-2026-0000020',
      'surviving_application_id', 103,
      'moved_account_event_count', 1
    ),
    NOW()
  );

  UPDATE client_applicant_account_event
     SET client_id = 244,
         metadata_json = JSON_SET(
           COALESCE(metadata_json, JSON_OBJECT()),
           '$.prod_mb_client_repair_20260729',
           JSON_OBJECT(
             'run_id', v_run_id,
             'snapshot_id', v_snapshot_id,
             'previous_client_id', 20,
             'previous_email', 'shuimond1972@gmail.com',
             'canonical_client_id', 244,
             'canonical_email', 'sguimond1972@gmail.com'
           )
         )
   WHERE client_id = 20
     AND event_type = 'account_created';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_susan_account_event';
  END IF;

  UPDATE user
     SET suspended = 1,
         updated_at = NOW()
   WHERE id = 23
     AND email = 'shuimond1972@gmail.com'
     AND suspended = 0;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_susan_imported_user';
  END IF;

  UPDATE client
     SET address_json = JSON_SET(
           COALESCE(address_json, JSON_OBJECT()),
           '$.prod_mb_client_repair_20260729',
           JSON_OBJECT(
             'run_id', v_run_id,
             'snapshot_id', v_snapshot_id,
             'merged_into_client_id', 244,
             'merged_into_user_id', 180,
             'merged_into_case_id', 172,
             'merged_into_application_id', 103,
             'canonical_email', 'sguimond1972@gmail.com',
             'retired_reason', 'Imported typo-email identity superseded by current portal identity'
           )
         ),
         updated_at = NOW()
   WHERE id = 20;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_susan_imported_client';
  END IF;

  UPDATE iset_case
     SET portfolio_region_id = 3,
         case_context_json = JSON_SET(
           COALESCE(case_context_json, JSON_OBJECT()),
           '$.prod_mb_client_repair_20260729',
           JSON_OBJECT(
             'run_id', v_run_id,
             'snapshot_id', v_snapshot_id,
             'merged_case_id', 20,
             'merged_client_id', 20,
             'merged_user_id', 23,
             'merged_email', 'shuimond1972@gmail.com',
             'moved_account_event_count', 1,
             'current_application_modified', FALSE
           )
         ),
         updated_by_staff_profile_id = 1,
         updated_at = NOW()
   WHERE id = 172;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_susan_survivor_case';
  END IF;

  UPDATE iset_case
     SET client_id = NULL,
         assigned_staff_profile_id = NULL,
         status = 'archived',
         lifecycle_status = 'archived',
         closure_reason = 'duplicate',
         stage = 'merged_duplicate',
         closed_at = NOW(),
         case_context_json = JSON_SET(
           COALESCE(case_context_json, JSON_OBJECT()),
           '$.prod_mb_client_repair_20260729',
           JSON_OBJECT(
             'run_id', v_run_id,
             'snapshot_id', v_snapshot_id,
             'merged_into_case_id', 172,
             'merged_into_case_number', 'ISET-20260616-9C760A',
             'merged_into_client_id', 244,
             'merged_into_application_id', 103,
             'retired_reason', 'Duplicate imported typo-email case'
           )
         ),
         updated_by_staff_profile_id = 1,
         updated_at = NOW()
   WHERE id = 20;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_susan_imported_case';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  )
  VALUES (
    172,
    'duplicate_identity_merged',
    'Imported duplicate identity merged into the current portal client file.',
    JSON_OBJECT(
      'run_id', v_run_id,
      'snapshot_id', v_snapshot_id,
      'merged_client_id', 20,
      'merged_case_id', 20,
      'merged_user_id', 23,
      'moved_account_event_count', 1,
      'current_application_modified', FALSE
    ),
    NOW(3),
    1,
    NULL,
    'prod_data_repair'
  );

  INSERT INTO client_file_import_run (
    request_hash,
    status,
    actor_staff_profile_id,
    file_name,
    worksheet_name,
    result_json,
    committed_at,
    created_at,
    updated_at
  )
  VALUES (
    v_request_hash,
    'processing',
    1,
    'NWAC MB Report.xlsx',
    'Carry Over Clients',
    NULL,
    NULL,
    NOW(),
    NOW()
  );
  SET v_import_run_id = LAST_INSERT_ID();

  INSERT INTO client (
    last_name,
    first_name,
    address_json,
    created_at,
    updated_at
  )
  VALUES (
    'Swampy',
    'Stephanie',
    JSON_OBJECT(
      'source', 'client_file_import',
      'importedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
      'importFileName', 'NWAC MB Report.xlsx',
      'importWorksheetName', 'Carry Over Clients',
      'importRowNumber', 14,
      'address', JSON_OBJECT('province', 'MB'),
      'sourceFundingRecord', JSON_OBJECT(
        'fundingStream', 'EI',
        'reportedAmount', 4000,
        'currency', 'CAD',
        'purpose', 'Source-report context only; action plan and intervention remain to be backloaded by staff'
      )
    ),
    NOW(),
    NOW()
  );
  SET v_stephanie_client_id = LAST_INSERT_ID();

  INSERT INTO client_file_import_identity_claim (
    identity_key,
    client_id,
    created_at,
    updated_at
  )
  VALUES (
    v_identity_key,
    v_stephanie_client_id,
    NOW(),
    NOW()
  );

  INSERT INTO iset_case (
    client_id,
    assigned_staff_profile_id,
    status,
    lifecycle_status,
    portfolio_region_id,
    opened_at,
    case_context_json,
    created_by_staff_profile_id,
    updated_by_staff_profile_id,
    created_at,
    updated_at
  )
  VALUES (
    v_stephanie_client_id,
    60,
    'initiated',
    'initiated',
    3,
    NOW(),
    JSON_OBJECT(
      'firstName', 'Stephanie',
      'lastName', 'Swampy',
      'addressProvince', 'MB',
      'clientFileImport', JSON_OBJECT(
        'importedAt', DATE_FORMAT(UTC_TIMESTAMP(), '%Y-%m-%dT%H:%i:%sZ'),
        'fileName', 'NWAC MB Report.xlsx',
        'worksheetName', 'Carry Over Clients',
        'rowNumber', 14,
        'importedBy', 'Bill Sillery',
        'mode', 'create_client_and_case',
        'runId', v_run_id,
        'snapshotId', v_snapshot_id
      ),
      'applicationPersonal', JSON_OBJECT(
        'first_name', 'Stephanie',
        'last_name', 'Swampy',
        'address', JSON_OBJECT('province', 'MB')
      ),
      'applicationAnswers', JSON_OBJECT(
        'first-name', 'Stephanie',
        'last-name', 'Swampy',
        'address-province', 'MB'
      ),
      'sourceFundingRecord', JSON_OBJECT(
        'fundingStream', 'EI',
        'reportedAmount', 4000,
        'currency', 'CAD',
        'purpose', 'Source-report context only; no application, action plan, intervention, payment, or finance row was created'
      )
    ),
    1,
    1,
    NOW(),
    NOW()
  );
  SET v_stephanie_case_id = LAST_INSERT_ID();
  SET v_stephanie_case_number =
    CONCAT('CASE-2026-', LPAD(v_stephanie_case_id, 7, '0'));

  UPDATE iset_case
     SET case_number = v_stephanie_case_number
   WHERE id = v_stephanie_case_id
     AND case_number IS NULL;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_stephanie_case_number';
  END IF;

  INSERT INTO iset_case_event (
    case_id,
    event_type,
    summary,
    payload_json,
    occurred_at,
    actor_staff_profile_id,
    actor_user_id,
    source_system
  )
  VALUES (
    v_stephanie_case_id,
    'client_file_imported',
    'Application-less Manitoba client file created from the carry-over client report.',
    JSON_OBJECT(
      'run_id', v_run_id,
      'snapshot_id', v_snapshot_id,
      'import_run_id', v_import_run_id,
      'source_file', 'NWAC MB Report.xlsx',
      'source_worksheet', 'Carry Over Clients',
      'source_row', 14,
      'funding_stream', 'EI',
      'reported_amount', 4000,
      'assigned_staff_profile_id', 60,
      'application_created', FALSE
    ),
    NOW(3),
    1,
    NULL,
    'client_file_import'
  );

  UPDATE client_file_import_run
     SET status = 'committed',
         result_json = JSON_OBJECT(
           'results', JSON_ARRAY(
             JSON_OBJECT(
               'rowNumber', 14,
               'displayName', 'Stephanie Swampy',
               'action', 'create_client_and_case',
               'clientId', v_stephanie_client_id,
               'caseId', v_stephanie_case_id,
               'caseNumber', v_stephanie_case_number
             )
           ),
           'summary', JSON_OBJECT(
             'processedRows', 1,
             'createdClients', 1,
             'createdCases', 1,
             'updatedCases', 0
           ),
           'createdApplicantUsernames', JSON_ARRAY(),
           'prodRepair', JSON_OBJECT(
             'runId', v_run_id,
             'snapshotId', v_snapshot_id,
             'sourceFundingStream', 'EI',
             'sourceReportedAmount', 4000
           )
         ),
         committed_at = NOW(),
         updated_at = NOW()
   WHERE id = v_import_run_id
     AND request_hash = v_request_hash
     AND status = 'processing';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'write_failed_stephanie_import_run';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE id = 103
     AND submission_id = 103
     AND client_id = 244
     AND case_id = 172
     AND status = 'in_review'
     AND lifecycle_status = 'in_review'
     AND decision_outcome IS NULL
     AND row_version = 49
     AND updated_at = '2026-07-29 16:16:40';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_application_changed';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM user
   WHERE id = 23
     AND suspended = 1
     AND deleted_at IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_imported_user';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = 20
     AND client_id IS NULL
     AND status = 'archived'
     AND lifecycle_status = 'archived'
     AND closure_reason = 'duplicate'
     AND stage = 'merged_duplicate';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_imported_case';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_applicant_account_event
   WHERE client_id = 244
     AND CAST(
       JSON_UNQUOTE(
         JSON_EXTRACT(
           metadata_json,
           '$.prod_mb_client_repair_20260729.previous_client_id'
         )
       ) AS UNSIGNED
     ) = 20;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_account_event';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_applicant_account_event
   WHERE client_id = 20;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_old_account_event_reference';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_client_merge_audit
   WHERE surviving_client_id = 244
     AND merged_client_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_client_audit';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_merge_audit
   WHERE surviving_case_id = 172
     AND merged_case_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_susan_case_audit';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client
   WHERE id = v_stephanie_client_id
     AND first_name = 'Stephanie'
     AND last_name = 'Swampy'
     AND dob IS NULL
     AND applicant_cognito_sub IS NULL
     AND applicant_account_email IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_stephanie_client';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE id = v_stephanie_case_id
     AND case_number = v_stephanie_case_number
     AND client_id = v_stephanie_client_id
     AND assigned_staff_profile_id = 60
     AND portfolio_region_id = 3
     AND status = 'initiated'
     AND lifecycle_status = 'initiated';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_stephanie_case';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE client_id = v_stephanie_client_id
      OR case_id = v_stephanie_case_id;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_stephanie_application_created';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_file_import_identity_claim
   WHERE identity_key = v_identity_key
     AND client_id = v_stephanie_client_id;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_stephanie_identity_claim';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM client_file_import_run
   WHERE id = v_import_run_id
     AND request_hash = v_request_hash
     AND status = 'committed'
     AND committed_at IS NOT NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'postcheck_failed_stephanie_import_run';
  END IF;

  COMMIT;

  SELECT
    v_run_id AS run_id,
    v_snapshot_id AS snapshot_id,
    v_stephanie_client_id AS stephanie_client_id,
    v_stephanie_case_id AS stephanie_case_id,
    v_stephanie_case_number AS stephanie_case_number,
    v_import_run_id AS stephanie_import_run_id;
END//

DELIMITER ;

CALL prod_mb_client_repair_20260729();

DROP PROCEDURE IF EXISTS prod_mb_client_repair_20260729;
