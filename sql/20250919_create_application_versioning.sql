-- Migration: Create application versioning structures
-- Date: 2025-09-19
-- Purpose: Preserve immutable original submissions and enable versioned working copies for assessment.

-- 1. Augment submission table with hash + lock timestamp (safe IF NOT EXISTS guards via dynamic checks)
ALTER TABLE iset_application_submission
  ADD COLUMN IF NOT EXISTS original_payload_hash CHAR(64) NULL AFTER updated_at,
  ADD COLUMN IF NOT EXISTS locked_at DATETIME NULL AFTER original_payload_hash;

-- 2. Create version table for working application copies
CREATE TABLE IF NOT EXISTS iset_application_version (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  case_id BIGINT UNSIGNED NOT NULL,
  submission_id BIGINT UNSIGNED NOT NULL,
  version_number INT NOT NULL,
  payload_json JSON NOT NULL,
  created_by_evaluator_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  change_summary VARCHAR(500) NULL,
  source_type ENUM('initial_copy','manual_edit','correction','system_enrichment') NOT NULL DEFAULT 'initial_copy',
  previous_version_id BIGINT UNSIGNED NULL,
  payload_hash CHAR(64) NOT NULL,
  is_current TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_case_version (case_id, version_number),
  KEY idx_case_current (case_id, is_current),
  KEY idx_submission (submission_id),
  CONSTRAINT fk_app_version_case FOREIGN KEY (case_id) REFERENCES iset_case(id) ON DELETE CASCADE,
  CONSTRAINT fk_app_version_submission FOREIGN KEY (submission_id) REFERENCES iset_application_submission(id) ON DELETE RESTRICT,
  CONSTRAINT fk_app_version_prev FOREIGN KEY (previous_version_id) REFERENCES iset_application_version(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 3. (Optional) Add index for hash lookups (tamper detection workflows)
CREATE INDEX IF NOT EXISTS idx_app_version_hash ON iset_application_version(payload_hash);

-- 4. Backfill hash for existing submissions lacking it (idempotent)
UPDATE iset_application_submission s
  SET original_payload_hash = LPAD(SHA2(COALESCE(CAST(s.intake_payload AS CHAR), ''), 256),64,'0')
  WHERE original_payload_hash IS NULL;

-- 5. Initialize locked_at for historical rows (they are considered immutable already)
UPDATE iset_application_submission
  SET locked_at = COALESCE(locked_at, submitted_at)
  WHERE locked_at IS NULL;

-- 6. (Deferred) Backfill initial application versions will be handled by a script after deployment.
--    Script will: for each case without versions, locate the related submission (if available) and insert version 1.
