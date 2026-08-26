-- TEST-only, retained acceptance fixture for feedback #196.
--
-- This is a one-time data setup artifact, not a qualification harness.  The
-- acceptance action itself must be performed through the deployed Regional
-- Manager HTTP API.  Bill authorized this disposable TEST case and the
-- resulting CFA/message/signing audit artifacts to remain on 2026-08-25.
--
-- Live TEST identity proved immediately before review:
--   AWS account: 124355655255
--   database: iset_intake
--   current user: app_admin@10.48.%
--   host: ip-172-16-0-199
--   engine: MySQL 8.0.42
--
-- Full live SHOW CREATE TABLE / SHOW FULL COLUMNS / SHOW INDEX evidence was
-- captured for every table touched before this file was written.  All tables
-- below are live InnoDB tables.  The fixed unique identifiers deliberately
-- make an accidental rerun fail closed and roll back.

START TRANSACTION;

SET @fixture_guard = 0;
SET @fixture_user_id = 0;
SET @fixture_client_id = 0;
SET @fixture_submission_id = 0;
SET @fixture_case_id = 0;
SET @fixture_application_id = 0;
SET @fixture_assessment_id = 0;
SET @fixture_review_workflow_id = 0;
SET @fixture_legacy_plan_id = 0;
SET @fixture_legacy_intervention_id = 0;
SET @fixture_action_plan_id = 0;
SET @fixture_intervention_id = 0;
SET @fixture_cfa_series_id = 0;
SET @fixture_legacy_cfa_version_id = 0;
SET @fixture_predecessor_message_id = 0;
SET @fixture_predecessor_signing_request_id = 0;

SET @fixture_guard =
  DATABASE() = 'iset_intake'
  AND CURRENT_USER() = 'app_admin@10.48.%'
  AND @@hostname = 'ip-172-16-0-199'
  AND @@foreign_key_checks = 1
  AND NOT EXISTS (
    SELECT u.id
      FROM `user` u
     WHERE u.email = 'feedback196.acceptance.20260825.r1@example.invalid'
        OR u.cognito_sub = 'feedback196-test-applicant-20260825-r1'
  )
  AND NOT EXISTS (
    SELECT cl.id
      FROM `client` cl
     WHERE cl.applicant_cognito_sub = 'feedback196-test-applicant-20260825-r1'
  )
  AND NOT EXISTS (
    SELECT submission.id
      FROM `iset_application_submission` submission
     WHERE submission.reference_number = 'FB196-20260825-R1'
  )
  AND NOT EXISTS (
    SELECT c.id
      FROM `iset_case` c
     WHERE c.case_number = 'FB196-ACCEPT-20260825-R1'
  )
  AND EXISTS (
    SELECT sp.id
      FROM `staff_profiles` sp
     WHERE sp.id = 61753
       AND sp.cognito_sub = '7c2da578-40d1-700b-555d-bc0ce3703064'
       AND sp.email = 'codex.workflow.rm.20260626T220130Z@awentech.ca'
       AND sp.primary_role = 'Regional Manager'
       AND sp.status = 'active'
  )
  AND EXISTS (
    SELECT dm.id
      FROM `staff_profiles` dm
     WHERE dm.id = 61754
       AND dm.cognito_sub = '8c8d9588-b071-701b-9da9-c677f5f7f43c'
       AND dm.email = 'codex.workflow.nwacadmin.20260626T220130Z@awentech.ca'
       AND dm.primary_role = 'NWAC Administrator'
       AND dm.status = 'active'
  )
  AND EXISTS (
    SELECT sender.id
      FROM `user` sender
     WHERE sender.id = 155
       AND sender.cognito_sub = '7c2da578-40d1-700b-555d-bc0ce3703064'
       AND sender.suspended = 0
       AND sender.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT approval.id
      FROM `workflow` approval
     WHERE approval.id = 46
       AND approval.name = 'Letter of Approval'
       AND approval.status = 'active'
       AND approval.workflow_type = 'consent-cm-prefill'
       AND approval.document_type = 'assessment_approval_letter'
  )
  AND EXISTS (
    SELECT funding.id
      FROM `workflow` funding
     WHERE funding.id = 45
       AND funding.name = 'Client Funding Agreement'
       AND funding.status = 'active'
       AND funding.workflow_type = 'consent-cm-prefill'
       AND funding.document_type = 'funding_agreement'
  )
  AND EXISTS (
    SELECT eft.id
      FROM `workflow` eft
     WHERE eft.id = 43
       AND eft.name = 'EFT & Wire Transfer Direct Debit'
       AND eft.status = 'draft'
       AND eft.workflow_type = 'consent-no-prefill'
       AND eft.document_type = 'EFT_form'
  )
  AND (
    SELECT COUNT(*)
      FROM `workflow` funding_candidate
     WHERE funding_candidate.workflow_type IN ('consent-no-prefill', 'consent-cm-prefill')
       AND funding_candidate.document_type = 'funding_agreement'
       AND funding_candidate.status = 'active'
  ) = 1
  AND (
    SELECT COUNT(*)
      FROM `workflow` eft_candidate
     WHERE eft_candidate.workflow_type IN ('consent-no-prefill', 'consent-cm-prefill')
       AND (
         LOWER(eft_candidate.document_type) = 'eft_form'
         OR (
           LOWER(eft_candidate.name) LIKE '%eft%'
           AND (
             LOWER(eft_candidate.name) LIKE '%wire%'
             OR LOWER(eft_candidate.name) LIKE '%debit%'
           )
         )
       )
  ) = 1;

