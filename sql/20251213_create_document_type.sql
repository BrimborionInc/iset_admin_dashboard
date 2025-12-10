-- Document types reference table and workflow linkage

CREATE TABLE IF NOT EXISTS `document_type` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(100) NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `description` TEXT DEFAULT NULL,
  `sort_order` INT DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_document_type_code` (`code`),
  KEY `idx_document_type_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `document_type` (`code`, `label`, `sort_order`) VALUES
  ('application_form', 'Application form (legacy)', 10),
  ('ei_consent', 'EI Consent Form', 20),
  ('ei_verification', 'EI Eligibility Verification', 30),
  ('indigenous_declaration', 'Indigenous declaration', 40),
  ('conflict_of_interest', 'Conflict of Interest Form', 50),
  ('identity_document', 'Identity document', 60),
  ('supporting_evidence', 'Supporting evidence', 70),
  ('client_acknowledgement', 'Client acknowledgement', 80),
  ('release_student_info', 'Release of student info', 90),
  ('media_consent', 'Media consent', 100),
  ('financial_overview', 'Financial overview/budget', 110),
  ('financial_records', 'Income evidence', 120),
  ('financial_evidence', 'Expense evidence', 130),
  ('statement_of_account', 'Statement of Account', 140),
  ('acceptance_letter', 'Letter of Acceptance', 150),
  ('band_funding_confirmation', 'Band funding confirmation', 160),
  ('band_funding_denial', 'Band funding denial', 170),
  ('medical_documentation', 'Medical documentation', 180),
  ('resume', 'Resume', 190),
  ('case_assessment', 'Case manager assessment', 200),
  ('funding_agreement', 'Funding agreement', 210),
  ('attendance_form', 'Attendance form', 220);

ALTER TABLE `iset_intake`.`workflow`
  ADD COLUMN `document_type` VARCHAR(100) DEFAULT NULL AFTER `workflow_type`;
