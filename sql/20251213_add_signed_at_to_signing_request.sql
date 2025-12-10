ALTER TABLE `signing_request`
  ADD COLUMN `signed_at` DATETIME NULL AFTER `status`;
