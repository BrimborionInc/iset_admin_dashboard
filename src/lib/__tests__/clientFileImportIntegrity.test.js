const fs = require('fs');
const path = require('path');
const {
  buildClientFileImportIdentityKey,
  buildClientFileImportRequestHash,
  claimClientFileImportRun,
  completeClientFileImportRun,
  reconcileClientFileImportCaseAction,
} = require('../clientFileImportIntegrity');

function createImportRunFixture() {
  const runs = new Map();
  let nextId = 1;
  return {
    runs,
    connection: {
      query: jest.fn(async (sql, params) => {
        if (sql.includes('INSERT INTO client_file_import_run')) {
          const [requestHash] = params;
          if (!runs.has(requestHash)) {
            runs.set(requestHash, { id: nextId++, request_hash: requestHash, status: 'processing', result_json: null });
          }
          return [{ affectedRows: 1 }];
        }
        if (sql.includes('FROM client_file_import_run')) {
          return [[runs.get(params[0]) || null]];
        }
        if (sql.includes('UPDATE client_file_import_run')) {
          const [resultJson, id] = params;
          const run = [...runs.values()].find(candidate => candidate.id === id);
          run.status = 'committed';
          run.result_json = resultJson;
          return [{ affectedRows: 1 }];
        }
        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    },
  };
}

describe('client-file import concurrency and retries', () => {
  const row = {
    normalized: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      dateOfBirth: '1815-12-10',
      emailNormalized: 'ada@example.ca',
      sin: '046454286',
    },
  };

  test('stable request and identity hashes ignore object key order and do not expose SIN', () => {
    const first = buildClientFileImportRequestHash({ rows: [{ b: 2, a: 1 }], fileName: ' Batch.csv ' });
    const second = buildClientFileImportRequestHash({ rows: [{ a: 1, b: 2 }], fileName: 'batch.csv' });
    expect(first).toBe(second);
    const identityKey = buildClientFileImportIdentityKey(row);
    expect(identityKey).toMatch(/^sin:[a-f0-9]{64}$/);
    expect(identityKey).not.toContain(row.normalized.sin);
  });

  test('an idempotent retry replays the first committed result', async () => {
    const fixture = createImportRunFixture();
    const requestHash = buildClientFileImportRequestHash({ rows: [row] });
    const first = await claimClientFileImportRun(fixture.connection, { requestHash });
    expect(first.replay).toBe(false);
    const result = { summary: { createdClients: 1, createdCases: 1 }, results: [{ clientId: 7, caseId: 9 }] };
    await completeClientFileImportRun(fixture.connection, first.id, result);
    const retry = await claimClientFileImportRun(fixture.connection, { requestHash });
    expect(retry).toMatchObject({ replay: true, result });
    expect(fixture.runs.size).toBe(1);
  });

  test('post-lock case recheck converts a concurrent create into an update', () => {
    expect(reconcileClientFileImportCaseAction([])).toEqual({ action: 'create_case', caseId: null });
    expect(reconcileClientFileImportCaseAction([{ id: 88, case_number: 'C-88' }])).toEqual({
      action: 'update_case',
      caseId: 88,
      caseNumber: 'C-88',
    });
    expect(() => reconcileClientFileImportCaseAction([{ id: 1 }, { id: 2 }]))
      .toThrow(expect.objectContaining({ code: 'import_client_case_conflict' }));
  });

  test('the commit route claims the run before planning and rechecks cases after identity/client locking', () => {
    const server = fs.readFileSync(path.resolve(process.cwd(), 'isetadminserver.js'), 'utf8');
    const routeStart = server.indexOf("app.post('/api/imports/client-files/commit'");
    const routeEnd = server.indexOf('// Get full iset_application', routeStart);
    const route = server.slice(routeStart, routeEnd);
    expect(route.indexOf('claimClientFileImportRun(connection')).toBeGreaterThan(-1);
    expect(route.indexOf('prepareClientFileImportPlan(connection'))
      .toBeGreaterThan(route.indexOf('claimClientFileImportRun(connection'));
    expect(route).toContain('completeClientFileImportRun(connection');

    const applyStart = server.indexOf('async function applyClientFileImportPlan');
    const applyEnd = server.indexOf('async function readFinanceEmailRouting', applyStart);
    const apply = server.slice(applyStart, applyEnd);
    expect(apply.indexOf('claimClientFileImportIdentity(connection')).toBeGreaterThan(-1);
    expect(apply.indexOf('loadClientFileImportCaseRows(connection, clientId, { forUpdate: true })'))
      .toBeGreaterThan(apply.indexOf('claimClientFileImportIdentity(connection'));
  });
});
