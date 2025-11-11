-- Replace contact_message_status_history actor FK to reference staff profiles instead of portal users

ALTER TABLE `contact_message_status_history`
  DROP FOREIGN KEY `fk_contact_message_status_history_user`;

ALTER TABLE `contact_message_status_history`
  DROP KEY `idx_contact_message_status_history_changed_by`;

ALTER TABLE `contact_message_status_history`
  CHANGE COLUMN `changed_by_user_id` `changed_by_staff_profile_id` BIGINT UNSIGNED NULL;

ALTER TABLE `contact_message_status_history`
  ADD KEY `idx_contact_status_history_staff` (`changed_by_staff_profile_id`),
  ADD CONSTRAINT `fk_contact_status_history_staff`
    FOREIGN KEY (`changed_by_staff_profile_id`) REFERENCES `staff_profiles`(`id`)
    ON DELETE SET NULL;
