-- Read-only PROD workflow inventory for feedback #193.
-- Scope: case 109 / application 27, the exact context captured by the report.
--
-- Execute only after current-task PROD identity proof and live SHOW CREATE
-- TABLE, SHOW FULL COLUMNS, and SHOW INDEX evidence for iset_application,
-- iset_case, messages, iset_document, message_signing_request, and
-- signing_request. Immediately before execution, validate every finished
-- statement identifier, relationship, function, literal, and ordering field
-- against that evidence.

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.client_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.awaiting_reason,
       iset_application.closure_reason,
       iset_application.row_version,
       iset_application.docs_requested_active,
       iset_application.docs_requested_at,
       iset_application.docs_requested_source,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109;

SELECT iset_case.id,
       iset_case.case_number,
       iset_case.assigned_staff_profile_id,
       iset_case.status,
       iset_case.lifecycle_status,
       iset_case.closure_reason,
       iset_case.stage,
       iset_case.sub_stage,
       iset_case.case_context_json,
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109;

SELECT messages.id,
       messages.sender_actor_type,
       messages.sender_user_id,
       messages.sender_staff_profile_id,
       messages.recipient_actor_type,
       messages.recipient_user_id,
       messages.recipient_staff_profile_id,
       messages.case_id,
       messages.application_id,
       messages.subject,
       messages.status,
       messages.deleted,
       messages.urgent,
       messages.created_at
  FROM messages
 WHERE messages.case_id = 109
   AND messages.application_id = 27
 ORDER BY messages.id;

SELECT iset_document.id,
       iset_document.applicant_user_id,
       iset_document.client_id,
       iset_document.application_id,
       iset_document.case_id,
       iset_document.action_plan_id,
       iset_document.origin_message_id,
       iset_document.signing_request_id,
       iset_document.source,
       iset_document.file_name,
       iset_document.mime_type,
       iset_document.label,
       iset_document.metadata,
       iset_document.status,
       iset_document.created_at,
       iset_document.updated_at,
       iset_document.document_category,
       iset_document.visibility
  FROM iset_document
 WHERE iset_document.case_id = 109
   AND iset_document.application_id = 27
 ORDER BY iset_document.id;

SELECT message_signing_request.message_id,
       message_signing_request.signing_request_id,
       signing_request.workflow_id,
       signing_request.workflow_name,
       signing_request.workflow_type,
       signing_request.case_id,
       signing_request.participant_user_id,
       signing_request.created_by_user_id,
       signing_request.status,
       signing_request.signed_at,
       signing_request.due_at,
       signing_request.checklist_doc_type,
       signing_request.created_at,
       signing_request.updated_at
  FROM message_signing_request
  JOIN messages
    ON messages.id = message_signing_request.message_id
  JOIN signing_request
    ON signing_request.id = message_signing_request.signing_request_id
 WHERE messages.case_id = 109
   AND messages.application_id = 27
   AND signing_request.case_id = 109
 ORDER BY message_signing_request.message_id,
          message_signing_request.signing_request_id;
