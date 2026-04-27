ALTER TABLE signing_request
  MODIFY COLUMN workflow_id INT NOT NULL,
  MODIFY COLUMN case_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN participant_user_id INT NOT NULL,
  MODIFY COLUMN created_by_user_id INT NOT NULL,
  ADD KEY idx_signing_request_workflow (workflow_id),
  ADD KEY idx_signing_request_created_by_user (created_by_user_id),
  ADD CONSTRAINT fk_signing_request_workflow
    FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_signing_request_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_signing_request_participant_user
    FOREIGN KEY (participant_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_signing_request_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES `user` (id) ON DELETE RESTRICT;
