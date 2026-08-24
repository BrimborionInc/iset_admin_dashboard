#!/usr/bin/env node

/**
 * Live privacy-denial smoke for DEV.
 *
 * This script deliberately does not implement auth bypasses or header-based
 * impersonation. It uses real Cognito bearer tokens supplied through env vars
 * and reports SKIP when a token or fixture is unavailable.
 */

'use strict';

const mysql = require('mysql2/promise');

const DEFAULT_ADMIN_BASE_URL = 'http://localhost:5001';
const DEFAULT_PORTAL_BASE_URL = 'http://localhost:5000';

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  usage();
  process.exit(0);
}

if (typeof fetch !== 'function') {
  console.error('FAIL Node.js global fetch is required. Run with Node 18+.');
  process.exit(1);
}

const adminBaseUrl = normalizeBaseUrl(
  args.adminBase ||
    process.env.PRIVACY_DENIAL_ADMIN_BASE_URL ||
    process.env.ADMIN_API_BASE_URL ||
    DEFAULT_ADMIN_BASE_URL
);

const portalBaseUrl = normalizeBaseUrl(
  args.portalBase ||
    process.env.PRIVACY_DENIAL_PORTAL_BASE_URL ||
    process.env.PORTAL_API_BASE_URL ||
    DEFAULT_PORTAL_BASE_URL
);

const tokens = {
  nonAdminStaff: envToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN'),
  staff: envToken('PRIVACY_DENIAL_STAFF_TOKEN') || envToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN'),
  paymentAdmin: envToken('PRIVACY_DENIAL_PAYMENT_ADMIN_TOKEN') ||
    envToken('PRIVACY_DENIAL_SYSADMIN_TOKEN') ||
    envToken('PRIVACY_DENIAL_NWAC_ADMIN_TOKEN'),
  caseworkPayments: envToken('PRIVACY_DENIAL_CASEWORK_PAYMENTS_TOKEN'),
  applicantA: envToken('PRIVACY_DENIAL_APPLICANT_A_TOKEN'),
  applicantB: envToken('PRIVACY_DENIAL_APPLICANT_B_TOKEN'),
};

const dbState = {
  attempted: false,
  connection: null,
  error: null,
};

const results = [];

main()
  .then(async () => {
    await closeDb();
    printResults(results, { jsonMode: args.json });
    const failures = results.filter(result => result.status === 'FAIL').length;
    const skipped = results.filter(result => result.status === 'SKIP').length;
    if (failures > 0 || (args.requireLive && skipped > 0)) {
      process.exit(1);
    }
  })
  .catch(async error => {
    await closeDb();
    console.error(`FAIL privacy denial smoke crashed: ${error?.message || error}`);
    process.exit(1);
  });

async function main() {
  await runAdminNonAdminChecks();
  await runCrossSurfaceChecks();
  await runApplicantWrongOwnerChecks();
  await runExplicitAdminScopeChecks();
  await runGeneratedPdfChecks();
  await runFinanceChecks();
}

async function runAdminNonAdminChecks() {
  const token = tokens.nonAdminStaff;
  await liveCheck('admin templates reject non-admin staff', {
    baseUrl: adminBaseUrl,
    path: '/api/templates',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [403],
  });
  await liveCheck('admin notification settings reject non-admin staff', {
    baseUrl: adminBaseUrl,
    path: '/api/notifications',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [403],
  });
  await liveCheck('admin notification sender config rejects non-admin staff', {
    baseUrl: adminBaseUrl,
    path: '/api/config/notifications/email-settings',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [403],
  });
  await liveCheck('legacy generic admin users endpoint remains retired', {
    baseUrl: adminBaseUrl,
    path: '/api/users',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [410],
    expectedError: 'retired_endpoint',
  });
  await liveCheck('legacy generic admin user detail endpoint remains retired', {
    baseUrl: adminBaseUrl,
    path: '/api/users/1',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [410],
    expectedError: 'retired_endpoint',
  });
  await liveCheck('unsafe clear test data is blocked outside explicit debug/admin access', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/clear-iset-test-data',
    token,
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [403, 404],
  });
  await liveCheck('unsafe AI dummy draft is blocked outside explicit debug/admin access', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/ai/create-dummy-draft',
    token,
    body: { userId: 1, stepCursor: 'summary-page' },
    missing: missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
    expectedStatuses: [403, 404],
  });

  const aiKeyConfigured = Boolean((process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '').trim());
  await liveCheck('admin AI chat rejects sensitive identifiers before external send', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/ai/chat',
    token,
    body: {
      messages: [
        {
          role: 'user',
          content: 'Draft notes for applicant reference ISET-20260427-03EDB1 and bill@example.com',
        },
      ],
    },
    missing: [
      ...missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token),
      ...(aiKeyConfigured ? [] : ['OPENROUTER_API_KEY or OPENROUTER_KEY is not configured']),
    ],
    expectedStatuses: [400],
    expectedError: 'sensitive_ai_content',
  });
}

