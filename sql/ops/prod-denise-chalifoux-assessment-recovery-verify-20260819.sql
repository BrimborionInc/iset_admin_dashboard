-- Independent post-apply verification for Denise application 31 / case 113.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT iset_application.id,
       iset_application.client_id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.awaiting_reason,
       iset_application.closure_reason,
       iset_application.row_version,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 31;

SELECT iset_case.id,
       iset_case.assigned_staff_profile_id,
       iset_case.status,
       iset_case.lifecycle_status,
       iset_case.closure_reason,
       iset_case.stage,
       iset_case.sub_stage,
       iset_case.closed_at,
       iset_case.open_intervention_count,
       iset_case.total_intervention_count,
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingCorrectionAllowed'),
       JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues'),
       JSON_EXTRACT(iset_case.case_context_json, '$.fundingDecisionReasonCode'),
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 113;

SELECT iset_application_assessment.id,
       iset_application_assessment.application_id,
       iset_application_assessment.case_id,
       iset_application_assessment.recommendation,
       iset_application_assessment.nwac_review,
       iset_application_assessment.nwac_reason,
       iset_application_assessment.updated_at
  FROM iset_application_assessment
 WHERE iset_application_assessment.id = 34;

SELECT iset_review_workflow.id,
       iset_review_workflow.current_stage,
       iset_review_workflow.current_owner_role,
       iset_review_workflow.current_owner_staff_profile_id,
       iset_review_workflow.submitted_by_staff_profile_id,
       iset_review_workflow.rm_reviewed_by_staff_profile_id,
       iset_review_workflow.rm_reviewed_at,
       iset_review_workflow.rm_review_note,
       iset_review_workflow.nwac_decided_by_staff_profile_id,
       iset_review_workflow.nwac_decided_at,
       iset_review_workflow.nwac_decision,
       iset_review_workflow.nwac_decision_note,
       iset_review_workflow.metadata_json,
       iset_review_workflow.archived_at,
       iset_review_workflow.updated_at
  FROM iset_review_workflow
 WHERE iset_review_workflow.id = 59;

SELECT iset_review_workflow_event.id,
       iset_review_workflow_event.action,
       iset_review_workflow_event.from_stage,
       iset_review_workflow_event.to_stage,
       iset_review_workflow_event.actor_staff_profile_id,
       iset_review_workflow_event.actor_role,
       iset_review_workflow_event.note,
       iset_review_workflow_event.created_at
  FROM iset_review_workflow_event
 WHERE iset_review_workflow_event.review_workflow_id = 59
 ORDER BY iset_review_workflow_event.id;

SELECT iset_case_action_plan.id,
       iset_case_action_plan.status,
       iset_case_action_plan.archived_at,
       iset_case_action_plan.updated_at
  FROM iset_case_action_plan
 WHERE iset_case_action_plan.id = 195;

SELECT iset_case_intervention.id,
       iset_case_intervention.status,
       iset_case_intervention.delivery_status,
       iset_case_intervention.actual_amount,
       iset_case_intervention.updated_at
  FROM iset_case_intervention
 WHERE iset_case_intervention.id IN (424, 425)
 ORDER BY iset_case_intervention.id;

SELECT esdc_participant_submission.id,
       esdc_participant_submission.case_id,
       esdc_participant_submission.action_plan_id,
       esdc_participant_submission.application_id,
       esdc_participant_submission.submission_status
  FROM esdc_participant_submission
 WHERE esdc_participant_submission.id = 496;

SELECT iset_document.id,
       iset_document.status,
       iset_document.origin_message_id,
       iset_document.signing_request_id,
       iset_document.updated_at
  FROM iset_document
 WHERE iset_document.id = 11648;

SELECT iset_case_event.id,
       iset_case_event.event_type,
       iset_case_event.summary,
       iset_case_event.payload_json,
       iset_case_event.occurred_at,
       iset_case_event.source_system
  FROM iset_case_event
 WHERE iset_case_event.case_id = 113
   AND iset_case_event.event_type = 'assessment_returned_for_correction_recovery'
 ORDER BY iset_case_event.id;

SELECT iset_case_note.id,
       iset_case_note.case_id,
       iset_case_note.body,
       iset_case_note.is_internal,
       iset_case_note.created_at
  FROM iset_case_note
 WHERE iset_case_note.case_id = 113
   AND iset_case_note.body LIKE 'SYSTEM_ADMIN_DENISE_RECOVERY_20260819:%'
 ORDER BY iset_case_note.id;

SELECT application_lock.application_id,
       application_lock.owner_user_id,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 31;
