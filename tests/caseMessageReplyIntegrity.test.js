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

const compactSql = value => String(value || '').replace(/\s+/g, ' ').trim();

function buildReplyTarget(overrides = {}) {
  return {
    id: 901,
    case_id: 10,
    application_id: 20,
    sender_actor_type: 'applicant_user',
    sender_user_id: 500,
    sender_staff_profile_id: null,
    recipient_actor_type: 'staff_profile',
    recipient_user_id: 700,
    recipient_staff_profile_id: 77,
    subject: 'Question',
    body: 'Can you help?',
    status: 'unread',
    deleted: 0,
    created_at: '2026-08-15 09:00:00',
    ...overrides,
  };
}

function buildApplicantContext(overrides = {}) {
  return {
    case_id: 10,
    client_id: 5,
    application_id: 20,
    case_number: 'CASE-10',
    case_context_json: '{}',
    case_status: 'active',
    case_lifecycle_status: 'active',
    application_status: 'in_review',
    application_lifecycle_status: 'in_review',
    decision_outcome: null,
    application_awaiting_reason: null,
    application_closure_reason: null,
    submission_reference: 'APP-20',
    submission_first_name: 'Applicant',
    submission_last_name: 'Person',
    submission_preferred_name: null,
    applicant_submission_user_id: 500,
    applicant_submission_client_id: 5,
    applicant_client_sub_user_id: 500,
    client_first_name: 'Applicant',
    client_last_name: 'Person',
    client_name: 'Applicant Person',
    client_email: 'applicant@example.invalid',
    applicant_name: 'Applicant Person',
    applicant_email: 'applicant@example.invalid',
    ...overrides,
  };
}

function buildAdminRequest() {
  return {
    auth: {
      subjectType: 'staff',
      sub: 'message-reply-test',
      email: 'message-reply@example.invalid',
      role: 'System Administrator',
      staffProfileId: 77,
      userId: 700,
    },
    staffProfile: {
      id: 77,
      email: 'message-reply@example.invalid',
      primary_role: 'System Administrator',
      region_id: 3,
      regionIds: [3],
    },
  };
}

function buildReplyConnection({ replyTarget = buildReplyTarget(), applicantContext = buildApplicantContext() } = {}) {
  const calls = [];
  const connection = {
    query: jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      calls.push({ sql, params });
      if (sql.includes('FROM messages') && sql.endsWith('LIMIT 1 FOR UPDATE')) {
        return [replyTarget ? [replyTarget] : [], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('AS assigned_to_user_id')) {
        return [[{
          id: 10,
          client_id: 5,
          application_id: 20,
          assigned_to_user_id: 77,
          assigned_staff_profile_id: 77,
          portfolio_region_id: 3,
          owner_region_id: 3,
        }], []];
      }
      if (sql.includes('AS applicant_submission_user_id')) {
        return [applicantContext ? [applicantContext] : [], []];
      }
      throw new Error(`Unexpected secure-message reply SQL: ${sql}`);
    }),
  };
  return { connection, calls };
}

