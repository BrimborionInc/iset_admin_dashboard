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
const CASE_ID = 9811;
const CLIENT_ID = 9812;
const STAFF_PROFILE_ID = 9813;
const REGION_ID = 9814;

async function invokeParticipantDetailsRoute(handler, body, {
  staffProfileId = STAFF_PROFILE_ID,
  role = 'ISET Coordinator',
} = {}) {
  let status = 200;
  let responseBody = null;
  const req = {
    params: { id: String(CASE_ID) },
    body,
    auth: {
      subjectType: 'staff',
      sub: `participant-details-${staffProfileId}`,
      email: `participant-details-${staffProfileId}@example.invalid`,
      role,
      staffProfileId,
      regionId: REGION_ID,
      regionIds: [REGION_ID],
    },
    staffProfile: {
      id: staffProfileId,
      email: `participant-details-${staffProfileId}@example.invalid`,
      primary_role: role,
      region_id: REGION_ID,
      regionIds: [REGION_ID],
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
  };
  await handler(req, res);
  return { status, body: responseBody };
}

describe('Participant Details case-only route', () => {
  let routeHandler;
  let dependencyStore;
  let queries;
  let commits;
  let rollbacks;
  let storedContext;
  let linkedApplicationId;
  let failIlmpInvalidation;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;

  const buildStoredContext = () => ({
    address: { line1: '1 Old Street', postalCode: 'OLD' },
    mailingAddress: { postalCode: 'OLD MAIL' },
    applicationPersonal: {
      first_name: 'Existing',
      address: { line1: '1 Old Street', postalCode: 'OLD' },
    },
    applicationAnswers: {
      'first-name': 'Existing',
      'address-postcode': 'OLD',
    },
    applicationDecisionLetters: {
      27: { status: 'sent', sentAt: '2026-08-20T12:00:00.000Z' },
    },
    applicationAssessmentContexts: {
      27: { assessment_nwac_review_status: 'approve' },
      28: { assessment_nwac_review_status: 'push_back' },
    },
    reportingArtifacts: {
      latestExportChecksum: 'immutable-checksum',
    },
    unrelatedCaseState: { keep: true },
  });

  beforeAll(() => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    queries = [];
    commits = 0;
    rollbacks = 0;
    storedContext = buildStoredContext();
    linkedApplicationId = 27;
    failIlmpInvalidation = false;

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (sql === 'SELECT case_context_json FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ case_context_json: JSON.stringify(storedContext) }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('sp.region_id AS owner_region_id')) {
        return [[{
          id: CASE_ID,
          client_id: CLIENT_ID,
          application_id: linkedApplicationId,
          assigned_to_user_id: STAFF_PROFILE_ID,
          assigned_staff_profile_id: STAFF_PROFILE_ID,
          portfolio_region_id: REGION_ID,
          owner_region_id: REGION_ID,
        }], []];
      }
      if (sql.startsWith('UPDATE iset_case SET case_context_json = ?, updated_at = NOW() WHERE id = ?')) {
        storedContext = JSON.parse(params[0]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission eps')) {
        if (failIlmpInvalidation) throw new Error('simulated_ilmp_invalidation_failure');
        return [{ affectedRows: 2 }, []];
      }
      throw new Error(`Unexpected Participant Details SQL: ${sql}`);
    });

    const fakePool = {
      query,
      execute: query,
      getConnection: async () => ({
        query,
        execute: query,
        beginTransaction: async () => {},
        commit: async () => { commits += 1; },
        rollback: async () => { rollbacks += 1; },
        release: () => {},
      }),
    };

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (_req, _res, next) => next(),
    });

    const { app } = require('../isetadminserver');
    const stack = app?._router?.stack || app?.router?.stack || [];
    const routeLayer = stack.find(layer => (
      layer?.route?.path === '/api/cases/:id/participant-details' &&
      layer.route.methods?.patch
    ));
    routeHandler = routeLayer?.route?.stack?.[0]?.handle || null;
    expect(typeof routeHandler).toBe('function');
  });

  beforeEach(() => {
    queries.length = 0;
    commits = 0;
    rollbacks = 0;
    storedContext = buildStoredContext();
    linkedApplicationId = 27;
    failIlmpInvalidation = false;
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

  test.each([
    ['application-less', null],
    ['application-backed with repeat-application context', 27],
  ])('saves a postal correction without application mutation machinery for %s cases', async (_label, applicationId) => {
    linkedApplicationId = applicationId;
    const decisionStateBefore = JSON.parse(JSON.stringify(storedContext.applicationDecisionLetters));
    const assessmentStateBefore = JSON.parse(JSON.stringify(storedContext.applicationAssessmentContexts));
    const reportingStateBefore = JSON.parse(JSON.stringify(storedContext.reportingArtifacts));

    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: { postalCode: 'K1A 0B1' },
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        success: true,
        changed: true,
        ilmpNeedsReview: true,
        caseContext: {
          address: { line1: '1 Old Street', postalCode: 'K1A 0B1' },
          applicationPersonal: {
            first_name: 'Existing',
            address: { line1: '1 Old Street', postalCode: 'K1A 0B1' },
          },
          applicationAnswers: {
            'first-name': 'Existing',
            'address-postcode': 'K1A 0B1',
          },
        },
      },
    });
    expect(storedContext.applicationDecisionLetters).toEqual(decisionStateBefore);
    expect(storedContext.applicationAssessmentContexts).toEqual(assessmentStateBefore);
    expect(storedContext.reportingArtifacts).toEqual(reportingStateBefore);
    expect(storedContext.unrelatedCaseState).toEqual({ keep: true });

    const ilmpWrite = queries.find(({ sql }) => sql.startsWith('UPDATE esdc_participant_submission eps'));
    expect(ilmpWrite.params).toEqual([CASE_ID]);
    expect(ilmpWrite.sql).toContain("IN ('submitted', 'accepted') THEN eps.payload_snapshot");
    expect(ilmpWrite.sql).toContain("IN ('submitted', 'accepted') THEN eps.payload_storage_key");
    expect(ilmpWrite.sql).toContain("IN ('submitted', 'accepted') THEN eps.payload_checksum");
    expect(queries.some(({ sql }) => sql.includes('application_lock'))).toBe(false);
    expect(queries.some(({ sql }) => sql.includes('iset_application_assessment'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_application '))).toBe(false);
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
  });

  test.each([
    ['Regional Manager', STAFF_PROFILE_ID + 1],
    ['NWAC Administrator', STAFF_PROFILE_ID + 2],
    ['System Administrator', STAFF_PROFILE_ID + 3],
  ])('allows an authorized %s to make the same direct-case correction', async (role, staffProfileId) => {
    linkedApplicationId = null;
    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: { postalCode: 'K1A 0B1' },
    }, { role, staffProfileId });

    expect(response).toMatchObject({
      status: 200,
      body: { success: true, changed: true, ilmpNeedsReview: true },
    });
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
  });

  test('a no-op succeeds without rewriting the case or invalidating ILMP', async () => {
    storedContext.applicationPersonal.address.postalCode = 'OLD';
    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: { postalCode: 'OLD' },
    });

    expect(response).toMatchObject({
      status: 200,
      body: { success: true, changed: false, ilmpNeedsReview: false },
    });
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_case SET'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE esdc_participant_submission'))).toBe(false);
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
  });

  test('rejects application-owned fields before opening a transaction', async () => {
    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: {
        postalCode: 'K1A 0B1',
        applicationDecisionLetters: { 27: { status: 'draft' } },
      },
    });

    expect(response).toMatchObject({
      status: 400,
      body: {
        success: false,
        error: 'invalid_participant_details',
        field: 'applicationDecisionLetters',
      },
    });
    expect(queries).toHaveLength(0);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(0);
  });

  test('enforces normal case ownership before either write', async () => {
    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: { postalCode: 'K1A 0B1' },
    }, { staffProfileId: STAFF_PROFILE_ID + 1 });

    expect(response).toMatchObject({ status: 403, body: { success: false, error: 'forbidden' } });
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_case SET'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE esdc_participant_submission'))).toBe(false);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
  });

  test('rolls back the case update when ILMP invalidation fails', async () => {
    failIlmpInvalidation = true;
    const response = await invokeParticipantDetailsRoute(routeHandler, {
      participantDetails: { postalCode: 'K1A 0B1' },
    });

    expect(response).toMatchObject({
      status: 500,
      body: { success: false, error: 'participant_details_update_failed' },
    });
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_case SET'))).toBe(true);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE esdc_participant_submission'))).toBe(true);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
  });
});
