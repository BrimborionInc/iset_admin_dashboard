const fs = require('fs');

const {
  DURABLE_SCHEMA_EVIDENCE_PREFIX,
  REMOTE_TARGETS,
  TEMP_REMOTE_STAGING_PREFIX,
  applyPendingRemoteSharedSchemaMigrations,
  buildSchemaMigrationCliFailurePayload,
  dispatchRemoteMigrationLedgerReader,
  reportSchemaMigrationCliFailure,
  stageRemoteMigrationLedgerReaderBundle,
} = require('../scripts/path-schema-migrate');

function migration(file, checksumCharacter) {
  return {
    file,
    checksum: checksumCharacter.repeat(64),
    content: `bounded migration ${file}`,
    fullPath: `/candidate/${file}`,
  };
}

function registryFor(migrations, dispatchByFile) {
  return new Map(migrations.map(item => [item.file, {
    file: item.file,
    checksum: item.checksum,
    executor: `bounded-${item.file}`,
    verifyArtifact: () => ({ checksum: item.checksum }),
    dispatch: dispatchByFile[item.file],
    revalidateApplied: true,
  }]));
}

describe('schema migration parent-visible failure evidence', () => {
  test('a bounded failure preserves prior success, remote stdout/stderr, and the halt boundary', () => {
    const migrations = [
      migration('20260825_0001_first.sql', 'a'),
      migration('20260825_0002_failure.sql', 'b'),
      migration('20260825_0003_must_not_run.sql', 'c'),
    ];
    const thirdDispatch = jest.fn();
    const remoteFailure = Object.assign(new Error('injected second migration failure'), {
      code: 'injected_bounded_failure',
      summary: {
        decision: 'FAILED',
        phase: 'post-ddl-proof',
        finalOperationStates: { first_operation: 'target', second_operation: 'missing' },
      },
      remoteExecution: {
        commandId: 'command-2',
        instanceId: 'i-0123456789abcdef0',
        status: 'Failed',
        responseCode: 1,
        stdout: 'bounded-result-marker',
        stderr: 'injected remote stderr',
      },
    });
    const boundedMigrationRegistry = registryFor(migrations, {
      [migrations[0].file]: jest.fn(() => ({ summary: { decision: 'COMPLETE' } })),
      [migrations[1].file]: jest.fn(() => { throw remoteFailure; }),
      [migrations[2].file]: thirdDispatch,
    });

    let caught;
    try {
      applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
        migrations,
        boundedMigrationRegistry,
        remoteLedger: { trackingTableExists: true, rows: [] },
        logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'schema_migration_apply_failed',
      result: {
        haltedOnFailure: true,
        attempted: [
          expect.objectContaining({ file: migrations[0].file, success: true }),
          expect.objectContaining({
            file: migrations[1].file,
            success: false,
            dispatchResult: remoteFailure.summary,
            error: expect.objectContaining({
              code: 'injected_bounded_failure',
              remoteExecution: remoteFailure.remoteExecution,
            }),
          }),
        ],
      },
    });
    expect(thirdDispatch).not.toHaveBeenCalled();

    const payload = buildSchemaMigrationCliFailurePayload(caught, [
      'apply', '--target-env', 'test', '--profile', 'nwac-test', '--json',
    ]);
    expect(payload).toMatchObject({
      schemaVersion: 1,
      command: 'apply',
      targetEnv: 'test',
      success: false,
      error: { code: 'schema_migration_apply_failed' },
      result: {
        haltedOnFailure: true,
        attempted: [
          expect.objectContaining({ success: true }),
          expect.objectContaining({
            success: false,
            error: expect.objectContaining({
              remoteExecution: expect.objectContaining({
                stdout: 'bounded-result-marker',
                stderr: 'injected remote stderr',
              }),
            }),
          }),
        ],
      },
    });
  });

  test('JSON-mode nonzero output is one parseable stdout payload with no competing stderr', () => {
    const error = Object.assign(new Error('injected apply failure'), {
      code: 'schema_migration_apply_failed',
      result: {
        attempted: [{ file: '001_fail.sql', success: false, errorSnippet: 'forced failure' }],
        haltedOnFailure: true,
      },
    });
    const output = {
      stdout: { write: jest.fn() },
      stderr: { write: jest.fn() },
    };

    reportSchemaMigrationCliFailure(error, [
      'apply', '--target-env', 'test', '--json',
    ], output);

    expect(output.stderr.write).not.toHaveBeenCalled();
    expect(output.stdout.write).toHaveBeenCalledTimes(1);
    expect(JSON.parse(output.stdout.write.mock.calls[0][0])).toMatchObject({
      success: false,
      error: { code: 'schema_migration_apply_failed', message: 'injected apply failure' },
      result: { haltedOnFailure: true },
    });
  });

  test('retained bounded stdout/stderr cannot carry result blobs or credential material', () => {
    const error = Object.assign(new Error("remote command failed with DB_PASS='plain db secret'"), {
      code: 'bounded_remote_failure',
      remoteExecution: {
        commandId: 'command-secret-test',
        stdout: [
          'PATH_TYPED_LINEAGE_RESULT=opaque-base64-secret',
          'https://bucket.example/key?X-Amz-Signature=plain-signature-secret&X-Amz-Credential=plain-credential-secret',
        ].join('\n'),
        stderr: 'AWS_SESSION_TOKEN=plain-session-secret AKIAIOSFODNN7EXAMPLE',
      },
    });

    const payloadText = JSON.stringify(buildSchemaMigrationCliFailurePayload(error, [
      'apply', '--target-env', 'test', '--json',
    ]));

    for (const secret of [
      'plain db secret',
      'opaque-base64-secret',
      'plain-signature-secret',
      'plain-credential-secret',
      'plain-session-secret',
      'AKIAIOSFODNN7EXAMPLE',
    ]) {
      expect(payloadText).not.toContain(secret);
    }
    expect(payloadText).toContain('[REDACTED_STRUCTURED_RESULT_MARKER]');
  });
});

