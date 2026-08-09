#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

const {
  ADMIN_RUNTIME_ENUM_REQUIREMENTS,
  ADMIN_RUNTIME_SCHEMA_REQUIREMENTS,
  STAFF_PROFILE_RUNTIME_COLUMNS,
  assertAdminRuntimeSchemaReady,
} = require('../src/lib/adminRuntimeSchemaContract');
const {
  PORTAL_RUNTIME_SCHEMA_REQUIREMENTS,
  assertPortalRuntimeSchemaReady,
} = require('../../ISET-intake/src/services/schemaReadiness');
const {
  archiveReplaceableAssessmentFinancialOverviews,
  shouldPreserveAssessmentApplicationForm,
  shouldPreserveAssessmentFinancialOverview,
} = require('../src/lib/financialOverviewDocumentPolicy');

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
const REAL_CONTRACT_OBJECTS = Object.freeze(Array.from(new Set([
  ...ADMIN_RUNTIME_SCHEMA_REQUIREMENTS.map(([table]) => table),
  ...PORTAL_RUNTIME_SCHEMA_REQUIREMENTS.map(([table]) => table),
  ...ADMIN_RUNTIME_ENUM_REQUIREMENTS.map(([table]) => table),
  'user',
  'client',
  'iset_case',
  'iset_application',
  'funding_overview_series',
  'funding_overview_version',
  'funding_overview_version_documents',
  'iset_document',
])));
const RELEASE_CONTRACT_RESIDUE_AUDITS = Object.freeze([
  Object.freeze({
    key: 'staffProfilesByCognitoSubject',
    sql: 'SELECT COUNT(*) FROM staff_profiles WHERE cognito_sub LIKE ?',
    params: Object.freeze(['release-qualification-%']),
  }),
  Object.freeze({
    key: 'staffProfilesByEmail',
    sql: 'SELECT COUNT(*) FROM staff_profiles WHERE email LIKE ?',
    params: Object.freeze(['release-qualification-%@example.invalid']),
  }),
  Object.freeze({
    key: 'importRuns',
    sql: 'SELECT COUNT(*) FROM client_file_import_run WHERE file_name = ? AND worksheet_name = ?',
    params: Object.freeze(['release-qualification.csv', 'contract']),
  }),
  Object.freeze({
    key: 'identityClaims',
    sql: 'SELECT COUNT(*) FROM client_file_import_identity_claim WHERE identity_key LIKE ?',
    params: Object.freeze(['rq:%']),
  }),
  Object.freeze({
    key: 'events',
    sql: 'SELECT COUNT(*) FROM iset_event_entry WHERE category = ? AND event_type = ? AND captured_by = ?',
    params: Object.freeze(['release_qualification', 'release_contract_probe', 'release-qualification']),
  }),
  Object.freeze({
    key: 'deliveries',
    sql: 'SELECT COUNT(*) FROM iset_event_delivery WHERE JSON_UNQUOTE(JSON_EXTRACT(payload_json, ?)) = ?',
    params: Object.freeze(['$.fixture', 'release-qualification']),
  }),
  Object.freeze({
    key: 'financialOverviewUsers',
    sql: 'SELECT COUNT(*) FROM user WHERE email LIKE ?',
    params: Object.freeze(['release-financial-overview-%@example.invalid']),
  }),
  Object.freeze({
    key: 'financialOverviewClients',
    sql: 'SELECT COUNT(*) FROM client WHERE last_name LIKE ? AND applicant_account_email LIKE ?',
    params: Object.freeze(['Financial-%', 'release-financial-overview-%@example.invalid']),
  }),
  Object.freeze({
    key: 'financialOverviewCases',
    sql: 'SELECT COUNT(*) FROM iset_case WHERE case_number LIKE ?',
    params: Object.freeze(['RQ-FO-%']),
  }),
  Object.freeze({
    key: 'financialOverviewDocuments',
    sql: 'SELECT COUNT(*) FROM iset_document WHERE file_path LIKE ?',
    params: Object.freeze(['release-qualification/%']),
  }),
]);

