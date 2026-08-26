-- PROD read-only pending signing participant compatibility inventory.
-- Exact target identity and full live DDL for signing_request, iset_case,
-- client, and user were captured immediately before this artifact was run.

SELECT signing_request.id,
       signing_request.workflow_id,
       signing_request.workflow_name,
       signing_request.workflow_type,
       signing_request.checklist_doc_type,
       signing_request.status,
       signing_request.case_id,
       iset_case.client_id,
       signing_request.participant_user_id,
       `user`.id,
       client.applicant_cognito_sub IS NULL,
       `user`.id IS NULL,
       signing_request.participant_user_id <=> `user`.id,
       signing_request.created_at
  FROM signing_request
  JOIN iset_case
    ON iset_case.id = signing_request.case_id
  LEFT JOIN client
    ON client.id = iset_case.client_id
  LEFT JOIN `user`
    ON `user`.cognito_sub = client.applicant_cognito_sub
 WHERE signing_request.status IN ('pending', 'viewed')
 ORDER BY signing_request.id;
