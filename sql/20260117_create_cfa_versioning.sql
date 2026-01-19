CREATE TABLE IF NOT EXISTS cfa_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id INT NOT NULL,
  template_key VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_staff_profile_id INT NULL,
  INDEX idx_cfa_series_case (case_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfa_version (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series_id INT NOT NULL,
  version_number INT NOT NULL,
  status VARCHAR(24) NOT NULL,
  supersedes_version_id INT NULL,
  change_reason VARCHAR(64) NULL,
  change_summary VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_staff_profile_id INT NULL,
  sent_at DATETIME NULL,
  sent_by_staff_profile_id INT NULL,
  signed_at DATETIME NULL,
  signed_by_participant_id INT NULL,
  effective_date DATE NULL,
  snapshot_schema_version VARCHAR(16) NOT NULL,
  snapshot_hash CHAR(64) NULL,
  rendered_template_version VARCHAR(32) NULL,
  metadata_json JSON NULL,
  UNIQUE KEY uniq_cfa_version_series (series_id, version_number),
  INDEX idx_cfa_version_series (series_id),
  INDEX idx_cfa_version_status (status),
  INDEX idx_cfa_version_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cfa_version_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cfa_version_id INT NOT NULL,
  document_type VARCHAR(16) NOT NULL,
  document_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_cfa_version_doc (cfa_version_id, document_type),
  INDEX idx_cfa_document_id (document_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
