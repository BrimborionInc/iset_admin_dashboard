#!/usr/bin/env node
'use strict';

const mysql = require('mysql2/promise');

try {
  require('dotenv').config();
} catch (_) {
  // dotenv is available in the app runtime; keep the script usable if a shell already exported DB_*.
}

const ASSESSMENT_DOCUMENT_CATEGORIES = [
  'case_assessment',
  'case_assessment_approved',
  'case_assessment_redline',
];

const ASSESSMENT_COLUMNS = [
  'date_of_assessment',
  'overview',
  'employment_goals',
  'previous_iset',
  'previous_iset_details',
  'employment_barriers',
  'employment_barriers_other_details',
  'local_area_priorities',
  'other_funding_details',
  'esdc_eligibility',
  'intervention_start_date',
  'intervention_end_date',
  'intervention_budget_pot_id',
  'posting_context',
  'intervention_code',
  'intervention_outcome_code',
  'intervention_duration_days',
  'intervention_cost_total',
  'intervention_related_noc',
  'intervention_related_noc_version',
  'childcare_need',
  'childcare_funding_details',
  'action_plan_result_code',
  'action_plan_result_date',
  'institution',
  'program_name',
  'itp_payload',
  'wage_payload',
  'recommendation',
  'justification',
  'nwac_review',
  'nwac_reason',
  'proposed_interventions',
];

