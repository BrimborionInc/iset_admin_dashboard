CREATE TABLE IF NOT EXISTS applicant_password_reset_request_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  request_route VARCHAR(128) NULL,
  request_flow VARCHAR(32) NULL,
  source_ip VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  outcome VARCHAR(32) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_applicant_password_reset_request_email_created (email, created_at),
  KEY idx_applicant_password_reset_request_route_created (request_route, created_at),
  KEY idx_applicant_password_reset_request_flow_created (request_flow, created_at),
  KEY idx_applicant_password_reset_request_outcome_created (outcome, created_at),
  KEY idx_applicant_password_reset_request_ip_created (source_ip, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
