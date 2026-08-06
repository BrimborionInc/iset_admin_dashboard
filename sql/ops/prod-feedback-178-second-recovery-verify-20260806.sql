-- Independent read-only verification for feedback 178 second recovery.

SELECT DATABASE() AS database_name,
       @@hostname AS database_host,
       @@port AS database_port;

SELECT
  id,
  client_id,
  case_id,
  status,
  lifecycle_status,
  decision_outcome,
  awaiting_reason,
  closure_reason,
  row_version,
  updated_at
FROM iset_application
WHERE id = 61;

SELECT
  id,
  client_id,
  assigned_staff_profile_id,
  portfolio_region_id,
  status,
  lifecycle_status,
  open_intervention_count,
  total_intervention_count,
  JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".assessment_nwac_review_status'
  ) AS scoped_decision_status,
  JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".decisionLetterDrafts'
  ) AS scoped_decision_letter_drafts,
  JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".decisionLetterSent'
  ) AS scoped_decision_letter_sent,
  JSON_EXTRACT(
    case_context_json,
    '$.assessment_nwac_review_status'
  ) AS legacy_decision_status,
  updated_at
FROM iset_case
WHERE id = 138;

SELECT
  id,
  workflow_type,
  subject_key,
  case_id,
  application_id,
  current_stage,
  current_owner_role,
  current_owner_staff_profile_id,
  submitted_by_staff_profile_id,
  submitted_at,
  rm_reviewed_by_staff_profile_id,
  rm_reviewed_at,
  rm_review_note,
  nwac_decided_by_staff_profile_id,
  nwac_decided_at,
  nwac_decision,
  nwac_decision_note,
  metadata_json,
  archived_at,
  updated_at
FROM iset_review_workflow
WHERE id = 17;

SELECT
  id,
  review_workflow_id,
  action,
  from_stage,
  to_stage,
  actor_staff_profile_id,
  actor_role,
  note,
  payload_json,
  created_at
FROM iset_review_workflow_event
WHERE review_workflow_id = 17
ORDER BY id;

SELECT
  id,
  case_id,
  application_id,
  status,
  archived_at,
  updated_at
FROM iset_case_action_plan
WHERE id IN (166, 169)
ORDER BY id;

SELECT
  id,
  case_id,
  action_plan_id,
  status,
  delivery_status,
  actual_amount,
  closed_at,
  updated_at
FROM iset_case_intervention
WHERE id IN (351, 352, 353, 360, 361, 362)
ORDER BY id;

SELECT
  id,
  series_id,
  version_number,
  status,
  sent_at,
  signed_at
FROM cfa_version
WHERE id IN (37, 40)
ORDER BY id;

SELECT
  id,
  case_id,
  client_id,
  application_id,
  action_plan_id,
  signing_request_id,
  source,
  document_category,
  status,
  updated_at
FROM iset_document
WHERE id IN (9195, 9196, 9527, 9528, 9529)
ORDER BY id;

SELECT
  id,
  case_id,
  action_plan_id,
  application_id,
  readiness_status,
  submission_status
FROM esdc_participant_submission
WHERE id = 439;

SELECT
  id,
  case_id,
  event_type,
  summary,
  actor_staff_profile_id,
  actor_user_id,
  source_system,
  created_at
FROM iset_case_event
WHERE case_id = 138
  AND event_type = 'assessment_returned_for_correction_recovery'
ORDER BY id;

SELECT
  id,
  case_id,
  author_staff_profile_id,
  author_user_id,
  body,
  is_internal,
  is_pinned,
  created_at
FROM iset_case_note
WHERE case_id = 138
  AND body LIKE 'SYSTEM_ADMIN_SECOND_RECOVERY_20260806_FEEDBACK_178:%';

SELECT
  id,
  status,
  severity,
  summary,
  updated_at
FROM admin_feedback_report
WHERE id = 178;

SELECT
  id,
  report_id,
  author_staff_profile_id,
  author_name,
  author_email,
  note_text,
  created_at
FROM admin_feedback_note
WHERE report_id = 178
ORDER BY id;

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  acquired_at,
  expires_at,
  metadata
FROM application_lock
WHERE application_id = 61;
