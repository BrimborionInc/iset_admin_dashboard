-- Read-only PROD inventory of durable approval-letter documents and their
-- explicit application/intervention ownership metadata.

SELECT iset_document.id,
       iset_document.case_id,
       iset_document.application_id,
       iset_document.action_plan_id,
       iset_document.status,
       JSON_UNQUOTE(JSON_EXTRACT(iset_document.metadata, '$.decision_letter_owner')),
       JSON_UNQUOTE(JSON_EXTRACT(iset_document.metadata, '$.intervention_id')),
       iset_document.created_at
  FROM iset_document
 WHERE iset_document.document_category = 'assessment_approval_letter'
 ORDER BY iset_document.created_at,
          iset_document.id;
