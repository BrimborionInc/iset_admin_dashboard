-- PROD READ-ONLY signing-workflow usage inventory for feedback #196.
--
-- AWS account, database identity, and full live DDL for `workflow` and
-- `signing_request` must be proved immediately before this statement runs.
-- This file contains no mutation, lock, procedure, or temporary object.

SELECT
  workflow.id,
  workflow.name,
  workflow.status,
  workflow.workflow_type,
  workflow.document_type,
  COUNT(signing_request.id),
  MIN(signing_request.created_at),
  MAX(signing_request.created_at)
FROM workflow
LEFT JOIN signing_request
  ON signing_request.workflow_id = workflow.id
WHERE workflow.workflow_type IN ('consent-no-prefill', 'consent-cm-prefill')
GROUP BY
  workflow.id,
  workflow.name,
  workflow.status,
  workflow.workflow_type,
  workflow.document_type
ORDER BY workflow.id;
