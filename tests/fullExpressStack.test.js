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

function createFakePool() {
  const queries = [];
  const query = async (sql, params = []) => {
    queries.push({ sql: String(sql), params });
    return [[], []];
  };
  return {
    queries,
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
}

function requestJson(server, path, options = {}) {
  const address = server.address();
  const body = options.body || null;
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method: options.method || 'GET',
      headers: {
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
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
    if (body) request.write(body);
    request.end();
  });
}

describe('complete admin Express stack', () => {
  let server;
  let fakePool;
  let dependencyStore;
  const previousFactoryMode = process.env.PATH_APP_FACTORY_MODE;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.PATH_APP_FACTORY_MODE = '1';
    fakePool = createFakePool();
    dependencyStore = require('../src/server/appFactoryTestDeps');
    dependencyStore.setAppFactoryTestDependencies({
      pool: fakePool,
      authnMiddlewareFactory: () => (req, _res, next) => {
        req.auth = {
          subjectType: 'staff',
          sub: 'full-stack-test-staff',
          email: 'full-stack-test@example.invalid',
          role: 'System Administrator',
          staffProfileId: 1,
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

  test('mounts authentication and routes registered after the former listener boundary', async () => {
    const auth = await requestJson(server, '/api/auth/me');
    expect(auth.status).toBe(200);
    expect(auth.body.auth).toMatchObject({ subjectType: 'staff', role: 'System Administrator' });

    const staffProfileProbe = fakePool.queries.find(({ sql }) => (
      sql.includes('FROM `staff_profiles` LIMIT 0')
    ));
    expect(staffProfileProbe?.sql).toContain('`id`, `cognito_sub`, `email`, `primary_role`, `region_id`');
    expect(staffProfileProbe?.sql).not.toContain('`last_seen_at`');

    const retired = await requestJson(server, '/api/users/123');
    expect(retired).toMatchObject({
      status: 410,
      body: { error: 'retired_endpoint' },
    });
  });

  test('applies the real parser and route stack without mutating runtime configuration', async () => {
    const response = await requestJson(server, '/api/config/runtime/ai-fallbacks', {
      method: 'PATCH',
      headers: { 'content-type': 'text/plain' },
      body: '{"fallbackModels":["unexpected/write"]}',
    });

    expect(response).toEqual({
      status: 400,
      body: { error: 'fallback_models_required' },
    });
    expect(fakePool.queries.some(({ sql }) => sql.includes("'ai.fallbacks'"))).toBe(false);
  });
});
