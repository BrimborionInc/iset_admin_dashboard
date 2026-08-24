-- Narrow read-only PROD evidence for feedback #193 after the broader workflow
-- inventory identified approval-letter message 2640.
--
-- Execute only after current-task PROD identity proof and full live metadata
-- capture for messages, iset_document, message_signing_request, and
-- signing_request. Validate every finished identifier, relationship, literal,
-- and ordering field against that evidence immediately before execution.

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
   AND messages.id >= 2640
 ORDER BY messages.id;

SELECT iset_document.id,
       iset_document.application_id,
       iset_document.case_id,
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
   AND iset_document.created_at >= '2026-08-11 00:00:00'
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
   AND messages.id >= 2640
   AND signing_request.case_id = 109
 ORDER BY message_signing_request.message_id,
          message_signing_request.signing_request_id;