INSERT INTO `user`
  (`name`, `email`, `cognito_sub`, `email_verified`, `suspended`, `preferred_language`)
SELECT
  'Feedback 196 TEST Applicant',
  'feedback196.acceptance.20260825.r1@example.invalid',
  'feedback196-test-applicant-20260825-r1',
  1,
  0,
  'en'
WHERE @fixture_guard = 1;
SET @fixture_user_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `client`
  (`last_name`, `first_name`, `address_json`, `applicant_cognito_sub`,
   `applicant_account_status`, `applicant_account_email`)
SELECT
  'Applicant',
  'Feedback 196 TEST',
  JSON_OBJECT(
    'city', 'TEST only',
    'province', 'BC',
    'fixture', 'feedback-196-acceptance-20260825-r1'
  ),
  'feedback196-test-applicant-20260825-r1',
  'created',
  'feedback196.acceptance.20260825.r1@example.invalid'
WHERE @fixture_guard = 1
  AND @fixture_user_id > 0;
SET @fixture_client_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_application_submission`
  (`user_id`, `workflow_id`, `reference_number`, `status`, `intake_payload`,
   `locale`, `user_agent`)
SELECT
  @fixture_user_id,
  'iset-v1',
  'FB196-20260825-R1',
  'ingested',
  JSON_OBJECT(
    'first-name', 'Feedback 196 TEST',
    'last-name', 'Applicant',
    'preferred-name', 'Feedback 196',
    'contact-email-address', 'feedback196.acceptance.20260825.r1@example.invalid',
    'fixture', 'feedback-196-acceptance-20260825-r1'
  ),
  'en',
  'Codex feedback-196 retained TEST acceptance fixture'
WHERE @fixture_guard = 1
  AND @fixture_user_id > 0
  AND @fixture_client_id > 0;
SET @fixture_submission_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_case`
  (`case_number`, `client_id`, `assigned_staff_profile_id`, `status`,
   `lifecycle_status`, `stage`, `priority`, `opened_at`, `case_context_json`,
   `created_by_staff_profile_id`, `updated_by_staff_profile_id`)
SELECT
  'FB196-ACCEPT-20260825-R1',
  @fixture_client_id,
  61753,
  'initiated',
  'initiated',
  'assessment',
  'normal',
  CURRENT_TIMESTAMP,
  JSON_OBJECT(
    'firstName', 'Feedback 196 TEST',
    'lastName', 'Applicant',
    'preferredName', 'Feedback 196',
    'applicantEmail', 'feedback196.acceptance.20260825.r1@example.invalid',
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'notifications', 'TEST-only example.invalid recipient'
  ),
  61753,
  61753
WHERE @fixture_guard = 1
  AND @fixture_client_id > 0;
SET @fixture_case_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_application`
  (`submission_id`, `client_id`, `case_id`, `payload_json`, `status`,
   `lifecycle_status`, `decision_outcome`, `version`, `row_version`)
SELECT
  @fixture_submission_id,
  @fixture_client_id,
  @fixture_case_id,
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'personal', JSON_OBJECT(
      'full_name', 'Feedback 196 TEST Applicant',
      'first_name', 'Feedback 196 TEST',
      'last_name', 'Applicant',
      'email', 'feedback196.acceptance.20260825.r1@example.invalid'
    ),
    'answers', JSON_OBJECT(
      'first-name', 'Feedback 196 TEST',
      'last-name', 'Applicant',
      'preferred-name', 'Feedback 196'
    )
  ),
  'approved',
  'decision_recorded',
  'approved',
  1,
  1
WHERE @fixture_guard = 1
  AND @fixture_submission_id > 0
  AND @fixture_client_id > 0
  AND @fixture_case_id > 0;
SET @fixture_application_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_application_assessment`
  (`application_id`, `case_id`, `date_of_assessment`, `overview`,
   `employment_goals`, `intervention_start_date`, `intervention_end_date`,
   `intervention_code`, `intervention_cost_total`, `recommendation`,
   `justification`, `nwac_review`, `proposed_interventions`)
