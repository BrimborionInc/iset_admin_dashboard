

const crypto = require('crypto');
const mysql = require('mysql2');

const SOURCE_ENVIRONMENTS = ['dev'];
const TARGET_ENVIRONMENTS = ['dev', 'test', 'prod'];

function datasetError(message) {
  const error = new Error(message);
  error.name = 'PathDataSyncError';
  return error;
}

function requireWorkflowId(options) {
  const raw = options.workflowId;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw datasetError('workflow promotion datasets require --workflow-id <positive integer>');
  }
  return parsed;
}

function escapeValue(value) {
  return mysql.escape(value);
}

function numericLiteral(value) {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return String(Number(value));
}

function dateTimeLiteral(value) {
  if (!value) {
    return 'NULL';
  }
  return escapeValue(value);
}

function jsonLiteral(jsonText) {
  if (jsonText === null || jsonText === undefined) {
    return 'NULL';
  }
  const base64 = Buffer.from(String(jsonText), 'utf8').toString('base64');
  return `CAST(CONVERT(FROM_BASE64(${escapeValue(base64)}) USING utf8mb4) AS JSON)`;
}

function checksumForString(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function toPositiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseRuntimePayload(valueJson) {
  try {
    return JSON.parse(valueJson);
  } catch (error) {
    throw datasetError(`Source DEV row publish/workflow.schema.intake does not contain valid JSON: ${error.message}`);
  }
}

function firstDefined(...values) {
  return values.find(value => value !== undefined && value !== null && value !== '');
}

function describeRuntimePayload(payload) {
  const meta = payload && typeof payload === 'object' ? payload.meta || {} : {};
  const schemaMeta = meta && typeof meta === 'object' ? meta.schemaMeta || {} : {};
  const envelopeMeta = payload && typeof payload === 'object' && payload.schemaEnvelope
    ? payload.schemaEnvelope.meta || {}
    : {};
  const workflow = schemaMeta.workflow || envelopeMeta.workflow || payload?.workflow || {};
  const rawWorkflowId = firstDefined(
    meta.workflowId,
    workflow.id,
    payload?.workflowId,
    payload?.version && String(payload.version).includes('#') ? String(payload.version).split('#').pop() : null
  );

  return {
    workflowId: toPositiveInteger(rawWorkflowId),
    workflowName: firstDefined(workflow.name, payload?.workflowName, null),
    workflowStatus: firstDefined(workflow.status, null),
    workflowType: firstDefined(workflow.type, workflow.workflow_type, null),
    version: firstDefined(payload?.version, null),
    publishedAt: firstDefined(payload?.publishedAt, null),
    generatedAt: firstDefined(meta.generatedAt, schemaMeta.generatedAt, envelopeMeta.generatedAt, null),
    checksum: firstDefined(payload?.checksum, meta.checksum, null),
  };
}

function validateRuntimeWorkflowMatch(runtimeMeta, expectedWorkflowId) {
  const expected = requireWorkflowId({ workflowId: expectedWorkflowId });
  if (!runtimeMeta.workflowId) {
    throw datasetError(
      `Source DEV publish/workflow.schema.intake does not declare a workflow id; refusing to promote it with --workflow-id ${expected}. Republish workflow ${expected} before promoting.`
    );
  }
  if (runtimeMeta.workflowId !== expected) {
    const runtimeLabel = runtimeMeta.workflowName
      ? `${runtimeMeta.workflowId} (${runtimeMeta.workflowName})`
      : String(runtimeMeta.workflowId);
    throw datasetError(
      `Source DEV publish/workflow.schema.intake belongs to workflow ${runtimeLabel}, not requested workflow ${expected}; refusing to build promotion bundle. Republish workflow ${expected} before promoting.`
    );
  }
}

async function loadRuntimeConfigRow(pool, { scope, key }) {
  const [rows] = await pool.query(
    `SELECT id,
            scope,
            k,
            CAST(v AS CHAR CHARACTER SET utf8mb4) AS value_json,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM iset_runtime_config
      WHERE scope = ? AND k = ?
      LIMIT 1`,
    [scope, key]
  );
  return rows[0] || null;
}

async function buildIntakeRuntimePublishDataset(pool, options = {}) {
  const row = await loadRuntimeConfigRow(pool, {
    scope: 'publish',
    key: 'workflow.schema.intake',
  });

  if (!row) {
    throw datasetError("Source DEV row publish/workflow.schema.intake was not found in iset_runtime_config");
  }
  const runtimePayload = parseRuntimePayload(row.value_json);
  const runtimeMeta = describeRuntimePayload(runtimePayload);
  validateRuntimeWorkflowMatch(runtimeMeta, options.workflowId);

  return {
    summary: {
      configRow: {
        id: row.id,
        scope: row.scope,
        key: row.k,
        updatedAt: row.updated_at,
        jsonLength: row.value_json ? row.value_json.length : 0,
        checksum: checksumForString(row.value_json),
      },
      runtime: runtimeMeta,
    },
    warnings: [],
    statements: [
      `INSERT INTO iset_runtime_config (scope, k, v)
VALUES (${escapeValue(row.scope)}, ${escapeValue(row.k)}, ${jsonLiteral(row.value_json)})
ON DUPLICATE KEY UPDATE
  v = VALUES(v),
  updated_at = CURRENT_TIMESTAMP`,
    ],
  };
}

function appendInsertValues(lines, tableName, columns, rowSqlValues, onDuplicateSql) {
  if (!rowSqlValues.length) {
    return;
  }
  lines.push(`INSERT INTO ${tableName} (${columns.join(', ')})`);
  lines.push('VALUES');
  lines.push(`  ${rowSqlValues.join(',\n  ')}`);
  if (onDuplicateSql) {
    lines.push(`ON DUPLICATE KEY UPDATE ${onDuplicateSql}`);
  }
}

async function buildWorkflowAuthoringDataset(pool, options = {}) {
  const workflowId = requireWorkflowId(options);

  const [workflowRows] = await pool.query(
    `SELECT id,
            name,
            status,
            workflow_type,
            document_type,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM workflow
      WHERE id = ?
      LIMIT 1`,
    [workflowId]
  );
  const workflow = workflowRows[0];
  if (!workflow) {
    throw datasetError(`Source DEV workflow ${workflowId} was not found`);
  }

  const [workflowStepRows] = await pool.query(
    `SELECT workflow_id, step_id, is_start
       FROM workflow_step
      WHERE workflow_id = ?
      ORDER BY step_id ASC`,
    [workflowId]
  );

  const stepIds = workflowStepRows.map(row => Number(row.step_id));
  if (!stepIds.length) {
    throw datasetError(`Source DEV workflow ${workflowId} has no workflow_step rows`);
  }

  const [stepRows] = await pool.query(
    `SELECT id,
            name,
            status,
            CAST(ui_meta AS CHAR CHARACTER SET utf8mb4) AS ui_meta_json,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM step
      WHERE id IN (?)
      ORDER BY id ASC`,
    [stepIds]
  );

  const [componentRows] = await pool.query(
    `SELECT step_id,
            position,
            template_id,
            CAST(props_overrides AS CHAR CHARACTER SET utf8mb4) AS props_json,
            DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
            DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS updated_at
       FROM step_component
      WHERE step_id IN (?)
      ORDER BY step_id ASC, position ASC`,
    [stepIds]
  );

  const [routeRows] = await pool.query(
    `SELECT workflow_id, source_step_id, mode, field_key, default_next_step_id
       FROM workflow_route
      WHERE workflow_id = ?
      ORDER BY source_step_id ASC`,
    [workflowId]
  );

  const [routeOptionRows] = await pool.query(
    `SELECT workflow_id, source_step_id, option_value, next_step_id
       FROM workflow_route_option
      WHERE workflow_id = ?
      ORDER BY source_step_id ASC, option_value ASC`,
    [workflowId]
  );

  const [sharedStepRows] = await pool.query(
    `SELECT ws.step_id,
            s.name,
            COUNT(DISTINCT ws.workflow_id) AS workflow_count,
            GROUP_CONCAT(DISTINCT ws.workflow_id ORDER BY ws.workflow_id SEPARATOR ',') AS workflow_ids
       FROM workflow_step ws
       JOIN step s ON s.id = ws.step_id
      WHERE ws.step_id IN (?)
      GROUP BY ws.step_id, s.name
     HAVING COUNT(DISTINCT ws.workflow_id) > 1
      ORDER BY ws.step_id ASC`,
    [stepIds]
  );

  const componentPositionsByStep = new Map();
  componentRows.forEach(row => {
    const stepId = Number(row.step_id);
    if (!componentPositionsByStep.has(stepId)) {
      componentPositionsByStep.set(stepId, []);
    }
    componentPositionsByStep.get(stepId).push(Number(row.position));
  });

  const statements = [];
  statements.push(
    `INSERT INTO workflow (id, name, status, workflow_type, document_type, created_at, updated_at)
VALUES (${numericLiteral(workflow.id)}, ${escapeValue(workflow.name)}, ${escapeValue(workflow.status)}, ${escapeValue(workflow.workflow_type)}, ${escapeValue(workflow.document_type)}, ${dateTimeLiteral(workflow.created_at)}, ${dateTimeLiteral(workflow.updated_at)})
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  status = VALUES(status),
  workflow_type = VALUES(workflow_type),
  document_type = VALUES(document_type),
  updated_at = VALUES(updated_at)`
  );

  const stepValueRows = stepRows.map(row =>
    `(${numericLiteral(row.id)}, ${escapeValue(row.name)}, ${escapeValue(row.status)}, ${jsonLiteral(row.ui_meta_json)}, ${dateTimeLiteral(row.created_at)}, ${dateTimeLiteral(row.updated_at)})`
  );
  const stepInsertLines = [];
  appendInsertValues(
    stepInsertLines,
    'step',
    ['id', 'name', 'status', 'ui_meta', 'created_at', 'updated_at'],
    stepValueRows,
    'name = VALUES(name), status = VALUES(status), ui_meta = VALUES(ui_meta), updated_at = VALUES(updated_at)'
  );
  statements.push(stepInsertLines.join('\n'));

  stepIds.forEach(stepId => {
    const positions = componentPositionsByStep.get(stepId) || [];
    if (!positions.length) {
      statements.push(`DELETE FROM step_component WHERE step_id = ${numericLiteral(stepId)}`);
      return;
    }
    statements.push(
      `DELETE FROM step_component
WHERE step_id = ${numericLiteral(stepId)}
  AND position NOT IN (${positions.map(position => numericLiteral(position)).join(', ')})`
    );
  });

  const componentValueRows = componentRows.map(row =>
    `(${numericLiteral(row.step_id)}, ${numericLiteral(row.position)}, ${numericLiteral(row.template_id)}, ${jsonLiteral(row.props_json)}, ${dateTimeLiteral(row.created_at)}, ${dateTimeLiteral(row.updated_at)})`
  );
  const componentInsertLines = [];
  appendInsertValues(
    componentInsertLines,
    'step_component',
    ['step_id', 'position', 'template_id', 'props_overrides', 'created_at', 'updated_at'],
    componentValueRows,
    'template_id = VALUES(template_id), props_overrides = VALUES(props_overrides), updated_at = VALUES(updated_at)'
  );
  statements.push(componentInsertLines.join('\n'));

  statements.push(`DELETE FROM workflow_route_option WHERE workflow_id = ${numericLiteral(workflowId)}`);
  statements.push(`DELETE FROM workflow_route WHERE workflow_id = ${numericLiteral(workflowId)}`);
  statements.push(`DELETE FROM workflow_step WHERE workflow_id = ${numericLiteral(workflowId)}`);

  const workflowStepValueRows = workflowStepRows.map(row =>
    `(${numericLiteral(row.workflow_id)}, ${numericLiteral(row.step_id)}, ${numericLiteral(row.is_start)})`
  );
  const workflowStepInsertLines = [];
  appendInsertValues(
    workflowStepInsertLines,
    'workflow_step',
    ['workflow_id', 'step_id', 'is_start'],
    workflowStepValueRows,
    null
  );
  statements.push(workflowStepInsertLines.join('\n'));

  const routeValueRows = routeRows.map(row =>
    `(${numericLiteral(row.workflow_id)}, ${numericLiteral(row.source_step_id)}, ${escapeValue(row.mode)}, ${escapeValue(row.field_key)}, ${numericLiteral(row.default_next_step_id)})`
  );
  if (routeValueRows.length) {
    const routeInsertLines = [];
    appendInsertValues(
      routeInsertLines,
      'workflow_route',
      ['workflow_id', 'source_step_id', 'mode', 'field_key', 'default_next_step_id'],
      routeValueRows,
      null
    );
    statements.push(routeInsertLines.join('\n'));
  }

  const routeOptionValueRows = routeOptionRows.map(row =>
    `(${numericLiteral(row.workflow_id)}, ${numericLiteral(row.source_step_id)}, ${escapeValue(row.option_value)}, ${numericLiteral(row.next_step_id)})`
  );
  if (routeOptionValueRows.length) {
    const routeOptionInsertLines = [];
    appendInsertValues(
      routeOptionInsertLines,
      'workflow_route_option',
      ['workflow_id', 'source_step_id', 'option_value', 'next_step_id'],
      routeOptionValueRows,
      null
    );
    statements.push(routeOptionInsertLines.join('\n'));
  }

  return {
    summary: {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        status: workflow.status,
        workflowType: workflow.workflow_type,
        documentType: workflow.document_type,
      },
      counts: {
        workflowSteps: workflowStepRows.length,
        steps: stepRows.length,
        stepComponents: componentRows.length,
        routes: routeRows.length,
        routeOptions: routeOptionRows.length,
      },
      sharedSteps: sharedStepRows.map(row => ({
        stepId: Number(row.step_id),
        name: row.name,
        workflowCount: Number(row.workflow_count),
        workflowIds: String(row.workflow_ids || '').split(',').filter(Boolean).map(Number),
      })),
    },
    warnings: sharedStepRows.map(row =>
      `Step ${row.step_id} (${row.name}) is shared by workflows ${row.workflow_ids}; syncing it will also align that shared step definition in the target environment.`
    ),
    statements,
  };
}