function parseArgs(argv) {
  const args = {
    envFile: path.join(REPO_ROOT, '.env'),
    targetEnv: 'dev',
    schemaPreflightOnly: false,
    residueAuditOnly: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index] || '');
    else if (token === '--target-env') args.targetEnv = String(argv[++index] || '').toLowerCase();
    else if (token === '--schema-preflight-only') args.schemaPreflightOnly = true;
    else if (token === '--residue-audit-only') args.residueAuditOnly = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log([
        'Usage: node scripts/real-mysql-release-contract.js [options]',
        '',
        'Runs rollback-only release contracts against the real local DEV MySQL schema.',
        '',
        'Options:',
        '  --env-file PATH    DEV dotenv file. Default: .env',
        '  --target-env dev   Must be dev; TEST/PROD use deployed acceptance tooling.',
        '  --schema-preflight-only  Prove exact DEV identity and structural metadata; no ordinary SQL.',
        '  --residue-audit-only  Preflight, then count release-contract residue; no mutation or cleanup.',
        '  --json             Emit JSON.',
      ].join('\n'));
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${token}`);
    }
  }
  if (args.targetEnv !== 'dev') {
    throw new Error('This rollback fixture is restricted to local DEV. Use TEST acceptance tooling for deployed environments.');
  }
  if (args.schemaPreflightOnly && args.residueAuditOnly) {
    throw new Error('--schema-preflight-only and --residue-audit-only are mutually exclusive.');
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

async function queryScalar(connection, sql, params = []) {
  const [rows] = await connection.query(sql, params);
  return Number(Object.values(rows?.[0] || {})[0] || 0);
}

function numericCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const counts = {};
  for (const [key, count] of Object.entries(value)) {
    if (/^[A-Za-z][A-Za-z0-9]*$/u.test(key) && Number.isFinite(Number(count))) {
      counts[key] = Number(count);
    }
  }
  return Object.keys(counts).length ? counts : null;
}

function safeErrorText(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/gu, ' ')
    .replace(/\b(password|passwd|token|secret|authorization)\s*[:=]\s*[^\s,;]+/giu, '$1=[REDACTED]')
    .slice(0, 1000);
}

function serializeFailure(error, seen = new WeakSet()) {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return {
      name: 'Error',
      code: null,
      message: safeErrorText(error),
    };
  }
  if (seen.has(error)) {
    return {
      name: 'Error',
      code: 'release_contract_error_cycle',
      message: 'Circular nested error omitted',
    };
  }
  seen.add(error);
  const serialized = {
    name: safeErrorText(error.name || error.constructor?.name || 'Error'),
    code: error.code === undefined || error.code === null ? null : safeErrorText(error.code),
    message: safeErrorText(error.message || error),
  };
  const cleanup = numericCounts(error.cleanup);
  if (cleanup) serialized.cleanup = cleanup;
  const rollback = numericCounts(error.recovery?.rollback);
  const cleanupRecovery = numericCounts(error.recovery?.cleanup);
  if (rollback || cleanupRecovery) {
    serialized.recovery = {};
    if (rollback) serialized.recovery.rollback = rollback;
    if (cleanupRecovery) serialized.recovery.cleanup = cleanupRecovery;
  }
  if (Array.isArray(error.errors) && error.errors.length) {
    serialized.errors = error.errors.map(nested => serializeFailure(nested, seen));
  }
  if (error.cause) serialized.cause = serializeFailure(error.cause, seen);
  return serialized;
}

function failureReport(error) {
  return {
    schemaVersion: 1,
    status: 'failed',
    contract: 'real-mysql-release-contract',
    failure: serializeFailure(error),
  };
}

async function runResidueAudit(connection) {
  const counts = {};
  for (const audit of RELEASE_CONTRACT_RESIDUE_AUDITS) {
    counts[audit.key] = await queryScalar(connection, audit.sql, [...audit.params]);
  }
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total !== 0) {
    const error = new Error('release_contract_residue_detected');
    error.name = 'ReleaseContractResidueError';
    error.code = 'release_contract_residue_detected';
    error.cleanup = counts;
    error.recovery = {
      rollback: { attempted: 0, succeeded: 0, failed: 0 },
      cleanup: {
        planned: 0,
        attempted: 0,
        completed: 0,
        auditChecks: RELEASE_CONTRACT_RESIDUE_AUDITS.length,
        nonzeroScopes: Object.values(counts).filter(count => count !== 0).length,
        totalResidue: total,
      },
    };
    throw error;
  }
  return {
    counts,
    total,
    clean: true,
    auditChecks: RELEASE_CONTRACT_RESIDUE_AUDITS.length,
  };
}

async function runRollbackContracts(connection, executionState = { mutationBegan: false }) {
  const suffix = crypto.randomUUID().replace(/-/gu, '');
  const staffSubject = `release-qualification-${suffix}`;
  const staffEmail = `release-qualification-${suffix}@example.invalid`;
  const importHash = crypto.createHash('sha256').update(`release-import-${suffix}`).digest('hex');
  const identityKey = `rq:${crypto.createHash('sha256').update(suffix).digest('hex')}`;
  const eventId = crypto.randomUUID();
  const applicantEmail = `release-financial-overview-${suffix}@example.invalid`;
  const caseNumber = `RQ-FO-${suffix.slice(0, 20)}`;
  const protectedDocumentPath = `release-qualification/${suffix}/financial-overview-v1-signed.pdf`;
  const replaceableDocumentPath = `release-qualification/${suffix}/financial-overview-legacy.pdf`;
  const caseLevelApplicationFormPath = `release-qualification/${suffix}/case-level-application-form.pdf`;
  const currentApplicationFormPath = `release-qualification/${suffix}/current-application-form.pdf`;
  const metadataOnlyCurrentOverviewPath = `release-qualification/${suffix}/financial-overview-v2-metadata-only.pdf`;
  let transactionStarted = false;
  let contractError = null;
  let rollbackError = null;
  const recovery = {
    rollback: { attempted: 0, succeeded: 0, failed: 0 },
    cleanup: {
      planned: 8,
      attempted: 0,
      completed: 0,
      nonzeroScopes: 0,
      totalResidue: 0,
    },
  };

  try {
    await connection.beginTransaction();
    transactionStarted = true;

    await connection.query(
      `INSERT INTO staff_profiles (cognito_sub, email, primary_role, region_id)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         email = VALUES(email),
         primary_role = VALUES(primary_role),
         region_id = COALESCE(VALUES(region_id), region_id)`,
      [staffSubject, staffEmail, 'System Administrator', null]
    );
    const selectedColumns = STAFF_PROFILE_RUNTIME_COLUMNS.map(column => `\`${column}\``).join(', ');
    const [staffRows] = await connection.query(
      `SELECT ${selectedColumns} FROM staff_profiles WHERE cognito_sub = ? LIMIT 1`,
      [staffSubject]
    );
    if (!staffRows?.[0] || staffRows[0].email !== staffEmail) {
      throw new Error('staff_profile_authenticated_request_contract_failed');
    }

    await connection.query(
      `INSERT INTO client_file_import_run
         (request_hash, status, actor_staff_profile_id, file_name, worksheet_name, result_json)
       VALUES (?, 'in_progress', ?, ?, ?, CAST(? AS JSON))`,
      [importHash, staffRows[0].id, 'release-qualification.csv', 'contract', '{}']
    );
    await connection.query(
      'INSERT INTO client_file_import_identity_claim (identity_key, client_id) VALUES (?, NULL)',
      [identityKey]
    );

    await connection.query(
      `INSERT INTO iset_event_entry
         (id, category, event_type, severity, source, subject_type, subject_id,
          actor_type, actor_id, actor_display_name, payload_json, captured_by,
          notification_delivery_mode, captured_at, ingested_at)
       VALUES (?, 'release_qualification', 'release_contract_probe', 'info', 'admin',
               'system', ?, 'system', NULL, 'Release qualification', CAST(? AS JSON),
               'release-qualification', 'suppressed', NOW(3), NOW(3))`,
      [eventId, suffix, JSON.stringify({ fixture: 'release-qualification', suffix })]
    );
    await connection.query(
      `INSERT INTO iset_event_delivery
         (event_id, channel, audience_key, worker_scope, status, payload_json)
       VALUES (?, 'fanout', '__fanout__', 'admin', 'pending', CAST(? AS JSON))`,
      [eventId, JSON.stringify({ fixture: 'release-qualification', suffix })]
    );
    const [deliveryRows] = await connection.query(
      `SELECT event_id, channel, audience_key, worker_scope, status
         FROM iset_event_delivery
        WHERE event_id = ?
        FOR UPDATE`,
      [eventId]
    );
    if (deliveryRows?.[0]?.status !== 'pending') {
      throw new Error('event_delivery_worker_contract_failed');
    }

    const [applicantResult] = await connection.query(
      `INSERT INTO user (name, email, preferred_language)
       VALUES (?, ?, 'en')`,
      [`Release Financial Overview ${suffix}`, applicantEmail]
    );
    const applicantUserId = applicantResult.insertId;
    const [clientResult] = await connection.query(
      `INSERT INTO client (first_name, last_name, applicant_account_email)
       VALUES ('Release', ?, ?)`,
      [`Financial-${suffix}`, applicantEmail]
    );
    const clientId = clientResult.insertId;
    const [caseResult] = await connection.query(
      `INSERT INTO iset_case (case_number, client_id, status)
       VALUES (?, ?, 'intake')`,
      [caseNumber, clientId]
    );
    const caseId = caseResult.insertId;
    const [applicationResult] = await connection.query(
      `INSERT INTO iset_application (submission_id, client_id, case_id, status)
       VALUES (NULL, ?, ?, 'pending_approval')`,
      [clientId, caseId]
    );
    const applicationId = applicationResult.insertId;
    const [currentApplicationResult] = await connection.query(
      `INSERT INTO iset_application (submission_id, client_id, case_id, status)
       VALUES (NULL, ?, ?, 'pending_approval')`,
      [clientId, caseId]
    );
    const currentApplicationId = currentApplicationResult.insertId;
    const [seriesResult] = await connection.query(
      `INSERT INTO funding_overview_series (case_id, template_key)
       VALUES (?, 'ISET_FUNDING_OVERVIEW_STANDARD')`,
      [caseId]
    );
    const [versionResult] = await connection.query(
      `INSERT INTO funding_overview_version
         (series_id, version_number, status, signed_at, signed_by_participant_id,
          snapshot_schema_version, metadata_json)
       VALUES (?, 1, 'signed', NOW(), ?, '1', CAST('{}' AS JSON))`,
      [seriesResult.insertId, applicantUserId]
    );
    const [protectedDocumentResult] = await connection.query(
      `INSERT INTO iset_document
         (applicant_user_id, client_id, application_id, case_id, source, file_name,
          file_path, mime_type, label, metadata, status, document_category)
       VALUES (?, ?, ?, ?, 'system_generated', 'financial-overview-v1-signed.pdf',
               ?, 'application/pdf', 'Financial Overview v1 (signed)',
               CAST(? AS JSON), 'active', 'financial_overview')`,
      [
        applicantUserId,
        clientId,
        applicationId,
        caseId,
        protectedDocumentPath,
        JSON.stringify({ funding_overview_version_id: versionResult.insertId }),
      ]
    );
    await connection.query(
      `INSERT INTO funding_overview_version_documents
         (funding_overview_version_id, document_type, document_id)
       VALUES (?, 'signed', ?)`,
      [versionResult.insertId, protectedDocumentResult.insertId]
    );
    const [replaceableDocumentResult] = await connection.query(
      `INSERT INTO iset_document
         (applicant_user_id, client_id, application_id, case_id, source, file_name,
          file_path, mime_type, label, metadata, status, document_category)
       VALUES (?, ?, ?, ?, 'system_generated', 'financial-overview-legacy.pdf',
               ?, 'application/pdf', 'Financial overview/budget',
               CAST(? AS JSON), 'active', 'financial_overview')`,
      [
        applicantUserId,
        clientId,
        applicationId,
        caseId,
        replaceableDocumentPath,
        JSON.stringify({ document_type: 'financial_overview' }),
      ]
    );

    const preserveVersionManaged = await shouldPreserveAssessmentFinancialOverview(connection, {
      caseId,
      applicationId,
      explicitlyPreserve: false,
    });
    if (!preserveVersionManaged) {
      throw new Error('financial_overview_version_preservation_contract_failed');
    }
    const preserveOlderVersionForCurrentApplication = await shouldPreserveAssessmentFinancialOverview(connection, {
      caseId,
      applicationId: currentApplicationId,
      explicitlyPreserve: false,
    });
    if (preserveOlderVersionForCurrentApplication) {
      throw new Error('repeat_application_financial_overview_isolation_contract_failed');
    }

    const [metadataOnlyVersionResult] = await connection.query(
      `INSERT INTO funding_overview_version
         (series_id, version_number, status, signed_at, signed_by_participant_id,
          snapshot_schema_version, metadata_json)
       VALUES (?, 2, 'signed', NOW(), ?, '1', CAST('{}' AS JSON))`,
      [seriesResult.insertId, applicantUserId]
    );
    await connection.query(
      `INSERT INTO iset_document
         (applicant_user_id, client_id, application_id, case_id, source, file_name,
          file_path, mime_type, label, metadata, status, document_category)
       VALUES (?, ?, ?, ?, 'system_generated', 'financial-overview-v2-metadata-only.pdf',
               ?, 'application/pdf', 'Financial Overview v2 (metadata-only link)',
               CAST(? AS JSON), 'active', 'financial_overview')`,
      [
        applicantUserId,
        clientId,
        currentApplicationId,
        caseId,
        metadataOnlyCurrentOverviewPath,
        JSON.stringify({ funding_overview_version_id: metadataOnlyVersionResult.insertId }),
      ]
    );
    const preserveMetadataOnlyCurrentOverview = await shouldPreserveAssessmentFinancialOverview(connection, {
      caseId,
      applicationId: currentApplicationId,
      explicitlyPreserve: false,
    });
    if (!preserveMetadataOnlyCurrentOverview) {
      throw new Error('metadata_only_financial_overview_preservation_contract_failed');
    }

    await connection.query(
      `INSERT INTO iset_document
         (applicant_user_id, client_id, case_id, source, file_name, file_path,
          mime_type, label, metadata, status, document_category)
       VALUES (?, ?, ?, 'manual_upload', 'case-level-application-form.pdf', ?,
               'application/pdf', 'Case-level application form', CAST(? AS JSON),
               'active', 'application_form')`,
      [
        applicantUserId,
        clientId,
        caseId,
        caseLevelApplicationFormPath,
        JSON.stringify({ document_type: 'application_form' }),
      ]
    );
    const preserveCaseLevelApplicationForm = await shouldPreserveAssessmentApplicationForm(connection, {
      applicationId: currentApplicationId,
      explicitlyPreserve: true,
    });
    if (preserveCaseLevelApplicationForm) {
      throw new Error('case_level_application_form_isolation_contract_failed');
    }

    await connection.query(
      `INSERT INTO iset_document
         (applicant_user_id, client_id, application_id, case_id, source, file_name,
          file_path, mime_type, label, metadata, status, document_category)
       VALUES (?, ?, ?, ?, 'manual_upload', 'current-application-form.pdf', ?,
               'application/pdf', 'Current application form', CAST(? AS JSON),
               'active', 'application_form')`,
      [
        applicantUserId,
        clientId,
        currentApplicationId,
        caseId,
        currentApplicationFormPath,
        JSON.stringify({ document_type: 'application_form' }),
      ]
    );
    const preserveCurrentApplicationForm = await shouldPreserveAssessmentApplicationForm(connection, {
      applicationId: currentApplicationId,
      explicitlyPreserve: true,
    });
    if (!preserveCurrentApplicationForm) {
      throw new Error('current_application_form_preservation_contract_failed');
    }

    const archivedCount = await archiveReplaceableAssessmentFinancialOverviews(connection, {
      applicationId,
    });
    if (archivedCount !== 1) {
      throw new Error(`financial_overview_archive_scope_contract_failed:${archivedCount}`);
    }
    const [financialOverviewRows] = await connection.query(
      `SELECT id, status
         FROM iset_document
        WHERE id IN (?, ?)
        ORDER BY id`,
      [protectedDocumentResult.insertId, replaceableDocumentResult.insertId]
    );
    const statusById = new Map(
      (financialOverviewRows || []).map(row => [Number(row.id), row.status])
    );
    if (
      statusById.get(Number(protectedDocumentResult.insertId)) !== 'active' ||
      statusById.get(Number(replaceableDocumentResult.insertId)) !== 'archived'
    ) {
      throw new Error('financial_overview_document_status_contract_failed');
    }

    recovery.rollback.attempted += 1;
    try {
      await connection.rollback();
      recovery.rollback.succeeded += 1;
    } catch (errorDuringRollback) {
      recovery.rollback.failed += 1;
      throw errorDuringRollback;
    }
    transactionStarted = false;
  } catch (error) {
    contractError = error;
    if (!executionState.mutationBegan) throw error;
    if (transactionStarted) {
      recovery.rollback.attempted += 1;
      try {
        await connection.rollback();
        recovery.rollback.succeeded += 1;
      } catch (errorDuringRollback) {
        recovery.rollback.failed += 1;
        rollbackError = errorDuringRollback;
      }
      transactionStarted = false;
    }
  }

  let residue = {};
  let residueError = null;
  const auditResidue = async (key, sql, params) => {
    recovery.cleanup.attempted += 1;
    const count = await queryScalar(connection, sql, params);
    recovery.cleanup.completed += 1;
    residue[key] = count;
    return count;
  };
  try {
    await auditResidue('staffProfiles', 'SELECT COUNT(*) FROM staff_profiles WHERE cognito_sub = ?', [staffSubject]);
    await auditResidue('importRuns', 'SELECT COUNT(*) FROM client_file_import_run WHERE request_hash = ?', [importHash]);
    await auditResidue('identityClaims', 'SELECT COUNT(*) FROM client_file_import_identity_claim WHERE identity_key = ?', [identityKey]);
    await auditResidue('events', 'SELECT COUNT(*) FROM iset_event_entry WHERE id = ?', [eventId]);
    await auditResidue('deliveries', 'SELECT COUNT(*) FROM iset_event_delivery WHERE event_id = ?', [eventId]);
    await auditResidue('financialOverviewUsers', 'SELECT COUNT(*) FROM user WHERE email = ?', [applicantEmail]);
    await auditResidue('financialOverviewCases', 'SELECT COUNT(*) FROM iset_case WHERE case_number = ?', [caseNumber]);
    await auditResidue(
      'financialOverviewDocuments',
      'SELECT COUNT(*) FROM iset_document WHERE file_path IN (?, ?, ?, ?, ?)',
      [
        protectedDocumentPath,
        replaceableDocumentPath,
        caseLevelApplicationFormPath,
        currentApplicationFormPath,
        metadataOnlyCurrentOverviewPath,
      ]
    );
    recovery.cleanup.nonzeroScopes = Object.values(residue).filter(value => value !== 0).length;
    recovery.cleanup.totalResidue = Object.values(residue).reduce((sum, value) => sum + value, 0);
    if (recovery.cleanup.nonzeroScopes !== 0) {
      residueError = new Error(`release_contract_cleanup_incomplete:${JSON.stringify(residue)}`);
      residueError.code = 'release_contract_cleanup_incomplete';
    }
  } catch (error) {
    residueError = error;
  }
  const failures = [contractError, rollbackError, residueError].filter(Boolean);
  if (failures.length) {
    const aggregate = new AggregateError(failures, 'release_contract_failed_with_cleanup_evidence');
    aggregate.code = residueError ? 'release_contract_cleanup_unproven' : 'release_contract_failed';
    aggregate.cleanup = residue;
    aggregate.recovery = recovery;
    throw aggregate;
  }
  return residue;
}

