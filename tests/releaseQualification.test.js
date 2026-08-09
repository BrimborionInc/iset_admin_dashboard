const fs = require('fs');
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

describe('release qualification contract', () => {
  test('the machine coverage inventory is valid and all mandatory checks resolve', () => {
    expect(validateInventory(inventory)).toEqual([]);
    const checks = requiredChecksFor(inventory, 'dev', inventory.domains.map(domain => domain.id));
    expect(checks).toEqual(expect.arrayContaining([
      'admin-aggregate',
      'portal-aggregate',
      'real-mysql-contract',
      'admin-browser-suite',
      'payment-db-rollback',
    ]));
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
    expect(applicantSmoke).toMatch(/finally \{\s+if \(!config\.keepFixture && fixtureMutationStarted/u);
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
