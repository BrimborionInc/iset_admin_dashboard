-- Read-only PROD function probe for the application 27 marker repair.
-- This reads no application data and performs no mutation.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SET @approval_marker_probe_context := '{"applicationDecisionLetters":{"27":{"decisionLetterDrafts":{"approval":"keep"}}}}';
SET @approval_marker_probe_value := '2026-08-11T15:08:14.000Z';

SELECT JSON_SET(
         @approval_marker_probe_context,
         '$.applicationDecisionLetters."27".decisionLetterSent',
         JSON_OBJECT('approval', @approval_marker_probe_value)
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           JSON_SET(
             @approval_marker_probe_context,
             '$.applicationDecisionLetters."27".decisionLetterSent',
             JSON_OBJECT('approval', @approval_marker_probe_value)
           ),
           '$.applicationDecisionLetters."27".decisionLetterSent.approval'
         )
       ),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           JSON_SET(
             @approval_marker_probe_context,
             '$.applicationDecisionLetters."27".decisionLetterSent',
             JSON_OBJECT('approval', @approval_marker_probe_value)
           ),
           '$.applicationDecisionLetters."27".decisionLetterDrafts.approval'
         )
       ),
       SHA2(CAST(@approval_marker_probe_context AS CHAR), 256),
       SHA2(
         CAST(
           JSON_SET(
             @approval_marker_probe_context,
             '$.applicationDecisionLetters."27".decisionLetterSent',
             JSON_OBJECT('approval', @approval_marker_probe_value)
           ) AS CHAR
         ),
         256
       ),
       JSON_REMOVE(
         JSON_SET(
           @approval_marker_probe_context,
           '$.applicationDecisionLetters."27".decisionLetterSent',
           JSON_OBJECT('approval', @approval_marker_probe_value)
         ),
         '$.applicationDecisionLetters."27".decisionLetterSent'
       ),
       ROW_COUNT();
