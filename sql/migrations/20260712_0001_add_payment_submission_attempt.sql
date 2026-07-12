CREATE TABLE IF NOT EXISTS payment_submission_attempt (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payment_packet_id BIGINT UNSIGNED NOT NULL,
  submission_key VARCHAR(80) NOT NULL,
  mode VARCHAR(32) NULL,
  status VARCHAR(24) NOT NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  lease_owner VARCHAR(80) NULL,
  lease_expires_at DATETIME(3) NULL,
  provider_message_id VARCHAR(255) NULL,
  request_json JSON NULL,
  result_json JSON NULL,
  error_json JSON NULL,
  created_by_user_id INT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_submission_attempt_packet_key (payment_packet_id, submission_key),
  KEY idx_payment_submission_attempt_status_lease (status, lease_expires_at),
  KEY idx_payment_submission_attempt_created_by (created_by_user_id),
  CONSTRAINT fk_payment_submission_attempt_packet
    FOREIGN KEY (payment_packet_id) REFERENCES payment_packet (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_payment_submission_attempt_user
    FOREIGN KEY (created_by_user_id) REFERENCES user (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
