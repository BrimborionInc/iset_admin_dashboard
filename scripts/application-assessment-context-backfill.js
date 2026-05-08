#!/usr/bin/env node
'use strict';

const mysql = require('mysql2/promise');

try {
  require('dotenv').config();
} catch (_) {
  // Keep usable when DB_* is already exported by the caller.
}

const APPLICATION_CONTEXT_KEY = 'applicationDecisionLetters';
const ROOT_WORKFLOW_KEYS = [
  'assessmentOtherFunding',
  'assessment_nwac_review_status',
  'decisionLetterDrafts',
  'decision_letter_drafts',
  'decisionLetter',
  'decision_letter',
  'decisionLetterPackDrafts',
  'decision_letter_pack_drafts',
  'decisionLetterSent',
  'decision_letter_sent',
  'decisionLetterSentType',
  'decision_letter_sent_type',
  'decisionLetterSentAt',
  'decision_letter_sent_at',
  'fundingDecisionReasonCode',
  'fundingDecisionReasonLabel',
  'fundingDecisionReasonExplanation',
];

const OWNERSHIP_DOCUMENT_CATEGORIES = [
  'case_assessment',
  'case_assessment_approved',
  'case_assessment_redline',
  'assessment_approval_letter',
  'assessment_denial_letter',
  'funding_agreement',
];

function parseArgs(argv) {
  const args = {
    apply: false,
    json: false,
    includeClean: false,
    caseId: null,
    limit: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      args.apply = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--include-clean') {
      args.includeClean = true;
    } else if (token === '--case-id') {
      args.caseId = Number.parseInt(argv[++index], 10);
    } else if (token === '--limit') {
      args.limit = Number.parseInt(argv[++index], 10);
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/application-assessment-context-backfill.js [--apply] [--json] [--case-id ID] [--limit N]',
    '',
    'Default mode is dry-run/report-only.',
    '--apply scopes old root-level application assessment workflow context under applicationDecisionLetters[application_id] only where ownership is clear.',
    '--include-clean includes rows that already have no root workflow keys in JSON output.',
  ].join('\n');
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set');
  }
  return config;
}

