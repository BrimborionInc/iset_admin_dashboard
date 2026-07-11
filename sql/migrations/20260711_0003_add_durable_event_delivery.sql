ALTER TABLE iset_event_entry
  ADD COLUMN notification_delivery_mode VARCHAR(16) NOT NULL DEFAULT 'legacy' AFTER captured_by,
  ADD KEY idx_event_entry_delivery_reconcile (notification_delivery_mode, source, captured_at);

ALTER TABLE iset_case_reminder
  ADD COLUMN lifecycle_generation INT UNSIGNED NOT NULL DEFAULT 1 AFTER status;

CREATE TABLE iset_reminder_lifecycle_event (
  reminder_id BIGINT UNSIGNED NOT NULL,
  lifecycle_generation INT UNSIGNED NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  event_id CHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'claimed',
  claimed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  emitted_at DATETIME(3) NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (reminder_id, lifecycle_generation, event_type),
  UNIQUE KEY uq_reminder_lifecycle_event_id (event_id),
  CONSTRAINT fk_reminder_lifecycle_event_reminder
    FOREIGN KEY (reminder_id) REFERENCES iset_case_reminder (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE iset_event_delivery (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id CHAR(36) NOT NULL,
  channel VARCHAR(16) NOT NULL,
  audience_key VARCHAR(255) NOT NULL,
  worker_scope VARCHAR(16) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  available_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  claimed_by VARCHAR(64) NULL,
  claim_expires_at DATETIME(3) NULL,
  payload_json JSON NULL,
  last_error TEXT NULL,
  last_attempt_at DATETIME(3) NULL,
  delivered_at DATETIME(3) NULL,
  replay_count INT UNSIGNED NOT NULL DEFAULT 0,
  replay_reason VARCHAR(1000) NULL,
  replayed_by_staff_profile_id BIGINT UNSIGNED NULL,
  replayed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_event_delivery_audience_channel (event_id, channel, audience_key),
  KEY idx_event_delivery_claim (worker_scope, status, available_at, id),
  KEY idx_event_delivery_status_updated (status, updated_at),
  KEY idx_event_delivery_retention (status, delivered_at, id),
  KEY idx_event_delivery_replayed_by (replayed_by_staff_profile_id),
  CONSTRAINT fk_event_delivery_event
    FOREIGN KEY (event_id) REFERENCES iset_event_entry (id) ON DELETE CASCADE,
  CONSTRAINT fk_event_delivery_replayed_by
    FOREIGN KEY (replayed_by_staff_profile_id) REFERENCES staff_profiles (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
