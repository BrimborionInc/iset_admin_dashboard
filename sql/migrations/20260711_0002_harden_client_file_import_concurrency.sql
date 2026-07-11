CREATE TABLE client_file_import_run (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(24) NOT NULL,
  actor_staff_profile_id BIGINT UNSIGNED NULL,
  file_name VARCHAR(255) NULL,
  worksheet_name VARCHAR(255) NULL,
  result_json JSON NULL,
  committed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_file_import_run_request_hash (request_hash),
  KEY idx_client_file_import_run_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE client_file_import_identity_claim (
  identity_key VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (identity_key),
  KEY idx_client_file_import_identity_client (client_id),
  CONSTRAINT fk_client_file_import_identity_client
    FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
