-- Read-only PROD function capability probe for the approval-marker inventory.
-- This reads no application data and performs no mutation.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT CONCAT('$.applicationDecisionLetters."', 27, '".decisionLetterSent.approval'),
       JSON_UNQUOTE(
         JSON_EXTRACT(
           '{"applicationDecisionLetters":{"27":{"decisionLetterSent":{"approval":"ok"}}}}',
           CONCAT('$.applicationDecisionLetters."', 27, '".decisionLetterSent.approval')
         )
       ),
       COUNT(*);
