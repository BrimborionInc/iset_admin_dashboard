#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');
const mysql = require('mysql2/promise');

const {
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

function parseArgs(argv) {
  const args = {
    envFile: path.join(REPO_ROOT, '.env'),
    targetEnv: 'dev',
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--env-file') args.envFile = path.resolve(argv[++index] || '');
    else if (token === '--target-env') args.targetEnv = String(argv[++index] || '').toLowerCase();
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

async function runRollbackContracts(connection) {
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

    await connection.rollback();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  }

  const residue = {
    staffProfiles: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM staff_profiles WHERE cognito_sub = ?', [staffSubject]),
    importRuns: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM client_file_import_run WHERE request_hash = ?', [importHash]),
    identityClaims: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM client_file_import_identity_claim WHERE identity_key = ?', [identityKey]),
    events: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM iset_event_entry WHERE id = ?', [eventId]),
    deliveries: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM iset_event_delivery WHERE event_id = ?', [eventId]),
    financialOverviewUsers: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM user WHERE email = ?', [applicantEmail]),
    financialOverviewCases: await queryScalar(connection, 'SELECT COUNT(*) AS c FROM iset_case WHERE case_number = ?', [caseNumber]),
    financialOverviewDocuments: await queryScalar(
      connection,
      'SELECT COUNT(*) AS c FROM iset_document WHERE file_path IN (?, ?, ?, ?, ?)',
      [
        protectedDocumentPath,
        replaceableDocumentPath,
        caseLevelApplicationFormPath,
        currentApplicationFormPath,
        metadataOnlyCurrentOverviewPath,
      ]
    ),
  };
  if (Object.values(residue).some(value => value !== 0)) {
    throw new Error(`release_contract_cleanup_incomplete:${JSON.stringify(residue)}`);
  }
  return residue;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = dotenv.config({ path: args.envFile, override: false, quiet: true });
  if (loaded.error) throw loaded.error;
  const config = databaseConfig(process.env);
  const connection = await mysql.createConnection(config);
  try {
    const [identityRows] = await connection.query(
      'SELECT DATABASE() AS database_name, @@hostname AS database_host, @@port AS database_port'
    );
    await assertAdminRuntimeSchemaReady(connection);
    await assertPortalRuntimeSchemaReady(connection);
    const cleanup = await runRollbackContracts(connection);
    const result = {
      schemaVersion: 1,
      status: 'passed',
      targetEnvironment: 'dev',
      database: {
        name: identityRows?.[0]?.database_name || config.database,
        host: identityRows?.[0]?.database_host || null,
        port: Number(identityRows?.[0]?.database_port || config.port),
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
        admin: require('../src/lib/adminRuntimeSchemaContract').ADMIN_RUNTIME_SCHEMA_REQUIREMENTS.length,
        portal: PORTAL_RUNTIME_SCHEMA_REQUIREMENTS.length,
      },
      cleanup,
    };
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log('Real MySQL release contract: PASS');
      console.log(`Database: ${result.database.name} on ${result.database.host}:${result.database.port}`);
      console.log(`Readiness contracts: admin ${result.requirementCounts.admin}, portal ${result.requirementCounts.portal}`);
      console.log('Rollback cleanup: zero residue');
    }
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error(`Real MySQL release contract: FAIL (${error.message || error})`);
  process.exitCode = 1;
});
