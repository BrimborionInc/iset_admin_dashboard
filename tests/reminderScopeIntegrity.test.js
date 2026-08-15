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

const reminderRow = (overrides = {}) => ({
  id: 901,
  case_id: 10,
  application_id: null,
  action_plan_id: null,
  intervention_id: null,
  title: 'Follow up',
  description: null,
  category: 'Case follow-up',
  status: 'open',
  lifecycle_generation: 1,
  due_at: '2026-08-20 12:00:00',
  completed_at: null,
  completed_by_staff_profile_id: null,
  assigned_staff_profile_id: 77,
  metadata_json: '{}',
  created_at: '2026-08-15 09:00:00',
  created_by_staff_profile_id: 77,
  updated_at: '2026-08-15 09:00:00',
  updated_by_staff_profile_id: 77,
  deleted_at: null,
  ...overrides,
});

const caseAccessRow = () => ({
  id: 10,
  client_id: 5,
  application_id: 20,
  assigned_to_user_id: 77,
  assigned_staff_profile_id: 77,
  portfolio_region_id: 3,
  owner_region_id: 3,
});

function createFakePool() {
  const queries = [];
  let queryResponder = null;
  const query = jest.fn(async (sqlValue, params = []) => {
    const sql = compactSql(sqlValue);
    queries.push({ sql, params });
    if (queryResponder) {
      const response = await queryResponder(sql, params);
      if (typeof response !== 'undefined') return response;
    }
    return [[], []];
  });
  const connection = {
    query,
    execute: query,
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
  };
  const getConnection = jest.fn(async () => connection);
  return {
    queries,
    query,
    execute: query,
    connection,
    getConnection,
    setQueryResponder(responder) {
      queryResponder = responder;
    },
    reset() {
      queries.length = 0;
      queryResponder = null;
      query.mockClear();
      connection.beginTransaction.mockClear();
      connection.commit.mockClear();
      connection.rollback.mockClear();
      connection.release.mockClear();
      getConnection.mockClear();
    },
  };
}

async function invokeRoute(handler, { params = {}, query = {}, body = {} } = {}) {
  let status = 200;
  let responseBody = null;
  const req = {
    params,
    query,
    body,
    auth: {
      subjectType: 'staff',
      sub: 'reminder-scope-test',
      email: 'reminder-scope@example.invalid',
      role: 'System Administrator',
      staffProfileId: 77,
      userId: 700,
    },
    staffProfile: {
      id: 77,
      email: 'reminder-scope@example.invalid',
      primary_role: 'System Administrator',
      region_id: 3,
      regionIds: [3],
    },
  };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(payload) {
      responseBody = payload;
      return this;
    },
    set() {
      return this;
    },
    setHeader() {
      return this;
    },
  };
  await handler(req, res);
  return { status, body: responseBody };
}

function installCanonicalLineageResponder(fakePool, {
  initialReminder = reminderRow(),
  canonicalReminder = reminderRow({
    application_id: 20,
    action_plan_id: 30,
    intervention_id: 40,
  }),
  lockedReminder = null,
} = {}) {
  let reminderUpdated = false;
  fakePool.setQueryResponder(async (sql, params) => {
    if (sql.includes('FROM iset_case_reminder r') && sql.includes('WHERE r.id = ?')) {
      return [[reminderUpdated ? canonicalReminder : initialReminder], []];
    }
    if (sql.includes('FROM iset_case_reminder') && sql.includes('FOR UPDATE')) {
      return [[lockedReminder || initialReminder], []];
    }
    if (sql.includes('SELECT ci.id,') && sql.includes('FROM iset_case_intervention ci')) {
      return [[{
        id: 40,
        case_id: 10,
        action_plan_id: 30,
        action_plan_case_id: 10,
        action_plan_application_id: 20,
      }], []];
    }
    if (sql.includes('SELECT ap.id, ap.case_id, ap.application_id')) {
      return [[{ id: 30, case_id: 10, application_id: 20 }], []];
    }
    if (sql.includes('SELECT a.id, a.case_id') && sql.includes('FROM iset_application a')) {
      const applicationId = Number(params[0]);
      return [[{ id: applicationId, case_id: 10 }], []];
    }
    if (sql.includes('FROM iset_case c') && sql.includes('WHERE c.id = ?')) {
      return [[caseAccessRow()], []];
    }
    if (sql.includes('SELECT ci.*,') && sql.includes('FROM iset_case_intervention ci')) {
      return [[{ id: 40, case_id: 10, action_plan_id: 30, metadata_json: '{}' }], []];
    }
    if (sql.startsWith('UPDATE iset_case_reminder')) {
      reminderUpdated = true;
      return [{ affectedRows: 1 }, []];
    }
    if (sql === 'SELECT id FROM user WHERE cognito_sub = ? LIMIT 1') {
      return [[{ id: 700 }], []];
    }
    return undefined;
  });
}

