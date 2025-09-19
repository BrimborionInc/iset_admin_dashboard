-- Destructive reset: drop legacy case-related tables and recreate minimal schema
-- IMPORTANT: This migration assumes you are in a non-production environment.
-- It keeps `iset_application_submission` intact and rebuilds `iset_application` + `iset_case`.

-- Disable FK checks (store/restore caused NULL error in runner environment)
SET FOREIGN_KEY_CHECKS = 0;

-- Drop legacy / obsolete tables explicitly listed by user
DROP TABLE IF EXISTS `iset_case_task`;
DROP TABLE IF EXISTS `iset_case_note`;
DROP TABLE IF EXISTS `iset_case_event`;
DROP TABLE IF EXISTS `iset_case_document`;
DROP TABLE IF EXISTS `iset_case`;
DROP TABLE IF EXISTS `iset_application`;
DROP TABLE IF EXISTS `iset_evaluator_ptma`;
DROP TABLE IF EXISTS `iset_evaluators`;
DROP TABLE IF EXISTS `iset_event_type`;

-- Recreate minimal JSON-based working application table
CREATE TABLE `iset_application` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `submission_id` BIGINT UNSIGNED NULL,
  `payload_json` JSON NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'active',
  `version` INT NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_iset_application_submission_id` (`submission_id`),
  KEY `idx_iset_application_status` (`status`)
  -- (No FK constraint for submission_id to keep this flexible after destructive reset)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recreate lean case table
CREATE TABLE `iset_case` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `application_id` BIGINT UNSIGNED NOT NULL,
  `assigned_to_user_id` BIGINT UNSIGNED NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'open',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_iset_case_application_id` (`application_id`),
  KEY `idx_iset_case_assigned_to_user_id` (`assigned_to_user_id`),
  KEY `idx_iset_case_status` (`status`)
  -- (Deliberately omitting FKs to user/application for now to avoid dependency issues during reset)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Re-enable FK checks
SET FOREIGN_KEY_CHECKS = 1;

-- (Optional) Seeding intentionally omitted; add a follow-up migration if needed.
