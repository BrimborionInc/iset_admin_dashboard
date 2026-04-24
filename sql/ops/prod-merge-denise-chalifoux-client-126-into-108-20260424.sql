-- PROD duplicate-client merge prepared on 2026-04-24.
--
-- IMPORTANT:
-- - Prepared only. Do not run until staff confirm Denise is using the
--   already-activated PATH account/email tied to client 108 / user 115:
--     kiyaostisondenisehelen@gmail.com
-- - If staff confirm the newer email/user is the real sign-in identity:
--     kiyaostinsondenisehelen@gmail.com
--   then stop and redesign the merge. That path is an identity migration,
--   not just a client reassociation.
--
-- Rationale for this prepared merge direction:
-- - client 108 is the older Denise Chalifoux record and is linked to the
--   activated applicant account (cognito-linked user 115).
-- - client 126 was created on 2026-04-20 by admin manual intake and has
--   no applicant-account linkage.
-- - application 31 / case 113 / submission 31 and 11 manual-uploaded
--   documents currently point at client 126 and local-only user 159.
-- - The safest live PROD fix is to move that intake cluster onto the
--   already-activated Denise identity, record the merge in
--   iset_client_merge_audit, and intentionally keep the merged client row
--   in place for traceability/recovery instead of deleting it.

DELIMITER $$

DROP PROCEDURE IF EXISTS prod_merge_denise_chalifoux_client_126_into_108_20260424 $$

