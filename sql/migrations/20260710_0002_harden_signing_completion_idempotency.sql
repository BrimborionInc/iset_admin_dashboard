ALTER TABLE signing_request
  ADD COLUMN completion_token CHAR(36) NULL AFTER signed_payload_json,
  ADD COLUMN completion_payload_hash CHAR(64) NULL AFTER completion_token,
  ADD COLUMN completion_artifact_key VARCHAR(512) NULL AFTER completion_payload_hash,
  ADD COLUMN completion_event_id CHAR(36) NULL AFTER completion_artifact_key,
  ADD COLUMN completion_claim_token CHAR(36) NULL AFTER completion_event_id,
  ADD COLUMN completion_claim_expires_at DATETIME(3) NULL AFTER completion_claim_token,
  ADD COLUMN completion_started_at DATETIME(3) NULL AFTER completion_claim_expires_at,
  ADD UNIQUE KEY uq_signing_request_completion_token (completion_token),
  ADD UNIQUE KEY uq_signing_request_completion_event (completion_event_id),
  ADD KEY idx_signing_request_completion_claim (completion_claim_expires_at);

ALTER TABLE iset_document
  ADD COLUMN signing_request_id BIGINT UNSIGNED NULL AFTER origin_message_id,
  ADD UNIQUE KEY uq_iset_document_signing_request (signing_request_id),
  ADD CONSTRAINT fk_iset_document_signing_request
    FOREIGN KEY (signing_request_id) REFERENCES signing_request (id) ON DELETE SET NULL;
