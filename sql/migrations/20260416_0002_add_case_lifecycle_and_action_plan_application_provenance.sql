ALTER TABLE iset_case
  ADD COLUMN lifecycle_status VARCHAR(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER status,
  ADD COLUMN closure_reason VARCHAR(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER lifecycle_status,
  ADD KEY idx_iset_case_lifecycle_status (lifecycle_status),
  ADD KEY idx_iset_case_lifecycle_owner (lifecycle_status, assigned_to_user_id);

ALTER TABLE iset_case_action_plan
  ADD COLUMN application_id BIGINT UNSIGNED DEFAULT NULL AFTER case_id,
  ADD KEY idx_case_action_plan_application_id (application_id),
  ADD CONSTRAINT fk_case_action_plan_application_id FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE SET NULL;