SELECT
  @fixture_application_id,
  @fixture_case_id,
  '2026-08-25',
  'TEST-only retained acceptance fixture for feedback 196.',
  'Exercise the application-scoped CFA send path without affecting a real participant.',
  '2026-09-01',
  '2026-09-30',
  5,
  1250,
  'recommend',
  'Authorized disposable TEST acceptance data.',
  'agree',
  JSON_ARRAY(
    JSON_OBJECT(
      'id', 'feedback-196-funded-intervention-r1',
      'code', '5',
      'startDate', '2026-09-01',
      'endDate', '2026-09-30',
      'deliveryMode', 'partner',
      'costLines', JSON_ARRAY(
        JSON_OBJECT(
          'id', 'feedback-196-cost-line-r1',
          'type', 'TuitionFeesDirect',
          'amount', 1250,
          'notes', 'TEST-only feedback 196 acceptance cost',
          'payee', JSON_OBJECT(
            'type', 'AccreditedEducationalTrainingInstitution',
            'name', 'TEST Fixture Institution'
          )
        )
      )
    )
  )
WHERE @fixture_guard = 1
  AND @fixture_application_id > 0
  AND @fixture_case_id > 0;
SET @fixture_assessment_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_review_workflow`
  (`workflow_type`, `subject_key`, `case_id`, `application_id`, `current_stage`,
   `current_owner_role`, `submitted_by_staff_profile_id`, `submitted_at`,
   `rm_reviewed_by_staff_profile_id`, `rm_reviewed_at`, `nwac_decided_at`,
   `nwac_decided_by_staff_profile_id`, `nwac_decision`, `metadata_json`)
SELECT
  'application_assessment',
  CONCAT('application_assessment:application:', @fixture_application_id),
  @fixture_case_id,
  @fixture_application_id,
  'final_decision_recorded',
  NULL,
  61753,
  '2026-08-25 10:00:00',
  61753,
  '2026-08-25 11:00:00',
  '2026-08-25 12:00:00',
  61754,
  'approved',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'decisionActor', 'Dedicated Codex TEST Decision Maker profile 61754'
  )
WHERE @fixture_guard = 1
  AND @fixture_application_id > 0
  AND @fixture_case_id > 0
  AND @fixture_assessment_id > 0;
SET @fixture_review_workflow_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_case_action_plan`
  (`case_id`, `application_id`, `name`, `status`, `agreement_number`,
   `funding_stream`, `owner_staff_profile_id`, `effective_date`, `metadata_json`)
SELECT
  @fixture_case_id,
  NULL,
  'Feedback 196 historical applicationless TEST plan',
  'draft',
  'FB196-LEGACY-R1',
  'CRF',
  61753,
  '2026-08-01',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'lineage', 'historical_applicationless'
  )
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_review_workflow_id > 0;
SET @fixture_legacy_plan_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_case_intervention`
  (`case_id`, `action_plan_id`, `intervention_code`, `status`, `delivery_status`,
   `start_date`, `end_date`, `intervention_cost`, `budget_amount`,
   `approved_amount`, `notes`, `metadata_json`, `created_by_staff_profile_id`,
   `reviewed_by_staff_profile_id`, `reviewed_at`, `funding_stream_decision`)
SELECT
  @fixture_case_id,
  @fixture_legacy_plan_id,
  5,
  'approved',
  'planned',
  '2026-08-01',
  '2026-08-15',
  900.00,
  900.00,
  900.00,
  'TEST-only historical applicationless CFA source.',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'title', 'Historical applicationless TEST intervention',
    'costLines', JSON_ARRAY(
      JSON_OBJECT(
        'id', 'feedback-196-legacy-cost-r1',
        'type', 'TuitionFeesDirect',
        'amount', 900,
        'notes', 'Historical TEST-only cost'
      )
    )
  ),
  61753,
  61753,
  '2026-08-01 12:00:00',
  'CRF'
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_legacy_plan_id > 0;
SET @fixture_legacy_intervention_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_case_action_plan`
  (`case_id`, `application_id`, `name`, `status`, `agreement_number`,
   `funding_stream`, `owner_staff_profile_id`, `effective_date`, `activated_at`,
   `metadata_json`)
