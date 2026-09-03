-- Independent read-only verification for the Jennifer Johnson and Veronica
-- Basque interim appeal-opening migration.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT
  iset_application.id,
  iset_application.case_id,
  iset_application.client_id,
  iset_application.status,
  iset_application.lifecycle_status,
  iset_application.decision_outcome,
  iset_application.awaiting_reason,
  iset_application.closure_reason,
  iset_application.row_version,
  iset_application.updated_at
FROM iset_application
WHERE iset_application.id IN (199, 208)
ORDER BY iset_application.id;

SELECT
  iset_case.id,
  iset_case.case_number,
  iset_case.status,
  iset_case.lifecycle_status,
  iset_case.closure_reason,
  iset_case.closed_at,
  iset_case.updated_at,
  JSON_EXTRACT(iset_case.case_context_json, '$.reportingOnlyDenied'),
  JSON_EXTRACT(iset_case.case_context_json, '$.excludeFromCaseworkQueues'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."199"'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationReportingArtifacts."208"'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".assessment_nwac_review_status'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".assessment_nwac_review_status'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."199".decisionLetterSent'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationDecisionLetters."208".decisionLetterSent'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."199"'),
  JSON_EXTRACT(iset_case.case_context_json, '$.applicationAppealHistory."208"')
FROM iset_case
WHERE iset_case.id IN (258, 269)
ORDER BY iset_case.id;

SELECT
  iset_review_workflow.id,
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
  iset_review_workflow.updated_at
FROM iset_review_workflow
WHERE iset_review_workflow.id IN (66, 90)
ORDER BY iset_review_workflow.id;

SELECT
  iset_review_workflow_event.id,
  iset_review_workflow_event.review_workflow_id,
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
  AND iset_review_workflow_event.action IN ('nwac_deny', 'interim_appeal_opened')
ORDER BY iset_review_workflow_event.review_workflow_id,
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
  iset_case_event.source_system
FROM iset_case_event
WHERE iset_case_event.case_id IN (258, 269)
  AND iset_case_event.event_type = 'appeal_opened_for_decision'
  AND JSON_UNQUOTE(JSON_EXTRACT(iset_case_event.payload_json, '$.runId')) = 'prod-shelley-appeal-open-20260903'
ORDER BY iset_case_event.case_id, iset_case_event.id;

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

-- Must return no rows: archived denial-only plans cannot enter the current
-- ESDC queue while their underlying decisions are under appeal.
SELECT
  esdc_participant_submission.id,
  iset_case_action_plan.id,
  iset_case_action_plan.status,
  iset_case_action_plan.archived_at
FROM esdc_participant_submission
JOIN iset_case_action_plan
  ON iset_case_action_plan.id = esdc_participant_submission.action_plan_id
WHERE esdc_participant_submission.id IN (508, 513)
  AND iset_case_action_plan.archived_at IS NULL;

SELECT
  iset_document.id,
  iset_document.application_id,
  iset_document.case_id,
  iset_document.file_name,
  iset_document.label,
  iset_document.status,
  iset_document.document_category,
  iset_document.updated_at
FROM iset_document
WHERE iset_document.id IN (12864, 12865, 12943, 13614, 13620, 13625, 13854)
ORDER BY iset_document.case_id, iset_document.id;

-- These are the exact rows the NWAC Pending Decision endpoint selects by
-- authoritative review stage. Expected result: application 199 and 208.
SELECT
  iset_application.id,
  iset_application.status,
  iset_application.lifecycle_status,
  iset_case.id,
  iset_case.status,
  iset_review_workflow.id,
  iset_review_workflow.current_stage,
  iset_review_workflow.current_owner_role
FROM iset_application
JOIN iset_case
  ON iset_case.id = iset_application.case_id
JOIN iset_review_workflow
  ON iset_review_workflow.application_id = iset_application.id
 AND iset_review_workflow.workflow_type = 'application_assessment'
 AND iset_review_workflow.archived_at IS NULL
WHERE iset_application.id IN (199, 208)
  AND iset_review_workflow.current_stage = 'nwac_review'
ORDER BY iset_application.id;

SELECT
  application_lock.application_id,
  application_lock.owner_user_id,
  application_lock.expires_at
FROM application_lock
WHERE application_lock.application_id IN (199, 208)
ORDER BY application_lock.application_id;
