ALTER TABLE messages
  ADD CONSTRAINT fk_messages_legacy_sender_user
    FOREIGN KEY (sender_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_legacy_recipient_user
    FOREIGN KEY (recipient_id) REFERENCES `user` (id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_messages_case
    FOREIGN KEY (case_id) REFERENCES iset_case (id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_messages_application
    FOREIGN KEY (application_id) REFERENCES iset_application (id) ON DELETE SET NULL;

ALTER TABLE message_item
  ADD CONSTRAINT fk_message_item_message
    FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
  ADD CONSTRAINT fk_message_item_owner_user
    FOREIGN KEY (owner_user_id) REFERENCES `user` (id) ON DELETE CASCADE;