async function runCrossSurfaceChecks() {
  await liveCheck('public portal rejects staff token on applicant API', {
    baseUrl: portalBaseUrl,
    path: '/api/messages',
    token: tokens.staff,
    missing: missingToken('PRIVACY_DENIAL_STAFF_TOKEN or PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', tokens.staff),
    expectedStatuses: [401, 403],
  });
  await liveCheck('admin API rejects applicant token on staff API', {
    baseUrl: adminBaseUrl,
    path: '/api/templates',
    token: tokens.applicantB,
    missing: missingToken('PRIVACY_DENIAL_APPLICANT_B_TOKEN', tokens.applicantB),
    expectedStatuses: [401, 403],
  });
}

async function runApplicantWrongOwnerChecks() {
  const applicantBToken = tokens.applicantB;
  const applicantBMissing = missingToken('PRIVACY_DENIAL_APPLICANT_B_TOKEN', applicantBToken);

  const documentFixture = await resolvePortalDocumentFixture(applicantBToken);
  await liveCheck('public portal blocks applicant B from applicant A document download', {
    baseUrl: portalBaseUrl,
    path: `/api/documents/${documentFixture.id || 0}/presign-download`,
    token: applicantBToken,
    missing: [...applicantBMissing, ...documentFixture.missing],
    expectedStatuses: [403, 404],
    detail: documentFixture.detail,
  });

  const messageFixture = await resolvePortalMessageFixture(applicantBToken);
  await liveCheck('public portal blocks applicant B from applicant A message detail', {
    baseUrl: portalBaseUrl,
    path: `/api/messages/${messageFixture.id || 0}`,
    token: applicantBToken,
    missing: [...applicantBMissing, ...messageFixture.missing],
    expectedStatuses: [403, 404],
    detail: messageFixture.detail,
  });
}

