-- Read-only preview for Kelly Pashe application 71 / review workflow 68.
-- PROD identity: SSM c3a58e17-4a13-493d-bb9f-de53e12d3413.
-- iset_review_workflow DDL: SSM a5cc7389-0771-4510-b6ed-1ff14b577388.
-- iset_review_workflow_event DDL: SSM c3a58e17-4a13-493d-bb9f-de53e12d3413.

START TRANSACTION READ ONLY;

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
  iset_review_workflow.created_at,
  iset_review_workflow.updated_at
FROM iset_review_workflow
WHERE iset_review_workflow.id = 68
  AND iset_review_workflow.workflow_type = 'application_assessment'
  AND iset_review_workflow.subject_key = 'application_assessment:application:71'
  AND iset_review_workflow.case_id = 147
  AND iset_review_workflow.application_id = 71;

SELECT
  iset_review_workflow_event.id,
  iset_review_workflow_event.action,
  iset_review_workflow_event.from_stage,
  iset_review_workflow_event.to_stage,
  iset_review_workflow_event.actor_staff_profile_id,
  iset_review_workflow_event.actor_role,
  iset_review_workflow_event.note,
  iset_review_workflow_event.created_at
FROM iset_review_workflow_event
WHERE iset_review_workflow_event.review_workflow_id = 68
ORDER BY iset_review_workflow_event.created_at, iset_review_workflow_event.id;

COMMIT;
