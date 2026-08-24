-- Narrow read-only PROD decision-letter marker check for feedback #193.
--
-- Execute only after current-task PROD identity proof, live full metadata for
-- iset_case, and successful current-task JSON_EXTRACT/JSON_UNQUOTE function
-- probes. Validate the finished statement immediately before execution.

SELECT iset_case.id,
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
       iset_case.updated_at
  FROM iset_case
 WHERE iset_case.id = 109;
