-- Runtime processes no longer alter this enum. Canonical migration tooling owns the change.
SET @esdc_prepared_enum_sql = IF(
  EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'esdc_participant_submission_history'
       AND column_name = 'event_type'
       AND column_type NOT LIKE '%''prepared''%'
  ),
  'ALTER TABLE esdc_participant_submission_history MODIFY COLUMN event_type ENUM(''validated'',''ready'',''prepared'',''submitted'',''accepted'',''rejected'') NOT NULL',
  'SELECT 1'
);
PREPARE esdc_prepared_enum_stmt FROM @esdc_prepared_enum_sql;
EXECUTE esdc_prepared_enum_stmt;
DEALLOCATE PREPARE esdc_prepared_enum_stmt;

