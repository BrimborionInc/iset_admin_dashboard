-- Metadata-only continuation: funding, signing, and acting staff.
SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();
SHOW CREATE TABLE funding_overview_version;
SHOW CREATE TABLE signing_request;
SHOW CREATE TABLE staff_profiles;
SHOW PROCEDURE STATUS
 WHERE Db = 'iset_intake'
   AND Name IN (
     'prod_shelley_appeal_open_20260903',
     'prod_shelley_appeal_recovery_20260903'
   );
