-- Independent read-only verification for the guarded application 27 repair.

SELECT DATABASE(),
       @@hostname,
       @@port,
       CURRENT_USER(),
       VERSION(),
       @@session.time_zone,
       @@global.time_zone,
       @@system_time_zone;

SELECT iset_case.id,
       iset_case.status,
       iset_case.lifecycle_status,
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
       SHA2(CAST(iset_case.case_context_json AS CHAR), 256),
       SHA2(
         CAST(
           JSON_REMOVE(
             iset_case.case_context_json,
             '$.applicationDecisionLetters."27".decisionLetterSent'
           ) AS CHAR
         ),
         256
       ),
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109
   AND iset_case.status = 'initiated'
   AND iset_case.lifecycle_status = 'initiated'
   AND JSON_TYPE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent'
         )
       ) = 'OBJECT'
   AND JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ) = '2026-08-11T15:08:14.000Z'
   AND SHA2(CAST(iset_case.case_context_json AS CHAR), 256) =
       'eb277b1fe642cc53c05fe335082decf1ee7e4fce2be68c0106af366d3b8eb937'
   AND SHA2(
         CAST(
           JSON_REMOVE(
             iset_case.case_context_json,
             '$.applicationDecisionLetters."27".decisionLetterSent'
           ) AS CHAR
         ),
         256
       ) = '83342e03e54a138b2b3bc921574f91158aa8917561702e987b8e6a77b4d6eb30';

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
   AND iset_application.case_id = 109
   AND iset_application.client_id = 91
   AND iset_application.status = 'approved'
   AND iset_application.lifecycle_status = 'decision_recorded'
   AND iset_application.decision_outcome = 'approved'
   AND iset_application.awaiting_reason = 'none'
   AND iset_application.closure_reason IS NULL
   AND iset_application.row_version = 82
   AND iset_application.updated_at = '2026-08-21 17:28:04';

SELECT application_lock.application_id,
       application_lock.acquired_at,
       application_lock.expires_at
  FROM application_lock
 WHERE application_lock.application_id = 27;

SELECT messages.id,
       messages.case_id,
       messages.application_id,
       messages.subject,
       messages.status,
       messages.deleted,
       messages.created_at
  FROM messages
 WHERE messages.id = 2640
   AND messages.case_id = 109
   AND messages.application_id = 27
   AND messages.subject = 'Letter of Approval'
   AND messages.status = 'replied'
   AND messages.deleted = 0
   AND messages.created_at = '2026-08-11 15:08:12';

SELECT message_signing_request.message_id,
       message_signing_request.signing_request_id,
       signing_request.workflow_name,
       signing_request.status,
       signing_request.signed_at,
       signing_request.checklist_doc_type
  FROM message_signing_request
  JOIN signing_request
    ON signing_request.id = message_signing_request.signing_request_id
 WHERE message_signing_request.message_id = 2640
   AND message_signing_request.signing_request_id IN (187, 188, 189)
 ORDER BY message_signing_request.signing_request_id;

SELECT iset_document.id,
       iset_document.application_id,
       iset_document.case_id,
       iset_document.origin_message_id,
       iset_document.signing_request_id,
       iset_document.source,
       iset_document.status,
       iset_document.document_category,
       iset_document.created_at
  FROM iset_document
 WHERE iset_document.id IN (10383, 10632, 10633, 10634, 10635)
   AND iset_document.application_id = 27
   AND iset_document.case_id = 109
 ORDER BY iset_document.id;
