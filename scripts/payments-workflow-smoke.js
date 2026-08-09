#!/usr/bin/env node
'use strict';

/**
 * DEV payments workflow smoke.
 *
 * Default mode creates a synthetic payment workflow inside a DB transaction,
 * checks the payment/evidence/follow-up invariants, and rolls it back.
 *
 * Optional --api / --browser modes use real Cognito bearer tokens supplied by
 * env vars. They deliberately do not add auth bypasses and do not submit real
 * Finance email unless --allow-email-submit is supplied.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { createLiveMysqlSchemaGuard } = require('./lib/live-mysql-schema-guard');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (_) {
  // Keep usable when DB_* is already exported by the caller.
}

const FIXTURE = 'payments-workflow-smoke';
const DEFAULT_ADMIN_BASE_URL = 'http://localhost:5001';
const DEFAULT_FRONTEND_BASE_URL = 'http://localhost:5001';
const DEFAULT_DB_HOST = process.env.WSL_DISTRO_NAME ? '172.26.176.1' : 'localhost';
const BASELINE_EVIDENCE_TYPES = [
  'ClientApplicationSigned',
  'FundingAgreement',
  'CaseManagerAssessment',
  'IndigenousIdentity',
  'BandFundingConfirmationOrDenial',
];
const EXPECTED_DEV_DATABASE_IDENTITY = Object.freeze({
  configured: Object.freeze({
    host: '172.26.176.1',
    port: 3306,
    user: 'root',
    database: 'iset_intake',
  }),
  live: Object.freeze({
    database: 'iset_intake',
    serverHostname: 'DESKTOP-PDFA51K',
    port: 3306,
    currentUser: 'root@172.26.%',
    version: '8.0.40',
  }),
});
const EXPECTED_TEST_DATABASE_IDENTITY = Object.freeze({
  configured: Object.freeze({
    host: 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com',
    port: 3306,
    user: 'app_admin',
    database: 'iset_intake',
  }),
  live: Object.freeze({
    database: 'iset_intake',
    serverHostname: 'ip-172-16-0-199',
    port: 3306,
    currentUser: 'app_admin@10.48.%',
    version: '8.0.42',
  }),
});
const AUTHORIZED_PAYMENT_DATABASE_IDENTITIES = [
  EXPECTED_DEV_DATABASE_IDENTITY,
  EXPECTED_TEST_DATABASE_IDENTITY,
];
const PAYMENT_SCHEMA_OBJECTS = [
  'budget_pot',
  'client',
  'esdc_intervention_code',
  'finance_transaction',
  'iset_application',
  'iset_application_submission',
  'iset_case',
  'iset_case_intervention',
  'iset_document',
  'payment_batch_line',
  'payment_followup_event',
  'payment_line_transaction',
  'payment_override',
  'payment_packet',
  'payment_packet_communication',
  'payment_packet_document',
  'payment_packet_line',
  'payment_status_event',
  'user',
].map(name => ({ name, type: 'table' }));
const PAYMENT_OUTPUT_ALIASES = [
  'applications',
  'budget_pots',
  'cases',
  'clients',
  'documents',
  'finance_transactions',
  'interventions',
  'packet_lines',
  'packets',
  'submissions',
  'users',
];
const PAYMENT_TABLE_ALIASES = [
  'fixture_application',
  'fixture_budget_pot',
  'fixture_case',
  'fixture_client',
  'fixture_document',
  'fixture_finance_transaction',
  'fixture_intervention',
  'fixture_packet',
  'fixture_packet_line',
  'fixture_submission',
  'fixture_user',
  'ft',
  'intervention_reference',
  'plt',
  'ppl',
];

function parseArgs(argv) {
  const args = {
    api: false,
    browser: false,
    keepFixture: false,
    schemaPreflightOnly: false,
    requireLive: false,
    json: false,
    help: false,
    allowEmailSubmit: false,
    adminBase: process.env.PAYMENTS_SMOKE_ADMIN_BASE_URL || process.env.ADMIN_API_BASE_URL || DEFAULT_ADMIN_BASE_URL,
    frontendBase: process.env.PAYMENTS_SMOKE_FRONTEND_BASE_URL || DEFAULT_FRONTEND_BASE_URL,
    rewriteApiOrigins: (process.env.PAYMENTS_SMOKE_REWRITE_API_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    screenshotDir: process.env.PAYMENTS_SMOKE_SCREENSHOT_DIR || null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--api') {
      args.api = true;
    } else if (token === '--browser') {
      args.browser = true;
      args.api = true;
    } else if (token === '--keep-fixture') {
      args.keepFixture = true;
    } else if (token === '--schema-preflight-only') {
      args.schemaPreflightOnly = true;
    } else if (token === '--require-live') {
      args.requireLive = true;
    } else if (token === '--json') {
      args.json = true;
    } else if (token === '--allow-email-submit') {
      args.allowEmailSubmit = true;
    } else if (token === '--admin-base') {
      args.adminBase = argv[++index];
    } else if (token === '--frontend-base') {
      args.frontendBase = argv[++index];
    } else if (token === '--rewrite-api-origin') {
      args.rewriteApiOrigins.push(argv[++index]);
    } else if (token === '--screenshot-dir') {
      args.screenshotDir = argv[++index];
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
    'Usage: node scripts/payments-workflow-smoke.js [options]',
    '',
    'Default mode is a rollback DB fixture smoke.',
    '',
    'Options:',
    '  --api                  Run authenticated API smoke against local/admin backend.',
    '  --browser              Run API smoke and then Puppeteer UI smoke.',
    '  --keep-fixture         Commit and keep the synthetic fixture after API/browser mode.',
    '  --schema-preflight-only Prove an authorized DEV/TEST identity and full required schema; run no ordinary SQL.',
    '  --require-live         Treat skipped API/browser checks as failures.',
    '  --admin-base URL       Admin API base URL. Default: http://localhost:5001.',
    '  --frontend-base URL    Frontend URL for browser smoke. Default: http://localhost:5001.',
    '  --rewrite-api-origin URL',
    '                         Rewrite browser /api calls from this origin to --admin-base.',
    '  --screenshot-dir DIR   Save browser screenshots after case/payments page loads.',
    '  --allow-email-submit   Actually call status=submitted instead of the safe DB post-send setup.',
    '  --json                 Emit JSON.',
    '',
    'Auth env:',
    '  PAYMENTS_SMOKE_ID_TOKEN or SMOKE_ID_TOKEN',
    '  PAYMENTS_SMOKE_ACCESS_TOKEN or SMOKE_ACCESS_TOKEN (optional)',
    '',
    'Examples:',
    '  DB_HOST=172.26.176.1 npm run payments:workflow:smoke',
    '  PAYMENTS_SMOKE_ID_TOKEN=... npm run payments:workflow:smoke:api',
    '  PAYMENTS_SMOKE_ID_TOKEN=... npm run payments:workflow:smoke:browser -- --frontend-base http://localhost:3001',
  ].join('\n');
}

function normalizeBaseUrl(value, fallback) {
  const raw = String(value || fallback || '').trim();
  if (!raw) return fallback;
  return raw.replace(/\/+$/, '');
}

function getDbConfig() {
  const config = {
    host: process.env.DB_HOST || DEFAULT_DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
    multipleStatements: false,
  };
  if (!config.host || !config.user || !config.database) {
    throw new Error('DB_HOST, DB_USER, and DB_NAME must be set');
  }
  return config;
}

function resolveAuthorizedPaymentDatabaseIdentity(dbConfig) {
  const configured = {
    host: String(dbConfig?.host || '').trim(),
    port: Number(dbConfig?.port),
    user: String(dbConfig?.user || '').trim(),
    database: String(dbConfig?.database || '').trim(),
  };
  const expected = AUTHORIZED_PAYMENT_DATABASE_IDENTITIES.find(candidate => (
    candidate.configured.host === configured.host
    && candidate.configured.port === configured.port
    && candidate.configured.user === configured.user
    && candidate.configured.database === configured.database
  ));
  if (!expected) throw new Error('payments_smoke_configured_database_target_not_authorized');
  return expected;
}

function createPaymentsSchemaGuard(connection, dbConfig, guardFactory = createLiveMysqlSchemaGuard) {
  const expectedDatabaseIdentity = resolveAuthorizedPaymentDatabaseIdentity(dbConfig);
  return guardFactory({
    connection,
    expectedIdentity: {
      ...expectedDatabaseIdentity.live,
      configuredHost: expectedDatabaseIdentity.configured.host,
      configuredUser: expectedDatabaseIdentity.configured.user,
    },
    configuredIdentity: {
      host: dbConfig.host,
      port: Number(dbConfig.port),
      user: dbConfig.user,
      database: dbConfig.database,
    },
    requiredObjects: PAYMENT_SCHEMA_OBJECTS,
    allowedOutputAliases: PAYMENT_OUTPUT_ALIASES,
    allowedTableAliases: PAYMENT_TABLE_ALIASES,
  });
}

function stampValue() {
  return `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
}

function shortStamp(stamp) {
  return String(stamp || '').replace(/[^a-zA-Z0-9]+/g, '').slice(-12) || crypto.randomBytes(4).toString('hex');
}

function hash(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function addResult(results, name, status, details = {}) {
  results.push({ name, status, details });
}

function pass(results, name, details = {}) {
  addResult(results, name, 'PASS', details);
}

function fail(results, name, details = {}) {
  addResult(results, name, 'FAIL', details);
}

function skip(results, name, details = {}) {
  addResult(results, name, 'SKIP', details);
}

function expect(results, name, condition, details = {}) {
  if (condition) pass(results, name, details);
  else fail(results, name, details);
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

function tokenEnv() {
  return {
    idToken: process.env.PAYMENTS_SMOKE_ID_TOKEN || process.env.SMOKE_ID_TOKEN || null,
    accessToken: process.env.PAYMENTS_SMOKE_ACCESS_TOKEN || process.env.SMOKE_ACCESS_TOKEN || null,
  };
}

function authHeaders(extra = {}) {
  const tokens = tokenEnv();
  const headers = { ...extra };
  if (tokens.idToken) headers.Authorization = `Bearer ${tokens.idToken}`;
  if (tokens.accessToken) headers['X-Access-Token'] = tokens.accessToken;
  return headers;
}

async function resolveCompatibleInterventionCode(connection) {
  const [rows] = await connection.query(
    `SELECT \`intervention_reference\`.\`code\`
       FROM \`esdc_intervention_code\` AS \`intervention_reference\`
      WHERE \`intervention_reference\`.\`is_active\` = ?
      ORDER BY \`intervention_reference\`.\`display_order\`, \`intervention_reference\`.\`code\`
      LIMIT 1`,
    [1]
  );
  const interventionCode = Number(rows?.[0]?.code);
  if (!Number.isInteger(interventionCode) || interventionCode <= 0) {
    throw new Error('payments_smoke_compatible_intervention_code_unavailable');
  }
  return interventionCode;
}

async function createBaseFixture(connection, { interventionCode, fixtureState = {} } = {}) {
  if (!Number.isInteger(Number(interventionCode)) || Number(interventionCode) <= 0) {
    throw new Error('payments_smoke_intervention_code_not_preflighted');
  }
  const stamp = stampValue();
  const suffix = shortStamp(stamp);
  const applicantEmail = `payments-smoke-${suffix}@example.invalid`;
  const marker = { fixture: FIXTURE, stamp };
  const applicantName = `Payments Smoke ${suffix}`;
  const caseNumber = `PAYSMOKE-${suffix}`.slice(0, 32);
  const potCode = `PAYSMOKE-${suffix}`.slice(0, 64);
  Object.assign(fixtureState, {
    stamp,
    suffix,
    marker,
    applicantName,
    applicantEmail,
    caseNumber,
    payeeName: applicantName,
    lineAmount: 125.25,
    mutationStarted: false,
  });

  const [userResult] = await connection.query(
    `INSERT INTO user (name, email, email_verified, preferred_language)
     VALUES (?, ?, 1, 'en')`,
    [applicantName, applicantEmail]
  );
  const userId = Number(userResult.insertId);
  fixtureState.mutationStarted = true;
  fixtureState.userId = userId;

  const [clientResult] = await connection.query(
    `INSERT INTO client
       (first_name, last_name, applicant_account_email, applicant_account_status, applicant_activated_at, address_json)
     VALUES (?, ?, ?, 'activated', NOW(), CAST(? AS JSON))`,
    [
      'Payments',
      `Smoke ${suffix}`,
      applicantEmail,
      JSON.stringify({
        address: {
          line1: '1 Smoke Test Way',
          city: 'Ottawa',
          province: 'ON',
          postalCode: 'K1A0A0',
        },
      }),
    ]
  );
  const clientId = Number(clientResult.insertId);
  fixtureState.clientId = clientId;

  const caseContext = {
    ...marker,
    firstName: 'Payments',
    lastName: `Smoke ${suffix}`,
    emailPrimary: applicantEmail,
    currentAddress: {
      line1: '1 Smoke Test Way',
      city: 'Ottawa',
      province: 'ON',
      postalCode: 'K1A0A0',
    },
  };
  const [caseResult] = await connection.query(
    `INSERT INTO iset_case
       (case_number, client_id, status, lifecycle_status, stage, opened_at, case_context_json)
     VALUES (?, ?, 'active', 'active', 'payment_workflow_smoke', NOW(), CAST(? AS JSON))`,
    [caseNumber, clientId, JSON.stringify(caseContext)]
  );
  const caseId = Number(caseResult.insertId);
  fixtureState.caseId = caseId;

  const payload = {
    ...marker,
    submission_snapshot: { reference_number: `PAY-SMOKE-${suffix}`.slice(0, 32) },
    personal: { full_name: applicantName },
    answers: {
      firstName: 'Payments',
      lastName: `Smoke ${suffix}`,
      email: applicantEmail,
      province: 'ON',
    },
  };
  const [submissionResult] = await connection.query(
    `INSERT INTO iset_application_submission
       (user_id, workflow_id, reference_number, status, intake_payload, schema_snapshot, history, doc_refs, locale)
     VALUES (?, 'iset-v1', ?, 'submitted', CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), CAST(? AS JSON), 'en')`,
    [
      userId,
      `PAY-SMOKE-${suffix}`.slice(0, 32),
      JSON.stringify(payload),
      JSON.stringify({ fixture: FIXTURE }),
      JSON.stringify([]),
      JSON.stringify([]),
    ]
  );
  const submissionId = Number(submissionResult.insertId);
  fixtureState.submissionId = submissionId;

  const [applicationResult] = await connection.query(
    `INSERT INTO iset_application
       (submission_id, client_id, case_id, payload_json, status, lifecycle_status, decision_outcome, awaiting_reason)
     VALUES (?, ?, ?, CAST(? AS JSON), 'approved', 'decision_recorded', 'approved', 'none')`,
    [submissionId, clientId, caseId, JSON.stringify(payload)]
  );
  const applicationId = Number(applicationResult.insertId);
  fixtureState.applicationId = applicationId;

  const [potResult] = await connection.query(
    `INSERT INTO budget_pot
       (name, code, fiscal_year, fiscal_year_tag, pot_type, funding_source, is_active, approved_amount, adjusted_amount, metadata)
     VALUES (?, ?, '2026', '2026', 'budget', 'CRF', 1, 5000.00, 5000.00, CAST(? AS JSON))`,
    [`Payments Smoke Pot ${suffix}`, potCode, JSON.stringify(marker)]
  );
  const budgetPotId = Number(potResult.insertId);
  fixtureState.budgetPotId = budgetPotId;

  const interventionMetadata = {
    ...marker,
    title: 'Payments smoke approved intervention',
    fundingBreakdown: { other: 5000 },
  };
  const [interventionResult] = await connection.query(
    `INSERT INTO iset_case_intervention
       (case_id, intervention_code, status, delivery_status, start_date, end_date,
        intervention_cost, budget_amount, approved_amount, notes, metadata_json, eligibility_result, funding_stream_decision)
     VALUES (?, ?, 'approved', 'planned', CURRENT_DATE(), DATE_ADD(CURRENT_DATE(), INTERVAL 30 DAY),
        5000.00, 5000.00, 5000.00, 'Synthetic payments workflow smoke intervention.', CAST(? AS JSON), 'eligible', 'CRF')`,
    [caseId, Number(interventionCode), JSON.stringify(interventionMetadata)]
  );
  const interventionId = Number(interventionResult.insertId);
  fixtureState.interventionId = interventionId;

  const documents = [];
  for (const evidenceType of BASELINE_EVIDENCE_TYPES) {
    const filePath = `payments-smoke/${stamp}/${evidenceType}.pdf`;
    const [docResult] = await connection.query(
      `INSERT INTO iset_document
         (user_id, applicant_user_id, client_id, application_id, case_id, source, file_name, file_path,
          mime_type, label, metadata, size_bytes, checksum_sha256, status, document_category, visibility)
       VALUES (?, ?, ?, ?, ?, 'manual_upload', ?, ?, 'application/pdf', ?, CAST(? AS JSON), 12, ?, 'active', ?, 'internal')`,
      [
        userId,
        userId,
        clientId,
        applicationId,
        caseId,
        `${evidenceType}-${suffix}.pdf`,
        filePath,
        `${evidenceType} smoke evidence`,
        JSON.stringify({ ...marker, evidenceType }),
        hash(filePath),
        evidenceType,
      ]
    );
    documents.push({
      id: Number(docResult.insertId),
      evidenceType,
      filePath,
    });
    fixtureState.documents = [...documents];
  }

  return Object.assign(fixtureState, {
    stamp,
    suffix,
    marker,
    userId,
    clientId,
    caseId,
    caseNumber,
    applicationId,
    submissionId,
    budgetPotId,
    interventionId,
    documents,
    applicantName,
    applicantEmail,
    payeeName: applicantName,
    lineAmount: 125.25,
  });
}

async function createDirectWorkflowFixture(connection, fixture) {
  const metadata = {
    ...fixture.marker,
    requesterName: 'Payments Workflow Smoke',
    requesterRole: 'System Administrator',
  };
  const [packetResult] = await connection.query(
    `INSERT INTO payment_packet
       (case_id, client_id, intervention_id, reporting_unit, status, follow_up_status, requester_user_id,
        submitted_at, sent_at, due_by, follow_up_updated_at, notes_internal, risk_flags, metadata, created_at, updated_at)
     VALUES (?, ?, ?, 'ON', 'submitted', 'sent_to_finance', ?, NOW(), NOW(), DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
        NOW(), 'Synthetic submitted packet for payments workflow smoke.', CAST(? AS JSON), CAST(? AS JSON), NOW(), NOW())`,
    [
      fixture.caseId,
      fixture.clientId,
      fixture.interventionId,
      fixture.userId,
      JSON.stringify([]),
      JSON.stringify(metadata),
    ]
  );
  const packetId = Number(packetResult.insertId);

  const lineMetadata = { ...fixture.marker, fundingCategory: 'other' };
  const [lineResult] = await connection.query(
    `INSERT INTO payment_packet_line
       (payment_packet_id, intervention_id, payment_type, payee_type, payee_name, payee_reference,
        amount, currency, invoice_reference_number, requested_payment_date, budget_pot_id, funding_stream,
        status, follow_up_status, follow_up_updated_at, metadata, created_at, updated_at)
     VALUES (?, ?, 'OtherEligibleCost', 'ParticipantClient', ?, ?, ?, 'CAD', ?, DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
        ?, 'CRF', 'submitted', 'sent_to_finance', NOW(), CAST(? AS JSON), NOW(), NOW())`,
    [
      packetId,
      fixture.interventionId,
      fixture.payeeName,
      `PAYSMOKE-${fixture.suffix}`,
      fixture.lineAmount,
      `INV-PAYSMOKE-${fixture.suffix}`,
      fixture.budgetPotId,
      JSON.stringify(lineMetadata),
    ]
  );
  const lineId = Number(lineResult.insertId);

  for (const doc of fixture.documents) {
    const lineScoped = doc.evidenceType === 'FundingAgreement';
    await connection.query(
      `INSERT INTO payment_packet_document
         (payment_packet_id, payment_packet_line_id, document_id, evidence_type, required, received_at, verified_by_user_id, verified_at, notes, created_at)
       VALUES (?, ?, ?, ?, 1, NOW(), ?, NOW(), 'Synthetic evidence link for payments workflow smoke.', NOW())`,
      [packetId, lineScoped ? lineId : null, doc.id, doc.evidenceType, fixture.userId]
    );
  }

  await connection.query(
    `INSERT INTO payment_status_event
       (payment_packet_id, payment_packet_line_id, from_status, to_status, actor_user_id, notes, metadata, created_at)
     VALUES
       (?, NULL, NULL, 'draft', ?, 'Synthetic draft created.', CAST(? AS JSON), NOW()),
       (?, NULL, 'draft', 'ready_to_send', ?, 'Synthetic validation passed.', CAST(? AS JSON), NOW()),
       (?, NULL, 'ready_to_send', 'submitted', ?, 'Synthetic finance handoff recorded.', CAST(? AS JSON), NOW()),
       (?, ?, 'ready_to_send', 'submitted', ?, NULL, CAST(? AS JSON), NOW())`,
    [
      packetId, fixture.userId, JSON.stringify(fixture.marker),
      packetId, fixture.userId, JSON.stringify(fixture.marker),
      packetId, fixture.userId, JSON.stringify(fixture.marker),
      packetId, lineId, fixture.userId, JSON.stringify(fixture.marker),
    ]
  );

  await connection.query(
    `INSERT INTO payment_followup_event
       (payment_packet_id, payment_packet_line_id, from_status, to_status, actor_user_id, note, due_at, document_id, metadata, created_at)
     VALUES
       (?, NULL, 'not_required', 'sent_to_finance', ?, 'Finance email handoff recorded.', DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY), NULL, CAST(? AS JSON), NOW()),
       (?, ?, 'not_required', 'sent_to_finance', ?, 'Finance email handoff recorded.', DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY), NULL, CAST(? AS JSON), NOW())`,
    [
      packetId, fixture.userId, JSON.stringify({ ...fixture.marker, source: 'direct_fixture' }),
      packetId, lineId, fixture.userId, JSON.stringify({ ...fixture.marker, source: 'direct_fixture' }),
    ]
  );

  await connection.query(
    `INSERT INTO payment_packet_communication
       (payment_packet_id, direction, channel, sender_user_id, sender_label, recipients_json, subject, body, template_key, attachments_json, status, sent_at, created_at, updated_at)
     VALUES (?, 'outbound', 'email', ?, 'Payments Workflow Smoke', CAST(? AS JSON), ?, ?, 'manual', CAST(? AS JSON), 'logged', NOW(), NOW(), NOW())`,
    [
      packetId,
      fixture.userId,
      JSON.stringify({ to: ['finance-smoke@example.invalid'], cc: [], bcc: [] }),
      `PAYSMOKE ${fixture.suffix} communication log`,
      'Synthetic communication log. No email was sent.',
      JSON.stringify([]),
    ]
  );

  const [txResult] = await connection.query(
    `INSERT INTO finance_transaction
       (case_id, case_intervention_id, budget_pot_id, posting_context, amount, currency, status,
        transaction_date, description, evidence_ref, metadata, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, 'payment_packet', ?, 'CAD', 'submitted', CURRENT_DATE(), ?, ?, CAST(? AS JSON), ?, NOW(), NOW())`,
    [
      fixture.caseId,
      fixture.interventionId,
      fixture.budgetPotId,
      fixture.lineAmount,
      `Synthetic payment packet ${packetId}`,
      `payment_packet:${packetId}`,
      JSON.stringify({ ...fixture.marker, packetId: String(packetId), lineId: String(lineId) }),
      fixture.userId,
    ]
  );
  const financeTransactionId = Number(txResult.insertId);
  await connection.query(
    'INSERT INTO payment_line_transaction (payment_packet_line_id, finance_transaction_id, created_at) VALUES (?, ?, NOW())',
    [lineId, financeTransactionId]
  );

  await connection.query(
    `UPDATE payment_packet_line
        SET follow_up_status = 'follow_up_logged',
            follow_up_due_at = DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
            follow_up_updated_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [lineId]
  );
  await connection.query(
    `UPDATE payment_packet
        SET follow_up_status = 'follow_up_logged',
            follow_up_due_at = DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY),
            follow_up_updated_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [packetId]
  );
  await connection.query(
    `INSERT INTO payment_followup_event
       (payment_packet_id, payment_packet_line_id, from_status, to_status, actor_user_id, note, due_at, document_id, metadata, created_at)
     VALUES (?, ?, 'sent_to_finance', 'follow_up_logged', ?, 'Synthetic follow-up logged after no finance feedback.', DATE_ADD(CURRENT_DATE(), INTERVAL 7 DAY), NULL, CAST(? AS JSON), NOW())`,
    [packetId, lineId, fixture.userId, JSON.stringify({ ...fixture.marker, source: 'direct_fixture' })]
  );

  fixture.packetId = packetId;
  fixture.lineId = lineId;
  fixture.financeTransactionId = financeTransactionId;
  return fixture;
}

async function countFixtureRows(connection, stamp) {
  const likePath = `payments-smoke/${stamp}/%`;
  const jsonNeedle = `%"stamp":"${stamp}"%`;
  const [[row]] = await connection.query(
    `SELECT
       (SELECT COUNT(*) FROM \`user\` AS \`fixture_user\` WHERE \`fixture_user\`.\`email\` = ?) AS \`users\`,
       (SELECT COUNT(*) FROM \`client\` AS \`fixture_client\` WHERE \`fixture_client\`.\`applicant_account_email\` = ?) AS \`clients\`,
       (SELECT COUNT(*) FROM \`iset_case\` AS \`fixture_case\` WHERE \`fixture_case\`.\`case_number\` LIKE ?) AS \`cases\`,
       (SELECT COUNT(*) FROM \`iset_application_submission\` AS \`fixture_submission\` WHERE \`fixture_submission\`.\`reference_number\` LIKE ?) AS \`submissions\`,
       (SELECT COUNT(*) FROM \`iset_application\` AS \`fixture_application\` WHERE CAST(\`fixture_application\`.\`payload_json\` AS CHAR) LIKE ?) AS \`applications\`,
       (SELECT COUNT(*) FROM \`iset_case_intervention\` AS \`fixture_intervention\` WHERE CAST(\`fixture_intervention\`.\`metadata_json\` AS CHAR) LIKE ?) AS \`interventions\`,
       (SELECT COUNT(*) FROM \`budget_pot\` AS \`fixture_budget_pot\` WHERE CAST(\`fixture_budget_pot\`.\`metadata\` AS CHAR) LIKE ?) AS \`budget_pots\`,
       (SELECT COUNT(*) FROM \`iset_document\` AS \`fixture_document\` WHERE \`fixture_document\`.\`file_path\` LIKE ?) AS \`documents\`,
       (SELECT COUNT(*) FROM \`payment_packet\` AS \`fixture_packet\` WHERE CAST(\`fixture_packet\`.\`metadata\` AS CHAR) LIKE ?) AS \`packets\`,
       (SELECT COUNT(*) FROM \`payment_packet_line\` AS \`fixture_packet_line\` WHERE CAST(\`fixture_packet_line\`.\`metadata\` AS CHAR) LIKE ?) AS \`packet_lines\`,
       (SELECT COUNT(*) FROM \`finance_transaction\` AS \`fixture_finance_transaction\` WHERE CAST(\`fixture_finance_transaction\`.\`metadata\` AS CHAR) LIKE ?) AS \`finance_transactions\``,
    [
      `payments-smoke-${shortStamp(stamp)}@example.invalid`,
      `payments-smoke-${shortStamp(stamp)}@example.invalid`,
      `PAYSMOKE-${shortStamp(stamp)}%`,
      `PAY-SMOKE-${shortStamp(stamp)}%`,
      jsonNeedle,
      jsonNeedle,
      jsonNeedle,
      likePath,
      jsonNeedle,
      jsonNeedle,
      jsonNeedle,
    ]
  );
  return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, Number(value || 0)]));
}

async function loadPaymentSnapshot(connection, packetId) {
  const [[packet]] = await connection.query(
    'SELECT id, status, follow_up_status, client_id, case_id, intervention_id, metadata FROM payment_packet WHERE id = ? LIMIT 1',
    [packetId]
  );
  const [lines] = await connection.query(
    'SELECT id, status, follow_up_status, payment_type, payee_type, amount, budget_pot_id, metadata FROM payment_packet_line WHERE payment_packet_id = ? ORDER BY id',
    [packetId]
  );
  const [documents] = await connection.query(
    'SELECT id, payment_packet_line_id, document_id, evidence_type, required, received_at, verified_at FROM payment_packet_document WHERE payment_packet_id = ? ORDER BY id',
    [packetId]
  );
  const [followUps] = await connection.query(
    'SELECT id, payment_packet_line_id, from_status, to_status, note, due_at FROM payment_followup_event WHERE payment_packet_id = ? ORDER BY id',
    [packetId]
  );
  const [communications] = await connection.query(
    'SELECT id, subject, status, recipients_json FROM payment_packet_communication WHERE payment_packet_id = ? ORDER BY id',
    [packetId]
  );
  const [transactions] = await connection.query(
    `SELECT \`ft\`.\`id\`, \`ft\`.\`status\`, \`ft\`.\`amount\`, \`plt\`.\`payment_packet_line_id\`
       FROM \`finance_transaction\` AS \`ft\`
       JOIN \`payment_line_transaction\` AS \`plt\`
         ON \`plt\`.\`finance_transaction_id\` = \`ft\`.\`id\`
       JOIN \`payment_packet_line\` AS \`ppl\`
         ON \`ppl\`.\`id\` = \`plt\`.\`payment_packet_line_id\`
      WHERE \`ppl\`.\`payment_packet_id\` = ?
      ORDER BY \`ft\`.\`id\``,
    [packetId]
  );
  return { packet, lines, documents, followUps, communications, transactions };
}

async function runDbRollbackSmoke(connection, results, { interventionCode } = {}) {
  let transactionStarted = false;
  const fixture = {};
  await connection.beginTransaction();
  transactionStarted = true;
  try {
    await createBaseFixture(connection, { interventionCode, fixtureState: fixture });
    await createDirectWorkflowFixture(connection, fixture);
    const snapshot = await loadPaymentSnapshot(connection, fixture.packetId);
    const line = snapshot.lines[0] || null;
    const lineEvidence = snapshot.documents.filter(row => Number(row.payment_packet_line_id) === Number(fixture.lineId));
    const baselineTypes = new Set(snapshot.documents.map(row => row.evidence_type));
    const followUpStatuses = new Set(snapshot.followUps.map(row => row.to_status));
    const financeStatuses = new Set(snapshot.transactions.map(row => row.status));

    expect(results, 'rollback fixture creates submitted packet', snapshot.packet?.status === 'submitted', {
      packetId: fixture.packetId,
      status: snapshot.packet?.status || null,
    });
    expect(results, 'rollback fixture creates submitted line without legacy paid shortcut', line?.status === 'submitted', {
      lineId: fixture.lineId,
      status: line?.status || null,
    });
    expect(results, 'line-level evidence is attached to the payment line', lineEvidence.length >= 1, {
      lineId: fixture.lineId,
      evidenceTypes: lineEvidence.map(row => row.evidence_type),
    });
    expect(
      results,
      'baseline required evidence set is complete',
      BASELINE_EVIDENCE_TYPES.every(type => baselineTypes.has(type)),
      { evidenceTypes: Array.from(baselineTypes) }
    );
    expect(results, 'submitted packet records committed finance transaction only', financeStatuses.has('submitted') && !financeStatuses.has('posted'), {
      financeStatuses: Array.from(financeStatuses),
    });
    expect(results, 'follow-up event history includes sent and logged states', followUpStatuses.has('sent_to_finance') && followUpStatuses.has('follow_up_logged'), {
      followUpStatuses: Array.from(followUpStatuses),
    });
    expect(results, 'manual communication log is packet scoped', snapshot.communications.length === 1, {
      communicationSubjects: snapshot.communications.map(row => row.subject),
    });

    await connection.rollback();
    const counts = await countFixtureRows(connection, fixture.stamp);
    expect(
      results,
      'rollback fixture leaves no persistent rows',
      Object.values(counts).every(value => value === 0),
      counts
    );
    return { fixtureRolledBack: true, stamp: fixture.stamp };
  } catch (error) {
    if (transactionStarted && fixture.mutationStarted) {
      const recoveryErrors = [];
      try {
        await connection.rollback();
      } catch (rollbackError) {
        recoveryErrors.push(rollbackError);
      }
      if (recoveryErrors.length === 0) {
        try {
          const counts = await countFixtureRows(connection, fixture.stamp);
          if (!Object.values(counts).every(value => value === 0)) {
            const residueError = new Error('payments_smoke_rollback_residue_detected');
            residueError.code = 'payments_smoke_rollback_residue_detected';
            residueError.counts = counts;
            recoveryErrors.push(residueError);
          }
        } catch (residueError) {
          recoveryErrors.push(residueError);
        }
      }
      if (recoveryErrors.length) {
        const aggregate = new AggregateError(
          [error, ...recoveryErrors],
          'payments_smoke_rollback_recovery_failed',
          { cause: error }
        );
        aggregate.code = 'payments_smoke_rollback_recovery_failed';
        throw aggregate;
      }
    }
    throw error;
  }
}

async function cleanupFixture(connection, fixture) {
  if (!fixture?.stamp || !fixture.mutationStarted) return null;
  let transactionStarted = false;
  await connection.beginTransaction();
  transactionStarted = true;
  try {
    const packetIds = [];
    if (fixture.packetId) packetIds.push(Number(fixture.packetId));
    const [extraPacketRows] = await connection.query(
      'SELECT id FROM payment_packet WHERE CAST(metadata AS CHAR) LIKE ?',
      [`%"stamp":"${fixture.stamp}"%`]
    );
    (extraPacketRows || []).forEach(row => {
      const id = Number(row.id);
      if (Number.isFinite(id) && !packetIds.includes(id)) packetIds.push(id);
    });

    if (packetIds.length) {
      const placeholders = packetIds.map(() => '?').join(',');
      const [lineRows] = await connection.query(
        `SELECT id FROM payment_packet_line WHERE payment_packet_id IN (${placeholders})`,
        packetIds
      );
      const lineIds = (lineRows || []).map(row => Number(row.id)).filter(Number.isFinite);
      if (lineIds.length) {
        const linePlaceholders = lineIds.map(() => '?').join(',');
        await connection.query(
          `DELETE \`plt\`
             FROM \`payment_line_transaction\` AS \`plt\`
            WHERE \`plt\`.\`payment_packet_line_id\` IN (${linePlaceholders})`,
          lineIds
        );
        await connection.query(
          `DELETE FROM payment_batch_line WHERE payment_packet_line_id IN (${linePlaceholders})`,
          lineIds
        );
      }
      await connection.query(
        `DELETE \`ft\`
           FROM \`finance_transaction\` AS \`ft\`
          WHERE CAST(\`ft\`.\`metadata\` AS CHAR) LIKE ?
             OR \`ft\`.\`evidence_ref\` IN (${packetIds.map(() => '?').join(',')})`,
        [`%"stamp":"${fixture.stamp}"%`, ...packetIds.map(id => `payment_packet:${id}`)]
      );
      await connection.query(`DELETE FROM payment_packet_document WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_packet_communication WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_followup_event WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_status_event WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_override WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_packet_line WHERE payment_packet_id IN (${placeholders})`, packetIds);
      await connection.query(`DELETE FROM payment_packet WHERE id IN (${placeholders})`, packetIds);
    }

    await connection.query('DELETE FROM iset_document WHERE file_path LIKE ?', [`payments-smoke/${fixture.stamp}/%`]);
    if (fixture.interventionId) await connection.query('DELETE FROM iset_case_intervention WHERE id = ?', [fixture.interventionId]);
    if (fixture.applicationId) await connection.query('DELETE FROM iset_application WHERE id = ?', [fixture.applicationId]);
    if (fixture.submissionId) await connection.query('DELETE FROM iset_application_submission WHERE id = ?', [fixture.submissionId]);
    if (fixture.caseId) await connection.query('DELETE FROM iset_case WHERE id = ?', [fixture.caseId]);
    if (fixture.clientId) await connection.query('DELETE FROM client WHERE id = ?', [fixture.clientId]);
    if (fixture.budgetPotId) await connection.query('DELETE FROM budget_pot WHERE id = ?', [fixture.budgetPotId]);
    if (fixture.userId) await connection.query('DELETE FROM user WHERE id = ?', [fixture.userId]);
    await connection.commit();
  } catch (error) {
    if (transactionStarted && fixture.mutationStarted) {
      try {
        await connection.rollback();
      } catch (_) {}
    }
    throw error;
  }

  return countFixtureRows(connection, fixture.stamp);
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return text;
  }
}

async function apiRequest({ baseUrl, path: requestPath, method = 'GET', body = null, token = true }) {
  const url = `${normalizeBaseUrl(baseUrl, DEFAULT_ADMIN_BASE_URL)}${requestPath}`;
  const headers = token ? authHeaders() : {};
  if (body !== null) headers['Content-Type'] = 'application/json';
  const response = await fetch(url, {
    method,
    headers,
    body: body === null ? undefined : JSON.stringify(body),
  });
  return {
    status: response.status,
    ok: response.ok,
    body: await readResponseBody(response),
    url,
  };
}

async function checkBackendReachable(baseUrl) {
  try {
    const response = await apiRequest({ baseUrl, path: '/healthz', token: false });
    return response.status === 200;
  } catch (_) {
    return false;
  }
}

function firstLineId(packet) {
  const line = Array.isArray(packet?.lines) ? packet.lines[0] : null;
  const raw = line?.id || line?.lineId || line?.payment_packet_line_id || null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

async function forceSubmittedForFollowUp(connection, fixture, actorUserId = null) {
  const packetId = Number(fixture.packetId);
  const lineId = Number(fixture.lineId);
  if (!Number.isFinite(packetId) || !Number.isFinite(lineId)) {
    throw new Error('Cannot force submitted state without packetId and lineId');
  }
  await connection.query(
    `UPDATE payment_packet
        SET status = 'submitted',
            submitted_at = COALESCE(submitted_at, NOW()),
            sent_at = COALESCE(sent_at, NOW()),
            follow_up_status = 'sent_to_finance',
            follow_up_updated_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [packetId]
  );
  await connection.query(
    `UPDATE payment_packet_line
        SET status = 'submitted',
            follow_up_status = 'sent_to_finance',
            follow_up_updated_at = NOW(),
            updated_at = NOW()
      WHERE id = ?`,
    [lineId]
  );
  await connection.query(
    `INSERT INTO payment_status_event
       (payment_packet_id, payment_packet_line_id, from_status, to_status, actor_user_id, notes, metadata, created_at)
     VALUES
       (?, NULL, 'ready_to_send', 'submitted', ?, 'Synthetic post-send state for smoke follow-up checks; no email sent.', CAST(? AS JSON), NOW()),
       (?, ?, 'ready_to_send', 'submitted', ?, NULL, CAST(? AS JSON), NOW())`,
    [
      packetId,
      actorUserId || fixture.userId || null,
      JSON.stringify({ ...fixture.marker, source: 'api_smoke_safe_post_send' }),
      packetId,
      lineId,
      actorUserId || fixture.userId || null,
      JSON.stringify({ ...fixture.marker, source: 'api_smoke_safe_post_send' }),
    ]
  );
  await connection.query(
    `INSERT INTO payment_followup_event
       (payment_packet_id, payment_packet_line_id, from_status, to_status, actor_user_id, note, metadata, created_at)
     VALUES
       (?, NULL, 'not_required', 'sent_to_finance', ?, 'Synthetic post-send state for smoke follow-up checks; no email sent.', CAST(? AS JSON), NOW()),
       (?, ?, 'not_required', 'sent_to_finance', ?, 'Synthetic post-send state for smoke follow-up checks; no email sent.', CAST(? AS JSON), NOW())`,
    [
      packetId,
      actorUserId || fixture.userId || null,
      JSON.stringify({ ...fixture.marker, source: 'api_smoke_safe_post_send' }),
      packetId,
      lineId,
      actorUserId || fixture.userId || null,
      JSON.stringify({ ...fixture.marker, source: 'api_smoke_safe_post_send' }),
    ]
  );
  const [txResult] = await connection.query(
    `INSERT INTO finance_transaction
       (case_id, case_intervention_id, budget_pot_id, posting_context, amount, currency, status,
        transaction_date, description, evidence_ref, metadata, created_by_user_id, created_at, updated_at)
     VALUES (?, ?, ?, 'payment_packet', ?, 'CAD', 'submitted', CURRENT_DATE(), ?, ?, CAST(? AS JSON), ?, NOW(), NOW())`,
    [
      fixture.caseId,
      fixture.interventionId,
      fixture.budgetPotId,
      fixture.lineAmount,
      `Synthetic safe post-send payment packet ${packetId}`,
      `payment_packet:${packetId}`,
      JSON.stringify({ ...fixture.marker, packetId: String(packetId), lineId: String(lineId), source: 'api_smoke_safe_post_send' }),
      actorUserId || fixture.userId || null,
    ]
  );
  await connection.query(
    'INSERT INTO payment_line_transaction (payment_packet_line_id, finance_transaction_id, created_at) VALUES (?, ?, NOW())',
    [lineId, txResult.insertId]
  );
}

async function resolveActorUserIdFromToken(connection) {
  const tokens = tokenEnv();
  if (!tokens.idToken) return null;
  const parts = tokens.idToken.split('.');
  if (parts.length < 2) return null;
  let claims = null;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
  const sub = claims?.sub ? String(claims.sub) : null;
  if (!sub) return null;
  const [[row]] = await connection.query('SELECT id FROM user WHERE cognito_sub = ? LIMIT 1', [sub]);
  return row?.id ? Number(row.id) : null;
}

async function runApiSmoke(connection, args, results, { interventionCode, fixtureState = {} } = {}) {
  const tokens = tokenEnv();
  const baseUrl = normalizeBaseUrl(args.adminBase, DEFAULT_ADMIN_BASE_URL);
  if (!tokens.idToken) {
    skip(results, 'authenticated payments API smoke', { reason: 'PAYMENTS_SMOKE_ID_TOKEN or SMOKE_ID_TOKEN not set' });
    return null;
  }
  if (!(await checkBackendReachable(baseUrl))) {
    skip(results, 'authenticated payments API smoke', { reason: 'admin backend not reachable', baseUrl });
    return null;
  }

  const fixture = await createBaseFixture(connection, { interventionCode, fixtureState });
  const createdPacket = await apiRequest({
    baseUrl,
    path: '/api/finance/payment-packets',
    method: 'POST',
    body: {
      caseId: fixture.caseId,
      clientId: fixture.clientId,
      applicationId: fixture.applicationId,
      interventionId: fixture.interventionId,
      reportingUnit: 'ON',
      dueBy: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      notes: 'Synthetic API payment smoke packet.',
      metadata: fixture.marker,
      lines: [
        {
          interventionId: fixture.interventionId,
          paymentType: 'OtherEligibleCost',
          payeeType: 'ParticipantClient',
          payeeName: fixture.payeeName,
          payeeReference: `PAYSMOKE-${fixture.suffix}`,
          amount: fixture.lineAmount,
          currency: 'CAD',
          invoiceReferenceNumber: `INV-PAYSMOKE-${fixture.suffix}`,
          requestedPaymentDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          budgetPotId: fixture.budgetPotId,
          fundingStream: 'CRF',
          metadata: { ...fixture.marker, fundingCategory: 'other' },
        },
      ],
    },
  });
  expect(results, 'API creates draft payment packet', createdPacket.status === 201 && createdPacket.body?.status === 'draft', {
    status: createdPacket.status,
    error: createdPacket.body?.error || null,
  });
  if (createdPacket.status !== 201) {
    fixture.apiFailedBeforePacket = true;
    return fixture;
  }

  fixture.packetId = Number(createdPacket.body.id);
  fixture.lineId = firstLineId(createdPacket.body);
  expect(results, 'API packet create returns first line', Number.isFinite(fixture.lineId), {
    packetId: fixture.packetId,
    lineId: fixture.lineId,
  });

  const rejectedSubmittedCreate = await apiRequest({
    baseUrl,
    path: '/api/finance/payment-packets',
    method: 'POST',
    body: {
      status: 'submitted',
      caseId: fixture.caseId,
      clientId: fixture.clientId,
      interventionId: fixture.interventionId,
      metadata: { ...fixture.marker, rejectedProbe: true },
    },
  });
  expect(results, 'API rejects non-draft packet creation', rejectedSubmittedCreate.status === 400 && rejectedSubmittedCreate.body?.error === 'payment_packet_create_requires_draft', {
    status: rejectedSubmittedCreate.status,
    error: rejectedSubmittedCreate.body?.error || null,
  });

  for (const doc of fixture.documents) {
    const response = await apiRequest({
      baseUrl,
      path: `/api/finance/payment-packets/${fixture.packetId}/documents`,
      method: 'POST',
      body: {
        documentId: doc.id,
        lineId: doc.evidenceType === 'FundingAgreement' ? fixture.lineId : null,
        evidenceType: doc.evidenceType,
        required: true,
        received: true,
        verified: true,
        notes: 'Synthetic API evidence link.',
      },
    });
    expect(results, `API attaches ${doc.evidenceType} evidence`, response.status === 201, {
      status: response.status,
      lineId: response.body?.lineId || null,
      error: response.body?.error || null,
    });
  }

  const validated = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-packets/${fixture.packetId}/validate`,
    method: 'POST',
    body: {},
  });
  expect(results, 'API validation marks packet ready to send', validated.status === 200 && validated.body?.status === 'ready_to_send', {
    status: validated.status,
    packetStatus: validated.body?.status || null,
    validation: validated.body?.validation || null,
    error: validated.body?.error || null,
  });

  const legacySend = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-packets/${fixture.packetId}/send-email`,
    method: 'POST',
    body: {},
  });
  expect(results, 'legacy direct send-email endpoint stays retired', legacySend.status === 410 && legacySend.body?.error === 'payment_email_endpoint_retired', {
    status: legacySend.status,
    error: legacySend.body?.error || null,
  });

  const prematureFollowUp = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-lines/${fixture.lineId}/follow-up`,
    method: 'POST',
    body: { status: 'follow_up_logged', note: 'Premature follow-up should be rejected.' },
  });
  expect(results, 'API rejects follow-up before finance handoff is recorded', prematureFollowUp.status === 409 && prematureFollowUp.body?.error === 'payment_packet_not_sent', {
    status: prematureFollowUp.status,
    error: prematureFollowUp.body?.error || null,
  });

  if (args.allowEmailSubmit) {
    const submitted = await apiRequest({
      baseUrl,
      path: `/api/finance/payment-packets/${fixture.packetId}/status`,
      method: 'POST',
      body: { status: 'submitted', notes: 'Payments smoke explicit email submit.' },
    });
    expect(results, 'API submits packet through canonical status endpoint', submitted.status === 200 && submitted.body?.status === 'submitted', {
      status: submitted.status,
      packetStatus: submitted.body?.status || null,
      error: submitted.body?.error || null,
    });
  } else {
    await forceSubmittedForFollowUp(connection, fixture, await resolveActorUserIdFromToken(connection));
    pass(results, 'safe post-send state prepared without sending Finance email', {
      packetId: fixture.packetId,
      lineId: fixture.lineId,
    });
  }

  const commSubject = `PAYSMOKE ${fixture.suffix} manual communication`;
  const communication = await apiRequest({
    baseUrl,
    path: '/api/finance/payment-communications',
    method: 'POST',
    body: {
      packetId: fixture.packetId,
      direction: 'outbound',
      channel: 'email',
      recipients: { to: ['finance-smoke@example.invalid'] },
      subject: commSubject,
      body: 'Synthetic manual communication log. No email was sent by this action.',
      template: 'manual',
    },
  });
  expect(results, 'API logs packet-scoped manual communication', communication.status === 201 && communication.body?.packetId === String(fixture.packetId), {
    status: communication.status,
    packetId: communication.body?.packetId || null,
    error: communication.body?.error || null,
  });
  fixture.commSubject = commSubject;

  const followNote = `PAYSMOKE ${fixture.suffix} follow-up logged`;
  const followUp = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-lines/${fixture.lineId}/follow-up`,
    method: 'POST',
    body: {
      status: 'follow_up_logged',
      note: followNote,
      dueAt: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    },
  });
  expect(results, 'API records line follow-up and returns updated packet', followUp.status === 200 && followUp.body?.packet?.followUpStatus === 'follow_up_logged', {
    status: followUp.status,
    packetFollowUpStatus: followUp.body?.packet?.followUpStatus || null,
    eventStatus: followUp.body?.event?.toStatus || null,
    error: followUp.body?.error || null,
  });
  fixture.followNote = followNote;

  const followUps = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-followups?packetId=${encodeURIComponent(fixture.packetId)}&lineId=${encodeURIComponent(fixture.lineId)}`,
  });
  const followUpRows = Array.isArray(followUps.body) ? followUps.body : [];
  expect(results, 'API lists selected line follow-up history', followUps.status === 200 && followUpRows.some(row => row.note === followNote), {
    status: followUps.status,
    count: followUpRows.length,
  });

  const communications = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-communications?packetId=${encodeURIComponent(fixture.packetId)}`,
  });
  const commRows = Array.isArray(communications.body) ? communications.body : [];
  expect(results, 'API lists selected packet communications only', communications.status === 200 && commRows.some(row => row.subject === commSubject), {
    status: communications.status,
    count: commRows.length,
  });

  const detail = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-packets/${fixture.packetId}`,
  });
  const detailLines = Array.isArray(detail.body?.lines) ? detail.body.lines : [];
  const detailLine = detailLines.find(line => String(line.id || line.lineId) === String(fixture.lineId));
  const lineEvidence = Array.isArray(detailLine?.evidenceChecklist) ? detailLine.evidenceChecklist : [];
  expect(results, 'API detail preserves line-level evidence and follow-up status', detail.status === 200 && detail.body?.followUpStatus === 'follow_up_logged' && lineEvidence.some(doc => doc.lineId === String(fixture.lineId)), {
    status: detail.status,
    followUpStatus: detail.body?.followUpStatus || null,
    documentCount: Array.isArray(detail.body?.documents) ? detail.body.documents.length : null,
    lineEvidenceCount: lineEvidence.length,
  });

  const list = await apiRequest({
    baseUrl,
    path: `/api/finance/payment-packets?caseId=${encodeURIComponent(fixture.caseId)}`,
  });
  const listRows = Array.isArray(list.body) ? list.body : [];
  expect(results, 'API case-scoped packet list includes smoke packet', list.status === 200 && listRows.some(row => row.id === String(fixture.packetId)), {
    status: list.status,
    count: listRows.length,
  });

  return fixture;
}

function findChromeExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/home/bill/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/home/bill/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-143.0.7499.40/chrome-linux64/chrome',
    '/root/.cache/puppeteer/chrome/linux-142.0.7444.59/chrome-linux64/chrome',
  ].filter(Boolean);
  return candidates.find(candidate => fs.existsSync(candidate));
}

function buildBrowserSession() {
  const tokens = tokenEnv();
  if (!tokens.idToken) return null;
  return {
    idToken: tokens.idToken,
    accessToken: tokens.accessToken || null,
    refreshToken: null,
    expiresAt: Math.floor(Date.now() / 1000) + 3300,
  };
}

async function waitForText(page, text, timeout = 60000) {
  await page.waitForFunction(
    expected => document.body && document.body.innerText.includes(expected),
    { timeout },
    text
  );
}

async function maybeScreenshot(page, args, name) {
  if (!args.screenshotDir) return null;
  fs.mkdirSync(args.screenshotDir, { recursive: true });
  const filePath = path.join(args.screenshotDir, `${name}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

async function installApiRewriteIfNeeded(page, args) {
  const origins = Array.from(new Set(args.rewriteApiOrigins || []))
    .map(origin => {
      try {
        return new URL(origin).origin;
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
  if (!origins.length) return;
  const rewriteOrigins = new Set(origins);
  const adminBase = normalizeBaseUrl(args.adminBase, DEFAULT_ADMIN_BASE_URL);
  const adminOrigin = new URL(adminBase).origin;
  await page.setRequestInterception(true);
  page.on('request', request => {
    try {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && rewriteOrigins.has(url.origin)) {
        request.continue({
          url: `${adminBase}${url.pathname}${url.search}`,
          headers: {
            ...request.headers(),
            origin: adminOrigin,
          },
        });
        return;
      }
    } catch (_) {}
    request.continue();
  });
}

async function runBrowserSmoke(args, fixture, results) {
  const session = buildBrowserSession();
  if (!session) {
    skip(results, 'Puppeteer payments UI smoke', { reason: 'PAYMENTS_SMOKE_ID_TOKEN or SMOKE_ID_TOKEN not set' });
    return;
  }
  if (!fixture?.packetId || !fixture?.caseId) {
    skip(results, 'Puppeteer payments UI smoke', { reason: 'API fixture was not available' });
    return;
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (error) {
    skip(results, 'Puppeteer payments UI smoke', { reason: error.message });
    return;
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath: findChromeExecutable(),
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  const failures = [];
  await installApiRewriteIfNeeded(page, args);
  page.on('pageerror', error => {
    failures.push({ type: 'pageerror', message: error.message });
  });
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/api/') && response.status() >= 400) {
      failures.push({ type: 'api', status: response.status(), url });
    }
  });
  page.on('requestfailed', request => {
    const failure = request.failure();
    const url = request.url();
    if (url.includes('/api/') || /ERR_FAILED/i.test(failure?.errorText || '')) {
      failures.push({
        type: 'requestfailed',
        method: request.method(),
        resourceType: request.resourceType(),
        url,
        failure: failure?.errorText || null,
      });
    }
  });
  page.on('console', message => {
    const text = message.text();
    if (/ReferenceError|TypeError|Unhandled|Failed to load/i.test(text)) {
      failures.push({ type: 'console', level: message.type(), text: text.slice(0, 500) });
    }
  });

  const browserApiBase = normalizeBaseUrl(args.adminBase, DEFAULT_ADMIN_BASE_URL);
  await page.evaluateOnNewDocument((authSession, apiBase) => {
    window.__API_BASE__ = apiBase;
    sessionStorage.setItem('authSession', JSON.stringify(authSession));
    localStorage.setItem(
      'iset-case-workspace-layout-v14',
      JSON.stringify([
        { id: 'caseHeader', rowSpan: 3, columnSpan: 4 },
        { id: 'payments-queue', rowSpan: 5, columnSpan: 4 },
        { id: 'payments-detail', rowSpan: 5, columnSpan: 4 },
        { id: 'payments-comms', rowSpan: 4, columnSpan: 4 },
      ])
    );
    localStorage.setItem(
      'program-payments-layout-v3',
      JSON.stringify([
        { id: 'requests', rowSpan: 5, columnSpan: 4 },
        { id: 'detail', rowSpan: 4, columnSpan: 4 },
        { id: 'comms', rowSpan: 4, columnSpan: 4 },
        { id: 'sla', rowSpan: 2, columnSpan: 4 },
      ])
    );
  }, session, browserApiBase);

  const frontendBase = normalizeBaseUrl(args.frontendBase, DEFAULT_FRONTEND_BASE_URL);
  const caseUrl = `${frontendBase}/cases/${fixture.caseId}`;
  const paymentsUrl = `${frontendBase}/iset/payments`;
  try {
    await page.goto(caseUrl, { waitUntil: 'domcontentloaded' });
    await waitForText(page, 'Payment packet queue');
    await waitForText(page, fixture.payeeName);
    await waitForText(page, fixture.commSubject || `PAYSMOKE ${fixture.suffix}`);
    const caseShot = await maybeScreenshot(page, args, `payments-smoke-case-${fixture.suffix}`);
    pass(results, 'case workspace payment surface renders smoke packet and communication', {
      caseUrl,
      screenshot: caseShot,
    });

    await page.goto(paymentsUrl, { waitUntil: 'domcontentloaded' });
    await waitForText(page, 'Payment packet queue');
    await waitForText(page, fixture.payeeName);
    await waitForText(page, fixture.caseNumber);
    const paymentsShot = await maybeScreenshot(page, args, `payments-smoke-dashboard-${fixture.suffix}`);
    pass(results, 'cross-client payments dashboard renders the same smoke packet', {
      paymentsUrl,
      screenshot: paymentsShot,
    });

    expect(results, 'browser smoke saw no console/page/API failures', failures.length === 0, { failures });
  } catch (error) {
    let screenshot = null;
    let bodyText = null;
    try {
      screenshot = await maybeScreenshot(page, args, `payments-smoke-browser-failure-${fixture.suffix}`);
    } catch (_) {}
    try {
      bodyText = await page.evaluate(() => (document.body?.innerText || '').slice(0, 4000));
    } catch (_) {}
    expect(results, 'Puppeteer payments UI smoke completed expected assertions', false, {
      message: error?.message || String(error),
      url: page.url(),
      screenshot,
      bodyText,
      failures,
    });
  } finally {
    await browser.close();
  }
}

function renderHuman(result) {
  const lines = [];
  lines.push(`Payments workflow smoke: ${result.pass ? 'PASS' : 'FAIL'}`);
  lines.push(`Mode: ${result.mode}`);
  if (result.mode === 'schema-preflight-only') {
    lines.push('Exact authorized database identity and required object metadata proven; no ordinary SQL was executed.');
    lines.push(`Verified objects: ${Object.keys(result.schemaEvidence?.objects || {}).length}`);
  }
  if (result.fixture?.packetId) {
    lines.push(`Fixture packet ${result.fixture.packetId}, case ${result.fixture.caseId}, line ${result.fixture.lineId || 'n/a'}`);
  }
  if (result.fixtureCommitted) {
    lines.push('Persistent fixture kept for inspection.');
  } else if (result.cleanupCounts) {
    lines.push(`Cleanup counts: ${JSON.stringify(result.cleanupCounts)}`);
  } else if (result.rollback?.fixtureRolledBack) {
    lines.push('Rollback fixture completed and rolled back.');
  }
  lines.push('');
  result.results.forEach(entry => {
    lines.push(`${entry.status} ${entry.name}`);
    if (entry.status !== 'PASS') {
      lines.push(`  ${JSON.stringify(entry.details)}`);
    }
  });
  return lines.join('\n');
}

async function runPaymentsWorkflowSmoke({
  connection,
  args,
  dbConfig,
  guardFactory = createLiveMysqlSchemaGuard,
}) {
  const guard = createPaymentsSchemaGuard(connection, dbConfig, guardFactory);
  const schemaEvidence = await guard.preflight();
  if (args.schemaPreflightOnly) {
    return {
      pass: true,
      mode: 'schema-preflight-only',
      fixture: null,
      fixtureCommitted: false,
      cleanupCounts: null,
      rollback: null,
      results: [],
      schemaEvidence,
    };
  }

  const guardedConnection = guard.createGuardedConnection();
  const interventionCode = await resolveCompatibleInterventionCode(guardedConnection);
  const results = [];
  const fixtureState = {};
  let fixture = null;
  let cleanupCounts = null;
  let rollback = null;
  let workflowCompleted = false;

  try {
    if (args.api || args.browser) {
      fixture = await runApiSmoke(guardedConnection, args, results, { interventionCode, fixtureState });
      if (args.browser && fixture) {
        await runBrowserSmoke(args, fixture, results);
      } else if (args.browser && !fixture) {
        skip(results, 'Puppeteer payments UI smoke', { reason: 'API fixture did not run' });
      }
    } else {
      rollback = await runDbRollbackSmoke(guardedConnection, results, { interventionCode });
    }
    workflowCompleted = true;
  } finally {
    const cleanupTarget = fixture || (fixtureState.mutationStarted ? fixtureState : null);
    if (cleanupTarget && (!args.keepFixture || !workflowCompleted)) {
      cleanupCounts = await cleanupFixture(guardedConnection, cleanupTarget);
      if (cleanupCounts) {
        expect(
          results,
          'persistent API/browser fixture cleanup leaves no synthetic rows',
          Object.values(cleanupCounts).every(value => value === 0),
          cleanupCounts
        );
      }
    }
  }

  const skipped = results.filter(entry => entry.status === 'SKIP').length;
  const failed = results.filter(entry => entry.status === 'FAIL').length;
  const passAll = failed === 0 && (!args.requireLive || skipped === 0);
  return {
    pass: passAll,
    mode: args.browser ? 'api+browser' : args.api ? 'api' : 'db-rollback',
    fixture,
    fixtureCommitted: Boolean(fixture && args.keepFixture),
    cleanupCounts,
    rollback,
    results,
    schemaEvidence: guard.evidence(),
  };
}

async function main({ argv = process.argv.slice(2), mysqlModule = mysql } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return null;
  }
  if (typeof fetch !== 'function' && (args.api || args.browser)) {
    throw new Error('Node.js global fetch is required for --api/--browser. Use Node 18+.');
  }

  args.adminBase = normalizeBaseUrl(args.adminBase, DEFAULT_ADMIN_BASE_URL);
  args.frontendBase = normalizeBaseUrl(args.frontendBase, DEFAULT_FRONTEND_BASE_URL);
  const dbConfig = getDbConfig();
  resolveAuthorizedPaymentDatabaseIdentity(dbConfig);
  const connection = await mysqlModule.createConnection(dbConfig);
  let output;
  try {
    output = await runPaymentsWorkflowSmoke({ connection, args, dbConfig });
  } finally {
    await connection.end();
  }
  if (args.json) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log(renderHuman(output));
  }
  if (!output.pass) {
    process.exitCode = 1;
  }
  return output;
}

if (require.main === module) {
  main().catch(error => {
    console.error(`payments-workflow-smoke failed: ${error.stack || error.message || error}`);
    process.exit(1);
  });
}

module.exports = {
  EXPECTED_DEV_DATABASE_IDENTITY,
  EXPECTED_TEST_DATABASE_IDENTITY,
  PAYMENT_SCHEMA_OBJECTS,
  cleanupFixture,
  countFixtureRows,
  createBaseFixture,
  createPaymentsSchemaGuard,
  forceSubmittedForFollowUp,
  main,
  parseArgs,
  resolveCompatibleInterventionCode,
  resolveAuthorizedPaymentDatabaseIdentity,
  runApiSmoke,
  runDbRollbackSmoke,
  runPaymentsWorkflowSmoke,
};
