SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE iset_case_conflict_declaration ADD COLUMN resolution_outcome VARCHAR(32) NULL AFTER revoked_reason',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND column_name = 'resolution_outcome'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE iset_case_conflict_declaration ADD COLUMN resolved_at DATETIME NULL AFTER resolution_outcome',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND column_name = 'resolved_at'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE iset_case_conflict_declaration ADD COLUMN resolved_by_staff_profile_id BIGINT UNSIGNED NULL AFTER resolved_at',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND column_name = 'resolved_by_staff_profile_id'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE iset_case_conflict_declaration ADD COLUMN resolution_note TEXT NULL AFTER resolved_by_staff_profile_id',
    'SELECT 1')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND column_name = 'resolution_note'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX idx_case_conflict_resolution ON iset_case_conflict_declaration (resolution_outcome, resolved_at)',
    'SELECT 1')
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND index_name = 'idx_case_conflict_resolution'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @ddl := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE iset_case_conflict_declaration ADD CONSTRAINT fk_case_conflict_declaration_resolved_by FOREIGN KEY (resolved_by_staff_profile_id) REFERENCES staff_profiles(id) ON DELETE SET NULL',
    'SELECT 1')
  FROM information_schema.referential_constraints
  WHERE constraint_schema = DATABASE()
    AND table_name = 'iset_case_conflict_declaration'
    AND constraint_name = 'fk_case_conflict_declaration_resolved_by'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
