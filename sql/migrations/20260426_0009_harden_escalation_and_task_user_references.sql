ALTER TABLE iset_application_escalation
  MODIFY COLUMN case_id BIGINT UNSIGNED NOT NULL,
  MODIFY COLUMN current_owner_user_id INT DEFAULT NULL,
  MODIFY COLUMN requester_user_id INT NOT NULL,
  MODIFY COLUMN resolved_by_user_id INT DEFAULT NULL,
  ADD KEY idx_escalation_case_id (case_id),
  ADD KEY idx_escalation_current_owner_user (current_owner_user_id),
  ADD KEY idx_escalation_resolved_by_user (resolved_by_user_id),
  ADD CONSTRAINT fk_application_escalation_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_application_escalation_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_application_escalation_current_owner_user
    FOREIGN KEY (current_owner_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_application_escalation_requester_user
    FOREIGN KEY (requester_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_application_escalation_resolved_by_user
    FOREIGN KEY (resolved_by_user_id) REFERENCES `user` (id) ON DELETE RESTRICT;

ALTER TABLE iset_application
  ADD CONSTRAINT fk_iset_application_current_escalation
    FOREIGN KEY (current_escalation_id) REFERENCES iset_application_escalation (id) ON DELETE SET NULL;

ALTER TABLE iset_case_task
  ADD KEY idx_case_task_created_by_user (created_by_user_id),
  ADD KEY idx_case_task_updated_by_user (updated_by_user_id),
  ADD CONSTRAINT fk_case_task_created_by_user
    FOREIGN KEY (created_by_user_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_case_task_updated_by_user
    FOREIGN KEY (updated_by_user_id) REFERENCES `user` (id) ON DELETE RESTRICT;
