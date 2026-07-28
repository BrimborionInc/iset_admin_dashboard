SELECT
  COUNT(*) AS backup_rows,
  JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum')) AS backup_checksum
FROM iset_runtime_config
WHERE scope = 'ops-backup'
  AND k = 'workflow.schema.intake.pre-20260728-pdf-postcode'
GROUP BY JSON_UNQUOTE(JSON_EXTRACT(v, '$.checksum'));

SELECT
  copies.copy_name,
  jt.step_ord,
  jt.step_title,
  jt.component_ord,
  jt.component_id,
  jt.accept_value,
  jt.input_mode,
  jt.input_type
FROM (
  SELECT 'schema' AS copy_name, JSON_EXTRACT(v, '$.schema') AS steps
  FROM iset_runtime_config
  WHERE scope = 'publish' AND k = 'workflow.schema.intake'
  UNION ALL
  SELECT 'schemaEnvelope' AS copy_name, JSON_EXTRACT(v, '$.schemaEnvelope.steps') AS steps
  FROM iset_runtime_config
  WHERE scope = 'publish' AND k = 'workflow.schema.intake'
) copies
JOIN JSON_TABLE(
  copies.steps,
  '$[*]' COLUMNS(
    step_ord FOR ORDINALITY,
    step_title VARCHAR(255) PATH '$.title.en' NULL ON EMPTY,
    NESTED PATH '$.components[*]' COLUMNS(
      component_ord FOR ORDINALITY,
      component_id VARCHAR(128) PATH '$.id',
      accept_value VARCHAR(255) PATH '$.accept' NULL ON EMPTY,
      input_mode VARCHAR(64) PATH '$.inputMode' NULL ON EMPTY,
      input_type VARCHAR(64) PATH '$.inputType' NULL ON EMPTY
    )
  )
) jt
WHERE jt.component_id IN (
  'govt-id',
  'tuition-fees-statement',
  'books-program-materials-proof',
  'transportation-pass-cost-proof',
  'transportation-mileage-insurance-docs',
  'childcare-cost-documentation',
  'address-postcode'
)
ORDER BY copies.copy_name, jt.step_ord, jt.component_ord;

SELECT
  CAST(JSON_REMOVE(
    current_row.v,
    '$.checksum',
    '$.meta.checksum',
    '$.schema[24].components[2].accept',
    '$.schema[24].components[20].accept',
    '$.schema[24].components[21].accept',
    '$.schema[24].components[22].accept',
    '$.schema[24].components[23].accept',
    '$.schema[24].components[24].accept',
    '$.schemaEnvelope.steps[24].components[2].accept',
    '$.schemaEnvelope.steps[24].components[20].accept',
    '$.schemaEnvelope.steps[24].components[21].accept',
    '$.schemaEnvelope.steps[24].components[22].accept',
    '$.schemaEnvelope.steps[24].components[23].accept',
    '$.schemaEnvelope.steps[24].components[24].accept',
    '$.schema[9].components[5].inputMode',
    '$.schemaEnvelope.steps[9].components[5].inputMode'
  ) AS CHAR) = CAST(JSON_REMOVE(
    backup_row.v,
    '$.checksum',
    '$.meta.checksum',
    '$.schema[24].components[2].accept',
    '$.schema[24].components[20].accept',
    '$.schema[24].components[21].accept',
    '$.schema[24].components[22].accept',
    '$.schema[24].components[23].accept',
    '$.schema[24].components[24].accept',
    '$.schemaEnvelope.steps[24].components[2].accept',
    '$.schemaEnvelope.steps[24].components[20].accept',
    '$.schemaEnvelope.steps[24].components[21].accept',
    '$.schemaEnvelope.steps[24].components[22].accept',
    '$.schemaEnvelope.steps[24].components[23].accept',
    '$.schemaEnvelope.steps[24].components[24].accept',
    '$.schema[9].components[5].inputMode',
    '$.schemaEnvelope.steps[9].components[5].inputMode'
  ) AS CHAR) AS unchanged_except_approved_paths
FROM iset_runtime_config current_row
JOIN iset_runtime_config backup_row
  ON backup_row.scope = 'ops-backup'
  AND backup_row.k = 'workflow.schema.intake.pre-20260728-pdf-postcode'
WHERE current_row.scope = 'publish'
  AND current_row.k = 'workflow.schema.intake';
