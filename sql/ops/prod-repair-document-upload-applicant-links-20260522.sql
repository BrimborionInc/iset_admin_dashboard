-- PROD guarded data repair for case/application applicant-account links that
-- point at duplicate placeholder client rows instead of the real case client.
-- Restore point: path-prod-document-upload-scope-20260522213235
--
-- Repair intent:
-- - Katrina Woodgate: move the activated PATH account mapping from placeholder
--   client 134 to real case client 97, and attach orphan void-cheque document
--   1220 to case 88 / application 6.
-- - Leah Plaited Hair: move the activated PATH account mapping from placeholder
--   client 179 to real case client 99.
-- - Keep the user rows, submissions, cases, and applications intact. The bug was
--   the client-to-Cognito account binding, not the case/application ownership.

DROP PROCEDURE IF EXISTS prod_repair_document_upload_applicant_links_20260522;

DELIMITER //

CREATE PROCEDURE prod_repair_document_upload_applicant_links_20260522()
BEGIN
  DECLARE v_restore_point VARCHAR(128) DEFAULT 'path-prod-document-upload-scope-20260522213235';
  DECLARE v_repair_at DATETIME(3) DEFAULT UTC_TIMESTAMP(3);
  DECLARE v_guard_count INT DEFAULT 0;
  DECLARE v_updated_count INT DEFAULT 0;
  DECLARE v_remaining_mismatch_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id IN (97, 99, 134, 179)
   FOR UPDATE;
  IF v_guard_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected four Katrina/Leah client rows.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id = 97
     AND first_name = 'Katrina'
     AND last_name = 'Woodgate'
     AND dob = '1988-04-27'
     AND applicant_cognito_sub IS NULL
     AND applicant_account_email IS NULL
     AND applicant_account_status IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina real client 97 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id = 134
     AND first_name = 'krwoodgate@hotmail.com'
     AND last_name = 'Applicant'
     AND applicant_account_email = 'krwoodgate@hotmail.com'
     AND applicant_account_status = 'activated'
     AND applicant_cognito_sub = 'bc7d85d8-4021-702d-a203-c06fffcaead7'
     AND applicant_cognito_username = 'krwoodgate@hotmail.com';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina placeholder client 134 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM user
   WHERE id = 116
     AND email = 'krwoodgate@hotmail.com'
     AND cognito_sub = 'bc7d85d8-4021-702d-a203-c06fffcaead7'
     AND COALESCE(suspended, 0) = 0
     AND deleted_at IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina user 116 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case c
    JOIN iset_application a ON a.case_id = c.id
    JOIN iset_application_submission s ON s.id = a.submission_id
   WHERE c.id = 88
     AND c.client_id = 97
     AND a.id = 6
     AND a.client_id = 97
     AND s.user_id = 116
     AND c.case_number = 'MI-MNT3JPF0-5BFEF1';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina case/application/submission chain no longer matches expected state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id = 99
     AND first_name = 'Leah'
     AND last_name = 'Plaited Hair'
     AND dob = '1992-06-07'
     AND applicant_cognito_sub IS NULL
     AND applicant_account_email IS NULL
     AND applicant_account_status IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Leah real client 99 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id = 179
     AND first_name = 'leahplaitedhair6@gmail.com'
     AND last_name = 'Applicant'
     AND applicant_account_email = 'leahplaitedhair6@gmail.com'
     AND applicant_account_status = 'activated'
     AND applicant_cognito_sub = '8cad5598-70e1-709e-0f4f-991d6f07d2d1'
     AND applicant_cognito_username = 'leahplaitedhair6@gmail.com';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Leah placeholder client 179 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM user
   WHERE id = 119
     AND email = 'leahplaitedhair6@gmail.com'
     AND cognito_sub = '8cad5598-70e1-709e-0f4f-991d6f07d2d1'
     AND COALESCE(suspended, 0) = 0
     AND deleted_at IS NULL;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Leah user 119 no longer matches expected pre-repair state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case c
    JOIN iset_application a ON a.case_id = c.id
    JOIN iset_application_submission s ON s.id = a.submission_id
   WHERE c.id = 90
     AND c.client_id = 99
     AND a.id = 8
     AND a.client_id = 99
     AND s.user_id = 119
     AND c.case_number = 'MI-MNT8J2SF-BB7286';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Leah case/application/submission chain no longer matches expected state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_case
   WHERE client_id IN (134, 179);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: placeholder client still owns one or more cases.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_application
   WHERE client_id IN (134, 179);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: placeholder client still owns one or more applications.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document
   WHERE client_id IN (134, 179);
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected exactly one document still attached to placeholder clients.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document
   WHERE id = 1220
     AND client_id = 134
     AND case_id IS NULL
     AND application_id IS NULL
     AND applicant_user_id = 116
     AND document_category = 'voided_cheque'
     AND source = 'legacy_intake_upload'
     AND status = 'active';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina orphan void-cheque document 1220 no longer matches expected state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client_applicant_account_event
   WHERE id = 199
     AND client_id = 134
     AND event_type = 'activated'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'portal_login';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Katrina account activation event 199 no longer matches expected state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client_applicant_account_event
   WHERE id = 250
     AND client_id = 179
     AND event_type = 'activated'
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.source')) = 'portal_login';
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: Leah account activation event 250 no longer matches expected state.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM input_json_state
   WHERE client_id IN (97, 99, 134, 179)
      OR user_id IN (116, 119);
  IF v_guard_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: active Katrina/Leah intake session state exists; retry later.';
  END IF;

  UPDATE client
     SET applicant_cognito_sub = NULL,
         applicant_cognito_username = NULL,
         applicant_account_status = NULL,
         applicant_account_email = NULL,
         applicant_invited_at = NULL,
         applicant_invited_by_staff_profile_id = NULL,
         applicant_activated_at = NULL,
         updated_at = v_repair_at
   WHERE id IN (134, 179);
  SET v_updated_count = ROW_COUNT();
  IF v_updated_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to unbind two placeholder client accounts.';
  END IF;

  UPDATE client
     SET applicant_cognito_sub = 'bc7d85d8-4021-702d-a203-c06fffcaead7',
         applicant_cognito_username = 'krwoodgate@hotmail.com',
         applicant_account_status = 'activated',
         applicant_account_email = 'krwoodgate@hotmail.com',
         applicant_invited_at = NULL,
         applicant_invited_by_staff_profile_id = NULL,
         applicant_activated_at = '2026-04-24 15:58:57',
         updated_at = v_repair_at
   WHERE id = 97;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to bind Katrina account to client 97.';
  END IF;

  UPDATE client
     SET applicant_cognito_sub = '8cad5598-70e1-709e-0f4f-991d6f07d2d1',
         applicant_cognito_username = 'leahplaitedhair6@gmail.com',
         applicant_account_status = 'activated',
         applicant_account_email = 'leahplaitedhair6@gmail.com',
         applicant_invited_at = NULL,
         applicant_invited_by_staff_profile_id = NULL,
         applicant_activated_at = '2026-05-11 21:36:40',
         updated_at = v_repair_at
   WHERE id = 99;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to bind Leah account to client 99.';
  END IF;

  UPDATE iset_document
     SET client_id = 97,
         case_id = 88,
         application_id = 6,
         metadata = JSON_SET(
           JSON_SET(
             COALESCE(metadata, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(metadata, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.documentUploadScopeRepair',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'reason', 'Applicant account placeholder client was rebound to the real case client.',
             'previousClientId', 134,
             'previousCaseId', NULL,
             'previousApplicationId', NULL,
             'repairedAtUtc', DATE_FORMAT(v_repair_at, '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         updated_at = v_repair_at
   WHERE id = 1220
     AND client_id = 134
     AND case_id IS NULL
     AND application_id IS NULL
     AND applicant_user_id = 116;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to rehome Katrina void-cheque document 1220.';
  END IF;

  UPDATE client_applicant_account_event
     SET client_id = 97,
         metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.documentUploadScopeRepair',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'previousClientId', 134,
             'repairedAtUtc', DATE_FORMAT(v_repair_at, '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         )
   WHERE id = 199
     AND client_id = 134;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to move Katrina activation event 199.';
  END IF;

  UPDATE client_applicant_account_event
     SET client_id = 99,
         metadata_json = JSON_SET(
           JSON_SET(
             COALESCE(metadata_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(metadata_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.documentUploadScopeRepair',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'previousClientId', 179,
             'repairedAtUtc', DATE_FORMAT(v_repair_at, '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         )
   WHERE id = 250
     AND client_id = 179;
  IF ROW_COUNT() <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to move Leah activation event 250.';
  END IF;

  UPDATE iset_case
     SET case_context_json = JSON_SET(
           JSON_SET(
             COALESCE(case_context_json, JSON_OBJECT()),
             '$.dataRepair',
             COALESCE(JSON_EXTRACT(case_context_json, '$.dataRepair'), JSON_OBJECT())
           ),
           '$.dataRepair.documentUploadScopeRepair',
           JSON_OBJECT(
             'restorePoint', v_restore_point,
             'reason', 'Activated PATH account mapping was moved from a duplicate placeholder client to the real case client.',
             'repairedAtUtc', DATE_FORMAT(v_repair_at, '%Y-%m-%dT%H:%i:%s.%fZ')
           )
         ),
         updated_at = v_repair_at
   WHERE id IN (88, 90);
  IF ROW_COUNT() <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Repair failed: expected to mark two case context rows.';
  END IF;

  INSERT INTO iset_case_note
    (case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned, follow_up_at, created_at, updated_at)
  SELECT 88, NULL, NULL,
         CONCAT('Codex data repair 2026-05-22: rebound the activated PATH applicant account from placeholder client 134 to real client 97 and attached orphan void-cheque document 1220 to this case/application. Restore point: ', v_restore_point, '.'),
         1, 0, NULL, v_repair_at, v_repair_at
   WHERE NOT EXISTS (
     SELECT 1
       FROM iset_case_note
      WHERE case_id = 88
        AND body LIKE 'Codex data repair 2026-05-22: rebound the activated PATH applicant account from placeholder client 134%'
   );

  INSERT INTO iset_case_note
    (case_id, author_staff_profile_id, author_user_id, body, is_internal, is_pinned, follow_up_at, created_at, updated_at)
  SELECT 90, NULL, NULL,
         CONCAT('Codex data repair 2026-05-22: rebound the activated PATH applicant account from placeholder client 179 to real client 99 so document uploads and applicant communications resolve to the case client. Restore point: ', v_restore_point, '.'),
         1, 0, NULL, v_repair_at, v_repair_at
   WHERE NOT EXISTS (
     SELECT 1
       FROM iset_case_note
      WHERE case_id = 90
        AND body LIKE 'Codex data repair 2026-05-22: rebound the activated PATH applicant account from placeholder client 179%'
   );

  SELECT COUNT(*) INTO v_guard_count
    FROM client c
    JOIN user u ON u.cognito_sub = c.applicant_cognito_sub
   WHERE (c.id = 97 AND u.id = 116 AND c.applicant_account_email = 'krwoodgate@hotmail.com')
      OR (c.id = 99 AND u.id = 119 AND c.applicant_account_email = 'leahplaitedhair6@gmail.com');
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Verification failed: real clients do not map to the expected applicant users.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM client
   WHERE id IN (134, 179)
     AND applicant_cognito_sub IS NULL
     AND applicant_cognito_username IS NULL
     AND applicant_account_email IS NULL
     AND applicant_account_status IS NULL;
  IF v_guard_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Verification failed: placeholder client account fields were not fully cleared.';
  END IF;

  SELECT COUNT(*) INTO v_guard_count
    FROM iset_document
   WHERE id = 1220
     AND client_id = 97
     AND case_id = 88
     AND application_id = 6
     AND applicant_user_id = 116
     AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.dataRepair.documentUploadScopeRepair.restorePoint')) = v_restore_point;
  IF v_guard_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Verification failed: Katrina void-cheque document was not rehomed correctly.';
  END IF;

  SELECT COUNT(*) INTO v_remaining_mismatch_count
    FROM iset_application a
    JOIN iset_case c ON c.id = a.case_id
    JOIN iset_application_submission s ON s.id = a.submission_id
    JOIN user u ON u.id = s.user_id
    JOIN client mapped ON mapped.applicant_cognito_sub = u.cognito_sub
   WHERE mapped.id <> c.client_id
     AND a.id <> 76;
  IF v_remaining_mismatch_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Verification failed: unexpected active applicant-account/client mismatch remains.';
  END IF;

  COMMIT;

  SELECT
    v_restore_point AS restore_point,
    'document_upload_applicant_links_repaired' AS status,
    97 AS katrina_client_id,
    99 AS leah_client_id,
    v_remaining_mismatch_count AS unexpected_remaining_mismatches;
END//

DELIMITER ;

CALL prod_repair_document_upload_applicant_links_20260522();

DROP PROCEDURE IF EXISTS prod_repair_document_upload_applicant_links_20260522;
