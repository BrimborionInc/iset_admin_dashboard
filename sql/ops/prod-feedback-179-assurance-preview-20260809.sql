-- Read-only PROD assurance preview for feedback #179.
--
-- Target identity and every table/column below were re-proved from live PROD
-- metadata on 2026-08-09 before this artifact was executed. This artifact does
-- not authenticate as the reporter and does not change any live record.

SELECT id,
       report_type,
       severity,
       status,
       summary,
       description,
       submitted_by_staff_profile_id,
       submitted_by_name,
       submitted_by_email,
       submitted_by_role,
       page_title,
       page_path,
       page_url,
       context_json,
       submitted_at,
       updated_at
  FROM admin_feedback_report
 WHERE id = 179;

SELECT id,
       report_id,
       author_name,
       note_text,
       created_at
  FROM admin_feedback_note
 WHERE report_id = 179
 ORDER BY id;

SELECT id,
       report_id,
       previous_status,
       new_status,
       changed_by_name,
       changed_at
  FROM admin_feedback_status_history
 WHERE report_id = 179
 ORDER BY id;

SELECT id,
       case_number,
       assigned_staff_profile_id,
       status,
       lifecycle_status,
       stage,
       sub_stage,
       updated_at
  FROM iset_case
 WHERE id = 76;

SELECT id,
       submission_id,
       client_id,
       case_id,
       status,
       lifecycle_status,
       decision_outcome,
       awaiting_reason,
       docs_requested_active,
       docs_requested_at,
       docs_requested_cleared_at,
       docs_requested_source,
       row_version,
       updated_at
  FROM iset_application
 WHERE id = 123
   AND case_id = 76;

SELECT id,
       workflow_type,
       subject_key,
       case_id,
       application_id,
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
       metadata_json,
       archived_at,
       updated_at
  FROM iset_review_workflow
 WHERE id = 56
   AND case_id = 76
   AND application_id = 123;

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
       payload_json,
       created_at
  FROM iset_review_workflow_event
 WHERE review_workflow_id = 56
 ORDER BY id;
