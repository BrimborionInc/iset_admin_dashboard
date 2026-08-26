const http = require('http');
const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');
const { createSyntheticTestEnvironment } = require('../scripts/run-test-all');

global.Blob = global.Blob || Blob;
global.File = global.File || File;
global.ReadableStream = global.ReadableStream || ReadableStream;
global.MessageChannel = global.MessageChannel || MessageChannel;
global.MessagePort = global.MessagePort || MessagePort;
global.DOMException = global.DOMException || class DOMException extends Error {
  constructor(message = '', name = 'Error') {
    super(message);
    this.name = name;
  }
};

const mockFullStackObjectState = {
  key: 'uploads/2026/08/25/300/cfa-v20-APP-123.pdf',
  versionId: 'full-stack-cfa-version-20',
  checksum: null,
  size: null,
};

const mockFullStackS3Provider = {
  DRIVER: 's3',
  OBJECT_VERSION_COMPENSATION_SUPPORTED: true,
  generateKey: jest.fn(() => mockFullStackObjectState.key),
  presignPut: jest.fn(async ({ metadata }) => {
    mockFullStackObjectState.checksum = metadata?.['path-sha256'] || null;
    return {
      url: 'https://object-store.invalid/full-stack-cfa',
      headers: { 'If-None-Match': '*' },
    };
  }),
  headObject: jest.fn(async ({ key, versionId }) => ({
    exists: key === mockFullStackObjectState.key,
    versionId: versionId || mockFullStackObjectState.versionId,
    size: mockFullStackObjectState.size,
    metadata: { 'path-sha256': mockFullStackObjectState.checksum },
  })),
  deleteObject: jest.fn(async ({ versionId }) => ({ deleted: true, versionId })),
};

const mockFullStackPdfPage = {
  setContent: jest.fn(async () => {}),
  pdf: jest.fn(async () => Buffer.from('full-stack-cfa-pdf')),
  close: jest.fn(async () => {}),
};

jest.mock('../../ISET-intake/s3Provider', () => mockFullStackS3Provider);
jest.mock('puppeteer', () => ({
  launch: jest.fn(async () => ({
    newPage: jest.fn(async () => mockFullStackPdfPage),
    close: jest.fn(async () => {}),
  })),
}));
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(async (_url, body) => {
    mockFullStackObjectState.size = Number(body?.length) || null;
    return { headers: { 'x-amz-version-id': mockFullStackObjectState.versionId } };
  }),
}));

function createFakePool() {
  const queries = [];
  const transactionEvents = [];
  let queryResponder = null;
  const runQuery = async (source, sql, params = []) => {
    queries.push({ sql: String(sql), params, source });
    if (typeof queryResponder === 'function') {
      const response = await queryResponder(String(sql), params);
      if (typeof response !== 'undefined') return response;
    }
    return [[], []];
  };
  const query = (sql, params = []) => runQuery('pool', sql, params);
  return {
    queries,
    transactionEvents,
    query,
    execute: query,
    setQueryResponder: responder => { queryResponder = responder; },
    clearQueryResponder: () => { queryResponder = null; },
    getConnection: async () => {
      const connectionQuery = (sql, params = []) => runQuery('connection', sql, params);
      return {
        query: connectionQuery,
        execute: connectionQuery,
        beginTransaction: async () => { transactionEvents.push('begin'); },
        commit: async () => { transactionEvents.push('commit'); },
        rollback: async () => { transactionEvents.push('rollback'); },
        release: () => { transactionEvents.push('release'); },
      };
    },
  };
}

function requestJson(server, path, options = {}) {
  const address = server.address();
  const body = options.body || null;
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode, body: raw ? JSON.parse(raw) : null });
      });
    });
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

