ALTER TABLE iset_application
  ADD COLUMN client_id BIGINT UNSIGNED DEFAULT NULL AFTER submission_id,
  ADD COLUMN case_id BIGINT UNSIGNED DEFAULT NULL AFTER client_id,
  ADD COLUMN lifecycle_status VARCHAR(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER status,
  ADD COLUMN decision_outcome VARCHAR(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER lifecycle_status,
  ADD COLUMN awaiting_reason VARCHAR(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER decision_outcome,
  ADD COLUMN closure_reason VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER awaiting_reason,
  ADD KEY idx_iset_application_client_id (client_id),
  ADD KEY idx_iset_application_case_id (case_id),
  ADD KEY idx_iset_application_lifecycle_status (lifecycle_status),
  ADD KEY idx_iset_application_decision_outcome (decision_outcome),
  ADD CONSTRAINT fk_iset_application_client_id FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_iset_application_case_id FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT;