SELECT
  @fixture_case_id,
  @fixture_application_id,
  'Feedback 196 exact application-owned TEST plan',
  'active',
  'FB196-EXACT-R1',
  'CRF',
  61753,
  '2026-09-01',
  '2026-08-25 12:00:00',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'lineage', 'exact_application_owner'
  )
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_application_id > 0
  AND @fixture_legacy_intervention_id > 0;
SET @fixture_action_plan_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `iset_case_intervention`
  (`case_id`, `action_plan_id`, `intervention_code`, `status`, `delivery_status`,
   `start_date`, `end_date`, `intervention_cost`, `budget_amount`,
   `approved_amount`, `notes`, `metadata_json`, `created_by_staff_profile_id`,
   `reviewed_by_staff_profile_id`, `reviewed_at`, `funding_stream_decision`)
SELECT
  @fixture_case_id,
  @fixture_action_plan_id,
  5,
  'approved',
  'planned',
  '2026-09-01',
  '2026-09-30',
  1250.00,
  1250.00,
  1250.00,
  'TEST-only exact application-owned funded intervention.',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'title', 'Feedback 196 exact application-owned TEST intervention',
    'deliveryMode', 'partner',
    'costLines', JSON_ARRAY(
      JSON_OBJECT(
        'id', 'feedback-196-exact-cost-r1',
        'type', 'TuitionFeesDirect',
        'amount', 1250,
        'notes', 'TEST-only feedback 196 acceptance cost',
        'payee', JSON_OBJECT(
          'type', 'AccreditedEducationalTrainingInstitution',
          'name', 'TEST Fixture Institution'
        )
      )
    )
  ),
  61753,
  61753,
  '2026-08-25 12:00:00',
  'CRF'
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_application_id > 0
  AND @fixture_action_plan_id > 0;
SET @fixture_intervention_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `cfa_series`
  (`case_id`, `template_key`, `created_by_staff_profile_id`)
SELECT
  @fixture_case_id,
  'ISET_CFA_STANDARD',
  61753
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_intervention_id > 0;
SET @fixture_cfa_series_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `cfa_version`
  (`series_id`, `application_id`, `action_plan_id`, `version_number`, `status`,
   `supersedes_version_id`, `change_reason`, `change_summary`,
   `created_by_staff_profile_id`, `sent_at`, `sent_by_staff_profile_id`,
   `effective_date`, `snapshot_schema_version`, `snapshot_hash`,
   `rendered_template_version`, `metadata_json`)
SELECT
  @fixture_cfa_series_id,
  NULL,
  NULL,
  1,
  'sent',
  NULL,
  'NEW_INTERVENTION_APPROVED',
  'TEST historical applicationless funding agreement',
  61753,
  '2026-08-25 12:00:00',
  61753,
  '2026-08-01',
  '1',
  NULL,
  '1',
  JSON_OBJECT(
    'fixture', 'feedback-196-acceptance-20260825-r1',
    'syntheticHistoricalPredecessor', 1,
    'case', JSON_OBJECT(
      'id', @fixture_case_id,
      'clientId', @fixture_client_id,
      'caseNumber', 'FB196-ACCEPT-20260825-R1',
      'trackingId', 'FB196-20260825-R1',
      'applicantUserId', @fixture_user_id,
      'caseManagerName', 'Codex Workflow Regional Manager',
      'assignedStaffProfileId', 61753
    ),
    'plan', JSON_OBJECT(
      'id', @fixture_legacy_plan_id,
      'name', 'Feedback 196 historical applicationless TEST plan',
      'effectiveDate', '2026-08-01',
      'fundingStream', 'CRF',
      'agreementNumber', 'FB196-LEGACY-R1'
    ),
    'client', JSON_OBJECT(
      'name', 'Feedback 196 TEST Applicant'
    ),
    'interventions', JSON_ARRAY(
      JSON_OBJECT(
        'id', @fixture_legacy_intervention_id,
        'code', '5',
        'label', 'Historical applicationless TEST intervention',
        'startDate', '2026-08-01',
        'endDate', '2026-08-15',
        'fundingStream', 'CRF',
        'costLines', JSON_ARRAY(
          JSON_OBJECT(
            'id', 'feedback-196-legacy-cost-r1',
            'type', 'TuitionFeesDirect',
            'amount', 900,
            'notes', 'Historical TEST-only cost'
          )
        ),
        'costTotal', 900
      )
    ),
    'totalsByFundingStream', JSON_OBJECT('CRF', 900)
  )
