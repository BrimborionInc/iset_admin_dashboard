-- Read-only dependency inventory generated exclusively from live foreign-key metadata.
-- Target identifiers:
--   imported Susan client 20
--   imported Susan case 20
--   current Susan application/submission 103
--   imported Susan applicant user 23

SET SESSION group_concat_max_len = 1048576;

SELECT GROUP_CONCAT(
         CONCAT(
           'SELECT ',
           QUOTE(CONCAT(referenced_table_name, ':', table_name, '.', column_name)),
           ' AS reference_path, COUNT(*) AS row_count FROM `',
           REPLACE(table_name, '`', '``'),
           '` WHERE `',
           REPLACE(column_name, '`', '``'),
           '` = ',
           CASE referenced_table_name
             WHEN 'client' THEN '20'
             WHEN 'iset_case' THEN '20'
             WHEN 'iset_application' THEN '103'
             WHEN 'iset_application_submission' THEN '103'
             WHEN 'user' THEN '23'
           END
         )
         ORDER BY referenced_table_name, table_name, column_name
         SEPARATOR ' UNION ALL '
       )
  INTO @dependency_sql
  FROM information_schema.key_column_usage
 WHERE constraint_schema = DATABASE()
   AND referenced_table_name IN (
     'client',
     'iset_case',
     'iset_application',
     'iset_application_submission',
     'user'
   )
   AND referenced_column_name = 'id';

SELECT @dependency_sql AS reviewed_generated_sql;

PREPARE dependency_statement FROM @dependency_sql;
EXECUTE dependency_statement;
DEALLOCATE PREPARE dependency_statement;