function splitIds(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map(item => Number.parseInt(item, 10))
    .filter(Number.isInteger);
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function getRootWorkflowEntries(context) {
  if (!isPlainObject(context)) return [];
  return ROOT_WORKFLOW_KEYS
    .filter(key => Object.prototype.hasOwnProperty.call(context, key))
    .map(key => ({ key, value: context[key] }));
}

function uniqueIds(ids) {
  return Array.from(new Set(ids.filter(Number.isInteger))).sort((a, b) => a - b);
}

function classify(row) {
  const context = parseJson(row.case_context_json, {});
  const rootEntries = getRootWorkflowEntries(context);
  const applicationIds = splitIds(row.application_ids);
  const documentApplicationIds = uniqueIds(splitIds(row.document_application_ids));
  const scopedApplicationIds = isPlainObject(context[APPLICATION_CONTEXT_KEY])
    ? Object.keys(context[APPLICATION_CONTEXT_KEY])
        .map(value => Number.parseInt(value, 10))
        .filter(Number.isInteger)
    : [];

  const base = {
    caseId: Number(row.id),
    caseNumber: row.case_number || null,
    applicationIds,
    documentApplicationIds,
    scopedApplicationIds: uniqueIds(scopedApplicationIds),
    rootKeys: rootEntries.map(entry => entry.key),
    targetApplicationId: null,
    classification: 'clean',
    reason: 'no root application-assessment workflow keys',
    applyable: false,
    conflicts: [],
  };

  if (!rootEntries.length) {
    return base;
  }

  if (!applicationIds.length) {
    return {
      ...base,
      classification: 'applicationless_case',
      reason: 'root workflow context exists but the case has no application; preserve legacy case-level behavior',
    };
  }

  let targetApplicationId = null;
  let classification = 'ambiguous';
  let reason = 'multiple applications are plausible and ownership is not proven';

  if (applicationIds.length === 1) {
    targetApplicationId = applicationIds[0];
    classification = 'single_application';
    reason = 'case has exactly one application';
  } else if (documentApplicationIds.length === 1 && applicationIds.includes(documentApplicationIds[0])) {
    targetApplicationId = documentApplicationIds[0];
    classification = 'document_provenance_clear';
    reason = 'assessment/decision generated documents point to one application';
  }

  if (!targetApplicationId) {
    return {
      ...base,
      classification,
      reason,
    };
  }

  const applicationKey = String(targetApplicationId);
  const applicationContexts = isPlainObject(context[APPLICATION_CONTEXT_KEY])
    ? context[APPLICATION_CONTEXT_KEY]
    : {};
  const existingScopedContext = isPlainObject(applicationContexts[applicationKey])
    ? applicationContexts[applicationKey]
    : {};
  const conflicts = rootEntries
    .filter(({ key, value }) =>
      Object.prototype.hasOwnProperty.call(existingScopedContext, key) &&
      !deepEqual(existingScopedContext[key], value)
    )
    .map(({ key }) => key);

  if (conflicts.length) {
    return {
      ...base,
      classification: 'target_context_conflict',
      targetApplicationId,
      reason: 'target application already has different scoped values for one or more root workflow keys',
      conflicts,
    };
  }

  return {
    ...base,
    classification,
    targetApplicationId,
    reason,
    applyable: true,
  };
}

function buildScopedContext(context, targetApplicationId) {
  const nextContext = isPlainObject(context) ? { ...context } : {};
  const rootEntries = getRootWorkflowEntries(nextContext);
  const applicationKey = String(targetApplicationId);
  const applicationContexts = isPlainObject(nextContext[APPLICATION_CONTEXT_KEY])
    ? { ...nextContext[APPLICATION_CONTEXT_KEY] }
    : {};
  const existingScopedContext = isPlainObject(applicationContexts[applicationKey])
    ? { ...applicationContexts[applicationKey] }
    : {};

  for (const { key, value } of rootEntries) {
    if (!Object.prototype.hasOwnProperty.call(existingScopedContext, key)) {
      existingScopedContext[key] = value;
    }
    delete nextContext[key];
  }

  applicationContexts[applicationKey] = existingScopedContext;
  nextContext[APPLICATION_CONTEXT_KEY] = applicationContexts;
  return nextContext;
}

async function tableExists(connection, tableName) {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) AS count
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = ?`,
    [tableName]
  );
  return Number(row?.count || 0) === 1;
}

async function loadRows(connection, args) {
  const hasApplicationAssessmentTable = await tableExists(connection, 'iset_application_assessment');
  const assessmentJoin = hasApplicationAssessmentTable
    ? 'LEFT JOIN iset_application_assessment aa ON aa.case_id = c.id'
    : '';
  const assessmentSelect = hasApplicationAssessmentTable
    ? 'GROUP_CONCAT(DISTINCT aa.application_id ORDER BY aa.application_id SEPARATOR \',\') AS migrated_application_ids'
    : 'NULL AS migrated_application_ids';
  const where = ['c.case_context_json IS NOT NULL'];
  const params = [...OWNERSHIP_DOCUMENT_CATEGORIES];
  if (Number.isInteger(args.caseId) && args.caseId > 0) {
    where.push('c.id = ?');
    params.push(args.caseId);
  }
  const limitSql = Number.isInteger(args.limit) && args.limit > 0 ? 'LIMIT ?' : '';
  if (limitSql) params.push(args.limit);

  const [rows] = await connection.query(
    `SELECT
        c.id,
        c.case_number,
        c.case_context_json,
        GROUP_CONCAT(DISTINCT a.id ORDER BY a.id SEPARATOR ',') AS application_ids,
        GROUP_CONCAT(DISTINCT d.application_id ORDER BY d.application_id SEPARATOR ',') AS document_application_ids,
        ${assessmentSelect}
       FROM iset_case c
       LEFT JOIN iset_application a ON a.case_id = c.id
       ${assessmentJoin}
       LEFT JOIN iset_document d
         ON d.case_id = c.id
        AND d.application_id IS NOT NULL
        AND d.status = 'active'
        AND d.document_category IN (${OWNERSHIP_DOCUMENT_CATEGORIES.map(() => '?').join(', ')})
      WHERE ${where.join(' AND ')}
      GROUP BY c.id
      ORDER BY c.id ASC
      ${limitSql}`,
    params
  );
  return rows || [];
}

async function applyScopedContext(connection, row, item) {
  if (!item.applyable || !item.targetApplicationId) {
    return { applied: false, reason: 'not_applyable' };
  }
  const context = parseJson(row.case_context_json, {});
  const nextContext = buildScopedContext(context, item.targetApplicationId);
  await connection.query(
    'UPDATE iset_case SET case_context_json = CAST(? AS JSON) WHERE id = ?',
    [JSON.stringify(nextContext), item.caseId]
  );
  return { applied: true };
}

function summarize(details, mode, casesInspected) {
  return details.reduce((acc, item) => {
    acc.total += 1;
    acc.byClassification[item.classification] = (acc.byClassification[item.classification] || 0) + 1;
    if (item.rootKeys.length) acc.withRootWorkflowKeys += 1;
    if (item.applyable) acc.clearOwnership += 1;
    if (item.conflicts.length) acc.conflicts += 1;
    return acc;
  }, {
    mode,
    casesInspected,
    total: 0,
    withRootWorkflowKeys: 0,
    clearOwnership: 0,
    applied: 0,
    conflicts: 0,
    byClassification: {},
  });
}

function renderHuman(output) {
  const lines = [];
  const { summary, details } = output;
  lines.push(`Application assessment context backfill ${summary.mode}`);
  lines.push(`Cases inspected: ${summary.casesInspected}`);
  lines.push(`Cases reported: ${summary.total}`);
  lines.push(`Cases with root workflow keys: ${summary.withRootWorkflowKeys}`);
  lines.push(`Clear ownership: ${summary.clearOwnership}`);
  if (summary.mode === 'apply') lines.push(`Applied: ${summary.applied}`);
  if (summary.conflicts) lines.push(`Conflicts: ${summary.conflicts}`);
  Object.keys(summary.byClassification).sort().forEach(key => {
    lines.push(`  ${key}: ${summary.byClassification[key]}`);
  });
  const reviewItems = details.filter(item =>
    item.rootKeys.length &&
    !item.applyable &&
    item.classification !== 'applicationless_case'
  );
  if (reviewItems.length) {
    lines.push(`Manual review cases: ${reviewItems.map(item => item.caseId).join(', ')}`);
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const connection = await mysql.createConnection(getDbConfig());
  try {
    const rows = await loadRows(connection, args);
    const rowByCaseId = new Map(rows.map(row => [Number(row.id), row]));
    const classified = rows.map(classify);
    const details = classified.filter(item => args.includeClean || item.rootKeys.length);
    const summary = summarize(details, args.apply ? 'apply' : 'dry-run', rows.length);

    if (args.apply) {
      await connection.beginTransaction();
      try {
        for (const item of details) {
          if (!item.applyable) continue;
          const row = rowByCaseId.get(item.caseId);
          const result = await applyScopedContext(connection, row, item);
          item.applyResult = result;
          if (result.applied) summary.applied += 1;
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    }

    const output = { summary, details };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(renderHuman(output));
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
