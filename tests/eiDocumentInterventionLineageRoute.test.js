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

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

async function invokeRoute(handler, { params = {}, body = {} } = {}) {
  const req = {
    params,
    body,
    auth: {
      subjectType: 'staff',
      sub: 'ei-lineage-system-admin',
      email: 'ei-lineage-system-admin@example.invalid',
      role: 'System Administrator',
      staffProfileId: 900,
      regionIds: [],
    },
    staffProfile: {
      id: 900,
      display_name: 'System Administrator',
      email: 'ei-lineage-system-admin@example.invalid',
      primary_role: 'System Administrator',
    },
  };
  const response = { status: 200, body: null };
  const res = {
    status(code) {
      response.status = code;
      return this;
    },
    json(payload) {
      response.body = payload;
      return this;
    },
  };
  await handler(req, res);
  return response;
}

describe('EI verification document intervention-lineage route', () => {
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let dependencyStore;
  let syntheticTestEnvironment;
  let linkHandler;
  let documentRow;
  let existingLinks;
  let queries;
  let commits;
  let rollbacks;
  let releases;

  const interventionRows = new Map([
    [1, {
      intervention_id: 1,
      intervention_case_id: 10,
      intervention_action_plan_id: 20,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 20,
      action_plan_case_id: 10,
      action_plan_application_id: 100,
      owner_application_id: 100,
      application_case_id: 10,
    }],
    [2, {
      intervention_id: 2,
      intervention_case_id: 10,
      intervention_action_plan_id: 20,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 20,
      action_plan_case_id: 10,
      action_plan_application_id: 100,
      owner_application_id: 100,
      application_case_id: 10,
    }],
    [3, {
      intervention_id: 3,
      intervention_case_id: 10,
      intervention_action_plan_id: 21,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 21,
      action_plan_case_id: 10,
      action_plan_application_id: 101,
      owner_application_id: 101,
      application_case_id: 10,
    }],
    [4, {
      intervention_id: 4,
      intervention_case_id: 11,
      intervention_action_plan_id: 22,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 22,
      action_plan_case_id: 11,
      action_plan_application_id: 102,
      owner_application_id: 102,
      application_case_id: 11,
    }],
    [5, {
      intervention_id: 5,
      intervention_case_id: 10,
      intervention_action_plan_id: 23,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 23,
      action_plan_case_id: 10,
      action_plan_application_id: 100,
      owner_application_id: 100,
      application_case_id: 10,
    }],
    [6, {
      intervention_id: 6,
      intervention_case_id: 10,
      intervention_action_plan_id: 24,
      metadata_json: JSON.stringify({}),
      owner_action_plan_id: 24,
      action_plan_case_id: 10,
      action_plan_application_id: 103,
      owner_application_id: 103,
      application_case_id: 12,
    }],
  ]);

  beforeAll(async () => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;

    const query = jest.fn(async (statement, params = []) => {
      const sql = compactSql(statement);
      queries.push({ sql, params: [...params] });

      if (sql.includes('FROM iset_document d') && sql.endsWith('FOR UPDATE')) {
        return [[documentRow ? { ...documentRow } : undefined].filter(Boolean), []];
      }
      if (sql.includes('FROM iset_document_intervention') && sql.includes('document_id IN')) {
        return [existingLinks.map(interventionId => ({
          document_id: documentRow.id,
          intervention_id: interventionId,
        })), []];
      }
      if (sql.includes('AS intervention_case_id') && sql.includes('FROM iset_case_intervention i')) {
        return [params.map(id => interventionRows.get(Number(id))).filter(Boolean), []];
      }
      if (sql === 'DELETE FROM iset_document_intervention WHERE document_id = ?') {
        existingLinks = [];
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'INSERT INTO iset_document_intervention (document_id, intervention_id, created_at) VALUES ?') {
        existingLinks = (params[0] || []).map(row => Number(row[1]));
        return [{ affectedRows: existingLinks.length }, []];
      }

      throw new Error(`Unexpected SQL in EI document lineage route test: ${sql}`);
    });

    const connection = {
      query,
      execute: query,
      beginTransaction: jest.fn(async () => {}),
      commit: jest.fn(async () => { commits += 1; }),
      rollback: jest.fn(async () => { rollbacks += 1; }),
      release: jest.fn(() => { releases += 1; }),
    };
    const fakePool = {
      query,
      execute: query,
      getConnection: jest.fn(async () => connection),
    };

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = {
          subjectType: 'staff',
          sub: 'ei-lineage-system-admin',
          email: 'ei-lineage-system-admin@example.invalid',
          role: 'System Administrator',
          staffProfileId: 900,
          regionIds: [],
        };
        req.staffProfile = {
          id: 900,
          display_name: 'System Administrator',
          email: 'ei-lineage-system-admin@example.invalid',
          primary_role: 'System Administrator',
        };
        next();
      },
    });

    const { app } = require('../isetadminserver');
    const stack = app?._router?.stack || app?.router?.stack || [];
    const layer = stack.find(entry => (
      entry?.route?.path === '/api/documents/:id/link-interventions' &&
      entry.route.methods?.post
    ));
    linkHandler = layer?.route?.stack?.[0]?.handle || null;
    expect(typeof linkHandler).toBe('function');
  });

  beforeEach(() => {
    documentRow = {
      id: 501,
      case_id: 10,
      application_id: 100,
      action_plan_id: null,
      client_id: 40,
      applicant_user_id: 50,
      document_category: 'ei_verification',
    };
    existingLinks = [];
    queries = [];
    commits = 0;
    rollbacks = 0;
    releases = 0;
  });

  afterAll(async () => {
    if (dependencyStore) dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  const mutationQueries = () => queries.filter(({ sql }) => (
    sql.startsWith('DELETE FROM iset_document_intervention') ||
    sql.startsWith('INSERT INTO iset_document_intervention')
  ));

  test('application-scoped evidence links multiple interventions only within one exact application plan', async () => {
    const response = await invokeRoute(linkHandler, {
      params: { id: '501' },
      body: { interventionIds: [1, 2] },
    });

    expect(response).toEqual({
      status: 200,
      body: { ok: true, documentId: 501, interventionIds: [1, 2] },
    });
    expect(existingLinks).toEqual([1, 2]);
    expect(mutationQueries()).toHaveLength(2);
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
    expect(releases).toBe(1);
  });

  test('exact Action Plan evidence links within that plan without inventing application ownership', async () => {
    documentRow.application_id = null;
    documentRow.action_plan_id = 20;

    const response = await invokeRoute(linkHandler, {
      params: { id: '501' },
      body: { interventionIds: [1] },
    });

    expect(response).toEqual({
      status: 200,
      body: { ok: true, documentId: 501, interventionIds: [1] },
    });
    expect(existingLinks).toEqual([1]);
    expect(mutationQueries()).toHaveLength(2);
  });

  test.each([
    ['cross-case target', [4], 'document_case_mismatch'],
    ['sibling-application target', [3], 'document_application_mismatch'],
    ['mixed plans in one application', [1, 5], 'mixed_action_plan_targets'],
    ['incoherent Action Plan/application ownership', [6], 'action_plan_application_case_mismatch'],
  ])('rejects %s before deleting or inserting links', async (_label, targets, reason) => {
    const response = await invokeRoute(linkHandler, {
      params: { id: '501' },
      body: { interventionIds: targets },
    });

    expect(response).toMatchObject({
      status: 409,
      body: {
        error: 'ei_verification_lineage_mismatch',
        reason,
      },
    });
    expect(existingLinks).toEqual([]);
    expect(mutationQueries()).toHaveLength(0);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
    expect(releases).toBe(1);
  });

  test('existing links participate in the mixed-target validation before mutation', async () => {
    existingLinks = [1];

    const response = await invokeRoute(linkHandler, {
      params: { id: '501' },
      body: { interventionIds: [5] },
    });

    expect(response).toMatchObject({
      status: 409,
      body: {
        error: 'ei_verification_lineage_mismatch',
        reason: 'mixed_action_plan_targets',
      },
    });
    expect(existingLinks).toEqual([1]);
    expect(mutationQueries()).toHaveLength(0);
  });

  test('exact Action Plan evidence rejects a different plan even in the same application', async () => {
    documentRow.application_id = null;
    documentRow.action_plan_id = 20;

    const response = await invokeRoute(linkHandler, {
      params: { id: '501' },
      body: { interventionIds: [5] },
    });

    expect(response).toMatchObject({
      status: 409,
      body: {
        error: 'ei_verification_lineage_mismatch',
        reason: 'document_action_plan_mismatch',
      },
    });
    expect(existingLinks).toEqual([]);
    expect(mutationQueries()).toHaveLength(0);
  });
});
