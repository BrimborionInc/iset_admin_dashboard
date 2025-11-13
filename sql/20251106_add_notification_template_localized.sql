-- Add JSON column to store localized notification template content
ALTER TABLE `notification_template`
  ADD COLUMN `localized` JSON NULL AFTER `content`;
