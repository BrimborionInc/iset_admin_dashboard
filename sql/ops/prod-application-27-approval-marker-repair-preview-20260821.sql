-- Read-only PROD preview for the one-record approval-marker repair.
-- Scope: case 109 / application 27 only. This returns structural hashes and
-- workflow identifiers, never the full case context or message/document body.

SET @application_27_approval_sent_at := '2026-08-11T15:08:14.000Z';

SELECT iset_application.id,
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
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109;

SELECT iset_case.id,
       iset_case.status,
       iset_case.lifecycle_status,
       JSON_TYPE(iset_case.case_context_json),
       JSON_TYPE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27"'
         )
       ),
       JSON_KEYS(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27"'
         )
       ),
       JSON_TYPE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent'
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.decisionLetterSent.approval'
         )
       ),
       SHA2(CAST(iset_case.case_context_json AS CHAR), 256),
       SHA2(
         CAST(
           JSON_SET(
             iset_case.case_context_json,
             '$.applicationDecisionLetters."27".decisionLetterSent',
             JSON_OBJECT('approval', @application_27_approval_sent_at)
           ) AS CHAR
         ),
         256
       ),
       SHA2(
         CAST(
           JSON_REMOVE(
             JSON_SET(
               iset_case.case_context_json,
               '$.applicationDecisionLetters."27".decisionLetterSent',
               JSON_OBJECT('approval', @application_27_approval_sent_at)
             ),
             '$.applicationDecisionLetters."27".decisionLetterSent'
           ) AS CHAR
         ),
         256
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           JSON_SET(
             iset_case.case_context_json,
             '$.applicationDecisionLetters."27".decisionLetterSent',
             JSON_OBJECT('approval', @application_27_approval_sent_at)
           ),
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ),
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109;

SELECT application_lock.application_id,
       application_lock.acquired_at,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 27
 ORDER BY application_lock.expires_at;

SELECT messages.id,
       messages.sender_actor_type,
       messages.sender_staff_profile_id,
       messages.recipient_actor_type,
       messages.recipient_user_id,
       messages.case_id,
       messages.application_id,
       messages.subject,
       messages.status,
       messages.deleted,
       messages.created_at
  FROM messages
 WHERE messages.id = 2640;

SELECT message_signing_request.message_id,
       message_signing_request.signing_request_id,
       signing_request.workflow_name,
       signing_request.case_id,
       signing_request.status,
       signing_request.signed_at,
       signing_request.checklist_doc_type,
       signing_request.created_at,
       signing_request.updated_at
  FROM message_signing_request
  JOIN signing_request
    ON signing_request.id = message_signing_request.signing_request_id
 WHERE message_signing_request.message_id = 2640
 ORDER BY message_signing_request.signing_request_id;

SELECT iset_document.id,
       iset_document.application_id,
       iset_document.case_id,
       iset_document.origin_message_id,
       iset_document.signing_request_id,
       iset_document.source,
       iset_document.status,
       iset_document.document_category,
       iset_document.created_at,
       iset_document.updated_at
  FROM iset_document
 WHERE iset_document.id IN (10383, 10632, 10633, 10634, 10635)
 ORDER BY iset_document.id;
