#!/usr/bin/env node
'use strict';

const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED_DEV_IDENTITY = Object.freeze({
  database: 'iset_intake',
  configuredHost: '172.26.176.1',
  configuredUser: 'root',
  serverHostname: 'DESKTOP-PDFA51K',
  port: 3306,
  currentUser: 'root@172.26.%',
  version: '8.0.40',
});
const REQUIRED_OBJECTS = Object.freeze([
  'client',
  'iset_case',
  'iset_application',
  'iset_application_assessment',
  'iset_case_action_plan',
  'iset_case_intervention',
  'esdc_participant_submission',
]);
const REQUIRED_RELATIONSHIPS = Object.freeze([
  { fromObject: 'iset_case', fromColumn: 'client_id', toObject: 'client', toColumn: 'id' },
  { fromObject: 'iset_application', fromColumn: 'client_id', toObject: 'client', toColumn: 'id' },
  { fromObject: 'iset_application', fromColumn: 'case_id', toObject: 'iset_case', toColumn: 'id' },
  { fromObject: 'iset_application_assessment', fromColumn: 'application_id', toObject: 'iset_application', toColumn: 'id' },
  { fromObject: 'iset_application_assessment', fromColumn: 'case_id', toObject: 'iset_case', toColumn: 'id' },
  { fromObject: 'iset_case_action_plan', fromColumn: 'application_id', toObject: 'iset_application', toColumn: 'id' },
  { fromObject: 'iset_case_action_plan', fromColumn: 'case_id', toObject: 'iset_case', toColumn: 'id' },
  { fromObject: 'iset_case_intervention', fromColumn: 'action_plan_id', toObject: 'iset_case_action_plan', toColumn: 'id' },
  { fromObject: 'iset_case_intervention', fromColumn: 'case_id', toObject: 'iset_case', toColumn: 'id' },
  { fromObject: 'esdc_participant_submission', fromColumn: 'action_plan_id', toObject: 'iset_case_action_plan', toColumn: 'id' },
  { fromObject: 'esdc_participant_submission', fromColumn: 'application_id', toObject: 'iset_application', toColumn: 'id' },
  { fromObject: 'esdc_participant_submission', fromColumn: 'case_id', toObject: 'iset_case', toColumn: 'id' },
]);

function parseArgs(argv) {
  const args = {
    envFile: path.join(REPO_ROOT, '.env'),
    schemaPreflightOnly: false,
    residueAuditOnly: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index] || '');
    else if (token === '--schema-preflight-only') args.schemaPreflightOnly = true;
    else if (token === '--residue-audit-only') args.residueAuditOnly = true;
    else if (token === '--json') args.json = true;
    else throw new Error(`Unknown option: ${token}`);
  }
  if (args.schemaPreflightOnly && args.residueAuditOnly) {
    throw new Error('--schema-preflight-only and --residue-audit-only are mutually exclusive');
  }
  return args;
}

function databaseConfig(env) {
  const missing = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter(key => !env[key]);
  if (missing.length) throw new Error(`Missing DEV database configuration: ${missing.join(', ')}`);
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASS || env.DB_PASSWORD || '',
    database: env.DB_NAME,
    multipleStatements: false,
  };
}

function assertContract(condition, code) {
  if (!condition) {
    const error = new Error(code);
    error.code = code;
    throw error;
  }
}

async function queryScalar(connection, sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return Number(Object.values(rows?.[0] || {})[0] || 0);
}

