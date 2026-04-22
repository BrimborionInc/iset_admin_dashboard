#!/usr/bin/env node

/**
 * Update the upload-step intro copy for the intake workflow and republish the runtime schema.
 *
 * This uses the current DB env (or --env-file) so the same change can be re-run in DEV, TEST,
 * or PROD without hand-editing rows.
 */

const path = require('path');
const { spawnSync } = require('child_process');

let mysql;

const DEFAULTS = {
  workflowId: 21,
  stepId: 105,
  componentId: 'text-block-2',
  textEn: 'Based on your answers, please upload any documents that apply to your application. On a supported phone, select Upload to take a photo or choose a file. You can also upload scans or saved files from your device.',
  textFr: 'Selon vos réponses, veuillez téléverser tous les documents qui s’appliquent à votre demande. Sur un téléphone compatible, sélectionnez Téléverser pour prendre une photo ou choisir un fichier. Vous pouvez aussi téléverser des numérisations ou des fichiers enregistrés sur votre appareil.',
};

function parseArgs(argv) {
  const options = {
    workflowId: DEFAULTS.workflowId,
    stepId: DEFAULTS.stepId,
    componentId: DEFAULTS.componentId,
    textEn: DEFAULTS.textEn,
    textFr: DEFAULTS.textFr,
    envFile: null,
    dryRun: false,
    skipPublish: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--workflow-id') options.workflowId = Number(argv[++i]);
    else if (arg === '--step-id') options.stepId = Number(argv[++i]);
    else if (arg === '--component-id') options.componentId = argv[++i];
    else if (arg === '--text-en') options.textEn = argv[++i];
    else if (arg === '--text-fr') options.textFr = argv[++i];
    else if (arg === '--env-file') options.envFile = argv[++i];
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--skip-publish') options.skipPublish = true;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
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

async function findTarget(pool, workflowId, stepId, componentId) {
  const [rows] = await pool.query(
    `
      SELECT
        sc.id,
        sc.position,
        ct.template_key AS templateKey,
        JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.id')) AS authoredId,
        JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.text.en')) AS textEn,
        JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.text.fr')) AS textFr
      FROM workflow_step ws
      JOIN step_component sc ON sc.step_id = ws.step_id
      JOIN component_template ct ON ct.id = sc.template_id
      WHERE ws.workflow_id = ?
        AND ws.step_id = ?
        AND JSON_UNQUOTE(JSON_EXTRACT(sc.props_overrides, '$.id')) = ?
      LIMIT 2
    `,
    [workflowId, stepId, componentId]
  );

  if (rows.length !== 1) {
    throw new Error(`Expected exactly one step component for workflow ${workflowId}, step ${stepId}, component ${componentId}; found ${rows.length}.`);
  }

  return rows[0];
}

async function updateCopy(pool, rowId, textEn, textFr) {
  await pool.query(
    `
      UPDATE step_component
      SET props_overrides = JSON_SET(
        COALESCE(props_overrides, JSON_OBJECT()),
        '$.text.en', ?,
        '$.text.fr', ?
      ),
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [textEn, textFr, rowId]
  );
}

function publishWorkflow(workflowId) {
  const publishScript = path.resolve(__dirname, 'publish-workflow.js');
  const result = spawnSync(process.execPath, [publishScript, '--id', String(workflowId)], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`publish-workflow failed with exit code ${result.status}`);
  }
}

function printHelp() {
  console.log(`
Usage:
  node scripts/apply-intake-upload-camera-chooser.js [options]

Options:
  --workflow-id <id>   Workflow id to update (default: ${DEFAULTS.workflowId})
  --step-id <id>       Step id containing the upload intro copy (default: ${DEFAULTS.stepId})
  --component-id <id>  Component id inside props_overrides (default: ${DEFAULTS.componentId})
  --text-en <text>     Override English text
  --text-fr <text>     Override French text
  --env-file <path>    Load DB env vars from a specific file (default: .env)
  --dry-run            Show the target row without updating it
  --skip-publish       Update authoring only; skip publish-workflow
  -h, --help           Show help
`.trim());
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const envPath = loadEnv(options.envFile);
  let pool;

  try {
    pool = await connectDb();
    const before = await findTarget(pool, options.workflowId, options.stepId, options.componentId);

    console.log(`[intake-upload-camera-chooser] env: ${envPath}`);
    console.log(`[intake-upload-camera-chooser] target row: ${before.id} (${before.templateKey}, authored id ${before.authoredId}, position ${before.position})`);
    console.log(`[intake-upload-camera-chooser] current EN: ${before.textEn}`);
    console.log(`[intake-upload-camera-chooser] current FR: ${before.textFr}`);

    if (options.dryRun) {
      console.log('[intake-upload-camera-chooser] dry run only; no DB changes applied.');
      return;
    }

    await updateCopy(pool, before.id, options.textEn, options.textFr);
    const after = await findTarget(pool, options.workflowId, options.stepId, options.componentId);

    console.log(`[intake-upload-camera-chooser] updated EN: ${after.textEn}`);
    console.log(`[intake-upload-camera-chooser] updated FR: ${after.textFr}`);

    if (!options.skipPublish) {
      publishWorkflow(options.workflowId);
    } else {
      console.log('[intake-upload-camera-chooser] publish skipped.');
    }
  } finally {
    if (pool) await pool.end();
  }
}

main().catch((error) => {
  console.error('[intake-upload-camera-chooser] failed:', error.message);
  process.exit(1);
});
