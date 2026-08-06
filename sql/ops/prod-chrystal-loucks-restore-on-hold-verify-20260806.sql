-- Independent post-apply verification. Run in a fresh SSM command while the
-- two repair locks remain in place.

SELECT id, submission_id, client_id, case_id, status, lifecycle_status,
       decision_outcome, awaiting_reason, closure_reason, row_version,
       created_at, updated_at
  FROM iset_application
 WHERE id IN (117, 140)
 ORDER BY id;

SELECT id, client_id, assigned_staff_profile_id, status, lifecycle_status,
       closure_reason, open_intervention_count, total_intervention_count,
       JSON_TYPE(JSON_EXTRACT(
         case_context_json,
         '$.applicationReportingArtifacts'
       )) AS application_reporting_artifacts_type,
       updated_at
  FROM iset_case
 WHERE id = 69;

SELECT id, case_id, application_id, name, status, metadata_json,
       created_at, updated_at, archived_at
  FROM iset_case_action_plan
 WHERE id IN (95, 173)
 ORDER BY id;

SELECT id, case_id, action_plan_id, intervention_code, status,
       delivery_status, metadata_json, created_at, updated_at, closed_at
  FROM iset_case_intervention
 WHERE id IN (205, 369, 370)
 ORDER BY id;

SELECT id, case_id, action_plan_id, application_id, readiness_status,
       submission_status, submitted_at, created_at, updated_at
  FROM esdc_participant_submission
 WHERE id = 443;

SELECT id, participant_submission_id, event_type, occurred_at
  FROM esdc_participant_submission_history
 WHERE id = 2374;

SELECT id, case_id, application_id, action_plan_id, intervention_id, title,
       category, status, due_at, assigned_staff_profile_id, deleted_at
  FROM iset_case_reminder
 WHERE id = 165;

SELECT id, case_id, event_type, summary, payload_json, occurred_at,
       actor_staff_profile_id, actor_user_id, source_system
  FROM iset_case_event
 WHERE case_id = 69
   AND event_type = 'data_repair'
   AND source_system = 'codex-prod-data-repair'
   AND summary = 'Restored application 117 to On Hold at the assigned coordinator request.'
 ORDER BY id;

SELECT id, category, event_type, severity, source, subject_type, subject_id,
       actor_type, actor_id, actor_staff_profile_id, actor_applicant_user_id,
       actor_display_name, payload_json, tracking_id, correlation_id,
       captured_by, notification_delivery_mode, captured_at, ingested_at
  FROM iset_event_entry
 WHERE id = '41f40e75-5eec-4821-a082-8ca03b0f0e33';

SELECT application_id, owner_user_id, owner_display_name, acquired_at,
       expires_at
  FROM application_lock
 WHERE application_id IN (117, 140)
 ORDER BY application_id;
