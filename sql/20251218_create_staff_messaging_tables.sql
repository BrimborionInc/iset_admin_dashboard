-- Migration: Create staff-to-staff messaging tables (threads, participants, messages, mailbox items).
-- Purpose: Support an internal Messages dashboard (Inbox/Sent/Deleted) and a pinned message window UX.

CREATE TABLE IF NOT EXISTS `staff_message_thread` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `subject` VARCHAR(255) NULL,
  `created_by_staff_profile_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_smt_created_by` (`created_by_staff_profile_id`),
  KEY `idx_smt_updated_at` (`updated_at`),
  CONSTRAINT `fk_smt_created_by_staff_profile`
    FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_message_thread_participant` (
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `staff_profile_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`thread_id`, `staff_profile_id`),
  KEY `idx_smtp_staff_profile` (`staff_profile_id`),
  CONSTRAINT `fk_smtp_thread`
    FOREIGN KEY (`thread_id`) REFERENCES `staff_message_thread` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_smtp_staff_profile`
    FOREIGN KEY (`staff_profile_id`) REFERENCES `staff_profiles` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_message` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `thread_id` BIGINT UNSIGNED NOT NULL,
  `sender_staff_profile_id` BIGINT UNSIGNED NOT NULL,
  `body` TEXT NOT NULL,
  `metadata_json` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sm_thread_created_at` (`thread_id`, `created_at`),
  KEY `idx_sm_sender_created_at` (`sender_staff_profile_id`, `created_at`),
  CONSTRAINT `fk_sm_thread`
    FOREIGN KEY (`thread_id`) REFERENCES `staff_message_thread` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_sm_sender_staff_profile`
    FOREIGN KEY (`sender_staff_profile_id`) REFERENCES `staff_profiles` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `staff_message_item` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `message_id` BIGINT UNSIGNED NOT NULL,
  `owner_staff_profile_id` BIGINT UNSIGNED NOT NULL,
  `folder` ENUM('inbox','sent','deleted') NOT NULL,
  `folder_before_deleted` ENUM('inbox','sent') NULL,
  `read_at` DATETIME NULL,
  `deleted_at` DATETIME NULL,
  `purged_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_smi_message_owner` (`message_id`, `owner_staff_profile_id`),
  KEY `idx_smi_owner_folder_purged_read` (`owner_staff_profile_id`, `folder`, `purged_at`, `read_at`),
  KEY `idx_smi_owner_folder_deleted_at` (`owner_staff_profile_id`, `folder`, `deleted_at`),
  CONSTRAINT `fk_smi_message`
    FOREIGN KEY (`message_id`) REFERENCES `staff_message` (`id`)
    ON DELETE CASCADE,
  CONSTRAINT `fk_smi_owner_staff_profile`
    FOREIGN KEY (`owner_staff_profile_id`) REFERENCES `staff_profiles` (`id`)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

