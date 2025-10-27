-- CR-0008: introduce client table and retrofit iset_case to reference it.
-- Up migration steps:
--   1) Create `client` table (normalized person profile for cases).
--   2) Add `client_id` column to `iset_case`, make `application_id` nullable, add supporting indexes.
--   3) Add foreign keys for `client_id` and `application_id`.
-- Note: `client_id` is initially nullable to allow manual backfill; tighten to NOT NULL once data is populated.

CREATE TABLE IF NOT EXISTS `client` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `dob` DATE NULL,
  `gender` VARCHAR(32) COLLATE utf8mb4_unicode_ci NULL,
  `aboriginal_group` VARCHAR(64) COLLATE utf8mb4_unicode_ci NULL,
  `last_name` VARCHAR(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `first_name` VARCHAR(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `initials` VARCHAR(16) COLLATE utf8mb4_unicode_ci NULL,
  `address_json` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ensure nullable application_id to accommodate admin-created cases without submissions.
ALTER TABLE `iset_case`
  MODIFY `application_id` BIGINT UNSIGNED NULL;

ALTER TABLE `iset_case`
  ADD COLUMN `client_id` BIGINT UNSIGNED NULL AFTER `application_id`;

-- Index helpers for common listing filters (status/owner/client).
ALTER TABLE `iset_case`
  ADD INDEX `idx_iset_case_client_id` (`client_id`),
  ADD INDEX `idx_iset_case_status_owner` (`status`, `assigned_to_user_id`);

-- Add foreign key constraints (no-op if already present).
ALTER TABLE `iset_case`
  ADD CONSTRAINT `fk_iset_case_client_id`
    FOREIGN KEY (`client_id`) REFERENCES `client` (`id`)
    ON DELETE RESTRICT,
  ADD CONSTRAINT `fk_iset_case_application_id`
    FOREIGN KEY (`application_id`) REFERENCES `iset_application` (`id`)
    ON DELETE RESTRICT;

-- Down migration guidance (manual):
--   ALTER TABLE `iset_case` DROP FOREIGN KEY `fk_iset_case_client_id`;
--   ALTER TABLE `iset_case` DROP FOREIGN KEY `fk_iset_case_application_id`;
--   ALTER TABLE `iset_case` DROP INDEX `idx_iset_case_client_id`;
--   ALTER TABLE `iset_case` DROP INDEX `idx_iset_case_status_owner`;
--   ALTER TABLE `iset_case` DROP COLUMN `client_id`;
--   ALTER TABLE `iset_case` MODIFY `application_id` BIGINT UNSIGNED NOT NULL;
--   DROP TABLE IF EXISTS `client`;
