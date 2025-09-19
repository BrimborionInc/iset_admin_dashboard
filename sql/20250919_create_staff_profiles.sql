-- Migration: Create staff_profiles table (replaces deprecated iset_evaluators)
-- Purpose: Store operational metadata for staff users augmenting Cognito identity.
-- NOTE: No foreign keys yet; mapping by cognito_sub.

CREATE TABLE IF NOT EXISTS `staff_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `cognito_sub` VARCHAR(64) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `name` VARCHAR(255) NULL,
  `display_name` VARCHAR(255) NULL,
  `primary_role` ENUM('Program Administrator','Regional Coordinator','Application Assessor','System Administrator') NOT NULL DEFAULT 'Application Assessor',
  `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `last_login_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_staff_profiles_cognito_sub` (`cognito_sub`),
  KEY `idx_staff_profiles_email` (`email`),
  KEY `idx_staff_profiles_primary_role` (`primary_role`),
  KEY `idx_staff_profiles_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;