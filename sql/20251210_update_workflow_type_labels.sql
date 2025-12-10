-- Remap workflow_type values to the new taxonomy and set the default.

-- Normalize existing rows
UPDATE `iset_intake`.`workflow`
  SET workflow_type = 'main-intake'
  WHERE workflow_type IS NULL
     OR workflow_type = ''
     OR workflow_type = 'intake-application';

UPDATE `iset_intake`.`workflow`
  SET workflow_type = 'consent-no-prefill'
  WHERE workflow_type IN ('signature-request', 'attachment-request');

-- Enforce new default
ALTER TABLE `iset_intake`.`workflow`
  MODIFY `workflow_type` VARCHAR(64) NOT NULL DEFAULT 'main-intake';
