-- Read-only PROD case and review-workflow preview for feedback #198.
-- Application 233 was live-proven to belong to case 292 before this file was
-- prepared. Statements remain table-isolated and fully qualified.

SELECT iset_case.id,
       iset_case.assigned_staff_profile_id,
       iset_case.status,
       iset_case.lifecycle_status,
       iset_case.closure_reason,
       iset_case.stage,
       iset_case.sub_stage,
       iset_case.open_task_count,
       iset_case.overdue_task_count,
       iset_case.open_intervention_count,
       iset_case.total_intervention_count,
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 292;

SELECT iset_review_workflow.id,
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
       iset_review_workflow.nwac_decided_by_staff_profile_id,
       iset_review_workflow.nwac_decided_at,
       iset_review_workflow.nwac_decision,
       iset_review_workflow.metadata_json,
       iset_review_workflow.archived_at,
       iset_review_workflow.created_at,
       iset_review_workflow.updated_at
  FROM iset_review_workflow
 WHERE iset_review_workflow.application_id = 233
 ORDER BY iset_review_workflow.id;
