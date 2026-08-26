-- PROD read-only summary of pending signing participant compatibility.
-- Exact target identity and full live DDL for every identifier were captured
-- immediately before this artifact was run.

SELECT COUNT(signing_request.id),
       SUM(client.applicant_cognito_sub IS NULL),
       SUM(client.applicant_cognito_sub IS NOT NULL AND `user`.id IS NULL),
       SUM(`user`.id IS NOT NULL AND signing_request.participant_user_id = `user`.id),
       SUM(`user`.id IS NOT NULL AND signing_request.participant_user_id <> `user`.id)
  FROM signing_request
  JOIN iset_case
    ON iset_case.id = signing_request.case_id
  LEFT JOIN client
    ON client.id = iset_case.client_id
  LEFT JOIN `user`
    ON `user`.cognito_sub = client.applicant_cognito_sub
 WHERE signing_request.status IN ('pending', 'viewed');
