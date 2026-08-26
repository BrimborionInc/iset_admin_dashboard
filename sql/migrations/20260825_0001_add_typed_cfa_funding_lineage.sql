-- Add typed ownership to version rows while preserving the existing
-- case/template series and its global version sequence.
-- Historical rows are deliberately not backfilled: NULL means unresolved legacy
-- lineage, and runtime compatibility continues to read their JSON snapshots.
--
-- This canonical filename/checksum is recorded in iset_migration. Once it has
-- succeeded in a durable environment it is immutable; corrections require a new
-- forward migration. MySQL DDL auto-commits, so every change below is guarded to
-- make a retry after a partially applied, failed attempt safe.

SET @typed_lineage_base_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND (
          (table_name = 'cfa_version'
           AND column_name = 'series_id'
           AND LOWER(column_type) = 'int')
       OR (table_name = 'funding_overview_version'
           AND column_name = 'series_id'
           AND LOWER(column_type) = 'int')
       OR (table_name = 'iset_application'
           AND column_name = 'id'
           AND LOWER(column_type) = 'bigint unsigned')
       OR (table_name = 'iset_case_action_plan'
           AND column_name = 'id'
           AND LOWER(column_type) = 'bigint unsigned')
     )
);
SET @ddl := IF(
  @typed_lineage_base_shape_count = 4,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''typed CFA/Funding lineage base schema does not match the verified contract'''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE cfa_version ADD COLUMN application_id BIGINT UNSIGNED NULL AFTER series_id',
    'SELECT 1')
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND column_name = 'application_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE cfa_version ADD COLUMN action_plan_id BIGINT UNSIGNED NULL AFTER application_id',
    'SELECT 1')
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND column_name = 'action_plan_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE funding_overview_version ADD COLUMN application_id BIGINT UNSIGNED NULL AFTER series_id',
    'SELECT 1')
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'funding_overview_version'
     AND column_name = 'application_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @typed_lineage_column_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND LOWER(column_type) = 'bigint unsigned'
     AND is_nullable = 'YES'
     AND (
          (table_name = 'cfa_version' AND column_name = 'application_id')
       OR (table_name = 'cfa_version' AND column_name = 'action_plan_id')
       OR (table_name = 'funding_overview_version' AND column_name = 'application_id')
     )
);
SET @ddl := IF(
  @typed_lineage_column_shape_count = 3,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''typed CFA/Funding lineage columns do not match the nullable BIGINT UNSIGNED contract'''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_cfa_version_application ON cfa_version (application_id)',
    'SELECT 1')
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND index_name = 'idx_cfa_version_application'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_cfa_version_action_plan ON cfa_version (action_plan_id)',
    'SELECT 1')
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND index_name = 'idx_cfa_version_action_plan'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_funding_overview_version_application ON funding_overview_version (application_id)',
    'SELECT 1')
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'funding_overview_version'
     AND index_name = 'idx_funding_overview_version_application'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
    'SELECT 1')
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND constraint_name = 'fk_cfa_version_application'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE cfa_version ADD CONSTRAINT fk_cfa_version_action_plan FOREIGN KEY (action_plan_id) REFERENCES iset_case_action_plan (id) ON DELETE RESTRICT',
    'SELECT 1')
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'cfa_version'
     AND constraint_name = 'fk_cfa_version_action_plan'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE funding_overview_version ADD CONSTRAINT fk_funding_overview_version_application FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT',
    'SELECT 1')
    FROM information_schema.referential_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'funding_overview_version'
     AND constraint_name = 'fk_funding_overview_version_application'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @typed_lineage_index_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND non_unique = 1
     AND seq_in_index = 1
     AND (
          (table_name = 'cfa_version'
           AND index_name = 'idx_cfa_version_application'
           AND column_name = 'application_id')
       OR (table_name = 'cfa_version'
           AND index_name = 'idx_cfa_version_action_plan'
           AND column_name = 'action_plan_id')
       OR (table_name = 'funding_overview_version'
           AND index_name = 'idx_funding_overview_version_application'
           AND column_name = 'application_id')
     )
);
SET @typed_lineage_fk_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = rc.constraint_schema
     AND kcu.table_name = rc.table_name
     AND kcu.constraint_name = rc.constraint_name
   WHERE rc.constraint_schema = DATABASE()
     AND rc.delete_rule = 'RESTRICT'
     AND (
          (rc.table_name = 'cfa_version'
           AND rc.constraint_name = 'fk_cfa_version_application'
           AND kcu.column_name = 'application_id'
           AND kcu.referenced_table_name = 'iset_application'
           AND kcu.referenced_column_name = 'id')
       OR (rc.table_name = 'cfa_version'
           AND rc.constraint_name = 'fk_cfa_version_action_plan'
           AND kcu.column_name = 'action_plan_id'
           AND kcu.referenced_table_name = 'iset_case_action_plan'
           AND kcu.referenced_column_name = 'id')
       OR (rc.table_name = 'funding_overview_version'
           AND rc.constraint_name = 'fk_funding_overview_version_application'
           AND kcu.column_name = 'application_id'
           AND kcu.referenced_table_name = 'iset_application'
           AND kcu.referenced_column_name = 'id')
     )
);
SET @ddl := IF(
  @typed_lineage_index_shape_count = 3
  AND @typed_lineage_fk_shape_count = 3,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''typed CFA/Funding lineage constraints do not match the target contract'''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
