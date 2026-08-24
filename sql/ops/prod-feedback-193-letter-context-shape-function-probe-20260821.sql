-- Read-only PROD function probe for the structural decision-letter check.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT JSON_TYPE(JSON_EXTRACT('{"probe":{"key":true}}', '$.probe')),
       JSON_KEYS(JSON_EXTRACT('{"probe":{"key":true}}', '$.probe'));
