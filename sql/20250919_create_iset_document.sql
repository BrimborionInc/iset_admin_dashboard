-- Migration: create unified iset_document table
-- Purpose: replace dropped iset_case_document with generalized document store
-- Safe to run multiple times: uses IF NOT EXISTS

CREATE TABLE IF NOT EXISTS iset_document (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  applicant_user_id BIGINT UNSIGNED NULL,
  application_id BIGINT UNSIGNED NULL,
  case_id BIGINT UNSIGNED NULL,
  origin_message_id BIGINT UNSIGNED NULL,
  source ENUM('secure_message_attachment','application_submission','manual_upload','system_generated') NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(128) NULL,
  label VARCHAR(255) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  checksum_sha256 CHAR(64) NULL,
  status ENUM('active','archived','deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_file_path (file_path),
  KEY idx_applicant (applicant_user_id),
  KEY idx_case (case_id),
  KEY idx_application (application_id),
  KEY idx_origin_message (origin_message_id),
  KEY idx_status (status),
  KEY idx_source (source)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
