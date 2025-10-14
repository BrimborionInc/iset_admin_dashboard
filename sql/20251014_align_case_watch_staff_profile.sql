-- Align legacy iset_case_watch schema with staff-profile based implementation.
-- Safely drops the old user_id foreign key/index when present, renames the column,
-- and reinstates indexes/constraints pointing at staff_profiles.

SET @schema := DATABASE();

-- Drop legacy foreign key if it exists.
SET @drop_fk_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE BINARY CONSTRAINT_SCHEMA = BINARY @schema
         AND BINARY CONSTRAINT_NAME = BINARY 'fk_case_watch_user'
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
    ),
    'ALTER TABLE `iset_case_watch` DROP FOREIGN KEY `fk_case_watch_user`;',
    'DO 0;'
  )
);
PREPARE stmt FROM @drop_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop legacy index if present.
SET @drop_idx_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.STATISTICS
       WHERE BINARY TABLE_SCHEMA = BINARY @schema
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
         AND BINARY INDEX_NAME = BINARY 'idx_case_watch_user'
    ),
    'ALTER TABLE `iset_case_watch` DROP INDEX `idx_case_watch_user`;',
    'DO 0;'
  )
);
PREPARE stmt FROM @drop_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename user_id -> staff_profile_id when the legacy column exists.
SET @rename_col_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.COLUMNS
       WHERE BINARY TABLE_SCHEMA = BINARY @schema
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
         AND BINARY COLUMN_NAME = BINARY 'user_id'
    ),
    'ALTER TABLE `iset_case_watch` CHANGE COLUMN `user_id` `staff_profile_id` BIGINT UNSIGNED NOT NULL;',
    'DO 0;'
  )
);
PREPARE stmt FROM @rename_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure type is BIGINT UNSIGNED even if column already existed.
SET @modify_col_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.COLUMNS
       WHERE BINARY TABLE_SCHEMA = BINARY @schema
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
         AND BINARY COLUMN_NAME = BINARY 'staff_profile_id'
         AND LOWER(COLUMN_TYPE) NOT LIKE 'bigint%unsigned%'
    ),
    'ALTER TABLE `iset_case_watch` MODIFY COLUMN `staff_profile_id` BIGINT UNSIGNED NOT NULL;',
    'DO 0;'
  )
);
PREPARE stmt FROM @modify_col_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure the staff-profile foreign key/index exist.
SET @add_idx_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.STATISTICS
       WHERE BINARY TABLE_SCHEMA = BINARY @schema
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
         AND BINARY INDEX_NAME = BINARY 'idx_case_watch_staff'
    ),
    'DO 0;',
    'ALTER TABLE `iset_case_watch` ADD INDEX `idx_case_watch_staff` (`staff_profile_id`, `created_at`);'
  )
);
PREPARE stmt FROM @add_idx_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_fk_sql := (
  SELECT IF(
    EXISTS (
      SELECT 1
        FROM information_schema.REFERENTIAL_CONSTRAINTS
       WHERE BINARY CONSTRAINT_SCHEMA = BINARY @schema
         AND BINARY TABLE_NAME = BINARY 'iset_case_watch'
         AND BINARY CONSTRAINT_NAME = BINARY 'fk_case_watch_staff'
    ),
    'DO 0;',
    'ALTER TABLE `iset_case_watch` ADD CONSTRAINT `fk_case_watch_staff` FOREIGN KEY (`staff_profile_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE;'
  )
);
PREPARE stmt FROM @add_fk_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