async function runRealMysqlReleaseContract({
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
    requiredObjects: REAL_CONTRACT_OBJECTS,
    allowedTableAliases: ['d', 'vd', 'v', 's'],
    onBeforeStatementExecute({ mutating }) {
      if (mutating) executionState.mutationBegan = true;
    },
  });
  const schemaSafety = await schemaGuard.preflight();
  if (schemaPreflightOnly) {
    return {
      schemaVersion: 2,
      status: 'passed',
      targetEnvironment: 'dev',
      mode: 'schema-preflight-only',
      schemaSafety,
      ordinaryStatementCount: 0,
      mutationBegan: false,
    };
  }
  const guardedConnection = schemaGuard.createGuardedConnection();
  if (residueAuditOnly) {
    const residue = await runResidueAudit(guardedConnection);
    return {
      schemaVersion: 2,
      status: 'passed',
      targetEnvironment: 'dev',
      mode: 'residue-audit-only',
      database: {
        name: schemaSafety.identity.database,
        host: schemaSafety.identity.host,
        port: schemaSafety.identity.port,
        currentUser: schemaSafety.identity.currentUser,
        version: schemaSafety.identity.version,
      },
      residue,
      mutationBegan: false,
      cleanupAttempted: false,
      schemaSafety: schemaGuard.evidence(),
    };
  }
  await assertAdminRuntimeSchemaReady(guardedConnection);
  await assertPortalRuntimeSchemaReady(guardedConnection);
  const cleanup = await runRollbackContracts(guardedConnection, executionState);
  return {
      schemaVersion: 2,
      status: 'passed',
      targetEnvironment: 'dev',
      database: {
        name: schemaSafety.identity.database,
        host: schemaSafety.identity.host,
        port: schemaSafety.identity.port,
        currentUser: schemaSafety.identity.currentUser,
        version: schemaSafety.identity.version,
      },
      contracts: {
        adminRuntimeRequirements: true,
        portalRuntimeRequirements: true,
        authenticatedStaffHydration: true,
        importClaimPersistence: true,
        eventDeliveryPersistence: true,
        financialOverviewVersionPreservation: true,
        financialOverviewMetadataCompatibility: true,
        repeatApplicationDocumentIsolation: true,
        currentApplicationDocumentPreservation: true,
      },
      requirementCounts: {
        admin: ADMIN_RUNTIME_SCHEMA_REQUIREMENTS.length,
        portal: PORTAL_RUNTIME_SCHEMA_REQUIREMENTS.length,
      },
      cleanup,
      schemaSafety: schemaGuard.evidence(),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = dotenv.config({ path: args.envFile, override: false, quiet: true });
  if (loaded.error) throw loaded.error;
  const config = databaseConfig(process.env);
  const connection = await mysql.createConnection(config);
  try {
    const result = await runRealMysqlReleaseContract({
      connection,
      config,
      schemaPreflightOnly: args.schemaPreflightOnly,
      residueAuditOnly: args.residueAuditOnly,
    });
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else if (args.schemaPreflightOnly) {
      console.log('Real MySQL release contract schema preflight: PASS (zero ordinary statements)');
    } else if (args.residueAuditOnly) {
      console.log(`Real MySQL release contract residue audit: PASS (${result.residue.auditChecks} guarded checks, zero residue)`);
    } else {
      console.log('Real MySQL release contract: PASS');
      console.log(`Database: ${result.database.name} on ${result.database.host}:${result.database.port}`);
      console.log(`Readiness contracts: admin ${result.requirementCounts.admin}, portal ${result.requirementCounts.portal}`);
      console.log('Rollback cleanup: zero residue');
    }
    return result;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(JSON.stringify(failureReport(error), null, 2));
    process.exitCode = 1;
  });
}

module.exports = {
  EXPECTED_DEV_IDENTITY,
  RELEASE_CONTRACT_RESIDUE_AUDITS,
  REAL_CONTRACT_OBJECTS,
  databaseConfig,
  failureReport,
  main,
  parseArgs,
  runRealMysqlReleaseContract,
  runResidueAudit,
  runRollbackContracts,
  serializeFailure,
};
