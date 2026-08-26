-- Make staff-to-applicant secure-message sends durable across a lost HTTP
-- response. The operation claim and its final response are committed in the
-- same transaction as the message and any signing/version state changes.
--
-- This canonical filename/checksum is recorded in iset_migration. Once it has
-- succeeded in a durable environment it is immutable; corrections require a
-- new forward migration. MySQL DDL auto-commits, so the exact CREATE is guarded
-- and the finished shape is checked before the migration can complete.

SET @message_send_operation_base_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'messages'
     AND (
          (column_name = 'id'
           AND LOWER(column_type) = 'int'
           AND is_nullable = 'NO'
           AND LOWER(extra) = 'auto_increment')
       OR (column_name = 'sender_user_id'
           AND LOWER(column_type) = 'int')
       OR (column_name = 'sender_staff_profile_id'
           AND LOWER(column_type) = 'bigint unsigned')
       OR (column_name = 'case_id'
           AND LOWER(column_type) = 'bigint unsigned'
           AND is_nullable = 'NO')
       OR (column_name = 'application_id'
           AND LOWER(column_type) = 'bigint unsigned')
     )
);
SET @ddl := IF(
  @message_send_operation_base_shape_count = 5,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''secure-message idempotency base schema does not match the verified contract'''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE TABLE message_send_operation (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, client_operation_id VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, request_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL, sender_user_id INT NOT NULL, sender_staff_profile_id BIGINT UNSIGNED NULL, case_id BIGINT UNSIGNED NOT NULL, application_id BIGINT UNSIGNED NULL, message_id INT NULL, response_status SMALLINT UNSIGNED NULL, response_json JSON NULL, created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP NULL DEFAULT NULL, PRIMARY KEY (id), UNIQUE KEY uq_message_send_operation_scope (sender_user_id, case_id, client_operation_id), KEY idx_message_send_operation_message (message_id), CONSTRAINT fk_message_send_operation_message FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    'SELECT 1')
    FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND table_type = 'BASE TABLE'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @message_send_operation_column_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND (
          (column_name = 'id' AND LOWER(column_type) = 'bigint unsigned' AND is_nullable = 'NO' AND column_default IS NULL AND LOWER(extra) = 'auto_increment')
       OR (column_name = 'client_operation_id' AND LOWER(column_type) = 'varchar(128)' AND is_nullable = 'NO' AND column_default IS NULL AND character_set_name = 'ascii' AND collation_name = 'ascii_bin' AND LOWER(extra) = '')
       OR (column_name = 'request_sha256' AND LOWER(column_type) = 'char(64)' AND is_nullable = 'NO' AND column_default IS NULL AND character_set_name = 'ascii' AND collation_name = 'ascii_bin' AND LOWER(extra) = '')
       OR (column_name = 'sender_user_id' AND LOWER(column_type) = 'int' AND is_nullable = 'NO' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'sender_staff_profile_id' AND LOWER(column_type) = 'bigint unsigned' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'case_id' AND LOWER(column_type) = 'bigint unsigned' AND is_nullable = 'NO' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'application_id' AND LOWER(column_type) = 'bigint unsigned' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'message_id' AND LOWER(column_type) = 'int' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'response_status' AND LOWER(column_type) = 'smallint unsigned' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'response_json' AND LOWER(column_type) = 'json' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
       OR (column_name = 'created_at' AND LOWER(column_type) = 'timestamp' AND is_nullable = 'YES' AND UPPER(column_default) = 'CURRENT_TIMESTAMP' AND LOWER(extra) IN ('', 'default_generated'))
       OR (column_name = 'completed_at' AND LOWER(column_type) = 'timestamp' AND is_nullable = 'YES' AND column_default IS NULL AND LOWER(extra) = '')
     )
);
SET @message_send_operation_total_column_count := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
);
SET @message_send_operation_unique_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'uq_message_send_operation_scope'
     AND non_unique = 0
     AND sub_part IS NULL
     AND UPPER(index_type) = 'BTREE'
     AND is_visible = 'YES'
     AND expression IS NULL
     AND (
          (seq_in_index = 1 AND column_name = 'sender_user_id')
       OR (seq_in_index = 2 AND column_name = 'case_id')
       OR (seq_in_index = 3 AND column_name = 'client_operation_id')
     )
);
SET @message_send_operation_unique_total_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'uq_message_send_operation_scope'
);
SET @message_send_operation_primary_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'PRIMARY'
     AND non_unique = 0
     AND seq_in_index = 1
     AND column_name = 'id'
     AND sub_part IS NULL
     AND UPPER(index_type) = 'BTREE'
     AND is_visible = 'YES'
     AND expression IS NULL
);
SET @message_send_operation_primary_total_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'PRIMARY'
);
SET @message_send_operation_message_index_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'idx_message_send_operation_message'
     AND non_unique = 1
     AND seq_in_index = 1
     AND column_name = 'message_id'
     AND sub_part IS NULL
     AND UPPER(index_type) = 'BTREE'
     AND is_visible = 'YES'
     AND expression IS NULL
);
SET @message_send_operation_message_index_total_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND index_name = 'idx_message_send_operation_message'
);
SET @message_send_operation_total_index_row_count := (
  SELECT COUNT(*)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
);
SET @message_send_operation_total_index_name_count := (
  SELECT COUNT(DISTINCT index_name)
    FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
);
SET @message_send_operation_fk_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_schema = rc.constraint_schema
     AND kcu.table_name = rc.table_name
     AND kcu.constraint_name = rc.constraint_name
   WHERE rc.constraint_schema = DATABASE()
     AND rc.table_name = 'message_send_operation'
     AND rc.constraint_name = 'fk_message_send_operation_message'
     AND rc.delete_rule = 'CASCADE'
     AND rc.update_rule IN ('NO ACTION', 'RESTRICT')
     AND kcu.column_name = 'message_id'
     AND kcu.referenced_table_schema = DATABASE()
     AND kcu.referenced_table_name = 'messages'
     AND kcu.referenced_column_name = 'id'
);
SET @message_send_operation_fk_total_count := (
  SELECT COUNT(*)
    FROM information_schema.key_column_usage
   WHERE constraint_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND constraint_name = 'fk_message_send_operation_message'
);
SET @message_send_operation_total_constraint_count := (
  SELECT COUNT(*)
    FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE()
     AND table_name = 'message_send_operation'
);
SET @message_send_operation_table_shape_count := (
  SELECT COUNT(*)
    FROM information_schema.tables
   WHERE table_schema = DATABASE()
     AND table_name = 'message_send_operation'
     AND table_type = 'BASE TABLE'
     AND UPPER(engine) = 'INNODB'
     AND table_collation = 'utf8mb4_unicode_ci'
);
SET @ddl := IF(
  @message_send_operation_column_shape_count = 12
  AND @message_send_operation_total_column_count = 12
  AND @message_send_operation_unique_shape_count = 3
  AND @message_send_operation_unique_total_count = 3
  AND @message_send_operation_primary_shape_count = 1
  AND @message_send_operation_primary_total_count = 1
  AND @message_send_operation_message_index_shape_count = 1
  AND @message_send_operation_message_index_total_count = 1
  AND @message_send_operation_total_index_row_count = 5
  AND @message_send_operation_total_index_name_count = 3
  AND @message_send_operation_fk_shape_count = 1
  AND @message_send_operation_fk_total_count = 1
  AND @message_send_operation_total_constraint_count = 3
  AND @message_send_operation_table_shape_count = 1,
  'SELECT 1',
  'SIGNAL SQLSTATE ''45000'' SET MESSAGE_TEXT = ''secure-message idempotency table does not match the target contract'''
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
