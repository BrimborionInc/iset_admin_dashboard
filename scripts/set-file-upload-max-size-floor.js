#!/usr/bin/env node

/**
 * Raise authored file-upload component maxSizeMb values to a minimum floor.
 *
 * This script updates workflow authoring rows in the DB selected by --env-file.
 * It does not lower values already above the floor.
 */

const path = require('path');
const { spawnSync } = require('child_process');

let mysql;

function parseArgs(argv) {
  const options = {
    envFile: null,
    floor: 10,
    workflowIds: [],
    republishWorkflowIds: [],
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--env-file') options.envFile = argv[++i];
    else if (arg === '--floor') options.floor = Number(argv[++i]);
    else if (arg === '--workflow-id') options.workflowIds.push(Number(argv[++i]));
    else if (arg === '--republish-workflow-id') options.republishWorkflowIds.push(Number(argv[++i]));
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.floor) || options.floor <= 0) {
    throw new Error(`Invalid --floor value: ${options.floor}`);
  }

  options.workflowIds = Array.from(new Set(options.workflowIds.filter(Number.isFinite)));
  options.republishWorkflowIds = Array.from(new Set(options.republishWorkflowIds.filter(Number.isFinite)));

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/set-file-upload-max-size-floor.js [options]

Options:
  --env-file <path>             Env file for DB_* values (default: .env)
  --floor <mb>                  Minimum maxSizeMb to enforce (default: 10)
  --workflow-id <id>            Restrict updates to one workflow; repeatable
  --republish-workflow-id <id>  Republish these workflows after updating; repeatable
  --dry-run                     Show affected rows without updating them
  -h, --help                    Show help
`.trim());
}

function loadEnv(envFile) {
  const dotenv = require('dotenv');
  const resolved = envFile ? path.resolve(process.cwd(), envFile) : path.resolve(process.cwd(), '.env');
  dotenv.config({ path: resolved, override: true });
  return resolved;
}

async function connectDb() {
  if (!mysql) {
    mysql = require('mysql2/promise');
  }
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    throw new Error('DB_HOST and DB_NAME are required.');
  }
  return mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4_general_ci',
  });
}

function buildWorkflowFilter(workflowIds, params) {
  if (!workflowIds.length) return '';
  const placeholders = workflowIds.map(() => '?').join(', ');
  params.push(...workflowIds);
  return ` AND ws.workflow_id IN (${placeholders})`;
}

async function selectTargets(pool, workflowIds, floor) {
  const params = [floor];
  const workflowFilter = buildWorkflowFilter(workflowIds, params);
  const [rows] = await pool.query(
    `
      SELECT
        ws.workflow_id,
        w.name AS workflow_name,
        s.id AS step_id,
        s.name AS step_name,
        sc.id AS step_component_id,
        JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.id')) AS component_id,
        JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.name')) AS component_name,
        CAST(JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.maxSizeMb')) AS DECIMAL(10,2)) AS max_size_mb
      FROM workflow_step ws
      JOIN workflow w ON w.id = ws.workflow_id
      JOIN step s ON s.id = ws.step_id
      JOIN step_component sc ON sc.step_id = ws.step_id
      JOIN component_template ct ON ct.id = sc.template_id
      WHERE ct.template_key = 'file-upload'
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.maxSizeMb')) AS DECIMAL(10,2)) < ?
        ${workflowFilter}
      ORDER BY ws.workflow_id, ws.step_id, sc.position
    `,
    params
  );
  return rows;
}

async function applyFloor(pool, rowIds, floor) {
  if (!rowIds.length) return;
  const placeholders = rowIds.map(() => '?').join(', ');
  await pool.query(
    `
      UPDATE step_component
      SET props_overrides = JSON_SET(
            COALESCE(props_overrides, JSON_OBJECT()),
            '$.maxSizeMb', CAST(? AS UNSIGNED)
          ),
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})
    `,
    [floor, ...rowIds]
  );
}

function summarize(rows) {
  return rows.reduce((acc, row) => {
    const key = `${row.workflow_id}:${row.workflow_name}`;
    if (!acc[key]) {
      acc[key] = { workflowId: row.workflow_id, workflowName: row.workflow_name, count: 0 };
    }
    acc[key].count += 1;
    return acc;
  }, {});
}

function republishWorkflow(workflowId) {
  const publishScript = path.resolve(__dirname, 'publish-workflow.js');
  const result = spawnSync(process.execPath, [publishScript, '--id', String(workflowId)], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`publish-workflow failed for workflow ${workflowId} with exit code ${result.status}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envPath = loadEnv(options.envFile);
  let pool;

  try {
    pool = await connectDb();
    const targets = await selectTargets(pool, options.workflowIds, options.floor);
    const summary = Object.values(summarize(targets));

    console.log(`[file-upload-max-size-floor] env: ${envPath}`);
    console.log(`[file-upload-max-size-floor] floor: ${options.floor} MB`);
    if (options.workflowIds.length) {
      console.log(`[file-upload-max-size-floor] workflow filter: ${options.workflowIds.join(', ')}`);
    } else {
      console.log('[file-upload-max-size-floor] workflow filter: all workflows');
    }

    if (!targets.length) {
      console.log('[file-upload-max-size-floor] no authored file-upload rows are below the requested floor.');
      return;
    }

    console.log(`[file-upload-max-size-floor] rows below floor: ${targets.length}`);
    summary.forEach((item) => {
      console.log(`  - workflow ${item.workflowId} (${item.workflowName}): ${item.count}`);
    });
    targets.forEach((row) => {
      console.log(`    workflow ${row.workflow_id} step ${row.step_id} component ${row.component_name || row.component_id || row.step_component_id}: ${row.max_size_mb} -> ${options.floor}`);
    });

    if (options.dryRun) {
      console.log('[file-upload-max-size-floor] dry run only; no DB changes applied.');
      return;
    }

    await applyFloor(pool, targets.map((row) => row.step_component_id), options.floor);
    console.log('[file-upload-max-size-floor] DB update applied.');

    options.republishWorkflowIds.forEach((workflowId) => {
      console.log(`[file-upload-max-size-floor] republishing workflow ${workflowId}...`);
      republishWorkflow(workflowId);
    });
  } finally {
    if (pool) await pool.end();
  }
}

main().catch((error) => {
  console.error('[file-upload-max-size-floor] failed:', error.message);
  process.exit(1);
});
