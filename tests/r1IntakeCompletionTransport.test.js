const {
  R1_RESULT_MARKER_MAX_BYTES,
  R1_SSM_OUTPUT_LIMIT_BYTES,
  encodeR1RemoteResultMarker,
  parseRemoteResult,
} = require('../scripts/r1-intake-completion-test-smoke');

describe('R1 intake TEST SSM result transport', () => {
  test('keeps the essential result parseable below the SSM output limit', () => {
    const oversizedDetails = Array.from({ length: 400 }, (_, index) => ({
      sequence: index + 1,
      sqlHash: `${index}`.padStart(64, '0'),
      tables: Array.from({ length: 20 }, (_value, tableIndex) => `table_${tableIndex}`),
      repeatedDiagnostic: 'x'.repeat(500),
    }));
    const result = {
      status: 'passed',
      startedAt: '2026-08-09T20:00:00.000Z',
      finishedAt: '2026-08-09T20:02:00.000Z',
      checks: [
        { status: 'PASS', name: 'published workflow completed', details: { repeated: oversizedDetails } },
        { status: 'PASS', name: 'cleanup completed', details: { repeated: oversizedDetails } },
      ],
      fixtureIds: { userId: 1, submissionId: 2, applicationId: 3, caseId: 4, reference: 'R1-TEST' },
      publishedWorkflow: { workflowId: 21, stepCount: 14, version: 7 },
      sideEffects: {
        core: { clients: 1, submissions: 1, applications: 1, cases: 1, documents: 5, events: 6 },
        documentCount: 5,
        documentKeys: Array.from({ length: 100 }, (_, index) => `large/repeated/key/${index}/${'x'.repeat(200)}`),
        events: oversizedDetails,
        notifications: oversizedDetails,
      },
      cleanup: { database: 'verified_empty', objects: 'verified_absent' },
      schemaSafety: {
        preflightComplete: true,
        identity: { database: 'iset_intake', host: 'ip-172-16-0-199', currentUser: 'app_admin@10.48.%', version: '8.0.42' },
        ddlHashes: { user: 'a'.repeat(64), iset_application: 'b'.repeat(64) },
        indexHashes: { user: 'c'.repeat(64) },
        constraintHashes: { user: 'd'.repeat(64) },
        verifiedStatementCount: oversizedDetails.length,
        verifiedStatements: oversizedDetails,
        verifiedFunctions: ['count', 'json_extract'],
      },
    };

    const marker = encodeR1RemoteResultMarker(result);
    const parsed = parseRemoteResult(`progress before marker\n${marker}\nignored trailing output`);

    expect(Buffer.byteLength(marker, 'utf8')).toBeLessThanOrEqual(R1_RESULT_MARKER_MAX_BYTES);
    expect(Buffer.byteLength(marker, 'utf8')).toBeLessThan(R1_SSM_OUTPUT_LIMIT_BYTES);
    expect(parsed).toEqual(expect.objectContaining({
      transportVersion: 1,
      status: 'passed',
      fixtureIds: result.fixtureIds,
      publishedWorkflow: result.publishedWorkflow,
      cleanup: result.cleanup,
      checkCounts: { passed: 2, failed: 0, skipped: 0 },
    }));
    expect(parsed.schemaSafety).toEqual(expect.objectContaining({
      preflightComplete: true,
      verifiedStatementCount: oversizedDetails.length,
      verifiedStatementsHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
    }));
    expect(parsed.workflowResult).toEqual(expect.objectContaining({
      documentCount: 5,
      eventCount: oversizedDetails.length,
      notificationCount: oversizedDetails.length,
    }));
    expect(marker).not.toContain('repeatedDiagnostic');
  });
});
