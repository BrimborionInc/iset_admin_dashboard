const http = require('http');
const express = require('express');

const { createHubRouter } = require('../src/routes/hubRoutes');

const HUB_ROW = {
  id: 1,
  name: 'Fixture Hub',
  iset_full_name: 'Fixture Hub',
  iset_code: 'FIX',
  iset_status: 'Active',
  iset_province: 'ON',
  iset_indigenous_group: 'Fixture',
  iset_full_address: 'Fixture address',
  iset_agreement_id: 'FIX-1',
  iset_notes: null,
  website_url: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  contact_notes: null,
};

function createPool() {
  return {
    query: jest.fn(async statement => {
      const sql = String(statement).replace(/\s+/gu, ' ').trim();
      if (sql.startsWith('UPDATE ptma')) return [{ affectedRows: 1 }, []];
      if (sql.includes('FROM ptma')) return [[HUB_ROW], []];
      throw new Error(`Unexpected Hub test query: ${sql}`);
    }),
  };
}

function requestJson(server, { method, pathname, role, body }) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const address = server.address();
    const request = http.request({
      host: '127.0.0.1',
      port: address.port,
      method,
      path: pathname,
      headers: {
        'x-test-role': role,
        ...(payload ? {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
        } : {}),
      },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { text += chunk; });
      response.on('end', () => {
        let parsed = null;
        try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = text; }
        resolve({ status: response.statusCode, body: parsed });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

describe('NWAC Hub route authorization', () => {
  let pool;
  let server;

  beforeEach(async () => {
    pool = createPool();
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.auth = { subjectType: 'staff', role: req.get('x-test-role') };
      next();
    });
    app.use('/api/hubs', createHubRouter({ pool }));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  afterEach(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  const routes = [
    { method: 'GET', pathname: '/api/hubs' },
    { method: 'GET', pathname: '/api/hubs/1' },
    { method: 'PUT', pathname: '/api/hubs/1', body: { full_name: 'Updated Hub' } },
  ];

  test.each(['NWAC Administrator', 'Regional Manager', 'ISET Coordinator', 'Unknown Staff Role'])(
    'denies every Hub method to %s before any database access',
    async role => {
      for (const route of routes) {
        pool.query.mockClear();
        const response = await requestJson(server, { ...route, role });
        expect(response).toEqual({ status: 403, body: { error: 'forbidden' } });
        expect(pool.query).not.toHaveBeenCalled();
      }
    }
  );

  test('keeps every Hub method reachable for System Administrator and scopes rows to Hub type', async () => {
    for (const route of routes) {
      pool.query.mockClear();
      const response = await requestJson(server, { ...route, role: 'System Administrator' });
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(300);
      expect(pool.query).toHaveBeenCalled();
      expect(pool.query.mock.calls.some(([sql]) => String(sql).includes("type = 'Hub'"))).toBe(true);
    }
  });

  test('updates only supplied Hub fields so separate forms cannot erase one another', async () => {
    const response = await requestJson(server, {
      method: 'PUT',
      pathname: '/api/hubs/1',
      role: 'System Administrator',
      body: { full_name: 'Updated Hub' },
    });

    expect(response.status).toBe(200);
    const [statement, params] = pool.query.mock.calls[0];
    expect(String(statement)).toContain('SET iset_full_name = ?');
    expect(String(statement)).not.toContain('contact_email = ?');
    expect(params).toEqual(['Updated Hub', '1']);
  });

  test('rejects an empty Hub update before database access', async () => {
    const response = await requestJson(server, {
      method: 'PUT',
      pathname: '/api/hubs/1',
      role: 'System Administrator',
      body: {},
    });

    expect(response).toEqual({ status: 400, body: { error: 'hub_update_empty' } });
    expect(pool.query).not.toHaveBeenCalled();
  });
});
