-- Guarded read-only preview for the proposed interim appeal migration.
-- Run only after the exact PROD identity and current live DDL have been proved.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT
  iset_case.id,
  iset_case.case_number,
  iset_case.client_id,
  iset_case.assigned_staff_profile_id,
  iset_case.status,
  iset_case.lifecycle_status,
  iset_case.closure_reason,
  iset_case.stage,
  iset_case.sub_stage,
  iset_case.opened_at,
  iset_case.closed_at,
  iset_case.open_intervention_count,
  iset_case.total_intervention_count,
  iset_case.updated_by_staff_profile_id,
  iset_case.updated_at,
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingCorrectionAllowed'),
  JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingTrigger'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeedSource'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingSeededAt'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingLastSyncedAt'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingDeniedAt'),
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingDate'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationId'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters')
FROM iset_case
WHERE iset_case.id IN (258, 269)
ORDER BY iset_case.id;

SELECT
  iset_application.id,
  iset_application.submission_id,
  iset_application.client_id,
  iset_application.case_id,
  iset_application.status,
  iset_application.lifecycle_status,
  iset_application.decision_outcome,
  iset_application.awaiting_reason,
  iset_application.closure_reason,
  iset_application.row_version,
  iset_application.has_open_escalation,
  iset_application.current_escalation_id,
  iset_application.docs_requested_active,
  iset_application.docs_requested_at,
  iset_application.docs_requested_cleared_at,
  iset_application.docs_requested_source,
  iset_application.updated_at
FROM iset_application
WHERE iset_application.id IN (199, 208)
ORDER BY iset_application.id;

SELECT
  iset_application_assessment.id,
  iset_application_assessment.application_id,
  iset_application_assessment.case_id,
  iset_application_assessment.date_of_assessment,
  iset_application_assessment.intervention_budget_pot_id,
  iset_application_assessment.posting_context,
  iset_application_assessment.intervention_cost_total,
  iset_application_assessment.recommendation,
  iset_application_assessment.nwac_review,
  iset_application_assessment.nwac_reason,
  iset_application_assessment.updated_at
FROM iset_application_assessment
WHERE iset_application_assessment.id IN (1622, 1770)
ORDER BY iset_application_assessment.id;

SELECT
  iset_review_workflow.id,
  iset_review_workflow.workflow_type,
  iset_review_workflow.subject_key,
  iset_review_workflow.case_id,
  iset_review_workflow.application_id,
  iset_review_workflow.action_plan_id,
  iset_review_workflow.intervention_id,
  iset_review_workflow.proposal_id,
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
  iset_review_workflow.updated_at
FROM iset_review_workflow
WHERE iset_review_workflow.id IN (66, 90)
ORDER BY iset_review_workflow.id;

SELECT
  iset_review_workflow_event.id,
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
WHERE iset_review_workflow_event.review_workflow_id IN (66, 90)
ORDER BY iset_review_workflow_event.review_workflow_id,
         iset_review_workflow_event.created_at,
         iset_review_workflow_event.id;

SELECT
  iset_case_note.id,
  iset_case_note.case_id,
  iset_case_note.author_staff_profile_id,
  iset_case_note.author_user_id,
  iset_case_note.body,
  iset_case_note.created_at,
  iset_case_note.deleted_at
FROM iset_case_note
WHERE iset_case_note.case_id IN (258, 269)
  AND (
    iset_case_note.body LIKE 'APPEAL_OPENED_20260903:%'
    OR iset_case_note.id IN (705, 718)
  )
ORDER BY iset_case_note.case_id, iset_case_note.id;

SELECT
  iset_case_event.id,
  iset_case_event.case_id,
  iset_case_event.event_type,
  iset_case_event.summary,
  iset_case_event.payload_json,
  iset_case_event.occurred_at,
  iset_case_event.actor_staff_profile_id,
  iset_case_event.actor_user_id,
  iset_case_event.source_system
