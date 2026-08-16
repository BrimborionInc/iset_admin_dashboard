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

const compactSql = value => String(value || '').replace(/\s+/gu, ' ').trim();

let exported;
let previousRepairExports;
let previousTestEnvironmentFile;
let syntheticTestEnvironment;

beforeAll(() => {
  previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  syntheticTestEnvironment = createSyntheticTestEnvironment();
  process.env.NODE_ENV = 'test';
  process.env.PATH_REPAIR_EXPORTS = '1';
  process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
  exported = require('../isetadminserver');
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

function buildConnection({
  applications = [],
  actionPlans = [],
  interventions = [],
  submissions = [],
  historySubmissionIds = [],
  validatedSubmissions = {},
} = {}) {
  const calls = [];
  const connection = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    query: jest.fn(async (statement, params = []) => {
      const sql = compactSql(statement);
      calls.push({ sql, params: [...params] });
      if (sql.includes('FROM iset_case c') && sql.endsWith('LIMIT 1 FOR UPDATE')) {
        return [[{
          id: 51,
          status: 'active',
          case_context_json: JSON.stringify({ retained: true }),
          assigned_staff_profile_id: 60,
        }], []];
      }
      if (sql.includes('FROM iset_application a') && sql.includes('FOR UPDATE')) {
        return [applications, []];
      }
      if (sql.includes('FROM iset_case_action_plan ap') && sql.includes('FOR UPDATE')) {
        return [actionPlans, []];
      }
      if (sql.includes('FROM iset_case_intervention ci') && sql.includes('FOR UPDATE')) {
        return [interventions, []];
      }
      if (sql.includes('FROM iset_case_reminder')) {
        return [[{ total: 0 }], []];
      }
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('eps.case_id = ?')) {
        return [submissions, []];
      }
      if (sql.includes('FROM esdc_participant_submission_history h')) {
        return [historySubmissionIds.map(participant_submission_id => ({ participant_submission_id })), []];
      }
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('eps.id = ?')) {
        const row = validatedSubmissions[Number(params[0])] || null;
        return [[row].filter(Boolean), []];
      }
      if (sql.startsWith('UPDATE iset_case SET status = ?')) {
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected ready-to-close query: ${sql}`);
    }),
  };
  return { connection, calls };
}

const terminalApplications = [
  { id: 101, status: 'denied', lifecycle_status: 'closed' },
  { id: 202, status: 'withdrawn', lifecycle_status: 'closed' },
];

describe('ready-to-close repeat-application and reporting integrity', () => {
  test('canonical lifecycle takes precedence over legacy decision status', () => {
    expect(exported.isTerminalApplicationState('denied', 'decision_recorded')).toBe(false);
    expect(exported.isTerminalApplicationState('approved', 'decision_recorded')).toBe(false);
    expect(exported.isTerminalApplicationState('denied', 'closed')).toBe(true);
    expect(exported.isTerminalApplicationState('denied', null)).toBe(true);

    const rankSql = compactSql(exported.buildApplicationTerminalRankSql('a'));
    expect(rankSql).toContain("WHEN REPLACE(REPLACE(LOWER(TRIM(COALESCE(a.lifecycle_status, '')))");
    expect(rankSql.indexOf("a.lifecycle_status")).toBeLessThan(rankSql.indexOf("a.status"));
    expect(rankSql).toContain("IN ('closed', 'archived') THEN 1 ELSE 0 END");
  });

  test('a denied application still awaiting its communication blocks case readiness', async () => {
    const { connection } = buildConnection({
      applications: [{ id: 101, status: 'denied', lifecycle_status: 'decision_recorded' }],
    });

    await expect(exported.markCaseReadyToClose({ caseId: 51, connection })).rejects.toMatchObject({
      message: 'ready_to_close_blockers',
      statusCode: 409,
      blockers: { applications: 1 },
    });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('a nonterminal sibling application blocks case readiness before ILMP initialization', async () => {
    const { connection, calls } = buildConnection({
      applications: [
        { id: 101, status: 'denied', lifecycle_status: 'closed' },
        { id: 202, status: 'submitted', lifecycle_status: 'intake' },
      ],
    });
    const ensureSubmissionRecord = jest.fn();
    const validateSubmissionRecord = jest.fn();

    await expect(exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord,
      validateSubmissionRecord,
    })).rejects.toMatchObject({
      message: 'ready_to_close_blockers',
      statusCode: 409,
      blockers: { applications: 1 },
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(ensureSubmissionRecord).not.toHaveBeenCalled();
    expect(validateSubmissionRecord).not.toHaveBeenCalled();
    expect(calls.some(call => call.sql.startsWith('UPDATE iset_case'))).toBe(false);
  });

  test('immutable reporting evidence is consumed without revalidation while an untouched seeded plan is ignored', async () => {
    const acceptedSubmission = {
      id: 701,
      case_id: 51,
      action_plan_id: 11,
      application_id: 101,
      readiness_status: 'ready',
      readiness_summary: JSON.stringify({ mandatory: { complete: 4, total: 4 } }),
      warnings: JSON.stringify([]),
      blocking_issues: JSON.stringify([]),
      last_validated_at: '2026-08-14 12:00:00',
      submission_status: 'accepted',
      submitted_at: '2026-08-14 12:10:00',
      payload_snapshot: JSON.stringify({ immutable: true }),
      payload_storage_key: 'participants/51/accepted.xml',
      payload_checksum: 'accepted-checksum',
      rejection_reason: null,
    };
    const submittedSubmission = {
      id: 702,
      case_id: 51,
      action_plan_id: 12,
      application_id: 202,
      readiness_status: 'ready',
      readiness_summary: JSON.stringify({ mandatory: { complete: 4, total: 4 } }),
      warnings: JSON.stringify([]),
      blocking_issues: JSON.stringify([]),
      last_validated_at: '2026-08-14 13:00:00',
      submission_status: 'submitted',
      submitted_at: '2026-08-14 13:10:00',
      payload_snapshot: JSON.stringify({ immutable: true }),
      payload_storage_key: 'participants/51/submitted.xml',
      payload_checksum: 'submitted-checksum',
      rejection_reason: null,
    };
    const { connection, calls } = buildConnection({
      applications: terminalApplications,
      actionPlans: [
        {
          id: 11,
          case_id: 51,
          application_id: 101,
          status: 'closed',
          metadata_json: JSON.stringify({ source: 'denied_reporting' }),
        },
        {
          id: 12,
          case_id: 51,
          application_id: 202,
          status: 'closed',
          metadata_json: JSON.stringify({ source: 'auto_assessment' }),
        },
        {
          id: 13,
          case_id: 51,
          application_id: 202,
          status: 'closed',
          metadata_json: JSON.stringify({ source: 'auto_assessment' }),
        },
      ],
      interventions: [{
        id: 1201,
        action_plan_id: 12,
        status: 'approved',
        delivery_status: 'completed',
        metadata_json: JSON.stringify({}),
      }],
      submissions: [acceptedSubmission, submittedSubmission],
      historySubmissionIds: [701, 702],
      validatedSubmissions: {
        701: acceptedSubmission,
        702: submittedSubmission,
      },
    });
    const ensureSubmissionRecord = jest.fn(async (_connection, _caseId, _applicationId, actionPlanId) => {
      if (actionPlanId === 11) return 701;
      if (actionPlanId === 12) return 702;
      throw new Error(`Unexpected Action Plan initialization: ${actionPlanId}`);
    });
    const validateSubmissionRecord = jest.fn(async () => ({}));

    const result = await exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord,
      validateSubmissionRecord,
    });

    expect(ensureSubmissionRecord.mock.calls.map(call => call[3])).toEqual([11, 12]);
    expect(validateSubmissionRecord).not.toHaveBeenCalled();
    expect(result.compliance.ilmp.status).toBe('clean');
    expect(result.compliance.ilmp.summary.submissions.map(row => row.actionPlanId)).toEqual([11, 12]);
    expect(result.compliance.ilmp.summary.submissions.some(row => row.actionPlanId === 13)).toBe(false);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    expect(calls.some(call => call.sql.startsWith('UPDATE esdc_participant_submission'))).toBe(false);
    expect(calls.some(call => call.sql.includes('submission_status ='))).toBe(false);
    expect(calls.some(call => call.sql.includes('payload_snapshot = NULL'))).toBe(false);
    expect(calls.some(call =>
      call.sql.includes('SET status = ?, lifecycle_status = ?, closure_reason = NULL') &&
      call.params[0] === 'ready_to_close' &&
      call.params[1] === 'ready_to_close'
    )).toBe(true);
  });

  test('immutable evidence marked stale requires explicit requeue instead of live revalidation', async () => {
    const staleSubmission = {
      id: 705,
      case_id: 51,
      action_plan_id: 15,
      application_id: 101,
      readiness_status: 'needs_review',
      readiness_summary: null,
      warnings: null,
      blocking_issues: null,
      last_validated_at: null,
      submission_status: 'submitted',
      submitted_at: '2026-08-14 14:00:00',
      payload_snapshot: JSON.stringify({ immutable: true }),
      payload_storage_key: 'participants/51/submitted-705.xml',
      payload_checksum: 'submitted-705-checksum',
      rejection_reason: null,
    };
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [{
        id: 15,
        case_id: 51,
        application_id: 101,
        status: 'closed',
        metadata_json: JSON.stringify({ source: 'denied_reporting' }),
      }],
      submissions: [staleSubmission],
      historySubmissionIds: [705],
    });
    const ensureSubmissionRecord = jest.fn(async () => 705);
    const validateSubmissionRecord = jest.fn();

    await expect(exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord,
      validateSubmissionRecord,
    })).rejects.toMatchObject({
      code: 'esdc_submission_requeue_required',
      statusCode: 409,
      submissionId: 705,
      submissionStatus: 'submitted',
      evidenceFailures: ['stored_readiness_not_clean'],
    });

    expect(validateSubmissionRecord).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test.each([
    ['payload snapshot', { payload_snapshot: null }, 'payload_snapshot_missing'],
    ['payload checksum', { payload_checksum: null }, 'payload_checksum_missing'],
  ])('immutable clean evidence missing its %s fails closed', async (_label, override, expectedFailure) => {
    const immutableSubmission = {
      id: 706,
      case_id: 51,
      action_plan_id: 16,
      application_id: 101,
      readiness_status: 'ready',
      readiness_summary: JSON.stringify({ mandatory: { complete: 4, total: 4 } }),
      warnings: JSON.stringify([]),
      blocking_issues: JSON.stringify([]),
      last_validated_at: '2026-08-14 15:00:00',
      submission_status: 'accepted',
      submitted_at: '2026-08-14 15:10:00',
      payload_snapshot: JSON.stringify({ immutable: true }),
      payload_storage_key: 'participants/51/accepted-706.xml',
      payload_checksum: 'accepted-706-checksum',
      rejection_reason: null,
      ...override,
    };
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [{
        id: 16,
        case_id: 51,
        application_id: 101,
        status: 'closed',
        metadata_json: JSON.stringify({ source: 'denied_reporting' }),
      }],
      submissions: [immutableSubmission],
      historySubmissionIds: [706],
    });
    const validateSubmissionRecord = jest.fn();

    await expect(exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord: jest.fn(async () => 706),
      validateSubmissionRecord,
    })).rejects.toMatchObject({
      code: 'esdc_submission_requeue_required',
      statusCode: 409,
      submissionId: 706,
      evidenceFailures: [expectedFailure],
    });

    expect(validateSubmissionRecord).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  test('mutable reporting evidence is revalidated inside the ready-to-close transaction', async () => {
    const pendingSubmission = {
      id: 707,
      case_id: 51,
      action_plan_id: 17,
      application_id: 101,
      readiness_status: 'needs_review',
      readiness_summary: null,
      warnings: null,
      blocking_issues: null,
      last_validated_at: null,
      submission_status: 'pending',
      submitted_at: null,
      payload_snapshot: null,
      payload_storage_key: null,
      payload_checksum: null,
      rejection_reason: null,
    };
    const validatedSubmission = {
      ...pendingSubmission,
      readiness_status: 'ready',
      readiness_summary: JSON.stringify({ mandatory: { complete: 4, total: 4 } }),
      warnings: JSON.stringify([]),
      blocking_issues: JSON.stringify([]),
      last_validated_at: '2026-08-15 08:00:00',
    };
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [{
        id: 17,
        case_id: 51,
        application_id: 101,
        status: 'closed',
        metadata_json: JSON.stringify({ source: 'denied_reporting' }),
      }],
      submissions: [pendingSubmission],
      validatedSubmissions: { 707: validatedSubmission },
    });
    const validateSubmissionRecord = jest.fn(async () => ({}));

    const result = await exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord: jest.fn(async () => 707),
      validateSubmissionRecord,
    });

    expect(validateSubmissionRecord).toHaveBeenCalledWith(
      { submissionId: 707, caseId: 51 },
      { connection, transaction: false }
    );
    expect(result.compliance.ilmp.status).toBe('clean');
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test('a reporting submission linked to a sibling application fails closed', async () => {
    const { connection } = buildConnection({
      applications: terminalApplications,
      actionPlans: [{
        id: 11,
        case_id: 51,
        application_id: 101,
        status: 'closed',
        metadata_json: JSON.stringify({ source: 'denied_reporting' }),
      }],
      submissions: [{
        id: 701,
        case_id: 51,
        action_plan_id: 11,
        application_id: 202,
        readiness_status: 'ready',
        submission_status: 'accepted',
        payload_checksum: 'immutable-checksum',
      }],
      historySubmissionIds: [701],
    });
    const ensureSubmissionRecord = jest.fn();
    const validateSubmissionRecord = jest.fn();

    await expect(exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord,
      validateSubmissionRecord,
    })).rejects.toMatchObject({
      code: 'ready_to_close_submission_application_scope_mismatch',
      statusCode: 409,
      actionPlanId: 11,
      submissionId: 701,
      applicationId: 202,
    });

    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(ensureSubmissionRecord).not.toHaveBeenCalled();
    expect(validateSubmissionRecord).not.toHaveBeenCalled();
  });

  test('an untouched pending seeded record does not create an ILMP closure obligation', async () => {
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [{
        id: 13,
        case_id: 51,
        application_id: 101,
        status: 'closed',
        metadata_json: JSON.stringify({ source: 'auto_assessment' }),
      }],
      submissions: [{
        id: 703,
        case_id: 51,
        action_plan_id: 13,
        application_id: 101,
        readiness_status: 'needs_review',
        readiness_summary: null,
        warnings: null,
        blocking_issues: null,
        last_validated_at: null,
        submission_status: 'pending',
        submitted_at: null,
        payload_snapshot: null,
        payload_storage_key: null,
        payload_checksum: null,
        rejection_reason: null,
      }],
    });
    const ensureSubmissionRecord = jest.fn();
    const validateSubmissionRecord = jest.fn();

    const result = await exported.markCaseReadyToClose({
      caseId: 51,
      connection,
      ensureSubmissionRecord,
      validateSubmissionRecord,
    });

    expect(ensureSubmissionRecord).not.toHaveBeenCalled();
    expect(validateSubmissionRecord).not.toHaveBeenCalled();
    expect(result.compliance.ilmp).toMatchObject({
      status: 'clean',
      summary: { notRequired: true, submissions: [] },
    });
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('an unknown nonarchived plan status fails closed', async () => {
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [{
        id: 14,
        case_id: 51,
        application_id: 101,
        status: null,
        archived_at: null,
        metadata_json: null,
      }],
    });

    await expect(exported.markCaseReadyToClose({ caseId: 51, connection })).rejects.toMatchObject({
      message: 'ready_to_close_blockers',
      statusCode: 409,
      blockers: { actionPlans: 1 },
    });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  test('durable submission evidence pointing outside the case plan inventory fails closed', async () => {
    const { connection } = buildConnection({
      applications: [terminalApplications[0]],
      actionPlans: [],
      submissions: [{
        id: 704,
        case_id: 51,
        action_plan_id: 999,
        application_id: 101,
        readiness_status: 'ready',
        submission_status: 'accepted',
        payload_checksum: 'durable-checksum',
      }],
      historySubmissionIds: [704],
    });

    await expect(exported.markCaseReadyToClose({ caseId: 51, connection })).rejects.toMatchObject({
      code: 'ready_to_close_submission_plan_scope_mismatch',
      statusCode: 409,
      submissionId: 704,
      actionPlanId: 999,
    });
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });
});