CREATE PROCEDURE prod_merge_denise_chalifoux_client_126_into_108_20260424()
BEGIN
  DECLARE v_surviving_client_id BIGINT UNSIGNED DEFAULT 108;
  DECLARE v_merged_client_id BIGINT UNSIGNED DEFAULT 126;
  DECLARE v_surviving_user_id INT DEFAULT 115;
  DECLARE v_merged_user_id INT DEFAULT 159;
  DECLARE v_case_id BIGINT UNSIGNED DEFAULT 113;
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 31;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 31;
  DECLARE v_surviving_email VARCHAR(255) DEFAULT 'kiyaostisondenisehelen@gmail.com';
  DECLARE v_merged_email VARCHAR(255) DEFAULT 'kiyaostinsondenisehelen@gmail.com';

  DECLARE v_doc_client_count INT DEFAULT 0;
  DECLARE v_doc_user_count INT DEFAULT 0;
  DECLARE v_input_state_client_count INT DEFAULT 0;
  DECLARE v_input_state_user_count INT DEFAULT 0;
  DECLARE v_account_event_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO @ok_surviving_client
  FROM client
  WHERE id = v_surviving_client_id
    AND applicant_account_email = v_surviving_email
    AND applicant_account_status = 'activated'
    AND applicant_cognito_sub IS NOT NULL;
  IF @ok_surviving_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Denise client/account state no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_client
  FROM client
  WHERE id = v_merged_client_id
    AND applicant_account_email IS NULL
    AND applicant_account_status IS NULL
    AND applicant_cognito_sub IS NULL;
  IF @ok_merged_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: merged Denise client row no longer matches expected duplicate/no-account state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_user
  FROM user
  WHERE id = v_surviving_user_id
    AND email = v_surviving_email
    AND cognito_sub IS NOT NULL;
  IF @ok_surviving_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Denise user/account no longer matches expected activated state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_user
  FROM user
  WHERE id = v_merged_user_id
    AND email = v_merged_email
    AND cognito_sub IS NULL;
  IF @ok_merged_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: merged Denise placeholder user no longer matches expected local-only state.';
  END IF;

  SELECT COUNT(*) INTO @ok_application
  FROM iset_application
  WHERE id = v_application_id
    AND submission_id = v_submission_id
    AND client_id = v_merged_client_id
    AND case_id = v_case_id;
  IF @ok_application <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: application 31 is no longer linked to the expected duplicate Denise client/case.';
  END IF;

  SELECT COUNT(*) INTO @ok_case
  FROM iset_case
  WHERE id = v_case_id
    AND application_id = v_application_id
    AND client_id = v_merged_client_id;
  IF @ok_case <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: case 113 is no longer linked to the expected duplicate Denise client/application.';
  END IF;

  SELECT COUNT(*) INTO @ok_submission
  FROM iset_application_submission
  WHERE id = v_submission_id
    AND user_id = v_merged_user_id;
  IF @ok_submission <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: submission 31 is no longer linked to the expected placeholder Denise user.';
  END IF;

  SELECT COUNT(*) INTO v_doc_client_count
  FROM iset_document
  WHERE client_id = v_merged_client_id;

  SELECT COUNT(*) INTO v_doc_user_count
  FROM iset_document
  WHERE applicant_user_id = v_merged_user_id;

  SELECT COUNT(*) INTO v_input_state_client_count
  FROM input_json_state
  WHERE client_id = v_merged_client_id;

  SELECT COUNT(*) INTO v_input_state_user_count
  FROM input_json_state
  WHERE user_id = v_merged_user_id;

  SELECT COUNT(*) INTO v_account_event_count
  FROM client_applicant_account_event
  WHERE client_id = v_merged_client_id;

  -- Lock the core rows involved in the reassociation.
  SELECT id FROM client WHERE id IN (v_surviving_client_id, v_merged_client_id) FOR UPDATE;
  SELECT id FROM user WHERE id IN (v_surviving_user_id, v_merged_user_id) FOR UPDATE;
  SELECT id FROM iset_case WHERE id = v_case_id FOR UPDATE;
  SELECT id FROM iset_application WHERE id = v_application_id FOR UPDATE;
  SELECT id FROM iset_application_submission WHERE id = v_submission_id FOR UPDATE;
  SELECT id FROM iset_document WHERE client_id = v_merged_client_id OR applicant_user_id = v_merged_user_id FOR UPDATE;
  SELECT user_id, session_token FROM input_json_state WHERE client_id = v_merged_client_id OR user_id = v_merged_user_id FOR UPDATE;

  INSERT INTO iset_client_merge_audit
    (surviving_client_id, merged_client_id, merged_by_staff_profile_id, merge_reason, notes, metadata_json, merged_at)
  VALUES
    (
      v_surviving_client_id,
      v_merged_client_id,
      NULL,
      'Duplicate Denise Chalifoux client created by admin manual intake using a different email spelling.',
      'Prepared on 2026-04-24. Surviving Denise identity is the already-activated applicant account on client 108 / user 115. This merge repoints application 31, case 113, submission 31, and linked documents away from duplicate client 126 / user 159. The duplicate client row is intentionally retained without live references for audit/recovery traceability.',
      JSON_OBJECT(
        'surviving_user_id', v_surviving_user_id,
        'merged_user_id', v_merged_user_id,
        'surviving_email', v_surviving_email,
        'merged_email', v_merged_email,
        'case_id', v_case_id,
        'application_id', v_application_id,
        'submission_id', v_submission_id,
        'moved_document_client_refs', v_doc_client_count,
        'moved_document_applicant_user_refs', v_doc_user_count,
        'moved_input_state_client_refs', v_input_state_client_count,
        'moved_input_state_user_refs', v_input_state_user_count,
        'merged_client_account_events', v_account_event_count
      ),
      NOW()
    );

  UPDATE iset_application
  SET client_id = v_surviving_client_id,
      updated_at = NOW()
  WHERE id = v_application_id
    AND client_id = v_merged_client_id;

  UPDATE iset_case
  SET client_id = v_surviving_client_id,
      updated_at = NOW()
  WHERE id = v_case_id
    AND client_id = v_merged_client_id;

  UPDATE iset_application_submission
  SET user_id = v_surviving_user_id,
      updated_at = NOW()
  WHERE id = v_submission_id
    AND user_id = v_merged_user_id;

  UPDATE iset_document
  SET client_id = CASE WHEN client_id = v_merged_client_id THEN v_surviving_client_id ELSE client_id END,
      applicant_user_id = CASE WHEN applicant_user_id = v_merged_user_id THEN v_surviving_user_id ELSE applicant_user_id END,
      updated_at = NOW()
  WHERE client_id = v_merged_client_id
     OR applicant_user_id = v_merged_user_id;

  UPDATE input_json_state
  SET client_id = CASE WHEN client_id = v_merged_client_id THEN v_surviving_client_id ELSE client_id END,
      user_id = CASE WHEN user_id = v_merged_user_id THEN v_surviving_user_id ELSE user_id END,
      updated_at = NOW()
  WHERE client_id = v_merged_client_id
     OR user_id = v_merged_user_id;

  COMMIT;

  SELECT 'surviving_client' AS label, id, applicant_account_email, applicant_account_status, applicant_cognito_sub, applicant_cognito_username
  FROM client
  WHERE id = v_surviving_client_id;

  SELECT 'merged_client_remaining_row' AS label, id, applicant_account_email, applicant_account_status, applicant_cognito_sub, applicant_cognito_username
  FROM client
  WHERE id = v_merged_client_id;

  SELECT 'application' AS label, id, client_id, case_id, submission_id, status, lifecycle_status
  FROM iset_application
  WHERE id = v_application_id;

  SELECT 'case' AS label, id, client_id, application_id, status, lifecycle_status, stage
  FROM iset_case
  WHERE id = v_case_id;

  SELECT 'submission' AS label, id, user_id, reference_number, status, submitted_at
  FROM iset_application_submission
  WHERE id = v_submission_id;

  SELECT
    SUM(CASE WHEN client_id = v_surviving_client_id THEN 1 ELSE 0 END) AS docs_on_surviving_client,
    SUM(CASE WHEN applicant_user_id = v_surviving_user_id THEN 1 ELSE 0 END) AS docs_on_surviving_user,
    SUM(CASE WHEN client_id = v_merged_client_id THEN 1 ELSE 0 END) AS docs_left_on_merged_client,
    SUM(CASE WHEN applicant_user_id = v_merged_user_id THEN 1 ELSE 0 END) AS docs_left_on_merged_user
  FROM iset_document
  WHERE client_id IN (v_surviving_client_id, v_merged_client_id)
     OR applicant_user_id IN (v_surviving_user_id, v_merged_user_id);
END $$

DELIMITER ;

-- Execution:
--   CALL prod_merge_denise_chalifoux_client_126_into_108_20260424();
--
-- Optional cleanup after a reviewed successful run:
--   DROP PROCEDURE IF EXISTS prod_merge_denise_chalifoux_client_126_into_108_20260424;
