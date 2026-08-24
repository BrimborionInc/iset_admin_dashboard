-- Read-only PROD discovery for message-linked signing-request document types.
-- Run only after exact PROD identity and full live metadata proof for messages,
-- message_signing_request, and signing_request.

SELECT signing_request.checklist_doc_type,
       signing_request.workflow_name,
       COUNT(*)
  FROM signing_request
  JOIN message_signing_request
    ON message_signing_request.signing_request_id = signing_request.id
  JOIN messages
    ON messages.id = message_signing_request.message_id
 WHERE messages.application_id IS NOT NULL
 GROUP BY signing_request.checklist_doc_type,
          signing_request.workflow_name
 ORDER BY signing_request.checklist_doc_type,
          signing_request.workflow_name;
