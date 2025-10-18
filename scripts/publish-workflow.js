#!/usr/bin/env node
/**
 * Publish normalized intake workflow schema to BOTH legacy portal and new public portal.
 *
 * Usage:
 *   node scripts/publish-workflow.js --id <workflowId>
 *   node scripts/publish-workflow.js --id <workflowId> --legacy-only
 *   node scripts/publish-workflow.js --id <workflowId> --new-only
 *
 * Behavior:
 * 1. Loads environment (.env.development by default if NODE_ENV not set) to get ADMIN_API_BASE if needed.
 * 2. Uses existing normalization utilities (buildWorkflowSchema) directly to construct schema from local source data.
 * 3. Writes schema JSON to:
 *      ../../ISET-intake/src/intakeFormSchema.json (legacy)
 *      ../../iset-public-portal/apps/api/src/data/intakeFormSchema.json (new)
 *    (Paths are resolved relative to this script location.)
 * 4. Also writes a small meta file with workflow id and timestamp alongside each target.
 * 5. Skips writing target if contents are unchanged (hash compare) for faster incremental dev.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let mysql;

// Attempt to load dotenv if present
try { require('dotenv').config(); } catch (_) { /* ignore */ }

// ---- CLI ARG PARSE ----
const args = process.argv.slice(2);
let workflowId = null;
let legacyOnly = false;
let newOnly = false;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--id') {
    workflowId = args[++i];
  } else if (a === '--legacy-only') {
    legacyOnly = true;
  } else if (a === '--new-only') {
    newOnly = true;
  } else if (a === '--help' || a === '-h') {
    printHelp();
    process.exit(0);
  }
}

if (!workflowId) {
  console.error('ERROR: --id <workflowId> is required.');
  printHelp();
  process.exit(1);
}
if (legacyOnly && newOnly) {
  console.error('ERROR: Cannot specify both --legacy-only and --new-only');
  process.exit(1);
}

// ---- Load Normalization Logic ----
let buildWorkflowSchema;
try {
  ({ buildWorkflowSchema } = require('../src/workflows/normalizeWorkflow'));
  if (typeof buildWorkflowSchema !== 'function') throw new Error('buildWorkflowSchema not exported as function');
} catch (err) {
  console.error('Failed to load buildWorkflowSchema:', err.message);
  process.exit(1);
}

async function main() {
  // buildWorkflowSchema signature sniff: we will attempt with (workflowId) first
  let schema;
  try {
    schema = await buildWorkflowSchema(workflowId);
  } catch (err) {
    console.warn('Direct buildWorkflowSchema(workflowId) failed, retrying with object param:', err.message);
    try {
      schema = await buildWorkflowSchema({ workflowId });
    } catch (err2) {
      console.error('Failed to build workflow schema with both invocation styles:', err2.message);
      process.exit(1);
    }
  }

  if (!schema) {
    console.error('No schema returned for workflowId=' + workflowId);
    process.exit(1);
  }

  const publishedAt = new Date().toISOString();
  const outputJSON = JSON.stringify(schema, null, 2);
  const schemaMeta = schema && typeof schema === 'object' && schema.meta && typeof schema.meta === 'object' ? schema.meta : null;
  const meta = {
    workflowId,
    generatedAt: publishedAt
  };
  if (schemaMeta) meta.schemaMeta = schemaMeta;
  const schemaArray = Array.isArray(schema) ? schema : (Array.isArray(schema?.steps) ? schema.steps : []);
  const normalizedPayload = {
    meta,
    schema: schemaArray,
    version: `${publishedAt}#${workflowId}`,
    publishedAt,
    publishedBy: null
  };
  if (!Array.isArray(schema)) {
    normalizedPayload.schemaEnvelope = schema;
    if (!normalizedPayload.meta.schemaMeta && schema?.meta && typeof schema.meta === 'object') {
      normalizedPayload.meta.schemaMeta = schema.meta;
    }
  }
  const payloadPreChecksum = JSON.stringify(normalizedPayload);
  const runtimeChecksum = sha256(payloadPreChecksum);
  normalizedPayload.checksum = runtimeChecksum;
  meta.checksum = runtimeChecksum;
  const payloadJson = JSON.stringify(normalizedPayload);

  const targets = [];
  if (!newOnly) {
    // legacy portal target
    targets.push({
      label: 'legacy',
      file: path.resolve(__dirname, '../../ISET-intake/src/intakeFormSchema.json'),
      meta: path.resolve(__dirname, '../../ISET-intake/src/intakeFormSchema.meta.json')
    });
  }
  if (!legacyOnly) {
    // new portal target
    targets.push({
      label: 'new',
      file: path.resolve(__dirname, '../../iset-public-portal/apps/api/src/data/intakeFormSchema.json'),
      meta: path.resolve(__dirname, '../../iset-public-portal/apps/api/src/data/intakeFormSchema.meta.json')
    });
  }

  for (const t of targets) {
    ensureDir(path.dirname(t.file));
    const changed = writeIfChanged(t.file, outputJSON);
    const metaChanged = writeIfChanged(t.meta, JSON.stringify(meta, null, 2));
    console.log(`[publish-workflow] ${t.label} -> ${relativeCwd(t.file)} ${changed ? 'UPDATED' : 'unchanged'} (meta ${metaChanged ? 'UPDATED' : 'unchanged'})`);
  }

  console.log('\nPublish complete.');

  if (!legacyOnly) {
    await upsertRuntimeConfig(payloadJson, normalizedPayload.version);
  }
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file)) {
    const existing = fs.readFileSync(file, 'utf8');
    if (existing === content) return false; // unchanged
  }
  fs.writeFileSync(file, content, 'utf8');
  return true;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sha256(s) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

function printHelp() {
  console.log(`Publish normalized workflow schema to legacy and new portals.\n\nUsage:\n  node scripts/publish-workflow.js --id <workflowId> [--legacy-only|--new-only]\n\nOptions:\n  --id <workflowId>   Required workflow identifier used by normalization layer\n  --legacy-only       Only write to legacy portal (ISET-intake)\n  --new-only          Only write to new portal (iset-public-portal)\n  -h, --help          Show this help\n`);
}

async function upsertRuntimeConfig(payloadJson, version) {
  if (!process.env.DB_HOST || !process.env.DB_NAME) {
    console.warn('[publish-workflow] DB_HOST/DB_NAME not set; skipping runtime-config update.');
    return;
  }
  if (!mysql) {
    mysql = require('mysql2/promise');
  }
  let pool;
  try {
    pool = await mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME
    });
    await pool.query(
      "INSERT INTO iset_runtime_config (scope, k, v) VALUES ('publish', 'workflow.schema.intake', CAST(? AS JSON)) ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = CURRENT_TIMESTAMP",
      [payloadJson]
    );
    console.log(`[publish-workflow] runtime-config -> publish/workflow.schema.intake UPDATED (version ${version})`);
  } catch (err) {
    console.error('[publish-workflow] Failed to upsert runtime-config:', err.message);
  } finally {
    if (pool) await pool.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