async function runExplicitAdminScopeChecks() {
  const token = tokens.staff;
  const tokenMissing = missingToken('PRIVACY_DENIAL_STAFF_TOKEN or PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token);

  await liveCheck('admin staff token cannot read explicit out-of-scope case', {
    baseUrl: adminBaseUrl,
    path: `/api/cases/${numericEnv('PRIVACY_DENIAL_ADMIN_CASE_ID') || 0}`,
    token,
    missing: [...tokenMissing, ...missingNumericEnv('PRIVACY_DENIAL_ADMIN_CASE_ID')],
    expectedStatuses: [403, 404],
  });
  await liveCheck('admin staff token cannot read explicit out-of-scope application', {
    baseUrl: adminBaseUrl,
    path: `/api/applications/${numericEnv('PRIVACY_DENIAL_ADMIN_APPLICATION_ID') || 0}`,
    token,
    missing: [...tokenMissing, ...missingNumericEnv('PRIVACY_DENIAL_ADMIN_APPLICATION_ID')],
    expectedStatuses: [403, 404],
  });
  await liveCheck('admin staff token cannot presign explicit out-of-scope document', {
    baseUrl: adminBaseUrl,
    path: `/api/documents/${numericEnv('PRIVACY_DENIAL_ADMIN_DOCUMENT_ID') || 0}/presign-download`,
    token,
    missing: [...tokenMissing, ...missingNumericEnv('PRIVACY_DENIAL_ADMIN_DOCUMENT_ID')],
    expectedStatuses: [403, 404],
  });
}

async function runGeneratedPdfChecks() {
  const token = tokens.staff;
  const tokenMissing = missingToken('PRIVACY_DENIAL_STAFF_TOKEN or PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', token);
  const applicationMissing = missingNumericEnv('PRIVACY_DENIAL_ADMIN_APPLICATION_ID');
  const applicationId = numericEnv('PRIVACY_DENIAL_ADMIN_APPLICATION_ID') || 0;
  const commonBody = {
    applicationId,
    declarationSigned: true,
    declarationSignedName: 'Privacy Denial Smoke',
    declarationSignedAt: new Date(0).toISOString(),
  };

  await liveCheck('generated consent PDF rejects out-of-scope application', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/consent-letter/pdf',
    token,
    body: {
      applicationId,
      consentSigned: true,
      consentSignedName: 'Privacy Denial Smoke',
      consentSignedAt: new Date(0).toISOString(),
    },
    missing: [...tokenMissing, ...applicationMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('generated authorization PDF rejects out-of-scope application', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/authorization-release/pdf',
    token,
    body: commonBody,
    missing: [...tokenMissing, ...applicationMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('generated client acknowledgement PDF rejects out-of-scope application', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/client-acknowledgement/pdf',
    token,
    body: commonBody,
    missing: [...tokenMissing, ...applicationMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('generated Indigenous declaration PDF rejects out-of-scope application', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/indigenous-declaration/pdf',
    token,
    body: {
      ...commonBody,
      affiliation: 'Privacy denial fixture',
    },
    missing: [...tokenMissing, ...applicationMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('generated conflict declaration PDF rejects out-of-scope application', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/conflict-declaration/pdf',
    token,
    body: {
      ...commonBody,
      selection: 'no_conflict',
      optionLabel: 'No conflict',
      explanation: '',
    },
    missing: [...tokenMissing, ...applicationMissing],
    expectedStatuses: [403, 404],
  });
}

async function runFinanceChecks() {
  const nonAdminToken = tokens.nonAdminStaff;
  const nonAdminMissing = missingToken('PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN', nonAdminToken);
  const paymentAdminToken = tokens.paymentAdmin;
  const paymentAdminMissing = missingToken(
    'PRIVACY_DENIAL_PAYMENT_ADMIN_TOKEN or PRIVACY_DENIAL_SYSADMIN_TOKEN or PRIVACY_DENIAL_NWAC_ADMIN_TOKEN',
    paymentAdminToken
  );
  const caseworkToken = tokens.caseworkPayments;
  const caseworkMissing = missingToken('PRIVACY_DENIAL_CASEWORK_PAYMENTS_TOKEN', caseworkToken);
  const paymentPacketMissing = missingNumericEnv('PRIVACY_DENIAL_PAYMENT_PACKET_ID');
  const paymentPacketId = numericEnv('PRIVACY_DENIAL_PAYMENT_PACKET_ID') || 0;
  const rawEvidenceBody = {
    key: privacyDenialFinanceEvidenceKey(),
  };

  await liveCheck('allocation evidence presign rejects non-administrator role', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/allocations/evidence/presign-download',
    token: nonAdminToken,
    body: rawEvidenceBody,
    missing: nonAdminMissing,
    expectedStatuses: [403],
  });
  await liveCheck('allocation evidence delete rejects non-administrator role', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/allocations/evidence/delete',
    token: nonAdminToken,
    body: rawEvidenceBody,
    missing: nonAdminMissing,
    expectedStatuses: [403],
  });
  await liveCheck('finance allocation evidence presign rejects unreferenced raw object key', {
    baseUrl: adminBaseUrl,
    method: 'POST',
    path: '/api/allocations/evidence/presign-download',
    token: paymentAdminToken,
    body: rawEvidenceBody,
    missing: paymentAdminMissing,
    expectedStatuses: [403],
  });
  await liveCheck('casework payments token cannot read explicit out-of-scope payment packet', {
    baseUrl: adminBaseUrl,
    path: `/api/finance/payment-packets/${paymentPacketId}`,
    token: caseworkToken,
    missing: [...caseworkMissing, ...paymentPacketMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('casework payments token cannot generate explicit out-of-scope payment packet PDF', {
    baseUrl: adminBaseUrl,
    path: `/api/finance/payment-packets/${paymentPacketId}/pdf`,
    token: caseworkToken,
    missing: [...caseworkMissing, ...paymentPacketMissing],
    expectedStatuses: [403, 404],
  });
  await liveCheck('casework payments token cannot read global payment batches', {
    baseUrl: adminBaseUrl,
    path: '/api/finance/payment-batches',
    token: caseworkToken,
    missing: caseworkMissing,
    expectedStatuses: [403],
  });
}

async function resolvePortalDocumentFixture(applicantBToken) {
  const explicit = numericEnv('PRIVACY_DENIAL_PORTAL_DOCUMENT_ID');
  if (explicit) {
    return { id: explicit, missing: [], detail: `fixture=${explicit}` };
  }
  if (!applicantBToken) {
    return { id: null, missing: [], detail: null };
  }
  const applicantB = await resolveApplicantUserId(applicantBToken, 'PRIVACY_DENIAL_APPLICANT_B_TOKEN');
  if (applicantB.missing.length) return { id: null, missing: applicantB.missing, detail: null };

  const applicantA = tokens.applicantA
    ? await resolveApplicantUserId(tokens.applicantA, 'PRIVACY_DENIAL_APPLICANT_A_TOKEN')
    : { id: null, missing: [] };
  const connection = await getDb();
  if (!connection) {
    return { id: null, missing: [dbUnavailableReason()], detail: null };
  }
  const params = [];
  let ownerClause = 'f.user_id <> ?';
  params.push(applicantB.id);
  if (applicantA.id) {
    ownerClause = 'f.user_id = ? AND f.user_id <> ?';
    params.length = 0;
    params.push(applicantA.id, applicantB.id);
  }
  const row = await queryOne(
    connection,
    `SELECT f.id, f.user_id
       FROM iset_application_file f
      WHERE ${ownerClause}
        AND COALESCE(f.status, '') <> 'deleted'
        AND f.file_path IS NOT NULL
      ORDER BY f.id DESC
      LIMIT 1`,
    params
  );
  if (!row) {
    return {
      id: null,
      missing: ['no other applicant document fixture found in iset_application_file'],
      detail: null,
    };
  }
  return { id: Number(row.id), missing: [], detail: `fixture=${row.id}, owner_user_id=${row.user_id}` };
}

async function resolvePortalMessageFixture(applicantBToken) {
  const explicit = numericEnv('PRIVACY_DENIAL_PORTAL_MESSAGE_ID');
  if (explicit) {
    return { id: explicit, missing: [], detail: `fixture=${explicit}` };
  }
  if (!applicantBToken) {
    return { id: null, missing: [], detail: null };
  }
  const applicantB = await resolveApplicantUserId(applicantBToken, 'PRIVACY_DENIAL_APPLICANT_B_TOKEN');
  if (applicantB.missing.length) return { id: null, missing: applicantB.missing, detail: null };

  const applicantA = tokens.applicantA
    ? await resolveApplicantUserId(tokens.applicantA, 'PRIVACY_DENIAL_APPLICANT_A_TOKEN')
    : { id: null, missing: [] };
  const connection = await getDb();
  if (!connection) {
    return { id: null, missing: [dbUnavailableReason()], detail: null };
  }

  const params = [applicantB.id, applicantB.id];
  let ownerClause = `NOT (
      (m.sender_actor_type = 'applicant_user' AND m.sender_user_id = ?)
      OR (m.recipient_actor_type = 'applicant_user' AND m.recipient_user_id = ?)
    )`;
  if (applicantA.id) {
    ownerClause = `(
      (m.sender_actor_type = 'applicant_user' AND m.sender_user_id = ?)
      OR (m.recipient_actor_type = 'applicant_user' AND m.recipient_user_id = ?)
    )
    AND NOT (
      (m.sender_actor_type = 'applicant_user' AND m.sender_user_id = ?)
      OR (m.recipient_actor_type = 'applicant_user' AND m.recipient_user_id = ?)
    )`;
    params.length = 0;
    params.push(applicantA.id, applicantA.id, applicantB.id, applicantB.id);
  }

  const row = await queryOne(
    connection,
    `SELECT m.id,
            m.sender_user_id,
            m.recipient_user_id
       FROM messages m
      WHERE COALESCE(m.deleted, 0) = 0
        AND (
          (m.sender_actor_type = 'applicant_user' AND m.sender_user_id IS NOT NULL)
          OR (m.recipient_actor_type = 'applicant_user' AND m.recipient_user_id IS NOT NULL)
        )
        AND ${ownerClause}
      ORDER BY m.id DESC
      LIMIT 1`,
    params
  );
  if (!row) {
    return {
      id: null,
      missing: ['no other applicant message fixture found in messages'],
      detail: null,
    };
  }
  return {
    id: Number(row.id),
    missing: [],
    detail: `fixture=${row.id}, sender_user_id=${row.sender_user_id || 'null'}, recipient_user_id=${row.recipient_user_id || 'null'}`,
  };
}

async function resolveApplicantUserId(token, tokenName) {
  const payload = decodeJwtPayload(token);
  const sub = normalizeString(payload?.sub);
  if (!sub) return { id: null, missing: [`${tokenName} does not contain a JWT sub claim`] };
  const connection = await getDb();
  if (!connection) return { id: null, missing: [dbUnavailableReason()] };
  const row = await queryOne(connection, 'SELECT id FROM `user` WHERE cognito_sub = ? LIMIT 1', [sub]);
  if (!row) return { id: null, missing: [`no local user row found for ${tokenName} sub`] };
  return { id: Number(row.id), missing: [] };
}

async function liveCheck(name, options) {
  const missing = Array.isArray(options.missing) ? options.missing.filter(Boolean) : [];
  if (missing.length) {
    results.push({
      status: 'SKIP',
      name,
      detail: missing.join('; '),
    });
    return;
  }

  let response;
  try {
    response = await requestJson({
      baseUrl: options.baseUrl,
      method: options.method || 'GET',
      path: options.path,
      token: options.token,
      body: options.body,
    });
  } catch (error) {
    results.push({
      status: 'FAIL',
      name,
      detail: `request failed: ${error?.message || error}`,
    });
    return;
  }

  const expectedStatuses = options.expectedStatuses || [];
  if (!expectedStatuses.includes(response.status)) {
    results.push({
      status: 'FAIL',
      name,
      detail: `expected ${expectedStatuses.join('/')} got ${response.status}${responseSummary(response)}`,
    });
    return;
  }

  if (options.expectedError) {
    const errorCode = normalizeString(response.json?.error);
    if (errorCode !== options.expectedError) {
      results.push({
        status: 'FAIL',
        name,
        detail: `expected error ${options.expectedError} got ${errorCode || 'none'} (status ${response.status})`,
      });
      return;
    }
  }

  results.push({
    status: 'PASS',
    name,
    detail: `status ${response.status}${options.detail ? `; ${options.detail}` : ''}`,
  });
}

async function requestJson({ baseUrl, method, path, token, body }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.PRIVACY_DENIAL_TIMEOUT_MS || 10000));
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let requestBody;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    requestBody = JSON.stringify(body);
  }
  try {
    const response = await fetch(new URL(stripLeadingSlash(path), baseUrl).toString(), {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch (_) {
      json = null;
    }
    return { status: response.status, text, json };
  } finally {
    clearTimeout(timeout);
  }
}

async function getDb() {
  if (dbState.attempted) return dbState.connection;
  dbState.attempted = true;
  const config = getDbConfig();
  if (!config) return null;
  try {
    dbState.connection = await mysql.createConnection(config);
    return dbState.connection;
  } catch (error) {
    dbState.error = error;
    return null;
  }
}

async function closeDb() {
  if (dbState.connection) {
    await dbState.connection.end().catch(() => {});
  }
}

async function queryOne(connection, sql, params = []) {
  const [rows] = await connection.execute(sql, params);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

function getDbConfig() {
  const host = normalizeString(process.env.DB_HOST);
  const user = normalizeString(process.env.DB_USER);
  const database = normalizeString(process.env.DB_NAME);
  if (!host || !user || !database) return null;
  return {
    host,
    port: Number(process.env.DB_PORT || 3306),
    user,
    password: process.env.DB_PASS || '',
    database,
  };
}

function dbUnavailableReason() {
  const config = getDbConfig();
  if (!config) return 'DB_HOST, DB_USER, and DB_NAME are required for fixture discovery';
  return `database fixture discovery unavailable${dbState.error ? `: ${dbState.error.message}` : ''}`;
}

function responseSummary(response) {
  const error = normalizeString(response.json?.error);
  const message = normalizeString(response.json?.message);
  if (error) return ` (${error})`;
  if (message) return ` (${message.slice(0, 120)})`;
  return '';
}

function printResults(items, { jsonMode }) {
  const summary = {
    pass: items.filter(item => item.status === 'PASS').length,
    fail: items.filter(item => item.status === 'FAIL').length,
    skip: items.filter(item => item.status === 'SKIP').length,
    total: items.length,
  };
  if (jsonMode) {
    console.log(JSON.stringify({ summary, results: items }, null, 2));
    return;
  }
  for (const item of items) {
    console.log(`${item.status} ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
  }
  console.log(`Summary: ${summary.pass} passed, ${summary.fail} failed, ${summary.skip} skipped, ${summary.total} total`);
  if (args.requireLive && summary.skip > 0) {
    console.log('FAIL --require-live was set and one or more live checks were skipped.');
  }
}

function missingToken(name, value) {
  return value ? [] : [`${name} is not set`];
}

function missingNumericEnv(name) {
  return numericEnv(name) ? [] : [`${name} is not set`];
}

function envToken(name) {
  return normalizeString(process.env[name]);
}

function numericEnv(name) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function privacyDenialFinanceEvidenceKey() {
  return 'uploads/2026/04/27/allocations/999/00000000-0000-0000-0000-000000000000-privacy-denial-smoke.pdf';
}

function decodeJwtPayload(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch (_) {
    return null;
  }
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBaseUrl(value) {
  const url = normalizeString(value);
  return url.endsWith('/') ? url : `${url}/`;
}

function stripLeadingSlash(value) {
  return String(value || '').replace(/^\/+/, '');
}

function parseArgs(argv) {
  const parsed = {
    json: false,
    requireLive: false,
    adminBase: '',
    portalBase: '',
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--require-live') {
      parsed.requireLive = true;
    } else if (arg === '--admin-base') {
      parsed.adminBase = argv[++index] || '';
    } else if (arg.startsWith('--admin-base=')) {
      parsed.adminBase = arg.slice('--admin-base='.length);
    } else if (arg === '--portal-base') {
      parsed.portalBase = argv[++index] || '';
    } else if (arg.startsWith('--portal-base=')) {
      parsed.portalBase = arg.slice('--portal-base='.length);
    } else {
      console.error(`Unknown argument: ${arg}`);
      usage();
      process.exit(1);
    }
  }
  return parsed;
}

function usage() {
  console.log([
    'Usage: node scripts/privacy-route-denial-smoke.js [--json] [--require-live] [--admin-base URL] [--portal-base URL]',
    '',
    'Uses real bearer tokens from environment variables:',
    '  PRIVACY_DENIAL_NON_ADMIN_STAFF_TOKEN',
    '  PRIVACY_DENIAL_STAFF_TOKEN',
    '  PRIVACY_DENIAL_CASEWORK_PAYMENTS_TOKEN',
    '  PRIVACY_DENIAL_PAYMENT_ADMIN_TOKEN',
    '  PRIVACY_DENIAL_APPLICANT_A_TOKEN',
    '  PRIVACY_DENIAL_APPLICANT_B_TOKEN',
    '',
    'Optional explicit fixtures:',
    '  PRIVACY_DENIAL_PORTAL_DOCUMENT_ID',
    '  PRIVACY_DENIAL_PORTAL_MESSAGE_ID',
    '  PRIVACY_DENIAL_ADMIN_CASE_ID',
    '  PRIVACY_DENIAL_ADMIN_APPLICATION_ID',
    '  PRIVACY_DENIAL_ADMIN_DOCUMENT_ID',
    '  PRIVACY_DENIAL_PAYMENT_PACKET_ID',
  ].join('\n'));
}
