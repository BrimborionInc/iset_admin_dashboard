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

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.setTimeout(30000);

const clone = value => JSON.parse(JSON.stringify(value));
const normalizeSql = sql => String(sql).replace(/\s+/gu, ' ').trim();

function createDocumentLifecycleDatabase() {
  const state = {
    actor: {
      id: 11,
      role: 'System Administrator',
      regionId: 1,
      sub: 'document-lifecycle-test-user',
    },
    caseRow: {
      id: 10,
      client_id: 100,
      application_id: null,
      assigned_to_user_id: 11,
      assigned_staff_profile_id: 11,
      portfolio_region_id: 1,
      owner_region_id: 1,
      case_number: 'CASE-10',
    },
    documents: new Map(),
    signingRequests: new Map(),
    cfaDocumentIds: new Set(),
    fundingOverviewDocumentIds: new Set(),
    packetDocumentIds: new Set(),
    proofDocumentIds: new Set(),
    followUpDocumentIds: new Set(),
    lifecycles: new Map(),
    events: [],
    failOn: null,
    staleRestoreLock: false,
    transactionCounts: { begun: 0, committed: 0, rolledBack: 0, released: 0 },
    queries: [],
  };

  const reset = () => {
    state.actor = {
      id: 11,
      role: 'System Administrator',
      regionId: 1,
      sub: 'document-lifecycle-test-user',
    };
    state.caseRow = {
      id: 10,
      client_id: 100,
      application_id: null,
      assigned_to_user_id: 11,
      assigned_staff_profile_id: 11,
      portfolio_region_id: 1,
      owner_region_id: 1,
      case_number: 'CASE-10',
    };
    state.documents = new Map([
      [1, {
        id: 1,
        case_id: 10,
        application_id: null,
        action_plan_id: null,
        client_id: 100,
        applicant_user_id: null,
        user_id: 11,
        source: 'manual_upload',
        origin_message_id: null,
        signing_request_id: null,
        file_name: 'wrong-scan.pdf',
        file_path: 'uploads/manual/wrong-scan.pdf',
        mime_type: 'application/pdf',
        label: 'Wrong scan',
        metadata: '{}',
        document_category: 'other',
        size_bytes: 100,
        checksum_sha256: 'a'.repeat(64),
        status: 'active',
        updated_at: '2026-08-24T12:00:00.000Z',
        created_at: '2026-08-24T12:00:00.000Z',
      }],
    ]);
    state.signingRequests = new Map();
    state.cfaDocumentIds = new Set();
    state.fundingOverviewDocumentIds = new Set();
    state.packetDocumentIds = new Set();
    state.proofDocumentIds = new Set();
    state.followUpDocumentIds = new Set();
    state.lifecycles = new Map();
    state.events = [];
    state.failOn = null;
    state.staleRestoreLock = false;
    state.transactionCounts = { begun: 0, committed: 0, rolledBack: 0, released: 0 };
    state.queries = [];
  };

  const lifecycleForOriginal = documentId => state.lifecycles.get(Number(documentId)) || null;

  const profileRow = () => ({
    id: state.actor.id,
    cognito_sub: state.actor.sub,
    email: `${state.actor.sub}@example.invalid`,
    primary_role: state.actor.role,
    region_id: state.actor.regionId,
  });

  const documentListRow = document => {
    const lifecycle = lifecycleForOriginal(document.id);
    return {
      ...clone(document),
      uploaded_at: document.created_at,
      lifecycle_id: lifecycle?.id || null,
      lifecycle_state: lifecycle?.current_state || null,
      deleted_at: lifecycle?.deleted_at || null,
      deleted_by: lifecycle ? 'Lifecycle Test User' : null,
      reference_number: null,
      case_number: state.caseRow.case_number,
    };
  };

  const routeQuery = async (sql, params = [], { source = 'pool' } = {}) => {
    const normalized = normalizeSql(sql);
    state.queries.push({ sql: normalized, params: clone(params), source });

    if (/^SELECT `[^`]+`(?:, `[^`]+`)* FROM `staff_profiles` LIMIT 0$/u.test(normalized)) {
      return [[], []];
    }
    if (normalized.startsWith('INSERT INTO staff_profiles (cognito_sub,email,primary_role,region_id)')) {
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.includes('FROM staff_profiles WHERE cognito_sub=? LIMIT 1')) {
      return [[profileRow()], []];
    }
    if (normalized === 'SELECT region_id FROM staff_region WHERE staff_profile_id = ?') {
      return [[[state.actor.regionId].filter(Boolean).map(region_id => ({ region_id }))][0], []];
    }

    if (
      normalized.includes('FROM iset_document') &&
      normalized.includes("WHERE id = ? AND status = 'active'") &&
      !normalized.includes('FOR UPDATE')
    ) {
      const document = state.documents.get(Number(params[0]));
      return [[document?.status === 'active' ? clone(document) : undefined].filter(Boolean), []];
    }
    if (
      normalized.includes('FROM iset_document') &&
      normalized.includes("AND status = 'active'") &&
      normalized.includes('FOR UPDATE')
    ) {
      const document = state.documents.get(Number(params[0]));
      return [[document?.status === 'active' ? clone(document) : undefined].filter(Boolean), []];
    }

    if (normalized.includes('FROM iset_document_intervention di') && normalized.includes('WHERE di.document_id = ?')) {
      return [[], []];
    }
    if (normalized.includes('FROM payment_packet_document ppd') && normalized.includes('UNION')) {
      return [[], []];
    }
    if (normalized.includes('FROM iset_case c') && normalized.includes('WHERE c.id IN (')) {
      return [[clone(state.caseRow)], []];
    }
    if (normalized.includes('FROM iset_case c') && normalized.includes('WHERE c.client_id = ?')) {
      return Number(params[0]) === Number(state.caseRow.client_id)
        ? [[clone(state.caseRow)], []]
        : [[], []];
    }
    if (
      normalized.includes('FROM iset_case c') &&
      normalized.includes('WHERE c.id = ?') &&
      normalized.includes('AS assigned_to_user_id')
    ) {
      return Number(params[0]) === Number(state.caseRow.id)
        ? [[clone(state.caseRow)], []]
        : [[], []];
    }
    if (
      normalized.includes('FROM iset_case c') &&
      normalized.includes('WHERE c.id = ?') &&
      normalized.includes('c.case_number')
    ) {
      return Number(params[0]) === Number(state.caseRow.id)
        ? [[clone(state.caseRow)], []]
        : [[], []];
    }
    if (
      normalized.includes('FROM iset_application a') &&
      normalized.includes('JOIN iset_case c ON c.id = a.case_id') &&
      normalized.includes('WHERE a.id = ?')
    ) {
      return Number(params[0]) === Number(state.caseRow.application_id)
        ? [[{ id: state.caseRow.id }], []]
        : [[], []];
    }

    if (normalized.startsWith('SELECT signing_request.id, signing_request.case_id, signing_request.status FROM signing_request')) {
      const requestedIds = new Set(params.map(Number));
      return [[...state.signingRequests.values()]
        .filter(row => requestedIds.has(Number(row.id)))
        .map(clone), []];
    }
    if (normalized.startsWith('SELECT cvd.document_id FROM cfa_version_documents cvd')) {
      return [[...state.cfaDocumentIds].map(document_id => ({ document_id })), []];
    }
    if (normalized.startsWith('SELECT fvd.document_id FROM funding_overview_version_documents fvd')) {
      return [[...state.fundingOverviewDocumentIds].map(document_id => ({ document_id })), []];
    }
    if (normalized.startsWith('SELECT COUNT(*) AS count FROM payment_packet_document')) return [[{ count: 0 }], []];
    if (normalized.startsWith('SELECT COUNT(*) AS count FROM payment_packet_line')) return [[{ count: 0 }], []];
    if (normalized.startsWith('SELECT COUNT(*) AS count FROM payment_followup_event')) return [[{ count: 0 }], []];

    if (normalized.startsWith('SELECT id, current_state, lifecycle_generation FROM iset_document_lifecycle')) {
      const lifecycle = lifecycleForOriginal(params[0]);
      return [[lifecycle ? clone(lifecycle) : undefined].filter(Boolean), []];
    }
    if (normalized.startsWith("UPDATE iset_document SET status = 'deleted'")) {
      const document = state.documents.get(Number(params[0]));
      if (!document || document.status !== 'active') return [{ affectedRows: 0 }, []];
      document.status = 'deleted';
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith('INSERT INTO iset_document_lifecycle ')) {
      if (state.failOn === 'lifecycle') throw new Error('injected_lifecycle_failure');
      const documentId = Number(params[0]);
      const existing = lifecycleForOriginal(documentId);
      state.lifecycles.set(documentId, {
        id: existing?.id || 501,
        document_id: documentId,
        original_document_id: documentId,
        current_state: 'deleted',
        lifecycle_generation: existing ? existing.lifecycle_generation + 1 : 1,
        deleted_at: '2026-08-24T12:10:00.000Z',
        deleted_by_staff_profile_id: params[2] || null,
        delete_reason: params[3] || null,
        client_id: params[4] || null,
        case_id: params[5] || null,
        application_id: params[6] || null,
        action_plan_id: params[7] || null,
        source_snapshot: params[8],
        document_category: params[9] || null,
        checksum_sha256: params[10] || null,
        size_bytes: params[11] || null,
      });
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith('SELECT id, lifecycle_generation FROM iset_document_lifecycle')) {
      const lifecycle = lifecycleForOriginal(params[0]);
      return [[lifecycle ? clone(lifecycle) : undefined].filter(Boolean), []];
    }
    if (normalized.startsWith('INSERT INTO iset_document_lifecycle_event')) {
      if (state.failOn === 'event') throw new Error('injected_event_failure');
      state.events.push({
        lifecycle_id: params[0],
        operation_id: params[1],
        lifecycle_generation: params[2],
        event_type: params[3],
        from_state: params[4],
        to_state: params[5],
        actor_staff_profile_id: params[6],
        actor_role_snapshot: params[7],
        reason: params[10],
      });
      return [{ affectedRows: 1 }, []];
    }

    if (
      normalized.includes('FROM iset_document d') &&
      normalized.includes('JOIN iset_document_lifecycle dl ON dl.document_id = d.id') &&
      normalized.includes('WHERE d.id = ?')
    ) {
      const document = state.documents.get(Number(params[0]));
      const lifecycle = lifecycleForOriginal(params[0]);
      if (!document || !lifecycle) return [[], []];
      const row = {
        ...clone(document),
        lifecycle_id: lifecycle.id,
        current_state: lifecycle.current_state,
        lifecycle_generation: lifecycle.lifecycle_generation,
      };
      if (normalized.includes('FOR UPDATE') && state.staleRestoreLock) {
        row.current_state = 'active';
      }
      return [[row], []];
    }
    if (normalized.startsWith("UPDATE iset_document SET status = 'active'")) {
      const document = state.documents.get(Number(params[0]));
      if (!document || document.status !== 'deleted') return [{ affectedRows: 0 }, []];
      document.status = 'active';
      return [{ affectedRows: 1 }, []];
    }
    if (normalized.startsWith('UPDATE iset_document_lifecycle SET current_state =')) {
      if (state.failOn === 'restoreLifecycleUpdate') return [{ affectedRows: 0 }, []];
      const lifecycle = Array.from(state.lifecycles.values()).find(item => Number(item.id) === Number(params[0]));
      if (!lifecycle || lifecycle.current_state !== 'deleted') return [{ affectedRows: 0 }, []];
      lifecycle.current_state = 'active';
      return [{ affectedRows: 1 }, []];
    }

    if (normalized.startsWith('SELECT code, COALESCE(scope,')) {
      return [[{ code: 'other', scope: 'case' }], []];
    }
    if (
      normalized.includes('FROM iset_document d') &&
      normalized.includes('LEFT JOIN iset_document_lifecycle dl ON dl.document_id = d.id') &&
      normalized.includes('ORDER BY d.created_at DESC')
    ) {
      let documents = Array.from(state.documents.values()).filter(document => document.status === 'deleted');
      if (normalized.includes("dl.current_state = 'deleted'")) {
        documents = documents.filter(document => lifecycleForOriginal(document.id)?.current_state === 'deleted');
      }
      return [documents.map(documentListRow), []];
    }
    if (normalized.startsWith('SELECT ppd.document_id FROM payment_packet_document ppd')) {
      return [[...state.packetDocumentIds].map(document_id => ({ document_id })), []];
    }
    if (normalized.startsWith('SELECT ppl.payment_proof_document_id FROM payment_packet_line ppl')) {
      return [[...state.proofDocumentIds]
        .map(payment_proof_document_id => ({ payment_proof_document_id })), []];
    }
    if (normalized.startsWith('SELECT pfe.document_id FROM payment_followup_event pfe')) {
      return [[...state.followUpDocumentIds].map(document_id => ({ document_id })), []];
    }
    if (normalized.startsWith('SELECT document_id, intervention_id FROM iset_document_intervention')) return [[], []];

    throw new Error(`Unexpected SQL in document lifecycle fixture: ${normalized}`);
  };

  const pool = {
    query: (sql, params) => routeQuery(sql, params, { source: 'pool' }),
    execute: (sql, params) => routeQuery(sql, params, { source: 'pool' }),
    getConnection: async () => {
      let snapshot = null;
      let closed = false;
      return {
        query: (sql, params) => routeQuery(sql, params, { source: 'transaction' }),
        execute: (sql, params) => routeQuery(sql, params, { source: 'transaction' }),
        beginTransaction: async () => {
          state.transactionCounts.begun += 1;
          snapshot = {
            documents: clone(Array.from(state.documents.entries())),
            lifecycles: clone(Array.from(state.lifecycles.entries())),
            events: clone(state.events),
          };
        },
        commit: async () => {
          state.transactionCounts.committed += 1;
          snapshot = null;
        },
        rollback: async () => {
          state.transactionCounts.rolledBack += 1;
          if (snapshot) {
            state.documents = new Map(snapshot.documents);
            state.lifecycles = new Map(snapshot.lifecycles);
            state.events = snapshot.events;
            snapshot = null;
          }
        },
        release: () => {
          if (!closed) state.transactionCounts.released += 1;
          closed = true;
        },
      };
    },
  };

  reset();
  return { pool, reset, state };
}