FROM iset_case_event
WHERE iset_case_event.case_id IN (258, 269)
  AND iset_case_event.event_type = 'appeal_opened_for_decision'
ORDER BY iset_case_event.case_id, iset_case_event.id;

SELECT
  application_lock.application_id,
  application_lock.owner_user_id,
  application_lock.owner_display_name,
  application_lock.owner_email,
  application_lock.acquired_at,
  application_lock.expires_at,
  application_lock.metadata
FROM application_lock
WHERE application_lock.application_id IN (199, 208)
ORDER BY application_lock.application_id;

SELECT
  iset_document.id,
  iset_document.client_id,
  iset_document.application_id,
  iset_document.case_id,
  iset_document.signing_request_id,
  iset_document.source,
  iset_document.file_name,
  iset_document.label,
  iset_document.status,
  iset_document.document_category,
  iset_document.created_at,
  iset_document.updated_at
FROM iset_document
WHERE iset_document.id IN (12864, 12865, 12943, 13614, 13620, 13625, 13854)
ORDER BY iset_document.case_id, iset_document.id;

SELECT
  iset_case_action_plan.id,
  iset_case_action_plan.case_id,
  iset_case_action_plan.application_id,
  iset_case_action_plan.name,
  iset_case_action_plan.status,
  iset_case_action_plan.archived_at,
  iset_case_action_plan.metadata_json,
  iset_case_action_plan.updated_at
FROM iset_case_action_plan
WHERE iset_case_action_plan.id IN (206, 211)
ORDER BY iset_case_action_plan.id;

SELECT
  iset_case_intervention.id,
  iset_case_intervention.case_id,
  iset_case_intervention.action_plan_id,
  iset_case_intervention.status,
  iset_case_intervention.delivery_status,
  iset_case_intervention.actual_amount,
  iset_case_intervention.metadata_json,
  iset_case_intervention.updated_at
FROM iset_case_intervention
WHERE iset_case_intervention.id IN (449, 450, 461, 462)
ORDER BY iset_case_intervention.id;

SELECT
  esdc_participant_submission.id,
  esdc_participant_submission.case_id,
  esdc_participant_submission.action_plan_id,
  esdc_participant_submission.application_id,
  esdc_participant_submission.readiness_status,
  esdc_participant_submission.submission_status,
  esdc_participant_submission.submitted_at,
  esdc_participant_submission.payload_snapshot,
  esdc_participant_submission.payload_storage_key,
  esdc_participant_submission.payload_checksum,
  esdc_participant_submission.updated_at
FROM esdc_participant_submission
WHERE esdc_participant_submission.id IN (508, 513)
ORDER BY esdc_participant_submission.id;

SELECT
  funding_overview_version.id,
  funding_overview_version.series_id,
  funding_overview_version.application_id,
  funding_overview_version.version_number,
  funding_overview_version.status,
  funding_overview_version.supersedes_version_id,
  funding_overview_version.created_at,
  funding_overview_version.sent_at,
  funding_overview_version.signed_at
FROM funding_overview_version
WHERE funding_overview_version.application_id IN (199, 208)
ORDER BY funding_overview_version.application_id,
         funding_overview_version.version_number,
         funding_overview_version.id;

SELECT
  signing_request.id,
  signing_request.case_id,
  signing_request.status,
  signing_request.checklist_doc_type,
  signing_request.signed_at,
  signing_request.created_at,
  signing_request.updated_at
FROM signing_request
WHERE signing_request.id IN (190, 191, 220, 274, 275)
ORDER BY signing_request.case_id, signing_request.id;

SELECT
  staff_profiles.id,
  staff_profiles.email,
  staff_profiles.name,
  staff_profiles.display_name,
  staff_profiles.primary_role,
  staff_profiles.status,
  staff_profiles.region_id
FROM staff_profiles
WHERE staff_profiles.id IN (1, 50, 51, 54)
ORDER BY staff_profiles.id;
