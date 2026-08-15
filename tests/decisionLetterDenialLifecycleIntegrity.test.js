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

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();
const terminalApplicationStatuses = new Set([
  'approved',
  'completed',
  'complete',
  'rejected',
  'declined',
  'denied',
  'withdrawn',
  'cancelled',
  'closed',
  'archived',
]);

function createLifecycleFixture({
  caseStatus = 'intake',
  caseClosureReason = null,
  siblingApplication = null,
  plans = [],
  applicationUpdateConflict = false,
} = {}) {
  const targetApplication = {
    id: 27,
    case_id: 109,
    status: 'rejected',
    lifecycle_status: 'decision_recorded',
    decision_outcome: null,
    awaiting_reason: 'none',
    closure_reason: 'administrative',
    row_version: 5,
  };
  const applications = [
    targetApplication,
    ...(siblingApplication ? [{ case_id: 109, ...siblingApplication }] : []),
  ];
  const caseRow = {
    id: 109,
    status: caseStatus,
    lifecycle_status: caseStatus,
    closure_reason: caseClosureReason,
    closed_at: caseStatus === 'closed' ? '2026-08-14 12:00:00' : null,
    case_context_json: JSON.stringify({}),
  };
  const reminders = [{ id: 701, case_id: 109, status: 'open', deleted_at: null }];
  const queries = [];

  const isTerminalApplication = application => {
    const status = String(application.status || '').trim().toLowerCase();
    const lifecycle = String(application.lifecycle_status || '').trim().toLowerCase();
    return terminalApplicationStatuses.has(status) || ['closed', 'archived'].includes(lifecycle);
  };

  const connection = {
    query: jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (
        sql.includes('FROM iset_application a JOIN iset_case c ON c.id = a.case_id') &&
        sql.endsWith('LIMIT 1 FOR UPDATE')
      ) {
        const application = applications.find(row => row.id === Number(params[0]) && row.case_id === Number(params[1]));
        return [[application ? {
          ...application,
          case_context_json: caseRow.case_context_json,
        } : undefined].filter(Boolean), []];
      }

      if (sql === 'UPDATE iset_case SET case_context_json = ?, updated_at = NOW() WHERE id = ?') {
        if (Number(params[1]) !== caseRow.id) return [{ affectedRows: 0 }, []];
        caseRow.case_context_json = params[0];
        return [{ affectedRows: 1 }, []];
      }

      if (sql.startsWith("UPDATE iset_application SET status = 'completed'")) {
        if (applicationUpdateConflict) return [{ affectedRows: 0 }, []];
        const application = applications.find(row => row.id === Number(params[0]) && row.case_id === Number(params[1]));
        if (!application) return [{ affectedRows: 0 }, []];
        application.status = 'completed';
        application.lifecycle_status = 'closed';
        application.decision_outcome = 'denied';
        application.awaiting_reason = 'none';
        application.closure_reason = null;
        application.row_version += 1;
        return [{ affectedRows: 1 }, []];
      }

      if (sql.startsWith('SELECT c.id, c.status, c.lifecycle_status, c.closure_reason')) {
        return [[{
          id: caseRow.id,
          status: caseRow.status,
          lifecycle_status: caseRow.lifecycle_status,
          closure_reason: caseRow.closure_reason,
          application_id: applications.find(application => !isTerminalApplication(application))?.id || targetApplication.id,
        }], []];
      }

      if (sql.includes('FROM iset_case_action_plan ap') && sql.includes('AS active_count')) {
        const ordinaryPlans = plans.filter(plan => !plan.reportingOnly);
        const countStatus = status => ordinaryPlans.filter(plan => plan.status === status).length;
        return [[{
          active_count: countStatus('active'),
          closed_count: countStatus('closed'),
          archived_count: countStatus('archived'),
          draft_count: countStatus('draft'),
          total_count: ordinaryPlans.length,
        }], []];
      }

      if (sql.includes('FROM iset_application a') && sql.includes('AS open_count')) {
        const caseApplications = applications.filter(application => application.case_id === Number(params[0]));
        return [[{
          total_count: caseApplications.length,
          open_count: caseApplications.filter(application => !isTerminalApplication(application)).length,
          withdrawn_count: caseApplications.filter(application => (
            String(application.status || '').toLowerCase() === 'withdrawn' ||
            String(application.closure_reason || '').toLowerCase() === 'withdrawn'
          )).length,
          archived_count: caseApplications.filter(application => (
            String(application.status || '').toLowerCase() === 'archived' ||
            String(application.lifecycle_status || '').toLowerCase() === 'archived'
          )).length,
          denied_count: caseApplications.filter(application => (
            ['rejected', 'declined', 'denied'].includes(String(application.status || '').toLowerCase()) ||
            String(application.decision_outcome || '').toLowerCase() === 'denied'
          )).length,
        }], []];
      }

      if (sql.startsWith('UPDATE iset_case SET status = ?, lifecycle_status = ?, closure_reason = ?')) {
        if (Number(params[4]) !== caseRow.id) return [{ affectedRows: 0 }, []];
        caseRow.status = params[0];
        caseRow.lifecycle_status = params[1];
        caseRow.closure_reason = params[2];
        if (['closed', 'archived'].includes(params[3]) && !caseRow.closed_at) {
          caseRow.closed_at = '2026-08-15 12:00:00';
        }
        return [{ affectedRows: 1 }, []];
      }

      if (sql.startsWith("UPDATE iset_case_reminder SET status = 'cancelled'")) {
        const caseId = Number(params[1]);
        let affectedRows = 0;
        reminders.forEach(reminder => {
          if (reminder.case_id === caseId && reminder.status === 'open' && reminder.deleted_at === null) {
            reminder.status = 'cancelled';
            reminder.deleted_at = '2026-08-15 12:00:00';
            affectedRows += 1;
          }
        });
        return [{ affectedRows }, []];
      }

      throw new Error(`Unexpected SQL in decision-letter lifecycle fixture: ${sql}`);
    }),
  };

  return {
    connection,
    targetApplication,
    applications,
    caseRow,
    reminders,
    queries,
  };
}

