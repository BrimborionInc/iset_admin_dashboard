-- PROD read-only preview for Denise Chalifoux accidental-denial recovery.
-- Exact target and every referenced table/column/function were live-proven on
-- MySQL 8.0.42 before this artifact was prepared.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

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
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 31;

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
       iset_case.open_intervention_count,
       iset_case.total_intervention_count,
       iset_case.updated_by_staff_profile_id,
       iset_case.updated_at
 FROM iset_case
 WHERE iset_case.id = 113;

SELECT JSON_KEYS(JSON_EXTRACT(
         iset_case.case_context_json,
         '$.applicationReportingArtifacts'
       ))
  FROM iset_case
 WHERE iset_case.id = 113;

SELECT iset_application_assessment.id,
       iset_application_assessment.application_id,
       iset_application_assessment.case_id,
       iset_application_assessment.date_of_assessment,
       iset_application_assessment.esdc_eligibility,
       iset_application_assessment.intervention_code,
       iset_application_assessment.intervention_outcome_code,
       iset_application_assessment.intervention_cost_total,
       iset_application_assessment.recommendation,
       iset_application_assessment.nwac_review,
       iset_application_assessment.nwac_reason,
       iset_application_assessment.updated_at
  FROM iset_application_assessment
 WHERE iset_application_assessment.id = 34;

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
       iset_review_workflow_event.review_workflow_id,
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

SELECT application_lock.application_id,
       application_lock.owner_user_id,
       application_lock.owner_display_name,
       application_lock.owner_email,
       application_lock.acquired_at,
       application_lock.expires_at,
       application_lock.metadata
  FROM application_lock
 WHERE application_lock.application_id = 31;

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
 WHERE iset_case_action_plan.id = 195;

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
       iset_case_intervention.closed_at,
       iset_case_intervention.created_at,
       iset_case_intervention.updated_at
  FROM iset_case_intervention
 WHERE iset_case_intervention.id IN (424, 425)
 ORDER BY iset_case_intervention.id;

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
 WHERE esdc_participant_submission.id = 496;

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
       iset_document.created_at,
       iset_document.updated_at
  FROM iset_document
 WHERE iset_document.id = 11648;

SELECT iset_document_intervention.document_id,
       iset_document_intervention.intervention_id,
       iset_document_intervention.created_at
  FROM iset_document_intervention
 WHERE iset_document_intervention.intervention_id IN (424, 425)
 ORDER BY iset_document_intervention.intervention_id,
          iset_document_intervention.document_id;

SELECT iset_intervention_proposal.id,
       iset_intervention_proposal.case_id,
       iset_intervention_proposal.action_plan_id,
       iset_intervention_proposal.application_id,
       iset_intervention_proposal.legacy_intervention_id,
       iset_intervention_proposal.source_intervention_id,
       iset_intervention_proposal.proposal_kind,
       iset_intervention_proposal.review_status,
       iset_intervention_proposal.archived_at,
       iset_intervention_proposal.created_at,
       iset_intervention_proposal.updated_at
  FROM iset_intervention_proposal
 WHERE iset_intervention_proposal.case_id = 113
    OR iset_intervention_proposal.action_plan_id = 195
    OR iset_intervention_proposal.application_id = 31
    OR iset_intervention_proposal.legacy_intervention_id IN (424, 425)
    OR iset_intervention_proposal.source_intervention_id IN (424, 425)
 ORDER BY iset_intervention_proposal.id;

SELECT iset_case_action_item.id,
       iset_case_action_item.action_plan_id,
       iset_case_action_item.case_id,
       iset_case_action_item.status,
       iset_case_action_item.deleted_at,
       iset_case_action_item.created_at,
       iset_case_action_item.updated_at
  FROM iset_case_action_item
 WHERE iset_case_action_item.action_plan_id = 195
    OR iset_case_action_item.case_id = 113
 ORDER BY iset_case_action_item.id;

