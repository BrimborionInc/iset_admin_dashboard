-- PROD guarded data repair for Jodie Stephens duplicate client/case identity.
-- Prepared and intended for execution on 2026-05-04 only after:
-- - application 56 has been locked for system maintenance;
-- - an admin maintenance warning has been published;
-- - an Aurora snapshot/restore point has been started.
--
-- Repair intent:
-- - Preserve the public portal submission as the authoritative path:
--     client 156 / user 199 / case 134 / application 56 / ISET-20260501-9AEC9C.
-- - Retire the imported historical path:
--     client 72 / user 75 / case 72 / CASE-2026-0000072.
-- - Copy Amanda's draft new-intervention proposal into an application-assessment
--   draft on case 134, leaving the application in review for Amanda to complete.
-- - Keep the original proposal/action-plan/intervention rows for audit, but
--   rehome them to the survivor case and mark them non-active.
-- - Move manual-upload documents to the survivor application/case while preserving
--   source='manual_upload' and old IDs in metadata.
-- - Do not hard-delete any applicant/client/application/case data.

DELIMITER $$

DROP PROCEDURE IF EXISTS prod_merge_jodie_stephens_client_case_20260504 $$

CREATE PROCEDURE prod_merge_jodie_stephens_client_case_20260504()
BEGIN
  DECLARE v_surviving_client_id BIGINT UNSIGNED DEFAULT 156;
  DECLARE v_merged_client_id BIGINT UNSIGNED DEFAULT 72;
  DECLARE v_surviving_user_id INT DEFAULT 199;
  DECLARE v_merged_user_id INT DEFAULT 75;
  DECLARE v_surviving_case_id BIGINT UNSIGNED DEFAULT 134;
  DECLARE v_merged_case_id BIGINT UNSIGNED DEFAULT 72;
  DECLARE v_application_id BIGINT UNSIGNED DEFAULT 56;
  DECLARE v_submission_id BIGINT UNSIGNED DEFAULT 56;
  DECLARE v_action_plan_id BIGINT UNSIGNED DEFAULT 26;
  DECLARE v_intervention_id BIGINT UNSIGNED DEFAULT 35;
  DECLARE v_proposal_id BIGINT UNSIGNED DEFAULT 84;
  DECLARE v_surviving_email VARCHAR(255) DEFAULT 'jodie.stephens94@gmail.com';
  DECLARE v_merged_email VARCHAR(255) DEFAULT 'jodie.stephens@smu.ca';
  DECLARE v_run_id VARCHAR(128) DEFAULT CONCAT('jodie-stephens-merge-', DATE_FORMAT(UTC_TIMESTAMP(), '%Y%m%d%H%i%s'));
  DECLARE v_snapshot_id VARCHAR(128) DEFAULT 'path-prod-jodie-stephens-merge-20260504122704';

  DECLARE v_old_document_count INT DEFAULT 0;
  DECLARE v_old_event_entry_count INT DEFAULT 0;
  DECLARE v_old_account_event_count INT DEFAULT 0;
  DECLARE v_old_doc_intervention_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO @ok_surviving_client
  FROM client
  WHERE id = v_surviving_client_id
    AND first_name = 'Jodie'
    AND last_name = 'Stephens'
    AND dob = '1994-01-28'
    AND applicant_account_email = v_surviving_email
    AND applicant_account_status = 'activated'
    AND applicant_cognito_sub = '2c7d35f8-5081-7005-7f43-9bb4f5e15655';
  IF @ok_surviving_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Jodie client 156 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_client
  FROM client
  WHERE id = v_merged_client_id
    AND first_name = 'Jodie'
    AND last_name = 'Stephens'
    AND dob = '1994-01-28'
    AND applicant_account_email = v_merged_email
    AND applicant_account_status = 'invitation_sent'
    AND applicant_cognito_sub = 'ac7dd548-90a1-709d-de85-550b1fc80ba6';
  IF @ok_merged_client <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: imported Jodie client 72 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_user
  FROM user
  WHERE id = v_surviving_user_id
    AND email = v_surviving_email
    AND cognito_sub = '2c7d35f8-5081-7005-7f43-9bb4f5e15655'
    AND COALESCE(suspended, 0) = 0;
  IF @ok_surviving_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Jodie user 199 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_user
  FROM user
  WHERE id = v_merged_user_id
    AND email = v_merged_email
    AND cognito_sub = 'ac7dd548-90a1-709d-de85-550b1fc80ba6';
  IF @ok_merged_user <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: imported Jodie user 75 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_surviving_case
  FROM iset_case
  WHERE id = v_surviving_case_id
    AND case_number = 'ISET-20260501-9AEC9C'
    AND client_id = v_surviving_client_id
    AND assigned_staff_profile_id = 54
    AND status = 'intake'
    AND lifecycle_status = 'intake';
  IF @ok_surviving_case <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: surviving Jodie case 134 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_merged_case
  FROM iset_case
  WHERE id = v_merged_case_id
    AND case_number = 'CASE-2026-0000072'
    AND client_id = v_merged_client_id
    AND assigned_staff_profile_id = 54
    AND status = 'initiated'
    AND lifecycle_status = 'initiated';
  IF @ok_merged_case <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: imported Jodie case 72 no longer matches expected PROD state.';
  END IF;

  SELECT COUNT(*) INTO @ok_application
  FROM iset_application
  WHERE id = v_application_id
    AND submission_id = v_submission_id
    AND client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND status = 'in_review'
    AND lifecycle_status = 'in_review';
  IF @ok_application <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: application 56 no longer matches expected survivor path.';
  END IF;

  SELECT COUNT(*) INTO @ok_submission
  FROM iset_application_submission
  WHERE id = v_submission_id
    AND user_id = v_surviving_user_id
    AND reference_number = 'ISET-20260501-9AEC9C'
    AND status = 'submitted';
  IF @ok_submission <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: submission 56 no longer matches expected survivor path.';
  END IF;

  SELECT COUNT(*) INTO @ok_assessment_absent
  FROM iset_case_assessment
  WHERE case_id = v_surviving_case_id;
  IF @ok_assessment_absent <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: survivor case already has an assessment row.';
  END IF;

  SELECT COUNT(*) INTO @ok_action_plan
  FROM iset_case_action_plan
  WHERE id = v_action_plan_id
    AND case_id = v_merged_case_id
    AND application_id IS NULL
    AND status = 'draft'
    AND owner_staff_profile_id = 54;
  IF @ok_action_plan <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: action plan 26 no longer matches expected draft state.';
  END IF;

  SELECT COUNT(*) INTO @ok_intervention
  FROM iset_case_intervention
  WHERE id = v_intervention_id
    AND case_id = v_merged_case_id
    AND action_plan_id = v_action_plan_id
    AND status = 'draft'
    AND created_by_staff_profile_id = 54;
  IF @ok_intervention <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: intervention 35 no longer matches expected draft state.';
  END IF;

  SELECT COUNT(*) INTO @ok_proposal
  FROM iset_intervention_proposal
  WHERE id = v_proposal_id
    AND case_id = v_merged_case_id
    AND action_plan_id = v_action_plan_id
    AND legacy_intervention_id = v_intervention_id
    AND proposal_kind = 'new'
    AND review_status = 'draft'
    AND submitted_at IS NULL
    AND archived_at IS NULL
    AND JSON_LENGTH(JSON_EXTRACT(metadata_json, '$.proposedInterventions')) = 3;
  IF @ok_proposal <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: proposal 84 no longer matches expected unsubmitted draft state.';
  END IF;

  SELECT COUNT(*) INTO @ok_lock
  FROM application_lock
  WHERE application_id = v_application_id
    AND owner_user_id = 'system-maintenance-jodie-merge-20260504'
    AND expires_at > NOW();
  IF @ok_lock <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected system maintenance application lock is missing or expired.';
  END IF;

  SELECT COUNT(*) INTO v_old_document_count
  FROM iset_document
  WHERE client_id = v_merged_client_id
    AND case_id = v_merged_case_id;

  SELECT COUNT(*) INTO v_old_event_entry_count
  FROM iset_event_entry
  WHERE subject_type = 'case'
    AND subject_id = v_merged_case_id;

  SELECT COUNT(*) INTO v_old_account_event_count
  FROM client_applicant_account_event
  WHERE client_id = v_merged_client_id;

  SELECT COUNT(*) INTO v_old_doc_intervention_count
  FROM iset_document_intervention
  WHERE intervention_id = v_intervention_id;

  IF v_old_document_count <> 25 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Guard failed: expected 25 old Jodie documents on imported case/client.';
  END IF;

  -- Lock all core rows before mutation.
  SELECT id FROM client WHERE id IN (v_surviving_client_id, v_merged_client_id) FOR UPDATE;
  SELECT id FROM user WHERE id IN (v_surviving_user_id, v_merged_user_id) FOR UPDATE;
  SELECT id FROM iset_case WHERE id IN (v_surviving_case_id, v_merged_case_id) FOR UPDATE;
  SELECT id FROM iset_application WHERE id = v_application_id FOR UPDATE;
  SELECT id FROM iset_application_submission WHERE id = v_submission_id FOR UPDATE;
  SELECT id FROM iset_case_action_plan WHERE id = v_action_plan_id FOR UPDATE;
  SELECT id FROM iset_case_intervention WHERE id = v_intervention_id FOR UPDATE;
  SELECT id FROM iset_intervention_proposal WHERE id = v_proposal_id FOR UPDATE;
  SELECT id FROM iset_document WHERE client_id = v_merged_client_id OR case_id = v_merged_case_id FOR UPDATE;
  SELECT id FROM client_applicant_account_event WHERE client_id = v_merged_client_id FOR UPDATE;
  SELECT application_id FROM application_lock WHERE application_id = v_application_id FOR UPDATE;

  INSERT INTO iset_client_merge_audit
    (surviving_client_id, merged_client_id, merged_by_staff_profile_id, merge_reason, notes, metadata_json, merged_at)
  VALUES
    (
      v_surviving_client_id,
      v_merged_client_id,
      NULL,
      'Jodie Stephens duplicate identity: imported SMU-email client superseded by activated public-portal Gmail identity.',
      'Survivor is public portal client 156 / user 199 / application 56. Imported client 72 is retained for audit, while old case content is moved or retired without hard deletes.',
      JSON_OBJECT(
        'run_id', v_run_id,
        'snapshot_id', v_snapshot_id,
        'surviving_user_id', v_surviving_user_id,
        'merged_user_id', v_merged_user_id,
        'surviving_email', v_surviving_email,
        'merged_email', v_merged_email,
        'surviving_case_id', v_surviving_case_id,
        'merged_case_id', v_merged_case_id,
        'application_id', v_application_id,
        'submission_id', v_submission_id,
        'old_document_count', v_old_document_count,
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
      'Jodie Stephens imported case retired into public-portal application case.',
      0,
      'Application 56 remains on survivor case 134. Imported draft proposal 84 is copied into an assessment draft, then original draft artifacts are rehomed to survivor case and archived/withdrawn.',
      JSON_OBJECT(
        'run_id', v_run_id,
        'snapshot_id', v_snapshot_id,
        'application_id', v_application_id,
        'action_plan_id', v_action_plan_id,
        'intervention_id', v_intervention_id,
        'proposal_id', v_proposal_id,
        'old_document_count', v_old_document_count,
        'old_event_entry_count', v_old_event_entry_count,
        'old_document_intervention_count', v_old_doc_intervention_count
      ),
      NOW()
    );

  INSERT INTO iset_case_assessment (
    case_id,
    date_of_assessment,
    overview,
    employment_goals,
    previous_iset,
    employment_barriers,
    other_funding_details,
    esdc_eligibility,
    intervention_start_date,
    intervention_end_date,
    posting_context,
    intervention_code,
    intervention_duration_days,
    intervention_cost_total,
    institution,
    program_name,
    recommendation,
    justification,
    nwac_review,
    nwac_reason,
    childcare_need,
    childcare_funding_details,
    proposed_interventions,
    created_at,
    updated_at
  )
  SELECT
    v_surviving_case_id,
    NULL,
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.rationale')),
    NULL,
    NULL,
    JSON_EXTRACT(p.metadata_json, '$.barriers'),
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.otherFundingDetails.notes')),
    NULL,
    p.start_date,
    p.end_date,
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.postingContext')),
    p.intervention_code,
    NULL,
    6600,
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[2].institution')),
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.proposedInterventions[2].programName')),
    NULL,
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.rationale')),
    NULL,
    NULL,
    0,
    JSON_UNQUOTE(JSON_EXTRACT(p.metadata_json, '$.childcareFunding')),
    JSON_EXTRACT(p.metadata_json, '$.proposedInterventions'),
    NOW(),
    NOW()
  FROM iset_intervention_proposal p
  WHERE p.id = v_proposal_id;

  UPDATE iset_case survivor
  JOIN iset_application app ON app.id = v_application_id
  JOIN iset_application_submission sub ON sub.id = app.submission_id
  SET
    survivor.case_context_json = JSON_SET(
      COALESCE(survivor.case_context_json, JSON_OBJECT()),
      '$.firstName', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."first-name"')),
      '$.lastName', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."last-name"')),
      '$.dateOfBirth', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$.dob')),
      '$.emailPrimary', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."contact-email-address"')),
      '$.gender', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$.gender')),
      '$.indigenousIdentity', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."legal-indigenous-identity"')),
      '$.applicationAnswers', sub.intake_payload,
      '$.applicationPersonal', JSON_OBJECT(
        'first_name', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."first-name"')),
        'last_name', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."last-name"')),
        'date_of_birth', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$.dob')),
        'email', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."contact-email-address"')),
        'gender', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$.gender')),
        'sin', JSON_UNQUOTE(JSON_EXTRACT(sub.intake_payload, '$."social-insurance-number"'))
      ),
      '$.prod_jodie_merge_20260504', JSON_OBJECT(
        'run_id', v_run_id,
        'merged_case_id', v_merged_case_id,
        'merged_case_number', 'CASE-2026-0000072',
        'merged_client_id', v_merged_client_id,
        'merged_user_id', v_merged_user_id,
        'merged_email', v_merged_email,
        'survivor_source', 'public_portal_application',
        'assessment_seeded_from_proposal_id', v_proposal_id
      )
    ),
    survivor.updated_at = NOW()
  WHERE survivor.id = v_surviving_case_id;

  UPDATE iset_application
  SET payload_json = JSON_SET(
        COALESCE(payload_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_case_id', v_merged_case_id,
          'merged_client_id', v_merged_client_id,
          'assessment_seeded_from_proposal_id', v_proposal_id,
          'manual_documents_moved_from_case_id', v_merged_case_id
        )
      ),
      row_version = row_version + 1,
      updated_at = NOW()
  WHERE id = v_application_id;

  UPDATE iset_case_action_plan
  SET case_id = v_surviving_case_id,
      application_id = v_application_id,
      status = 'archived',
      archived_at = COALESCE(archived_at, NOW()),
      metadata_json = JSON_SET(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_case_id', v_merged_case_id,
          'previous_application_id', NULL,
          'retired_reason', 'Converted to application assessment draft on survivor application'
        )
      ),
      updated_at = NOW()
  WHERE id = v_action_plan_id;

  UPDATE iset_case_intervention
  SET case_id = v_surviving_case_id,
      action_plan_id = v_action_plan_id,
      status = 'archived',
      closed_at = COALESCE(closed_at, NOW()),
      metadata_json = JSON_SET(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_case_id', v_merged_case_id,
          'converted_to_assessment_case_id', v_surviving_case_id,
          'converted_to_application_id', v_application_id,
          'retired_reason', 'Converted to application assessment draft'
        )
      ),
      updated_at = NOW()
  WHERE id = v_intervention_id;

  UPDATE iset_intervention_proposal
  SET case_id = v_surviving_case_id,
      application_id = v_application_id,
      action_plan_id = v_action_plan_id,
      review_status = 'withdrawn',
      archived_at = COALESCE(archived_at, NOW()),
      metadata_json = JSON_SET(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_case_id', v_merged_case_id,
          'previous_application_id', NULL,
          'converted_to_assessment_case_id', v_surviving_case_id,
          'converted_to_application_id', v_application_id,
          'retired_reason', 'Copied into application assessment draft'
        )
      ),
      updated_at = NOW()
  WHERE id = v_proposal_id;

  UPDATE iset_document
  SET client_id = v_surviving_client_id,
      case_id = v_surviving_case_id,
      application_id = v_application_id,
      applicant_user_id = COALESCE(applicant_user_id, v_surviving_user_id),
      metadata = JSON_SET(
        COALESCE(metadata, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_client_id', v_merged_client_id,
          'previous_case_id', v_merged_case_id,
          'previous_application_id', application_id,
          'previous_action_plan_id', action_plan_id,
          'previous_applicant_user_id', applicant_user_id,
          'preserved_source', source
        )
      ),
      updated_at = NOW()
  WHERE client_id = v_merged_client_id
    AND case_id = v_merged_case_id;

  UPDATE iset_event_entry
  SET subject_id = v_surviving_case_id,
      tracking_id = 'ISET-20260501-9AEC9C',
      payload_json = JSON_SET(
        COALESCE(payload_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_subject_id', v_merged_case_id,
          'previous_tracking_id', tracking_id
        )
      )
  WHERE subject_type = 'case'
    AND subject_id = v_merged_case_id;

  UPDATE client_applicant_account_event
  SET client_id = v_surviving_client_id,
      metadata_json = JSON_SET(
        COALESCE(metadata_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'previous_client_id', v_merged_client_id,
          'previous_email', v_merged_email
        )
      )
  WHERE client_id = v_merged_client_id;

  UPDATE user
  SET suspended = 1,
      updated_at = NOW()
  WHERE id = v_merged_user_id
    AND email = v_merged_email;

  UPDATE client
  SET address_json = JSON_SET(
        COALESCE(address_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_into_client_id', v_surviving_client_id,
          'merged_into_user_id', v_surviving_user_id,
          'merged_into_email', v_surviving_email,
          'retired_reason', 'Duplicate imported client superseded by activated public portal identity'
        )
      ),
      updated_at = NOW()
  WHERE id = v_merged_client_id;

  UPDATE iset_case
  SET client_id = NULL,
      assigned_staff_profile_id = NULL,
      status = 'archived',
      lifecycle_status = 'archived',
      stage = 'merged_duplicate',
      closed_at = COALESCE(closed_at, NOW()),
      case_context_json = JSON_SET(
        COALESCE(case_context_json, JSON_OBJECT()),
        '$.prod_jodie_merge_20260504',
        JSON_OBJECT(
          'run_id', v_run_id,
          'merged_into_case_id', v_surviving_case_id,
          'merged_into_case_number', 'ISET-20260501-9AEC9C',
          'merged_into_client_id', v_surviving_client_id,
          'retired_reason', 'Duplicate imported case merged into public portal application case'
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
      (SELECT COUNT(*) FROM iset_event_entry WHERE subject_type = 'case' AND subject_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_application WHERE case_id = v_merged_case_id) +
      (SELECT COUNT(*) FROM iset_case_assessment WHERE case_id = v_merged_case_id)
  );

  SET @assessment_count = (
    SELECT COUNT(*) FROM iset_case_assessment WHERE case_id = v_surviving_case_id
  );

  SET @moved_doc_count = (
    SELECT COUNT(*) FROM iset_document
    WHERE client_id = v_surviving_client_id
      AND case_id = v_surviving_case_id
      AND application_id = v_application_id
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.prod_jodie_merge_20260504.previous_case_id')) AS UNSIGNED) = v_merged_case_id
  );

  IF @remaining_old_case_refs <> 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: active child references remain on old Jodie case 72.';
  END IF;

  IF @assessment_count <> 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: assessment draft was not created on survivor case 134.';
  END IF;

  IF @moved_doc_count <> v_old_document_count THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Post-check failed: not all old Jodie documents moved to survivor application.';
  END IF;

  COMMIT;

  SELECT v_run_id AS run_id, v_snapshot_id AS snapshot_id;

  SELECT 'surviving_client' AS label, id, first_name, last_name, dob, applicant_account_email, applicant_account_status, applicant_cognito_sub
  FROM client
  WHERE id = v_surviving_client_id;

  SELECT 'retired_client' AS label, id, first_name, last_name, dob, applicant_account_email, applicant_account_status, applicant_cognito_sub
  FROM client
  WHERE id = v_merged_client_id;

  SELECT 'surviving_case' AS label, id, case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage
  FROM iset_case
  WHERE id = v_surviving_case_id;

  SELECT 'retired_case' AS label, id, case_number, client_id, assigned_staff_profile_id, status, lifecycle_status, stage
  FROM iset_case
  WHERE id = v_merged_case_id;

  SELECT 'application' AS label, id, submission_id, client_id, case_id, status, lifecycle_status, row_version
  FROM iset_application
  WHERE id = v_application_id;

  SELECT 'assessment' AS label, case_id, intervention_code, intervention_cost_total, JSON_LENGTH(proposed_interventions) AS proposed_intervention_count, created_at, updated_at
  FROM iset_case_assessment
  WHERE case_id = v_surviving_case_id;

  SELECT 'retired_proposal' AS label, id, case_id, application_id, review_status, archived_at
  FROM iset_intervention_proposal
  WHERE id = v_proposal_id;

  SELECT 'moved_documents' AS label, COUNT(*) AS doc_count
  FROM iset_document
  WHERE client_id = v_surviving_client_id
    AND case_id = v_surviving_case_id
    AND application_id = v_application_id
    AND CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.prod_jodie_merge_20260504.previous_case_id')) AS UNSIGNED) = v_merged_case_id;
END $$

DELIMITER ;

CALL prod_merge_jodie_stephens_client_case_20260504();

DROP PROCEDURE IF EXISTS prod_merge_jodie_stephens_client_case_20260504;
