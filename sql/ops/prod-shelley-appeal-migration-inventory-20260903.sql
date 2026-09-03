-- Read-only PROD inventory for the agreed interim appeal procedure.
-- Live target identity and live DDL for every referenced table/column were
-- proved in this task before execution.

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
  iset_review_workflow.archived_at,
  iset_review_workflow.updated_at
FROM iset_review_workflow
WHERE iset_review_workflow.id IN (66, 90)
ORDER BY iset_review_workflow.id;

SELECT
  iset_case_note.id,
  iset_case_note.case_id,
  iset_case_note.author_staff_profile_id,
  iset_case_note.author_user_id,
  iset_case_note.body,
  iset_case_note.is_internal,
  iset_case_note.is_pinned,
  iset_case_note.follow_up_at,
  iset_case_note.created_at,
  iset_case_note.updated_at,
  iset_case_note.deleted_at,
  iset_case_note.edited_at,
  iset_case_note.edited_by_staff_profile_id,
  iset_case_note.edited_by_user_id
FROM iset_case_note
WHERE iset_case_note.case_id IN (258, 269)
ORDER BY iset_case_note.case_id, iset_case_note.created_at, iset_case_note.id;

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
  iset_event_entry.id,
  iset_event_entry.category,
  iset_event_entry.event_type,
  iset_event_entry.severity,
  iset_event_entry.source,
  iset_event_entry.subject_type,
  iset_event_entry.subject_id,
  iset_event_entry.actor_type,
  iset_event_entry.actor_id,
  iset_event_entry.actor_staff_profile_id,
  iset_event_entry.actor_display_name,
  iset_event_entry.tracking_id,
  iset_event_entry.correlation_id,
  iset_event_entry.captured_by,
  iset_event_entry.notification_delivery_mode,
  iset_event_entry.captured_at
FROM iset_event_entry
WHERE iset_event_entry.subject_id IN ('258', '269')
ORDER BY iset_event_entry.subject_id,
         iset_event_entry.captured_at,
         iset_event_entry.id;
