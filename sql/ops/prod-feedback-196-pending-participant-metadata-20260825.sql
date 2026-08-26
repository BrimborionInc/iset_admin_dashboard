-- PROD metadata-only discovery for pending signing participant compatibility.
-- This artifact contains no ordinary table read or mutation.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
  FROM information_schema.TABLES
 WHERE TABLE_SCHEMA = DATABASE()
   AND TABLE_NAME IN ('client', 'iset_case', 'signing_request', 'user')
 ORDER BY TABLE_NAME;

SHOW CREATE TABLE client;
SHOW FULL COLUMNS FROM client;
SHOW CREATE TABLE iset_case;
SHOW FULL COLUMNS FROM iset_case;
SHOW CREATE TABLE signing_request;
SHOW FULL COLUMNS FROM signing_request;
SHOW CREATE TABLE `user`;
SHOW FULL COLUMNS FROM `user`;
