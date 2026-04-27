ALTER TABLE iset_document
  MODIFY COLUMN user_id INT DEFAULT NULL,
  MODIFY COLUMN applicant_user_id INT DEFAULT NULL,
  MODIFY COLUMN origin_message_id INT DEFAULT NULL;

ALTER TABLE iset_document
  ADD KEY idx_iset_document_user_id (user_id),
  ADD CONSTRAINT fk_iset_document_user
    FOREIGN KEY (user_id) REFERENCES `user` (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_iset_document_applicant_user
    FOREIGN KEY (applicant_user_id) REFERENCES `user` (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_iset_document_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_iset_document_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_iset_document_origin_message
    FOREIGN KEY (origin_message_id) REFERENCES messages (id) ON DELETE SET NULL;