describe('temporary remote migration staging cleanup', () => {
  const remoteConfig = {
    ...REMOTE_TARGETS.test,
    profile: REMOTE_TARGETS.test.defaultProfile,
    region: REMOTE_TARGETS.test.defaultRegion,
  };

  test('keeps deletable staging outside the immutable durable-evidence prefix', () => {
    expect(TEMP_REMOTE_STAGING_PREFIX).toBe('ssm-sql/path-schema-migrate');
    expect(DURABLE_SCHEMA_EVIDENCE_PREFIX).toBe('releases/schema-evidence');
    expect(TEMP_REMOTE_STAGING_PREFIX).not.toMatch(/^releases\//u);
    expect(DURABLE_SCHEMA_EVIDENCE_PREFIX).toMatch(/^releases\//u);
  });

  test('a ledger staging verification failure deletes the attempted S3 object', () => {
    const bundle = {
      archivePath: '/candidate/remote-ledger-reader.tgz',
      sha256: 'd'.repeat(64),
      bytes: 123,
    };
    const runAws = jest.fn()
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => { throw new Error('injected head-object failure'); });
    const deleteStagedObject = jest.fn();

    expect(() => stageRemoteMigrationLedgerReaderBundle(
      remoteConfig,
      bundle,
      'migration-ledger-test-cleanup',
      { runAws, deleteStagedObject }
    )).toThrow('injected head-object failure');

    expect(deleteStagedObject).toHaveBeenCalledWith(
      remoteConfig,
      expect.stringMatching(/^ssm-sql\/path-schema-migrate\/schema-ledger-readers\//u),
      { runAws }
    );
  });

  test('dispatch failure retains SSM output while deleting local, remote, and S3 staging', () => {
    const tempRoot = fs.mkdtempSync('/tmp/remote-ledger-cleanup-failure-');
    const stagedArtifact = {
      key: 'ssm-sql/path-schema-migrate/schema-ledger-readers/reader/failure.tgz',
      uri: 's3://test/failure.tgz',
      downloadUrl: 'https://example.test/failure.tgz',
      sha256: 'e'.repeat(64),
      bytes: 123,
    };
    const deleteStagedObject = jest.fn();
    let commandsText = '';

    expect(() => dispatchRemoteMigrationLedgerReader(remoteConfig, {
      proveOuterAwsIdentity: () => ({ Account: remoteConfig.expectedAccountId }),
      discoverInstance: () => 'i-0123456789abcdef0',
      createBundle: () => ({
        tempRoot,
        archivePath: `${tempRoot}/bundle.tgz`,
        sha256: stagedArtifact.sha256,
        bytes: stagedArtifact.bytes,
      }),
      stageBundle: () => stagedArtifact,
      sendCommand: (_config, _instanceId, commands) => {
        commandsText = commands.join('\n');
        return 'command-ledger-failure';
      },
      waitCommand: () => ({
        Status: 'Failed',
        ResponseCode: 1,
        StandardOutputContent: 'not-a-result-marker',
        StandardErrorContent: 'injected reader stderr',
      }),
      deleteStagedObject,
    })).toThrow(expect.objectContaining({
      code: 'remote_migration_ledger_result_missing',
      remoteExecution: {
        commandId: 'command-ledger-failure',
        instanceId: 'i-0123456789abcdef0',
        status: 'Failed',
        responseCode: 1,
        stdout: 'not-a-result-marker',
        stderr: 'injected reader stderr',
      },
    }));

    expect(commandsText).toContain("trap 'rm -rf -- \"$OPS_DIR\"' EXIT");
    expect(deleteStagedObject).toHaveBeenCalledWith(remoteConfig, stagedArtifact.key);
    expect(fs.existsSync(tempRoot)).toBe(false);
  });
});
