-- Track per-staff case watchlist entries so administrators can follow cases they do not own.
CREATE TABLE IF NOT EXISTS `iset_case_watch` (
  `case_id` BIGINT UNSIGNED NOT NULL,
  `staff_profile_id` INT NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `metadata` JSON DEFAULT NULL,
  PRIMARY KEY (`case_id`, `staff_profile_id`),
  KEY `idx_case_watch_staff` (`staff_profile_id`, `created_at`),
  CONSTRAINT `fk_case_watch_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_watch_staff` FOREIGN KEY (`staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