async function buildIntakeReleaseDataset(pool, options = {}) {
  const workflowData = await buildWorkflowAuthoringDataset(pool, options);
  const runtimeData = await buildIntakeRuntimePublishDataset(pool, options);
  return {
    summary: {
      workflowAuthoring: workflowData.summary,
      runtimePublish: runtimeData.summary,
    },
    warnings: [...workflowData.warnings, ...runtimeData.warnings],
    statements: [...workflowData.statements, ...runtimeData.statements],
  };
}

const DATASETS = {
  'intake-runtime-publish': {
    name: 'intake-runtime-publish',
    classification: 'config',
    description: 'Upsert the published intake runtime-config row (`publish/workflow.schema.intake`) only when it matches --workflow-id.',
    sourceEnvironments: SOURCE_ENVIRONMENTS,
    targetEnvironments: TARGET_ENVIRONMENTS,
    requiredOptions: ['workflowId'],
    prodRule: 'Allowed only when the published runtime row declares the same workflow id as --workflow-id.',
    build: buildIntakeRuntimePublishDataset,
  },
  'workflow-authoring': {
    name: 'workflow-authoring',
    classification: 'config',
    description: 'Sync one workflow authoring graph (`workflow`, `step`, `step_component`, `workflow_step`, `workflow_route`, `workflow_route_option`) for a specific workflow ID.',
    sourceEnvironments: SOURCE_ENVIRONMENTS,
    targetEnvironments: TARGET_ENVIRONMENTS,
    requiredOptions: ['workflowId'],
    prodRule: 'Allowed with care. This keeps admin-side authoring data aligned, but portal behavior still depends on the published runtime-config row.',
    build: buildWorkflowAuthoringDataset,
  },
  'intake-release': {
    name: 'intake-release',
    classification: 'config',
    description: 'Promote both the workflow authoring graph for one workflow ID and the matching published intake runtime-config row.',
    sourceEnvironments: SOURCE_ENVIRONMENTS,
    targetEnvironments: TARGET_ENVIRONMENTS,
    requiredOptions: ['workflowId'],
    prodRule: 'Allowed only when the published runtime row declares the same workflow id as --workflow-id.',
    build: buildIntakeReleaseDataset,
  },
};

