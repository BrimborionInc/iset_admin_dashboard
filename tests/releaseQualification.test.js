const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  createEvidenceId,
  requiredChecksFor,
  resolveDomains,
  resolveOperationDomains,
  sha256Json,
  validateInventory,
  validateQualificationEvidence,
} = require('../src/lib/releaseQualification');
const { runtimeCommands } = require('../scripts/path-test-runtime-postflight');
const {
  executeQualificationChecks,
  runCommandCheck,
  validateCfaQualificationEvidence,
  validatePrerequisiteDeclarations,
} = require('../scripts/path-release-qualify');

const inventory = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '..', 'docs', 'testing', 'release-coverage-inventory.json'),
  'utf8'
));

function evidence(overrides = {}) {
  const value = {
    schemaVersion: 1,
    generatedAt: '2026-07-13T12:00:00.000Z',
    expiresAt: '2026-07-16T12:00:00.000Z',
    stage: 'dev',
    releaseId: 'release-1',
    decision: 'GO',
    inventorySha256: sha256Json(inventory),
    domains: ['schema-readiness'],
    candidate: {
      components: ['admin', 'portal', 'shared'],
      schemaSha256: 'schema-1',
      source: {
        admin: { gitHead: 'a', treeFingerprint: 'tree-a' },
        portal: { gitHead: 'p', treeFingerprint: 'tree-p' },
        shared: { gitHead: 's', treeFingerprint: 'tree-s' },
      },
    },
    requiredChecks: ['real-mysql-contract'],
    checks: [{ id: 'real-mysql-contract', status: 'passed' }],
    ...overrides,
  };
  value.evidenceId = createEvidenceId(value);
  return value;
}

const CFA_REQUIRED_CHECKS = [
  'live identity and full DDL verified',
  'synthetic CFA fixture seeded from verified schema',
  'real applicant Cognito authentication succeeded',
  'CFA signed with correct application/document/event lineage',
  'identical repeat signing was idempotent',
  'changed signing payload was rejected without changing completion state',
];

function completeCfaEvidence(attemptId) {
  const execution = {
    attemptId,
    releaseAuthority: 'none',
    status: 'PASS',
    ok: true,
    mode: 'stateful-execution',
    cleanup: { database: 'complete', objects: 'complete' },
    checks: CFA_REQUIRED_CHECKS,
    startedAt: '2026-08-13T12:00:00.000Z',
    finishedAt: '2026-08-13T12:01:00.000Z',
  };
  const verification = {
    attemptId,
    releaseAuthority: 'none',
    status: 'PASS',
    ok: true,
    mode: 'verify-residue-only',
    residue: {
      database: Array.from({ length: 19 }, (_, index) => ({ scope: `db-${index}`, count: 0 })),
      objects: [{ key: 'prior', absent: true }, { key: 'signed', absent: true }],
    },
  };
  return {
    ...execution,
    test: {
      lifecycle: {
        interruption: false,
        execution: {
          terminal: { status: 'Success', responseCode: 0, terminal: true },
          transport: { result: { ...execution } },
        },
        recovery: null,
        cognito: { absent: true },
        verification: {
          terminal: { status: 'Success', responseCode: 0, terminal: true },
          transport: { result: verification },
        },
        bundle: { absent: true },
      },
    },
  };
}

