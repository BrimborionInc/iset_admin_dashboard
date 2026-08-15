const fs = require('fs');
const path = require('path');
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

function buildTransactionalConnection(queryResponder) {
  const calls = [];
  const connection = {
    beginTransaction: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
    release: jest.fn(),
    query: jest.fn(async (statement, params = []) => {
      const sql = compactSql(statement);
      calls.push({ sql, params: [...params] });
      const result = await queryResponder(sql, params, calls);
      if (typeof result === 'undefined') {
        throw new Error(`Unexpected ESDC integrity query: ${sql}`);
      }
      return result;
    }),
  };
  return { connection, calls };
}

const preparedSubmission = (overrides = {}) => ({
  id: 81,
  submission_status: 'pending',
  readiness_status: 'ready',
  readiness_summary: JSON.stringify({ mandatory: { complete: 4, total: 4 } }),
  warnings: JSON.stringify([]),
  blocking_issues: JSON.stringify([]),
  payload_snapshot: JSON.stringify({ xml: '<client />' }),
  payload_checksum: 'prepared-checksum',
  ...overrides,
});

describe('ESDC participant submission lineage and evidence integrity', () => {
  test('ensure returns only a submission whose case, Action Plan, and application all match', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (statement, params = []) => {
        const sql = compactSql(statement);
        calls.push({ sql, params: [...params] });
        if (sql.startsWith('SELECT case_id, application_id FROM iset_case_action_plan')) {
          return [[{ case_id: 51, application_id: 101 }], []];
        }
        if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('eps.action_plan_id = ?')) {
          return [[{
            id: 801,
            case_id: 51,
            action_plan_id: 700,
            application_id: 101,
          }], []];
        }
        throw new Error(`Unexpected exact-ensure query: ${sql}`);
      }),
    };

    await expect(
      exported.ensureEsdcParticipantSubmissionRecord(connection, 51, 101, 700)
    ).resolves.toBe(801);
    expect(calls).toHaveLength(2);
    expect(calls.some(call => call.sql.startsWith('INSERT INTO esdc_participant_submission'))).toBe(false);
  });

  test('ensure fails closed when the Action Plan submission belongs to a sibling application', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (statement, params = []) => {
        const sql = compactSql(statement);
        calls.push({ sql, params: [...params] });
        if (sql.startsWith('SELECT case_id, application_id FROM iset_case_action_plan')) {
          return [[{ case_id: 51, application_id: 101 }], []];
        }
        if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('eps.action_plan_id = ?')) {
          return [[{
            id: 802,
            case_id: 51,
            action_plan_id: 700,
            application_id: 202,
          }], []];
        }
        throw new Error(`Unexpected exact-ensure query: ${sql}`);
      }),
    };

    await expect(
      exported.ensureEsdcParticipantSubmissionRecord(connection, 51, 101, 700)
    ).rejects.toMatchObject({
      code: 'esdc_submission_application_scope_mismatch',
      statusCode: 409,
      submissionId: 802,
      applicationId: 202,
    });
    expect(calls.some(call => call.sql.startsWith('INSERT INTO esdc_participant_submission'))).toBe(false);
  });

  test('ensure propagates lookup failures instead of falling through to an insert', async () => {
    const lookupFailure = Object.assign(new Error('lookup_unavailable'), { code: 'ER_LOCK_WAIT_TIMEOUT' });
    const calls = [];
    const connection = {
      query: jest.fn(async (statement, params = []) => {
        const sql = compactSql(statement);
        calls.push({ sql, params: [...params] });
        if (sql.includes('FROM iset_case_action_plan ap')) throw lookupFailure;
        throw new Error(`Unexpected lookup-failure query: ${sql}`);
      }),
    };

    await expect(
      exported.ensureEsdcParticipantSubmissionRecord(connection, 51, 101, null)
    ).rejects.toBe(lookupFailure);
    expect(calls).toHaveLength(1);
    expect(calls.some(call => call.sql.startsWith('INSERT INTO esdc_participant_submission'))).toBe(false);
  });

  test('ensure never replaces an explicitly invalid application scope with an inferred sibling', async () => {
    const connection = { query: jest.fn() };
    await expect(
      exported.ensureEsdcParticipantSubmissionRecord(connection, 51, 'not-an-application', null)
    ).rejects.toMatchObject({
      code: 'invalid_application_id',
      statusCode: 400,
    });
    expect(connection.query).not.toHaveBeenCalled();
  });

  test('source invalidation clears mutable prepared evidence but preserves immutable snapshots', async () => {
    const calls = [];
    const connection = {
      query: jest.fn(async (statement, params = []) => {
        const sql = compactSql(statement);
        calls.push({ sql, params: [...params] });
        return [{ affectedRows: 2 }, []];
      }),
    };

    await exported.markEsdcParticipantSubmissionNeedsReview(connection, 51, { applicationId: 101 });

    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual([51, 101, 51, 101]);
    expect(calls[0].sql).toContain("LOWER(COALESCE(eps.submission_status, 'pending')) IN ('submitted', 'accepted')");
    expect(calls[0].sql).toContain('eps.payload_snapshot ELSE NULL END');
    expect(calls[0].sql).toContain('eps.payload_storage_key ELSE NULL END');
    expect(calls[0].sql).toContain('eps.payload_checksum ELSE NULL END');
    expect(calls[0].sql).not.toContain("eps.submission_status = 'pending'");
    expect(calls[0].sql).not.toContain('eps.submitted_at = NULL');
  });

  test('ready-to-close accepts preserved immutable batch evidence with reviewed nonblocking warnings', () => {
    expect(exported.assertReadyToCloseImmutableEsdcEvidence(preparedSubmission({
      submission_status: 'submitted',
      readiness_status: 'ready',
      warnings: JSON.stringify(['Review the optional participant detail before the next export.']),
    }))).toBe(true);
  });

  test.each([
    ['validate', 'submitted'],
    ['validate', 'accepted'],
    ['prepare', 'submitted'],
    ['prepare', 'accepted'],
  ])('%s rejects a locked %s row before reading live workflow data', async (operation, submissionStatus) => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.startsWith('SELECT * FROM esdc_participant_submission')) {
        return [[preparedSubmission({ submission_status: submissionStatus })], []];
      }
      return undefined;
    });
    const execute = operation === 'validate'
      ? exported.validateEsdcParticipantSubmission
      : exported.prepareEsdcParticipantSubmission;

    await expect(
      execute({ submissionId: 81 }, { connection })
    ).rejects.toMatchObject({
      code: 'esdc_submission_requeue_required',
      statusCode: 409,
      submissionId: 81,
      submissionStatus,
    });

    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    expect(calls[0].sql).toContain('FOR UPDATE');
  });

  test('a clean prepared pending row is submitted and its history is committed atomically', async () => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission()], []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO esdc_participant_submission_history')) return [{ insertId: 901 }, []];
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'submitted',
      actorUserId: 44,
      connection,
    })).resolves.toMatchObject({
      ok: true,
      submissionId: 81,
      previousStatus: 'pending',
      status: 'submitted',
      unchanged: false,
    });

    const update = calls.find(call => call.sql.startsWith('UPDATE esdc_participant_submission'));
    const history = calls.find(call => call.sql.startsWith('INSERT INTO esdc_participant_submission_history'));
    expect(update.sql).toContain("submission_status = 'submitted'");
    expect(update.sql).toContain('submitted_at = NOW()');
    expect(update.params).toEqual([44, 81]);
    expect(history.params.slice(0, 3)).toEqual([81, 'submitted', 44]);
    expect(JSON.parse(history.params[3])).toEqual({
      previousStatus: 'pending',
      status: 'submitted',
      rejectionReason: null,
    });
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test.each(['pending', 'rejected'])(
    'direct submit rejects a %s row whose prepared evidence was invalidated',
    async submissionStatus => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission({
          submission_status: submissionStatus,
          payload_snapshot: null,
        })], []];
      }
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'submitted',
      connection,
    })).rejects.toMatchObject({
      code: 'esdc_submission_prepared_evidence_required',
      statusCode: 409,
      evidenceFailures: ['payload_snapshot_missing'],
    });
    expect(calls.some(call => call.sql.startsWith('UPDATE '))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    }
  );

  test('direct submit rejects an impossible pending-to-accepted transition', async () => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission()], []];
      }
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'accepted',
      connection,
    })).rejects.toMatchObject({
      code: 'esdc_submission_status_transition_forbidden',
      statusCode: 409,
      currentStatus: 'pending',
      nextStatus: 'accepted',
    });
    expect(calls.some(call => call.sql.startsWith('UPDATE '))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  test('a response can accept the immutable submitted payload after live readiness became stale', async () => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission({
          submission_status: 'submitted',
          readiness_status: 'needs_review',
          readiness_summary: null,
        })], []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO esdc_participant_submission_history')) return [{ insertId: 902 }, []];
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'accepted',
      actorUserId: 44,
      connection,
    })).resolves.toMatchObject({
      previousStatus: 'submitted',
      status: 'accepted',
    });

    const update = calls.find(call => call.sql.startsWith('UPDATE esdc_participant_submission'));
    expect(update.params).toEqual(['accepted', null, 81]);
    expect(update.sql).not.toContain('submitted_at = NOW()');
    expect(update.sql).not.toContain('submitted_by_user_id');
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('history failure rolls back the direct status update', async () => {
    const historyFailure = new Error('history_write_failed');
    const { connection } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission()], []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO esdc_participant_submission_history')) throw historyFailure;
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'submitted',
      connection,
    })).rejects.toBe(historyFailure);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('explicit requeue atomically clears stale payload and validation evidence', async () => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.startsWith('SELECT eps.id, eps.submission_status') && sql.includes('FOR UPDATE')) {
        return [[{ id: 81, submission_status: 'submitted' }], []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 1 }, []];
      if (sql.startsWith('INSERT INTO esdc_participant_submission_history')) return [{ insertId: 903 }, []];
      return undefined;
    });

    await expect(exported.requeueEsdcParticipantSubmissions({
      submissionIds: [81],
      actorUserId: 44,
      connection,
    })).resolves.toEqual({ ok: true, count: 1, submissionIds: [81] });

    const update = calls.find(call => call.sql.startsWith('UPDATE esdc_participant_submission'));
    expect(update.sql).toContain("submission_status = 'pending'");
    expect(update.sql).toContain("readiness_status = 'needs_review'");
    expect(update.sql).toContain('payload_snapshot = NULL');
    expect(update.sql).toContain('payload_storage_key = NULL');
    expect(update.sql).toContain('payload_checksum = NULL');
    expect(update.sql).toContain('submitted_by_user_id = NULL');
    expect(update.sql).toContain('last_validated_at = NULL');
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test('Validate alone cannot make a requeued old payload submittable', async () => {
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.includes('FROM esdc_participant_submission eps') && sql.includes('FOR UPDATE')) {
        return [[preparedSubmission({
          submission_status: 'pending',
          readiness_status: 'ready',
          payload_snapshot: null,
          payload_checksum: null,
        })], []];
      }
      return undefined;
    });

    await expect(exported.transitionEsdcParticipantSubmission({
      submissionId: 81,
      status: 'submitted',
      connection,
    })).rejects.toMatchObject({
      code: 'esdc_submission_prepared_evidence_required',
      evidenceFailures: ['payload_snapshot_missing', 'payload_checksum_missing'],
    });
    expect(calls.some(call => call.sql.startsWith('UPDATE '))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
  });

  test('batch submit locks exact versions and atomically stores the submitted XML, status, and history', async () => {
    const versionRows = [
      {
        id: 81,
        submission_status: 'pending',
        readiness_status: 'ready',
        updated_at: '2026-08-15 09:00:00',
      },
      {
        id: 82,
        submission_status: 'rejected',
        readiness_status: 'needs_review',
        updated_at: '2026-08-15 09:01:00',
      },
    ];
    const collectParticipants = jest.fn(async options => {
      expect(options).toMatchObject({ connection: expect.any(Object), lockSubmissions: true });
      return {
        participants: [{
          id: 81,
          submission_ids: [81, 82],
          submission_versions: versionRows.map(row => ({
            id: row.id,
            submissionStatus: row.submission_status,
            readinessStatus: row.readiness_status,
            updatedAt: row.updated_at,
          })),
          readiness_status: 'ready',
          readiness_summary: { mandatory: { complete: 4, total: 4 } },
          warnings: [],
        }],
        skipped: [{ id: 99, submission_ids: [99] }],
        clientFragments: ['<client><firstName>Test</firstName></client>'],
      };
    });
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.startsWith('SELECT eps.id, eps.submission_status') && sql.includes('eps.updated_at')) {
        return [versionRows, []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 2 }, []];
      if (sql.startsWith('INSERT INTO esdc_participant_submission_history')) return [{ affectedRows: 2 }, []];
      return undefined;
    });

    const result = await exported.submitReadyEsdcBatch({
      actorUserId: 44,
      downloadedByDisplayName: 'Test Operator',
      batchId: 'batch-1',
      filename: 'batch-1.xml',
      downloadPath: '/exports/batch-1.xml',
      connection,
      collectParticipants,
    });

    expect(result).toMatchObject({
      ok: true,
      batchId: 'batch-1',
      filename: 'batch-1.xml',
      xmlChecksum: expect.any(String),
      xmlSize: expect.any(Number),
    });
    expect(result.xml).toContain('<client><firstName>Test</firstName></client>');
    const update = calls.find(call => call.sql.startsWith('UPDATE esdc_participant_submission'));
    expect(update.params.slice(-2)).toEqual([81, 82]);
    expect(update.sql).toContain("submission_status = 'submitted'");
    expect(update.sql).toContain('payload_snapshot = ?');
    expect(update.sql).toContain('payload_checksum = ?');
    const storedSnapshot = JSON.parse(update.params[5]);
    expect(storedSnapshot).toMatchObject({
      schema: 'esdc-ilmp-batch-v1',
      batchId: 'batch-1',
      submissionIds: [81, 82],
      checksum: result.xmlChecksum,
      xml: result.xml,
    });
    const history = calls.find(call => call.sql.startsWith('INSERT INTO esdc_participant_submission_history'));
    expect(history.params.filter((_value, index) => index % 3 === 0)).toEqual([81, 82]);
    expect(calls.some(call => call.params.includes(99))).toBe(false);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
  });

  test('batch submit fails closed when a candidate version changes before the locked write', async () => {
    const collectParticipants = jest.fn(async () => ({
      participants: [{
        id: 81,
        submission_ids: [81],
        submission_versions: [{
          id: 81,
          submissionStatus: 'pending',
          readinessStatus: 'ready',
          updatedAt: '2026-08-15 09:00:00',
        }],
        readiness_status: 'ready',
        readiness_summary: null,
        warnings: [],
      }],
      skipped: [],
      clientFragments: ['<client />'],
    }));
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.startsWith('SELECT eps.id, eps.submission_status') && sql.includes('eps.updated_at')) {
        return [[{
          id: 81,
          submission_status: 'pending',
          readiness_status: 'ready',
          updated_at: '2026-08-15 09:00:01',
        }], []];
      }
      return undefined;
    });

    await expect(exported.submitReadyEsdcBatch({
      batchId: 'batch-race',
      filename: 'batch-race.xml',
      connection,
      collectParticipants,
    })).rejects.toMatchObject({
      code: 'esdc_batch_candidate_changed',
      statusCode: 409,
      submissionId: 81,
    });
    expect(calls.some(call => call.sql.startsWith('UPDATE '))).toBe(false);
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('batch submit rolls back when the guarded update does not cover the entire client group', async () => {
    const version = {
      id: 81,
      submission_status: 'pending',
      readiness_status: 'ready',
      updated_at: '2026-08-15 09:00:00',
    };
    const collectParticipants = jest.fn(async () => ({
      participants: [{
        id: 81,
        submission_ids: [81],
        submission_versions: [{
          id: 81,
          submissionStatus: 'pending',
          readinessStatus: 'ready',
          updatedAt: version.updated_at,
        }],
        readiness_status: 'ready',
        readiness_summary: null,
        warnings: [],
      }],
      skipped: [],
      clientFragments: ['<client />'],
    }));
    const { connection, calls } = buildTransactionalConnection(async sql => {
      if (sql.startsWith('SELECT eps.id, eps.submission_status') && sql.includes('eps.updated_at')) {
        return [[version], []];
      }
      if (sql.startsWith('UPDATE esdc_participant_submission')) return [{ affectedRows: 0 }, []];
      return undefined;
    });

    await expect(exported.submitReadyEsdcBatch({
      batchId: 'batch-conflict',
      filename: 'batch-conflict.xml',
      connection,
      collectParticipants,
    })).rejects.toMatchObject({
      code: 'esdc_batch_submission_write_conflict',
      statusCode: 409,
      submissionIds: [81],
    });
    expect(calls.some(call => call.sql.startsWith('INSERT '))).toBe(false);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('validate-all invokes the validator with its default transaction boundary', () => {
    const serverSource = fs.readFileSync(path.resolve(__dirname, '../isetadminserver.js'), 'utf8');
    const start = serverSource.indexOf("esdcRouter.post('/participants/validate-all'");
    const end = serverSource.indexOf("esdcRouter.post('/participants/batch-prepare'", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const route = serverSource.slice(start, end);
    expect(route).toContain('await validateEsdcParticipantSubmission({ submissionId: id });');
    expect(route).not.toContain('transaction: false');
  });
});
