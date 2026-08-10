const fs = require('fs');
const path = require('path');

const {
  APPLICANT_SCOPE_RESULT_MARKER_MAX_BYTES,
  closeMysqlConnectionBounded,
  encodeApplicantScopeResultMarker,
  parseRemoteResult,
  runCleanupThenClose,
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

  test('a cleanup failure is retained while the mysql connection is still closed', async () => {
    const primary = new Error('fixture_cleanup_fk_failure');
    const cleanup = jest.fn(async () => { throw primary; });
    const connection = {
      end: jest.fn(async () => undefined),
      destroy: jest.fn(),
    };

    const outcome = await runCleanupThenClose({ cleanup, connection, timeoutMs: 10 });

    expect(outcome.cleanupError).toBe(primary);
    expect(outcome.closeOutcome).toEqual({ status: 'closed' });
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(connection.end).toHaveBeenCalledTimes(1);
    expect(connection.destroy).not.toHaveBeenCalled();
  });

  test('fixture marker cleanup is independent of mysql JSON whitespace rendering', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'applicant-scope-guard-test-smoke.js'),
      'utf8'
    );

    expect(source).toMatch(/const markerLike = `%\$\{config\.stamp\}%`;/u);
    expect(source).not.toMatch(/const markerLike = `%"stamp":"\$\{config\.stamp\}"%`;/u);
  });

  test('remote result marker stays below the SSM output limit while retaining cleanup evidence', () => {
    const result = {
      status: 'passed',
      startedAt: '2026-08-10T00:00:00.000Z',
      finishedAt: '2026-08-10T00:00:01.000Z',
      checks: Array.from({ length: 60 }, (_, index) => ({
        status: 'PASS',
        name: `privacy assertion ${index} with a deliberately descriptive retained audit label`,
        details: { oversized: 'x'.repeat(2000) },
      })),
      fixtureIds: { applicationA: 123 },
      cleanup: 'deleted',
      connectionClose: { status: 'closed' },
      schemaSafety: {
        preflightComplete: true,
        identity: { database: 'iset_intake', host: 'ip-172-16-0-199' },
        ddlHashes: Object.fromEntries(Array.from({ length: 19 }, (_, index) => [`table_${index}`, 'a'.repeat(64)])),
        indexHashes: Object.fromEntries(Array.from({ length: 19 }, (_, index) => [`table_${index}`, 'b'.repeat(64)])),
        constraintHashes: Object.fromEntries(Array.from({ length: 19 }, (_, index) => [`table_${index}`, 'c'.repeat(64)])),
        verifiedStatementCount: 80,
        verifiedStatements: Array.from({ length: 80 }, (_, sequence) => ({
          sequence,
          sqlHash: 'd'.repeat(64),
          tables: ['client'],
        })),
        verifiedFunctions: ['count'],
      },
    };

    const marker = encodeApplicantScopeResultMarker(result);
    const parsed = parseRemoteResult(marker);

    expect(Buffer.byteLength(marker, 'utf8')).toBeLessThanOrEqual(APPLICANT_SCOPE_RESULT_MARKER_MAX_BYTES);
    expect(parsed).toEqual(expect.objectContaining({
      status: 'passed',
      cleanup: 'deleted',
      connectionClose: { status: 'closed' },
      checkCounts: { passed: 60, failed: 0, skipped: 0 },
      checks: [],
      passedChecksHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(parsed.schemaSafety).toEqual(expect.objectContaining({
      preflightComplete: true,
      verifiedStatementCount: 80,
      verifiedStatementsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
  });
});