function listDatasets() {
  return Object.values(DATASETS).map(dataset => ({
    name: dataset.name,
    classification: dataset.classification,
    description: dataset.description,
    sourceEnvironments: dataset.sourceEnvironments,
    targetEnvironments: dataset.targetEnvironments,
    requiredOptions: dataset.requiredOptions || [],
    prodRule: dataset.prodRule,
  }));
}

function getDataset(name) {
  return DATASETS[name] || null;
}

async function buildDataset(pool, datasetName, options = {}) {
  const dataset = getDataset(datasetName);
  if (!dataset) {
    throw datasetError(`Unknown dataset: ${datasetName}`);
  }
  if (options.sourceEnv && !dataset.sourceEnvironments.includes(options.sourceEnv)) {
    throw datasetError(`Dataset ${datasetName} does not support source environment ${options.sourceEnv}`);
  }
  if (options.targetEnv && !dataset.targetEnvironments.includes(options.targetEnv)) {
    throw datasetError(`Dataset ${datasetName} does not support target environment ${options.targetEnv}`);
  }
  const missingOptions = (dataset.requiredOptions || [])
    .filter(option => options[option] === undefined || options[option] === null || options[option] === '');
  if (missingOptions.length) {
    const flags = missingOptions.map(option => `--${option.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`);
    throw datasetError(`Dataset ${datasetName} requires ${flags.join(', ')}`);
  }
  const built = await dataset.build(pool, options);
  return {
    dataset: {
      name: dataset.name,
      classification: dataset.classification,
      description: dataset.description,
      sourceEnvironments: dataset.sourceEnvironments,
      targetEnvironments: dataset.targetEnvironments,
      requiredOptions: dataset.requiredOptions || [],
      prodRule: dataset.prodRule,
    },
    ...built,
  };
}

module.exports = {
  listDatasets,
  getDataset,
  buildDataset,
};