WHERE @fixture_guard = 1
  AND @fixture_cfa_series_id > 0
  AND @fixture_legacy_plan_id > 0
  AND @fixture_legacy_intervention_id > 0;
SET @fixture_legacy_cfa_version_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `messages`
  (`sender_actor_type`, `sender_user_id`, `sender_staff_profile_id`,
   `recipient_actor_type`, `recipient_user_id`, `recipient_staff_profile_id`,
   `case_id`, `application_id`, `subject`, `body`, `status`, `created_at`,
   `deleted`, `urgent`)
SELECT
  'staff_profile',
  155,
  61753,
  'applicant_user',
  @fixture_user_id,
  NULL,
  @fixture_case_id,
  NULL,
  'TEST predecessor applicationless CFA signing request',
  'Synthetic TEST-only predecessor retained to prove cancellation isolation.',
  'unread',
  '2026-08-25 12:00:00',
  0,
  0
WHERE @fixture_guard = 1
  AND @fixture_user_id > 0
  AND @fixture_case_id > 0
  AND @fixture_legacy_cfa_version_id > 0;
SET @fixture_predecessor_message_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `message_item`
  (`message_id`, `owner_user_id`, `folder`, `read_at`)
SELECT
  @fixture_predecessor_message_id,
  155,
  'sent',
  '2026-08-25 12:00:00'
WHERE @fixture_guard = 1
  AND @fixture_predecessor_message_id > 0;

INSERT INTO `message_item`
  (`message_id`, `owner_user_id`, `folder`, `read_at`)
SELECT
  @fixture_predecessor_message_id,
  @fixture_user_id,
  'inbox',
  NULL
WHERE @fixture_guard = 1
  AND @fixture_predecessor_message_id > 0
  AND @fixture_user_id > 0;

INSERT INTO `signing_request`
  (`workflow_id`, `workflow_name`, `workflow_type`, `case_id`,
   `participant_user_id`, `created_by_user_id`, `status`, `resolved_schema_json`,
   `created_at`, `updated_at`)
SELECT
  45,
  'Client Funding Agreement',
  'consent-cm-prefill',
  @fixture_case_id,
  @fixture_user_id,
  155,
  'pending',
  JSON_OBJECT(
    'meta', JSON_OBJECT(
      'fixture', 'feedback-196-acceptance-20260825-r1',
      'documentType', 'funding_agreement',
      'cfaVersionId', @fixture_legacy_cfa_version_id,
      'cfaVersionNumber', 1,
      'cfaSeriesId', @fixture_cfa_series_id,
      'cfaActionPlanId', @fixture_legacy_plan_id
    ),
    'steps', JSON_ARRAY()
  ),
  '2026-08-25 12:00:00',
  '2026-08-25 12:00:00'
WHERE @fixture_guard = 1
  AND @fixture_case_id > 0
  AND @fixture_user_id > 0
  AND @fixture_legacy_cfa_version_id > 0
  AND @fixture_predecessor_message_id > 0;
SET @fixture_predecessor_signing_request_id = LAST_INSERT_ID() * ROW_COUNT();

INSERT INTO `message_signing_request`
  (`message_id`, `signing_request_id`)
SELECT
  @fixture_predecessor_message_id,
  @fixture_predecessor_signing_request_id
WHERE @fixture_guard = 1
  AND @fixture_predecessor_message_id > 0
  AND @fixture_predecessor_signing_request_id > 0;

-- The predecessor intentionally has no fabricated S3 document.  Its coherent
-- message and pending signing-request chain is sufficient to prove that the
-- exact-current send neither withdraws its CFA nor cancels its request.

COMMIT;

-- COMMIT completed before these identifiers are emitted.  Separate guarded
-- post-commit reads verify every retained relationship and value.
SELECT
  @fixture_guard,
  @fixture_user_id,
  @fixture_client_id,
  @fixture_submission_id,
  @fixture_case_id,
  @fixture_application_id,
  @fixture_assessment_id,
  @fixture_review_workflow_id,
  @fixture_legacy_plan_id,
  @fixture_legacy_intervention_id,
  @fixture_action_plan_id,
  @fixture_intervention_id,
  @fixture_cfa_series_id,
  @fixture_legacy_cfa_version_id,
  @fixture_predecessor_message_id,
  @fixture_predecessor_signing_request_id;
