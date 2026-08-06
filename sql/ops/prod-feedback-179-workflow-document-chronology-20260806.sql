-- PROD read-only chronology for feedback #179 / case 76 / application 123.
-- Live DDL was re-read on 2026-08-06 immediately before execution for every
-- table and identifier referenced below.

SELECT id, case_id, status, lifecycle_status, decision_outcome,
       awaiting_reason, docs_requested_active, docs_requested_at,
       docs_requested_cleared_at, docs_requested_source,
       row_version, created_at, updated_at
FROM iset_application
WHERE id = 123 AND case_id = 76;

SELECT id, review_workflow_id, action, from_stage, to_stage,
       actor_staff_profile_id, actor_role, note, created_at
FROM iset_review_workflow_event
WHERE review_workflow_id = 56
ORDER BY id;

SELECT id, case_id, event_type, summary, payload_json,
       occurred_at, created_at, actor_staff_profile_id,
       actor_user_id, source_system
FROM iset_case_event
WHERE case_id = 76
ORDER BY occurred_at, id;

SELECT sr.id AS signing_request_id,
       sr.workflow_id,
       sr.workflow_name,
       sr.workflow_type,
       sr.status AS signing_status,
       sr.checklist_doc_type,
       sr.created_at AS signing_created_at,
       sr.updated_at AS signing_updated_at,
       msr.message_id,
       m.application_id,
       m.subject,
       m.created_at AS message_created_at
FROM message_signing_request AS msr
JOIN signing_request AS sr
  ON sr.id = msr.signing_request_id
JOIN messages AS m
  ON m.id = msr.message_id
WHERE m.case_id = 76 AND m.application_id = 123
ORDER BY sr.created_at, sr.id;
