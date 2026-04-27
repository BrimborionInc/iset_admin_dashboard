ALTER TABLE message_attachment
  ADD COLUMN client_id BIGINT UNSIGNED DEFAULT NULL AFTER case_id,
  MODIFY COLUMN application_id BIGINT UNSIGNED DEFAULT NULL,
  MODIFY COLUMN user_id INT DEFAULT NULL;

UPDATE message_attachment ma
LEFT JOIN messages m ON m.id = ma.message_id
LEFT JOIN iset_case c ON c.id = COALESCE(ma.case_id, m.case_id)
LEFT JOIN iset_application a ON a.id = COALESCE(ma.application_id, m.application_id, c.application_id)
   SET ma.case_id = COALESCE(ma.case_id, m.case_id),
       ma.application_id = COALESCE(ma.application_id, m.application_id, c.application_id),
       ma.client_id = COALESCE(ma.client_id, a.client_id, c.client_id);

ALTER TABLE message_attachment
  ADD KEY idx_message_attachment_client_id (client_id),
  ADD KEY idx_message_attachment_application_id (application_id),
  ADD KEY idx_message_attachment_user_id (user_id),
  ADD CONSTRAINT fk_message_attachment_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_message_attachment_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_message_attachment_client
    FOREIGN KEY (client_id) REFERENCES client (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_message_attachment_user
    FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL;
