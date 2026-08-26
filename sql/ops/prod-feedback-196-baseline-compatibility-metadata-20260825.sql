-- PROD metadata-only preflight for feedback #196 signed-baseline compatibility.
-- No ordinary read, mutation, lock, procedure, or temporary object is present.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE `cfa_series`;
SHOW FULL COLUMNS FROM `cfa_series`;
SHOW INDEX FROM `cfa_series`;

SHOW CREATE TABLE `cfa_version`;
SHOW FULL COLUMNS FROM `cfa_version`;
SHOW INDEX FROM `cfa_version`;

SHOW CREATE TABLE `funding_overview_series`;
SHOW FULL COLUMNS FROM `funding_overview_series`;
SHOW INDEX FROM `funding_overview_series`;

SHOW CREATE TABLE `funding_overview_version`;
SHOW FULL COLUMNS FROM `funding_overview_version`;
SHOW INDEX FROM `funding_overview_version`;

SHOW CREATE TABLE `iset_case`;
SHOW FULL COLUMNS FROM `iset_case`;
SHOW INDEX FROM `iset_case`;

SHOW CREATE TABLE `client`;
SHOW FULL COLUMNS FROM `client`;
SHOW INDEX FROM `client`;

SHOW CREATE TABLE `user`;
SHOW FULL COLUMNS FROM `user`;
SHOW INDEX FROM `user`;
