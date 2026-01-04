-- Add paid metadata fields to payment lines for finance confirmations.
ALTER TABLE `payment_packet_line`
  ADD COLUMN `paid_at` DATETIME NULL AFTER `status`,
  ADD COLUMN `payment_reference` VARCHAR(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL AFTER `paid_at`,
  ADD COLUMN `payment_proof_document_id` BIGINT UNSIGNED DEFAULT NULL AFTER `payment_reference`,
  ADD KEY `idx_payment_line_paid_at` (`paid_at`),
  ADD CONSTRAINT `fk_payment_line_payment_proof` FOREIGN KEY (`payment_proof_document_id`) REFERENCES `iset_document` (`id`) ON DELETE SET NULL;