describe('complete admin Express stack', () => {
  let server;
  let serverApp;
  let fakePool;
  let dependencyStore;
  let authIdentity;
  let createFundingOverviewVersion;
  let createCfaVersionFromAssessment;
  let buildCfaSnapshot;
  let computeCfaSnapshotSignature;
  let syntheticTestEnvironment;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  const previousUnsafeAdminDebugRoutes = process.env.ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    process.env.ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES = '1';
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    fakePool = createFakePool();
    authIdentity = {
      subjectType: 'staff',
      sub: 'full-stack-test-staff',
      email: 'full-stack-test@example.invalid',
      role: 'System Administrator',
      staffProfileId: 1,
    };
    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = { ...authIdentity };
        next();
      },
      workflowSchemaBuilder: jest.fn(async () => ({
        steps: [{ id: 'funding-agreement', components: [] }],
        meta: {},
      })),
    });
    ({
      app: serverApp,
      createFundingOverviewVersion,
      createCfaVersionFromAssessment,
      buildCfaSnapshot,
      computeCfaSnapshotSignature,
    } = require('../isetadminserver'));
    server = serverApp.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (previousUnsafeAdminDebugRoutes === undefined) {
      delete process.env.ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES;
    } else {
      process.env.ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES = previousUnsafeAdminDebugRoutes;
    }
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  test('mounts authentication and routes registered after the former listener boundary', async () => {
    const auth = await requestJson(server, '/api/auth/me');
    expect(auth.status).toBe(200);
    expect(auth.body.auth).toMatchObject({ subjectType: 'staff', role: 'System Administrator' });

    const staffProfileProbe = fakePool.queries.find(({ sql }) => (
      sql.includes('FROM `staff_profiles` LIMIT 0')
    ));
    expect(staffProfileProbe?.sql).toContain('`id`, `cognito_sub`, `email`, `primary_role`, `region_id`');
    expect(staffProfileProbe?.sql).not.toContain('`last_seen_at`');

    const retired = await requestJson(server, '/api/users/123');
    expect(retired).toMatchObject({
      status: 410,
      body: { error: 'retired_endpoint' },
    });
  });

  test('applies the real parser and route stack without mutating runtime configuration', async () => {
    const response = await requestJson(server, '/api/config/runtime/ai-fallbacks', {
      method: 'PATCH',
      headers: { 'content-type': 'text/plain' },
      body: '{"fallbackModels":["unexpected/write"]}',
    });

    expect(response).toEqual({
      status: 400,
      body: { error: 'fallback_models_required' },
    });
    expect(fakePool.queries.some(({ sql }) => sql.includes("'ai.fallbacks'"))).toBe(false);
  });

  test('Clear Test Data aborts on an unlisted referencing child before starting a transaction', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    mockFullStackS3Provider.deleteObject.mockClear();
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT DATABASE()') {
        return [[{ 'DATABASE()': 'iset_admin' }], []];
      }
      if (normalizedSql.includes('FROM information_schema.TABLES')) {
        return [[
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'budget_pot', TABLE_TYPE: 'BASE TABLE' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'external_case_hold', TABLE_TYPE: 'BASE TABLE' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'iset_case', TABLE_TYPE: 'BASE TABLE' },
        ], []];
      }
      if (normalizedSql.includes('FROM information_schema.COLUMNS')) {
        return [[
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'budget_pot', COLUMN_NAME: 'committed_amount', IS_NULLABLE: 'NO' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'budget_pot', COLUMN_NAME: 'actual_amount', IS_NULLABLE: 'NO' },
        ], []];
      }
      if (normalizedSql.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
        return [[{
          TABLE_SCHEMA: 'iset_admin',
          TABLE_NAME: 'external_case_hold',
          CONSTRAINT_NAME: 'fk_external_case_hold_case',
          COLUMN_NAME: 'case_id',
          REFERENCED_TABLE_SCHEMA: 'iset_admin',
          REFERENCED_TABLE_NAME: 'iset_case',
          REFERENCED_COLUMN_NAME: 'id',
          ORDINAL_POSITION: 1,
        }], []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/clear-iset-test-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 500,
      body: {
        error: 'clear_test_data_failed',
        message: 'clear_test_data_unlisted_referencing_tables',
        objectPurge: null,
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const preflightStartIndex = routeQueries.findIndex(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim() === 'SELECT DATABASE()'
    ));
    expect(preflightStartIndex).toBeGreaterThanOrEqual(0);
    const clearQueries = routeQueries.slice(preflightStartIndex);
    expect(clearQueries.some(({ sql }) => /^(INSERT|UPDATE|DELETE)\b/i.test(String(sql).trim())))
      .toBe(false);
    expect(clearQueries.some(({ sql }) => String(sql).includes('FOREIGN_KEY_CHECKS'))).toBe(false);
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual(['release']);
    expect(mockFullStackS3Provider.deleteObject).not.toHaveBeenCalled();
  });

  test('Clear Test Data detaches proven self references and rolls back every DML change on delete failure', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    mockFullStackS3Provider.deleteObject.mockClear();
    const baseTable = TABLE_NAME => ({
      TABLE_SCHEMA: 'iset_admin',
      TABLE_NAME,
      TABLE_TYPE: 'BASE TABLE',
    });
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT DATABASE()') {
        return [[{ 'DATABASE()': 'iset_admin' }], []];
      }
      if (normalizedSql.includes('FROM information_schema.TABLES')) {
        return [[
          baseTable('budget_pot'),
          baseTable('cfa_version'),
          baseTable('client'),
          baseTable('client_applicant_account_event'),
          baseTable('funding_overview_version'),
          baseTable('iset_application'),
          baseTable('iset_application_submission'),
          baseTable('iset_case'),
          baseTable('iset_document'),
        ], []];
      }
      if (normalizedSql.includes('FROM information_schema.COLUMNS')) {
        return [[
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'budget_pot', COLUMN_NAME: 'committed_amount', IS_NULLABLE: 'NO' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'budget_pot', COLUMN_NAME: 'actual_amount', IS_NULLABLE: 'NO' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'cfa_version', COLUMN_NAME: 'supersedes_version_id', IS_NULLABLE: 'YES' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'client', COLUMN_NAME: 'id', IS_NULLABLE: 'NO' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'client_applicant_account_event', COLUMN_NAME: 'client_id', IS_NULLABLE: 'NO' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'funding_overview_version', COLUMN_NAME: 'supersedes_version_id', IS_NULLABLE: 'YES' },
          { TABLE_SCHEMA: 'iset_admin', TABLE_NAME: 'iset_document', COLUMN_NAME: 'file_path', IS_NULLABLE: 'YES' },
        ], []];
      }
      if (normalizedSql.includes('FROM information_schema.KEY_COLUMN_USAGE')) {
        const foreignKey = (TABLE_NAME, REFERENCED_TABLE_NAME, COLUMN_NAME, REFERENCED_COLUMN_NAME, CONSTRAINT_NAME) => ({
          TABLE_SCHEMA: 'iset_admin',
          TABLE_NAME,
          CONSTRAINT_NAME,
          COLUMN_NAME,
          REFERENCED_TABLE_SCHEMA: 'iset_admin',
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME,
          ORDINAL_POSITION: 1,
        });
        return [[
          foreignKey('cfa_version', 'cfa_version', 'supersedes_version_id', 'id', 'fk_cfa_supersedes'),
          foreignKey('funding_overview_version', 'funding_overview_version', 'supersedes_version_id', 'id', 'fk_funding_overview_supersedes'),
          foreignKey('iset_application', 'iset_application_submission', 'submission_id', 'id', 'fk_application_submission'),
          foreignKey('iset_application', 'iset_case', 'case_id', 'id', 'fk_application_case'),
          foreignKey('iset_application', 'client', 'client_id', 'id', 'fk_application_client'),
          foreignKey('client_applicant_account_event', 'client', 'client_id', 'id', 'fk_account_event_client'),
        ], []];
      }
      if (normalizedSql.startsWith('SELECT `file_path` FROM `iset_admin`.`iset_document`')) {
        return [[{ file_path: 'uploads/clear-test-evidence.pdf' }], []];
      }
      if (normalizedSql.startsWith('SELECT COUNT(*) FROM')) {
        return [[{ 'COUNT(*)': 1 }], []];
      }
      if (normalizedSql === 'DELETE FROM `iset_admin`.`iset_case`') {
        throw new Error('forced_clear_test_delete_failure');
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/clear-iset-test-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 500,
      body: {
        error: 'clear_test_data_failed',
        message: 'forced_clear_test_delete_failure',
        table: 'iset_case',
        objectPurge: null,
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount).map(({ sql, params }) => ({
      sql: String(sql).replace(/\s+/g, ' ').trim(),
      params,
    }));
    const cfaDetachIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'UPDATE `iset_admin`.`cfa_version` SET `supersedes_version_id` = NULL'
    ));
    const fundingDetachIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'UPDATE `iset_admin`.`funding_overview_version` SET `supersedes_version_id` = NULL'
    ));
    const firstDeleteIndex = routeQueries.findIndex(({ sql }) => sql.startsWith('DELETE FROM'));
    const applicationDeleteIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'DELETE FROM `iset_admin`.`iset_application`'
    ));
    const submissionDeleteIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'DELETE FROM `iset_admin`.`iset_application_submission`'
    ));
    const caseDeleteIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'DELETE FROM `iset_admin`.`iset_case`'
    ));
    const clientDeleteIndex = routeQueries.findIndex(({ sql }) => (
      sql === 'DELETE FROM `iset_admin`.`client`'
    ));
    expect(cfaDetachIndex).toBeGreaterThanOrEqual(0);
    expect(fundingDetachIndex).toBeGreaterThanOrEqual(0);
    expect(cfaDetachIndex).toBeLessThan(firstDeleteIndex);
    expect(fundingDetachIndex).toBeLessThan(firstDeleteIndex);
    expect(applicationDeleteIndex).toBeGreaterThanOrEqual(0);
    expect(applicationDeleteIndex).toBeLessThan(submissionDeleteIndex);
    expect(applicationDeleteIndex).toBeLessThan(caseDeleteIndex);
    expect(clientDeleteIndex).toBe(-1);
    expect(routeQueries.some(({ sql }) => sql.includes('FOREIGN_KEY_CHECKS'))).toBe(false);
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
      'begin',
      'rollback',
      'release',
    ]);
    expect(mockFullStackS3Provider.deleteObject).not.toHaveBeenCalled();
  });

  test('refuses a signing-form message before any write when exact application scope is omitted', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const response = await requestJson(server, '/api/cases/76/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Financial Overview required',
        body: 'Please complete the attached form.',
        toDisplayName: 'Applicant',
        fromDisplayName: 'Regional Manager',
        attachments: [{ workflow_id: 52 }],
      }),
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: 'application_id_required_for_signing_request',
        message: 'Choose the exact application before sending a form for signature.',
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO signing_request'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('message_signing_request'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('UPDATE iset_application'))).toBe(false);
  });

  test('ordinary secure messages ignore ambient Action Plan and intervention scope', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: null,
          application_lifecycle_status: null,
          decision_outcome: null,
          submission_reference: null,
          applicant_submission_user_id: null,
          applicant_submission_client_id: null,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('a.id AS application_id') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: 3100, affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Schedule update',
          body: 'Your appointment time has changed.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Case Worker',
          actionPlanId: '1e2',
          action_plan_id: 184,
          interventionId: '1e2',
          intervention_id: 777,
          attachments: [],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 201,
      body: {
        message: 'Message sent',
        messageId: 3100,
        replyToMessageId: null,
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const applicantResolutionQuery = routeQueries.find(({ sql }) => (
      sql.includes('AS applicant_submission_user_id') &&
      sql.includes('FROM iset_case c')
    ));
    expect(applicantResolutionQuery?.sql).toContain('NULL AS application_id');
    expect(applicantResolutionQuery?.sql).not.toContain('JOIN iset_application ');
    expect(applicantResolutionQuery?.params).toEqual([76]);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(true);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO signing_request'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('FROM iset_case_action_plan'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('FROM iset_case_intervention'))).toBe(false);
  });

  test('an incomplete application/client link blocks only versioned forms, not an ordinary application message', async () => {
    let nextMessageId = 3150;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: 123,
          application_client_id: null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: 'approved',
          application_lifecycle_status: 'active',
          decision_outcome: 'approved',
          submission_reference: 'APP-123',
          applicant_submission_user_id: 901,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (
        normalizedSql.includes('FROM iset_intake.workflow') &&
        normalizedSql.includes('WHERE id IN')
      ) {
        return [[{
          id: 54,
          name: 'Financial Overview',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'financial_overview',
        }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: nextMessageId++, affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    try {
      const ordinaryResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Application update',
          body: 'Your application remains under review.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Case Worker',
          applicationId: 123,
          attachments: [],
        }),
      });
      expect(ordinaryResponse).toEqual({
        status: 201,
        body: {
          message: 'Message sent',
          messageId: 3150,
          replyToMessageId: null,
        },
      });

      const beforeFormQueryCount = fakePool.queries.length;
      const formResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Financial Overview',
          body: 'Please review the attached form.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Case Worker',
          applicationId: 123,
          attachments: [{ workflow_id: 54 }],
        }),
      });
      expect(formResponse).toEqual({
        status: 409,
        body: {
          error: 'versioned_form_client_scope_conflict',
          message: 'The selected application is not linked to this case participant. Other secure messages remain available.',
        },
      });
      const formQueries = fakePool.queries.slice(beforeFormQueryCount);
      expect(formQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(false);
      expect(formQueries.some(({ sql }) => sql.includes('INSERT INTO signing_request'))).toBe(false);
      expect(formQueries.some(({ sql }) => sql.includes('funding_overview_version'))).toBe(false);
    } finally {
      fakePool.clearQueryResponder();
    }
  });

  test('a mismatched workspace application cannot block plain case messaging or contaminate its scope', async () => {
    const beforeQueryCount = fakePool.queries.length;
    let claimedOperation = null;
    fakePool.setQueryResponder(async (sql, params = []) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        const applicationScoped = normalizedSql.includes('JOIN iset_application a');
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: applicationScoped ? 123 : null,
          application_client_id: applicationScoped ? 999 : null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: applicationScoped ? 'approved' : null,
          application_lifecycle_status: applicationScoped ? 'active' : null,
          decision_outcome: applicationScoped ? 'approved' : null,
          submission_reference: applicationScoped ? 'APP-123' : null,
          applicant_submission_user_id: applicationScoped ? 901 : null,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Case Participant',
          applicant_email: 'case.participant@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM message_send_operation AS mso')) {
        return [
          claimedOperation && claimedOperation.client_operation_id === params[2]
            ? [{ ...claimedOperation }]
            : [],
          [],
        ];
      }
      if (normalizedSql.startsWith('INSERT INTO message_send_operation ')) {
        claimedOperation = {
          id: 9100,
          client_operation_id: params[0],
          request_sha256: params[1],
          sender_user_id: params[2],
          sender_staff_profile_id: params[3],
          case_id: params[4],
          application_id: params[5],
          message_id: null,
          response_status: null,
          response_json: null,
          completed_at: null,
        };
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: 3200, affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    try {
      const ordinaryResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Case update',
          body: 'This case message must remain available.',
          toDisplayName: 'Case Participant',
          fromDisplayName: 'Case Worker',
          applicationId: 123,
          actionPlanId: 444,
          interventionId: 555,
          expectedApplicationRowVersion: 9,
          clientOperationId: 'case-message-mismatch-001',
          attachments: [],
        }),
      });
      expect(ordinaryResponse).toEqual({
        status: 201,
        body: {
          message: 'Message sent',
          messageId: 3200,
          replyToMessageId: null,
        },
      });

      for (const [workflowId, clientOperationId] of [
        [54, 'case-message-mismatch-cfa'],
        [55, 'case-message-mismatch-fo1'],
      ]) {
        const formStart = fakePool.queries.length;
        const formResponse = await requestJson(server, '/api/cases/76/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: 'Application form',
            body: 'Please review the attached form.',
            toDisplayName: 'Case Participant',
            fromDisplayName: 'Case Worker',
            applicationId: 123,
            clientOperationId,
            attachments: [{ workflow_id: workflowId }],
          }),
        });
        expect(formResponse).toEqual({
          status: 409,
          body: {
            error: 'application_scope_conflict',
            message: 'The selected application belongs to a different participant record. Repair that application link before sending from it.',
          },
        });
        const formQueries = fakePool.queries.slice(formStart);
        expect(formQueries.some(({ sql: query }) => query.includes('INSERT INTO messages'))).toBe(false);
        expect(formQueries.some(({ sql: query }) => query.includes('INSERT INTO message_send_operation'))).toBe(false);
        expect(formQueries.some(({ sql: query }) => query.includes('INSERT INTO signing_request'))).toBe(false);
        expect(formQueries.some(({ sql: query }) => query.includes('cfa_version'))).toBe(false);
        expect(formQueries.some(({ sql: query }) => query.includes('funding_overview_version'))).toBe(false);
      }
    } finally {
      fakePool.clearQueryResponder();
    }

    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const contextQueries = routeQueries.filter(({ sql }) => (
      sql.includes('FROM iset_case c') && sql.includes('AS applicant_submission_user_id')
    ));
    expect(contextQueries[0].sql).toContain('NULL AS application_id');
    expect(contextQueries[0].sql).not.toContain('JOIN iset_application ');
    const messageInsert = routeQueries.find(({ sql }) => sql.includes('INSERT INTO messages'));
    expect(messageInsert?.params[3]).toBe(200);
    expect(messageInsert?.params[5]).toBeNull();
    const operationInsert = routeQueries.find(({ sql }) => (
      sql.includes('INSERT INTO message_send_operation')
    ));
    expect(operationInsert?.params[5]).toBeNull();
  });

  test('a populated unresolved participant link never routes a new message or form to the submission user', async () => {
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        const applicationScoped = normalizedSql.includes('JOIN iset_application a');
        expect(normalizedSql).toContain("NULLIF(TRIM(cl.applicant_cognito_sub), '') IS NOT NULL");
        expect(normalizedSql).toContain("NULLIF(TRIM(applicant_client_sub.cognito_sub), '') IS NOT NULL");
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: applicationScoped ? 123 : null,
          application_client_id: applicationScoped ? 1 : null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: applicationScoped ? 'approved' : null,
          application_lifecycle_status: applicationScoped ? 'active' : null,
          decision_outcome: applicationScoped ? 'approved' : null,
          submission_reference: applicationScoped ? 'APP-123' : null,
          applicant_submission_user_id: applicationScoped ? 901 : null,
          client_applicant_cognito_sub: 'current-participant-sub',
          applicant_client_sub_user_id: null,
          client_name: 'Current Case Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Historical Submission User',
          applicant_email: 'historical@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      return undefined;
    });

    try {
      for (const payload of [
        {
          subject: 'Ordinary case update',
          body: 'This must not be sent to a historical submission user.',
          toDisplayName: 'Current Case Participant',
          fromDisplayName: 'Case Worker',
          attachments: [],
        },
        {
          subject: 'Application form',
          body: 'This form must not be sent to a historical submission user.',
          toDisplayName: 'Current Case Participant',
          fromDisplayName: 'Case Worker',
          applicationId: 123,
          attachments: [{ workflow_id: 54 }],
        },
      ]) {
        const requestStart = fakePool.queries.length;
        const response = await requestJson(server, '/api/cases/76/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        expect(response).toEqual({
          status: 409,
          body: {
            error: 'applicant_account_link_unresolved',
            message: 'The participant account link cannot be resolved. Repair the PATH account link before sending a new message or form. Other casework remains available.',
          },
        });
        const requestQueries = fakePool.queries.slice(requestStart);
        expect(requestQueries.some(({ sql: query }) => query.includes('INSERT INTO messages'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('INSERT INTO message_item'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('INSERT INTO message_send_operation'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('INSERT INTO signing_request'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('INSERT INTO iset_document'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('cfa_version'))).toBe(false);
        expect(requestQueries.some(({ sql: query }) => query.includes('funding_overview_version'))).toBe(false);
      }
    } finally {
      fakePool.clearQueryResponder();
    }
  });

  test('an applicant relink races safely, then an exact retry and committed replay remain idempotent', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    let phase = 'race';
    let operation = null;
    fakePool.setQueryResponder(async (sql, params = []) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        const locked = normalizedSql.endsWith('FOR UPDATE');
        const applicantUserId = phase === 'race'
          ? (locked ? 201 : 200)
          : phase === 'stable'
            ? 201
            : 202;
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: null,
          application_client_id: null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          applicant_submission_user_id: null,
          applicant_client_sub_user_id: applicantUserId,
          applicant_name: 'Case Participant',
          applicant_email: 'case.participant@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM message_send_operation AS mso')) {
        return [operation ? [{ ...operation }] : [], []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_send_operation ')) {
        operation = {
          id: 9200,
          client_operation_id: params[0],
          request_sha256: params[1],
          sender_user_id: params[2],
          sender_staff_profile_id: params[3],
          case_id: params[4],
          application_id: params[5],
          message_id: null,
          response_status: null,
          response_json: null,
          completed_at: null,
        };
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('UPDATE message_send_operation ')) {
        operation = {
          ...operation,
          message_id: params[0],
          response_status: params[1],
          response_json: params[2],
          completed_at: '2026-08-25T12:00:00.000Z',
        };
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: 3300, affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    const send = overrides => requestJson(server, '/api/cases/76/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        subject: 'Race-safe case update',
        body: 'This message has one durable operation identity.',
        toDisplayName: 'Case Participant',
        fromDisplayName: 'Case Worker',
        applicationId: 123,
        actionPlanId: 444,
        interventionId: 555,
        expectedApplicationRowVersion: 9,
        clientOperationId: 'case-message-relink-001',
        attachments: [],
        ...overrides,
      }),
    });

    try {
      const raced = await send();
      expect(raced).toEqual({
        status: 409,
        body: {
          error: 'applicant_account_changed',
          message: 'The participant account changed before the message could be sent. Please reload and try again.',
          details: { retrySafe: true, manualReviewRequired: false },
          retrySafe: true,
          manualReviewRequired: false,
        },
      });
      const racedQueries = fakePool.queries.slice(beforeQueryCount);
      expect(racedQueries.some(({ sql: query }) => query.includes('INSERT INTO messages'))).toBe(false);
      expect(racedQueries.some(({ sql: query }) => query.includes('INSERT INTO message_item'))).toBe(false);
      expect(racedQueries.some(({ sql: query }) => query.includes('INSERT INTO signing_request'))).toBe(false);
      expect(racedQueries.some(({ sql: query }) => query.includes('cfa_version'))).toBe(false);
      expect(racedQueries.some(({ sql: query }) => query.includes('funding_overview_version'))).toBe(false);
      expect(racedQueries.some(({ sql: query }) => query.includes('INSERT INTO iset_document'))).toBe(false);
      expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
        'begin',
        'rollback',
        'release',
      ]);

      // The first claim was inside the rolled-back transaction.
      operation = null;
      phase = 'stable';
      const stableStart = fakePool.queries.length;
      const stable = await send();
      expect(stable).toEqual({
        status: 201,
        body: { message: 'Message sent', messageId: 3300, replyToMessageId: null },
      });

      phase = 'replay';
      const replayStart = fakePool.queries.length;
      const replayTransactionEventCount = fakePool.transactionEvents.length;
      const replayed = await send({
        applicationId: 999,
        actionPlanId: 777,
        interventionId: 888,
        expectedApplicationRowVersion: 44,
      });
      expect(replayed).toEqual(stable);

      const stableAndReplayQueries = fakePool.queries.slice(stableStart);
      expect(stableAndReplayQueries.filter(({ sql: query }) => query.includes('INSERT INTO messages')))
        .toHaveLength(1);
      expect(stableAndReplayQueries.filter(({ sql: query }) => query.includes('INSERT INTO message_item')))
        .toHaveLength(1);
      expect(stableAndReplayQueries.filter(({ sql: query }) => query.includes('INSERT INTO message_send_operation')))
        .toHaveLength(1);
      expect(stableAndReplayQueries.some(({ sql: query }) => query.includes('INSERT INTO signing_request')))
        .toBe(false);
      const replayQueries = fakePool.queries.slice(replayStart);
      expect(replayQueries.some(({ sql: query }) => query.includes('AS applicant_submission_user_id')))
        .toBe(false);
      expect(replayQueries.some(({ sql: query }) => (
        /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_send_operation|message_signing_request|signing_request|cfa_|funding_overview_|iset_document)/i.test(query)
      ))).toBe(false);
      expect(fakePool.transactionEvents).toHaveLength(replayTransactionEventCount);
    } finally {
      fakePool.clearQueryResponder();
    }
  });

  test('opening an applicationless historical attachment keeps its immutable applicant after account relink', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM messages') && normalizedSql.includes('WHERE id = ?')) {
        return [[{
          id: 4100,
          case_id: 76,
          application_id: null,
          sender_actor_type: 'applicant_user',
          sender_user_id: 700,
          sender_staff_profile_id: null,
          recipient_actor_type: 'staff_user',
          recipient_user_id: 300,
          recipient_staff_profile_id: 1,
          subject: 'Historical evidence',
          body: 'Attached before the account relink.',
          status: 'read',
          deleted: 0,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: null,
          application_client_id: null,
          applicant_submission_user_id: null,
          applicant_client_sub_user_id: 800,
          client_name: 'Current Linked Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (normalizedSql.includes('FROM message_attachment') && normalizedSql.includes('WHERE message_id = ?')) {
        return [[{
          id: 4200,
          message_id: 4100,
          case_id: 76,
          client_id: 501,
          file_path: 'uploads/historical-evidence.pdf',
          original_filename: 'historical-evidence.pdf',
          uploaded_at: '2026-08-01T12:00:00.000Z',
          user_id: 700,
          application_id: null,
        }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 4500, affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/admin/messages/4100/attachments?case_id=76');
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 200,
      body: [{
        id: 4200,
        message_id: 4100,
        user_id: 700,
      }],
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const documentUpsert = routeQueries.find(({ sql }) => sql.includes('INSERT INTO iset_document'));
    expect(documentUpsert?.params.slice(0, 7)).toEqual([76, null, null, 501, 700, 700, 4100]);
    expect(routeQueries.some(({ sql }) => (
      sql.includes('FROM user u') && sql.includes('JOIN client cl')
    ))).toBe(false);
  });

  test('an application-owned attachment remains readable but is excluded from applicationless document adoption', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM messages') && normalizedSql.includes('WHERE id = ?')) {
        return [[{
          id: 4300,
          case_id: 76,
          application_id: null,
          sender_actor_type: 'applicant_user',
          sender_user_id: 700,
          sender_staff_profile_id: null,
          recipient_actor_type: 'staff_user',
          recipient_user_id: 300,
          recipient_staff_profile_id: 1,
          subject: 'Mixed attachment lineage',
          body: 'One attachment has contradictory application ownership.',
          status: 'read',
          deleted: 0,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: null,
          application_client_id: null,
          applicant_submission_user_id: null,
          applicant_client_sub_user_id: 800,
          client_name: 'Current Linked Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (normalizedSql.includes('FROM message_attachment') && normalizedSql.includes('WHERE message_id = ?')) {
        return [[
          {
            id: 4301,
            message_id: 4300,
            case_id: 76,
            client_id: 501,
            file_path: 'uploads/applicationless.pdf',
            original_filename: 'applicationless.pdf',
            uploaded_at: '2026-08-01T12:00:00.000Z',
            user_id: 700,
            application_id: null,
          },
          {
            id: 4302,
            message_id: 4300,
            case_id: 76,
            client_id: 501,
            file_path: 'uploads/application-owned.pdf',
            original_filename: 'application-owned.pdf',
            uploaded_at: '2026-08-01T12:01:00.000Z',
            user_id: 700,
            application_id: 999,
          },
        ], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/admin/messages/4300/attachments?case_id=76');
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 200,
      body: [
        { id: 4301, application_id: null },
        { id: 4302, application_id: 999 },
      ],
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const documentMutations = routeQueries.filter(({ sql: query }) => (
      /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query)
    ));
    expect(documentMutations).toHaveLength(1);
    expect(documentMutations[0].sql).toContain('INSERT INTO iset_document');
    expect(documentMutations[0].params[8]).toBe('uploads/applicationless.pdf');
  });

  test('a legacy attachment with no application inherits its exact message application', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM messages') && normalizedSql.includes('WHERE id = ?')) {
        return [[{
          id: 4400,
          case_id: 76,
          application_id: 123,
          sender_actor_type: 'applicant_user',
          sender_user_id: 700,
          sender_staff_profile_id: null,
          recipient_actor_type: 'staff_user',
          recipient_user_id: 300,
          recipient_staff_profile_id: 1,
          subject: 'Legacy application attachment',
          body: 'The immutable message supplies the missing attachment application.',
          status: 'read',
          deleted: 0,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: 123,
          application_client_id: 501,
          applicant_submission_user_id: 700,
          applicant_client_sub_user_id: 800,
          client_name: 'Current Linked Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (normalizedSql.includes('FROM message_attachment') && normalizedSql.includes('WHERE message_id = ?')) {
        return [[{
          id: 4401,
          message_id: 4400,
          case_id: 76,
          client_id: 501,
          file_path: 'uploads/legacy-application.pdf',
          original_filename: 'legacy-application.pdf',
          uploaded_at: '2026-08-01T12:00:00.000Z',
          user_id: 700,
          application_id: null,
        }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_application WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 4501, affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/admin/messages/4400/attachments?case_id=76');
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 200,
      body: [{ id: 4401, message_id: 4400, application_id: null }],
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const documentUpsert = routeQueries.find(({ sql }) => sql.includes('INSERT INTO iset_document'));
    expect(documentUpsert?.params.slice(0, 7)).toEqual([76, 123, null, 501, 700, 700, 4400]);
  });

  test('attachment adoption blocks ownership collisions without treating sibling application indexes as download failures', async () => {
    let phase = 'hard-conflict';
    fakePool.setQueryResponder(async (sql, params = []) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM messages') && normalizedSql.includes('WHERE id = ?')) {
        const staffAuthored = phase === 'legacy-staff-relink';
        return [[{
          id: 4500,
          case_id: 76,
          application_id: 123,
          sender_actor_type: staffAuthored ? 'staff_profile' : 'applicant_user',
          sender_user_id: staffAuthored ? 300 : 700,
          sender_staff_profile_id: staffAuthored ? 1 : null,
          recipient_actor_type: staffAuthored ? 'applicant_user' : 'staff_user',
          recipient_user_id: staffAuthored ? 700 : 300,
          recipient_staff_profile_id: staffAuthored ? null : 1,
          subject: 'Existing document collision',
          body: 'Existing document ownership must remain immutable.',
          status: 'read',
          deleted: 0,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: 123,
          application_client_id: 501,
          applicant_submission_user_id: 700,
          applicant_client_sub_user_id: 800,
          client_name: 'Current Linked Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (normalizedSql.includes('FROM message_attachment') && normalizedSql.includes('WHERE message_id = ?')) {
        if (phase !== 'exact') {
          if (phase === 'legacy-applicant-relink' || phase === 'legacy-staff-relink') {
            const staffAuthored = phase === 'legacy-staff-relink';
            return [[{
              id: staffAuthored ? 4505 : 4504,
              message_id: 4500,
              case_id: 76,
              client_id: 501,
              file_path: staffAuthored
                ? 'uploads/legacy-staff-relink.pdf'
                : 'uploads/legacy-applicant-relink.pdf',
              original_filename: staffAuthored
                ? 'legacy-staff-relink.pdf'
                : 'legacy-applicant-relink.pdf',
              uploaded_at: '2026-08-01T12:03:00.000Z',
              user_id: staffAuthored ? 300 : 700,
              application_id: 123,
            }], []];
          }
          if (phase === 'index-failure') {
            return [[{
              id: 4506,
              message_id: 4500,
              case_id: 76,
              client_id: 501,
              file_path: 'uploads/index-unavailable.pdf',
              original_filename: 'index-unavailable.pdf',
              uploaded_at: '2026-08-01T12:04:00.000Z',
              user_id: 700,
              application_id: 123,
            }], []];
          }
          return [[
            {
              id: 4501,
              message_id: 4500,
              case_id: 76,
              client_id: 501,
              file_path: 'uploads/new-first.pdf',
              original_filename: 'new-first.pdf',
              uploaded_at: '2026-08-01T12:00:00.000Z',
              user_id: 700,
              application_id: null,
            },
            {
              id: 4502,
              message_id: 4500,
              case_id: 76,
              client_id: 501,
              file_path: 'uploads/sibling-existing.pdf',
              original_filename: 'sibling-existing.pdf',
              uploaded_at: '2026-08-01T12:01:00.000Z',
              user_id: 700,
              application_id: null,
            },
          ], []];
        }
        return [[{
          id: 4503,
          message_id: 4500,
          case_id: 76,
          client_id: 501,
          file_path: 'uploads/exact-existing.pdf',
          original_filename: 'exact-existing.pdf',
          uploaded_at: '2026-08-01T12:02:00.000Z',
          user_id: 700,
          application_id: null,
        }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_application WHERE id = ? LIMIT 1') {
        return [[{ client_id: 501 }], []];
      }
      if (normalizedSql.includes('FROM iset_document') && normalizedSql.includes('FOR UPDATE')) {
        if (params[0] === 'uploads/index-unavailable.pdf') {
          throw new Error('forced_document_index_unavailable');
        }
        if (params[0] === 'uploads/new-first.pdf') return [[], []];
        if (params[0] === 'uploads/sibling-existing.pdf') {
          return [[{
            id: 9500,
            case_id: 76,
            application_id: 999,
            client_id: phase === 'hard-conflict' ? 999 : 501,
            applicant_user_id: 700,
            user_id: 700,
            action_plan_id: null,
            origin_message_id: 4499,
            source: 'application_submission',
            file_path: 'uploads/sibling-existing.pdf',
          }], []];
        }
        if (params[0] === 'uploads/exact-existing.pdf') {
          return [[{
            id: 9501,
            case_id: 76,
            application_id: 123,
            client_id: 501,
            applicant_user_id: 700,
            user_id: 700,
            action_plan_id: 321,
            origin_message_id: 4498,
            source: 'application_submission',
            file_path: 'uploads/exact-existing.pdf',
          }], []];
        }
        if (
          params[0] === 'uploads/legacy-applicant-relink.pdf' ||
          params[0] === 'uploads/legacy-staff-relink.pdf'
        ) {
          const staffAuthored = params[0] === 'uploads/legacy-staff-relink.pdf';
          return [[{
            id: staffAuthored ? 9503 : 9502,
            case_id: 76,
            application_id: 123,
            client_id: 501,
            applicant_user_id: 800,
            user_id: staffAuthored ? 300 : 700,
            action_plan_id: null,
            origin_message_id: 4500,
            source: 'secure_message_attachment',
            file_path: params[0],
          }], []];
        }
      }
      if (/^(INSERT INTO|UPDATE) iset_document\b/i.test(normalizedSql)) {
        return [{ insertId: 9502, affectedRows: 1 }, []];
      }
      return undefined;
    });

    try {
      const conflictQueryStart = fakePool.queries.length;
      const conflictTransactionStart = fakePool.transactionEvents.length;
      const conflict = await requestJson(server, '/api/admin/messages/4500/attachments?case_id=76');
      expect(conflict).toEqual({
        status: 409,
        body: {
          error: 'attachment_document_scope_mismatch',
          attachment_id: 4502,
        },
      });
      const conflictQueries = fakePool.queries.slice(conflictQueryStart);
      expect(conflictQueries.some(({ sql: query }) => /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query))).toBe(false);
      expect(conflictQueries.some(({ sql: query }) => query.includes('INSERT INTO iset_event_entry'))).toBe(false);
      expect(fakePool.transactionEvents.slice(conflictTransactionStart)).toEqual([
        'begin',
        'rollback',
        'release',
      ]);

      phase = 'soft-conflict';
      const softQueryStart = fakePool.queries.length;
      const softTransactionStart = fakePool.transactionEvents.length;
      const soft = await requestJson(server, '/api/admin/messages/4500/attachments?case_id=76');
      expect(soft).toMatchObject({
        status: 200,
        body: [
          { id: 4501 },
          { id: 4502 },
        ],
      });
      const softQueries = fakePool.queries.slice(softQueryStart);
      const softDocumentMutations = softQueries.filter(({ sql: query }) => (
        /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query)
      ));
      expect(softDocumentMutations).toHaveLength(1);
      expect(softDocumentMutations[0].sql).toContain('INSERT INTO iset_document');
      expect(softDocumentMutations[0].params[8]).toBe('uploads/new-first.pdf');
      expect(fakePool.transactionEvents.slice(softTransactionStart)).toEqual([
        'begin',
        'commit',
        'release',
      ]);

      phase = 'exact';
      const exactQueryStart = fakePool.queries.length;
      const exactTransactionStart = fakePool.transactionEvents.length;
      const exact = await requestJson(server, '/api/admin/messages/4500/attachments?case_id=76');
      expect(exact).toMatchObject({
        status: 200,
        body: [{ id: 4503, application_id: null }],
      });
      const exactQueries = fakePool.queries.slice(exactQueryStart);
      expect(exactQueries.some(({ sql: query }) => /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query))).toBe(false);
      expect(fakePool.transactionEvents.slice(exactTransactionStart)).toEqual([
        'begin',
        'commit',
        'release',
      ]);

      for (const legacyPhase of ['legacy-applicant-relink', 'legacy-staff-relink']) {
        phase = legacyPhase;
        const legacyQueryStart = fakePool.queries.length;
        const legacyTransactionStart = fakePool.transactionEvents.length;
        const legacy = await requestJson(server, '/api/admin/messages/4500/attachments?case_id=76');
        expect(legacy).toMatchObject({
          status: 200,
          body: [{
            id: legacyPhase === 'legacy-staff-relink' ? 4505 : 4504,
            user_id: legacyPhase === 'legacy-staff-relink' ? 300 : 700,
          }],
        });
        const legacyQueries = fakePool.queries.slice(legacyQueryStart);
        expect(legacyQueries.some(({ sql: query }) => (
          /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query)
        ))).toBe(false);
        expect(legacyQueries.some(({ sql: query }) => query.includes('INSERT INTO iset_event_entry')))
          .toBe(false);
        expect(fakePool.transactionEvents.slice(legacyTransactionStart)).toEqual([
          'begin',
          'commit',
          'release',
        ]);
      }

      phase = 'index-failure';
      const unavailableQueryStart = fakePool.queries.length;
      const unavailableTransactionStart = fakePool.transactionEvents.length;
      const unavailable = await requestJson(server, '/api/admin/messages/4500/attachments?case_id=76');
      expect(unavailable).toMatchObject({
        status: 200,
        body: [{ id: 4506, file_path: 'uploads/index-unavailable.pdf' }],
      });
      const unavailableQueries = fakePool.queries.slice(unavailableQueryStart);
      expect(unavailableQueries.some(({ sql: query }) => (
        /^(\s*)(INSERT INTO|UPDATE) iset_document\b/i.test(query)
      ))).toBe(false);
      expect(unavailableQueries.some(({ sql: query }) => query.includes('INSERT INTO iset_event_entry')))
        .toBe(false);
      expect(fakePool.transactionEvents.slice(unavailableTransactionStart)).toEqual([
        'begin',
        'rollback',
        'release',
      ]);
    } finally {
      fakePool.clearQueryResponder();
    }
  });

  test('staff can reply to an applicationless historical applicant after the client account is relinked', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const replyTarget = {
      id: 4199,
      case_id: 76,
      application_id: null,
      sender_actor_type: 'applicant_user',
      sender_user_id: 700,
      sender_staff_profile_id: null,
      recipient_actor_type: 'staff_profile',
      recipient_user_id: 300,
      recipient_staff_profile_id: 1,
      subject: 'Historical question',
      body: 'This was sent before my account changed.',
      status: 'sent',
      deleted: 0,
    };
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id, case_id, application_id, sender_actor_type') &&
        normalizedSql.includes('FROM messages')
      ) {
        return [[{ ...replyTarget }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: null,
          application_client_id: null,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          applicant_submission_user_id: null,
          applicant_client_sub_user_id: 800,
          client_name: 'Current Linked Participant',
          client_email: 'current@example.invalid',
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: 4201, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('UPDATE messages SET status =')) {
        return [{ affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Re: Historical question',
          body: 'Here is the answer to your earlier question.',
          toDisplayName: 'Historical Applicant',
          fromDisplayName: 'Case Worker',
          replyTo: 4199,
          attachments: [],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 201,
      body: {
        message: 'Message sent',
        messageId: 4201,
        replyToMessageId: 4199,
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const insert = routeQueries.find(({ sql }) => sql.startsWith('INSERT INTO messages'));
    expect(insert?.params[3]).toBe(700);
    expect(insert?.params[5]).toBeNull();
    expect(routeQueries.some(({ sql, params }) => (
      sql.includes('UPDATE messages') &&
      sql.includes("SET status = 'replied'") &&
      Number(params?.[4]) === 700
    ))).toBe(true);
  });

  test('a historical reply cannot route any signing form to a superseded participant account', async () => {
    const replyTarget = {
      id: 4299,
      case_id: 76,
      application_id: 123,
      sender_actor_type: 'applicant_user',
      sender_user_id: 700,
      sender_staff_profile_id: null,
      recipient_actor_type: 'staff_profile',
      recipient_user_id: 300,
      recipient_staff_profile_id: 1,
      subject: 'Historical application question',
      body: 'This conversation belongs to the former PATH account.',
      status: 'sent',
      deleted: 0,
    };
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id, case_id, application_id, sender_actor_type') &&
        normalizedSql.includes('FROM messages')
      ) {
        return [[{ ...replyTarget }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: 123,
          application_client_id: 501,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          applicant_submission_user_id: 700,
          applicant_client_sub_user_id: 800,
          applicant_name: 'Current Linked Participant',
          applicant_email: 'current@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    try {
      for (const scenario of [
        { label: 'generic signing form', workflowId: 91 },
        { label: 'funding agreement', workflowId: 52 },
        { label: 'financial overview', workflowId: 54 },
      ]) {
        const queryStart = fakePool.queries.length;
        const transactionStart = fakePool.transactionEvents.length;
        const response = await requestJson(server, '/api/cases/76/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: `Historical reply with ${scenario.label}`,
            body: 'Please review the attached form.',
            toDisplayName: 'Historical Applicant',
            fromDisplayName: 'Case Worker',
            applicationId: 123,
            replyTo: 4299,
            attachments: [{ workflow_id: scenario.workflowId }],
          }),
        });
        expect(response).toEqual({
          status: 409,
          body: {
            error: 'signing_reply_participant_changed',
            message: 'This conversation belongs to a previous PATH account. Start a new message to send forms to the participant currently linked to the case.',
            details: { retrySafe: false, manualReviewRequired: false },
            retrySafe: false,
            manualReviewRequired: false,
          },
        });
        const routeQueries = fakePool.queries.slice(queryStart);
        expect(routeQueries.some(({ sql: query }) => (
          /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_send_operation|signing_request|message_signing_request|cfa_version|funding_overview_version|iset_document|iset_application)\b/i.test(query)
        ))).toBe(false);
        expect(routeQueries.some(({ sql: query }) => query.includes('FROM iset_intake.workflow')))
          .toBe(false);
        expect(fakePool.transactionEvents).toHaveLength(transactionStart);
      }
    } finally {
      fakePool.clearQueryResponder();
    }
  });

  test('the signing-reply participant guard is rechecked under the case lock', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionCount = fakePool.transactionEvents.length;
    const replyTarget = {
      id: 4399,
      case_id: 76,
      application_id: 123,
      sender_actor_type: 'applicant_user',
      sender_user_id: 700,
      sender_staff_profile_id: null,
      recipient_actor_type: 'staff_profile',
      recipient_user_id: 300,
      recipient_staff_profile_id: 1,
      subject: 'Application question',
      body: 'The participant link changes during this send.',
      status: 'sent',
      deleted: 0,
    };
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id, case_id, application_id, sender_actor_type') &&
        normalizedSql.includes('FROM messages')
      ) {
        return [[{ ...replyTarget }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        const applicantUserId = normalizedSql.endsWith('FOR UPDATE') ? 800 : 700;
        return [[{
          case_id: 76,
          client_id: 501,
          application_id: 123,
          application_client_id: 501,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          applicant_submission_user_id: 700,
          applicant_client_sub_user_id: applicantUserId,
          applicant_name: 'Case Participant',
          applicant_email: 'participant@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 501,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Reply with signing form',
          body: 'Please review the attached form.',
          toDisplayName: 'Case Participant',
          fromDisplayName: 'Case Worker',
          applicationId: 123,
          replyTo: 4399,
          attachments: [{ workflow_id: 91 }],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 409,
      body: { error: 'signing_reply_participant_changed' },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql: query }) => (
      /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_send_operation|signing_request|message_signing_request|cfa_version|funding_overview_version|iset_document|iset_application)\b/i.test(query)
    ))).toBe(false);
    expect(routeQueries.some(({ sql: query }) => query.includes('FROM iset_intake.workflow')))
      .toBe(false);
    expect(fakePool.transactionEvents.slice(beforeTransactionCount)).toEqual([
      'begin',
      'rollback',
      'release',
    ]);
  });

  test('a lost generic-message response replays one committed send and a fresh key permits a later intentional send', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const operations = new Map();
    let nextOperationId = 1;
    let nextMessageId = 3200;
    let messageInsertCount = 0;
    let messageItemInsertCount = 0;
    const replyTarget = {
      id: 3199,
      case_id: 76,
      application_id: 123,
      sender_actor_type: 'applicant_user',
      sender_user_id: 200,
      sender_staff_profile_id: null,
      recipient_actor_type: 'staff_profile',
      recipient_user_id: 300,
      recipient_staff_profile_id: 1,
      subject: 'Original applicant question',
      body: 'Can you confirm the appointment time?',
      status: 'sent',
      deleted: 0,
      created_at: '2026-08-25T11:00:00.000Z',
    };
    fakePool.setQueryResponder(async (sql, params = []) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id, case_id, application_id, sender_actor_type') &&
        normalizedSql.includes('FROM messages') &&
        Number(params[0]) === replyTarget.id
      ) {
        return [[{ ...replyTarget }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        const requestedApplicationId = params.map(Number).includes(124) ? 124 : 123;
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: requestedApplicationId,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: 'approved',
          application_lifecycle_status: 'active',
          decision_outcome: 'approved',
          submission_reference: `APP-${requestedApplicationId}`,
          applicant_submission_user_id: 200,
          applicant_submission_client_id: 1,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: params.map(Number).includes(124) ? 124 : 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_send_operation ')) {
        const [clientOperationId, requestSha256, senderUserId, senderStaffProfileId, caseId, applicationId] = params;
        const key = `${senderUserId}:${caseId}:${clientOperationId}`;
        if (!operations.has(key)) {
          operations.set(key, {
            id: nextOperationId++,
            client_operation_id: clientOperationId,
            request_sha256: requestSha256,
            sender_user_id: senderUserId,
            sender_staff_profile_id: senderStaffProfileId,
            case_id: caseId,
            application_id: applicationId,
            message_id: null,
            response_status: null,
            response_json: null,
            completed_at: null,
          });
        }
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.includes('FROM message_send_operation AS mso')) {
        const row = normalizedSql.includes('WHERE mso.id = ?')
          ? Array.from(operations.values()).find(candidate => candidate.id === Number(params[0]))
          : operations.get(`${params[0]}:${params[1]}:${params[2]}`);
        return [[row || null], []];
      }
      if (normalizedSql.startsWith('UPDATE message_send_operation ')) {
        const [messageId, responseStatus, responseJson, operationId] = params;
        const row = Array.from(operations.values()).find(candidate => candidate.id === Number(operationId));
        Object.assign(row, {
          message_id: messageId,
          response_status: responseStatus,
          response_json: responseJson,
          completed_at: '2026-08-25T12:00:00.000Z',
        });
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        messageInsertCount += 1;
        return [{ insertId: nextMessageId++, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_item ')) {
        messageItemInsertCount += 1;
        return [{ affectedRows: 2 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    const basePayload = {
      subject: 'Schedule update',
      body: 'Your appointment time has changed.',
      toDisplayName: 'Applicant One',
      fromDisplayName: 'Case Worker',
      applicationId: 123,
      attachments: [],
      replyTo: replyTarget.id,
      clientOperationId: 'generic-lost-response-0001',
    };
    let lostResponse;
    let replayResponse;
    let changedBodyResponse;
    let changedApplicationResponse;
    let intentionalResponse;
    try {
      // Treat the first 201 as a response the browser never received, then send
      // the exact frozen request again.
      lostResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(basePayload),
      });
      // The reply target is mutable state, unlike actor/case/application scope.
      // A committed retry must still replay after a later withdrawal/archive.
      replyTarget.status = 'archived';
      replyTarget.deleted = 1;
      replayResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(basePayload),
      });
      changedBodyResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...basePayload, body: 'A materially different message.' }),
      });
      changedApplicationResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...basePayload, applicationId: 124 }),
      });
      replyTarget.status = 'sent';
      replyTarget.deleted = 0;
      intentionalResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...basePayload,
          body: 'A materially different message.',
          clientOperationId: 'generic-intentional-send-0002',
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(lostResponse).toEqual({
      status: 201,
      body: { message: 'Message sent', messageId: 3200, replyToMessageId: 3199 },
    });
    expect(replayResponse).toEqual(lostResponse);
    expect(changedBodyResponse).toMatchObject({
      status: 409,
      body: { error: 'message_send_operation_payload_conflict' },
    });
    expect(changedApplicationResponse).toMatchObject({ status: 409 });
    expect(intentionalResponse).toEqual({
      status: 201,
      body: { message: 'Message sent', messageId: 3201, replyToMessageId: 3199 },
    });
    expect(messageInsertCount).toBe(2);
    expect(messageItemInsertCount).toBe(2);
    expect(operations.size).toBe(2);
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.filter(({ sql }) => String(sql).includes('INSERT INTO signing_request'))).toHaveLength(0);
  });

  test('attendance forms reject sibling and applicationless interventions before any route write', async () => {
    const scenarios = [
      {
        name: 'sibling application',
        proposalApplicationId: null,
        actionPlanApplicationId: 124,
        resolvedApplicationCaseId: 76,
        reviewWorkflowApplicationId: 124,
      },
      {
        name: 'applicationless Action Plan',
        proposalApplicationId: null,
        actionPlanApplicationId: null,
        resolvedApplicationCaseId: null,
        reviewWorkflowApplicationId: null,
      },
    ];

    for (const scenario of scenarios) {
      const beforeQueryCount = fakePool.queries.length;
      const beforeTransactionEventCount = fakePool.transactionEvents.length;
      fakePool.setQueryResponder(async sql => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (
          normalizedSql.includes('FROM iset_case c') &&
          normalizedSql.includes('AS applicant_submission_user_id')
        ) {
          return [[{
            case_id: 76,
            client_id: 1,
            application_id: 123,
            case_number: 'CASE-76',
            case_context_json: '{}',
            case_status: 'active',
            case_lifecycle_status: 'active',
            application_status: 'approved',
            application_lifecycle_status: 'active',
            decision_outcome: 'approved',
            submission_reference: 'APP-123',
            applicant_submission_user_id: 200,
            applicant_submission_client_id: 1,
            applicant_client_sub_user_id: 200,
            applicant_name: 'Applicant One',
            applicant_email: 'applicant.one@example.invalid',
          }], []];
        }
        if (
          normalizedSql.includes('FROM iset_case c') &&
          normalizedSql.includes('AS assigned_to_user_id')
        ) {
          return [[{
            id: 76,
            client_id: 1,
            application_id: 123,
            assigned_to_user_id: 1,
            assigned_staff_profile_id: 1,
            portfolio_region_id: 1,
            owner_region_id: 1,
          }], []];
        }
        if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
          return [[{ id: 300 }], []];
        }
        if (
          normalizedSql.includes('FROM iset_intake.workflow') &&
          normalizedSql.includes('WHERE id IN')
        ) {
          return [[{
            id: 54,
            name: 'Client Monthly Attendance Report',
            status: 'active',
            workflow_type: 'consent-cm-prefill',
            document_type: 'attendance_form',
          }], []];
        }
        if (
          normalizedSql.includes('FROM iset_case_intervention ci') &&
          normalizedSql.includes('WHERE ci.id = ?')
        ) {
          return [[{
            id: 777,
            case_id: 76,
            metadata_json: '{}',
            proposal_application_id: scenario.proposalApplicationId,
            action_plan_application_id: scenario.actionPlanApplicationId,
            resolved_application_case_id: scenario.resolvedApplicationCaseId,
            application_id:
              scenario.proposalApplicationId || scenario.actionPlanApplicationId || null,
            review_workflow_application_id: scenario.reviewWorkflowApplicationId,
          }], []];
        }
        return undefined;
      });

      let response;
      try {
        response = await requestJson(server, '/api/cases/76/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: 'Attendance report',
            body: 'Please complete the attached attendance report.',
            toDisplayName: 'Applicant One',
            fromDisplayName: 'Case Worker One',
            applicationId: 123,
            interventionId: 777,
            attachments: [{ workflow_id: 54 }],
          }),
        });
      } finally {
        fakePool.clearQueryResponder();
      }

      expect(response).toMatchObject({
        status: 422,
        body: {
          error: 'attendance_intervention_application_scope_conflict',
          retrySafe: false,
          manualReviewRequired: false,
          details: {
            interventionId: 777,
            applicationId: 123,
            retrySafe: false,
            manualReviewRequired: false,
          },
        },
      });
      const routeQueries = fakePool.queries.slice(beforeQueryCount);
      expect(routeQueries.some(({ sql }) => (
        /^\s*INSERT\s+INTO\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql) ||
        /^\s*(?:UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql)
      ))).toBe(false);
      expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
        'begin',
        'rollback',
        'release',
      ]);
    }
  });

  test('attendance intervention scope is rechecked under lock before any durable write', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: 123,
          application_client_id: 1,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: 'approved',
          application_lifecycle_status: 'active',
          decision_outcome: 'approved',
          submission_reference: 'APP-123',
          applicant_submission_user_id: 200,
          applicant_submission_client_id: 1,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (
        normalizedSql.includes('FROM iset_intake.workflow') &&
        normalizedSql.includes('WHERE id IN')
      ) {
        return [[{
          id: 54,
          name: 'Client Monthly Attendance Report',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'attendance_form',
        }], []];
      }
      if (normalizedSql.includes('FROM iset_application_assessment aa')) {
        return [[{
          id: 901,
          case_id: 76,
          application_id: 123,
          _assessment_source: 'application_assessment',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case_intervention ci') &&
        normalizedSql.includes('WHERE ci.id = ?')
      ) {
        const locked = normalizedSql.endsWith('FOR UPDATE');
        return [[{
          id: 777,
          case_id: 76,
          metadata_json: '{}',
          proposal_application_id: null,
          action_plan_application_id: locked ? 124 : 123,
          resolved_application_case_id: 76,
          application_id: locked ? 124 : 123,
          review_workflow_application_id: locked ? 124 : 123,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, client_id, status, lifecycle_status, decision_outcome, row_version') &&
        normalizedSql.includes('FROM iset_application') &&
        normalizedSql.endsWith('FOR UPDATE')
      ) {
        return [[{
          id: 123,
          client_id: 1,
          status: 'approved',
          lifecycle_status: 'active',
          decision_outcome: 'approved',
          row_version: 8,
        }], []];
      }
      if (
        normalizedSql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE'
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT client_id, status, lifecycle_status, case_context_json') &&
        normalizedSql.includes('FROM iset_case')
      ) {
        return [[{
          client_id: 1,
          status: 'active',
          lifecycle_status: 'active',
          case_context_json: '{}',
        }], []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Attendance report',
          body: 'Please complete the attached attendance report.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Case Worker One',
          applicationId: 123,
          interventionId: 777,
          expectedApplicationRowVersion: 8,
          attachments: [{ workflow_id: 54 }],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 422,
      body: {
        error: 'attendance_intervention_application_scope_conflict',
        retrySafe: false,
        manualReviewRequired: false,
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql, source }) => (
      source === 'connection' &&
      sql.includes('FROM iset_case_intervention ci') &&
      sql.includes('FOR UPDATE')
    ))).toBe(true);
    expect(routeQueries.some(({ sql }) => (
      /^\s*INSERT\s+INTO\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql) ||
      /^\s*(?:UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql)
    ))).toBe(false);
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
      'begin',
      'rollback',
      'release',
    ]);
  });

  test('refuses a malformed explicit intervention scope instead of switching an approval letter to the application operation', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: 123,
          application_client_id: 1,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: 'approved',
          application_lifecycle_status: 'active',
          decision_outcome: 'approved',
          submission_reference: 'APP-123',
          applicant_submission_user_id: 200,
          applicant_submission_client_id: 1,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('a.id AS application_id') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM iset_intake.workflow') && normalizedSql.includes('WHERE id IN')) {
        return [[{
          id: 91,
          name: 'Letter of Approval',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'assessment_approval_letter',
        }], []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Approval letter',
          body: 'Please review your approval letter.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Regional Manager One',
          applicationId: 123,
          interventionId: 0,
          attachments: [{ workflow_id: 91 }],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 400,
      body: { error: 'invalid_intervention_id' },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO signing_request'))).toBe(false);
  });

  test('rejects inactive, wrong-mode, and noncanonical funding workflows before route writes', async () => {
    const scenarios = [
      {
        workflow: {
          id: 51,
          name: 'General consent',
          status: 'draft',
          workflow_type: 'consent-no-prefill',
          document_type: 'general_consent',
        },
        error: 'signing_workflow_inactive',
      },
      {
        workflow: {
          id: 52,
          name: 'Client Funding Agreement',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'funding_agreement',
        },
        error: 'signing_workflow_mode_unsupported',
      },
      {
        workflow: {
          id: 53,
          name: 'EFT or Wire Transfer Form',
          status: 'active',
          workflow_type: 'consent-no-prefill',
          document_type: 'eft_or_wire_transfer_direct_deposit_form',
        },
        error: 'signing_workflow_document_type_unsupported',
      },
      {
        workflow: {
          id: 54,
          name: 'Financial Overview',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: null,
        },
        error: 'signing_workflow_document_type_unsupported',
      },
      {
        workflow: {
          id: 55,
          name: 'Client Funding Agreement',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'general_consent',
        },
        error: 'signing_workflow_document_type_unsupported',
      },
    ];

    for (const scenario of scenarios) {
      const beforeQueryCount = fakePool.queries.length;
      const beforeTransactionEventCount = fakePool.transactionEvents.length;
      fakePool.setQueryResponder(async sql => {
        const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
        if (
          normalizedSql.includes('FROM iset_case c') &&
          normalizedSql.includes('AS applicant_submission_user_id')
        ) {
          return [[{
            case_id: 76,
            client_id: 1,
            application_id: 123,
            case_number: 'CASE-76',
            case_context_json: '{}',
            case_status: 'active',
            case_lifecycle_status: 'active',
            application_status: 'approved',
            application_lifecycle_status: 'active',
            decision_outcome: 'approved',
            submission_reference: 'APP-123',
            applicant_submission_user_id: 200,
            applicant_submission_client_id: 1,
            applicant_client_sub_user_id: 200,
            applicant_name: 'Applicant One',
            applicant_email: 'applicant.one@example.invalid',
          }], []];
        }
        if (
          normalizedSql.includes('FROM iset_case c') &&
          normalizedSql.includes('AS assigned_to_user_id')
        ) {
          return [[{
            id: 76,
            client_id: 1,
            application_id: 123,
            assigned_to_user_id: 1,
            assigned_staff_profile_id: 1,
            portfolio_region_id: 1,
            owner_region_id: 1,
          }], []];
        }
        if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
          return [[{ id: 300 }], []];
        }
        if (
          normalizedSql.includes('FROM iset_intake.workflow') &&
          normalizedSql.includes('WHERE id IN')
        ) {
          return [[scenario.workflow], []];
        }
        return undefined;
      });

      let response;
      try {
        response = await requestJson(server, '/api/cases/76/messages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            subject: 'Signing form',
            body: 'Please complete the attached form.',
            toDisplayName: 'Applicant One',
            fromDisplayName: 'Regional Manager One',
            applicationId: 123,
            attachments: [{ workflow_id: scenario.workflow.id }],
          }),
        });
      } finally {
        fakePool.clearQueryResponder();
      }

      expect(response).toMatchObject({
        status: 422,
        body: { error: scenario.error },
      });
      const routeQueries = fakePool.queries.slice(beforeQueryCount);
      expect(routeQueries.some(({ sql }) => (
        /^\s*INSERT\s+INTO\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql) ||
        /^\s*(?:UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|message_signing_request|signing_request|cfa_|funding_overview_)/i.test(sql)
      ))).toBe(false);
      expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
        'begin',
        'rollback',
        'release',
      ]);
    }
  });

  test('refuses a manually selected funding form before final approval at the real route boundary', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async (sql) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: 123,
          application_client_id: 1,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'in_review',
          case_lifecycle_status: 'in_review',
          application_status: 'pending_approval',
          application_lifecycle_status: 'pending_decision',
          decision_outcome: null,
          submission_reference: 'APP-123',
          applicant_submission_user_id: 200,
          applicant_submission_client_id: 1,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant',
          applicant_email: 'applicant@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql.includes('FROM iset_intake.workflow') && normalizedSql.includes('WHERE id IN')) {
        return [[{
          id: 52,
          name: 'Client Funding Agreement',
          status: 'active',
          workflow_type: 'consent-cm-prefill',
          document_type: 'funding_agreement',
        }], []];
      }
      if (normalizedSql.includes('FROM iset_review_workflow')) {
        return [[{
          id: 56,
          application_id: 123,
          current_stage: 'rm_review',
          nwac_decision: null,
        }], []];
      }
      if (normalizedSql.includes('FROM iset_application_assessment aa')) {
        return [[{
          id: 10,
          case_id: 76,
          application_id: 123,
          intervention_cost_total: 500,
          proposed_interventions: JSON.stringify([{ costLines: [{ amount: 500 }] }]),
        }], []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Funding agreement',
          body: 'Please complete the attached agreement.',
          toDisplayName: 'Applicant',
          fromDisplayName: 'Regional Manager',
          applicationId: 123,
          attachments: [{ workflow_id: 52 }],
        }),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 422,
      body: {
        error: 'funding_forms_final_approval_required',
        message: 'Funding forms can only be sent after the Decision Maker records final approval.',
        details: { sourceType: 'application' },
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO signing_request'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('message_signing_request'))).toBe(false);
  });

  test('normal Regional Manager approval-letter send auto-resolves the exact plan and reuses its verified approval draft without touching applicationless history', async () => {
    const previousAuthIdentity = authIdentity;
    authIdentity = {
      subjectType: 'staff',
      sub: 'feedback-196-rm',
      email: 'feedback-196-rm@example.invalid',
      role: 'Regional Manager',
      staffProfileId: 1,
    };
    mockFullStackObjectState.checksum = null;
    mockFullStackObjectState.size = null;

    const fundedIntervention = {
      id: 900,
      status: 'approved',
      intervention_code: '110',
      start_date: '2026-09-01',
      end_date: '2026-12-31',
      intervention_cost: 500,
      budget_amount: 500,
      approved_amount: 500,
      related_noc: null,
      related_noc_version: null,
      funding_stream: 'EI',
      funding_stream_decision: 'EI',
      metadata_json: JSON.stringify({
        title: 'Training',
        costLines: [{ type: 'TuitionFeesDirect', amount: 500 }],
      }),
      esdc_intervention_json: '{}',
      notes: null,
      created_at: '2026-08-25T12:00:00.000Z',
    };
    const approvalLetterWorkflow = {
      id: 91,
      name: 'Letter of Approval',
      status: 'active',
      workflow_type: 'consent-no-prefill',
      document_type: 'assessment_approval_letter',
      updated_at: '2026-08-25T12:00:00.000Z',
    };
    const fundingAgreementWorkflow = {
      id: 52,
      name: 'Client Funding Agreement',
      status: 'active',
      workflow_type: 'consent-cm-prefill',
      document_type: 'funding_agreement',
      updated_at: '2026-08-25T12:00:00.000Z',
    };
    const eftWorkflow = {
      id: 43,
      name: 'EFT & Wire Transfer Direct Debit',
      status: 'draft',
      workflow_type: 'consent-no-prefill',
      document_type: 'EFT_form',
      updated_at: '2026-01-09T11:33:26.000Z',
    };
    const canonicalEftWorkflow = {
      id: 53,
      name: 'Canonical EFT',
      status: 'active',
      workflow_type: 'consent-no-prefill',
      document_type: 'eft_form',
      updated_at: '2026-08-25T12:00:00.000Z',
    };
    const assessmentRow = {
      id: 10,
      case_id: 76,
      application_id: 123,
      intervention_cost_total: 500,
      proposed_interventions: JSON.stringify([{
        code: '110',
        costLines: [{ type: 'TuitionFeesDirect', amount: 500 }],
        totalCost: 500,
      }]),
      _assessment_source: 'application_assessment',
    };
    const applicationlessFeedback196Version = {
      id: 196,
      series_id: 7,
      application_id: null,
      action_plan_id: null,
      version_number: 19,
      status: 'sent',
      metadata_json: JSON.stringify({
        case: { id: 76, caseNumber: 'CASE-76' },
        plan: { id: 3 },
        interventions: [{ id: 777, code: 'legacy', costTotal: 100 }],
      }),
      supersedes_version_id: null,
      created_at: '2026-08-24T12:00:00.000Z',
    };
    const signedSiblingBaseline = {
      id: 195,
      series_id: 7,
      case_id: 76,
      application_id: 999,
      action_plan_id: 900,
      version_number: 18,
      status: 'signed',
      signed_by_participant_id: 200,
      metadata_json: JSON.stringify({
        case: { id: 76, applicationId: 999, applicantUserId: 901 },
        client: { name: 'Applicant One' },
        plan: { id: 900, name: 'Earlier application plan' },
        interventions: [{ id: 899, code: '110', costTotal: 400 }],
        totalsByFundingStream: { EI: 400 },
      }),
      supersedes_version_id: null,
      created_at: '2026-08-23T12:00:00.000Z',
    };
    let approvalDraftVersion = null;
    const messageSendOperations = new Map();
    let nextMessageSendOperationId = 1;

    fakePool.setQueryResponder(async (sql, params) => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('AS applicant_submission_user_id')
      ) {
        return [[{
          case_id: 76,
          client_id: 1,
          application_id: 123,
          application_client_id: 1,
          case_number: 'CASE-76',
          case_context_json: '{}',
          case_status: 'active',
          case_lifecycle_status: 'active',
          application_status: 'approved',
          application_lifecycle_status: 'active',
          decision_outcome: 'approved',
          submission_reference: 'APP-123',
          applicant_submission_user_id: 200,
          applicant_submission_client_id: 1,
          applicant_client_sub_user_id: 200,
          applicant_name: 'Applicant One',
          applicant_email: 'applicant.one@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('sp.display_name') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          display_name: 'Regional Manager One',
          name: 'Regional Manager One',
          email: 'feedback-196-rm@example.invalid',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('a.id AS application_id') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          id: 76,
          client_id: 1,
          application_id: 123,
          assigned_to_user_id: 1,
          assigned_staff_profile_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('s.user_id AS submission_user_id') &&
        normalizedSql.includes('a.id AS application_id')
      ) {
        return [[{
          id: 76,
          case_number: 'CASE-76',
          application_id: 123,
          application_client_id: 1,
          client_id: 1,
          case_context_json: '{}',
          submission_user_id: 901,
          client_applicant_user_id: 200,
          reference_number: 'APP-123',
          intake_payload: JSON.stringify({
            'first-name': 'Applicant',
            'last-name': 'One',
          }),
        }], []];
      }
      if (normalizedSql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
        return [[{ id: 300 }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_case WHERE id = ? LIMIT 1') {
        return [[{ client_id: 1 }], []];
      }
      if (normalizedSql === 'SELECT client_id FROM iset_application WHERE id = ? LIMIT 1') {
        return [[{ client_id: 1 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT cl.id FROM user u') &&
        normalizedSql.includes('JOIN client cl')
      ) {
        return [[{ id: 1 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, name, status, workflow_type, document_type, updated_at') &&
        normalizedSql.includes('FROM iset_intake.workflow')
      ) {
        return [[fundingAgreementWorkflow, canonicalEftWorkflow, eftWorkflow], []];
      }
      if (normalizedSql.includes('FROM iset_intake.workflow') && normalizedSql.includes('WHERE id IN')) {
        const requestedWorkflowIds = new Set((params || []).map(Number));
        return [[approvalLetterWorkflow, fundingAgreementWorkflow, eftWorkflow, canonicalEftWorkflow]
          .filter(workflow => requestedWorkflowIds.has(workflow.id)), []];
      }
      if (normalizedSql.includes('FROM iset_review_workflow')) {
        return [[{
          id: 56,
          workflow_type: 'application_assessment',
          subject_key: 'application_assessment:123',
          application_id: 123,
          current_stage: 'final_decision_recorded',
          nwac_decision: 'approved',
          archived_at: null,
        }], []];
      }
      if (normalizedSql.includes('FROM iset_application_assessment aa')) {
        return [[assessmentRow], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, client_id, status, lifecycle_status, decision_outcome, row_version') &&
        normalizedSql.includes('FROM iset_application')
      ) {
        return [[{
          id: 123,
          client_id: 1,
          status: 'approved',
          lifecycle_status: 'active',
          decision_outcome: 'approved',
          row_version: 8,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT a.id, a.status, a.lifecycle_status') &&
        normalizedSql.includes('c.case_context_json') &&
        normalizedSql.includes('FROM iset_application a')
      ) {
        return [[{
          id: 123,
          status: 'approved',
          lifecycle_status: 'active',
          decision_outcome: 'approved',
          awaiting_reason: 'none',
          closure_reason: null,
          row_version: 8,
          case_context_json: '{}',
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id FROM iset_case') &&
        normalizedSql.includes('LIMIT 1 FOR UPDATE')
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT client_id, status, lifecycle_status, case_context_json') &&
        normalizedSql.includes('FROM iset_case')
      ) {
        return [[{ client_id: 1, status: 'active', lifecycle_status: 'active', case_context_json: '{}' }], []];
      }
      if (normalizedSql.includes('SELECT display_name, name FROM staff_profiles')) {
        return [[{ display_name: 'Regional Manager One', name: 'Regional Manager One' }], []];
      }
      if (
        normalizedSql.includes('SELECT id, case_id, application_id, status, archived_at') &&
        normalizedSql.includes('FROM iset_case_action_plan')
      ) {
        return [[{
          id: 184,
          case_id: 76,
          application_id: 123,
          status: 'active',
          archived_at: null,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, status FROM iset_case_action_plan') &&
        normalizedSql.includes('WHERE case_id = ?') &&
        normalizedSql.includes('AND application_id = ?')
      ) {
        return [[{ id: 184, status: 'active' }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, application_id, name, funding_stream') &&
        normalizedSql.includes('FROM iset_case_action_plan')
      ) {
        return [[{
          id: 184,
          application_id: 123,
          name: 'Application 123 plan',
          funding_stream: 'EI',
          agreement_number: 'CFA-123',
          effective_date: '2026-09-01',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case_intervention') &&
        normalizedSql.includes('WHERE action_plan_id = ?')
      ) {
        return [[fundedIntervention], []];
      }
      if (normalizedSql.includes('FROM cfa_series') && normalizedSql.includes('WHERE case_id = ?')) {
        return [[{ id: 7 }], []];
      }
      if (normalizedSql.includes('FROM cfa_version v') && normalizedSql.includes('WHERE v.series_id = ?')) {
        return [[
          approvalDraftVersion,
          applicationlessFeedback196Version,
          signedSiblingBaseline,
        ].filter(Boolean), []];
      }
      if (normalizedSql.startsWith('SELECT MAX(version_number) FROM cfa_version')) {
        return [[{ 'MAX(version_number)': 20 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO cfa_version ')) {
        return [{ insertId: 200, affectedRows: 1 }, []];
      }
      if (
        normalizedSql.startsWith('SELECT series_id, version_number FROM cfa_version') &&
        normalizedSql.includes('WHERE id = ?')
      ) {
        return [[{ series_id: 7, version_number: 20 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id FROM cfa_version') &&
        normalizedSql.includes("status = 'signed'")
      ) {
        return [[], []];
      }
      if (normalizedSql.startsWith('SELECT label FROM esdc_intervention_code')) {
        return [[{ label: 'Skills Training' }], []];
      }
      if (normalizedSql.startsWith('SELECT code, label FROM esdc_intervention_code')) {
        return [[{ code: 110, label: 'Skills Training' }], []];
      }
      if (normalizedSql.includes('FROM payment_packet_line ppl')) {
        return [[], []];
      }
      if (normalizedSql.includes('FROM iset_runtime_config')) {
        return [[], []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 501, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO cfa_version_documents ')) {
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('SELECT s.intake_payload FROM iset_application a')) {
        return [[{
          intake_payload: JSON.stringify({
            'first-name': 'Applicant',
            'last-name': 'One',
          }),
        }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_send_operation ')) {
        const [
          clientOperationId,
          requestSha256,
          senderUserId,
          senderStaffProfileId,
          operationCaseId,
          operationApplicationId,
        ] = params;
        const key = `${senderUserId}:${operationCaseId}:${clientOperationId}`;
        if (!messageSendOperations.has(key)) {
          messageSendOperations.set(key, {
            id: nextMessageSendOperationId++,
            client_operation_id: clientOperationId,
            request_sha256: requestSha256,
            sender_user_id: senderUserId,
            sender_staff_profile_id: senderStaffProfileId,
            case_id: operationCaseId,
            application_id: operationApplicationId,
            message_id: null,
            response_status: null,
            response_json: null,
            completed_at: null,
          });
        }
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.includes('FROM message_send_operation AS mso')) {
        const operation = normalizedSql.includes('WHERE mso.id = ?')
          ? Array.from(messageSendOperations.values()).find(row => row.id === Number(params[0]))
          : messageSendOperations.get(`${params[0]}:${params[1]}:${params[2]}`);
        return [[operation || null], []];
      }
      if (normalizedSql.startsWith('UPDATE message_send_operation ')) {
        const [messageId, responseStatus, responseJson, operationId] = params;
        const operation = Array.from(messageSendOperations.values())
          .find(row => row.id === Number(operationId));
        Object.assign(operation, {
          message_id: messageId,
          response_status: responseStatus,
          response_json: responseJson,
          completed_at: '2026-08-25T12:05:00.000Z',
        });
        return [{ affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO messages ')) {
        return [{ insertId: 3000, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_item ')) {
        return [{ affectedRows: 2 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO signing_request ')) {
        return [{ insertId: 4000, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO message_signing_request ')) {
        return [{ affectedRows: 1 }, []];
      }
      if (
        normalizedSql.startsWith('UPDATE cfa_version') &&
        normalizedSql.includes("SET status = 'sent'")
      ) {
        return [{ affectedRows: 1 }, []];
      }
      if (
        normalizedSql.startsWith('SELECT status, docs_requested_active') &&
        normalizedSql.includes('FROM iset_application')
      ) {
        return [[{
          status: 'approved',
          docs_requested_active: 1,
          docs_requested_at: '2026-08-25T12:00:00.000Z',
          docs_requested_cleared_at: null,
          docs_requested_source: 'secure_message',
        }], []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    const approvalPlanSnapshot = await buildCfaSnapshot({
      connection: fakePool,
      caseId: 76,
      actionPlanId: 184,
    });
    expect(approvalPlanSnapshot.case.applicantUserId).toBe(200);
    expect(approvalPlanSnapshot.case.applicantUserId).not.toBe(901);
    const approvalStoredSnapshot = {
      ...approvalPlanSnapshot,
      case: {
        ...approvalPlanSnapshot.case,
        assignedStaffProfileId: 1,
        caseManagerName: 'Regional Manager One',
      },
    };
    approvalDraftVersion = {
      id: 197,
      series_id: 7,
      application_id: 123,
      action_plan_id: 184,
      version_number: 20,
      status: 'draft',
      metadata_json: JSON.stringify(approvalStoredSnapshot),
      snapshot_hash: computeCfaSnapshotSignature(approvalStoredSnapshot).hash,
      supersedes_version_id: 195,
      created_at: '2026-08-25T12:00:00.000Z',
    };
    const beforeRequestQueryCount = fakePool.queries.length;
    const approvalSendPayload = {
      subject: 'Letter of Approval',
      body: 'Please review your approval letter and complete the attached funding forms.',
      toDisplayName: 'Applicant One',
      fromDisplayName: 'Regional Manager One',
      applicationId: 123,
      expectedApplicationRowVersion: 8,
      attachments: [{ workflow_id: 91 }, { workflow_id: 43 }],
      clientOperationId: 'approval-letter-lost-response-0001',
    };

    let response;
    let replayResponse;
    let staleDraftResponse;
    let baselineConflictResponse;
    let firstRequestEndQueryCount;
    let replayRequestEndQueryCount;
    let staleDraftRequestStartQueryCount;
    let baselineConflictRequestStartQueryCount;
    try {
      response = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(approvalSendPayload),
      });
      firstRequestEndQueryCount = fakePool.queries.length;
      // Treat the committed 201 above as a response lost in transit. The
      // direct caller retries the exact frozen operation and must get the
      // original response without repeating any package or decision write.
      replayResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(approvalSendPayload),
      });
      replayRequestEndQueryCount = fakePool.queries.length;

      const staleStoredSnapshot = {
        ...approvalStoredSnapshot,
        plan: {
          ...approvalStoredSnapshot.plan,
          name: 'Stale approval-time plan title',
        },
      };
      approvalDraftVersion.metadata_json = JSON.stringify(staleStoredSnapshot);
      approvalDraftVersion.snapshot_hash = computeCfaSnapshotSignature(staleStoredSnapshot).hash;
      staleDraftRequestStartQueryCount = fakePool.queries.length;
      staleDraftResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Funding agreement after plan update',
          body: 'Please review and sign the updated agreement.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Regional Manager One',
          applicationId: 123,
          attachments: [{ workflow_id: 52 }],
        }),
      });

      signedSiblingBaseline.signed_by_participant_id = 901;
      signedSiblingBaseline.metadata_json = JSON.stringify({
        case: { id: 76, applicationId: 999, applicantUserId: 901 },
        client: { name: 'Former submitter' },
        plan: { id: 900, name: 'Earlier application plan' },
        interventions: [{ id: 899, code: '110', costTotal: 400 }],
        totalsByFundingStream: { EI: 400 },
      });
      baselineConflictRequestStartQueryCount = fakePool.queries.length;
      baselineConflictResponse = await requestJson(server, '/api/cases/76/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subject: 'Funding agreement with unsafe history',
          body: 'Please review and sign the agreement.',
          toDisplayName: 'Applicant One',
          fromDisplayName: 'Regional Manager One',
          applicationId: 123,
          attachments: [{ workflow_id: 52 }],
          clientOperationId: 'unsafe-cfa-baseline-0001',
        }),
      });
    } finally {
      authIdentity = previousAuthIdentity;
      fakePool.clearQueryResponder();
    }

    expect(response).toMatchObject({
      status: 201,
      body: {
        message: 'Message sent',
        messageId: 3000,
        replyToMessageId: null,
        decisionLetterPersistence: {
          updated: true,
          letterKey: 'approval',
          applicationRowVersion: 9,
        },
      },
    });
    expect(replayResponse).toEqual(response);
    const routeQueries = fakePool.queries.slice(
      beforeRequestQueryCount,
      firstRequestEndQueryCount
    );
    const firstAndReplayQueries = fakePool.queries.slice(
      beforeRequestQueryCount,
      replayRequestEndQueryCount
    );
    const replayQueries = fakePool.queries.slice(
      firstRequestEndQueryCount,
      replayRequestEndQueryCount
    );
    const operationClaimIndex = routeQueries.findIndex(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO message_send_operation ')
    ));
    const workflowPreflightIndex = routeQueries.findIndex(({ sql }) => (
      String(sql).includes('FROM iset_intake.workflow') && String(sql).includes('WHERE id IN')
    ));
    expect(operationClaimIndex).toBeGreaterThanOrEqual(0);
    expect(workflowPreflightIndex).toBeGreaterThan(operationClaimIndex);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO messages ')
    ))).toHaveLength(1);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO message_item ')
    ))).toHaveLength(1);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO signing_request ')
    ))).toHaveLength(3);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO message_signing_request ')
    ))).toHaveLength(3);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('UPDATE cfa_version') &&
      String(sql).includes("status = 'sent'")
    ))).toHaveLength(1);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith(
        'UPDATE iset_case SET case_context_json = ?'
      )
    ))).toHaveLength(1);
    expect(firstAndReplayQueries.filter(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith(
        'UPDATE iset_application SET row_version = row_version + 1'
      )
    ))).toHaveLength(1);
    expect(replayQueries.some(({ sql }) => (
      /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:message_send_operation|messages|message_item|signing_request|message_signing_request|cfa_[a-z_]+|iset_document|iset_case|iset_application)\b/i
        .test(String(sql).replace(/\s+/g, ' ').trim())
    ))).toBe(false);
    expect(messageSendOperations.size).toBe(2);
    expect(Array.from(messageSendOperations.values()).filter(
      operation => operation.completed_at
    )).toHaveLength(1);
    const insertedVersion = routeQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO cfa_version ')
    ));
    expect(insertedVersion).toBeUndefined();

    const sentVersion = routeQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('UPDATE cfa_version') &&
      String(sql).includes("status = 'sent'")
    ));
    expect(sentVersion?.params).toEqual([1, 197]);
    expect(routeQueries.some(({ sql, params }) => (
      String(sql).startsWith('UPDATE cfa_version') &&
      params.includes(196)
    ))).toBe(false);
    expect(routeQueries.some(({ sql }) => (
      String(sql).includes('INSERT INTO cfa_version_documents')
    ))).toBe(false);
    expect(routeQueries.some(({ sql }) => (
      String(sql).includes('INSERT INTO iset_document')
    ))).toBe(true);
    expect(routeQueries.some(({ sql }) => (
      String(sql).includes('snapshot_hash') && /^UPDATE\b/i.test(String(sql).trim())
    ))).toBe(false);

    const signingInsert = routeQueries.find(({ sql, params }) => {
      if (!sql.includes('INSERT INTO signing_request')) return false;
      try {
        return JSON.parse(params.at(-1))?.meta?.cfaVersionId === 197;
      } catch (_) {
        return false;
      }
    });
    expect(signingInsert).toBeTruthy();
    expect(signingInsert.params[4]).toBe(200);
    const resolvedSchema = JSON.parse(signingInsert.params.at(-1));
    expect(resolvedSchema.meta).toMatchObject({
      cfaVersionId: 197,
      cfaVersionNumber: 20,
      cfaSeriesId: 7,
      cfaActionPlanId: 184,
      cfaRenderVariant: 'redline',
    });
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO messages'))).toBe(true);
    expect(routeQueries.some(({ sql }) => sql.includes('INSERT INTO message_signing_request'))).toBe(true);
    const legacyEftSigningInsert = routeQueries.find(({ sql, params }) => (
      String(sql).includes('INSERT INTO signing_request') &&
      Number(params?.[0]) === 43
    ));
    expect(legacyEftSigningInsert?.params?.[7]).toBe('EFT_form');
    expect(routeQueries.some(({ sql, params }) => (
      String(sql).includes('INSERT INTO signing_request') &&
      Number(params?.[0]) === 53
    ))).toBe(false);
    expect(routeQueries.some(({ sql }) => (
      sql.includes('FROM cfa_version v') && sql.includes('v.application_id')
    ))).toBe(true);
    expect(routeQueries.some(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith(
        'SELECT id, status FROM iset_case_action_plan'
      )
    ))).toBe(true);
    const staffMessageEventInsert = routeQueries.find(({ sql }) => (
      String(sql).includes('INSERT INTO iset_event_entry')
    ));
    const staffMessageEventPayload = staffMessageEventInsert?.params
      .map(value => {
        if (typeof value !== 'string' || !value.includes('"message_id":3000')) return null;
        try { return JSON.parse(value); } catch (_) { return null; }
      })
      .find(Boolean);
    expect(staffMessageEventPayload).toMatchObject({
      message_id: 3000,
      application_id: 123,
      action_plan_id: 184,
      intervention_id: null,
    });

    expect(staleDraftResponse).toEqual({
      status: 201,
      body: {
        message: 'Message sent',
        messageId: 3000,
        replyToMessageId: null,
      },
    });
    const staleDraftQueries = fakePool.queries.slice(staleDraftRequestStartQueryCount);
    const replacementInsert = staleDraftQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO cfa_version ')
    ));
    expect(replacementInsert?.params.slice(0, 4)).toEqual([7, 123, 184, 21]);
    const staleWithdrawal = staleDraftQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith(
        "UPDATE cfa_version SET status = 'withdrawn'"
      )
    ));
    expect(staleWithdrawal?.params).toEqual([197]);
    expect(staleDraftQueries.some(({ sql }) => (
      String(sql).includes('SET supersedes_version_id')
    ))).toBe(false);
    expect(staleDraftQueries.some(({ sql, params }) => (
      /^(UPDATE|DELETE)\b/i.test(String(sql).trim()) && params.includes(196)
    ))).toBe(false);
    const replacementSigningInsert = staleDraftQueries.find(({ sql }) => (
      String(sql).includes('INSERT INTO signing_request')
    ));
    expect(JSON.parse(replacementSigningInsert.params.at(-1)).meta).toMatchObject({
      cfaVersionId: 200,
      cfaVersionNumber: 21,
      cfaSeriesId: 7,
      cfaActionPlanId: 184,
      cfaRenderVariant: 'redline',
    });
    expect(baselineConflictResponse).toMatchObject({
      status: 409,
      body: {
        error: 'signing_lineage_repair_required',
        details: {
          retrySafe: false,
          manualReviewRequired: true,
        },
      },
    });
    const baselineConflictQueries = fakePool.queries.slice(
      baselineConflictRequestStartQueryCount
    );
    expect(baselineConflictQueries.some(({ sql }) => (
      /^(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:messages|message_item|signing_request|message_signing_request|cfa_version|cfa_version_documents|iset_document|iset_case|iset_application)\b/i
        .test(String(sql).replace(/\s+/g, ' ').trim())
    ))).toBe(false);
  });

  test('draft Action Plan deletion returns an archive instruction before the physical delete when typed CFA evidence exists', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 76 }], []];
      }
      if (normalizedSql === 'SELECT id FROM iset_case_action_plan WHERE id = ? AND case_id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 184 }], []];
      }
      if (normalizedSql.includes('FROM iset_case_action_plan ap')) {
        return [[{
          id: 184,
          case_id: 76,
          application_id: 123,
          status: 'draft',
          assigned_staff_profile_id: 1,
          assigned_to_user_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, version_number, status FROM cfa_version') &&
        normalizedSql.includes('WHERE action_plan_id = ?')
      ) {
        return [[{ id: 197, version_number: 20, status: 'draft' }], []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/action-plans/184/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'retained_cfa_evidence_blocks_plan_delete',
        message: 'This Action Plan has retained Client Funding Agreement evidence and cannot be deleted. Archive the Action Plan instead.',
        cfaVersion: { id: 197, versionNumber: 20, status: 'draft' },
      },
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql, params }) => (
      String(sql).includes('WHERE action_plan_id = ?') && params[0] === 184
    ))).toBe(true);
    expect(routeQueries.some(({ sql }) => (
      /^DELETE FROM iset_case_action_plan\b/i.test(String(sql).trim())
    ))).toBe(false);
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
      'begin',
      'rollback',
      'release',
    ]);
  });

  test('Action Plan deletion rolls back and returns the archive instruction when a restrictive CFA FK wins a race', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    let cfaEvidenceReadCount = 0;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 76 }], []];
      }
      if (normalizedSql === 'SELECT id FROM iset_case_action_plan WHERE id = ? AND case_id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 184 }], []];
      }
      if (normalizedSql.includes('FROM iset_case_action_plan ap')) {
        return [[{
          id: 184,
          case_id: 76,
          application_id: 123,
          status: 'draft',
          assigned_staff_profile_id: 1,
          assigned_to_user_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, version_number, status FROM cfa_version') &&
        normalizedSql.includes('WHERE action_plan_id = ?')
      ) {
        cfaEvidenceReadCount += 1;
        return cfaEvidenceReadCount === 1
          ? [[], []]
          : [[{ id: 198, version_number: 21, status: 'draft' }], []];
      }
      if (normalizedSql.startsWith('SELECT id, action_plan_id, intervention_code')) {
        return [[], []];
      }
      if (normalizedSql.startsWith('DELETE FROM iset_case_action_plan')) {
        const error = new Error('Cannot delete or update a parent row');
        error.code = 'ER_ROW_IS_REFERENCED_2';
        error.errno = 1451;
        throw error;
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/action-plans/184/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'retained_cfa_evidence_blocks_plan_delete',
        message: 'This Action Plan has retained Client Funding Agreement evidence and cannot be deleted. Archive the Action Plan instead.',
        cfaVersion: { id: 198, versionNumber: 21, status: 'draft' },
      },
    });
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
      'begin',
      'rollback',
      'release',
    ]);
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.filter(({ sql }) => (
      String(sql).includes('FROM cfa_version') && String(sql).includes('WHERE action_plan_id = ?')
    ))).toHaveLength(2);
  });

  test('draft Action Plan deletion keeps ILMP invalidation, delete, and status recompute in one committed transaction', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const beforeTransactionEventCount = fakePool.transactionEvents.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (normalizedSql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 76 }], []];
      }
      if (normalizedSql === 'SELECT id FROM iset_case_action_plan WHERE id = ? AND case_id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 184 }], []];
      }
      if (normalizedSql.includes('FROM iset_case_action_plan ap')) {
        return [[{
          id: 184,
          case_id: 76,
          application_id: 123,
          status: 'draft',
          assigned_staff_profile_id: 1,
          assigned_to_user_id: 1,
          portfolio_region_id: 1,
          owner_region_id: 1,
        }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id, version_number, status FROM cfa_version') &&
        normalizedSql.includes('WHERE action_plan_id = ?')
      ) {
        return [[], []];
      }
      if (normalizedSql.startsWith('SELECT id, action_plan_id, intervention_code')) {
        return [[], []];
      }
      if (normalizedSql.startsWith('DELETE FROM iset_case_action_plan')) {
        return [{ affectedRows: 1 }, []];
      }
      if (/^(INSERT|UPDATE|DELETE)\b/i.test(normalizedSql)) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let response;
    try {
      response = await requestJson(server, '/api/action-plans/184/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(response).toEqual({
      status: 200,
      body: { success: true, deleted: true, id: 184 },
    });
    expect(fakePool.transactionEvents.slice(beforeTransactionEventCount)).toEqual([
      'begin',
      'commit',
      'release',
    ]);
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const transactionalQueries = routeQueries.filter(({ source }) => source === 'connection');
    expect(transactionalQueries.some(({ sql }) => (
      String(sql).includes('UPDATE esdc_participant_submission')
    ))).toBe(true);
    expect(transactionalQueries.some(({ sql }) => (
      String(sql).includes('UPDATE iset_case_intervention')
    ))).toBe(true);
    expect(transactionalQueries.some(({ sql }) => (
      String(sql).trim().startsWith('DELETE FROM iset_case_action_plan')
    ))).toBe(true);
    expect(transactionalQueries.some(({ sql }) => (
      String(sql).includes('SELECT c.id') && String(sql).includes('FROM iset_case c')
    ))).toBe(true);
    expect(routeQueries.filter(({ sql }) => (
      String(sql).includes('FROM iset_case_action_plan ap')
    )).map(({ source }) => source)).toEqual(['pool', 'connection']);
  });

  test('Funding Overview creation mutates only the exact application when legacy and sibling versions exist', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const legacyApplicationlessVersion = {
      id: 901,
      series_id: 9,
      application_id: null,
      version_number: 18,
      status: 'sent',
      metadata_json: JSON.stringify({
        case: { caseId: 76, applicationId: null },
      }),
      supersedes_version_id: null,
      created_at: '2026-08-23T12:00:00.000Z',
    };
    const siblingApplicationVersion = {
      id: 902,
      series_id: 9,
      case_id: 76,
      application_id: 999,
      version_number: 19,
      status: 'signed',
      signed_by_participant_id: 200,
      metadata_json: JSON.stringify({
        case: { caseId: 76, applicationId: 999, applicantUserId: 200 },
        fields: {
          income_employment: '1000',
          expenses_rent: '600',
        },
      }),
      supersedes_version_id: null,
      created_at: '2026-08-24T12:00:00.000Z',
    };

    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id FROM iset_case') &&
        normalizedSql.includes('LIMIT 1 FOR UPDATE')
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.includes('SELECT c.id AS case_id') &&
        normalizedSql.includes('FROM iset_case c')
      ) {
        return [[{
          case_id: 76,
          case_number: 'CASE-76',
          client_id: 1,
          assigned_staff_profile_id: 54,
          case_context_json: '{}',
          client_first_name: 'Applicant',
          client_last_name: 'One',
          application_id: 123,
          application_client_id: 1,
          application_created_at: '2026-08-20T12:00:00.000Z',
          submission_id: 44,
          reference_number: 'APP-123',
          submission_user_id: 901,
          client_applicant_user_id: 200,
          applicant_email: 'applicant.one@example.invalid',
          applicant_name: 'Applicant One',
        }], []];
      }
      if (normalizedSql === 'SELECT * FROM iset_application WHERE id = ?') {
        return [[{
          id: 123,
          case_id: 76,
          submission_id: 44,
          created_at: '2026-08-20T12:00:00.000Z',
          payload_json: JSON.stringify({
            answers: {
              'income-employment': '1200',
              'expenses-rent': '600',
            },
          }),
        }], []];
      }
      if (normalizedSql.includes('FROM funding_overview_series')) {
        return [[{ id: 9 }], []];
      }
      if (
        normalizedSql.includes('FROM funding_overview_version v') &&
        normalizedSql.includes('WHERE v.series_id = ?')
      ) {
        return [[siblingApplicationVersion, legacyApplicationlessVersion], []];
      }
      if (normalizedSql.startsWith('SELECT MAX(version_number) FROM funding_overview_version')) {
        return [[{ 'MAX(version_number)': 19 }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO funding_overview_version ')) {
        return [{ insertId: 903, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 904, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO funding_overview_version_documents ')) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let created;
    try {
      created = await createFundingOverviewVersion({
        caseId: 76,
        applicationId: 123,
        actorUserId: 300,
        staffProfileId: 54,
        preparedByName: 'Regional Manager One',
        sourceAnswersOverride: {
          'income-employment': '1200',
          'expenses-rent': '600',
        },
        connection: fakePool,
        uploadedObjectKeys: [],
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(created).toMatchObject({
      fundingOverviewVersionId: 903,
      versionNumber: 20,
      seriesId: 9,
      supersedesVersionId: 902,
    });
    expect(created.snapshot?.case?.applicantUserId).toBe(200);
    expect(created.snapshot?.case?.applicantUserId).not.toBe(901);
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const versionInsert = routeQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO funding_overview_version ')
    ));
    expect(versionInsert?.params.slice(0, 3)).toEqual([9, 123, 20]);
    expect(versionInsert?.params[3]).toBe(902);
    const documentInsert = routeQueries.find(({ sql }) => sql.includes('INSERT INTO iset_document'));
    expect(documentInsert?.params.slice(0, 3)).toEqual([76, 123, null]);
    expect(documentInsert?.params[4]).toBe(200);
    expect(routeQueries.some(({ sql }) => sql.includes('UPDATE funding_overview_version'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('UPDATE signing_request'))).toBe(false);
    expect(routeQueries.some(({ params }) => (
      params.includes(901) || params.includes('901')
    ))).toBe(false);
  });

  test('Funding Overview refuses a latest signed stale-S baseline before any product write', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id FROM iset_case') &&
        normalizedSql.includes('LIMIT 1 FOR UPDATE')
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.includes('SELECT c.id AS case_id') &&
        normalizedSql.includes('FROM iset_case c')
      ) {
        return [[{
          case_id: 76,
          case_number: 'CASE-76',
          client_id: 1,
          assigned_staff_profile_id: 54,
          case_context_json: '{}',
          client_first_name: 'Applicant',
          client_last_name: 'One',
          application_id: 123,
          application_client_id: 1,
          application_created_at: '2026-08-20T12:00:00.000Z',
          submission_id: 44,
          reference_number: 'APP-123',
          submission_user_id: 901,
          client_applicant_user_id: 200,
          applicant_email: 'applicant.one@example.invalid',
          applicant_name: 'Applicant One',
        }], []];
      }
      if (normalizedSql === 'SELECT * FROM iset_application WHERE id = ?') {
        return [[{
          id: 123,
          case_id: 76,
          submission_id: 44,
          created_at: '2026-08-20T12:00:00.000Z',
          payload_json: JSON.stringify({ answers: {} }),
        }], []];
      }
      if (normalizedSql.includes('FROM funding_overview_series')) {
        return [[{ id: 9 }], []];
      }
      if (
        normalizedSql.includes('FROM funding_overview_version v') &&
        normalizedSql.includes('WHERE v.series_id = ?')
      ) {
        return [[{
          id: 902,
          series_id: 9,
          case_id: 76,
          application_id: 999,
          version_number: 19,
          status: 'signed',
          signed_by_participant_id: 901,
          metadata_json: JSON.stringify({
            case: { caseId: 76, applicationId: 999, applicantUserId: 901 },
            fields: { income_employment: '1000' },
          }),
          supersedes_version_id: null,
        }], []];
      }
      return undefined;
    });

    try {
      await expect(createFundingOverviewVersion({
        caseId: 76,
        applicationId: 123,
        actorUserId: 300,
        staffProfileId: 54,
        preparedByName: 'Regional Manager One',
        sourceAnswersOverride: {},
        connection: fakePool,
        uploadedObjectKeys: [],
      })).rejects.toMatchObject({
        code: 'funding_overview_signed_baseline_scope_conflict',
        baselineReason: 'baseline_signed_participant_mismatch',
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql }) => /^(INSERT|UPDATE|DELETE)\b/i.test(
      String(sql).replace(/\s+/g, ' ').trim()
    ))).toBe(false);
  });

  test('assessment CFA creation keeps the exact application planless despite sibling plans and legacy JSON plan lineage', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const typedSiblingPlanVersion = {
      id: 911,
      series_id: 7,
      case_id: 76,
      application_id: 123,
      action_plan_id: 185,
      version_number: 18,
      status: 'signed',
      signed_by_participant_id: 200,
      metadata_json: JSON.stringify({
        case: { id: 76, applicationId: 999, applicantUserId: 200 },
        plan: { id: 184 },
        interventions: [{ id: 900, code: '110', costTotal: 400 }],
      }),
      supersedes_version_id: null,
      created_at: '2026-08-23T12:00:00.000Z',
    };
    const legacyPlanVersion = {
      id: 912,
      series_id: 7,
      application_id: null,
      action_plan_id: null,
      version_number: 19,
      status: 'sent',
      metadata_json: JSON.stringify({
        case: { applicationId: 123 },
        plan: { id: 184 },
      }),
      supersedes_version_id: null,
      created_at: '2026-08-24T12:00:00.000Z',
    };

    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id FROM iset_case') &&
        normalizedSql.includes('LIMIT 1 FOR UPDATE')
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.includes('SELECT c.id,') &&
        normalizedSql.includes('a.id AS application_id') &&
        normalizedSql.includes('FROM iset_case c')
      ) {
        return [[{
          id: 76,
          case_number: 'CASE-76',
          application_id: 123,
          application_client_id: 1,
          client_id: 1,
          case_context_json: '{}',
          submission_user_id: 901,
          client_applicant_user_id: 200,
          reference_number: 'APP-123',
          intake_payload: JSON.stringify({
            'first-name': 'Applicant',
            'last-name': 'One',
          }),
        }], []];
      }
      if (normalizedSql.includes('FROM iset_application_assessment aa')) {
        return [[{
          id: 10,
          case_id: 76,
          application_id: 123,
          proposed_interventions: JSON.stringify([{
            code: '110',
            costLines: [{ type: 'TuitionFeesDirect', amount: 500 }],
            totalCost: 500,
          }]),
          _assessment_source: 'application_assessment',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case_intervention i') &&
        normalizedSql.includes('JOIN iset_case_action_plan ap')
      ) {
        return [[], []];
      }
      if (normalizedSql.includes('FROM cfa_series') && normalizedSql.includes('WHERE case_id = ?')) {
        return [[{ id: 7 }], []];
      }
      if (normalizedSql.includes('FROM cfa_version v') && normalizedSql.includes('WHERE v.series_id = ?')) {
        return [[legacyPlanVersion, typedSiblingPlanVersion], []];
      }
      if (normalizedSql.startsWith('SELECT MAX(version_number) FROM cfa_version')) {
        return [[{ 'MAX(version_number)': 19 }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case c') &&
        normalizedSql.includes('sp.display_name') &&
        normalizedSql.includes('AS assigned_to_user_id')
      ) {
        return [[{
          assigned_to_user_id: 54,
          assigned_staff_profile_id: 54,
          display_name: 'Regional Manager One',
          name: 'Regional Manager One',
          email: 'regional.manager@example.invalid',
        }], []];
      }
      if (normalizedSql.startsWith('INSERT INTO cfa_version ')) {
        return [{ insertId: 913, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('SELECT code, label FROM esdc_intervention_code')) {
        return [[{ code: 110, label: 'Skills Training' }], []];
      }
      if (normalizedSql.includes('FROM payment_packet_line ppl')) {
        return [[], []];
      }
      if (normalizedSql.startsWith('SELECT series_id, version_number FROM cfa_version')) {
        return [[{ series_id: 7, version_number: 20 }], []];
      }
      if (
        normalizedSql.startsWith('SELECT id FROM cfa_version') &&
        normalizedSql.includes("status = 'signed'")
      ) {
        return [[], []];
      }
      if (normalizedSql.startsWith('INSERT INTO iset_document ')) {
        return [{ insertId: 914, affectedRows: 1 }, []];
      }
      if (normalizedSql.startsWith('INSERT INTO cfa_version_documents ')) {
        return [{ affectedRows: 1 }, []];
      }
      return undefined;
    });

    let created;
    try {
      created = await createCfaVersionFromAssessment({
        caseId: 76,
        applicationId: 123,
        changeReason: 'APPLICATION_APPROVED',
        changeSummary: 'Assessment agreement',
        actorUserId: 300,
        staffProfileId: 54,
        caseManagerName: 'Regional Manager One',
        connection: fakePool,
        uploadedObjectKeys: [],
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    expect(created).toMatchObject({
      cfaVersionId: 913,
      versionNumber: 20,
      seriesId: 7,
      applicationId: 123,
      supersedesVersionId: 911,
    });
    expect(created.snapshot?.plan?.id).toBeNull();
    expect(created.snapshot?.case?.applicantUserId).toBe(200);
    expect(created.snapshot?.case?.applicantUserId).not.toBe(901);
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const versionInsert = routeQueries.find(({ sql }) => (
      String(sql).replace(/\s+/g, ' ').trim().startsWith('INSERT INTO cfa_version ')
    ));
    expect(versionInsert?.params.slice(0, 4)).toEqual([7, 123, null, 20]);
    expect(versionInsert?.params[4]).toBe(911);
    const documentInsert = routeQueries.find(({ sql }) => sql.includes('INSERT INTO iset_document'));
    expect(documentInsert?.params.slice(0, 3)).toEqual([76, 123, null]);
    expect(documentInsert?.params[4]).toBe(200);
    expect(routeQueries.some(({ sql }) => sql.includes('UPDATE cfa_version'))).toBe(false);
    expect(routeQueries.some(({ sql }) => sql.includes('UPDATE signing_request'))).toBe(false);
    expect(routeQueries.some(({ params }) => (
      params.includes(912) || params.includes('912')
    ))).toBe(false);
  });

  test('assessment CFA refuses a latest signed stale-S baseline before any product write', async () => {
    const beforeQueryCount = fakePool.queries.length;
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.startsWith('SELECT id FROM iset_case') &&
        normalizedSql.includes('LIMIT 1 FOR UPDATE')
      ) {
        return [[{ id: 76 }], []];
      }
      if (
        normalizedSql.includes('SELECT c.id,') &&
        normalizedSql.includes('a.id AS application_id') &&
        normalizedSql.includes('FROM iset_case c')
      ) {
        return [[{
          id: 76,
          case_number: 'CASE-76',
          application_id: 123,
          application_client_id: 1,
          client_id: 1,
          case_context_json: '{}',
          submission_user_id: 901,
          client_applicant_user_id: 200,
          reference_number: 'APP-123',
          intake_payload: JSON.stringify({
            'first-name': 'Applicant',
            'last-name': 'One',
          }),
        }], []];
      }
      if (normalizedSql.includes('FROM iset_application_assessment aa')) {
        return [[{
          id: 10,
          case_id: 76,
          application_id: 123,
          proposed_interventions: JSON.stringify([{
            code: '110',
            costLines: [{ type: 'TuitionFeesDirect', amount: 500 }],
            totalCost: 500,
          }]),
          _assessment_source: 'application_assessment',
        }], []];
      }
      if (
        normalizedSql.includes('FROM iset_case_intervention i') &&
        normalizedSql.includes('JOIN iset_case_action_plan ap')
      ) {
        return [[], []];
      }
      if (normalizedSql.includes('FROM cfa_series') && normalizedSql.includes('WHERE case_id = ?')) {
        return [[{ id: 7 }], []];
      }
      if (normalizedSql.includes('FROM cfa_version v') && normalizedSql.includes('WHERE v.series_id = ?')) {
        return [[{
          id: 911,
          series_id: 7,
          case_id: 76,
          application_id: 999,
          action_plan_id: 185,
          version_number: 19,
          status: 'signed',
          signed_by_participant_id: 901,
          metadata_json: JSON.stringify({
            case: { id: 76, applicationId: 999, applicantUserId: 901 },
            plan: { id: 185 },
            interventions: [{ id: 900, code: '110', costTotal: 400 }],
          }),
          supersedes_version_id: null,
        }], []];
      }
      return undefined;
    });

    try {
      await expect(createCfaVersionFromAssessment({
        caseId: 76,
        applicationId: 123,
        changeReason: 'APPLICATION_APPROVED',
        changeSummary: 'Assessment agreement',
        actorUserId: 300,
        staffProfileId: 54,
        caseManagerName: 'Regional Manager One',
        connection: fakePool,
        uploadedObjectKeys: [],
      })).rejects.toMatchObject({
        code: 'cfa_signed_baseline_scope_conflict',
        baselineReason: 'baseline_signed_participant_mismatch',
      });
    } finally {
      fakePool.clearQueryResponder();
    }

    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    expect(routeQueries.some(({ sql }) => /^(INSERT|UPDATE|DELETE)\b/i.test(
      String(sql).replace(/\s+/g, ' ').trim()
    ))).toBe(false);
  });

  test('retained applied revision evidence is read-only at every intervention mutation boundary', async () => {
    const beforeQueryCount = fakePool.queries.length;
    const evidenceRow = {
      id: 708,
      case_id: 76,
      action_plan_id: 3,
      status: 'approved',
      delivery_status: 'planned',
      metadata_json: JSON.stringify({
        review: { decision: 'approved' },
        revisionApplication: {
          status: 'applied',
          appliedToInterventionId: '7',
        },
      }),
      assigned_staff_profile_id: 1,
      assigned_to_user_id: 1,
      portfolio_region_id: 1,
      owner_region_id: 1,
    };
    fakePool.setQueryResponder(async sql => {
      const normalizedSql = String(sql).replace(/\s+/g, ' ').trim();
      if (
        normalizedSql.includes('FROM iset_case_intervention ci') &&
        normalizedSql.includes('WHERE ci.id = ?')
      ) {
        return [[evidenceRow], []];
      }
      return undefined;
    });

    let responses;
    try {
      responses = await Promise.all([
        requestJson(server, '/api/interventions/708', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title: 'Attempted edit' }),
        }),
        requestJson(server, '/api/interventions/708/close', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            status: 'completed',
            outcome: '1',
            completionDate: '2026-08-08',
          }),
        }),
        requestJson(server, '/api/interventions/708/revise', { method: 'POST' }),
        requestJson(server, '/api/interventions/708/delete', { method: 'POST' }),
      ]);
    } finally {
      fakePool.clearQueryResponder();
    }

    responses.forEach(response => {
      expect(response).toMatchObject({
        status: 409,
        body: { error: 'applied_revision_evidence_read_only' },
      });
    });
    const routeQueries = fakePool.queries.slice(beforeQueryCount);
    const nonAuthWrites = routeQueries.filter(({ sql }) => (
      /\b(UPDATE|INSERT|DELETE)\b/i.test(sql) &&
      !/\b(?:INTO|UPDATE)\s+staff_profiles\b/i.test(sql)
    ));
    // Real authentication bootstraps/upserts the caller's staff profile on each
    // request. The retained-evidence guard must still precede every domain write.
    expect(nonAuthWrites).toEqual([]);
  });
});
