CREATE TABLE IF NOT EXISTS `iset_internal_notification` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_key` VARCHAR(128) NULL,
  `severity` VARCHAR(32) NOT NULL DEFAULT 'info',
  `title` VARCHAR(255) NULL,
  `message` TEXT NOT NULL,
  `audience_type` ENUM('global', 'role', 'user') NOT NULL DEFAULT 'role',
  `audience_role` VARCHAR(128) NULL,
  `audience_user_id` BIGINT UNSIGNED NULL,
  `dismissible` TINYINT(1) NOT NULL DEFAULT 1,
  `requires_ack` TINYINT(1) NOT NULL DEFAULT 0,
  `starts_at` DATETIME NULL,
  `expires_at` DATETIME NULL,
  `metadata` JSON NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL,
  `delivered_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_iset_internal_notification_audience_role` (`audience_type`, `audience_role`),
  KEY `idx_iset_internal_notification_user` (`audience_type`, `audience_user_id`),
  KEY `idx_iset_internal_notification_active` (`starts_at`, `expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `iset_internal_notification_dismissal` (
  `notification_id` BIGINT UNSIGNED NOT NULL,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `dismissed_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`notification_id`, `user_id`),
  KEY `idx_iset_internal_notification_dismissal_user` (`user_id`),
  CONSTRAINT `fk_internal_notification_dismissal_notification`
    FOREIGN KEY (`notification_id`) REFERENCES `iset_internal_notification` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
