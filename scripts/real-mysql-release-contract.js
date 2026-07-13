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
