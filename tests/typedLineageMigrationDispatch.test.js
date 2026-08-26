const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  MIGRATION_FILENAME,
  MIGRATION_SHA256,
} = require('../scripts/lib/typed-lineage-migration-executor');
const {
  ENVIRONMENT_CONTRACTS: SECURE_MESSAGE_ENVIRONMENT_CONTRACTS,
  MIGRATION_FILENAME: SECURE_MESSAGE_MIGRATION_FILENAME,
  MIGRATION_SHA256: SECURE_MESSAGE_MIGRATION_SHA256,
} = require('../scripts/lib/secure-message-idempotency-migration-executor');
const {
  REMOTE_TARGETS,
  applyPendingRemoteSharedSchemaMigrations,
  assertApplyAuthorization,
  createPresignedS3PutUrl,
  createSecureMessageIdempotencyExecutorBundle,
  parseSecureMessageIdempotencyRemoteSummary,
  parseArgs,
  planPendingRemoteSharedSchemaMigrations,
  validateSecureMessageIdempotencyDispatchResult,
} = require('../scripts/path-schema-migrate');

const migrationPath = path.join(__dirname, '..', 'sql', 'migrations', MIGRATION_FILENAME);
const secureMessageMigrationPath = path.join(
  __dirname,
  '..',
  'sql',
  'migrations',
  SECURE_MESSAGE_MIGRATION_FILENAME
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function typedLineageMigration(overrides = {}) {
  const content = fs.readFileSync(migrationPath, 'utf8');
  return {
    file: MIGRATION_FILENAME,
    checksum: sha256(content),
    content,
    fullPath: migrationPath,
    ...overrides,
  };
}

function secureMessageMigration(overrides = {}) {
  const content = fs.readFileSync(secureMessageMigrationPath, 'utf8');
  return {
    file: SECURE_MESSAGE_MIGRATION_FILENAME,
    checksum: sha256(content),
    content,
    fullPath: secureMessageMigrationPath,
    ...overrides,
  };
}

function remoteLedger(rows = []) {
  return { trackingTableExists: true, rows };
}

function quietLogger() {
  return { log: jest.fn(), error: jest.fn(), warn: jest.fn() };
}

describe('canonical typed-lineage migration dispatch', () => {
  test('evidence upload staging produces a short-lived signed PUT URL without exposing the secret', () => {
    const url = createPresignedS3PutUrl(
      {
        ...REMOTE_TARGETS.test,
        profile: REMOTE_TARGETS.test.defaultProfile,
        region: REMOTE_TARGETS.test.defaultRegion,
      },
      'nwac-test-artifacts',
      'releases/schema-executors/evidence.json.gz',
      900,
      {
        credentialsProvider: () => ({
          AccessKeyId: 'AKIATESTEXAMPLE',
          SecretAccessKey: 'test-secret-that-must-not-appear',
          SessionToken: 'test-session-token',
        }),
        clock: () => new Date('2026-08-25T18:00:00.000Z'),
      }
    );
    const parsed = new URL(url);
    expect(parsed.protocol).toBe('https:');
    expect(parsed.hostname).toBe('nwac-test-artifacts.s3.ca-central-1.amazonaws.com');
    expect(parsed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(parsed.searchParams.get('X-Amz-Expires')).toBe('900');
    expect(parsed.searchParams.get('X-Amz-Security-Token')).toBe('test-session-token');
    expect(parsed.searchParams.get('X-Amz-Signature')).toMatch(/^[a-f0-9]{64}$/u);
    expect(url).not.toContain('test-secret-that-must-not-appear');
  });

  test('canonical PROD apply rejects missing --yes before any remote operation', () => {
    expect(() => assertApplyAuthorization(parseArgs([
      'apply', '--target-env', 'prod', '--json',
    ]))).toThrow(expect.objectContaining({
      code: 'prod_schema_apply_confirmation_required',
      message: 'Prod apply requires --yes',
    }));
    expect(assertApplyAuthorization(parseArgs([
      'apply', '--target-env', 'prod', '--json', '--yes',
    ]))).toEqual(expect.objectContaining({ targetEnv: 'prod', command: 'apply', yes: true }));
  });

  test('the deploy parent still captures the PROD restore point before schema apply', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const restoreStep = source.indexOf("'db.restore-point'");
    const schemaStep = source.indexOf("'schema.apply'");
    expect(restoreStep).toBeGreaterThan(-1);
    expect(schemaStep).toBeGreaterThan(restoreStep);
  });

  test('TEST plans and executes bounded revalidation even when the exact ledger row already succeeded', () => {
    const migration = typedLineageMigration();
    const ledger = remoteLedger([{
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      success: 1,
    }]);
    const plan = planPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations: [migration],
      remoteLedger: ledger,
    });
    expect(plan.pendingCount).toBe(0);
    expect(plan.specialDispatches).toEqual([expect.objectContaining({
      file: MIGRATION_FILENAME,
      action: 'revalidate',
      rawSqlFallbackAllowed: false,
    })]);

    const dispatch = jest.fn(() => ({ summary: { decision: 'COMPLETE' } }));
    const runRemoteSql = jest.fn();
    const result = applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations: [migration],
      remoteLedger: ledger,
      dispatchTypedLineageMigration: dispatch,
      runRemoteSql,
      logger: quietLogger(),
    });

    expect(dispatch).toHaveBeenCalledWith(
      REMOTE_TARGETS.test,
      migration,
      { mode: 'revalidate' }
    );
    expect(runRemoteSql).not.toHaveBeenCalled();
    expect(result.attempted).toEqual([expect.objectContaining({
      file: MIGRATION_FILENAME,
      success: true,
      execution: 'bounded-dispatch',
      action: 'revalidate',
    })]);
  });

  test('PROD sends the pinned migration only to bounded dispatch and never to runRemoteSql', () => {
    const migration = typedLineageMigration();
    const dispatch = jest.fn(() => ({ summary: { decision: 'COMPLETE' } }));
    const runRemoteSql = jest.fn();

    const result = applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.prod, {
      migrations: [migration],
      remoteLedger: remoteLedger(),
      dispatchTypedLineageMigration: dispatch,
      runRemoteSql,
      logger: quietLogger(),
    });

    expect(dispatch).toHaveBeenCalledWith(
      REMOTE_TARGETS.prod,
      migration,
      { mode: 'apply' }
    );
    expect(runRemoteSql).not.toHaveBeenCalled();
    expect(result.specialDispatches[0]).toEqual(expect.objectContaining({
      action: 'apply-and-verify',
      rawSqlFallbackAllowed: false,
    }));
  });

  test('a checksum change fails before dispatch, tracking-table ensure, or raw SQL fallback', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'typed-lineage-dispatch-checksum-'));
    const changedPath = path.join(tempRoot, MIGRATION_FILENAME);
    fs.writeFileSync(changedPath, `${fs.readFileSync(migrationPath, 'utf8')}\n`, 'utf8');
    const changed = typedLineageMigration({
      content: fs.readFileSync(changedPath, 'utf8'),
      checksum: sha256(fs.readFileSync(changedPath)),
      fullPath: changedPath,
    });
    const dispatch = jest.fn();
    const runRemoteSql = jest.fn();

    expect(() => applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.prod, {
      migrations: [changed],
      remoteLedger: remoteLedger(),
      dispatchTypedLineageMigration: dispatch,
      runRemoteSql,
      logger: quietLogger(),
    })).toThrow(/typed_lineage_migration_checksum_mismatch/u);
    expect(dispatch).not.toHaveBeenCalled();
    expect(runRemoteSql).not.toHaveBeenCalled();
  });

  test('secure-message idempotency checksum drift fails before either bounded executor can dispatch', () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'secure-message-idempotency-dispatch-checksum-'));
    try {
      const changedPath = path.join(tempRoot, SECURE_MESSAGE_MIGRATION_FILENAME);
      fs.writeFileSync(
        changedPath,
        `${fs.readFileSync(secureMessageMigrationPath, 'utf8')}\n`,
        'utf8'
      );
      const changed = secureMessageMigration({
        content: fs.readFileSync(changedPath, 'utf8'),
        checksum: sha256(fs.readFileSync(changedPath)),
        fullPath: changedPath,
      });
      const dispatchTypedLineageMigration = jest.fn();
      const dispatchSecureMessageIdempotencyMigration = jest.fn();

      expect(() => applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.prod, {
        migrations: [typedLineageMigration(), changed],
        remoteLedger: remoteLedger(),
        dispatchTypedLineageMigration,
        dispatchSecureMessageIdempotencyMigration,
        logger: quietLogger(),
      })).toThrow(/secure_message_idempotency_migration_checksum_mismatch/u);
      expect(dispatchTypedLineageMigration).not.toHaveBeenCalled();
      expect(dispatchSecureMessageIdempotencyMigration).not.toHaveBeenCalled();
    } finally {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  test.each([
    '20260824_9999_unbounded-before.sql',
    '20260826_0001_unbounded-after.sql',
  ])('a pending non-special migration %s fails before bounded or raw mutation dispatch', file => {
    const unboundedMigration = {
      file,
      checksum: sha256('SELECT 1;'),
      content: 'SELECT 1;',
      fullPath: `/not-used/${file}`,
    };
    const dispatch = jest.fn();
    const runRemoteSql = jest.fn();

    expect(() => applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations: [typedLineageMigration(), unboundedMigration].sort((left, right) => (
        left.file.localeCompare(right.file)
      )),
      remoteLedger: remoteLedger(),
      dispatchTypedLineageMigration: dispatch,
      runRemoteSql,
      logger: quietLogger(),
    })).toThrow(expect.objectContaining({
      code: 'remote_generic_migration_bounded_dispatch_required',
      pending: [{ file, checksum: unboundedMigration.checksum }],
    }));

    expect(dispatch).not.toHaveBeenCalled();
    expect(runRemoteSql).not.toHaveBeenCalled();
  });

  test('both remote plan and apply obtain ledger state through the bounded reader hook', () => {
    const migration = typedLineageMigration();
    const readRemoteMigrationLedger = jest.fn(() => remoteLedger([{
      filename: MIGRATION_FILENAME,
      checksum: MIGRATION_SHA256,
      success: 1,
    }]));
    const dispatch = jest.fn(() => ({ summary: { decision: 'COMPLETE' } }));

    const plan = planPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations: [migration],
      readRemoteMigrationLedger,
    });
    expect(plan.pendingCount).toBe(0);
    expect(readRemoteMigrationLedger).toHaveBeenCalledTimes(1);

    const result = applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations: [migration],
      readRemoteMigrationLedger,
      dispatchTypedLineageMigration: dispatch,
      logger: quietLogger(),
    });
    expect(readRemoteMigrationLedger).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(result.attempted[0]).toEqual(expect.objectContaining({ action: 'revalidate' }));
  });

  test('explicit bounded registry dispatches registered migrations in canonical filename order', () => {
    const calls = [];
    const migrations = [
      {
        file: '20260825_0003_registered-third.sql',
        checksum: '3'.repeat(64),
        content: 'not raw-run',
        fullPath: '/candidate/third.sql',
      },
      {
        file: '20260825_0002_registered-second.sql',
        checksum: '2'.repeat(64),
        content: 'not raw-run',
        fullPath: '/candidate/second.sql',
      },
    ];
    const boundedMigrationRegistry = new Map(migrations.map(migration => [migration.file, {
      file: migration.file,
      checksum: migration.checksum,
      executor: `bounded-${migration.file}`,
      verifyArtifact: () => ({ checksum: migration.checksum }),
      dispatch: (_remoteConfig, dispatchedMigration) => {
        calls.push(dispatchedMigration.file);
        return { summary: { decision: 'COMPLETE' } };
      },
      revalidateApplied: true,
    }]));

    const result = applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations,
      boundedMigrationRegistry,
      remoteLedger: remoteLedger(),
      logger: quietLogger(),
    });

    expect(calls).toEqual([
      '20260825_0002_registered-second.sql',
      '20260825_0003_registered-third.sql',
    ]);
    expect(result.attempted.map(item => item.file)).toEqual(calls);
    expect(result.specialDispatches.every(item => item.rawSqlFallbackAllowed === false)).toBe(true);
  });

  test('the two release migrations are explicitly bounded and dispatch in canonical order', () => {
    const calls = [];
    const dispatchTypedLineageMigration = jest.fn((_config, migration, execution) => {
      calls.push([migration.file, execution.mode]);
      return { summary: { decision: 'COMPLETE' } };
    });
    const dispatchSecureMessageIdempotencyMigration = jest.fn((_config, migration, execution) => {
      calls.push([migration.file, execution.mode]);
      return { summary: { decision: 'COMPLETE' } };
    });
    const migrations = [secureMessageMigration(), typedLineageMigration()];

    const result = applyPendingRemoteSharedSchemaMigrations(REMOTE_TARGETS.test, {
      migrations,
      remoteLedger: remoteLedger(),
      dispatchTypedLineageMigration,
      dispatchSecureMessageIdempotencyMigration,
      logger: quietLogger(),
    });

    expect(calls).toEqual([
      [MIGRATION_FILENAME, 'apply'],
      [SECURE_MESSAGE_MIGRATION_FILENAME, 'apply'],
    ]);
    expect(result.specialDispatches).toEqual([
      expect.objectContaining({
        file: MIGRATION_FILENAME,
        executor: '20260825-typed-lineage-bounded',
        rawSqlFallbackAllowed: false,
      }),
      expect.objectContaining({
        file: SECURE_MESSAGE_MIGRATION_FILENAME,
        executor: '20260825-secure-message-idempotency-bounded',
        rawSqlFallbackAllowed: false,
      }),
    ]);
    expect(result.attempted.map(item => item.file)).toEqual([
      MIGRATION_FILENAME,
      SECURE_MESSAGE_MIGRATION_FILENAME,
    ]);
  });

  test('secure-message idempotency bundle contains only its pinned wrapper, executor, migration, and manifest', () => {
    const bundle = createSecureMessageIdempotencyExecutorBundle(secureMessageMigration());
    try {
      const listing = spawnSync('tar', ['-tzf', bundle.archivePath], { encoding: 'utf8' });
      expect(listing.status).toBe(0);
      expect(listing.stdout.split(/\r?\n/u).filter(Boolean).sort()).toEqual([
        './',
        './MANIFEST.sha256',
        './scripts/',
        './scripts/apply-20260825-secure-message-idempotency.js',
        './scripts/lib/',
        './scripts/lib/secure-message-idempotency-migration-executor.js',
        './sql/',
        './sql/migrations/',
        `./sql/migrations/${SECURE_MESSAGE_MIGRATION_FILENAME}`,
      ].sort());
    } finally {
      fs.rmSync(bundle.tempRoot, { recursive: true, force: true });
    }
  });

  test('secure-message idempotency bounded summary is pinned to exact environment and execution context', () => {
    const instanceId = 'i-0123456789abcdef0';
    const runToken = 'secure-message-idempotency-test-123';
    const remoteConfig = {
      ...REMOTE_TARGETS.test,
      profile: REMOTE_TARGETS.test.defaultProfile,
      region: REMOTE_TARGETS.test.defaultRegion,
    };
    const summary = {
      evidencePath: `/opt/nwac/admin-dashboard/.ops/${runToken}/evidence.json`,
      evidenceFallbackUsed: false,
      schemaVersion: 1,
      executor: '20260825-secure-message-idempotency-bounded',
      targetEnv: 'test',
      decision: 'COMPLETE',
      phase: 'complete',
      awsIdentity: {
        Account: REMOTE_TARGETS.test.expectedAccountId,
        InstanceId: instanceId,
        Region: remoteConfig.region,
      },
      executionContext: {
        expectedAwsAccountId: REMOTE_TARGETS.test.expectedAccountId,
        expectedSsmInstanceId: instanceId,
        runToken,
      },
      configuredDatabase: SECURE_MESSAGE_ENVIRONMENT_CONTRACTS.test.configured,
      migration: {
        filename: SECURE_MESSAGE_MIGRATION_FILENAME,
        checksum: SECURE_MESSAGE_MIGRATION_SHA256,
      },
      metadataStatementCount: 20,
      operationCount: 1,
      finalIdentity: SECURE_MESSAGE_ENVIRONMENT_CONTRACTS.test.live,
      finalOperationStates: { message_send_operation: 'target' },
      ledger: {
        filename: SECURE_MESSAGE_MIGRATION_FILENAME,
        checksum: SECURE_MESSAGE_MIGRATION_SHA256,
        success: true,
      },
      failure: null,
      operationalWarnings: [],
    };
    const output = `PATH_SECURE_MESSAGE_IDEMPOTENCY_RESULT=${Buffer.from(
      JSON.stringify(summary),
      'utf8'
    ).toString('base64')}`;

    expect(parseSecureMessageIdempotencyRemoteSummary(output)).toEqual(summary);
    expect(validateSecureMessageIdempotencyDispatchResult(
      summary,
      remoteConfig,
      instanceId,
      runToken
    )).toEqual(summary);
    expect(() => validateSecureMessageIdempotencyDispatchResult(
      {
        ...summary,
        executionContext: { ...summary.executionContext, runToken: 'wrong-run' },
      },
      remoteConfig,
      instanceId,
      runToken
    )).toThrow(expect.objectContaining({
      code: 'secure_message_idempotency_dispatch_result_invalid',
    }));
  });
});
