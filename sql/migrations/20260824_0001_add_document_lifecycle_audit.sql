-- Document deletion uses a separate lifecycle record rather than overloading
-- iset_document.status='archived', which already means a superseded workflow
-- version. Historical deleted rows are deliberately not backfilled here.

CREATE TABLE IF NOT EXISTS iset_document_lifecycle (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  document_id BIGINT UNSIGNED NULL,
  original_document_id BIGINT UNSIGNED NOT NULL,
  current_state VARCHAR(24) NOT NULL,
  lifecycle_generation INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at DATETIME(3) NULL,
  deleted_by_staff_profile_id BIGINT UNSIGNED NULL,
  delete_reason VARCHAR(1000) NULL,
  client_id BIGINT UNSIGNED NULL,
  case_id BIGINT UNSIGNED NULL,
  application_id BIGINT UNSIGNED NULL,
  action_plan_id BIGINT UNSIGNED NULL,
  source_snapshot VARCHAR(64) NOT NULL,
  document_category VARCHAR(64) NULL,
  checksum_sha256 CHAR(64) NULL,
  size_bytes BIGINT UNSIGNED NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_iset_document_lifecycle_document (document_id),
  UNIQUE KEY uq_iset_document_lifecycle_original (original_document_id),
  KEY idx_iset_document_lifecycle_state_deleted (current_state, deleted_at, id),
  KEY idx_iset_document_lifecycle_case_state (case_id, current_state, deleted_at, id),
  KEY idx_iset_document_lifecycle_application_state (application_id, current_state, deleted_at, id),
  KEY idx_iset_document_lifecycle_deleted_by (deleted_by_staff_profile_id),
  CONSTRAINT fk_iset_document_lifecycle_document
    FOREIGN KEY (document_id) REFERENCES iset_document (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_iset_document_lifecycle_deleted_by
    FOREIGN KEY (deleted_by_staff_profile_id) REFERENCES staff_profiles (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_iset_document_lifecycle_state
    CHECK (current_state IN ('active', 'deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS iset_document_lifecycle_event (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  lifecycle_id BIGINT UNSIGNED NOT NULL,
  operation_id CHAR(36) NOT NULL,
  lifecycle_generation INT UNSIGNED NOT NULL,
  event_type VARCHAR(24) NOT NULL,
  from_state VARCHAR(24) NOT NULL,
  to_state VARCHAR(24) NOT NULL,
  actor_staff_profile_id BIGINT UNSIGNED NULL,
  actor_role_snapshot VARCHAR(64) NULL,
  actor_name_snapshot VARCHAR(255) NULL,
  actor_email_snapshot VARCHAR(255) NULL,
  reason VARCHAR(1000) NULL,
  details_json JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_iset_document_lifecycle_event_operation (operation_id, event_type),
  KEY idx_iset_document_lifecycle_event_history (lifecycle_id, lifecycle_generation, created_at, id),
  KEY idx_iset_document_lifecycle_event_actor (actor_staff_profile_id, created_at, id),
  CONSTRAINT fk_iset_document_lifecycle_event_lifecycle
    FOREIGN KEY (lifecycle_id) REFERENCES iset_document_lifecycle (id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_iset_document_lifecycle_event_actor
    FOREIGN KEY (actor_staff_profile_id) REFERENCES staff_profiles (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_iset_document_lifecycle_event_type
    CHECK (event_type IN ('deleted', 'restored')),
  CONSTRAINT chk_iset_document_lifecycle_event_from_state
    CHECK (from_state IN ('active', 'deleted')),
  CONSTRAINT chk_iset_document_lifecycle_event_to_state
    CHECK (to_state IN ('active', 'deleted'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
