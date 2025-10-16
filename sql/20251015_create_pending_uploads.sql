-- Stores metadata for in-progress file uploads so that presign/finalize
-- requests can span multiple portal instances (shared persistence).
-- Rows are inserted during /api/uploads/presign and deleted on
-- /api/documents/finalize (or timed out via expires_at).
CREATE TABLE IF NOT EXISTS pending_uploads (
  upload_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  object_key VARCHAR(512) DEFAULT NULL,
  content_type VARCHAR(128) DEFAULT NULL,
  size_bytes BIGINT DEFAULT NULL,
  document_type VARCHAR(64) DEFAULT '',
  policy_json JSON DEFAULT NULL,
  mode VARCHAR(16) NOT NULL DEFAULT 'local-direct',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (upload_id),
  KEY idx_pending_user (user_id),
  KEY idx_pending_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
