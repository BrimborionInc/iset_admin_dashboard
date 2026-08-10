const fs = require('fs');
const path = require('path');

const {
  closeMysqlConnectionBounded,
} = require('../scripts/applicant-scope-guard-test-smoke');

describe('applicant-scope TEST smoke harness', () => {
  test('every declared SQL alias is quoted and every aliased column reference is qualified', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'applicant-scope-guard-test-smoke.js'),
      'utf8'
    );
    const remoteSource = source.slice(source.indexOf('function remoteRunner()'));

    expect(remoteSource).not.toMatch(
      /\b(?:FROM|JOIN|UPDATE|DELETE\s+FROM)\s+`?[A-Za-z_][A-Za-z0-9_]*`?\s+(?:AS\s+)?[a-z][A-Za-z0-9_]*\b/u
    );
    expect(remoteSource).not.toMatch(/\bAS\s+[a-z][A-Za-z0-9_]*\b/u);
    expect(remoteSource).toContain('DELETE FROM message_signing_request AS `msr`');
    expect(remoteSource).toContain('`msr`.signing_request_id');
  });

  test('a stalled mysql end is bounded, destroys the connection, and does not replace the primary error', async () => {
    const connection = {
      end: jest.fn(() => new Promise(() => {})),
      destroy: jest.fn(),
    };
    const primary = new Error('original_schema_guard_failure');

    let observed = null;
    try {
      try {
        throw primary;
      } finally {
        const outcome = await closeMysqlConnectionBounded(connection, 10);
        expect(outcome).toEqual(expect.objectContaining({
          status: 'destroyed_after_timeout',
          timeoutMs: 10,
        }));
      }
    } catch (error) {
      observed = error;
    }

    expect(observed).toBe(primary);
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(connection.destroy).toHaveBeenCalledTimes(1);
  });
});
