-- Payments module core tables: packets, lines, evidence, batches, and audit trail.
-- Place in admin-dashboard/sql so the admin migration runner picks it up on startup.

CREATE TABLE IF NOT EXISTS `payee_profile` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payee_type` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `external_reference` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` ENUM('active','inactive') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payee_profile_type` (`payee_type`),
  KEY `idx_payee_profile_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_packet` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `case_id` BIGINT UNSIGNED DEFAULT NULL,
  `client_id` BIGINT UNSIGNED DEFAULT NULL,
  `intervention_id` BIGINT UNSIGNED DEFAULT NULL,
  `reporting_unit` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` ENUM(
    'draft',
    'submitted',
    'program_review',
    'returned',
    'program_approved',
    'finance_review',
    'finance_approved',
    'on_hold',
    'batched',
    'sent',
    'confirmed',
    'closed',
    'cancelled'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `requester_user_id` INT DEFAULT NULL,
  `program_approved_by_user_id` INT DEFAULT NULL,
  `finance_approved_by_user_id` INT DEFAULT NULL,
  `submitted_at` TIMESTAMP NULL DEFAULT NULL,
  `program_approved_at` TIMESTAMP NULL DEFAULT NULL,
  `finance_approved_at` TIMESTAMP NULL DEFAULT NULL,
  `sent_at` TIMESTAMP NULL DEFAULT NULL,
  `confirmed_at` TIMESTAMP NULL DEFAULT NULL,
  `due_by` DATE DEFAULT NULL,
  `notes_internal` TEXT COLLATE utf8mb4_unicode_ci,
  `risk_flags` JSON DEFAULT NULL,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_packet_status` (`status`),
  KEY `idx_payment_packet_case` (`case_id`),
  KEY `idx_payment_packet_client` (`client_id`),
  KEY `idx_payment_packet_reporting_unit` (`reporting_unit`),
  CONSTRAINT `fk_payment_packet_case` FOREIGN KEY (`case_id`) REFERENCES `iset_case` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_client` FOREIGN KEY (`client_id`) REFERENCES `client` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_intervention` FOREIGN KEY (`intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_requester` FOREIGN KEY (`requester_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_program_approved` FOREIGN KEY (`program_approved_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_finance_approved` FOREIGN KEY (`finance_approved_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_packet_line` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_id` BIGINT UNSIGNED NOT NULL,
  `intervention_id` BIGINT UNSIGNED DEFAULT NULL,
  `payment_type` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payee_type` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payee_name` VARCHAR(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `payee_profile_id` BIGINT UNSIGNED DEFAULT NULL,
  `payee_reference` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `amount` DECIMAL(14,2) NOT NULL,
  `currency` CHAR(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CAD',
  `service_period_start` DATE DEFAULT NULL,
  `service_period_end` DATE DEFAULT NULL,
  `invoice_reference_number` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `requested_payment_date` DATE DEFAULT NULL,
  `budget_pot_id` BIGINT UNSIGNED NOT NULL,
  `funding_stream` VARCHAR(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` ENUM(
    'needs_evidence',
    'ready_for_program',
    'ready_for_finance',
    'approved',
    'batched',
    'paid',
    'held',
    'cancelled'
  ) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'needs_evidence',
  `hold_reason` TEXT COLLATE utf8mb4_unicode_ci,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_line_packet` (`payment_packet_id`),
  KEY `idx_payment_line_intervention` (`intervention_id`),
  KEY `idx_payment_line_pot` (`budget_pot_id`),
  KEY `idx_payment_line_status` (`status`),
  CONSTRAINT `fk_payment_line_packet` FOREIGN KEY (`payment_packet_id`) REFERENCES `payment_packet` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_line_intervention` FOREIGN KEY (`intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_line_payee` FOREIGN KEY (`payee_profile_id`) REFERENCES `payee_profile` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_line_pot` FOREIGN KEY (`budget_pot_id`) REFERENCES `budget_pot` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_packet_document` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_id` BIGINT UNSIGNED NOT NULL,
  `payment_packet_line_id` BIGINT UNSIGNED DEFAULT NULL,
  `document_id` BIGINT UNSIGNED NOT NULL,
  `evidence_type` VARCHAR(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `required` TINYINT(1) NOT NULL DEFAULT 0,
  `received_at` TIMESTAMP NULL DEFAULT NULL,
  `verified_by_user_id` INT DEFAULT NULL,
  `verified_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT COLLATE utf8mb4_unicode_ci,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_packet_document_packet` (`payment_packet_id`),
  KEY `idx_payment_packet_document_line` (`payment_packet_line_id`),
  KEY `idx_payment_packet_document_doc` (`document_id`),
  CONSTRAINT `fk_payment_packet_document_packet` FOREIGN KEY (`payment_packet_id`) REFERENCES `payment_packet` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_packet_document_line` FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_packet_document_doc` FOREIGN KEY (`document_id`) REFERENCES `iset_document` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_packet_document_verified_by` FOREIGN KEY (`verified_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_status_event` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_id` BIGINT UNSIGNED NOT NULL,
  `payment_packet_line_id` BIGINT UNSIGNED DEFAULT NULL,
  `from_status` VARCHAR(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `to_status` VARCHAR(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `actor_user_id` INT DEFAULT NULL,
  `notes` TEXT COLLATE utf8mb4_unicode_ci,
  `metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_status_event_packet` (`payment_packet_id`),
  KEY `idx_payment_status_event_line` (`payment_packet_line_id`),
  KEY `idx_payment_status_event_to` (`to_status`),
  CONSTRAINT `fk_payment_status_event_packet` FOREIGN KEY (`payment_packet_id`) REFERENCES `payment_packet` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_status_event_line` FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_status_event_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_batch` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `status` ENUM('draft','approved','exported','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `total_amount` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  `currency` CHAR(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CAD',
  `created_by_user_id` INT DEFAULT NULL,
  `approved_by_user_id` INT DEFAULT NULL,
  `approved_at` TIMESTAMP NULL DEFAULT NULL,
  `exported_at` TIMESTAMP NULL DEFAULT NULL,
  `export_metadata` JSON DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payment_batch_status` (`status`),
  CONSTRAINT `fk_payment_batch_created_by` FOREIGN KEY (`created_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_payment_batch_approved_by` FOREIGN KEY (`approved_by_user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_batch_line` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_batch_id` BIGINT UNSIGNED NOT NULL,
  `payment_packet_line_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_batch_line` (`payment_batch_id`,`payment_packet_line_id`),
  KEY `idx_payment_batch_line_line` (`payment_packet_line_id`),
  CONSTRAINT `fk_payment_batch_line_batch` FOREIGN KEY (`payment_batch_id`) REFERENCES `payment_batch` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_batch_line_line` FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `payment_line_transaction` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `payment_packet_line_id` BIGINT UNSIGNED NOT NULL,
  `finance_transaction_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_payment_line_tx` (`payment_packet_line_id`,`finance_transaction_id`),
  KEY `idx_payment_line_tx_finance` (`finance_transaction_id`),
  CONSTRAINT `fk_payment_line_tx_line` FOREIGN KEY (`payment_packet_line_id`) REFERENCES `payment_packet_line` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payment_line_tx_finance` FOREIGN KEY (`finance_transaction_id`) REFERENCES `finance_transaction` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