async function runRollbackFixture(connection, executionState) {
  const marker = crypto.randomUUID().replace(/-/gu, '');
  const applicantEmail = `denied-reporting-contract-${marker}@example.invalid`;
  const caseNumber = `DR-${marker.slice(0, 20)}`;
  let transactionStarted = false;
  let rolledBack = false;

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    const [clientResult] = await connection.query(
      `INSERT INTO client (last_name, first_name, applicant_account_email)
       VALUES (?, ?, ?)`,
      [`Contract-${marker.slice(0, 12)}`, 'Denied reporting', applicantEmail]
    );
    const clientId = Number(clientResult.insertId);

    const [caseResult] = await connection.query(
      `INSERT INTO iset_case
         (case_number, client_id, status, lifecycle_status, closure_reason, closed_at, case_context_json)
       VALUES (?, ?, 'closed', 'closed', 'application_denied', NOW(), ?)`,
      [
        caseNumber,
        clientId,
        JSON.stringify({
          reportingOnlyDenied: true,
          reportingCorrectionAllowed: true,
          excludeFromCaseworkQueues: true,
          reportingTrigger: 'denial',
          reportingSeedSource: 'denied_reporting',
        }),
      ]
    );
    const caseId = Number(caseResult.insertId);

    const [firstApplicationResult] = await connection.query(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status, decision_outcome, awaiting_reason, closure_reason)
       VALUES (NULL, ?, ?, ?, 'denied', 'closed', 'denied', 'none', 'application_denied')`,
      [clientId, caseId, JSON.stringify({ answers: { contractApplication: 'first' } })]
    );
    const firstApplicationId = Number(firstApplicationResult.insertId);

    const [secondApplicationResult] = await connection.query(
      `INSERT INTO iset_application
         (submission_id, client_id, case_id, payload_json, status, lifecycle_status, awaiting_reason)
       VALUES (NULL, ?, ?, ?, 'submitted', 'submitted', 'none')`,
      [clientId, caseId, JSON.stringify({ answers: { contractApplication: 'second' } })]
    );
    const secondApplicationId = Number(secondApplicationResult.insertId);

    await connection.query(
      `INSERT INTO iset_application_assessment (application_id, case_id, esdc_eligibility)
       VALUES (?, ?, 'EI Reach Back')`,
      [firstApplicationId, caseId]
    );
    await connection.query(
      `INSERT INTO iset_application_assessment (application_id, case_id, esdc_eligibility)
       VALUES (?, ?, 'CRF')`,
      [secondApplicationId, caseId]
    );

    const [firstPlanResult] = await connection.query(
      `INSERT INTO iset_case_action_plan
         (case_id, application_id, name, status, funding_stream, EIClaimant, metadata_json)
       VALUES (?, ?, 'Actions leading to denial', 'draft', 'EI', 2, ?)`,
      [caseId, firstApplicationId, JSON.stringify({ source: 'denied_reporting' })]
    );
    const firstPlanId = Number(firstPlanResult.insertId);

    const [firstInterventionResult] = await connection.query(
      `INSERT INTO iset_case_intervention
         (case_id, action_plan_id, intervention_code, status, funding_stream_decision, metadata_json)
       VALUES (?, ?, 1, 'draft', 'EI', ?)`,
      [caseId, firstPlanId, JSON.stringify({ source: 'denied_reporting' })]
    );
    const firstInterventionId = Number(firstInterventionResult.insertId);

    const [firstSubmissionResult] = await connection.query(
      `INSERT INTO esdc_participant_submission (case_id, action_plan_id, application_id)
       VALUES (?, ?, ?)`,
      [caseId, firstPlanId, firstApplicationId]
    );
    const firstSubmissionId = Number(firstSubmissionResult.insertId);

    const secondPlanCountBeforeCreation = await queryScalar(
      connection,
      `SELECT COUNT(*)
         FROM iset_case_action_plan
        WHERE case_id = ?
          AND (application_id = ? OR application_id IS NULL)
          AND archived_at IS NULL`,
      [caseId, secondApplicationId]
    );
    const secondInterventionCountBeforeCreation = await queryScalar(
      connection,
      `SELECT COUNT(*)
         FROM \`iset_case_intervention\` AS \`ci\`
         LEFT JOIN \`iset_case_action_plan\` AS \`ap\` ON \`ap\`.\`id\` = \`ci\`.\`action_plan_id\`
        WHERE \`ci\`.\`case_id\` = ?
          AND (
            \`ci\`.\`action_plan_id\` IS NULL
            OR (
              \`ap\`.\`case_id\` = ?
              AND (\`ap\`.\`application_id\` = ? OR \`ap\`.\`application_id\` IS NULL)
            )
          )`,
      [caseId, caseId, secondApplicationId]
    );
    assertContract(secondPlanCountBeforeCreation === 0, 'sibling_plan_contaminated_second_application');
    assertContract(secondInterventionCountBeforeCreation === 0, 'sibling_intervention_contaminated_second_application');

    const meaningfulSiblingCount = await queryScalar(
      connection,
      `SELECT COUNT(*)
         FROM iset_application
        WHERE case_id = ?
          AND id <> ?
          AND NOT (
            LOWER(COALESCE(status, '')) IN ('withdrawn', 'rejected', 'declined', 'denied', 'cancelled', 'archived')
            OR LOWER(COALESCE(lifecycle_status, '')) = 'archived'
            OR LOWER(COALESCE(closure_reason, '')) IN ('withdrawn', 'application_denied')
            OR LOWER(COALESCE(decision_outcome, '')) = 'denied'
          )`,
      [caseId, firstApplicationId]
    );
    assertContract(meaningfulSiblingCount === 1, 'active_sibling_was_not_detected');

    const [secondPlanResult] = await connection.query(
      `INSERT INTO iset_case_action_plan
         (case_id, application_id, name, status, funding_stream, EIClaimant, metadata_json)
       VALUES (?, ?, 'Actions leading to denial', 'draft', 'CRF', 3, ?)`,
      [caseId, secondApplicationId, JSON.stringify({ source: 'denied_reporting' })]
    );
    const secondPlanId = Number(secondPlanResult.insertId);

    const [secondInterventionResult] = await connection.query(
      `INSERT INTO iset_case_intervention
         (case_id, action_plan_id, intervention_code, status, funding_stream_decision, metadata_json)
       VALUES (?, ?, 1, 'draft', 'CRF', ?)`,
      [caseId, secondPlanId, JSON.stringify({ source: 'denied_reporting' })]
    );
    const secondInterventionId = Number(secondInterventionResult.insertId);

    const [secondSubmissionResult] = await connection.query(
      `INSERT INTO esdc_participant_submission (case_id, action_plan_id, application_id)
       VALUES (?, ?, ?)`,
      [caseId, secondPlanId, secondApplicationId]
    );
    const secondSubmissionId = Number(secondSubmissionResult.insertId);

    const [planRows] = await connection.query(
      `SELECT id, application_id, funding_stream, EIClaimant
         FROM iset_case_action_plan
        WHERE case_id = ?
        ORDER BY application_id, id`,
      [caseId]
    );
    const [interventionRows] = await connection.query(
      `SELECT id, action_plan_id, funding_stream_decision
         FROM iset_case_intervention
        WHERE case_id = ?
        ORDER BY action_plan_id, id`,
      [caseId]
    );
    const [submissionRows] = await connection.query(
      `SELECT id, action_plan_id, application_id
         FROM esdc_participant_submission
        WHERE case_id = ?
        ORDER BY application_id, action_plan_id, id`,
      [caseId]
    );

    assertContract(planRows.length === 2, 'repeated_denial_plan_count_failed');
    assertContract(interventionRows.length === 2, 'repeated_denial_intervention_count_failed');
    assertContract(submissionRows.length === 2, 'repeated_denial_submission_count_failed');
    assertContract(
      Number(planRows[0].id) === firstPlanId &&
      Number(planRows[0].application_id) === firstApplicationId &&
      planRows[0].funding_stream === 'EI' &&
      Number(planRows[0].EIClaimant) === 2,
      'first_denial_plan_scope_or_ei_failed'
    );
    assertContract(
      Number(planRows[1].id) === secondPlanId &&
      Number(planRows[1].application_id) === secondApplicationId &&
      planRows[1].funding_stream === 'CRF' &&
      Number(planRows[1].EIClaimant) === 3,
      'second_denial_plan_scope_or_ei_failed'
    );
    assertContract(
      Number(interventionRows[0].id) === firstInterventionId &&
      Number(interventionRows[0].action_plan_id) === firstPlanId &&
      interventionRows[0].funding_stream_decision === 'EI',
      'first_denial_intervention_scope_or_ei_failed'
    );
    assertContract(
      Number(interventionRows[1].id) === secondInterventionId &&
      Number(interventionRows[1].action_plan_id) === secondPlanId &&
      interventionRows[1].funding_stream_decision === 'CRF',
      'second_denial_intervention_scope_or_ei_failed'
    );
    assertContract(
      Number(submissionRows[0].id) === firstSubmissionId &&
      Number(submissionRows[0].action_plan_id) === firstPlanId &&
      Number(submissionRows[0].application_id) === firstApplicationId,
      'first_denial_submission_scope_failed'
    );
    assertContract(
      Number(submissionRows[1].id) === secondSubmissionId &&
      Number(submissionRows[1].action_plan_id) === secondPlanId &&
      Number(submissionRows[1].application_id) === secondApplicationId,
      'second_denial_submission_scope_failed'
    );

    await connection.rollback();
    transactionStarted = false;
    rolledBack = true;
  } catch (error) {
    if (transactionStarted && executionState.mutationBegan) {
      await connection.rollback();
      transactionStarted = false;
      rolledBack = true;
    }
    throw error;
  }

  assertContract(rolledBack, 'denied_reporting_contract_rollback_not_completed');
  const residueCount = await queryScalar(
    connection,
    'SELECT COUNT(*) FROM client WHERE applicant_account_email = ?',
    [applicantEmail]
  );
  assertContract(residueCount === 0, 'denied_reporting_contract_residue_detected');

  return {
    applicationCount: 2,
    actionPlanCount: 2,
    interventionCount: 2,
    submissionCount: 2,
    siblingDependencyIsolation: true,
    activeSiblingDetection: true,
    eiAlignment: true,
    rollbackResidueCount: residueCount,
  };
}

