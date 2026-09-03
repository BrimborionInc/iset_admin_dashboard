-- Metadata-only PROD proof before checking that the hotfix announcement is gone.
SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();
SHOW CREATE TABLE iset_runtime_config;
SHOW FULL COLUMNS FROM iset_runtime_config;