describe('reminder canonical scope persistence', () => {
  let fakePool;
  let dependencyStore;
  let createHandler;
  let listHandler;
  let updateHandler;
  let acknowledgeHandler;
  let exported;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;

  beforeAll(() => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    fakePool = createFakePool();
    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (_req, _res, next) => next(),
    });

    exported = require('../isetadminserver');
    const { app } = exported;
    const stack = app?._router?.stack || app?.router?.stack || [];
    const findHandler = (path, method) => {
      const layer = stack.find(entry => entry?.route?.path === path && entry.route.methods?.[method]);
      return layer?.route?.stack?.[0]?.handle || null;
    };
    createHandler = findHandler('/api/reminders', 'post');
    listHandler = findHandler('/api/reminders', 'get');
    updateHandler = findHandler('/api/reminders/:reminderId', 'put');
    acknowledgeHandler = findHandler('/api/reminders/:reminderId/acknowledge', 'post');
    expect(typeof createHandler).toBe('function');
    expect(typeof listHandler).toBe('function');
    expect(typeof updateHandler).toBe('function');
    expect(typeof acknowledgeHandler).toBe('function');
  });

  beforeEach(() => {
    fakePool.reset();
  });

  afterAll(() => {
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  test('keeps an explicitly case-only reminder case-only on creation', async () => {
    let inserted = false;
    fakePool.setQueryResponder(async (sql, params) => {
      if (sql.includes('FROM iset_case c') && sql.includes('WHERE c.id = ?')) {
        return [[caseAccessRow()], []];
      }
      if (sql.startsWith('INSERT INTO iset_case_reminder')) {
        expect(params.slice(0, 4)).toEqual([10, null, null, null]);
        inserted = true;
        return [{ insertId: 903, affectedRows: 1 }, []];
      }
      if (sql.includes('FROM iset_case_reminder r') && sql.includes('WHERE r.id = ?')) {
        return [[reminderRow({ id: 903 })], []];
      }
      return undefined;
    });

    const response = await invokeRoute(createHandler, {
      body: { caseId: 10, title: 'Case-only follow up' },
    });

    expect(response.status).toBe(201);
    expect(inserted).toBe(true);
    expect(response.body).toMatchObject({
      id: 903,
      caseId: 10,
      applicationId: null,
      actionPlanId: null,
      interventionId: null,
    });
  });

  test('application calendar lists app A plus true case-only reminders, while case mode remains case-wide', async () => {
    const applicationAReminder = reminderRow({ id: 910, application_id: 20, action_plan_id: 30 });
    const applicationBReminder = reminderRow({ id: 911, application_id: 21, action_plan_id: 31 });
    const caseOnlyReminder = reminderRow({ id: 912 });
    fakePool.setQueryResponder(async (sql, params) => {
      if (sql.includes('SELECT a.id, a.case_id') && sql.includes('FROM iset_application a')) {
        return [[{ id: Number(params[0]), case_id: 10 }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('WHERE c.id = ?')) {
        return [[caseAccessRow()], []];
      }
      if (sql.includes('FROM iset_case_reminder r') && !sql.includes('WHERE r.id = ?')) {
        return [
          sql.includes('r.application_id = ?')
            ? [applicationAReminder, caseOnlyReminder]
            : [applicationAReminder, applicationBReminder, caseOnlyReminder],
          [],
        ];
      }
      return undefined;
    });

    const applicationResponse = await invokeRoute(listHandler, {
      query: { caseId: '10', applicationId: '20', scopeMode: 'application' },
    });
    expect(applicationResponse.status).toBe(200);
    expect(applicationResponse.body.map(item => item.id)).toEqual([910, 912]);
    const applicationListQuery = fakePool.queries.find(({ sql }) => (
      sql.includes('FROM iset_case_reminder r') && sql.includes('r.application_id = ?')
    ));
    expect(applicationListQuery?.sql).toContain(
      'r.case_id = ? AND ( r.application_id = ? OR ( r.application_id IS NULL AND r.action_plan_id IS NULL AND r.intervention_id IS NULL ) )'
    );
    expect(applicationListQuery?.params.slice(0, 2)).toEqual([10, 20]);

    const caseResponse = await invokeRoute(listHandler, {
      query: { caseId: '10', scopeMode: 'case' },
    });
    expect(caseResponse.status).toBe(200);
    expect(caseResponse.body.map(item => item.id)).toEqual([910, 911, 912]);
    const caseListQuery = fakePool.queries
      .filter(({ sql }) => sql.includes('FROM iset_case_reminder r'))
      .find(({ sql }) => !sql.includes('r.application_id = ?'));
    expect(caseListQuery?.sql).toContain('r.case_id = ?');
  });

  test('the list filter contract never treats app-less plan or intervention reminders as case-only', () => {
    const filter = exported.buildReminderListScopeFilter({
      caseId: 10,
      applicationId: 20,
      scopeMode: 'application',
    });
    expect(compactSql(filter.clause)).toContain(
      'r.application_id IS NULL AND r.action_plan_id IS NULL AND r.intervention_id IS NULL'
    );
    expect(filter.params).toEqual([10, 20]);
  });

  test('a deepest-only PUT persists the complete canonical lineage atomically', async () => {
    installCanonicalLineageResponder(fakePool);

    const response = await invokeRoute(updateHandler, {
      params: { reminderId: '901' },
      body: { interventionId: 40 },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      caseId: 10,
      applicationId: 20,
      actionPlanId: 30,
      interventionId: 40,
    });
    const update = fakePool.queries.find(({ sql }) => (
      sql.startsWith('UPDATE iset_case_reminder SET') && sql.includes('intervention_id = ?')
    ));
    expect(update?.sql).toContain('case_id = ?');
    expect(update?.sql).toContain('application_id = ?');
    expect(update?.sql).toContain('action_plan_id = ?');
    expect(update?.params).toEqual([10, 20, 30, 40, 77, 901]);
  });

  test('rejects an explicit parent that conflicts with the deepest target before mutation', async () => {
    installCanonicalLineageResponder(fakePool);

    const response = await invokeRoute(updateHandler, {
      params: { reminderId: '901' },
      body: { applicationId: 21, interventionId: 40 },
    });

    expect(response).toEqual({
      status: 409,
      body: { error: 'reminder_intervention_application_scope_mismatch' },
    });
    expect(fakePool.queries.some(({ sql }) => sql.startsWith('UPDATE iset_case_reminder SET'))).toBe(false);
  });

  test('acknowledgement repairs canonical columns and emits the exact plan/intervention lineage', async () => {
    const lockedReminder = reminderRow({
      id: 902,
      intervention_id: 40,
    });
    installCanonicalLineageResponder(fakePool, { initialReminder: lockedReminder, lockedReminder });

    const response = await invokeRoute(acknowledgeHandler, {
      params: { reminderId: '902' },
      body: {
        scopeMode: 'application',
        expectedCaseId: 10,
        expectedApplicationId: 20,
      },
    });

    expect(response).toEqual({
      status: 200,
      body: {
        ok: true,
        reminderId: 902,
        noteId: null,
        caseId: 10,
        applicationId: 20,
        actionPlanId: 30,
        interventionId: 40,
      },
    });
    const update = fakePool.queries.find(({ sql }) => (
      sql.startsWith('UPDATE iset_case_reminder') && sql.includes("status = 'completed'")
    ));
    expect(update?.params.slice(0, 4)).toEqual([10, 20, 30, 40]);

    const eventInsert = fakePool.queries.find(({ sql }) => sql.startsWith('INSERT INTO iset_event_entry'));
    const eventPayload = eventInsert?.params
      .map(value => {
        if (typeof value !== 'string' || !value.startsWith('{')) return null;
        try { return JSON.parse(value); } catch (_) { return null; }
      })
      .find(value => value?.reminder_id === 902);
    expect(eventPayload).toMatchObject({
      reminder_id: 902,
      case_id: 10,
      application_id: 20,
      action_plan_id: 30,
      intervention_id: 40,
      status: 'completed',
    });
    expect(fakePool.connection.commit).toHaveBeenCalledTimes(1);
    expect(fakePool.connection.rollback).not.toHaveBeenCalled();
  });

  test('application workspace acknowledgement rejects app B before mutation', async () => {
    const siblingApplicationReminder = reminderRow({
      id: 913,
      application_id: 21,
    });
    installCanonicalLineageResponder(fakePool, {
      initialReminder: siblingApplicationReminder,
      lockedReminder: siblingApplicationReminder,
      canonicalReminder: siblingApplicationReminder,
    });

    const response = await invokeRoute(acknowledgeHandler, {
      params: { reminderId: '913' },
      body: {
        scopeMode: 'application',
        expectedCaseId: 10,
        expectedApplicationId: 20,
      },
    });

    expect(response).toEqual({
      status: 409,
      body: { error: 'reminder_workspace_application_scope_mismatch' },
    });
    expect(fakePool.queries.some(({ sql }) => (
      sql.startsWith('UPDATE iset_case_reminder') && sql.includes("status = 'completed'")
    ))).toBe(false);
    expect(fakePool.connection.rollback).toHaveBeenCalledTimes(1);
    expect(fakePool.connection.commit).not.toHaveBeenCalled();
  });

  test('acknowledgement fails closed before opening a transaction when workspace scope is omitted', async () => {
    const response = await invokeRoute(acknowledgeHandler, {
      params: { reminderId: '913' },
      body: {},
    });

    expect(response).toEqual({
      status: 400,
      body: { error: 'reminder_scope_expectation_required' },
    });
    expect(fakePool.getConnection).not.toHaveBeenCalled();
    expect(fakePool.queries).toEqual([]);
  });

  test('application workspace acknowledgement permits a true case-only reminder', async () => {
    const caseOnlyReminder = reminderRow({
      id: 914,
      metadata_json: JSON.stringify({ case_note_id: 9550 }),
    });
    installCanonicalLineageResponder(fakePool, {
      initialReminder: caseOnlyReminder,
      lockedReminder: caseOnlyReminder,
      canonicalReminder: caseOnlyReminder,
    });

    const response = await invokeRoute(acknowledgeHandler, {
      params: { reminderId: '914' },
      body: {
        scopeMode: 'application',
        expectedCaseId: 10,
        expectedApplicationId: 20,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      reminderId: 914,
      noteId: 9550,
      caseId: 10,
      applicationId: null,
      actionPlanId: null,
      interventionId: null,
    });
    const noteUpdate = fakePool.queries.find(({ sql }) => sql.startsWith('UPDATE iset_case_note'));
    expect(noteUpdate?.sql).toContain('follow_up_at = NULL');
    expect(noteUpdate?.sql).toContain('reminder_id = NULL');
    expect(noteUpdate?.sql).not.toContain('SET deleted_at');
    expect(fakePool.connection.commit).toHaveBeenCalledTimes(1);
    expect(fakePool.connection.rollback).not.toHaveBeenCalled();
  });
});
