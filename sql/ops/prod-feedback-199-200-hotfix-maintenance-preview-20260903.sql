-- Read-only verification of the scoped PROD hotfix announcement.
-- Run only after the exact PROD identity and live iset_runtime_config DDL
-- have been proved.

SELECT DATABASE(), @@hostname, @@port, CURRENT_USER(), VERSION();

SELECT
  iset_runtime_config.scope,
  iset_runtime_config.k,
  iset_runtime_config.v,
  iset_runtime_config.updated_at
FROM iset_runtime_config
WHERE iset_runtime_config.scope = 'runtime'
  AND iset_runtime_config.k = 'service.announcement';
