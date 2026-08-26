-- PROD READ-ONLY pending signing-type inventory for feedback #196.
--
-- AWS account, database identity, and full live `signing_request` DDL must be
-- proved immediately before this statement runs. This file contains no
-- mutation, lock, procedure, or temporary object.

SELECT
  signing_request.workflow_id,
  signing_request.workflow_name,
  signing_request.status,
  signing_request.checklist_doc_type,
  COUNT(signing_request.id),
  MIN(signing_request.created_at),
  MAX(signing_request.created_at)
FROM signing_request
WHERE signing_request.status IN ('pending', 'viewed')
GROUP BY
  signing_request.workflow_id,
  signing_request.workflow_name,
  signing_request.status,
  signing_request.checklist_doc_type
ORDER BY
  signing_request.workflow_id,
  signing_request.status,
  signing_request.checklist_doc_type;
