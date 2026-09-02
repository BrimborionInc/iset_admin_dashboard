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

let exported;
let previousRepairExports;

beforeAll(() => {
  previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  process.env.NODE_ENV = 'test';
  process.env.PATH_REPAIR_EXPORTS = '1';
  exported = require('../isetadminserver');
});

afterAll(async () => {
  if (exported?.pool && typeof exported.pool.end === 'function') {
    await exported.pool.end();
  }
  if (previousRepairExports === undefined) delete process.env.PATH_REPAIR_EXPORTS;
  else process.env.PATH_REPAIR_EXPORTS = previousRepairExports;
});

describe('denied reporting application boundary', () => {
  test('an active sibling application does not inherit or resynchronise the prior denial', async () => {
    const calls = [];
    const connection = {
      async query(statement, params = []) {
        const sql = String(statement).replace(/\s+/gu, ' ').trim();
        calls.push({ sql, params });
        if (sql.startsWith('SELECT * FROM iset_application WHERE id = ?')) {
          return [[{
            id: 202,
            case_id: 51,
            status: 'submitted',
            lifecycle_status: 'submitted',
            closure_reason: null,
            payload_json: JSON.stringify({ answers: { name: 'Second application' } }),
          }], []];
        }
        if (sql.includes('FROM iset_application a') && sql.includes('JOIN iset_case c') && sql.includes('WHERE a.id = ?')) {
          return [[{
            id: 51,
            case_context_json: JSON.stringify({
              reportingOnlyDenied: true,
              reportingTrigger: 'denial',
              reportingSeedSource: 'denied_reporting',
              applicationId: 101,
              applicationReportingArtifacts: {
                101: {
                  reportingTrigger: 'denial',
                  reportingSeedSource: 'denied_reporting',
                  reportingCorrectionAllowed: true,
                },
              },
            }),
          }], []];
        }
        throw new Error(`Unexpected application-boundary query: ${sql}`);
      },
    };

    const result = await exported.syncDeniedReportingForApplicationIfNeeded(connection, {
      applicationId: 202,
    });

    expect(result).toBeNull();
    expect(calls).toHaveLength(2);
    expect(calls.some(call => call.sql.includes('iset_case_action_plan'))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('UPDATE '))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
  });

  test('a meaningful sibling prevents the denial from becoming a case-wide reporting-only state', async () => {
    let queryIndex = 0;
    const connection = {
      async query() {
        queryIndex += 1;
        if (queryIndex === 1) return [[{ count: 0 }], []];
        if (queryIndex === 2) return [[{ count: 1 }], []];
        throw new Error('Unexpected case-mode query');
      },
    };

    const result = await exported.resolveApplicationReportingCaseMode(connection, {
      caseId: 51,
      applicationId: 101,
    });

    expect(result).toEqual({
      caseLevelReportingOnly: false,
      nonReportingPlanCount: 0,
      meaningfulOtherApplicationCount: 1,
    });
  });

  test('application-contained denial context removes stale case-wide flags but preserves both artifacts', () => {
    const result = exported.buildDeniedReportingCaseContext({
      existingCaseContext: {
        reportingOnlyDenied: true,
        reportingCorrectionAllowed: true,
        excludeFromCaseworkQueues: true,
        reportingTrigger: 'denial',
        reportingSeedSource: 'denied_reporting',
        applicationId: 101,
        applicationReportingArtifacts: {
          101: { reportingTrigger: 'denial', reportingSeedSource: 'denied_reporting' },
        },
      },
      applicationId: 202,
      reportingDate: '2026-08-15',
      reportingTrigger: 'denial',
      caseLevelReportingOnly: false,
    });

    expect(result.excludeFromCaseworkQueues).toBeUndefined();
    expect(result.reportingOnlyDenied).toBeUndefined();
    expect(result.applicationId).toBeUndefined();
    expect(result.applicationReportingArtifacts['101'].reportingTrigger).toBe('denial');
    expect(result.applicationReportingArtifacts['202'].reportingTrigger).toBe('denial');
    expect(result.applicationReportingArtifacts['202'].caseLevelReportingOnly).toBe(false);
  });

  test('withdrawal reporting stays on the exact application and preserves sibling denial history', () => {
    const siblingDenial = {
      reportingTrigger: 'denial',
      reportingSeedSource: 'denied_reporting',
      reportingCorrectionAllowed: true,
      reportingDeniedAt: '2026-08-01',
    };

    const result = exported.buildDeniedReportingCaseContext({
      existingCaseContext: {
        applicationReportingArtifacts: { 101: siblingDenial },
      },
      applicationId: 233,
      clientId: 44,
      reportingDate: '2026-09-02',
      reportingTrigger: 'withdrawal',
      caseLevelReportingOnly: true,
    });

    expect(result).toMatchObject({
      reportingTrigger: 'withdrawal',
      reportingSeedSource: 'withdrawn_reporting',
      reportingOnlyWithdrawal: true,
      reportingWithdrawnAt: '2026-09-02',
      applicationId: 233,
      clientId: 44,
    });
    expect(result.reportingOnlyDenied).toBeUndefined();
    expect(result.reportingOnlyDeniedIneligible).toBeUndefined();
    expect(result.fundingDecisionReasonCode).toBeUndefined();
    expect(result.applicationReportingArtifacts['101']).toEqual(siblingDenial);
    expect(result.applicationReportingArtifacts['233']).toMatchObject({
      reportingTrigger: 'withdrawal',
      reportingSeedSource: 'withdrawn_reporting',
      reportingOnly: true,
      caseLevelReportingOnly: true,
      reportingCorrectionAllowed: true,
      reportingDate: '2026-09-02',
      reportingWithdrawnAt: '2026-09-02',
    });
  });

  test('ESDC initialization rejects an Action Plan linked to another application', async () => {
    const calls = [];
    const connection = {
      async query(statement, params = []) {
        const sql = String(statement).replace(/\s+/gu, ' ').trim();
        calls.push({ sql, params });
        if (sql.startsWith('SELECT case_id, application_id FROM iset_case_action_plan')) {
          return [[{ case_id: 51, application_id: 101 }], []];
        }
        throw new Error(`Unexpected ESDC scope query: ${sql}`);
      },
    };

    await expect(
      exported.ensureEsdcParticipantSubmissionRecord(connection, 51, 202, 700)
    ).rejects.toMatchObject({ code: 'esdc_action_plan_scope_mismatch' });
    expect(calls).toHaveLength(1);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
  });

  test('admin repeat intake reopens the reused case and clears only case-wide reporting state', async () => {
    const calls = [];
    const historicalArtifact = {
      reportingTrigger: 'denial',
      reportingSeedSource: 'denied_reporting',
    };
    const connection = {
      async query(statement, params = []) {
        const sql = String(statement).replace(/\s+/gu, ' ').trim();
        calls.push({ sql, params });
        if (sql.includes('FROM iset_case c') && sql.includes('WHERE c.client_id = ?')) {
          return [[{
            id: 51,
            application_id: 101,
            client_id: 44,
            case_number: 'ISET-EXISTING-51',
            status: 'closed',
            lifecycle_status: 'closed',
            closure_reason: 'application_denied',
            closed_at: '2026-08-01 12:00:00',
            case_context_json: JSON.stringify({
              reportingOnlyDenied: true,
              reportingCorrectionAllowed: true,
              excludeFromCaseworkQueues: true,
              applicationId: 101,
              applicationReportingArtifacts: { 101: historicalArtifact },
            }),
            assigned_staff_profile_id: 9501,
            assigned_to_user_id: 9501,
            portfolio_region_id: 9,
          }], []];
        }
        if (sql.startsWith('UPDATE iset_case SET')) {
          return [{ affectedRows: 1 }, []];
        }
        throw new Error(`Unexpected admin repeat-intake query: ${sql}`);
      },
    };

    const result = await exported.resolveOrCreateCaseForClient(connection, {
      clientId: 44,
      status: 'submitted',
      lifecycleStatus: 'intake',
      reopenForNewApplication: true,
    });

    expect(result.created).toBe(false);
    expect(result.caseId).toBe(51);
    expect(result.status).toBe('submitted');
    expect(result.lifecycleStatus).toBe('intake');
    const updateCall = calls.find(call => call.sql.startsWith('UPDATE iset_case SET'));
    expect(updateCall).toBeTruthy();
    expect(updateCall.sql).toMatch(/case_context_json = \?/u);
    expect(updateCall.sql).toMatch(/status = \?/u);
    expect(updateCall.sql).toMatch(/lifecycle_status = \?/u);
    expect(updateCall.sql).toMatch(/closure_reason = NULL/u);
    expect(updateCall.sql).toMatch(/closed_at = NULL/u);
    const persistedContext = JSON.parse(updateCall.params[0]);
    expect(persistedContext.excludeFromCaseworkQueues).toBeUndefined();
    expect(persistedContext.applicationReportingArtifacts['101']).toEqual(historicalArtifact);
  });
});
