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

function buildScopeConnection({
  planCaseId = 10,
  planApplicationId = 101,
  primaryApplicationId = 202,
} = {}) {
  const calls = [];
  const connection = {
    query: jest.fn(async (statement, params = []) => {
      const sql = compactSql(statement);
      calls.push({ sql, params: [...params] });
      if (sql.includes('FROM iset_case_action_plan ap') && sql.includes('WHERE ap.id = ?')) {
        return [[{
          case_id: planCaseId,
          application_id: planApplicationId,
        }], []];
      }
      if (sql.includes('FROM iset_application a JOIN iset_case c ON c.id = a.case_id')) {
        const applicationId = Number(params[0]);
        return [[{ id: applicationId === 303 ? 11 : 10 }], []];
      }
      if (sql.includes('FROM iset_case c') && sql.includes('AS application_id')) {
        return [[{ application_id: primaryApplicationId }], []];
      }
      throw new Error(`Unexpected document-scope query: ${sql}`);
    }),
  };
  return { connection, calls };
}

describe('application-scoped Supporting Document ownership', () => {
  test('derives the exact Action Plan application instead of the case primary application', async () => {
    const { connection, calls } = buildScopeConnection();

    const result = await exported.resolveDocumentAttachmentContext({
      requestedScope: 'application',
      caseId: 10,
      actionPlanId: 20,
      connection,
    });

    expect(result).toEqual({
      caseId: 10,
      applicationId: 101,
      actionPlanId: null,
      interventionIds: [],
      effectiveStorageScope: 'application',
      usedApplicationFallback: false,
    });
    expect(calls.some(call => call.sql.includes('AS application_id') && call.sql.includes('FROM iset_case c'))).toBe(false);
  });

  test('rejects an explicit sibling application paired with the Action Plan', async () => {
    const { connection } = buildScopeConnection();

    await expect(exported.resolveDocumentAttachmentContext({
      requestedScope: 'application',
      caseId: 10,
      applicationId: 202,
      actionPlanId: 20,
      connection,
    })).rejects.toMatchObject({
      code: 'action_plan_application_mismatch',
      details: {
        applicationId: 202,
        actionPlanId: 20,
        actionPlanApplicationId: 101,
      },
    });
  });

  test('keeps a legacy unscoped plan as an explicit Action Plan fallback instead of guessing primary', async () => {
    const { connection, calls } = buildScopeConnection({ planApplicationId: null });

    const result = await exported.resolveDocumentAttachmentContext({
      requestedScope: 'application',
      caseId: 10,
      actionPlanId: 20,
      connection,
    });

    expect(result).toEqual({
      caseId: 10,
      applicationId: null,
      actionPlanId: 20,
      interventionIds: [],
      effectiveStorageScope: 'action_plan',
      usedApplicationFallback: true,
    });
    expect(calls.some(call => call.sql.includes('AS application_id') && call.sql.includes('FROM iset_case c'))).toBe(false);
  });

  test('preserves the existing case-primary fallback only when no exact plan is supplied', async () => {
    const { connection } = buildScopeConnection();

    const result = await exported.resolveDocumentAttachmentContext({
      requestedScope: 'application',
      caseId: 10,
      connection,
    });

    expect(result.applicationId).toBe(202);
    expect(result.caseId).toBe(10);
    expect(result.effectiveStorageScope).toBe('application');
  });
});
