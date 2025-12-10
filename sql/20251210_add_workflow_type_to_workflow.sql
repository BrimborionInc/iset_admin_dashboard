-- Adds workflow_type to classify workflows (e.g., signature-request vs intake-application).
ALTER TABLE `iset_intake`.`workflow`
  ADD COLUMN `workflow_type` VARCHAR(64) NOT NULL DEFAULT 'intake-application' AFTER `status`;
