-- Read-only PROD downstream inventory for Jennifer Johnson and Veronica Basque.
-- Live target identity and live DDL for every referenced table/column were
-- proved in this task before execution.

SELECT
  iset_case_action_plan.id,
  iset_case_action_plan.case_id,
  iset_case_action_plan.application_id,
  iset_case_action_plan.name,
  iset_case_action_plan.status,
  iset_case_action_plan.version,
  iset_case_action_plan.archived_at,
  iset_case_action_plan.created_at,
  iset_case_action_plan.updated_at
FROM iset_case_action_plan
WHERE iset_case_action_plan.case_id IN (258, 269)
   OR iset_case_action_plan.application_id IN (199, 208)
ORDER BY iset_case_action_plan.case_id, iset_case_action_plan.id;

SELECT
  iset_case_intervention.id,
  iset_case_intervention.case_id,
  iset_case_intervention.action_plan_id,
  iset_case_intervention.intervention_code,
  iset_case_intervention.status,
  iset_case_intervention.delivery_status,
  iset_case_intervention.intervention_cost,
  iset_case_intervention.approved_amount,
  iset_case_intervention.created_at,
  iset_case_intervention.updated_at,
  iset_case_intervention.closed_at
FROM iset_case_intervention
WHERE iset_case_intervention.case_id IN (258, 269)
ORDER BY iset_case_intervention.case_id, iset_case_intervention.id;

SELECT
  funding_overview_series.id,
  funding_overview_series.case_id,
  funding_overview_series.template_key,
  funding_overview_series.created_by_staff_profile_id,
  funding_overview_series.created_at
FROM funding_overview_series
WHERE funding_overview_series.case_id IN (258, 269)
ORDER BY funding_overview_series.case_id, funding_overview_series.id;

SELECT
  funding_overview_version.id,
  funding_overview_version.series_id,
  funding_overview_version.application_id,
  funding_overview_version.version_number,
  funding_overview_version.status,
  funding_overview_version.supersedes_version_id,
  funding_overview_version.change_reason,
  funding_overview_version.created_at,
  funding_overview_version.created_by_staff_profile_id,
  funding_overview_version.sent_at,
  funding_overview_version.sent_by_staff_profile_id,
  funding_overview_version.signed_at,
  funding_overview_version.signed_by_participant_id,
  funding_overview_version.effective_date
FROM funding_overview_version
WHERE funding_overview_version.application_id IN (199, 208)
ORDER BY funding_overview_version.application_id,
         funding_overview_version.version_number,
         funding_overview_version.id;

SELECT
  funding_overview_version_documents.id,
  funding_overview_version_documents.funding_overview_version_id,
  funding_overview_version_documents.document_type,
  funding_overview_version_documents.document_id,
  funding_overview_version_documents.created_at
FROM funding_overview_version_documents
WHERE funding_overview_version_documents.document_id IN (13614, 13625)
ORDER BY funding_overview_version_documents.funding_overview_version_id,
         funding_overview_version_documents.id;

SELECT
  cfa_series.id,
  cfa_series.case_id,
  cfa_series.template_key,
  cfa_series.created_by_staff_profile_id,
  cfa_series.created_at
FROM cfa_series
WHERE cfa_series.case_id IN (258, 269)
ORDER BY cfa_series.case_id, cfa_series.id;

SELECT
  cfa_version.id,
  cfa_version.series_id,
  cfa_version.application_id,
  cfa_version.action_plan_id,
  cfa_version.version_number,
  cfa_version.status,
  cfa_version.supersedes_version_id,
  cfa_version.created_at,
  cfa_version.sent_at,
  cfa_version.signed_at,
  cfa_version.effective_date
FROM cfa_version
WHERE cfa_version.application_id IN (199, 208)
ORDER BY cfa_version.application_id, cfa_version.version_number, cfa_version.id;

SELECT
  esdc_participant_submission.id,
  esdc_participant_submission.case_id,
  esdc_participant_submission.action_plan_id,
  esdc_participant_submission.application_id,
  esdc_participant_submission.readiness_status,
  esdc_participant_submission.submission_status,
  esdc_participant_submission.submitted_at,
  esdc_participant_submission.created_at,
  esdc_participant_submission.updated_at
FROM esdc_participant_submission
WHERE esdc_participant_submission.case_id IN (258, 269)
   OR esdc_participant_submission.application_id IN (199, 208)
ORDER BY esdc_participant_submission.case_id,
         esdc_participant_submission.application_id,
         esdc_participant_submission.id;

SELECT
  signing_request.id,
  signing_request.case_id,
  signing_request.participant_user_id,
  signing_request.created_by_user_id,
  signing_request.status,
  signing_request.signed_at,
  signing_request.due_at,
  signing_request.checklist_doc_type,
  signing_request.created_at,
  signing_request.updated_at
FROM signing_request
WHERE signing_request.case_id IN (258, 269)
ORDER BY signing_request.case_id, signing_request.created_at, signing_request.id;
