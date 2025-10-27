-- CR-0008 Case Workspace: interventions, compliance, finance, and document links

CREATE TABLE `iset_case_intervention` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `action_plan_id` BIGINT UNSIGNED DEFAULT NULL,
  `intervention_type` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'planned',
  `start_date` DATE DEFAULT NULL,
  `end_date` DATE DEFAULT NULL,
  `funding_stream` VARCHAR(64) DEFAULT NULL,
  `budget_amount` DECIMAL(14,2) DEFAULT NULL,
  `approved_amount` DECIMAL(14,2) DEFAULT NULL,
  `actual_amount` DECIMAL(14,2) DEFAULT NULL,
  `outcome_code` VARCHAR(32) DEFAULT NULL,
  `notes` TEXT,
  `metadata_json` JSON DEFAULT NULL,
  `created_by_staff_profile_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `closed_at` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_case_intervention_case_status` (`case_id`, `status`),
  KEY `idx_case_intervention_plan` (`action_plan_id`),
  CONSTRAINT `fk_case_intervention_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_intervention_plan` FOREIGN KEY (`action_plan_id`) REFERENCES `iset_case_action_plan` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_intervention_created_by` FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `iset_case_compliance_check` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `requirement_code` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'pending',
  `due_at` DATE DEFAULT NULL,
  `fulfilled_at` DATETIME DEFAULT NULL,
  `evidence_document_id` BIGINT UNSIGNED DEFAULT NULL,
  `notes` TEXT,
  `created_by_staff_profile_id` BIGINT UNSIGNED DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_case_compliance_case_status` (`case_id`, `status`, `due_at`),
  CONSTRAINT `fk_case_compliance_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_case_compliance_document` FOREIGN KEY (`evidence_document_id`) REFERENCES `iset_document` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_case_compliance_created_by` FOREIGN KEY (`created_by_staff_profile_id`) REFERENCES `staff_profiles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `iset_case_financial_snapshot` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED NOT NULL,
  `as_of_date` DATE NOT NULL,
  `allocated_amount` DECIMAL(14,2) DEFAULT NULL,
  `committed_amount` DECIMAL(14,2) DEFAULT NULL,
  `spent_amount` DECIMAL(14,2) DEFAULT NULL,
  `variance_amount` DECIMAL(14,2) DEFAULT NULL,
  `variance_reason` VARCHAR(255) DEFAULT NULL,
  `details_json` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_case_financial_snapshot_case_date` (`case_id`, `as_of_date`),
  CONSTRAINT `fk_case_financial_snapshot_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `iset_document`
  ADD COLUMN `document_category` VARCHAR(64) DEFAULT NULL,
  ADD COLUMN `visibility` ENUM('internal','shared','external') NOT NULL DEFAULT 'internal',
  ADD COLUMN `linked_task_id` BIGINT UNSIGNED DEFAULT NULL,
  ADD COLUMN `linked_intervention_id` BIGINT UNSIGNED DEFAULT NULL;

ALTER TABLE `iset_document`
  ADD INDEX `idx_iset_document_category` (`document_category`),
  ADD INDEX `idx_iset_document_visibility` (`visibility`),
  ADD INDEX `idx_iset_document_linked_task` (`linked_task_id`),
  ADD INDEX `idx_iset_document_linked_intervention` (`linked_intervention_id`);

ALTER TABLE `iset_document`
  ADD CONSTRAINT `fk_iset_document_task`
    FOREIGN KEY (`linked_task_id`) REFERENCES `iset_case_task` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_iset_document_intervention`
    FOREIGN KEY (`linked_intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE SET NULL;
