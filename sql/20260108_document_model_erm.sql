-- Document model ERM adjustments: action plan + multi-intervention links

-- Add action_plan_id to iset_document
ALTER TABLE `iset_document`
  ADD COLUMN `action_plan_id` BIGINT UNSIGNED DEFAULT NULL AFTER `case_id`,
  ADD INDEX `idx_iset_document_action_plan` (`action_plan_id`),
  ADD CONSTRAINT `fk_iset_document_action_plan`
    FOREIGN KEY (`action_plan_id`) REFERENCES `iset_case_action_plan` (`id`) ON DELETE SET NULL;

-- Join table for multi-intervention links
CREATE TABLE IF NOT EXISTS `iset_document_intervention` (
  `document_id` BIGINT UNSIGNED NOT NULL,
  `intervention_id` BIGINT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`document_id`, `intervention_id`),
  KEY `idx_document_intervention_intervention` (`intervention_id`),
  CONSTRAINT `fk_document_intervention_doc`
    FOREIGN KEY (`document_id`) REFERENCES `iset_document` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_document_intervention_intervention`
    FOREIGN KEY (`intervention_id`) REFERENCES `iset_case_intervention` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Expand document_type scope enum
ALTER TABLE `document_type`
  MODIFY `scope` ENUM('client','application','case','action_plan','payment_packet') NOT NULL DEFAULT 'application';

-- Re-scope document types
UPDATE `document_type`
  SET `scope` = 'client'
  WHERE `code` IN (
    'indigenous_declaration',
    'status_card',
    'identity_document',
    'letter_of_reference',
    'resume',
    'iset_client_info_release'
  );

UPDATE `document_type`
  SET `scope` = 'application'
  WHERE `code` IN (
    'application_form',
    'ei_consent',
    'ei_verification',
    'conflict_of_interest',
    'supporting_evidence',
    'client_acknowledgement',
    'release_student_info',
    'media_consent',
    'financial_overview',
    'financial_records',
    'financial_evidence',
    'statement_of_account',
    'acceptance_letter',
    'band_funding_confirmation',
    'band_funding_denial',
    'medical_documentation',
    'assessment_approval_letter',
    'assessment_denial_letter'
  );

UPDATE `document_type`
  SET `scope` = 'case'
  WHERE `code` IN ('case_assessment');

UPDATE `document_type`
  SET `scope` = 'action_plan'
  WHERE `code` IN (
    'funding_agreement',
    'attendance_form',
    'wage_plan',
    'employer_duties_letter',
    'employer_offer_letter_after_subsidy',
    'equipment_quote',
    'institution_letter'
  );

UPDATE `document_type`
  SET `scope` = 'payment_packet'
  WHERE `code` IN (
    'receipt',
    'voided_cheque',
    'alternate_payee_letter'
  );

-- Drop single-intervention link column (replaced by join table)
ALTER TABLE `iset_document` DROP FOREIGN KEY `fk_iset_document_intervention`;
ALTER TABLE `iset_document` DROP INDEX `idx_iset_document_linked_intervention`;
ALTER TABLE `iset_document` DROP COLUMN `linked_intervention_id`;
