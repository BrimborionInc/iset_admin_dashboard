-- Targeted in-place PROD runtime patch for workflow 21.
-- This does not copy DEV/TEST runtime data or workflow authoring rows.
--
-- Changes:
--   1. Six remaining image-only upload components: image/* -> image/*,.pdf
--   2. Contact Information / address-postcode: inputMode -> text
-- Both schema copies in the published payload are changed.

START TRANSACTION;

SET @expected_checksum = 'de1c4b586fabb7b97ff2ebd6919a7ac1b75328eb79153553679232ecbef6eb35';
SET @backup_scope = 'ops-backup';
SET @backup_key = 'workflow.schema.intake.pre-20260728-pdf-postcode';

SET @target_id = (
  SELECT id
  FROM iset_runtime_config
  WHERE scope = 'publish'
    AND k = 'workflow.schema.intake'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.workflowId')) = '21'
    AND JSON_LENGTH(JSON_EXTRACT(v, '$.schema')) = 26
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum')) = @expected_checksum
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.checksum')) = @expected_checksum
    AND JSON_CONTAINS_PATH(v, 'one', '$.meta.devOnlyExperiment') = 0
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[2].id')) = 'govt-id'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[2].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[20].id')) = 'tuition-fees-statement'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[20].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[21].id')) = 'books-program-materials-proof'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[21].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[22].id')) = 'transportation-pass-cost-proof'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[22].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[23].id')) = 'transportation-mileage-insurance-docs'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[23].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[24].id')) = 'childcare-cost-documentation'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[24].components[24].accept')) = 'image/*'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[9].components[5].id')) = 'address-postcode'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schema[9].components[5].inputType')) = 'text'
    AND JSON_CONTAINS_PATH(v, 'one', '$.schema[9].components[5].inputMode') = 0
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schemaEnvelope.steps[9].components[5].id')) = 'address-postcode'
    AND JSON_UNQUOTE(JSON_EXTRACT(v, '$.schemaEnvelope.steps[9].components[5].inputType')) = 'text'
    AND JSON_CONTAINS_PATH(v, 'one', '$.schemaEnvelope.steps[9].components[5].inputMode') = 0
  LIMIT 1
);

INSERT INTO iset_runtime_config (scope, k, v)
SELECT @backup_scope, @backup_key, v
FROM iset_runtime_config
WHERE id = @target_id;

SET @original = (
  SELECT v
  FROM iset_runtime_config
  WHERE id = @target_id
);

SET @patched_without_checksum = JSON_SET(
  JSON_REMOVE(@original, '$.checksum', '$.meta.checksum'),
  '$.schema[24].components[2].accept', 'image/*,.pdf',
  '$.schema[24].components[20].accept', 'image/*,.pdf',
  '$.schema[24].components[21].accept', 'image/*,.pdf',
  '$.schema[24].components[22].accept', 'image/*,.pdf',
  '$.schema[24].components[23].accept', 'image/*,.pdf',
  '$.schema[24].components[24].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[2].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[20].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[21].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[22].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[23].accept', 'image/*,.pdf',
  '$.schemaEnvelope.steps[24].components[24].accept', 'image/*,.pdf',
  '$.schema[9].components[5].inputMode', 'text',
  '$.schemaEnvelope.steps[9].components[5].inputMode', 'text'
);

SET @new_checksum = LOWER(SHA2(CAST(@patched_without_checksum AS CHAR CHARACTER SET utf8mb4), 256));
SET @patched = JSON_SET(
  @patched_without_checksum,
  '$.checksum', @new_checksum,
  '$.meta.checksum', @new_checksum
);

UPDATE iset_runtime_config
SET v = @patched
WHERE id = @target_id
  AND @target_id IS NOT NULL;

SET @updated_rows = ROW_COUNT();

COMMIT;

SELECT
  @target_id AS target_id,
  @updated_rows AS updated_rows,
  @expected_checksum AS previous_checksum,
  @new_checksum AS new_checksum,
  @backup_scope AS backup_scope,
  @backup_key AS backup_key;

SELECT
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.workflowId')) AS workflow_id,
  JSON_LENGTH(JSON_EXTRACT(v, '$.schema')) AS step_count,
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum')) AS checksum,
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.meta.checksum')) AS meta_checksum,
  JSON_CONTAINS_PATH(v, 'one', '$.meta.devOnlyExperiment') AS has_dev_experiment,
  updated_at
FROM iset_runtime_config
WHERE scope = 'publish'
  AND k = 'workflow.schema.intake';