function parseArgs(argv) {
  const args = {
    apply: false,
    json: false,
    caseId: null,
    limit: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--apply') {
      args.apply = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--case-id') {
      index += 1;
      args.caseId = Number.parseInt(argv[index], 10);
    } else if (token === '--limit') {
      index += 1;
      args.limit = Number.parseInt(argv[index], 10);
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage: node scripts/application-assessment-backfill.js [--apply] [--json] [--case-id ID] [--limit N]',
    '',
    'Default mode is dry-run/report-only.',
    '--apply copies only clear legacy rows into iset_application_assessment.',
  ].join('\n');
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
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

function classify(row) {
  const applicationIds = splitIds(row.application_ids);
  const documentApplicationIds = splitIds(row.document_application_ids);
  const migratedApplicationIds = splitIds(row.migrated_application_ids);
  const distinctDocumentApplicationIds = Array.from(new Set(documentApplicationIds));
  const applicationIdSet = new Set(applicationIds);

  if (!applicationIds.length) {
    return {
      classification: 'applicationless_case',
      targetApplicationId: null,
      reason: 'legacy assessment has no application on the case',
    };
  }
  if (applicationIds.length === 1) {
    return {
      classification: 'single_application',
      targetApplicationId: applicationIds[0],
      reason: 'case has exactly one application',
      alreadyMigrated: migratedApplicationIds.includes(applicationIds[0]),
    };
  }
  if (
    distinctDocumentApplicationIds.length === 1 &&
    applicationIdSet.has(distinctDocumentApplicationIds[0])
  ) {
    return {
      classification: 'document_provenance_clear',
      targetApplicationId: distinctDocumentApplicationIds[0],
      reason: 'assessment-generated documents point to one application',
      alreadyMigrated: migratedApplicationIds.includes(distinctDocumentApplicationIds[0]),
    };
  }
  return {
    classification: 'ambiguous',
    targetApplicationId: null,
    reason: 'multiple applications are plausible and document provenance is not singular',
  };
}

async function loadRows(connection, args) {
  const categoryPlaceholders = ASSESSMENT_DOCUMENT_CATEGORIES.map(() => '?').join(', ');
  const where = [];
  const params = [...ASSESSMENT_DOCUMENT_CATEGORIES];
  if (Number.isInteger(args.caseId) && args.caseId > 0) {
    where.push('ca.case_id = ?');
    params.push(args.caseId);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limitSql = Number.isInteger(args.limit) && args.limit > 0 ? 'LIMIT ?' : '';
  if (limitSql) params.push(args.limit);
  const [rows] = await connection.query(
    `SELECT
        ca.case_id,
        GROUP_CONCAT(DISTINCT a.id ORDER BY a.id SEPARATOR ',') AS application_ids,
        GROUP_CONCAT(DISTINCT aa.application_id ORDER BY aa.application_id SEPARATOR ',') AS migrated_application_ids,
        GROUP_CONCAT(DISTINCT d.application_id ORDER BY d.application_id SEPARATOR ',') AS document_application_ids,
        COUNT(DISTINCT a.id) AS application_count,
        COUNT(DISTINCT aa.application_id) AS migrated_count,
        COUNT(DISTINCT d.application_id) AS document_application_count
       FROM iset_case_assessment ca
       LEFT JOIN iset_application a ON a.case_id = ca.case_id
       LEFT JOIN iset_application_assessment aa ON aa.case_id = ca.case_id
       LEFT JOIN iset_document d
         ON d.case_id = ca.case_id
        AND d.application_id IS NOT NULL
        AND d.status = 'active'
        AND d.document_category IN (${categoryPlaceholders})
       ${whereSql}
       GROUP BY ca.case_id
       ORDER BY ca.case_id ASC
       ${limitSql}`,
    params
  );
  return rows || [];
}

async function copyAssessment(connection, item) {
  if (!item.targetApplicationId) return { copied: false, reason: 'no_target_application' };
  const insertColumns = [
    'case_id',
    'application_id',
    ...ASSESSMENT_COLUMNS,
    'legacy_case_assessment_case_id',
    'legacy_backfill_reason',
    'legacy_backfilled_at',
  ];
  const selectColumns = [
    'ca.case_id',
    '?',
    ...ASSESSMENT_COLUMNS.map(column => `ca.${column}`),
    'ca.case_id',
    '?',
    'NOW()',
  ];
  const updateClause = [
    'legacy_case_assessment_case_id = COALESCE(legacy_case_assessment_case_id, VALUES(legacy_case_assessment_case_id))',
    'legacy_backfill_reason = COALESCE(legacy_backfill_reason, VALUES(legacy_backfill_reason))',
    'legacy_backfilled_at = COALESCE(legacy_backfilled_at, VALUES(legacy_backfilled_at))',
  ].join(', ');
  const [result] = await connection.query(
    `INSERT INTO iset_application_assessment (${insertColumns.join(', ')})
     SELECT ${selectColumns.join(', ')}
       FROM iset_case_assessment ca
      WHERE ca.case_id = ?
      LIMIT 1
     ON DUPLICATE KEY UPDATE ${updateClause}`,
    [item.targetApplicationId, item.classification, item.caseId]
  );
  return {
    copied: Number(result?.affectedRows || 0) > 0,
    affectedRows: Number(result?.affectedRows || 0),
  };
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
    const details = rows.map(row => {
      const result = classify(row);
      return {
        caseId: Number(row.case_id),
        applicationIds: splitIds(row.application_ids),
        migratedApplicationIds: splitIds(row.migrated_application_ids),
        documentApplicationIds: splitIds(row.document_application_ids),
        classification: result.classification,
        targetApplicationId: result.targetApplicationId,
        alreadyMigrated: Boolean(result.alreadyMigrated),
        reason: result.reason,
      };
    });
    const summary = details.reduce((acc, item) => {
      acc.total += 1;
      acc.byClassification[item.classification] = (acc.byClassification[item.classification] || 0) + 1;
      if (item.targetApplicationId) acc.clearOwnership += 1;
      if (item.alreadyMigrated) acc.alreadyMigrated += 1;
      return acc;
    }, {
      mode: args.apply ? 'apply' : 'dry-run',
      total: 0,
      clearOwnership: 0,
      alreadyMigrated: 0,
      copied: 0,
      byClassification: {},
    });

    if (args.apply) {
      await connection.beginTransaction();
      try {
        for (const item of details) {
          if (!item.targetApplicationId || item.alreadyMigrated) continue;
          const copyResult = await copyAssessment(connection, item);
          if (copyResult.copied) summary.copied += 1;
          item.copyResult = copyResult;
        }
        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      }
    }

    const output = { summary, details };
    if (args.json) {
      console.log(JSON.stringify(output, null, 2));
    } else {
      console.log(`Application assessment backfill ${summary.mode}`);
      console.log(`Total legacy rows: ${summary.total}`);
      console.log(`Clear ownership: ${summary.clearOwnership}`);
      console.log(`Already migrated: ${summary.alreadyMigrated}`);
      if (args.apply) console.log(`Copied: ${summary.copied}`);
      Object.keys(summary.byClassification).sort().forEach(key => {
        console.log(`  ${key}: ${summary.byClassification[key]}`);
      });
      const ambiguous = details.filter(item => item.classification === 'ambiguous');
      if (ambiguous.length) {
        console.log('Ambiguous cases: ' + ambiguous.map(item => item.caseId).join(', '));
      }
    }
  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
