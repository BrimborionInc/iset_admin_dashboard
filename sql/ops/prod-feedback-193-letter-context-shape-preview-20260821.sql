-- Read-only PROD structural check for the application-scoped decision-letter
-- context needed by the one-record marker repair. This returns JSON types and
-- key names only; it does not expose context values or mutate data.

SELECT iset_case.id,
       JSON_TYPE(iset_case.case_context_json),
       JSON_TYPE(
         JSON_EXTRACT(
           iset_case.case_context_json,
           '$.applicationDecisionLetters'
         )
       ),
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
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109;

SELECT iset_application.id,
       iset_application.case_id,
       iset_application.status,
       iset_application.lifecycle_status,
       iset_application.decision_outcome,
       iset_application.row_version,
       iset_application.updated_at
  FROM iset_application
 WHERE iset_application.id = 27
   AND iset_application.case_id = 109;
