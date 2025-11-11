-- Replaces single conflict-of-interest flag with per-user signatures
-- 1) Remove legacy columns from iset_case_assessment
-- 2) Create iset_case_conflict_declaration for per-user attestations

ALTER TABLE `iset_case_assessment`
  DROP FOREIGN KEY `fk_case_assessment_conflict_staff`;

ALTER TABLE `iset_case_assessment`
  DROP INDEX `idx_case_assessment_conflict_signed`;

ALTER TABLE `iset_case_assessment`
  DROP COLUMN `conflict_declaration_signed`,
  DROP COLUMN `conflict_declaration_signed_at`,
  DROP COLUMN `conflict_declaration_signed_by`;

CREATE TABLE `iset_case_conflict_declaration` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `case_id` bigint unsigned NOT NULL,
  `staff_profile_id` bigint unsigned NOT NULL,
  `signed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `signed_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `signed_user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_active` tinyint(1) GENERATED ALWAYS AS (CASE WHEN `revoked_at` IS NULL THEN 1 ELSE 0 END) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_case_conflict_active` (`case_id`, `staff_profile_id`, `is_active`),
  KEY `idx_case_conflict_case` (`case_id`),
  KEY `idx_case_conflict_staff` (`staff_profile_id`),
  CONSTRAINT `fk_case_conflict_declaration_case`
    FOREIGN KEY (`case_id`) REFERENCES `iset_case`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_conflict_declaration_staff`
    FOREIGN KEY (`staff_profile_id`) REFERENCES `staff_profiles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
