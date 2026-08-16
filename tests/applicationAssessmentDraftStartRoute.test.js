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

const FIXTURE_IDS = Object.freeze({
  caseId: 9701,
  clientId: 9700,
  applicationId: 9702,
  staffProfileId: 9703,
  regionId: 9704,
  applicantUserId: 9705,
  assessmentId: 9706,
  declarationId: 9707,
});

function requestJson(server, path, { staffProfileId = FIXTURE_IDS.staffProfileId, body } = {}) {
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

describe('application assessment draft-start caller boundary', () => {
  let server;
  let dependencyStore;
  let queries;
  let commits;
  let rollbacks;
  let applicationStatus;
  let applicationLifecycleStatus;
  let applicationRowVersion;
  let activeDeclaration;
  let failStatusUpdate;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  const buildAccessRow = () => ({
    id: FIXTURE_IDS.caseId,
    client_id: FIXTURE_IDS.clientId,
    application_id: FIXTURE_IDS.applicationId,
    assigned_to_user_id: FIXTURE_IDS.staffProfileId,
    assigned_staff_profile_id: FIXTURE_IDS.staffProfileId,
    portfolio_region_id: FIXTURE_IDS.regionId,
    owner_region_id: FIXTURE_IDS.regionId,
  });

  // This is the exact result shape of the route's locking SELECT. In particular,
  // assignment is returned only through the assigned_to_user_id alias.
  const buildLockedCaseRow = () => ({
    status: 'active',
    lifecycle_status: 'active',
    closure_reason: null,
    application_id: FIXTURE_IDS.applicationId,
    client_id: FIXTURE_IDS.clientId,
    assigned_to_user_id: FIXTURE_IDS.staffProfileId,
    case_context_json: '{}',
    application_status: applicationStatus,
    application_lifecycle_status: applicationLifecycleStatus,
    application_decision_outcome: null,
    application_awaiting_reason: 'none',
    application_closure_reason: null,
    row_version: applicationRowVersion,
    docs_requested_active: 0,
    docs_requested_at: null,
    docs_requested_cleared_at: null,
    docs_requested_source: null,
    lock_owner_user_id: null,
    lock_owner_display_name: null,
    lock_owner_email: null,
    lock_expires_at: null,
  });

  const buildResponseRow = () => ({
    status: 'active',
    case_lifecycle_status: 'active',
    case_closure_reason: null,
    application_id: FIXTURE_IDS.applicationId,
    client_id: FIXTURE_IDS.clientId,
    case_context_json: '{}',
    application_status: applicationStatus,
    application_lifecycle_status: applicationLifecycleStatus,
    application_decision_outcome: null,
    application_awaiting_reason: 'none',
    application_closure_reason: null,
    docs_requested_active: 0,
    docs_requested_at: null,
    docs_requested_cleared_at: null,
    docs_requested_source: null,
    assigned_staff_profile_id: FIXTURE_IDS.staffProfileId,
    applicant_user_id: FIXTURE_IDS.applicantUserId,
    tracking_id: 'ISET-SYNTHETIC-9702',
    application_row_version: applicationRowVersion,
    assessment_date_of_assessment: null,
    case_summary: 'First assessment note',
    assessment_employment_barriers: null,
    assessment_local_area_priorities: null,
    assessment_itp: null,
    assessment_wage: null,
    assessment_conflict_declaration_signed: 1,
    assessment_conflict_declaration_signed_at: '2026-01-01 12:00:00',
    assessment_conflict_declaration_signed_by: FIXTURE_IDS.staffProfileId,
    assessment_conflict_declaration_choice: 'no_conflict',
    assessment_conflict_declaration_details: null,
    assessment_conflict_declaration_resolution_outcome: null,
    assessment_conflict_declaration_resolved_at: null,
    assessment_conflict_declaration_resolution_note: null,
  });

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    queries = [];
    commits = 0;
    rollbacks = 0;
    applicationStatus = 'submitted';
    applicationLifecycleStatus = 'submitted';
    applicationRowVersion = 7;
    activeDeclaration = true;
    failStatusUpdate = false;

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (sql.includes("scope='admin'") && sql.includes("k='locking'")) return [[], []];
      if (sql.includes('FROM information_schema.columns') && sql.includes("table_name = 'iset_case_assessment'")) {
        return [[{ cnt: 1 }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('sp.region_id AS owner_region_id')) {
        return [[buildAccessRow()], []];
      }
      if (sql === 'SELECT id, case_id FROM iset_application WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: FIXTURE_IDS.applicationId, case_id: FIXTURE_IDS.caseId }], []];
      }
      if (sql === 'SELECT id FROM iset_case WHERE id = ? LIMIT 1 FOR UPDATE') {
        return [[{ id: FIXTURE_IDS.caseId }], []];
      }
      if (sql.includes('LEFT JOIN application_lock al') && sql.endsWith('LIMIT 1 FOR UPDATE')) {
        return [[buildLockedCaseRow()], []];
      }
      if (sql.includes('FROM iset_application_assessment aa') && sql.includes('aa.application_id = ?')) {
        return [[{
          id: FIXTURE_IDS.assessmentId,
          case_id: FIXTURE_IDS.caseId,
          application_id: FIXTURE_IDS.applicationId,
          overview: null,
          intervention_budget_pot_id: null,
          posting_context: null,
          esdc_eligibility: null,
          _assessment_source: 'application_assessment',
        }], []];
      }
      if (sql.includes('FROM iset_runtime_config WHERE scope = ? AND k = ?')) {
        return [[{ v: JSON.stringify({ enabled: true }) }], []];
      }
      if (sql.includes('FROM iset_review_workflow') && sql.includes('subject_key = ?')) return [[], []];
      if (sql.includes('FROM iset_case_conflict_declaration') && sql.includes('revoked_at IS NULL')) {
        return [activeDeclaration ? [{
          id: FIXTURE_IDS.declarationId,
          declaration_choice: 'no_conflict',
          resolution_outcome: null,
        }] : [], []];
      }
      if (sql.startsWith('INSERT INTO iset_application_assessment')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('UPDATE iset_application SET status = ?')) {
        if (failStatusUpdate) throw new Error('simulated_status_update_failure');
        applicationStatus = params[0];
        applicationLifecycleStatus = params[1];
        return [{ affectedRows: 1 }, []];
      }
      if (sql === 'UPDATE iset_application SET row_version = row_version + 1 WHERE id = ?') {
        applicationRowVersion += 1;
        return [{ affectedRows: 1 }, []];
      }
      if (sql.includes('ca.date_of_assessment AS assessment_date_of_assessment')) {
        return [[buildResponseRow()], []];
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
        const staffProfileId = Number(req.headers['x-test-staff-profile-id'] || FIXTURE_IDS.staffProfileId);
        req.auth = {
          subjectType: 'staff',
          sub: `assessment-start-${staffProfileId}`,
          email: `assessment-start-${staffProfileId}@example.invalid`,
          role: 'Regional Manager',
          staffProfileId,
          regionId: FIXTURE_IDS.regionId,
          regionIds: [FIXTURE_IDS.regionId],
        };
        req.staffProfile = {
          id: staffProfileId,
          display_name: 'Assigned Regional Manager',
          name: 'Assigned Regional Manager',
          email: `assessment-start-${staffProfileId}@example.invalid`,
          primary_role: 'Regional Manager',
          region_id: FIXTURE_IDS.regionId,
        };
        next();
      },
    });

    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  beforeEach(() => {
    queries.length = 0;
    commits = 0;
    rollbacks = 0;
    applicationStatus = 'submitted';
    applicationLifecycleStatus = 'submitted';
    applicationRowVersion = 7;
    activeDeclaration = true;
    failStatusUpdate = false;
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
  });

  const buildDraftSaveBody = () => ({
    applicationId: FIXTURE_IDS.applicationId,
    expectedRowVersion: 7,
    case_summary: 'First assessment note',
  });

  test('the assigned Regional Manager starts the exact submitted application on first assessment save', async () => {
    const response = await requestJson(server, `/api/cases/${FIXTURE_IDS.caseId}`, {
      body: buildDraftSaveBody(),
    });

    expect(response).toMatchObject({
      status: 200,
      body: {
        success: true,
        application_status: 'in_review',
        application_lifecycle_status: 'in_review',
        application_row_version: 8,
        reviewWorkflow: null,
      },
    });
    const assessmentWrites = queries.filter(({ sql }) => sql.startsWith('INSERT INTO iset_application_assessment'));
    const statusWrites = queries.filter(({ sql }) => sql.startsWith('UPDATE iset_application SET status = ?'));
    expect(assessmentWrites).toHaveLength(1);
    expect(statusWrites).toHaveLength(1);
    expect(statusWrites[0].params).toEqual([
      'in_review',
      'in_review',
      null,
      'none',
      null,
      FIXTURE_IDS.applicationId,
    ]);
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO iset_review_workflow'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_case SET status = ?'))).toBe(false);
    expect(queries.some(({ sql }) => sql.includes('INSERT INTO iset_case_conflict_declaration'))).toBe(false);
    expect(commits).toBe(1);
    expect(rollbacks).toBe(0);
  });

  test('a missing active case declaration rejects the save before assessment or status writes', async () => {
    activeDeclaration = false;

    const response = await requestJson(server, `/api/cases/${FIXTURE_IDS.caseId}`, {
      body: buildDraftSaveBody(),
    });

    expect(response).toMatchObject({
      status: 409,
      body: { success: false, error: 'conflict_declaration_required' },
    });
    expect(queries.some(({ sql }) => sql.startsWith('INSERT INTO iset_application_assessment'))).toBe(false);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_application SET status = ?'))).toBe(false);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
  });

  test('a failed application transition rolls back the assessment write in the same transaction', async () => {
    failStatusUpdate = true;

    const response = await requestJson(server, `/api/cases/${FIXTURE_IDS.caseId}`, {
      body: buildDraftSaveBody(),
    });

    expect(response).toMatchObject({
      status: 500,
      body: { success: false, error: 'simulated_status_update_failure' },
    });
    expect(queries.some(({ sql }) => sql.startsWith('INSERT INTO iset_application_assessment'))).toBe(true);
    expect(queries.some(({ sql }) => sql.startsWith('UPDATE iset_application SET status = ?'))).toBe(true);
    expect(commits).toBe(0);
    expect(rollbacks).toBe(1);
  });
});
