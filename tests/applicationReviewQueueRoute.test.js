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

function requestJson(server, path, role) {
  const address = server.address();
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: 'GET',
      headers: { 'x-test-role': role },
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: response.statusCode, body: raw ? JSON.parse(raw) : null });
      });
    });
    request.on('error', reject);
    request.end();
  });
}

describe('GET /api/applications review queue caller boundary', () => {
  let server;
  let dependencyStore;
  const queries = [];
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';

    const query = jest.fn(async (sqlValue, params = []) => {
      const sql = compactSql(sqlValue);
      queries.push({ sql, params: [...params] });

      if (sql.includes('SELECT region_id, code FROM canada_region')) {
        return [[{ region_id: 9, code: 'on' }], []];
      }

      if (sql.includes('SELECT c.id AS case_id') && sql.includes('FROM iset_case c') && sql.includes('ORDER BY')) {
        expect(sql).toContain("LEFT JOIN iset_review_workflow rw ON rw.workflow_type = 'application_assessment'");
        if (params.includes('nwac_review')) {
          expect(sql).toContain('rw.current_stage = ? OR (rw.id IS NULL');
          expect(params).toContain('pending_decision');
          return [[
            {
              case_id: 76,
              application_id: 124,
              application_status: 'pending_approval',
              application_lifecycle_status: 'pending_decision',
              review_workflow_id: 702,
              review_workflow_stage: 'nwac_review',
              submitted_at: '2026-08-06 10:00:00',
            },
            {
              case_id: 77,
              application_id: 125,
              application_status: 'pending_approval',
              application_lifecycle_status: 'pending_decision',
              review_workflow_id: null,
              review_workflow_stage: null,
              submitted_at: '2026-08-06 09:00:00',
            },
          ], []];
        }
        if (params.includes('rm_review') && params.includes('returned_to_rm')) {
          expect(sql).toContain('rw.current_stage IN (?, ?)');
          return [[
            {
              case_id: 76,
              application_id: 123,
              application_status: 'pending_approval',
              application_lifecycle_status: 'pending_decision',
              review_workflow_id: 700,
              review_workflow_stage: 'rm_review',
              submitted_at: '2026-08-06 08:00:00',
            },
            {
              case_id: 78,
              application_id: 126,
              application_status: 'docs_requested',
              application_lifecycle_status: 'awaiting_applicant',
              review_workflow_id: 701,
              review_workflow_stage: 'returned_to_rm',
              submitted_at: '2026-08-06 07:00:00',
            },
          ], []];
        }
        throw new Error('review_queue_stage_filter_missing');
      }

      if (sql.startsWith('SELECT COUNT(DISTINCT a.id) AS cnt')) {
        return [[{ cnt: params.includes('nwac_review') ? 2 : 2 }], []];
      }
      if (sql.startsWith('SELECT COUNT(*) AS cnt FROM iset_application')) {
        return [[{ cnt: 0 }], []];
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
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
      }),
    };

    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        const role = String(req.headers['x-test-role'] || 'NWAC Administrator');
        req.auth = {
          subjectType: 'staff',
          sub: `review-queue-${role}`,
          email: 'review-queue@example.invalid',
          role,
          staffProfileId: 54,
          regionId: 9,
          regionIds: [9],
        };
        req.staffProfile = {
          id: 54,
          email: 'review-queue@example.invalid',
          primary_role: role,
          region_id: 9,
          regionIds: [9],
        };
        next();
      },
    });
    const { app } = require('../isetadminserver');
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });

  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    dependencyStore.clearAppFactoryTestDependencies();
    if (previousFactoryMode === undefined) delete process.env.PATH_APP_FACTORY_MODE;
    else process.env.PATH_APP_FACTORY_MODE = previousFactoryMode;
  });

  test('NWAC receives only final-decision and legacy no-workflow applications', async () => {
    const response = await requestJson(
      server,
      '/api/applications?bucket=awaiting-decision&limit=20&offset=0',
      'NWAC Administrator'
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.rows.map(row => ({
      applicationId: row.application_id,
      stage: row.review_workflow_stage,
    }))).toEqual([
      { applicationId: 124, stage: 'nwac_review' },
      { applicationId: 125, stage: null },
    ]);
    expect(response.body.rows.map(row => row.application_id)).not.toContain(123);
  });

  test('Regional Manager receives RM and returned-to-RM applications despite lifecycle drift', async () => {
    const response = await requestJson(
      server,
      '/api/applications?bucket=awaiting-my-approval&limit=20&offset=0',
      'Regional Manager'
    );

    expect(response.status).toBe(200);
    expect(response.body.count).toBe(2);
    expect(response.body.rows.map(row => ({
      applicationId: row.application_id,
      stage: row.review_workflow_stage,
    }))).toEqual([
      { applicationId: 123, stage: 'rm_review' },
      { applicationId: 126, stage: 'returned_to_rm' },
    ]);
    expect(response.body.rows.map(row => row.application_id)).not.toContain(124);
  });
});
