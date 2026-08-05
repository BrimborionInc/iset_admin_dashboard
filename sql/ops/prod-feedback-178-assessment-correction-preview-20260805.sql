-- Read-only PROD inventory for feedback #178.
-- Scope: case 138, application 61, assessment 207, review workflow 17,
-- generated action plan 166, generated interventions 351-353, and CFA version 37.
-- Deliberately omits application/case payloads and document contents containing PII.

SELECT DATABASE() AS database_name,
       @@hostname AS database_host,
       @@port AS database_port;

SELECT id,
       submission_id,
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

SELECT id,
       client_id,
       assigned_staff_profile_id,
       portfolio_region_id,
       status,
       lifecycle_status,
       open_intervention_count,
       total_intervention_count,
       JSON_UNQUOTE(JSON_EXTRACT(
         case_context_json,
         '$.applicationDecisionLetters."61".assessment_nwac_review_status'
       )) AS scoped_decision_status,
       JSON_UNQUOTE(JSON_EXTRACT(
         case_context_json,
         '$.assessment_nwac_review_status'
       )) AS legacy_decision_status,
       updated_at
  FROM iset_case
 WHERE id = 138;

SELECT id,
       application_id,
       case_id,
       intervention_budget_pot_id,
       posting_context,
       intervention_cost_total,
       recommendation,
       nwac_review,
       created_at,
       updated_at
  FROM iset_application_assessment
 WHERE id = 207;

SELECT id,
       workflow_type,
       subject_key,
       case_id,
       application_id,
       action_plan_id,
       intervention_id,
       proposal_id,
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
       archived_at,
       created_at,
       updated_at
  FROM iset_review_workflow
 WHERE id = 17;

SELECT id,
       review_workflow_id,
       workflow_type,
       subject_key,
       action,
       from_stage,
       to_stage,
       actor_staff_profile_id,
       actor_role,
       note,
       created_at
  FROM iset_review_workflow_event
 WHERE review_workflow_id = 17
 ORDER BY id;

SELECT id,
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
 WHERE id = 166;

SELECT id,
       case_id,
       application_id,
       status,
       archived_at,
       created_at,
       updated_at
  FROM iset_case_action_plan
 WHERE application_id = 61
 ORDER BY id;

SELECT id,
       case_id,
       action_plan_id,
       intervention_code,
       status,
       delivery_status,
       start_date,
       end_date,
       intervention_cost,
       budget_amount,
       approved_amount,
       actual_amount,
       closed_at,
       created_at,
       updated_at
  FROM iset_case_intervention
 WHERE id IN (351, 352, 353)
 ORDER BY id;

SELECT id,
       case_id,
       action_plan_id,
       status,
       delivery_status,
       actual_amount,
       created_at,
       updated_at
  FROM iset_case_intervention
 WHERE action_plan_id = 166
 ORDER BY id;

SELECT id,
       case_id,
       template_key,
       created_by_staff_profile_id,
       created_at
  FROM cfa_series
 WHERE id = 41;

SELECT id,
       series_id,
       version_number,
       status,
       supersedes_version_id,
       change_reason,
       change_summary,
       created_by_staff_profile_id,
       sent_at,
       sent_by_staff_profile_id,
       signed_at,
       signed_by_participant_id,
       effective_date,
       JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.plan.id')) AS snapshot_plan_id,
       created_at
  FROM cfa_version
 WHERE id = 37;

SELECT id,
       series_id,
       version_number,
       status,
       sent_at,
       signed_at,
       created_at
  FROM cfa_version
 WHERE series_id = 41
 ORDER BY id;

SELECT cvd.id,
       cvd.cfa_version_id,
       cvd.document_type,
       cvd.document_id,
       d.case_id,
       d.client_id,
       d.application_id,
       d.action_plan_id,
       d.signing_request_id,
       d.source,
       d.document_category,
       d.visibility,
       d.status,
       d.created_at,
       d.updated_at
  FROM cfa_version_documents AS cvd
  JOIN iset_document AS d
    ON d.id = cvd.document_id
 WHERE cvd.cfa_version_id = 37
 ORDER BY cvd.id;

SELECT id,
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
 WHERE action_plan_id = 166
 ORDER BY id;

SELECT id,
       case_id,
       status,
       signed_at,
       checklist_doc_type,
       created_at,
       updated_at
  FROM signing_request
 WHERE case_id = 138
   AND checklist_doc_type = 'funding_agreement'
   AND JSON_UNQUOTE(JSON_EXTRACT(
         resolved_schema_json,
         '$.meta.cfaVersionId'
       )) = '37'
 ORDER BY id;

SELECT id,
       case_id,
       action_plan_id,
       application_id,
       readiness_status,
       submission_status,
       submitted_at,
       submitted_by_user_id,
       payload_storage_key,
       payload_checksum,
       rejection_reason,
       created_at,
       updated_at
  FROM esdc_participant_submission
 WHERE action_plan_id = 166
 ORDER BY id;

SELECT id,
       case_id,
       action_plan_id,
       application_id,
       legacy_intervention_id,
       source_intervention_id,
       proposal_kind,
       review_status,
       submitted_at,
       reviewed_at,
       archived_at,
       created_at,
       updated_at
  FROM iset_intervention_proposal
 WHERE action_plan_id = 166
    OR legacy_intervention_id IN (351, 352, 353)
    OR source_intervention_id IN (351, 352, 353)
 ORDER BY id;

SELECT document_id,
       intervention_id,
       created_at
  FROM iset_document_intervention
 WHERE intervention_id IN (351, 352, 353)
 ORDER BY intervention_id, document_id;

SELECT id,
       case_id,
       client_id,
       intervention_id,
       status,
       follow_up_status,
       submitted_at,
       sent_at,
       confirmed_at,
       created_at,
       updated_at
  FROM payment_packet
 WHERE intervention_id IN (351, 352, 353)
 ORDER BY id;

SELECT id,
       payment_packet_id,
       intervention_id,
       amount,
       status,
       paid_at,
       payment_reference,
       created_at,
       updated_at
  FROM payment_packet_line
 WHERE intervention_id IN (351, 352, 353)
 ORDER BY id;

SELECT id,
       case_id,
       case_intervention_id,
       amount,
       status,
       transaction_date,
       posted_at,
       created_at,
       updated_at
  FROM finance_transaction
 WHERE case_intervention_id IN (351, 352, 353)
 ORDER BY id;

SELECT application_id,
       owner_user_id,
       owner_display_name,
       owner_email,
       acquired_at,
       expires_at
  FROM application_lock
 WHERE application_id = 61;

SELECT id,
       report_type,
       severity,
       status,
       summary,
       submitted_by_staff_profile_id,
       submitted_by_name,
       submitted_by_email,
       submitted_by_role,
       submitted_at,
       updated_at
  FROM admin_feedback_report
 WHERE id = 178;

SELECT id,
       report_id,
       author_staff_profile_id,
       author_name,
       author_email,
       note_text,
       created_at
  FROM admin_feedback_note
 WHERE report_id = 178
 ORDER BY id;

SELECT id,
       report_id,
       previous_status,
       new_status,
       changed_by_staff_profile_id,
       changed_by_name,
       changed_by_email,
       changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 178
 ORDER BY id;

SELECT id,
       name,
       display_name,
       email,
       primary_role,
       status,
       region_id
  FROM staff_profiles
 WHERE id IN (51, 5697, 995581)
 ORDER BY id;
