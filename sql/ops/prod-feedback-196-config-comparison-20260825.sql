-- PROD READ-ONLY configuration comparison for feedback #196.
--
-- Exact target identity and full live DDL for both tables must be proved in
-- the current task immediately before this artifact is executed.  This file
-- contains no mutation, lock, procedure, or temporary object.

SELECT
  `workflow`.`id`,
  `workflow`.`name`,
  `workflow`.`status`,
  `workflow`.`workflow_type`,
  `workflow`.`document_type`,
  `workflow`.`created_at`,
  `workflow`.`updated_at`
FROM `workflow`
ORDER BY `workflow`.`id`;

SELECT
  `iset_migration`.`id`,
  `iset_migration`.`filename`,
  `iset_migration`.`checksum`,
  `iset_migration`.`applied_at`,
  `iset_migration`.`duration_ms`,
  `iset_migration`.`success`
FROM `iset_migration`
ORDER BY `iset_migration`.`id`;
