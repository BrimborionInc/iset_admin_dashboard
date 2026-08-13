-- PROD read-only evidence for feedback submitted by emarion@nwac.ca on 2026-08-12.
-- Target identity and live DDL must be re-proven before execution.
-- This artifact contains no mutation statements.

SELECT
  id,
  report_type,
  severity,
  status,
  summary,
  description,
  submitted_by_staff_profile_id,
  submitted_by_name,
  submitted_by_email,
  submitted_by_role,
  page_title,
  page_path,
  page_url,
  submitted_at,
  updated_at
FROM admin_feedback_report
WHERE submitted_by_email = 'emarion@nwac.ca'
  AND submitted_at >= '2026-08-12 00:00:00'
  AND submitted_at < '2026-08-13 00:00:00'
ORDER BY submitted_at;

-- The report's deployed route is /application-case/187; that route declares
-- its parameter as iset_case.id and loads GET /api/cases/:id.
SELECT
  id,
  case_number,
  client_id,
  assigned_staff_profile_id,
  status,
  lifecycle_status,
  closure_reason,
  stage,
  sub_stage,
  opened_at,
  closed_at,
  created_at,
  updated_at
FROM iset_case
WHERE id = 187;

SELECT
  id,
  name,
  display_name,
  email,
  primary_role,
  status,
  region_id
FROM staff_profiles
WHERE id = 55;

SELECT
  id,
  first_name,
  last_name,
  created_at,
  updated_at
FROM client
WHERE id = 265;

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
  version,
  row_version,
  has_open_escalation,
  current_escalation_id,
  docs_requested_active,
  created_at,
  updated_at
FROM iset_application
WHERE case_id = 187
ORDER BY id;

SELECT
  id,
  reference_number,
  status,
  submitted_at,
  created_at,
  updated_at
FROM iset_application_submission
WHERE id IN (120, 163)
ORDER BY id;

SELECT
  id,
  application_id,
  case_id,
  date_of_assessment IS NULL,
  overview IS NULL,
  employment_goals IS NULL,
  previous_iset IS NULL,
  employment_barriers IS NULL,
  local_area_priorities IS NULL,
  other_funding_details IS NULL,
  esdc_eligibility,
  proposed_interventions IS NULL,
  recommendation,
  justification IS NULL,
  nwac_review,
  nwac_reason IS NULL,
  created_at,
  updated_at
FROM iset_application_assessment
WHERE application_id IN (120, 163)
ORDER BY application_id;

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
  nwac_decided_by_staff_profile_id,
  nwac_decided_at,
  nwac_decision,
  archived_at,
  created_at,
  updated_at
FROM iset_review_workflow
WHERE case_id = 187
ORDER BY id;

SELECT
  id,
  case_id,
  staff_profile_id,
  declaration_choice,
  signed_at,
  revoked_at,
  resolution_outcome,
  resolved_at,
  is_active
FROM iset_case_conflict_declaration
WHERE case_id = 187
ORDER BY id;

SELECT
  application_id,
  owner_user_id,
  owner_display_name,
  owner_email,
  acquired_at,
  expires_at
FROM application_lock
WHERE application_id IN (120, 163)
ORDER BY application_id;

SELECT
  id,
  case_id,
  event_type,
  summary,
  payload_json,
  occurred_at,
  actor_staff_profile_id,
  actor_user_id,
  source_system
FROM iset_case_event
WHERE case_id = 187
  AND event_type = 'status_changed'
ORDER BY occurred_at DESC
LIMIT 3;