async function invokeRoute(handler, { params = {}, query = {}, body = {} } = {}) {
  let status = 200;
  let responseBody = null;
  const req = {
    ...buildAdminRequest(),
    params,
    query,
    body,
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

describe('case secure-message reply integrity', () => {
  const previousRepairExports = process.env.PATH_REPAIR_EXPORTS;
  const previousTestEnvironmentFile = process.env.PATH_TEST_ENV_FILE;
  let syntheticTestEnvironment;
  let exported;
  let getMessagesHandler;
  let sendMessageHandler;

  beforeAll(() => {
    syntheticTestEnvironment = createSyntheticTestEnvironment();
    process.env.NODE_ENV = 'test';
    process.env.PATH_REPAIR_EXPORTS = '1';
    process.env.PATH_TEST_ENV_FILE = syntheticTestEnvironment.environmentFile;
    exported = require('../isetadminserver');

    const stack = exported.app?._router?.stack || exported.app?.router?.stack || [];
    const findHandler = (routePath, method) => {
      const layer = stack.find(entry => (
        entry?.route?.path === routePath && entry.route.methods?.[method]
      ));
      return layer?.route?.stack?.[0]?.handle || null;
    };
    getMessagesHandler = findHandler('/api/cases/:id/messages', 'get');
    sendMessageHandler = findHandler('/api/cases/:id/messages', 'post');
    expect(typeof getMessagesHandler).toBe('function');
    expect(typeof sendMessageHandler).toBe('function');
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

  test('strict application parsing rejects malformed, fractional, and conflicting aliases', () => {
    expect(exported.resolveCaseMessageApplicationIdInput('abc', undefined)).toEqual({
      valid: false,
      applicationId: null,
    });
    expect(exported.resolveCaseMessageApplicationIdInput('20.5', undefined).valid).toBe(false);
    expect(exported.resolveCaseMessageApplicationIdInput('2e1', undefined).valid).toBe(false);
    expect(exported.resolveCaseMessageApplicationIdInput(['20'], undefined).valid).toBe(false);
    expect(exported.resolveCaseMessageApplicationIdInput(0, undefined).valid).toBe(false);
    expect(exported.resolveCaseMessageApplicationIdInput(20, 21).valid).toBe(false);
    expect(exported.resolveCaseMessageApplicationIdInput(null, '20')).toEqual({
      valid: true,
      applicationId: 20,
    });
    expect(exported.resolveCaseMessageApplicationIdInput(null, null)).toEqual({
      valid: true,
      applicationId: null,
    });
  });

  test('GET and send reject an explicit malformed application before any fallback work', async () => {
    await expect(invokeRoute(getMessagesHandler, {
      params: { id: '10' },
      query: { applicationId: 'not-an-id' },
    })).resolves.toEqual({
      status: 400,
      body: { error: 'invalid_application_id' },
    });

    await expect(invokeRoute(sendMessageHandler, {
      params: { id: '10' },
      body: {
        applicationId: '20.5',
        subject: 'Subject',
        body: 'Message',
        toDisplayName: 'Applicant',
        fromDisplayName: 'Coordinator',
      },
    })).resolves.toEqual({
      status: 400,
      body: { error: 'invalid_application_id' },
    });
  });

  test('re-fetches the exact reply target FOR UPDATE and validates application and typed applicant', async () => {
    const { connection, calls } = buildReplyConnection();

    await expect(exported.lockAndValidateCaseMessageReplyTarget({
      connection,
      req: buildAdminRequest(),
      replyMessageId: 901,
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
      ownerUserId: 700,
    })).resolves.toMatchObject({ id: 901, case_id: 10, application_id: 20 });

    expect(calls[0].sql).toMatch(/FROM messages .* LIMIT 1 FOR UPDATE$/);
    const applicantContextRead = calls.find(call => call.sql.includes('AS applicant_submission_user_id'));
    expect(applicantContextRead?.sql).toMatch(/LIMIT 1 FOR UPDATE$/);
    expect(applicantContextRead?.params).toEqual([20, 10]);
  });

  test('rejects deleted, withdrawn, cross-application, and untyped applicant reply targets', async () => {
    for (const replyTarget of [
      buildReplyTarget({ deleted: 1 }),
      buildReplyTarget({ status: 'archived' }),
    ]) {
      const { connection } = buildReplyConnection({ replyTarget });
      await expect(exported.lockAndValidateCaseMessageReplyTarget({
        connection,
        req: buildAdminRequest(),
        replyMessageId: 901,
        caseId: 10,
        applicationId: 20,
        applicantUserId: 500,
        ownerUserId: 700,
      })).rejects.toMatchObject({
        httpStatus: 409,
        publicError: 'reply_message_unavailable',
      });
    }

    const crossApplication = buildReplyConnection({
      replyTarget: buildReplyTarget({ application_id: 21 }),
    });
    await expect(exported.lockAndValidateCaseMessageReplyTarget({
      connection: crossApplication.connection,
      req: buildAdminRequest(),
      replyMessageId: 901,
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
      ownerUserId: 700,
    })).rejects.toMatchObject({
      httpStatus: 409,
      publicError: 'reply_message_application_scope_mismatch',
    });

    const untypedParticipant = buildReplyConnection({
      replyTarget: buildReplyTarget({ sender_actor_type: 'local_user' }),
    });
    await expect(exported.lockAndValidateCaseMessageReplyTarget({
      connection: untypedParticipant.connection,
      req: buildAdminRequest(),
      replyMessageId: 901,
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
      ownerUserId: 700,
    })).rejects.toMatchObject({
      httpStatus: 409,
      publicError: 'reply_message_applicant_scope_mismatch',
    });
  });

  test('requires exactly one guarded reply-status update', async () => {
    const successfulConnection = {
      query: jest.fn(async () => [{ affectedRows: 1 }, []]),
    };
    await expect(exported.markCaseMessageReplyTargetReplied({
      connection: successfulConnection,
      replyMessageId: 901,
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
    })).resolves.toEqual({ updated: true, replyMessageId: 901 });
    const [sql, params] = successfulConnection.query.mock.calls[0];
    expect(compactSql(sql)).toContain("sender_actor_type = 'applicant_user'");
    expect(compactSql(sql)).toContain("NOT IN ('archived', 'deleted', 'withdrawn')");
    expect(params).toEqual([901, 10, 20, 20, 500, 500]);

    const missedConnection = {
      query: jest.fn(async () => [{ affectedRows: 0 }, []]),
    };
    await expect(exported.markCaseMessageReplyTargetReplied({
      connection: missedConnection,
      replyMessageId: 901,
      caseId: 10,
      applicationId: 20,
      applicantUserId: 500,
    })).rejects.toMatchObject({
      httpStatus: 409,
      publicError: 'reply_message_state_conflict',
    });
  });

  test('the real send route locks the reply after BEGIN and uses the guarded status writer', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../isetadminserver.js'), 'utf8');
    const start = source.indexOf('const handlePostCaseSecureMessage = async (req, res) => {');
    const end = source.indexOf("app.post('/api/cases/:id/messages', handlePostCaseSecureMessage);", start);
    const handler = source.slice(start, end);
    const begin = handler.indexOf('await messageWriteConnection.beginTransaction()');
    const lock = handler.indexOf('await lockAndValidateCaseMessageReplyTarget({');
    const insert = handler.indexOf('`INSERT INTO messages');
    const mark = handler.indexOf('await markCaseMessageReplyTargetReplied({');

    expect(begin).toBeGreaterThanOrEqual(0);
    expect(lock).toBeGreaterThan(begin);
    expect(insert).toBeGreaterThan(lock);
    expect(mark).toBeGreaterThan(insert);
  });
});
