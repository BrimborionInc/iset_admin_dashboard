-- Read-only confirmation of the exact staff identity and workflow state behind feedback #179.
SELECT id, workflow_type, case_id, application_id, current_stage,
       current_owner_role, submitted_by_staff_profile_id,
       rm_reviewed_by_staff_profile_id, nwac_decided_by_staff_profile_id,
       nwac_decision, nwac_decision_note, archived_at, updated_at
FROM iset_review_workflow
WHERE id = 56 AND case_id = 76 AND application_id = 123;

SELECT id, case_id, status, lifecycle_status, decision_outcome,
       awaiting_reason, row_version, updated_at
FROM iset_application
WHERE id = 123 AND case_id = 76;

SELECT id, email, name, display_name, primary_role, status
FROM staff_profiles
WHERE id IN (51, 54)
ORDER BY id;
