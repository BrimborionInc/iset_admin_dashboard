-- Read-only PROD inventory of application approval-letter sends and every
-- marker form currently recognized by the application workflow.
--
-- Run only after exact PROD identity, full live metadata proof for every table
-- below, and live JSON_EXTRACT/JSON_UNQUOTE/CONCAT/COUNT function proof.

SELECT messages.id,
       messages.case_id,
       messages.application_id,
       messages.deleted,
       messages.created_at,
       signing_request.id,
       signing_request.status,
       signing_request.created_at,
       iset_document.id,
       iset_document.action_plan_id,
       iset_document.status,
       JSON_UNQUOTE(JSON_EXTRACT(iset_document.metadata, '$.decision_letter_owner')),
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       (
         SELECT COUNT(*)
           FROM iset_application `case_application`
          WHERE `case_application`.case_id = iset_case.id
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           CONCAT(
             '$.applicationDecisionLetters."',
             iset_application.id,
             '".decisionLetterSent.approval'
           )
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           CONCAT(
             '$.applicationDecisionLetters."',
             iset_application.id,
             '".decision_letter_sent.approval'
           )
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           CONCAT(
             '$.applicationDecisionLetters."',
             iset_application.id,
             '".decisionLetterSentType'
           )
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           CONCAT(
             '$.applicationDecisionLetters."',
             iset_application.id,
             '".decisionLetterSentAt'
           )
         )
       ),
       JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.decisionLetterSent.approval')),
       JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.decision_letter_sent.approval')),
       JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.decisionLetterSentType')),
       JSON_UNQUOTE(JSON_EXTRACT(iset_case.case_context_json, '$.decisionLetterSentAt'))
  FROM signing_request
  JOIN message_signing_request
    ON message_signing_request.signing_request_id = signing_request.id
  JOIN messages
    ON messages.id = message_signing_request.message_id
  JOIN iset_application
    ON iset_application.id = messages.application_id
   AND iset_application.case_id = messages.case_id
  JOIN iset_case
    ON iset_case.id = messages.case_id
  LEFT JOIN iset_document
    ON iset_document.case_id = messages.case_id
   AND iset_document.application_id = messages.application_id
   AND iset_document.document_category COLLATE utf8mb4_unicode_ci =
       signing_request.checklist_doc_type
   AND iset_document.created_at = signing_request.created_at
 WHERE signing_request.checklist_doc_type = 'assessment_approval_letter'
 ORDER BY messages.created_at,
          messages.id,
          signing_request.id,
          iset_document.id;
