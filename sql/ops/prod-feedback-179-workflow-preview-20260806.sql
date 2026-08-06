-- Read-only PROD state inspection for feedback #179 / Case 76.
SELECT id, case_number, status, lifecycle_status, assigned_staff_profile_id,
       open_intervention_count, total_intervention_count, updated_at
FROM iset_case
WHERE id = 76;

SELECT id, case_id, application_id, name, status, owner_staff_profile_id,
       activated_at, closed_at, archived_at, updated_at
FROM iset_case_action_plan
WHERE id = 3 AND case_id = 76;

SELECT id, case_id, action_plan_id, status, delivery_status, intervention_code,
       start_date, end_date, intervention_cost, budget_amount, approved_amount,
       actual_amount, reviewed_by_staff_profile_id, reviewed_at, review_notes,
       metadata_json, created_at, updated_at, closed_at
FROM iset_case_intervention
WHERE case_id = 76 AND action_plan_id = 3;

SELECT id, case_id, action_plan_id, application_id, legacy_intervention_id,
       source_intervention_id, proposal_kind, review_status, title,
       proposed_cost, decision_reason, decision_notes, submitted_by_staff_profile_id,
       reviewed_by_staff_profile_id, submitted_at, reviewed_at, archived_at,
       metadata_json, created_at, updated_at
FROM iset_intervention_proposal
WHERE case_id = 76 AND action_plan_id = 3
ORDER BY id;

SELECT id, workflow_type, subject_key, case_id, application_id, action_plan_id,
       intervention_id, proposal_id, current_stage, current_owner_role,
       current_owner_staff_profile_id, submitted_by_staff_profile_id, submitted_at,
       rm_reviewed_by_staff_profile_id, rm_reviewed_at, rm_review_note,
       nwac_decided_by_staff_profile_id, nwac_decided_at, nwac_decision,
       nwac_decision_note, archived_at, created_at, updated_at
FROM iset_review_workflow
WHERE case_id = 76
ORDER BY id;

SELECT e.id, e.review_workflow_id, e.workflow_type, e.subject_key, e.action,
       e.from_stage, e.to_stage, e.actor_staff_profile_id, e.actor_role,
       e.note, e.created_at
FROM iset_review_workflow_event AS e
JOIN iset_review_workflow AS w ON w.id = e.review_workflow_id
WHERE w.case_id = 76
ORDER BY e.id;

SELECT id, submission_id, client_id, case_id, status, lifecycle_status,
       decision_outcome, awaiting_reason, version, created_at, updated_at, row_version
FROM iset_application
WHERE id = 123 AND case_id = 76;

SELECT id, application_id, case_id, date_of_assessment, recommendation,
       nwac_review, nwac_reason, intervention_cost_total, created_at, updated_at
FROM iset_application_assessment
WHERE application_id = 123 AND case_id = 76;