describe('denial-letter completion aggregate lifecycle integrity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let recordApplicationDecisionLetterSent;
  let exported;
  let syntheticTestEnvironment;

  beforeAll(() => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    exported = require('../isetadminserver');
    ({ recordApplicationDecisionLetterSent } = exported);
  });

  afterAll(async () => {
    if (exported?.pool && typeof exported.pool.end === 'function') {
      await exported.pool.end();
    }
    if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
    else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
    if (previousTestEnvironmentFile === undefined) delete process.env.PATH_TEST_ENV_FILE;
    else process.env.PATH_TEST_ENV_FILE = previousTestEnvironmentFile;
    if (syntheticTestEnvironment) {
      expect(syntheticTestEnvironment.cleanup()).toBe(true);
    }
  });

  test('last-application denial closes the application and case, clears stale application closure, and cancels reminders', async () => {
    const fixture = createLifecycleFixture();

    const result = await recordApplicationDecisionLetterSent({
      caseId: 109,
      applicationId: 27,
      letterKey: 'denial',
      sentAt: '2026-08-15T12:00:00.000Z',
      connection: fixture.connection,
    });

    expect(result).toMatchObject({
      updated: true,
      applicationUpdated: true,
      decisionOutcome: 'denied',
      closureReason: null,
      status: 'completed',
      lifecycleStatus: 'closed',
      caseStatus: 'closed',
      caseStatusChanged: true,
      applicationRowVersion: 6,
    });
    expect(fixture.targetApplication).toMatchObject({
      status: 'completed',
      lifecycle_status: 'closed',
      decision_outcome: 'denied',
      awaiting_reason: 'none',
      closure_reason: null,
      row_version: 6,
    });
    expect(fixture.caseRow).toMatchObject({
      status: 'closed',
      lifecycle_status: 'closed',
      closure_reason: 'application_denied',
    });
    expect(fixture.reminders[0]).toMatchObject({ status: 'cancelled' });
  });

  test('an open sibling application keeps the long-lived case in intake and leaves reminders open', async () => {
    const fixture = createLifecycleFixture({
      caseStatus: 'closed',
      caseClosureReason: 'application_denied',
      siblingApplication: {
        id: 28,
        status: 'submitted',
        lifecycle_status: 'submitted',
        decision_outcome: null,
        awaiting_reason: 'none',
        closure_reason: null,
        row_version: 2,
      },
    });

    const result = await recordApplicationDecisionLetterSent({
      caseId: 109,
      applicationId: 27,
      letterKey: 'denial',
      sentAt: '2026-08-15T12:00:00.000Z',
      connection: fixture.connection,
    });

    expect(result).toMatchObject({
      decisionOutcome: 'denied',
      caseStatus: 'intake',
      caseStatusChanged: true,
    });
    expect(fixture.caseRow).toMatchObject({
      status: 'intake',
      lifecycle_status: 'intake',
      closure_reason: null,
    });
    expect(fixture.applications.find(application => application.id === 28)).toMatchObject({
      status: 'submitted',
      lifecycle_status: 'submitted',
    });
    expect(fixture.reminders[0]).toMatchObject({ status: 'open', deleted_at: null });
  });

  test('an active ordinary Action Plan keeps the case active and leaves reminders open', async () => {
    const fixture = createLifecycleFixture({
      caseStatus: 'closed',
      caseClosureReason: 'application_denied',
      plans: [{ id: 901, status: 'active', reportingOnly: false }],
    });

    const result = await recordApplicationDecisionLetterSent({
      caseId: 109,
      applicationId: 27,
      letterKey: 'denial',
      sentAt: '2026-08-15T12:00:00.000Z',
      connection: fixture.connection,
    });

    expect(result).toMatchObject({
      decisionOutcome: 'denied',
      caseStatus: 'active',
      caseStatusChanged: true,
    });
    expect(fixture.caseRow).toMatchObject({
      status: 'active',
      lifecycle_status: 'active',
      closure_reason: null,
    });
    expect(fixture.reminders[0]).toMatchObject({ status: 'open', deleted_at: null });
  });

  test('an exact application update conflict stops before aggregate lifecycle mutation', async () => {
    const fixture = createLifecycleFixture({ applicationUpdateConflict: true });

    await expect(recordApplicationDecisionLetterSent({
      caseId: 109,
      applicationId: 27,
      letterKey: 'denial',
      sentAt: '2026-08-15T12:00:00.000Z',
      connection: fixture.connection,
    })).rejects.toThrow('decision_letter_application_update_conflict');

    expect(fixture.targetApplication).toMatchObject({
      status: 'rejected',
      lifecycle_status: 'decision_recorded',
      decision_outcome: null,
      closure_reason: 'administrative',
      row_version: 5,
    });
    expect(fixture.queries.some(({ sql }) => sql.includes('AS active_count'))).toBe(false);
    expect(fixture.caseRow).toMatchObject({
      status: 'intake',
      lifecycle_status: 'intake',
      closure_reason: null,
    });
    expect(fixture.reminders[0]).toMatchObject({ status: 'open', deleted_at: null });
  });
});
