-- Adds follow-up support to case notes and links them with reminders.
-- Guard clauses make the script safe to run repeatedly.

SET @column_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case_note'
     AND COLUMN_NAME = 'follow_up_at'
);

SET @add_follow_up_sql := IF(
  @column_exists = 0,
  'ALTER TABLE `iset_case_note` ADD COLUMN `follow_up_at` DATETIME NULL AFTER `is_pinned`',
  'SELECT 1'
);

PREPARE stmt FROM @add_follow_up_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @column_exists := (
  SELECT COUNT(*)
    FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case_note'
     AND COLUMN_NAME = 'reminder_id'
);

SET @add_reminder_sql := IF(
  @column_exists = 0,
  'ALTER TABLE `iset_case_note` ADD COLUMN `reminder_id` BIGINT UNSIGNED NULL AFTER `follow_up_at`',
  'SELECT 1'
);

PREPARE stmt FROM @add_reminder_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @index_exists := (
  SELECT COUNT(*)
    FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'iset_case_note'
     AND INDEX_NAME = 'idx_case_note_follow_up'
);

SET @add_index_sql := IF(
  @index_exists = 0,
  'ALTER TABLE `iset_case_note` ADD KEY `idx_case_note_follow_up` (`case_id`, `follow_up_at`)',
  'SELECT 1'
);

PREPARE stmt FROM @add_index_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @constraint_name := 'fk_case_note_reminder';
SET @constraint_schema := DATABASE();
SELECT COUNT(*) INTO @constraint_exists
  FROM information_schema.TABLE_CONSTRAINTS
 WHERE CONSTRAINT_SCHEMA = @constraint_schema
   AND TABLE_NAME = 'iset_case_note'
   AND CONSTRAINT_NAME = @constraint_name;

SET @add_constraint_sql := IF(
  @constraint_exists = 0,
  'ALTER TABLE `iset_case_note` ADD CONSTRAINT `fk_case_note_reminder` FOREIGN KEY (`reminder_id`) REFERENCES `iset_case_reminder`(`id`) ON DELETE SET NULL',
  'SELECT 1 AS constraint_exists'
);

PREPARE stmt FROM @add_constraint_sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
