-- PROD function capability probe for feedback #193 triage.
-- This file reads no application or feedback data and performs no mutation.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT JSON_EXTRACT('{"probe":"ok"}', '$.probe'),
       JSON_UNQUOTE(JSON_EXTRACT('{"probe":"ok"}', '$.probe'));