describe('release qualification contract', () => {
  test('the machine coverage inventory is valid and all mandatory checks resolve', () => {
    expect(validateInventory(inventory)).toEqual([]);
    expect(validatePrerequisiteDeclarations(inventory)).toEqual([]);
    const checks = requiredChecksFor(inventory, 'dev', inventory.domains.map(domain => domain.id));
    expect(checks).toEqual(expect.arrayContaining([
      'admin-aggregate',
      'portal-aggregate',
      'real-mysql-contract',
      'admin-browser-suite',
      'payment-db-rollback',
    ]));
    expect(inventory.alwaysRequired.dev).not.toContain('intacct-local-contract');
    expect(checks).toContain('intacct-local-contract');
  });

  test('ordinary releases do not require the development-only Intacct sibling, while Intacct changes do', () => {
    const ordinary = resolveDomains(inventory, {
      admin: ['scripts/path-release-qualify.js'],
      portal: [],
      shared: [],
      intacctMock: [],
    });
    expect(ordinary.unmatched).toEqual([]);
    expect(requiredChecksFor(inventory, 'dev', ordinary.domainIds))
      .not.toContain('intacct-local-contract');
    expect(requiredChecksFor(inventory, 'dev', resolveDomains(inventory, {}, true).domainIds))
      .not.toContain('intacct-local-contract');

    const intacct = resolveDomains(inventory, {
      admin: ['scripts/intacct-contract-audit.js'],
      portal: [],
      shared: [],
      intacctMock: ['src/server.js'],
    });
    expect(intacct.unmatched).toEqual([]);
    expect(intacct.domainIds).toContain('intacct-development-tooling');
    expect(requiredChecksFor(inventory, 'dev', intacct.domainIds))
      .toContain('intacct-local-contract');
    expect(inventory.checks['intacct-local-contract'].command)
      .toEqual(['npm', 'run', 'audit:intacct-contract']);
  });

  test('TEST prerequisite failures block every dependent fixture without suppressing effect-free final checks', () => {
    const spawned = [];
    const checks = executeQualificationChecks({
      stage: 'test',
      deploymentManifest: '/synthetic/deployment.json',
    }, inventory, {
      requiredChecks: inventory.alwaysRequired.test,
      releaseId: 'release-1',
      candidate: { source: {}, components: [] },
    }, '/synthetic/logs', {
      loadJson: () => ({ app: {} }),
      internalCheck: id => ({ id }),
      runCommandCheck: id => {
        spawned.push(id);
        return { id, status: id === 'test-target-health' ? 'failed' : 'passed' };
      },
      writeProgress: () => {},
    });

    const dependentIds = [
      'test-two-step-role-journeys',
      'test-intake-completion',
      'test-cfa-signing',
      'test-applicant-scope-browser',
      'test-live-privacy-denials',
      'test-payment-rollback',
    ];
    expect(checks.filter(check => dependentIds.includes(check.id)))
      .toEqual(dependentIds.map(id => expect.objectContaining({ id, status: 'blocked' })));
    expect(spawned).toEqual([
      'test-target-health',
      'test-runtime-postflight',
      'test-maintenance-cleanup',
    ]);
    expect(checks.at(-1)).toEqual(expect.objectContaining({ id: 'candidate-source-stability', status: 'passed' }));
  });

  test('successful TEST prerequisites preserve declared command order and missing evidence blocks fail closed', () => {
    const spawned = [];
    const complete = executeQualificationChecks({
      stage: 'test',
      deploymentManifest: '/synthetic/deployment.json',
    }, inventory, {
      requiredChecks: inventory.alwaysRequired.test,
      releaseId: 'release-1',
      candidate: { source: {}, components: [] },
    }, '/synthetic/logs', {
      loadJson: () => ({ app: {} }),
      internalCheck: id => ({ id }),
      runCommandCheck: id => {
        spawned.push(id);
        return { id, status: 'passed' };
      },
      writeProgress: () => {},
    });
    expect(complete.every(check => check.status === 'passed')).toBe(true);
    expect(spawned).toEqual(inventory.alwaysRequired.test.filter(id => !inventory.checks[id].type));

    const missing = executeQualificationChecks({ stage: 'test' }, inventory, {
      requiredChecks: ['test-cfa-signing'],
      releaseId: 'release-1',
      candidate: { source: {}, components: [] },
    }, '/synthetic/logs', { writeProgress: () => {} });
    expect(missing).toEqual([expect.objectContaining({
      id: 'test-cfa-signing',
      status: 'blocked',
      reason: expect.stringContaining('test-deployment-provenance=missing'),
    })]);
  });

  test('invalid prerequisite declarations fail inventory admission', () => {
    const invalid = JSON.parse(JSON.stringify(inventory));
    invalid.checks['test-cfa-signing'].prerequisites = ['unknown-check'];
    expect(validatePrerequisiteDeclarations(invalid)).toEqual(expect.arrayContaining([
      'check test-cfa-signing references unknown prerequisite unknown-check',
      'check test-cfa-signing prerequisite unknown-check must be an earlier test mandatory check',
    ]));
  });

  test('unknown development-only selection policy fails inventory admission', () => {
    const invalid = JSON.parse(JSON.stringify(inventory));
    invalid.domains.find(domain => domain.id === 'intacct-development-tooling').selection = 'optional';
    expect(validateInventory(invalid)).toContain(
      'domain intacct-development-tooling has invalid selection optional'
    );
  });

  test('CFA dispatch binds a fresh attempt and accepts one complete native result', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-cfa-check-'));
    try {
      const check = inventory.checks['test-cfa-signing'];
      const spawn = jest.fn((_command, args) => {
        const attemptId = args[args.indexOf('--attempt-id') + 1];
        const evidenceOut = args[args.indexOf('--evidence-out') + 1];
        fs.writeFileSync(evidenceOut, `${JSON.stringify(completeCfaEvidence(attemptId))}\n`, 'utf8');
        return { status: 0, stdout: '{"status":"PASS"}', stderr: '' };
      });
      const record = runCommandCheck('test-cfa-signing', check, root, {}, {
        randomUUID: () => '11111111-1111-4111-8111-111111111111',
        now: () => new Date('2026-08-13T12:00:00.000Z'),
        spawnSync: spawn,
      });
      const args = spawn.mock.calls[0][1];
      expect(args).toEqual(expect.arrayContaining([
        '--attempt-id', 'release-cfa-11111111-1111-4111-8111-111111111111',
        '--sprint-started-at', '2026-08-13T12:00:00.000Z',
      ]));
      expect(record).toEqual(expect.objectContaining({
        status: 'passed',
        details: expect.objectContaining({
          attemptId: 'release-cfa-11111111-1111-4111-8111-111111111111',
          releaseAuthority: 'none',
          processTerminal: true,
          cleanupComplete: true,
          residueVerified: true,
          evidenceSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
      }));
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      expect(fs.existsSync(root)).toBe(false);
    }
  });

  test.each([
    ['missing', () => {}],
    ['malformed', filename => fs.writeFileSync(filename, '{bad-json', 'utf8')],
    ['conflicting', (filename, attemptId) => fs.writeFileSync(
      filename,
      JSON.stringify(completeCfaEvidence(`${attemptId}-stale`)),
      'utf8'
    )],
  ])('CFA %s result evidence fails closed', (_caseName, writeEvidence) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-cfa-negative-'));
    try {
      const record = runCommandCheck('test-cfa-signing', inventory.checks['test-cfa-signing'], root, {}, {
        randomUUID: () => '22222222-2222-4222-8222-222222222222',
        now: () => new Date('2026-08-13T12:00:00.000Z'),
        spawnSync: (_command, args) => {
          const attemptId = args[args.indexOf('--attempt-id') + 1];
          const filename = args[args.indexOf('--evidence-out') + 1];
          writeEvidence(filename, attemptId);
          return { status: 0, stdout: '', stderr: '' };
        },
      });
      expect(record.status).toBe('failed');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('CFA nonzero, timeout, stale path, incomplete cleanup and residue all fail closed', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-cfa-failures-'));
    try {
      const check = inventory.checks['test-cfa-signing'];
      const common = {
        now: () => new Date('2026-08-13T12:00:00.000Z'),
      };
      expect(runCommandCheck('test-cfa-signing', check, root, {}, {
        ...common,
        randomUUID: () => '33333333-3333-4333-8333-333333333333',
        spawnSync: () => ({ status: 1, stdout: '', stderr: 'failed' }),
      })).toEqual(expect.objectContaining({ status: 'failed', exitCode: 1 }));
      expect(runCommandCheck('test-cfa-signing', check, root, {}, {
        ...common,
        randomUUID: () => '44444444-4444-4444-8444-444444444444',
        spawnSync: () => ({ status: null, signal: 'SIGTERM', error: new Error('timed out'), stdout: '', stderr: '' }),
      })).toEqual(expect.objectContaining({ status: 'failed', signal: 'SIGTERM', error: 'timed out' }));

      const staleAttempt = 'release-cfa-55555555-5555-4555-8555-555555555555';
      fs.mkdirSync(path.join(root, 'test-cfa-signing', staleAttempt), { recursive: true });
      expect(runCommandCheck('test-cfa-signing', check, root, {}, {
        ...common,
        randomUUID: () => '55555555-5555-4555-8555-555555555555',
        spawnSync: () => { throw new Error('must not spawn'); },
      })).toEqual(expect.objectContaining({ status: 'failed', error: expect.stringContaining('already exists') }));

      const cleanupIncomplete = completeCfaEvidence('attempt-complete-1');
      cleanupIncomplete.test.lifecycle.cognito.absent = false;
      expect(() => validateCfaQualificationEvidence(cleanupIncomplete, { attemptId: 'attempt-complete-1' }))
        .toThrow('CFA Cognito cleanup absence is unproved');
      const residue = completeCfaEvidence('attempt-complete-2');
      residue.test.lifecycle.verification.transport.result.residue.database[0].count = 1;
      expect(() => validateCfaQualificationEvidence(residue, { attemptId: 'attempt-complete-2' }))
        .toThrow('cfa_independent_residue_result_incomplete');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('TEST strict denials provision disposable identities without manual token variables', () => {
    const check = inventory.checks['test-live-privacy-denials'];
    expect(check.command).toEqual(expect.arrayContaining([
      'scripts/applicant-scope-guard-test-smoke.js',
      '--privacy-denials',
    ]));
    expect(check.requiredEnv).toBeUndefined();
    expect(check.cleanup).toMatch(/zero-residue/i);
  });

  test('live TEST fixture smokes bound hangs, clean in finally, and wait for durable notifications', () => {
    const applicantSmoke = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'applicant-scope-guard-test-smoke.js'),
      'utf8'
    );
    expect(applicantSmoke).toContain('Timed out reading HTTP response body');
    expect(applicantSmoke).toContain(
      'const cleanupRequired = !config.keepFixture && fixtureMutationStarted && !cleanupSuppressedForSchemaSafety;'
    );
    expect(applicantSmoke).toContain('const { cleanupError, closeOutcome } = await runCleanupThenClose({');
    expect(applicantSmoke.indexOf('result.connectionClose = closeOutcome;')).toBeLessThan(
      applicantSmoke.indexOf('if (cleanupError) throw cleanupError;')
    );
    expect(applicantSmoke).toContain("cookieToken(fixture.sessionA, 'iset_access')");
    expect(applicantSmoke).toContain("cookieToken(fixture.sessionB, 'iset_access')");

    const twoStepSmoke = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'two-step-review-test-smoke.js'),
      'utf8'
    );
    expect(twoStepSmoke).toContain('TWO_STEP_REVIEW_NOTIFICATION_WAIT_ATTEMPTS');
    expect(twoStepSmoke).toContain('attempt < config.notificationWaitAttempts');
    expect(twoStepSmoke).toContain('two-step-review-route-failure-');
    expect(twoStepSmoke).toContain('pageText');
    expect(twoStepSmoke).toContain('parseJsonObject(additionalFacts?.intervention?.metadata_json)');
    expect(twoStepSmoke).not.toContain('parseJsonObject(additionalFacts?.metadata_json)');

    const interventionBrowserSmoke = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'intervention-assessment-workflow-browser-smoke.js'),
      'utf8'
    );
    expect(interventionBrowserSmoke).toContain('const beforeResubmitSignature = await getVisibleWizardContentSignature(page);');
    expect(interventionBrowserSmoke).toContain("'post-resubmit intervention wizard refresh'");
    expect(interventionBrowserSmoke.indexOf("'post-resubmit intervention wizard refresh'")).toBeLessThan(
      interventionBrowserSmoke.indexOf("expectedActionText: 'Submit for final decision'")
    );
  });

  test('TEST runtime shell probes preserve their inline JavaScript quoting', () => {
    const commands = runtimeCommands({
      releaseId: 'release-1',
      deployedComponents: ['admin', 'portal'],
      fingerprints: { admin: 'a', portal: 'p', shared: 's' },
    }, false);
    const readyCommand = commands.find(command => command.includes('127.0.0.1:5001/readyz'))
      .replace('curl -fsS http://127.0.0.1:5001/readyz', `printf '{"status":"ready"}'`);
    expect(spawnSync('bash', ['-lc', readyCommand], { encoding: 'utf8' }).status).toBe(0);

    const processCommand = commands.find(command => command.startsWith('pm2 jlist'))
      .replace('pm2 jlist', `printf '[{"name":"nwac-admin","pid":1,"pm2_env":{"status":"online","restart_time":0}},{"name":"nwac-portal","pid":2,"pm2_env":{"status":"online","restart_time":0}}]'`);
    const processProbe = spawnSync('bash', ['-lc', processCommand], { encoding: 'utf8' });
    expect(processProbe.status).toBe(0);
    expect(processProbe.stdout).toContain('PROCESS_NWAC_ADMIN=online');
    expect(processProbe.stdout).toContain('PROCESS_NWAC_PORTAL=online');
    expect(runtimeCommands({
      releaseId: 'release-1',
      deployedComponents: ['admin'],
      fingerprints: { admin: 'a', portal: 'p', shared: 's' },
    }, true)).toContain(
      'cd /opt/nwac/admin-dashboard && node scripts/payments-workflow-smoke.js --target-env test --json'
    );
    expect(inventory.checks['payment-db-rollback'].command).toEqual([
      'npm', 'run', 'payments:workflow:smoke', '--', '--target-env', 'dev',
    ]);
  });

  test('shared and schema changes expand to dependent cross-application domains', () => {
    const resolved = resolveDomains(inventory, {
      admin: ['src/lib/adminRuntimeSchemaContract.js'],
      portal: [],
      shared: ['events/deliveryQueue.js'],
    });
    expect(resolved.unmatched).toEqual([]);
    expect(resolved.domainIds).toEqual(expect.arrayContaining([
      'schema-readiness',
      'notifications-workers',
    ]));
  });

  test('configuration and refresh operations map to explicit release domains', () => {
    expect(resolveOperationDomains(inventory, ['dataset:intake-release', 'workflow:21']).domainIds)
      .toEqual(expect.arrayContaining(['intake-cross-application', 'runtime-config']));
    expect(resolveOperationDomains(inventory, ['arbitrary-sql']).unmatched).toEqual(['arbitrary-sql']);
  });

  test('GO evidence must be unexpired and exact for all three source trees', () => {
    const value = evidence();
    expect(validateQualificationEvidence({
      evidence: value,
      expectedStage: 'dev',
      currentSource: value.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toEqual([]);

    expect(validateQualificationEvidence({
      evidence: value,
      expectedStage: 'dev',
      currentSource: {
        ...value.candidate.source,
        portal: { gitHead: 'p', treeFingerprint: 'changed' },
      },
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toContain('qualification source does not match current portal tree');
  });

  test('failed, unavailable, expired, or tampered evidence cannot authorize release', () => {
    const unavailable = evidence({
      requiredChecks: ['real-mysql-contract'],
      checks: [{ id: 'real-mysql-contract', status: 'unavailable' }],
    });
    expect(validateQualificationEvidence({
      evidence: unavailable,
      expectedStage: 'dev',
      currentSource: unavailable.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-17T00:00:00.000Z'),
    })).toEqual(expect.arrayContaining([
      'qualification evidence is expired or has no valid expiry',
      'qualification check real-mysql-contract is unavailable',
    ]));

    const blocked = evidence({
      requiredChecks: ['test-cfa-signing'],
      checks: [{ id: 'test-cfa-signing', status: 'blocked' }],
    });
    expect(validateQualificationEvidence({
      evidence: blocked,
      expectedStage: 'dev',
      currentSource: blocked.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date('2026-07-14T00:00:00.000Z'),
    })).toContain('qualification check test-cfa-signing is blocked');

    unavailable.decision = 'GO-but-edited';
    expect(validateQualificationEvidence({
      evidence: unavailable,
      expectedStage: 'dev',
      currentSource: unavailable.candidate.source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: 'schema-1',
      requiredComponents: ['admin', 'portal', 'shared'],
    })).toContain('qualification evidence checksum mismatch');
  });
});
