-- Migration: create application_lock table to support pessimistic locking metadata
CREATE TABLE IF NOT EXISTS application_lock (
  application_id BIGINT UNSIGNED NOT NULL,
  owner_user_id VARCHAR(128) NOT NULL,
  owner_display_name VARCHAR(255) NULL,
  owner_email VARCHAR(255) NULL,
  acquired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  metadata JSON NULL,
  PRIMARY KEY (application_id),
  KEY idx_application_lock_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
