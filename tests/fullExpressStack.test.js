const http = require('http');
const { Blob, File } = require('buffer');
const { ReadableStream } = require('stream/web');
const { MessageChannel, MessagePort } = require('worker_threads');

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

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

function createFakePool() {
  const queries = [];
  let queryResponder = null;
  const query = async (sql, params = []) => {
    queries.push({ sql: String(sql), params });
    if (typeof queryResponder === 'function') {
      const response = await queryResponder(String(sql), params);
      if (typeof response !== 'undefined') return response;
    }
    return [[], []];
  };
  return {
    queries,
    query,
    execute: query,
    setQueryResponder: responder => { queryResponder = responder; },
    clearQueryResponder: () => { queryResponder = null; },
    getConnection: async () => ({
      query,
      execute: query,
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    }),
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
  let fakePool;
  let dependencyStore;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    fakePool = createFakePool();
    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = {
          subjectType: 'staff',
          sub: 'full-stack-test-staff',
          email: 'full-stack-test@example.invalid',
          role: 'System Administrator',
          staffProfileId: 1,
        };
        next();
      },
    });
    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
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
