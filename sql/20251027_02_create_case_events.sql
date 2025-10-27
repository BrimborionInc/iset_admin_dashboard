-- CR-0008 Case Workspace: timeline / event log persistence

CREATE TABLE `iset_case_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `summary` VARCHAR(255) DEFAULT NULL,
  `payload_json` JSON DEFAULT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actor_staff_profile_id` BIGINT UNSIGNED DEFAULT NULL,
  `actor_user_id` INT DEFAULT NULL,
  `source_system` VARCHAR(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_case_event_case_ts` (`case_id`, `occurred_at`),
  KEY `idx_case_event_type_ts` (`event_type`, `occurred_at`),
  KEY `idx_case_event_actor_profile` (`actor_staff_profile_id`),
  CONSTRAINT `fk_case_event_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_event_actor_profile` FOREIGN KEY (`actor_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_event_actor_user` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
