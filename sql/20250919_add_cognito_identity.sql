-- Add Cognito identity columns for applicants and staff
-- Idempotent patterns using IF NOT EXISTS (MySQL 8+) and dynamic index creation fallback.

-- Applicants: add columns to iset_application (current working application record)
ALTER TABLE iset_application
  ADD COLUMN IF NOT EXISTS applicant_cognito_sub VARCHAR(64) NULL AFTER tracking_id,
  ADD COLUMN IF NOT EXISTS applicant_email_snapshot VARCHAR(255) NULL AFTER applicant_cognito_sub;

-- Immutable submissions table (if present)
ALTER TABLE iset_application_submission
  ADD COLUMN IF NOT EXISTS applicant_cognito_sub VARCHAR(64) NULL AFTER tracking_id,
  ADD COLUMN IF NOT EXISTS applicant_email_snapshot VARCHAR(255) NULL AFTER applicant_cognito_sub;

-- Staff evaluators: add cognito_sub
ALTER TABLE iset_evaluators
  ADD COLUMN IF NOT EXISTS cognito_sub VARCHAR(64) NULL;

-- Unique index on evaluator cognito_sub (conditional)
SET @idx_exists := (SELECT COUNT(1) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name='iset_evaluators' AND index_name='uniq_evaluator_cognito_sub');
SET @sql := IF(@idx_exists=0, 'CREATE UNIQUE INDEX uniq_evaluator_cognito_sub ON iset_evaluators(cognito_sub)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index on application applicant_cognito_sub + created_at (conditional)
SET @idx_exists := (SELECT COUNT(1) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name='iset_application' AND index_name='idx_application_applicant_sub');
SET @sql := IF(@idx_exists=0, 'CREATE INDEX idx_application_applicant_sub ON iset_application(applicant_cognito_sub, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Composite index on submission applicant_cognito_sub + created_at (conditional)
SET @idx_exists := (SELECT COUNT(1) FROM information_schema.statistics 
  WHERE table_schema = DATABASE() AND table_name='iset_application_submission' AND index_name='idx_app_sub_applicant_sub');
SET @sql := IF(@idx_exists=0, 'CREATE INDEX idx_app_sub_applicant_sub ON iset_application_submission(applicant_cognito_sub, created_at)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill email snapshot where null using existing email column (if present)
UPDATE iset_application SET applicant_email_snapshot = email WHERE applicant_email_snapshot IS NULL AND email IS NOT NULL;
UPDATE iset_application_submission SET applicant_email_snapshot = email WHERE applicant_email_snapshot IS NULL AND email IS NOT NULL;

-- NOTE: NOT NULL constraints can be added in later migration after runtime writes these columns.
