-- Restores the complete pre-patch PROD runtime payload saved by
-- prod-intake-runtime-pdf-postcode-apply-20260728.sql.

START TRANSACTION;

SET @backup_scope = 'ops-backup';
SET @backup_key = 'workflow.schema.intake.pre-20260728-pdf-postcode';

SET @backup_id = (
  SELECT id
  FROM iset_runtime_config
  WHERE scope = @backup_scope
    AND k = @backup_key
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.workflowId')) = '21'
    AND JSON_LENGTH(JSON_EXTRACT(v, '$.schema')) = 26
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum')) = 'de1c4b586fabb7b97ff2ebd6919a7ac1b75328eb79153553679232ecbef6eb35'
  LIMIT 1
);

UPDATE iset_runtime_config current_row
JOIN iset_runtime_config backup_row
  ON backup_row.id = @backup_id
SET current_row.v = backup_row.v
WHERE current_row.scope = 'publish'
  AND current_row.k = 'workflow.schema.intake'
  AND JSON_UNQUOTE(JSON_EXTRACT(current_row.v, '$.meta.workflowId')) = '21'
  AND JSON_UNQUOTE(JSON_EXTRACT(current_row.v, '$.schema[24].components[2].accept')) = 'image/*,.pdf'
  AND JSON_UNQUOTE(JSON_EXTRACT(current_row.v, '$.schema[9].components[5].inputMode')) = 'text';

SET @restored_rows = ROW_COUNT();

COMMIT;

SELECT
  @backup_id AS backup_id,
  @restored_rows AS restored_rows;

SELECT
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.workflowId')) AS workflow_id,
  JSON_LENGTH(JSON_EXTRACT(v, '$.schema')) AS step_count,
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum')) AS checksum,
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.checksum')) AS meta_checksum,
  updated_at
FROM iset_runtime_config
WHERE scope = 'publish'
  AND k = 'workflow.schema.intake';
