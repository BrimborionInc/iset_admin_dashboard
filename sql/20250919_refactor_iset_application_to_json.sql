-- Strategy (Option A):
--   1. Drop FK iset_case_ibfk_1
--   2. Purge dependent case data & iset_case rows
--   3. Drop & recreate iset_application (JSON payload)
--   4. Re-add FK
--   5. No backfill

-- 1. Drop foreign key constraint directly (ignore error manually if it fails)
ALTER TABLE iset_case DROP FOREIGN KEY iset_case_ibfk_1;

-- 2. Purge case-related data (order matters only if FKs without CASCADE)
-- If these tables don't exist, statements will error; wrap each in conditional dynamic execution.
-- Simplicity: assume they exist; acceptable in dev destructive migration.
DELETE FROM iset_case_document;
DELETE FROM iset_case_event;
DELETE FROM iset_case_note;
DELETE FROM iset_case_task;
DELETE FROM iset_case;

-- 3. Drop and recreate iset_application
DROP TABLE IF EXISTS iset_application;

CREATE TABLE iset_application (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  submission_id BIGINT UNSIGNED NULL,
  tracking_id VARCHAR(32) NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  applicant_cognito_sub VARCHAR(64) NULL,
  status ENUM('New','Open','In Review','Closed','Rejected') NOT NULL DEFAULT 'New',
  payload_json JSON NOT NULL,
  form_complete TINYINT(1) NOT NULL DEFAULT 0,
  docs_uploaded TINYINT(1) NOT NULL DEFAULT 0,
  current_version_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tracking (tracking_id),
  KEY idx_status (status),
  KEY idx_user (user_id),
  KEY idx_cognito_sub (applicant_cognito_sub),
  CONSTRAINT fk_app_submission FOREIGN KEY (submission_id) REFERENCES iset_application_submission(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Re-add FK
ALTER TABLE iset_case ADD CONSTRAINT iset_case_ibfk_1 FOREIGN KEY (application_id) REFERENCES iset_application(id) ON DELETE CASCADE;

-- 5. Ready for ingestion process to repopulate working applications.

-- Future enhancements:
-- 1. Add virtual/generated columns for common filters (e.g., last_name) if needed.
-- 2. Introduce application version linkage via current_version_id referencing iset_application_version.id.
-- 3. Implement ingestion script to create working application rows from submissions.
