CREATE TABLE IF NOT EXISTS funding_overview_series (
  id INT AUTO_INCREMENT PRIMARY KEY,
  case_id BIGINT UNSIGNED NOT NULL,
  template_key VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_staff_profile_id BIGINT UNSIGNED NULL,
  UNIQUE KEY uniq_funding_overview_series_case_template (case_id, template_key),
  KEY idx_funding_overview_series_case (case_id),
  KEY idx_funding_overview_series_created_by_staff_profile (created_by_staff_profile_id),
  CONSTRAINT fk_funding_overview_series_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  CONSTRAINT fk_funding_overview_series_created_by_staff_profile
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS funding_overview_version (
  id INT AUTO_INCREMENT PRIMARY KEY,
  series_id INT NOT NULL,
  version_number INT NOT NULL,
  status VARCHAR(24) NOT NULL,
  supersedes_version_id INT NULL,
  change_reason VARCHAR(64) NULL,
  change_summary VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_staff_profile_id BIGINT UNSIGNED NULL,
  sent_at DATETIME NULL,
  sent_by_staff_profile_id BIGINT UNSIGNED NULL,
  signed_at DATETIME NULL,
  signed_by_participant_id INT NULL,
  effective_date DATE NULL,
  snapshot_schema_version VARCHAR(16) NOT NULL,
  snapshot_hash CHAR(64) NULL,
  rendered_template_version VARCHAR(32) NULL,
  metadata_json JSON NULL,
  UNIQUE KEY uniq_funding_overview_version_series (series_id, version_number),
  KEY idx_funding_overview_version_series (series_id),
  KEY idx_funding_overview_version_status (status),
  KEY idx_funding_overview_version_supersedes (supersedes_version_id),
  KEY idx_funding_overview_version_created (created_at),
  KEY idx_funding_overview_version_created_by_staff_profile (created_by_staff_profile_id),
  KEY idx_funding_overview_version_sent_by_staff_profile (sent_by_staff_profile_id),
  KEY idx_funding_overview_version_signed_participant (signed_by_participant_id),
  CONSTRAINT fk_funding_overview_version_series
    FOREIGN KEY (series_id) REFERENCES funding_overview_series (id) ON DELETE RESTRICT,
  CONSTRAINT fk_funding_overview_version_supersedes
    FOREIGN KEY (supersedes_version_id) REFERENCES funding_overview_version (id) ON DELETE RESTRICT,
  CONSTRAINT fk_funding_overview_version_created_by_staff_profile
    FOREIGN KEY (created_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL,
  CONSTRAINT fk_funding_overview_version_sent_by_staff_profile
    FOREIGN KEY (sent_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL,
  CONSTRAINT fk_funding_overview_version_signed_participant
    FOREIGN KEY (signed_by_participant_id) REFERENCES `user` (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS funding_overview_version_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  funding_overview_version_id INT NOT NULL,
  document_type VARCHAR(16) NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_funding_overview_version_doc (funding_overview_version_id, document_type),
  KEY idx_funding_overview_document_id (document_id),
  CONSTRAINT fk_funding_overview_documents_version
    FOREIGN KEY (funding_overview_version_id) REFERENCES funding_overview_version (id) ON DELETE CASCADE,
  CONSTRAINT fk_funding_overview_documents_document
    FOREIGN KEY (document_id) REFERENCES iset_document (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
