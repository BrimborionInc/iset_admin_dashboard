-- Metadata-only PROD preflight for the staff profile linked from feedback #198.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SHOW CREATE TABLE staff_profiles;
SHOW FULL COLUMNS FROM staff_profiles;
SHOW INDEX FROM staff_profiles;
