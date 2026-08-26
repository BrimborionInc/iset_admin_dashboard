-- PROD metadata-only continuation for feedback #196 participant resolution.
-- No ordinary read, mutation, lock, procedure, or temporary object is present.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE `client`;
SHOW FULL COLUMNS FROM `client`;
SHOW INDEX FROM `client`;

SHOW CREATE TABLE `user`;
SHOW FULL COLUMNS FROM `user`;
SHOW INDEX FROM `user`;
