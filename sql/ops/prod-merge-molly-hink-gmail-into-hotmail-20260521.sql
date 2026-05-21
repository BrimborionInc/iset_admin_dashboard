-- PROD guarded data repair for Molly Hink duplicate applicant identities.
-- Prepared for execution on 2026-05-21 only after:
-- - applications 50 and 76 have been locked for system maintenance;
-- - an admin maintenance warning has been published;
-- - Aurora snapshot path-prod-molly-hink-merge-20260521115556 has been started.
--
-- Repair intent:
-- - Preserve the Hotmail portal identity as canonical:
--     client 149 / user 189 / case 129 / application 50 / ISET-20260429-AF259F.
-- - Retire the imported/Gmail identity:
--     client 42 / user 45 / case 42 / application 76 / ISET-20260520-DDDA45.
-- - Keep Emilie Marion's active in-review application/case as the working file.
-- - Rehome the Gmail duplicate submission documents onto the canonical active
--   Hotmail application so staff can see the fresh uploads in the working file.
-- - Archive application 76 as a duplicate application episode on the survivor
--   case, preserve its submission row for audit, and do not hard-delete data.

DELIMITER $$

DROP PROCEDURE IF EXISTS prod_merge_molly_hink_gmail_into_hotmail_20260521 $$

CREATE PROCEDURE prod_merge_molly_hink_gmail_into_hotmail_20260521()
BEGIN
  DECLARE v_surviving_client_id BIGINT UNSIGNED DEFAULT 149;
  DECLARE v_merged_client_id BIGINT UNSIGNED DEFAULT 42;
  DECLARE v_surviving_user_id INT DEFAULT 189;
  DECLARE v_merged_user_id INT DEFAULT 45;
  DECLARE v_surviving_case_id BIGINT UNSIGNED DEFAULT 129;
  DECLARE v_merged_case_id BIGINT UNSIGNED DEFAULT 42;
  DECLARE v_surviving_application_id BIGINT UNSIGNED DEFAULT 50;
  DECLARE v_merged_application_id BIGINT UNSIGNED DEFAULT 76;
  DECLARE v_surviving_submission_id BIGINT UNSIGNED DEFAULT 50;
  DECLARE v_merged_submission_id BIGINT UNSIGNED DEFAULT 76;
  DECLARE v_surviving_email VARCHAR(255) DEFAULT 'molly.hink@hotmail.com';
  DECLARE v_merged_email VARCHAR(255) DEFAULT 'molly.hink@gmail.com';
  DECLARE v_merged_submission_contact_email VARCHAR(255) DEFAULT 'mollyhink@gmail.com';
  DECLARE v_run_id VARCHAR(128) DEFAULT CONCAT('molly-hink-merge-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));
  DECLARE v_snapshot_id VARCHAR(128) DEFAULT 'path-prod-molly-hink-merge-20260521115556';

  DECLARE v_old_document_count INT DEFAULT 0;
  DECLARE v_survivor_application_document_count INT DEFAULT 0;
  DECLARE v_survivor_manual_document_count INT DEFAULT 0;
  DECLARE v_old_event_entry_count INT DEFAULT 0;
  DECLARE v_old_account_event_count INT DEFAULT 0;
  DECLARE v_old_notification_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO @ok_surviving_client
  FROM client
  WHERE id = v_surviving_client_id
    AND first_name = 'Molly'
    AND last_name = 'Hink'
    AND dob = '1962-12-08'
    AND applicant_account_email = v_surviving_email
    AND applicant_account_status = 'activated'
    AND applicant_cognito_sub = '2cbd45c8-4021-707f-5c76-e8b979efb296';
  IF @ok_surviving_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Molly client 149 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_client
  FROM client
  WHERE id = v_merged_client_id
    AND first_name = 'Molly'
    AND last_name = 'Hink'
    AND applicant_account_email = v_merged_email
    AND applicant_account_status = 'activated'
    AND applicant_cognito_sub = '7c3d3538-1091-70dd-9cc8-995615d25d29';
  IF @ok_merged_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: merged Molly client 42 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_user
  FROM user
  WHERE id = v_surviving_user_id
    AND email = v_surviving_email
    AND cognito_sub = '2cbd45c8-4021-707f-5c76-e8b979efb296'
    AND COALESCE(suspended, 0) = 0;
  IF @ok_surviving_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Molly user 189 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_user
  FROM user
  WHERE id = v_merged_user_id
    AND email = v_merged_email
    AND cognito_sub = '7c3d3538-1091-70dd-9cc8-995615d25d29'
    AND COALESCE(suspended, 0) = 0;
  IF @ok_merged_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: merged Molly user 45 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_case
  FROM iset_case
  WHERE id = v_surviving_case_id
    AND case_number = 'ISET-20260429-AF259F'
    AND client_id = v_surviving_client_id
    AND assigned_staff_profile_id = 55
    AND status = 'intake'
    AND lifecycle_status = 'intake';
  IF @ok_surviving_case <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Molly case 129 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_case
  FROM iset_case
  WHERE id = v_merged_case_id
    AND case_number = 'CASE-2026-0000042'
    AND client_id = v_merged_client_id
    AND assigned_staff_profile_id = 51
    AND status = 'initiated'
    AND lifecycle_status = 'initiated';
  IF @ok_merged_case <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: merged Molly case 42 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_application
  FROM iset_application
  WHERE id = v_surviving_application_id
    AND submission_id = v_surviving_submission_id
    AND client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND status = 'in_review'
    AND lifecycle_status = 'in_review'
    AND row_version = 3;
  IF @ok_surviving_application <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: survivor Molly application 50 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_application
  FROM iset_application
  WHERE id = v_merged_application_id
    AND submission_id = v_merged_submission_id
    AND client_id = v_merged_client_id
    AND case_id = v_merged_case_id
    AND status = 'submitted'
    AND lifecycle_status = 'submitted'
    AND row_version = 1;
  IF @ok_merged_application <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: duplicate Molly application 76 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_submission
  FROM iset_application_submission
  WHERE id = v_surviving_submission_id
    AND user_id = v_surviving_user_id
    AND reference_number = 'ISET-20260429-AF259F'
    AND status = 'submitted'
    AND JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$."contact-email-address"')) = 'mollyhink@hotmail.com'
    AND JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$.dob')) = '1962-12-08';
  IF @ok_surviving_submission <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: survivor Molly submission 50 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_submission
  FROM iset_application_submission
  WHERE id = v_merged_submission_id
    AND user_id = v_merged_user_id
    AND reference_number = 'ISET-20260520-DDDA45'
    AND status = 'submitted'
    AND JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$."contact-email-address"')) = v_merged_submission_contact_email
    AND JSON_UNQUOTE(JSON_EXTRACT(intake_payload, '$.dob')) = '1962-12-08';
  IF @ok_merged_submission <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: duplicate Molly submission 76 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_survivor_application_assessment
  FROM iset_application_assessment
  WHERE application_id = v_surviving_application_id
    AND case_id = v_surviving_case_id;
  IF @ok_survivor_application_assessment <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: survivor Molly application assessment is missing or duplicated.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_application_assessment_absent
  FROM iset_application_assessment
  WHERE application_id = v_merged_application_id
     OR case_id = v_merged_case_id;
  IF @ok_merged_application_assessment_absent <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: duplicate Molly application/case unexpectedly has assessment rows.';
  END IF;

  SELECT COUNT(*) INTO @ok_input_state_absent
  FROM input_json_state
  WHERE client_id IN (v_surviving_client_id, v_merged_client_id)
     OR user_id IN (v_surviving_user_id, v_merged_user_id);
  IF @ok_input_state_absent <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: active Molly intake session state exists; stop before merging.';
  END IF;

  SELECT COUNT(*) INTO v_old_document_count
  FROM iset_document
  WHERE client_id = v_merged_client_id
    AND case_id = v_merged_case_id
    AND application_id = v_merged_application_id
    AND applicant_user_id = v_merged_user_id
    AND source = 'application_submission'
    AND status = 'active';

  SELECT COUNT(*) INTO v_survivor_application_document_count
  FROM iset_document
  WHERE client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND application_id = v_surviving_application_id
    AND applicant_user_id = v_surviving_user_id
    AND source = 'application_submission'
    AND status = 'active';

  SELECT COUNT(*) INTO v_survivor_manual_document_count
  FROM iset_document
  WHERE client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND application_id = v_surviving_application_id
    AND applicant_user_id = v_surviving_user_id
    AND source = 'manual_upload'
    AND status = 'active';

  SELECT COUNT(*) INTO v_old_event_entry_count
  FROM iset_event_entry
  WHERE subject_type = 'case'
    AND subject_id = CAST(v_merged_case_id AS CHAR);

  SELECT COUNT(*) INTO v_old_account_event_count
  FROM client_applicant_account_event
  WHERE client_id = v_merged_client_id;

  SELECT COUNT(*) INTO v_old_notification_count
  FROM iset_internal_notification
  WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) = CAST(v_merged_case_id AS CHAR)
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) = 'ISET-20260520-DDDA45'
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) = 'ISET-20260520-DDDA45';

  IF v_old_document_count <> 22 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 22 active duplicate Molly application documents.';
  END IF;

  IF v_survivor_application_document_count <> 22 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 22 active survivor Molly application documents before merge.';
  END IF;

  IF v_survivor_manual_document_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 1 active survivor Molly manual-upload document before merge.';
  END IF;

  IF v_old_event_entry_count <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 2 duplicate Molly case event rows.';
  END IF;

  IF v_old_account_event_count <> 7 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 7 duplicate Molly client account event rows.';
  END IF;

  IF v_old_notification_count <> 4 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 4 duplicate Molly internal notification rows.';
  END IF;

  SELECT COUNT(*) INTO @ok_locks
  FROM application_lock
  WHERE application_id IN (v_surviving_application_id, v_merged_application_id)
    AND owner_user_id = 'system-maintenance-molly-merge-20260521'
    AND expires_at > NOW();
  IF @ok_locks <> 2 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected Molly system maintenance application locks are missing or expired.';
  END IF;

  -- Lock all core rows before mutation.
  SELECT id FROM client WHERE id IN (v_surviving_client_id, v_merged_client_id) FOR UPDATE;
  SELECT id FROM user WHERE id IN (v_surviving_user_id, v_merged_user_id) FOR UPDATE;
  SELECT id FROM iset_case WHERE id IN (v_surviving_case_id, v_merged_case_id) FOR UPDATE;
  SELECT id FROM iset_application WHERE id IN (v_surviving_application_id, v_merged_application_id) FOR UPDATE;
  SELECT id FROM iset_application_submission WHERE id IN (v_surviving_submission_id, v_merged_submission_id) FOR UPDATE;
  SELECT id FROM iset_document WHERE client_id IN (v_surviving_client_id, v_merged_client_id)
    OR case_id IN (v_surviving_case_id, v_merged_case_id)
    OR application_id IN (v_surviving_application_id, v_merged_application_id)
    OR applicant_user_id IN (v_surviving_user_id, v_merged_user_id)
    OR user_id IN (v_surviving_user_id, v_merged_user_id)
  FOR UPDATE;
  SELECT id FROM client_applicant_account_event WHERE client_id IN (v_surviving_client_id, v_merged_client_id) FOR UPDATE;
  SELECT id FROM iset_event_entry WHERE subject_type = 'case' AND subject_id IN (CAST(v_surviving_case_id AS CHAR), CAST(v_merged_case_id AS CHAR)) FOR UPDATE;
  SELECT id FROM iset_internal_notification
  WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) IN (CAST(v_surviving_case_id AS CHAR), CAST(v_merged_case_id AS CHAR))
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) IN ('ISET-20260429-AF259F', 'ISET-20260520-DDDA45')
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) IN ('ISET-20260429-AF259F', 'ISET-20260520-DDDA45')
  FOR UPDATE;
  SELECT application_id FROM application_lock WHERE application_id IN (v_surviving_application_id, v_merged_application_id) FOR UPDATE;

  INSERT INTO iset_client_merge_audit
    (surviving_client_id, merged_client_id, merged_by_staff_profile_id, merge_reason, notes, metadata_json, merged_at)
  VALUES
    (
      v_surviving_client_id,
      v_merged_client_id,
      NULL,
      'Molly Hink duplicate applicant identities: Hotmail account confirmed as final PATH login.',
      'Survivor is Hotmail client 149 / user 189 / case 129 / application 50. Duplicate Gmail client 42 / user 45 / application 76 is retained for audit, with its documents moved to the survivor application and the old user suspended.',
      JSON_OBJECT(
        'run_id', v_run_id,
        'snapshot_id', v_snapshot_id,
        'surviving_user_id', v_surviving_user_id,
        'merged_user_id', v_merged_user_id,
        'surviving_email', v_surviving_email,
        'merged_email', v_merged_email,
        'surviving_case_id', v_surviving_case_id,
        'merged_case_id', v_merged_case_id,
        'surviving_application_id', v_surviving_application_id,
        'merged_application_id', v_merged_application_id,
        'surviving_submission_id', v_surviving_submission_id,
        'merged_submission_id', v_merged_submission_id,
        'moved_duplicate_application_document_count', v_old_document_count,
        'old_account_event_count', v_old_account_event_count,
        'old_user_suspended', true
      ),
      NOW()
    );

  INSERT INTO iset_case_merge_audit
    (surviving_case_id, merged_case_id, surviving_client_id, merged_client_id, merged_by_staff_profile_id, merge_reason, repointed_application_count, notes, metadata_json, merged_at)
  VALUES
    (
      v_surviving_case_id,
      v_merged_case_id,
      v_surviving_client_id,
      v_merged_client_id,
      NULL,
      'Molly Hink imported/Gmail case retired into Hotmail public-portal application case.',
      1,
      'Application 50 remains the active in-review survivor application. Duplicate application 76 is moved onto the survivor case as archived/duplicate, while its submitted documents are rehomed to application 50 for staff continuity.',
      JSON_OBJECT(
        'run_id', v_run_id,
        'snapshot_id', v_snapshot_id,
        'surviving_application_id', v_surviving_application_id,
        'merged_application_id', v_merged_application_id,
        'old_document_count', v_old_document_count,
        'old_event_entry_count', v_old_event_entry_count,
        'old_notification_count', v_old_notification_count
      ),
      NOW()
    );

  UPDATE iset_case
  SET case_context_json = JSON_SET(
        COALESCE(case_context_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_case_id', v_merged_case_id,
          'merged_case_number', 'CASE-2026-0000042',
          'merged_client_id', v_merged_client_id,
          'merged_user_id', v_merged_user_id,
          'merged_application_id', v_merged_application_id,
          'merged_submission_id', v_merged_submission_id,
          'merged_email', v_merged_email,
          'survivor_source', 'hotmail_public_portal_application',
          'duplicate_documents_moved_to_application_id', v_surviving_application_id
        )
      ),
      updated_at = NOW()
  WHERE id = v_surviving_case_id;

  UPDATE iset_application
  SET payload_json = JSON_SET(
        COALESCE(payload_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_case_id', v_merged_case_id,
          'merged_client_id', v_merged_client_id,
          'merged_user_id', v_merged_user_id,
          'merged_application_id', v_merged_application_id,
          'merged_submission_id', v_merged_submission_id,
          'duplicate_documents_moved_count', v_old_document_count
        )
      ),
      row_version = row_version + 1,
      updated_at = NOW()
  WHERE id = v_surviving_application_id;

  UPDATE iset_application
  SET payload_json = JSON_SET(
        COALESCE(payload_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_client_id', v_merged_client_id,
          'previous_case_id', v_merged_case_id,
          'previous_status', status,
          'previous_lifecycle_status', lifecycle_status,
          'merged_into_client_id', v_surviving_client_id,
          'merged_into_case_id', v_surviving_case_id,
          'canonical_application_id', v_surviving_application_id,
          'canonical_submission_id', v_surviving_submission_id,
          'retired_reason', 'Duplicate application submitted under Gmail account after Hotmail account had already submitted the working application'
        )
      ),
      client_id = v_surviving_client_id,
      case_id = v_surviving_case_id,
      status = 'archived',
      lifecycle_status = 'archived',
      awaiting_reason = 'none',
      closure_reason = 'duplicate',
      row_version = row_version + 1,
      updated_at = NOW()
  WHERE id = v_merged_application_id;

  UPDATE iset_document
  SET metadata = JSON_SET(
        COALESCE(metadata, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_client_id', client_id,
          'previous_case_id', case_id,
          'previous_application_id', application_id,
          'previous_user_id', user_id,
          'previous_applicant_user_id', applicant_user_id,
          'previous_submission_id', v_merged_submission_id,
          'previous_reference_number', 'ISET-20260520-DDDA45',
          'preserved_source', source,
          'merged_into_application_id', v_surviving_application_id,
          'merged_into_applicant_user_id', v_surviving_user_id
        )
      ),
      client_id = v_surviving_client_id,
      case_id = v_surviving_case_id,
      application_id = v_surviving_application_id,
      user_id = CASE WHEN user_id = v_merged_user_id THEN v_surviving_user_id ELSE user_id END,
      applicant_user_id = CASE WHEN applicant_user_id = v_merged_user_id THEN v_surviving_user_id ELSE applicant_user_id END,
      updated_at = NOW()
  WHERE client_id = v_merged_client_id
    AND case_id = v_merged_case_id
    AND application_id = v_merged_application_id
    AND source = 'application_submission';

  UPDATE iset_event_entry
  SET subject_id = CAST(v_surviving_case_id AS CHAR),
      tracking_id = 'ISET-20260429-AF259F',
      payload_json = JSON_SET(
        COALESCE(payload_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_subject_id', v_merged_case_id,
          'previous_tracking_id', tracking_id,
          'merged_application_id', v_merged_application_id,
          'canonical_application_id', v_surviving_application_id
        )
      )
  WHERE subject_type = 'case'
    AND subject_id = CAST(v_merged_case_id AS CHAR);

  UPDATE client_applicant_account_event
  SET client_id = v_surviving_client_id,
      metadata_json = JSON_SET(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_client_id', v_merged_client_id,
          'previous_email', v_merged_email,
          'canonical_client_id', v_surviving_client_id,
          'canonical_email', v_surviving_email
        )
      )
  WHERE client_id = v_merged_client_id;

  UPDATE iset_internal_notification
  SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND),
      metadata = JSON_SET(
        COALESCE(metadata, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_case_id', v_merged_case_id,
          'previous_tracking_id', 'ISET-20260520-DDDA45',
          'canonical_case_id', v_surviving_case_id,
          'canonical_tracking_id', 'ISET-20260429-AF259F',
          'expired_reason', 'Duplicate Gmail application notification retired during Hotmail merge'
        )
      ),
      updated_at = NOW()
  WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) = CAST(v_merged_case_id AS CHAR)
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) = 'ISET-20260520-DDDA45'
     OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) = 'ISET-20260520-DDDA45';

  UPDATE user
  SET suspended = 1,
      updated_at = NOW()
  WHERE id = v_merged_user_id
    AND email = v_merged_email;

  UPDATE client
  SET address_json = JSON_SET(
        COALESCE(address_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_into_client_id', v_surviving_client_id,
          'merged_into_user_id', v_surviving_user_id,
          'merged_into_email', v_surviving_email,
          'merged_into_case_id', v_surviving_case_id,
          'merged_into_application_id', v_surviving_application_id,
          'retired_reason', 'Duplicate imported/Gmail client superseded by confirmed Hotmail PATH login'
        )
      ),
      updated_at = NOW()
  WHERE id = v_merged_client_id;

  UPDATE iset_case
  SET client_id = NULL,
      assigned_staff_profile_id = NULL,
      status = 'archived',
      lifecycle_status = 'archived',
      closure_reason = 'duplicate',
      stage = 'merged_duplicate',
      closed_at = COALESCE(closed_at, NOW()),
      case_context_json = JSON_SET(
        COALESCE(case_context_json, JSON_OBJECT()),
        '$.prod_molly_hink_merge_20260521',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_into_case_id', v_surviving_case_id,
          'merged_into_case_number', 'ISET-20260429-AF259F',
          'merged_into_client_id', v_surviving_client_id,
          'merged_into_application_id', v_surviving_application_id,
          'retired_reason', 'Duplicate imported/Gmail case merged into Hotmail application case'
        )
      ),
      updated_at = NOW()
  WHERE id = v_merged_case_id;

  SET @remaining_old_case_refs = (
    SELECT
      (SELECT COUNT(*) FROM iset_case_action_plan WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_case_intervention WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_intervention_proposal WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_document WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_event_entry WHERE subject_type = 'case' AND subject_id = CAST(v_merged_case_id AS CHAR)) +
      (SELECT COUNT(*) FROM iset_application WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_case_assessment WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_application_assessment WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM messages WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM message_attachment WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM signing_request WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_case_note WHERE case_id = v_merged_case_id AND deleted_at IS NULL) +
      (SELECT COUNT(*) FROM iset_case_reminder WHERE case_id = v_merged_case_id AND deleted_at IS NULL) +
      (SELECT COUNT(*) FROM iset_case_task WHERE case_id = v_merged_case_id AND deleted_at IS NULL)
  );

  SET @remaining_old_client_refs = (
    SELECT
      (SELECT COUNT(*) FROM iset_application WHERE client_id = v_merged_client_id) +
      (SELECT COUNT(*) FROM iset_case WHERE client_id = v_merged_client_id) +
      (SELECT COUNT(*) FROM iset_document WHERE client_id = v_merged_client_id) +
      (SELECT COUNT(*) FROM message_attachment WHERE client_id = v_merged_client_id) +
      (SELECT COUNT(*) FROM client_applicant_account_event WHERE client_id = v_merged_client_id) +
      (SELECT COUNT(*) FROM input_json_state WHERE client_id = v_merged_client_id)
  );

  SET @moved_doc_count = (
    SELECT COUNT(*)
    FROM iset_document
    WHERE client_id = v_surviving_client_id
      AND case_id = v_surviving_case_id
      AND application_id = v_surviving_application_id
      AND applicant_user_id = v_surviving_user_id
      AND source = 'application_submission'
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.prod_molly_hink_merge_20260521.previous_application_id')) AS UNSIGNED) = v_merged_application_id
  );

  SET @old_application_doc_count = (
    SELECT COUNT(*)
    FROM iset_document
    WHERE application_id = v_merged_application_id
  );

  SET @active_old_notification_count = (
    SELECT COUNT(*)
    FROM iset_internal_notification
    WHERE (
          JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.caseId')) = CAST(v_merged_case_id AS CHAR)
       OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.trackingId')) = 'ISET-20260520-DDDA45'
       OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.applicationReference')) = 'ISET-20260520-DDDA45'
    )
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (expires_at IS NULL OR expires_at >= NOW())
  );

  IF @remaining_old_case_refs <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: active child references remain on old Molly case 42.';
  END IF;

  IF @remaining_old_client_refs <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: active child references remain on old Molly client 42.';
  END IF;

  IF @moved_doc_count <> v_old_document_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: not all old Molly documents moved to survivor application.';
  END IF;

  IF @old_application_doc_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: documents still point at duplicate Molly application 76.';
  END IF;

  IF @active_old_notification_count <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: active duplicate Molly notifications remain.';
  END IF;

  COMMIT;

  SELECT v_run_id AS run_id, v_snapshot_id AS snapshot_id;

  SELECT 'surviving_client' AS label, id, first_name, last_name, dob, applicant_account_email, applicant_account_status, applicant_cognito_sub
  FROM client
  WHERE id = v_surviving_client_id;

  SELECT 'retired_client' AS label, id, first_name, last_name, dob, applicant_account_email, applicant_account_status, applicant_cognito_sub
  FROM client
  WHERE id = v_merged_client_id;

  SELECT 'surviving_case' AS label, id, case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, closure_reason, stage
  FROM iset_case
  WHERE id = v_surviving_case_id;

  SELECT 'retired_case' AS label, id, case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, closure_reason, stage
  FROM iset_case
  WHERE id = v_merged_case_id;

  SELECT 'surviving_application' AS label, id, submission_id, client_id, case_id, status, lifecycle_status, closure_reason, row_version
  FROM iset_application
  WHERE id = v_surviving_application_id;

  SELECT 'archived_duplicate_application' AS label, id, submission_id, client_id, case_id, status, lifecycle_status, closure_reason, row_version
  FROM iset_application
  WHERE id = v_merged_application_id;

  SELECT 'moved_documents' AS label, COUNT(*) AS doc_count
  FROM iset_document
  WHERE client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND application_id = v_surviving_application_id
    AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.prod_molly_hink_merge_20260521.previous_application_id')) AS UNSIGNED) = v_merged_application_id;

  SELECT 'retired_user' AS label, id, email, suspended, deleted_at
  FROM user
  WHERE id = v_merged_user_id;
END $$

DELIMITER ;

CALL prod_merge_molly_hink_gmail_into_hotmail_20260521();

DROP PROCEDURE IF EXISTS prod_merge_molly_hink_gmail_into_hotmail_20260521;
