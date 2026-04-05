CREATE TABLE IF NOT EXISTS admin_feedback_report (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_type VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'submitted',
  summary VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  submitted_by_staff_profile_id INT NULL,
  submitted_by_name VARCHAR(255) NULL,
  submitted_by_email VARCHAR(320) NULL,
  submitted_by_role VARCHAR(64) NULL,
  page_title VARCHAR(255) NULL,
  page_path VARCHAR(1024) NULL,
  page_url VARCHAR(2048) NULL,
  context_json JSON NULL,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_admin_feedback_report_status_submitted (status, submitted_at),
  KEY idx_admin_feedback_report_type_submitted (report_type, submitted_at),
  KEY idx_admin_feedback_report_staff_submitted (submitted_by_staff_profile_id, submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_feedback_attachment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  report_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  mime_type VARCHAR(255) NULL,
  size_bytes BIGINT NULL,
  checksum_sha256 CHAR(64) NULL,
  uploaded_by_staff_profile_id INT NULL,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_admin_feedback_attachment_report (report_id, uploaded_at),
  KEY idx_admin_feedback_attachment_uploader (uploaded_by_staff_profile_id, uploaded_at),
  UNIQUE KEY uniq_admin_feedback_attachment_storage_key (storage_key),
  CONSTRAINT fk_admin_feedback_attachment_report
    FOREIGN KEY (report_id) REFERENCES admin_feedback_report (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
