-- Classify document types by scope (client-level vs application-level).
ALTER TABLE `document_type`
  ADD COLUMN `scope` ENUM('client', 'application') NOT NULL DEFAULT 'application' AFTER `label`;

-- Backfill existing document types.
UPDATE `document_type`
SET `scope` = CASE `code`
  WHEN 'indigenous_declaration' THEN 'client'
  WHEN 'identity_document' THEN 'client'
  WHEN 'resume' THEN 'client'
  WHEN 'voided_cheque' THEN 'client'
  ELSE 'application'
END;
