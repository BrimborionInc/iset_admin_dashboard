-- Read-only dependency inventory after the unintended second approval of
-- feedback 178 / case 138 / application 61.
-- Every identifier and relationship below was rechecked against live PROD
-- SHOW CREATE TABLE output on 2026-08-06 before execution.

SELECT
  id,
  case_id,
  application_id,
  name,
  status,
  effective_date,
  review_date,
  activated_at,
  closed_at,
  archived_at,
  created_at,
  updated_at
FROM iset_case_action_plan
WHERE application_id = 61
ORDER BY id;

SELECT
  ci.id,
  ci.case_id,
  ci.action_plan_id,
  ci.intervention_code,
  ci.status,
  ci.delivery_status,
  ci.start_date,
  ci.end_date,
  ci.intervention_cost,
  ci.budget_amount,
  ci.approved_amount,
  ci.actual_amount,
  ci.closed_at,
  ci.created_at,
  ci.updated_at
FROM iset_case_intervention ci
JOIN iset_case_action_plan ap
  ON ap.id = ci.action_plan_id
WHERE ap.application_id = 61
ORDER BY ci.id;

SELECT
  cs.id AS cfa_series_id,
  cs.case_id,
  cs.template_key,
  cv.id AS cfa_version_id,
  cv.version_number,
  cv.status AS cfa_version_status,
  cv.supersedes_version_id,
  cv.change_reason,
  cv.change_summary,
  cv.sent_at,
  cv.signed_at,
  cv.created_at AS cfa_version_created_at,
  cvd.id AS cfa_version_document_id,
  cvd.document_type,
  cvd.document_id,
  d.application_id AS document_application_id,
  d.action_plan_id AS document_action_plan_id,
  d.signing_request_id,
  d.source AS document_source,
  d.document_category,
  d.visibility,
  d.status AS document_status,
  d.created_at AS document_created_at,
  d.updated_at AS document_updated_at
FROM iset_case_action_plan ap
JOIN iset_document d
  ON d.action_plan_id = ap.id
JOIN cfa_version_documents cvd
  ON cvd.document_id = d.id
JOIN cfa_version cv
  ON cv.id = cvd.cfa_version_id
JOIN cfa_series cs
  ON cs.id = cv.series_id
WHERE ap.application_id = 61
ORDER BY cv.id, cvd.id;

SELECT
  id,
  case_id,
  client_id,
  application_id,
  action_plan_id,
  signing_request_id,
  source,
  document_category,
  visibility,
  status,
  created_at,
  updated_at
FROM iset_document
WHERE application_id = 61
ORDER BY id;

SELECT
  id,
  case_id,
  status,
  signed_at,
  checklist_doc_type,
  created_at,
  updated_at
FROM signing_request
WHERE case_id = 138
  AND checklist_doc_type = 'funding_agreement'
ORDER BY id;

SELECT
  eps.id,
  eps.case_id,
  eps.action_plan_id,
  eps.application_id,
  eps.readiness_status,
  eps.submission_status,
  eps.submitted_at,
  eps.submitted_by_user_id,
  eps.payload_storage_key,
  eps.payload_checksum,
  eps.rejection_reason,
  eps.created_at,
  eps.updated_at
FROM esdc_participant_submission eps
JOIN iset_case_action_plan ap
  ON ap.id = eps.action_plan_id
WHERE ap.application_id = 61
ORDER BY eps.id;

SELECT
  ip.id,
  ip.case_id,
  ip.action_plan_id,
  ip.application_id,
  ip.legacy_intervention_id,
  ip.source_intervention_id,
  ip.proposal_kind,
  ip.review_status,
  ip.submitted_at,
  ip.reviewed_at,
  ip.archived_at,
  ip.created_at,
  ip.updated_at
FROM iset_intervention_proposal ip
JOIN iset_case_action_plan ap
  ON ap.id = ip.action_plan_id
WHERE ap.application_id = 61
ORDER BY ip.id;

SELECT
  di.document_id,
  di.intervention_id,
  di.created_at
FROM iset_document_intervention di
JOIN iset_case_intervention ci
  ON ci.id = di.intervention_id
JOIN iset_case_action_plan ap
  ON ap.id = ci.action_plan_id
WHERE ap.application_id = 61
ORDER BY di.intervention_id, di.document_id;

SELECT
  pp.id,
  pp.case_id,
  pp.client_id,
  pp.intervention_id,
  pp.status,
  pp.follow_up_status,
  pp.submitted_at,
  pp.sent_at,
  pp.confirmed_at,
  pp.created_at,
  pp.updated_at
FROM payment_packet pp
JOIN iset_case_intervention ci
  ON ci.id = pp.intervention_id
JOIN iset_case_action_plan ap
  ON ap.id = ci.action_plan_id
WHERE ap.application_id = 61
ORDER BY pp.id;

SELECT
  ppl.id,
  ppl.payment_packet_id,
  ppl.intervention_id,
  ppl.amount,
  ppl.status,
  ppl.paid_at,
  ppl.payment_reference,
  ppl.created_at,
  ppl.updated_at
FROM payment_packet_line ppl
JOIN iset_case_intervention ci
  ON ci.id = ppl.intervention_id
JOIN iset_case_action_plan ap
  ON ap.id = ci.action_plan_id
WHERE ap.application_id = 61
ORDER BY ppl.id;

SELECT
  ft.id,
  ft.case_id,
  ft.case_intervention_id,
  ft.amount,
  ft.status,
  ft.transaction_date,
  ft.posted_at,
  ft.created_at,
  ft.updated_at
FROM finance_transaction ft
JOIN iset_case_intervention ci
  ON ci.id = ft.case_intervention_id
JOIN iset_case_action_plan ap
  ON ap.id = ci.action_plan_id
WHERE ap.application_id = 61
ORDER BY ft.id;
