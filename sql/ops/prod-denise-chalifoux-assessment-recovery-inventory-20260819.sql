-- PROD read-only inventory for Denise Chalifoux's accidental-denial recovery.
-- Phase 1: resolve the exact live client row(s) from live-DDL-proven columns.
-- Target identity must be proved immediately before execution.

SELECT client.id,
       client.first_name,
       client.last_name,
       client.applicant_account_status,
       client.applicant_account_email,
       client.created_at,
       client.updated_at
  FROM client
 WHERE client.first_name = 'Denise'
   AND client.last_name = 'Chalifoux'
 ORDER BY client.id;

-- Phase 2: client ids 108 and 126 were resolved by the Phase 1 live read.
SELECT iset_application.id,
       iset_application.submission_id,
       iset_application.client_id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.awaiting_reason,
       iset_application.closure_reason,
       iset_application.row_version,
       iset_application.docs_requested_active,
       iset_application.docs_requested_at,
       iset_application.docs_requested_cleared_at,
       iset_application.docs_requested_source,
       iset_application.created_at,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.client_id IN (108, 126)
 ORDER BY iset_application.id;

-- Phase 3: application 31 / case 113 were resolved by the Phase 2 live read.
SELECT iset_case.id,
       iset_case.case_number,
       iset_case.client_id,
       iset_case.assigned_staff_profile_id,
       iset_case.status,
       iset_case.lifecycle_status,
       iset_case.closure_reason,
       iset_case.stage,
       iset_case.sub_stage,
       iset_case.closed_at,
       iset_case.portfolio_region_id,
       iset_case.open_intervention_count,
       iset_case.total_intervention_count,
       iset_case.updated_by_staff_profile_id,
       iset_case.created_at,
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 113;

SELECT iset_application_assessment.id,
       iset_application_assessment.application_id,
       iset_application_assessment.case_id,
       iset_application_assessment.date_of_assessment,
       iset_application_assessment.esdc_eligibility,
       iset_application_assessment.intervention_budget_pot_id,
       iset_application_assessment.posting_context,
       iset_application_assessment.intervention_code,
       iset_application_assessment.intervention_outcome_code,
       iset_application_assessment.intervention_cost_total,
       iset_application_assessment.recommendation,
       iset_application_assessment.nwac_review,
       iset_application_assessment.nwac_reason,
       iset_application_assessment.created_at,
       iset_application_assessment.updated_at
  FROM iset_application_assessment
 WHERE iset_application_assessment.application_id = 31;

SELECT iset_review_workflow.id,
       iset_review_workflow.workflow_type,
       iset_review_workflow.subject_key,
       iset_review_workflow.case_id,
       iset_review_workflow.application_id,
       iset_review_workflow.current_stage,
       iset_review_workflow.current_owner_role,
       iset_review_workflow.current_owner_staff_profile_id,
       iset_review_workflow.submitted_by_staff_profile_id,
       iset_review_workflow.submitted_at,
       iset_review_workflow.rm_reviewed_by_staff_profile_id,
       iset_review_workflow.rm_reviewed_at,
       iset_review_workflow.rm_review_note,
       iset_review_workflow.nwac_decided_by_staff_profile_id,
       iset_review_workflow.nwac_decided_at,
       iset_review_workflow.nwac_decision,
       iset_review_workflow.nwac_decision_note,
       iset_review_workflow.metadata_json,
       iset_review_workflow.archived_at,
       iset_review_workflow.created_at,
       iset_review_workflow.updated_at
  FROM iset_review_workflow
 WHERE iset_review_workflow.application_id = 31
 ORDER BY iset_review_workflow.id;

-- Phase 4: ownership, workflow history, and direct downstream dependencies.
SELECT staff_profiles.id,
       staff_profiles.email,
       staff_profiles.name,
       staff_profiles.display_name,
       staff_profiles.primary_role,
       staff_profiles.status,
       staff_profiles.region_id
  FROM staff_profiles
 WHERE staff_profiles.id IN (51, 995581)
 ORDER BY staff_profiles.id;

SELECT iset_review_workflow_event.id,
       iset_review_workflow_event.review_workflow_id,
       iset_review_workflow_event.workflow_type,
       iset_review_workflow_event.subject_key,
       iset_review_workflow_event.action,
       iset_review_workflow_event.from_stage,
       iset_review_workflow_event.to_stage,
       iset_review_workflow_event.actor_staff_profile_id,
       iset_review_workflow_event.actor_role,
       iset_review_workflow_event.note,
       iset_review_workflow_event.payload_json,
       iset_review_workflow_event.created_at
  FROM iset_review_workflow_event
 WHERE iset_review_workflow_event.review_workflow_id = 59
 ORDER BY iset_review_workflow_event.id;