async function runContract({
  connection,
  config,
  schemaPreflightOnly = false,
  residueAuditOnly = false,
}) {
  const executionState = { mutationBegan: false };
  const schemaGuard = createLiveMysqlSchemaGuard({
    connection,
    expectedIdentity: EXPECTED_DEV_IDENTITY,
    configuredIdentity: {
      host: config.host,
      user: config.user,
      database: config.database,
      port: config.port,
    },
    requiredObjects: REQUIRED_OBJECTS,
    requiredRelationships: REQUIRED_RELATIONSHIPS,
    allowedTableAliases: ['ap', 'ci'],
    onBeforeStatementExecute({ mutating }) {
      if (mutating) executionState.mutationBegan = true;
    },
  });
  const schemaSafety = await schemaGuard.preflight();
  const objectProofs = Object.fromEntries(
    REQUIRED_OBJECTS.map(name => [name, schemaGuard.getObjectProof(name)])
  );
  if (schemaPreflightOnly) {
    return {
      schemaVersion: 1,
      status: 'passed',
      targetEnvironment: 'dev',
      mode: 'schema-preflight-only',
      ordinaryStatementCount: 0,
      schemaSafety,
      objectProofs,
    };
  }
  if (residueAuditOnly) {
    const residueCount = await queryScalar(
      schemaGuard.createGuardedConnection(),
      'SELECT COUNT(*) FROM client WHERE applicant_account_email LIKE ?',
      ['denied-reporting-contract-%@example.invalid']
    );
    assertContract(residueCount === 0, 'denied_reporting_contract_residue_detected');
    return {
      schemaVersion: 1,
      status: 'passed',
      targetEnvironment: 'dev',
      mode: 'residue-audit-only',
      residueCount,
      schemaSafety,
    };
  }
  const contract = await runRollbackFixture(
    schemaGuard.createGuardedConnection(),
    executionState
  );
  return {
    schemaVersion: 1,
    status: 'passed',
    targetEnvironment: 'dev',
    mode: 'rollback-contract',
    contract,
    schemaSafety,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = dotenv.config({ path: args.envFile, override: false, quiet: true });
  if (loaded.error) throw loaded.error;
  const config = databaseConfig(process.env);
  const connection = await mysql.createConnection(config);
  try {
    const result = await runContract({
      connection,
      config,
      schemaPreflightOnly: args.schemaPreflightOnly,
      residueAuditOnly: args.residueAuditOnly,
    });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else if (args.schemaPreflightOnly) {
      console.log('Denied-reporting application contract schema preflight: PASS (zero ordinary statements)');
    } else if (args.residueAuditOnly) {
      console.log('Denied-reporting application contract residue audit: PASS (zero residue)');
    } else {
      console.log('Denied-reporting application contract: PASS (two exact application artifacts, zero residue)');
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_DEV_IDENTITY,
  REQUIRED_OBJECTS,
  REQUIRED_RELATIONSHIPS,
  runRollbackFixture,
  runContract,
};
