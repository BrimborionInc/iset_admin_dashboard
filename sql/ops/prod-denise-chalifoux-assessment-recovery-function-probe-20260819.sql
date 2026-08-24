-- PROD metadata/function capability probe for the Denise Chalifoux assessment
-- recovery. This file contains no application-data reads or mutations.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT JSON_REMOVE(JSON_OBJECT('x', 1), '$.x'),
       JSON_SET(JSON_OBJECT('x', 1), '$.y', 2),
       JSON_ARRAY(1, 2),
       JSON_TYPE(JSON_OBJECT('x', 1)),
       JSON_LENGTH(JSON_OBJECT('x', 1)),
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP(3),
       DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE),
       ROW_COUNT();

SHOW PROCEDURE STATUS
 WHERE Db = 'iset_intake'
   AND Name = 'prod_denise_chalifoux_assessment_recovery_20260819';