SELECT iset_case_action_plan.id,
       iset_case_action_plan.case_id,
       iset_case_action_plan.application_id,
       iset_case_action_plan.name,
       iset_case_action_plan.status,
       iset_case_action_plan.owner_staff_profile_id,
       iset_case_action_plan.effective_date,
       iset_case_action_plan.activated_at,
       iset_case_action_plan.closed_at,
       iset_case_action_plan.result_code,
       iset_case_action_plan.result_date,
       iset_case_action_plan.metadata_json,
       iset_case_action_plan.archived_at,
       iset_case_action_plan.created_at,
       iset_case_action_plan.updated_at
  FROM iset_case_action_plan
 WHERE iset_case_action_plan.case_id = 113
    OR iset_case_action_plan.application_id = 31
 ORDER BY iset_case_action_plan.id;

SELECT iset_case_intervention.id,
       iset_case_intervention.case_id,
       iset_case_intervention.action_plan_id,
       iset_case_intervention.intervention_code,
       iset_case_intervention.status,
       iset_case_intervention.delivery_status,
       iset_case_intervention.start_date,
       iset_case_intervention.end_date,
       iset_case_intervention.intervention_cost,
       iset_case_intervention.budget_amount,
       iset_case_intervention.approved_amount,
       iset_case_intervention.actual_amount,
       iset_case_intervention.outcome_code,
       iset_case_intervention.metadata_json,
       iset_case_intervention.created_by_staff_profile_id,
       iset_case_intervention.reviewed_by_staff_profile_id,
       iset_case_intervention.reviewed_at,
       iset_case_intervention.closed_at,
       iset_case_intervention.created_at,
       iset_case_intervention.updated_at
  FROM iset_case_intervention
 WHERE iset_case_intervention.case_id = 113
 ORDER BY iset_case_intervention.id;

SELECT iset_intervention_proposal.id,
       iset_intervention_proposal.case_id,
       iset_intervention_proposal.action_plan_id,
       iset_intervention_proposal.application_id,
       iset_intervention_proposal.legacy_intervention_id,
       iset_intervention_proposal.source_intervention_id,
       iset_intervention_proposal.proposal_kind,
       iset_intervention_proposal.review_status,
       iset_intervention_proposal.title,
       iset_intervention_proposal.intervention_code,
       iset_intervention_proposal.proposed_cost,
       iset_intervention_proposal.decision_reason,
       iset_intervention_proposal.submitted_by_staff_profile_id,
       iset_intervention_proposal.reviewed_by_staff_profile_id,
       iset_intervention_proposal.submitted_at,
       iset_intervention_proposal.reviewed_at,
       iset_intervention_proposal.archived_at,
       iset_intervention_proposal.created_at,
       iset_intervention_proposal.updated_at
  FROM iset_intervention_proposal
 WHERE iset_intervention_proposal.case_id = 113
    OR iset_intervention_proposal.application_id = 31
 ORDER BY iset_intervention_proposal.id;

SELECT esdc_participant_submission.id,
       esdc_participant_submission.case_id,
       esdc_participant_submission.action_plan_id,
       esdc_participant_submission.application_id,
       esdc_participant_submission.readiness_status,
       esdc_participant_submission.submission_status,
       esdc_participant_submission.submitted_at,
       esdc_participant_submission.submitted_by_user_id,
       esdc_participant_submission.payload_storage_key,
       esdc_participant_submission.payload_checksum,
       esdc_participant_submission.created_at,
       esdc_participant_submission.updated_at
  FROM esdc_participant_submission
 WHERE esdc_participant_submission.case_id = 113
    OR esdc_participant_submission.application_id = 31
 ORDER BY esdc_participant_submission.id;

SELECT iset_document.id,
       iset_document.client_id,
       iset_document.application_id,
       iset_document.case_id,
       iset_document.action_plan_id,
       iset_document.origin_message_id,
       iset_document.signing_request_id,
       iset_document.source,
       iset_document.file_name,
       iset_document.label,
       iset_document.status,
       iset_document.document_category,
       iset_document.visibility,
       iset_document.created_at,
       iset_document.updated_at
  FROM iset_document
 WHERE iset_document.case_id = 113
    OR iset_document.application_id = 31
    OR iset_document.client_id = 108
 ORDER BY iset_document.id;

-- JSON built-ins were probed successfully on the verified MySQL 8.0.42 target.
SELECT iset_case.id,
       JSON_KEYS(iset_case.case_context_json),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationAssessmentContexts."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingDeniedAt'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDeniedIneligible'),
       JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues'),
       JSON_EXTRACT(iset_case.case_context_json, '$.fundingDecisionReasonCode')
  FROM iset_case
 WHERE iset_case.id = 113;
