#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');
const {
  listDatasets,
  getDataset,
  buildDataset,
} = require('../src/lib/pathDataSyncCatalog');

const REPO_ROOT = path.resolve(__dirname, '..');

function toBashPath(filePath) {
  if (!filePath) {
    return filePath;
  }
  if (filePath.startsWith('/')) {
    return filePath;
  }
  if (/^[A-Za-z]:\\/.test(filePath)) {
    const drive = filePath[0].toLowerCase();
    const rest = filePath.slice(2).replace(/\\/g, '/').replace(/^\/+/, '');
    return `/mnt/${drive}/${rest}`;
  }
  return filePath.replace(/\\/g, '/');
}

function usage() {
  console.log([
    'Usage: node scripts/path-data-sync.js <catalog|plan|bundle|apply> [options]',
    '',
    'Options:',
    '  --dataset NAME        Dataset to promote (for example intake-release)',
    '  --workflow-id ID      Required for workflow-authoring and intake-release',
    '  --source-env NAME     Source environment. Current supported value: dev',
    '  --target-env NAME     Target environment for apply',
    '  --env-file PATH       Source env file. Defaults to .env for source-env=dev',
    '  --profile NAME        AWS profile override for test/prod apply',
    '  --region REGION       AWS region override for test/prod apply',
    '  --output PATH         Write the generated SQL bundle to this path',
    '  --json                Emit machine-readable JSON',
    '  --yes                 Required for prod apply',
    '  --keep-bundle         Keep the generated temp bundle after apply',
    '  --help                Show this help',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: null,
    dataset: null,
    workflowId: null,
    sourceEnv: 'dev',
    targetEnv: null,
    envFile: null,
    profile: null,
    region: null,
    output: null,
    json: false,
    yes: false,
    keepBundle: false,
  };

  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--dataset') {
      args.dataset = argv[++index];
    } else if (token === '--workflow-id') {
      args.workflowId = argv[++index];
    } else if (token === '--source-env') {
      args.sourceEnv = argv[++index];
    } else if (token === '--target-env') {
      args.targetEnv = argv[++index];
    } else if (token === '--env-file') {
      args.envFile = argv[++index];
    } else if (token === '--profile') {
      args.profile = argv[++index];
    } else if (token === '--region') {
      args.region = argv[++index];
    } else if (token === '--output') {
      args.output = argv[++index];
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--yes') {
      args.yes = true;
    } else if (token === '--keep-bundle') {
      args.keepBundle = true;
    } else if (token === '--help' || token === '-h') {
      args.command = 'help';
    } else {
      positional.push(token);
    }
  }

  if (!args.command && positional.length) {
    args.command = positional[0];
  }
  return args;
}

