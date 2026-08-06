-- Read-only current-state investigation for feedback 178.
-- Target: PROD / iset_intake / case 138 / application 61.
-- Every identifier below was rechecked against live PROD SHOW CREATE TABLE
-- output on 2026-08-06 before this artifact was executed.

SELECT
  id,
  submission_id,
  client_id,
  case_id,
  status,
  lifecycle_status,
  decision_outcome,
  awaiting_reason,
  closure_reason,
  row_version,
  created_at,
  updated_at
FROM iset_application
WHERE id = 61;

SELECT
  id,
  case_id,
  status,
  lifecycle_status,
  decision_outcome,
  awaiting_reason,
  closure_reason,
  row_version,
  created_at,
  updated_at
FROM iset_application
WHERE case_id = 138
ORDER BY updated_at DESC, created_at DESC, id DESC;

SELECT
  id,
  case_number,
  client_id,
  assigned_staff_profile_id,
  status,
  lifecycle_status,
  stage,
  sub_stage,
  portfolio_region_id,
  open_intervention_count,
  total_intervention_count,
  created_at,
  updated_at
FROM iset_case
WHERE id = 138;

SELECT
  id,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".assessment_nwac_review_status'
  )) AS scoped_decision_status,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".decisionLetterSent.approval'
  )) AS scoped_approval_letter_sent_at,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".decisionLetterSentAt'
  )) AS scoped_any_letter_sent_at,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.applicationDecisionLetters."61".fundingDecisionReasonCode'
  )) AS scoped_funding_decision_reason_code,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.assessment_nwac_review_status'
  )) AS legacy_decision_status,
  JSON_UNQUOTE(JSON_EXTRACT(
    case_context_json,
    '$.decisionLetterSent.approval'
  )) AS legacy_approval_letter_sent_at
FROM iset_case
WHERE id = 138;

SELECT
  id,
  application_id,
  case_id,
  recommendation,
  nwac_review,
  nwac_reason,
  created_at,
  updated_at
FROM iset_application_assessment
WHERE application_id = 61;

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
  created_at,
  updated_at
FROM iset_review_workflow
WHERE application_id = 61
ORDER BY id;

SELECT
  e.id,
  e.review_workflow_id,
  e.workflow_type,
  e.subject_key,
  e.action,
  e.from_stage,
  e.to_stage,
  e.actor_staff_profile_id,
  e.actor_role,
  e.note,
  e.payload_json,
  e.created_at,
  sp.email AS actor_email,
  sp.display_name AS actor_display_name,
  sp.primary_role AS actor_primary_role
FROM iset_review_workflow_event e
JOIN iset_review_workflow rw
  ON rw.id = e.review_workflow_id
LEFT JOIN staff_profiles sp
  ON sp.id = e.actor_staff_profile_id
WHERE rw.application_id = 61
ORDER BY e.id;

SELECT
  sp.id,
  sp.email,
  sp.name,
  sp.display_name,
  sp.primary_role,
  sp.status,
  sp.region_id,
  sp.last_login_at,
  sr.region_id AS additional_region_id,
  cr.code AS additional_region_code,
  cr.name_en AS additional_region_name
FROM staff_profiles sp
LEFT JOIN staff_region sr
  ON sr.staff_profile_id = sp.id
LEFT JOIN canada_region cr
  ON cr.region_id = sr.region_id
WHERE sp.email IN (
  'dburdett@iaaw.ca',
  'derry@nwac.ca',
  'mcoppola@nwac.ca'
)
ORDER BY sp.email, sr.region_id;

SELECT
  id,
  scope,
  k,
  v,
  updated_at
FROM iset_runtime_config
WHERE scope = 'feature_flags'
  AND k = 'workflow.two_step_rm_review.enabled';

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  owner_email,
  acquired_at,
  expires_at,
  metadata
FROM application_lock
WHERE application_id = 61;

SELECT
  id,
  status,
  severity,
  summary,
  submitted_by_email,
  submitted_by_role,
  page_path,
  submitted_at,
  updated_at
FROM admin_feedback_report
WHERE id = 178;

SELECT
  id,
  report_id,
  previous_status,
  new_status,
  changed_by_name,
  changed_by_email,
  changed_at
FROM admin_feedback_status_history
WHERE report_id = 178
ORDER BY id;

SELECT
  id,
  report_id,
  author_name,
  author_email,
  note_text,
  created_at
FROM admin_feedback_note
WHERE report_id = 178
ORDER BY id;