function requestJson(server, path, { method = 'GET', body = null } = {}) {
  const address = server.address();
  const serializedBody = body === null ? null : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: serializedBody
        ? {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(serializedBody),
          }
        : {},
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let responseBody = null;
        try {
          responseBody = raw ? JSON.parse(raw) : null;
        } catch {
          responseBody = raw;
        }
        resolve({ status: response.statusCode, body: responseBody });
      });
    });
    request.on('error', reject);
    if (serializedBody) request.write(serializedBody);
    request.end();
  });
}

describe('Supporting Documents lifecycle through the real Express routes', () => {
  let server;
  let database;
  let dependencyStore;
  let storageHead;
  let storageProvider;
  let syntheticTestEnvironment;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;

  beforeAll(async () => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    database = createDocumentLifecycleDatabase();
    storageHead = {
      exists: true,
      size: 100,
      metadata: { 'path-sha256': 'a'.repeat(64) },
    };
    storageProvider = {
      DRIVER: 's3',
      headObject: jest.fn(async () => clone(storageHead)),
    };
    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: database.pool,
      documentStorageProvider: storageProvider,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = {
          subjectType: 'staff',
          sub: database.state.actor.sub,
          email: `${database.state.actor.sub}@example.invalid`,
          role: database.state.actor.role,
          regionId: database.state.actor.regionId,
          staffProfileId: database.state.actor.id,
        };
        next();
      },
    });
    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  beforeEach(() => {
    database.reset();
    storageHead = {
      exists: true,
      size: 100,
      metadata: { 'path-sha256': 'a'.repeat(64) },
    };
    storageProvider.headObject.mockClear();
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) expect(syntheticTestEnvironment.cleanup()).toBe(true);
  });

  test.each(
    [
      'manual_upload',
      'application_submission',
      'secure_message_attachment',
      'system_generated',
      'legacy_intake_upload',
    ].flatMap(source => [
      ['System Administrator', 11, 1, 11, 1],
      ['NWAC Administrator', 12, 1, 99, 2],
      ['Regional Manager', 13, 1, 99, 1],
      ['ISET Coordinator', 14, 1, 14, 2],
    ].map(roleCase => [source, ...roleCase]))
  )('%s: %s can reversibly delete an in-scope document', async (
    source,
    role,
    actorId,
    actorRegionId,
    assignedStaffProfileId,
    portfolioRegionId
  ) => {
    database.state.actor = { ...database.state.actor, role, id: actorId, regionId: actorRegionId };
    database.state.caseRow = {
      ...database.state.caseRow,
      assigned_to_user_id: assignedStaffProfileId,
      assigned_staff_profile_id: assignedStaffProfileId,
      owner_region_id: portfolioRegionId,
      portfolio_region_id: portfolioRegionId,
    };
    const document = database.state.documents.get(1);
    document.source = source;
    if (source === 'application_submission') {
      document.application_id = 20;
      document.applicant_user_id = 30;
      database.state.caseRow.application_id = 20;
    } else if (source === 'secure_message_attachment') {
      document.applicant_user_id = 30;
      document.origin_message_id = 55;
    }

    const response = await requestJson(server, '/api/documents/1', {
      method: 'DELETE',
      body: { reason: 'Uploaded the wrong scan' },
    });

    expect(response).toEqual({
      status: 200,
      body: { ok: true, deleted: true },
    });
    expect(database.state.documents.get(1).status).toBe('deleted');
    expect(database.state.lifecycles.get(1)).toMatchObject({
      current_state: 'deleted',
      lifecycle_generation: 1,
      deleted_by_staff_profile_id: actorId,
      delete_reason: 'Uploaded the wrong scan',
      source_snapshot: source,
    });
    expect(database.state.events).toEqual([
      expect.objectContaining({
        event_type: 'deleted',
        from_state: 'active',
        to_state: 'deleted',
        actor_staff_profile_id: actorId,
        actor_role_snapshot: role,
      }),
    ]);
    expect(database.state.transactionCounts).toEqual({
      begun: 1,
      committed: 1,
      rolledBack: 0,
      released: 1,
    });
    const transactionSql = database.state.queries
      .filter(query => query.source === 'transaction')
      .map(query => query.sql);
    expect(transactionSql.findIndex(sql => sql.startsWith("UPDATE iset_document SET status = 'deleted'")))
      .toBeLessThan(transactionSql.findIndex(sql => sql.startsWith('INSERT INTO iset_document_lifecycle ')));
    expect(transactionSql.findIndex(sql => sql.startsWith('INSERT INTO iset_document_lifecycle ')))
      .toBeLessThan(transactionSql.findIndex(sql => sql.startsWith('INSERT INTO iset_document_lifecycle_event')));
  });

  test.each([
    ['retired role', 'Retired Staff Role', 21, 1, 21, 1],
    ['wrong-scope Regional Manager', 'Regional Manager', 22, 1, 99, 2],
    ['wrong-scope ISET Coordinator', 'ISET Coordinator', 23, 1, 99, 1],
  ])('%s cannot delete a document outside the allowed role/scope', async (
    _label,
    role,
    actorId,
    actorRegionId,
    assignedStaffProfileId,
    portfolioRegionId
  ) => {
    database.state.actor = { ...database.state.actor, role, id: actorId, regionId: actorRegionId };
    database.state.caseRow = {
      ...database.state.caseRow,
      assigned_to_user_id: assignedStaffProfileId,
      assigned_staff_profile_id: assignedStaffProfileId,
      owner_region_id: portfolioRegionId,
      portfolio_region_id: portfolioRegionId,
    };

    const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

    expect(response).toEqual({
      status: 403,
      body: { error: 'forbidden', detail: 'document_scope_mismatch' },
    });
    expect(database.state.documents.get(1).status).toBe('active');
    expect(database.state.transactionCounts.begun).toBe(0);
  });

  test('an applicant upload materialized from a signing request is still deletable', async () => {
    const document = database.state.documents.get(1);
    document.source = 'application_submission';
    document.application_id = 20;
    document.applicant_user_id = 30;
    document.metadata = JSON.stringify({
      materialized_from: 'signing_request_payload',
      signing_request_id: 81,
    });
    database.state.caseRow.application_id = 20;

    const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

    expect(response).toEqual({
      status: 200,
      body: { ok: true, deleted: true },
    });
    expect(database.state.documents.get(1).status).toBe('deleted');
    expect(database.state.transactionCounts.committed).toBe(1);
  });

  test('a PATH-generated signed document remains protected', async () => {
    const document = database.state.documents.get(1);
    document.source = 'application_submission';
    document.application_id = 20;
    document.applicant_user_id = 30;
    document.metadata = JSON.stringify({ generated_kind: 'signed_form' });
    database.state.caseRow.application_id = 20;

    const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'document_immutable',
        reason: 'signed_document',
        message:
          'Signed documents form part of the evidence and contracting record and cannot be deleted. Contact a System Administrator if one was created and sent in error.',
      },
    });
    expect(database.state.documents.get(1).status).toBe('active');
    expect(database.state.transactionCounts.begun).toBe(0);
  });

  test.each(['pending', 'viewed'])(
    'a decision letter with a %s signing request remains protected',
    async status => {
      const document = database.state.documents.get(1);
      document.source = 'system_generated';
      document.document_category = 'assessment_approval_letter';
      document.metadata = JSON.stringify({
        generated_kind: 'signing_request_source_document',
        signing_request_id: 81,
        decision_letter_owner: 'application',
      });
      database.state.signingRequests.set(81, { id: 81, case_id: 10, status });

      const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

      expect(response).toEqual({
        status: 409,
        body: {
          error: 'document_immutable',
          reason: 'signing_request_in_progress',
          message: 'This document is currently out for signature and cannot be deleted.',
        },
      });
      expect(database.state.documents.get(1).status).toBe('active');
      expect(database.state.transactionCounts.begun).toBe(0);
    }
  );

  test.each(['signed', 'cancelled', 'expired'])(
    'an unsigned decision-letter source can be deleted after its signing request is %s',
    async status => {
      const document = database.state.documents.get(1);
      document.source = 'system_generated';
      document.document_category = 'assessment_denial_letter';
      document.metadata = JSON.stringify({
        generated_kind: 'signing_request_source_document',
        signing_request_id: 82,
        decision_letter_owner: 'application',
      });
      database.state.signingRequests.set(82, { id: 82, case_id: 10, status });

      const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

      expect(response).toEqual({ status: 200, body: { ok: true, deleted: true } });
      expect(database.state.documents.get(1).status).toBe('deleted');
    }
  );

  test('an unsigned decision-letter source fails closed for an unknown signing status', async () => {
    const document = database.state.documents.get(1);
    document.source = 'system_generated';
    document.document_category = 'assessment_denial_letter';
    document.metadata = JSON.stringify({
      generated_kind: 'signing_request_source_document',
      signing_request_id: 83,
    });
    database.state.signingRequests.set(83, {
      id: 83,
      case_id: 10,
      status: 'future_state',
    });

    const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

    expect(response).toMatchObject({
      status: 409,
      body: {
        error: 'document_immutable',
        reason: 'signing_request_legacy',
        message: 'This document is part of a signing request and cannot be deleted.',
      },
    });
    expect(database.state.documents.get(1).status).toBe('active');
    expect(database.state.transactionCounts.begun).toBe(0);
  });

  test.each([
    ['CFA version', 'cfaDocumentIds', 'cfa_version_link', 'This document is part of the version history and cannot be deleted.'],
    ['Financial Overview version', 'fundingOverviewDocumentIds', 'funding_overview_version_link', 'This document is part of the version history and cannot be deleted.'],
    ['payment packet', 'packetDocumentIds', 'payment_evidence_link', 'This document is part of a payment record and cannot be deleted.'],
    ['payment line', 'proofDocumentIds', 'payment_evidence_link', 'This document is part of a payment record and cannot be deleted.'],
    ['payment follow-up', 'followUpDocumentIds', 'payment_evidence_link', 'This document is part of a payment record and cannot be deleted.'],
  ])('a document linked to %s remains protected', async (_label, stateKey, reason, message) => {
    database.state[stateKey].add(1);

    const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

    expect(response).toEqual({
      status: 409,
      body: { error: 'document_immutable', reason, message },
    });
    expect(database.state.documents.get(1).status).toBe('active');
    expect(database.state.transactionCounts.begun).toBe(0);
  });

  test.each(['lifecycle', 'event'])(
    'a %s write failure rolls back the document, lifecycle, and audit event together',
    async failOn => {
      database.state.failOn = failOn;

      const response = await requestJson(server, '/api/documents/1', { method: 'DELETE' });

      expect(response).toEqual({ status: 500, body: { error: 'failed_to_delete_document' } });
      expect(database.state.documents.get(1).status).toBe('active');
      expect(database.state.lifecycles.size).toBe(0);
      expect(database.state.events).toEqual([]);
      expect(database.state.transactionCounts).toEqual({
        begun: 1,
        committed: 0,
        rolledBack: 1,
        released: 1,
      });
    }
  );

  test('only a System Administrator can list lifecycle-deleted documents and legacy deleted rows stay hidden', async () => {
    const lifecycleDocument = {
      ...clone(database.state.documents.get(1)),
      id: 3,
      file_name: 'lifecycle-deleted.pdf',
      file_path: 'uploads/manual/lifecycle-deleted.pdf',
      status: 'deleted',
    };
    const legacyDocument = {
      ...clone(database.state.documents.get(1)),
      id: 4,
      file_name: 'legacy-deleted.pdf',
      file_path: 'uploads/manual/legacy-deleted.pdf',
      status: 'deleted',
    };
    database.state.documents = new Map([[3, lifecycleDocument], [4, legacyDocument]]);
    database.state.lifecycles.set(3, {
      id: 503,
      document_id: 3,
      original_document_id: 3,
      current_state: 'deleted',
      lifecycle_generation: 1,
      deleted_at: '2026-08-24T12:10:00.000Z',
      deleted_by_staff_profile_id: 11,
    });

    database.state.actor.role = 'NWAC Administrator';
    const denied = await requestJson(server, '/api/cases/10/documents?view=deleted');
    expect(denied).toEqual({ status: 403, body: { error: 'forbidden' } });

    database.state.actor.role = 'System Administrator';
    const allowed = await requestJson(server, '/api/cases/10/documents?view=deleted');
    expect(allowed.status).toBe(200);
    expect(allowed.body.map(document => document.id)).toEqual([3]);
    expect(allowed.body[0]).toMatchObject({
      status: 'deleted',
      lifecycle_state: 'deleted',
      can_restore: true,
    });
  });

  test('restore is System Administrator-only', async () => {
    seedDeletedDocument(database.state);
    database.state.actor.role = 'NWAC Administrator';

    const response = await requestJson(server, '/api/documents/1/restore', { method: 'POST' });

    expect(response).toEqual({ status: 403, body: { error: 'forbidden' } });
    expect(storageProvider.headObject).not.toHaveBeenCalled();
    expect(database.state.documents.get(1).status).toBe('deleted');
  });

  test.each([
    [
      'missing object',
      { exists: false },
      'document_file_missing',
      'The stored file is missing, so this document cannot be restored.',
    ],
    [
      'size mismatch',
      { exists: true, size: 101, metadata: { 'path-sha256': 'a'.repeat(64) } },
      'document_file_changed',
      'The stored file no longer matches this document, so it cannot be restored.',
    ],
    [
      'checksum mismatch',
      { exists: true, size: 100, metadata: { 'path-sha256': 'b'.repeat(64) } },
      'document_file_changed',
      'The stored file no longer matches this document, so it cannot be restored.',
    ],
    [
      'missing recorded checksum metadata',
      { exists: true, size: 100, metadata: {} },
      'document_file_changed',
      'The stored file no longer matches this document, so it cannot be restored.',
    ],
  ])('restore rejects a %s without reactivating the row', async (_label, head, error, message) => {
    seedDeletedDocument(database.state);
    storageHead = head;

    const response = await requestJson(server, '/api/documents/1/restore', { method: 'POST' });

    expect(response).toEqual({ status: 409, body: { error, message } });
    expect(database.state.documents.get(1).status).toBe('deleted');
    expect(database.state.lifecycles.get(1).current_state).toBe('deleted');
    expect(database.state.events).toEqual([]);
    expect(database.state.transactionCounts.begun).toBe(0);
  });

  test('restore fails closed when the database state changes after object verification', async () => {
    seedDeletedDocument(database.state);
    database.state.staleRestoreLock = true;

    const response = await requestJson(server, '/api/documents/1/restore', { method: 'POST' });

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'document_changed_retry',
        message: 'This document changed. Reload the list and try again.',
      },
    });
    expect(database.state.documents.get(1).status).toBe('deleted');
    expect(database.state.lifecycles.get(1).current_state).toBe('deleted');
    expect(database.state.events).toEqual([]);
    expect(database.state.transactionCounts).toEqual({
      begun: 1,
      committed: 0,
      rolledBack: 1,
      released: 1,
    });
  });

  test('restore rolls back document reactivation when the lifecycle transition does not apply', async () => {
    seedDeletedDocument(database.state);
    database.state.failOn = 'restoreLifecycleUpdate';

    const response = await requestJson(server, '/api/documents/1/restore', { method: 'POST' });

    expect(response).toEqual({
      status: 409,
      body: {
        error: 'document_changed_retry',
        message: 'This document changed. Reload the list and try again.',
      },
    });
    expect(database.state.documents.get(1).status).toBe('deleted');
    expect(database.state.lifecycles.get(1).current_state).toBe('deleted');
    expect(database.state.events).toEqual([]);
    expect(database.state.transactionCounts).toEqual({
      begun: 1,
      committed: 0,
      rolledBack: 1,
      released: 1,
    });
  });

  test('a System Administrator can restore a matching stored file atomically', async () => {
    seedDeletedDocument(database.state);

    const response = await requestJson(server, '/api/documents/1/restore', {
      method: 'POST',
      body: { reason: 'Confirmed the scan is needed' },
    });

    expect(response).toEqual({ status: 200, body: { ok: true, restored: true } });
    expect(storageProvider.headObject).toHaveBeenCalledWith({ key: 'uploads/manual/wrong-scan.pdf' });
    expect(database.state.documents.get(1).status).toBe('active');
    expect(database.state.lifecycles.get(1).current_state).toBe('active');
    expect(database.state.events).toEqual([
      expect.objectContaining({
        event_type: 'restored',
        from_state: 'deleted',
        to_state: 'active',
        actor_role_snapshot: 'System Administrator',
        reason: 'Confirmed the scan is needed',
      }),
    ]);
    expect(database.state.transactionCounts).toEqual({
      begun: 1,
      committed: 1,
      rolledBack: 0,
      released: 1,
    });
  });

  test('there is no permanent-delete HTTP route', async () => {
    const response = await requestJson(server, '/api/documents/1/permanent', { method: 'DELETE' });

    expect(response.status).toBe(404);
    expect(database.state.transactionCounts.begun).toBe(0);
  });
});

function seedDeletedDocument(state) {
  state.documents.get(1).status = 'deleted';
  state.lifecycles.set(1, {
    id: 501,
    document_id: 1,
    original_document_id: 1,
    current_state: 'deleted',
    lifecycle_generation: 1,
    deleted_at: '2026-08-24T12:10:00.000Z',
    deleted_by_staff_profile_id: 11,
    delete_reason: 'Uploaded the wrong scan',
    client_id: 100,
    case_id: 10,
    application_id: null,
    action_plan_id: null,
    source_snapshot: 'manual_upload',
    document_category: 'other',
    checksum_sha256: 'a'.repeat(64),
    size_bytes: 100,
  });
}
