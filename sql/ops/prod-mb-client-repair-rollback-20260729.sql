-- Immediate logical rollback for prod_mb_client_repair_20260729.
-- Prefer the Aurora snapshot for a full point-in-time recovery. This script is
-- only for a reviewed immediate reversal before staff add any Stephanie
-- casework. FK restrictions make it fail closed if new dependencies exist.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS prod_mb_client_repair_rollback_20260729;

DELIMITER //

CREATE PROCEDURE prod_mb_client_repair_rollback_20260729()
BEGIN
  DECLARE v_identity_key VARCHAR(80)
    CHARACTER SET ascii COLLATE ascii_bin
    DEFAULT 'name:a7f9d62f181b2b1cae742effca22b3ae418e104519e890315c313c1bc1b035f1';
  DECLARE v_request_hash CHAR(64)
    CHARACTER SET ascii COLLATE ascii_bin
    DEFAULT '1d99f50a40dfed31ac9de0fa51c7f4e358bac187a620776824ee1c57ae3919d8';
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_stephanie_client_id BIGINT UNSIGNED DEFAULT NULL;
  DECLARE v_stephanie_case_id BIGINT UNSIGNED DEFAULT NULL;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  IF BINARY DATABASE() <> BINARY 'iset_intake' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_wrong_database';
  END IF;

  SELECT client_id
    INTO v_stephanie_client_id
    FROM client_file_import_identity_claim
   WHERE identity_key = v_identity_key
   LIMIT 1
   FOR UPDATE;
  IF v_stephanie_client_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_stephanie_identity';
  END IF;

  SELECT id
    INTO v_stephanie_case_id
    FROM iset_case
   WHERE client_id = v_stephanie_client_id
   LIMIT 1
   FOR UPDATE;
  IF v_stephanie_case_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_stephanie_case';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case
   WHERE client_id = v_stephanie_client_id
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_stephanie_case_count';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_application
   WHERE client_id = v_stephanie_client_id
      OR case_id = v_stephanie_case_id
   FOR UPDATE;
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_stephanie_application_exists';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_client_merge_audit
   WHERE surviving_client_id = 244
     AND merged_client_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_client_audit';
  END IF;

  SELECT COUNT(*)
    INTO v_guard_count
    FROM iset_case_merge_audit
   WHERE surviving_case_id = 172
     AND merged_case_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_case_audit';
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
     AND row_version = 49
     AND updated_at = '2026-07-29 16:16:40'
   FOR UPDATE;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_guard_failed_susan_application_changed';
  END IF;

  DELETE FROM iset_case_event
   WHERE JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.run_id')) =
         'prod-mb-client-repair-20260729';

  DELETE FROM iset_case_merge_audit
   WHERE surviving_case_id = 172
     AND merged_case_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729';

  DELETE FROM iset_client_merge_audit
   WHERE surviving_client_id = 244
     AND merged_client_id = 20
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.run_id')) =
         'prod-mb-client-repair-20260729';

  UPDATE client_applicant_account_event
     SET client_id = 20,
         metadata_json = JSON_REMOVE(
           metadata_json,
           '$.prod_mb_client_repair_20260729'
         )
   WHERE client_id = 244
     AND CAST(
       JSON_UNQUOTE(
         JSON_EXTRACT(
           metadata_json,
           '$.prod_mb_client_repair_20260729.previous_client_id'
         )
       ) AS UNSIGNED
     ) = 20;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_susan_account_event';
  END IF;

  UPDATE user
     SET suspended = 0,
         updated_at = NOW()
   WHERE id = 23
     AND email = 'shuimond1972@gmail.com'
     AND suspended = 1;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_susan_user';
  END IF;

  UPDATE client
     SET address_json = JSON_REMOVE(
           address_json,
           '$.prod_mb_client_repair_20260729'
         ),
         updated_at = NOW()
   WHERE id = 20
     AND JSON_UNQUOTE(
       JSON_EXTRACT(address_json, '$.prod_mb_client_repair_20260729.run_id')
     ) = 'prod-mb-client-repair-20260729';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_susan_client';
  END IF;

  UPDATE iset_case
     SET portfolio_region_id = NULL,
         case_context_json = JSON_REMOVE(
           case_context_json,
           '$.prod_mb_client_repair_20260729'
         ),
         updated_at = NOW()
   WHERE id = 172
     AND JSON_UNQUOTE(
       JSON_EXTRACT(case_context_json, '$.prod_mb_client_repair_20260729.run_id')
     ) = 'prod-mb-client-repair-20260729';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_susan_survivor_case';
  END IF;

  UPDATE iset_case
     SET client_id = 20,
         assigned_staff_profile_id = NULL,
         status = 'initiated',
         lifecycle_status = 'initiated',
         closure_reason = NULL,
         stage = NULL,
         closed_at = NULL,
         case_context_json = JSON_REMOVE(
           case_context_json,
           '$.prod_mb_client_repair_20260729'
         ),
         updated_at = NOW()
   WHERE id = 20
     AND client_id IS NULL
     AND status = 'archived'
     AND lifecycle_status = 'archived'
     AND closure_reason = 'duplicate'
     AND stage = 'merged_duplicate';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_susan_imported_case';
  END IF;

  DELETE FROM iset_case
   WHERE id = v_stephanie_case_id
     AND client_id = v_stephanie_client_id;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_stephanie_case';
  END IF;

  DELETE FROM client_file_import_identity_claim
   WHERE identity_key = v_identity_key
     AND client_id = v_stephanie_client_id;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_stephanie_identity';
  END IF;

  DELETE FROM client
   WHERE id = v_stephanie_client_id
     AND first_name = 'Stephanie'
     AND last_name = 'Swampy';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_stephanie_client';
  END IF;

  DELETE FROM client_file_import_run
   WHERE request_hash = v_request_hash
     AND status = 'committed';
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'rollback_write_failed_stephanie_import_run';
  END IF;

  COMMIT;
END//

DELIMITER ;

CALL prod_mb_client_repair_rollback_20260729();

DROP PROCEDURE IF EXISTS prod_mb_client_repair_rollback_20260729;