function unquoteEnvValue(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function loadEnvFile(envFilePath) {
  const absolutePath = path.isAbsolute(envFilePath)
    ? envFilePath
    : path.resolve(REPO_ROOT, envFilePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Env file not found: ${absolutePath}`);
  }

  const lines = fs.readFileSync(absolutePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const normalized = line.startsWith('export ') ? line.slice(7) : line;
    const separatorIndex = normalized.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, separatorIndex).trim();
    const value = unquoteEnvValue(normalized.slice(separatorIndex + 1));
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return absolutePath;
}

function loadSourceEnv(args) {
  if (args.sourceEnv !== 'dev') {
    throw new Error(`Unsupported source environment: ${args.sourceEnv}. Current implementation supports source-env=dev only.`);
  }
  const envFile = args.envFile || '.env';
  return loadEnvFile(envFile);
}

function getDbConfig({ multipleStatements = false } = {}) {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    charset: 'utf8mb4_unicode_ci',
    multipleStatements,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set');
  }
  return config;
}

function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

function buildBundleText(bundle, args) {
  const generatedAt = new Date().toISOString();
  const lines = [
    '-- PATH data sync bundle',
    `-- Dataset: ${bundle.dataset.name}`,
    `-- Classification: ${bundle.dataset.classification}`,
    `-- Source environment: ${args.sourceEnv}`,
    `-- Generated at: ${generatedAt}`,
  ];
  if (args.targetEnv) {
    lines.push(`-- Target environment: ${args.targetEnv}`);
  }
  if (args.workflowId) {
    lines.push(`-- Workflow ID: ${args.workflowId}`);
  }
  if (bundle.warnings && bundle.warnings.length) {
    bundle.warnings.forEach(warning => lines.push(`-- Warning: ${warning}`));
  }
  lines.push('SET NAMES utf8mb4;');
  lines.push('START TRANSACTION;');
  bundle.statements.forEach(statement => {
    if (!statement) {
      return;
    }
    lines.push(statement.trim().replace(/;+\s*$/, '') + ';');
  });
  lines.push('COMMIT;');
  lines.push('');
  return {
    sql: lines.join('\n'),
    generatedAt,
  };
}

function defaultOutputPath(datasetName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(os.tmpdir(), `path-data-sync-${datasetName}-${stamp}.sql`);
}

function writeBundleArtifacts(sqlPath, manifest) {
  const sqlDir = path.dirname(sqlPath);
  fs.mkdirSync(sqlDir, { recursive: true });
  fs.writeFileSync(sqlPath, manifest.sql, 'utf8');
  const manifestPath = `${sqlPath}.manifest.json`;
  fs.writeFileSync(manifestPath, formatJson(manifest.json), 'utf8');
  return { sqlPath, manifestPath };
}

function printCatalog() {
  listDatasets().forEach(dataset => {
    console.log(`${dataset.name}`);
    console.log(`  Class: ${dataset.classification}`);
    console.log(`  Source envs: ${dataset.sourceEnvironments.join(', ')}`);
    console.log(`  Target envs: ${dataset.targetEnvironments.join(', ')}`);
    if (dataset.requiredOptions.length) {
      console.log(`  Required options: ${dataset.requiredOptions.join(', ')}`);
    }
    console.log(`  Description: ${dataset.description}`);
    console.log(`  Prod rule: ${dataset.prodRule}`);
  });
}

function printPlan(bundle, args, loadedEnvFile) {
  console.log(`Dataset: ${bundle.dataset.name}`);
  console.log(`Source env: ${args.sourceEnv}`);
  console.log(`Loaded env file: ${loadedEnvFile}`);
  console.log(`Classification: ${bundle.dataset.classification}`);
  console.log(`Description: ${bundle.dataset.description}`);
  if (bundle.dataset.requiredOptions.length) {
    console.log(`Required options: ${bundle.dataset.requiredOptions.join(', ')}`);
  }
  console.log(`Target envs: ${bundle.dataset.targetEnvironments.join(', ')}`);
  console.log('Summary:');
  console.log(formatJson(bundle.summary));
  if (bundle.warnings && bundle.warnings.length) {
    console.log('Warnings:');
    bundle.warnings.forEach(warning => console.log(`- ${warning}`));
  }
}

async function openSourcePool() {
  return mysql.createPool(getDbConfig());
}

async function applyBundleToDev(sqlText) {
  const connection = await mysql.createConnection(getDbConfig({ multipleStatements: true }));
  try {
    await connection.query(sqlText);
  } finally {
    await connection.end();
  }
}

function runScript(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: REPO_ROOT,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

async function applyBundleToTarget(targetEnv, sqlPath, args) {
  if (targetEnv === 'dev') {
    const sqlText = fs.readFileSync(sqlPath, 'utf8');
    await applyBundleToDev(sqlText);
    return;
  }
  if (targetEnv === 'test') {
    const scriptArgs = [
      toBashPath(path.join(REPO_ROOT, 'scripts', 'run-test-sql-via-ssm.sh')),
      '--sql-file',
      toBashPath(sqlPath),
    ];
    if (args.profile) {
      scriptArgs.push('--profile', args.profile);
    }
    if (args.region) {
      scriptArgs.push('--region', args.region);
    }
    runScript('bash', scriptArgs);
    return;
  }
  if (targetEnv === 'prod') {
    const scriptArgs = [
      toBashPath(path.join(REPO_ROOT, 'scripts', 'run-prod-sql-via-ssm.sh')),
      '--sql-file',
      toBashPath(sqlPath),
    ];
    if (args.profile) {
      scriptArgs.push('--profile', args.profile);
    }
    if (args.region) {
      scriptArgs.push('--region', args.region);
    }
    runScript('bash', scriptArgs);
    return;
  }
  throw new Error(`Unsupported target environment: ${targetEnv}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === 'help') {
    usage();
    return;
  }

  if (args.command === 'catalog') {
    if (args.json) {
      console.log(formatJson({ datasets: listDatasets() }));
      return;
    }
    printCatalog();
    return;
  }

  if (!args.dataset) {
    throw new Error('--dataset is required for plan, bundle, and apply');
  }

  const dataset = getDataset(args.dataset);
  if (!dataset) {
    throw new Error(`Unknown dataset: ${args.dataset}`);
  }

  if (args.command === 'apply' && !args.targetEnv) {
    throw new Error('--target-env is required for apply');
  }
  if (args.command === 'apply' && args.targetEnv === 'prod' && !args.yes) {
    throw new Error('Prod apply requires --yes');
  }

  const loadedEnvFile = loadSourceEnv(args);
  const pool = await openSourcePool();
  try {
    const bundle = await buildDataset(pool, args.dataset, {
      sourceEnv: args.sourceEnv,
      targetEnv: args.targetEnv,
      workflowId: args.workflowId,
    });

    if (args.command === 'plan') {
      const payload = {
        loadedEnvFile,
        sourceEnv: args.sourceEnv,
        targetEnv: args.targetEnv,
        dataset: bundle.dataset,
        summary: bundle.summary,
        warnings: bundle.warnings,
      };
      if (args.json) {
        console.log(formatJson(payload));
        return;
      }
      printPlan(bundle, args, loadedEnvFile);
      return;
    }

    const rendered = buildBundleText(bundle, args);
    const payload = {
      loadedEnvFile,
      sourceEnv: args.sourceEnv,
      targetEnv: args.targetEnv,
      dataset: bundle.dataset,
      summary: bundle.summary,
      warnings: bundle.warnings,
      generatedAt: rendered.generatedAt,
    };
    const sqlPath = path.resolve(args.output || defaultOutputPath(bundle.dataset.name));
    const artifacts = writeBundleArtifacts(sqlPath, {
      sql: rendered.sql,
      json: payload,
    });

    if (args.command === 'bundle') {
      const response = {
        ...payload,
        sqlPath: artifacts.sqlPath,
        manifestPath: artifacts.manifestPath,
      };
      if (args.json) {
        console.log(formatJson(response));
        return;
      }
      console.log(`Wrote SQL bundle: ${artifacts.sqlPath}`);
      console.log(`Wrote manifest: ${artifacts.manifestPath}`);
      return;
    }

    await applyBundleToTarget(args.targetEnv, artifacts.sqlPath, args);
    const response = {
      ...payload,
      applied: true,
      sqlPath: artifacts.sqlPath,
      manifestPath: artifacts.manifestPath,
    };
    if (args.json) {
      console.log(formatJson(response));
    } else {
      console.log(`Applied dataset ${bundle.dataset.name} to ${args.targetEnv}`);
      console.log(`Bundle: ${artifacts.sqlPath}`);
      console.log(`Manifest: ${artifacts.manifestPath}`);
    }

    if (!args.keepBundle) {
      fs.rmSync(artifacts.sqlPath, { force: true });
      fs.rmSync(artifacts.manifestPath, { force: true });
    }
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(`[path-data-sync] ${error.message}`);
  process.exit(1);
});