SELECT iset_case_reminder.id,
       iset_case_reminder.case_id,
       iset_case_reminder.application_id,
       iset_case_reminder.action_plan_id,
       iset_case_reminder.intervention_id,
       iset_case_reminder.title,
       iset_case_reminder.category,
       iset_case_reminder.status,
       iset_case_reminder.due_at,
       iset_case_reminder.deleted_at,
       iset_case_reminder.created_at,
       iset_case_reminder.updated_at
  FROM iset_case_reminder
 WHERE iset_case_reminder.action_plan_id = 195
    OR iset_case_reminder.intervention_id IN (424, 425)
 ORDER BY iset_case_reminder.id;

SELECT finance_transaction.id,
       finance_transaction.case_id,
       finance_transaction.case_intervention_id,
       finance_transaction.budget_pot_id,
       finance_transaction.amount,
       finance_transaction.status,
       finance_transaction.transaction_date,
       finance_transaction.posted_at,
       finance_transaction.created_at,
       finance_transaction.updated_at
  FROM finance_transaction
 WHERE finance_transaction.case_id = 113
    OR finance_transaction.case_intervention_id IN (424, 425)
 ORDER BY finance_transaction.id;

SELECT payment_packet.id,
       payment_packet.case_id,
       payment_packet.client_id,
       payment_packet.intervention_id,
       payment_packet.status,
       payment_packet.follow_up_status,
       payment_packet.submitted_at,
       payment_packet.sent_at,
       payment_packet.confirmed_at,
       payment_packet.created_at,
       payment_packet.updated_at
  FROM payment_packet
 WHERE payment_packet.case_id = 113
    OR payment_packet.client_id = 108
    OR payment_packet.intervention_id IN (424, 425)
 ORDER BY payment_packet.id;

SELECT cfa_series.id,
       cfa_series.case_id,
       cfa_series.template_key,
       cfa_series.created_at,
       cfa_version.id,
       cfa_version.series_id,
       cfa_version.version_number,
       cfa_version.status,
       cfa_version.sent_at,
       cfa_version.signed_at,
       cfa_version.created_at
  FROM cfa_series
  LEFT JOIN cfa_version
    ON cfa_version.series_id = cfa_series.id
 WHERE cfa_series.case_id = 113
 ORDER BY cfa_series.id,
          cfa_version.version_number;

SELECT messages.id,
       messages.sender_actor_type,
       messages.sender_staff_profile_id,
       messages.recipient_actor_type,
       messages.recipient_staff_profile_id,
       messages.case_id,
       messages.application_id,
       messages.subject,
       messages.status,
       messages.created_at,
       messages.deleted,
       messages.urgent
  FROM messages
 WHERE messages.case_id = 113
   AND messages.created_at >= '2026-08-19 13:18:48'
 ORDER BY messages.id;

SELECT signing_request.id,
       signing_request.workflow_id,
       signing_request.workflow_name,
       signing_request.workflow_type,
       signing_request.case_id,
       signing_request.status,
       signing_request.signed_at,
       signing_request.due_at,
       signing_request.checklist_doc_type,
       signing_request.created_at,
       signing_request.updated_at
  FROM signing_request
 WHERE signing_request.case_id = 113
   AND signing_request.created_at >= '2026-08-19 13:18:48'
 ORDER BY signing_request.id;

SELECT iset_case_event.id,
       iset_case_event.case_id,
       iset_case_event.event_type,
       iset_case_event.summary,
       iset_case_event.payload_json,
       iset_case_event.occurred_at,
       iset_case_event.actor_staff_profile_id,
       iset_case_event.source_system
  FROM iset_case_event
 WHERE iset_case_event.case_id = 113
   AND iset_case_event.occurred_at >= '2026-08-19 13:18:48'
 ORDER BY iset_case_event.id;

SELECT iset_case.id,
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationAssessmentContexts."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."31"'),
       JSON_EXTRACT(iset_case.case_context_json, '$.assessment_nwac_review_status'),
       JSON_EXTRACT(iset_case.case_context_json, '$.fundingDecisionReasonCode'),
       JSON_EXTRACT(iset_case.case_context_json, '$.fundingDecisionReasonLabel'),
       JSON_EXTRACT(iset_case.case_context_json, '$.fundingDecisionReasonExplanation'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingDeniedAt'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeededAt'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDeniedIneligible'),
       JSON_EXTRACT(iset_case.case_context_json, '$.reportingCorrectionAllowed'),
       JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues')
  FROM iset_case
 WHERE iset_case.id = 113;
