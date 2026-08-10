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

jest.setTimeout(30000);

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

function requestJson(server, path, { staffProfileId = 60, body } = {}) {
  const address = server.address();
  const encodedBody = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(encodedBody),
        'x-test-staff-profile-id': String(staffProfileId),
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
    request.write(encodedBody);
    request.end();
  });
}

describe('application decision-letter save caller boundary', () => {
  let server;
  let dependencyStore;
  let reviewStage;
  let storedCaseContext;
  let queries;
  let commits;
  let rollbacks;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  const buildWorkflowRow = () => ({
    id: 11,
    workflow_type: 'application_assessment',
    subject_key: 'application_assessment:application:27',
    case_id: 109,
    application_id: 27,
    action_plan_id: null,
    intervention_id: null,
    proposal_id: null,
    current_stage: reviewStage,
    current_owner_role: null,
    current_owner_staff_profile_id: null,
    submitted_by_staff_profile_id: 60,
    submitted_at: '2026-08-07 12:00:00',
    rm_reviewed_by_staff_profile_id: 71,
    rm_reviewed_at: '2026-08-08 12:00:00',
    rm_review_note: null,
    nwac_decided_by_staff_profile_id: 81,
    nwac_decided_at: '2026-08-09 12:00:00',
    nwac_decision: reviewStage === 'final_decision_recorded' ? 'approved' : null,
    nwac_decision_note: null,
    metadata_json: JSON.stringify({ source: 'application_assessment_review_action' }),
    archived_at: null,
    created_at: '2026-08-07 12:00:00',
    updated_at: '2026-08-09 12:00:00',
  });

  const buildCaseRow = () => ({
    id: 109,
    status: 'active',
    lifecycle_status: 'active',
    case_lifecycle_status: 'active',
    closure_reason: null,
    case_closure_reason: null,
    application_id: 27,
    client_id: 44,
    assigned_to_user_id: 60,
    assigned_staff_profile_id: 60,
    portfolio_region_id: 9,
    owner_region_id: 9,
    case_context_json: JSON.stringify(storedCaseContext),
    application_status: 'approved',
    application_lifecycle_status: 'decision_recorded',
    application_decision_outcome: 'approved',
    decision_outcome: 'approved',
    application_awaiting_reason: 'none',
    application_closure_reason: null,
    row_version: 7,
    application_row_version: 7,
    docs_requested_active: 0,
    docs_requested_at: null,
    docs_requested_cleared_at: null,
    docs_requested_source: null,
    lock_owner_user_id: null,
    lock_owner_display_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
    applicant_user_id: 501,
    tracking_id: 'TEST-APP-27',
  });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    reviewStage = 'final_decision_recorded';
    storedCaseContext = {};
    queries = [];
    commits = 0;
    rollbacks = 0;

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (sql.includes("scope='admin'") && sql.includes("k='locking'")) {
        return [[], []];
      }
      if (sql.includes('FROM information_schema.columns') && sql.includes("table_name = 'iset_case_assessment'")) {
        return [[{ cnt: 1 }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('sp.region_id AS owner_region_id')) {
        return [[buildCaseRow()], []];
      }
      if (sql === 'SELECT id, case_id FROM iset_application WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 27, case_id: 109 }], []];
      }
      if (sql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: 109 }], []];
      }
      if (sql.includes('LEFT JOIN application_lock al') && sql.endsWith('LIMIT 1 FOR UPDATE')) {
        return [[buildCaseRow()], []];
      }
      if (sql.includes('FROM iset_runtime_config WHERE scope = ? AND k = ?')) {
        return [[{ v: JSON.stringify({ enabled: true }) }], []];
      }
      if (sql.includes('FROM iset_review_workflow') && sql.includes('subject_key = ?')) {
        return [[buildWorkflowRow()], []];
      }
      if (sql === 'UPDATE iset_case SET case_context_json = ? WHERE id = ?') {
        storedCaseContext = JSON.parse(params[0]);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('ca.date_of_assessment AS assessment_date_of_assessment')) {
        return [[buildCaseRow()], []];
      }
      if (sql.includes('SELECT display_name, name FROM staff_profiles WHERE id = ?')) {
        return [[{ display_name: 'Assigned Coordinator', name: 'Assigned Coordinator' }], []];
      }

      return [[], []];
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
      authnMiddlewareFactory: () => (req, _res, next) => {
        const staffProfileId = Number(req.headers['x-test-staff-profile-id'] || 60);
        req.auth = {
          subjectType: 'staff',
          sub: `letter-route-${staffProfileId}`,
          email: `letter-route-${staffProfileId}@example.invalid`,
          role: 'ISET Coordinator',
          staffProfileId,
          regionId: 9,
          regionIds: [9],
        };
        req.staffProfile = {
          id: staffProfileId,
          display_name: 'Assigned Coordinator',
          name: 'Assigned Coordinator',
          email: `letter-route-${staffProfileId}@example.invalid`,
          primary_role: 'ISET Coordinator',
          region_id: 9,
        };
        next();
      },
    });

    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  beforeEach(() => {
    reviewStage = 'final_decision_recorded';
    storedCaseContext = {
      applicationAnswers: { goal: 'Existing goal' },
      applicationPersonal: { firstName: 'Test' },
      applicationDecisionLetters: {
        27: {
          assessment_nwac_review_status: 'approve',
          decisionLetterDrafts: {
            approval: { decision_intro: 'Old approval draft' },
          },
        },
      },
    };
    queries.length = 0;
    commits = 0;
    rollbacks = 0;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
  });

  const buildLetterSaveBody = () => ({
    applicationId: 27,
    expectedRowVersion: 7,
    caseContext: {
      ...storedCaseContext,
      applicationDecisionLetters: {
        ...storedCaseContext.applicationDecisionLetters,
        27: {
          ...storedCaseContext.applicationDecisionLetters[27],
          decisionLetterDrafts: {
            approval: { decision_intro: 'Updated approval draft' },
          },
        },
      },
    },
  });

  test('assigned Coordinator saves a final-decision letter draft without mutating decision or ESDC state', async () => {
    const response = await requestJson(server, '/api/cases/109', {
      staffProfileId: 60,
      body: buildLetterSaveBody(),
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        success: true,
        application_status: 'approved',
        decision_outcome: 'approved',
        application_row_version: 7,
      },
    });
    expect(storedCaseContext.applicationDecisionLetters[27]).toMatchObject({
      assessment_nwac_review_status: 'approve',
      decisionLetterDrafts: {
        approval: { decision_intro: 'Updated approval draft' },
      },
    });
    expect(queries.filter(({ sql }) => sql === 'UPDATE iset_case SET case_context_json = ? WHERE id = ?')).toHaveLength(1);
    expect(queries.some(({ sql }) => sql.includes('UPDATE esdc_participant_submission'))).toBe(false);
    expect(queries.some(({ sql }) => sql.includes('UPDATE iset_application_assessment'))).toBe(false);
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
  });

  test('the same letter payload remains blocked before the final decision is recorded', async () => {
    reviewStage = 'nwac_review';

    const response = await requestJson(server, '/api/cases/109', {
      staffProfileId: 60,
      body: buildLetterSaveBody(),
    });

    expect(response).toMatchObject({
      status: 409,
      body: {
        success: false,
        error: 'assessment_communication_not_ready',
      },
    });
    expect(queries.some(({ sql }) => sql === 'UPDATE iset_case SET case_context_json = ? WHERE id = ?')).toBe(false);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
  });

  test('a different Coordinator cannot use the letter path on another staff member\'s case', async () => {
    const response = await requestJson(server, '/api/cases/109', {
      staffProfileId: 61,
      body: buildLetterSaveBody(),
    });

    expect(response).toMatchObject({
      status: 403,
      body: {
        success: false,
        error: 'forbidden',
        detail: 'assessor_scope_mismatch',
      },
    });
    expect(queries.some(({ sql }) => sql === 'UPDATE iset_case SET case_context_json = ? WHERE id = ?')).toBe(false);
    expect(commits).toBe(0);
  });
});
