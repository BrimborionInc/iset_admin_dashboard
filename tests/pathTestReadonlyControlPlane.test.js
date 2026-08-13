'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  ARTIFACTS,
  ControlPlaneError,
  DEFAULT_LIMITS,
  EXPECTED_ACCOUNT,
  EXPECTED_ASG,
  EXPECTED_BUCKET,
  EXPECTED_DEV_EVIDENCE_PATH,
  EXPECTED_MANIFEST_PATH,
  EXPECTED_OPERATOR_ARN,
  EXPECTED_PROFILE,
  EXPECTED_REGION,
  PHASE8_ATTESTATION_CHECK_ID,
  PHASE8_ATTESTATION_PURPOSE,
  PHASE8_ATTESTATION_TTL_MS,
  PROVENANCE_PATHS,
  TARGETS,
  assertAdmittedAwsOperation,
  buildRemoteCommand,
  executeControlPlane,
  loadAndValidateHistoricalDevEvidence,
  loadAndValidateManifest,
  parseArgs,
  parseRemoteOutput,
  runBoundedSsm,
  sha256,
  validateCliBoundary,
  validateHistoricalDevEvidenceObject,
  validateManifestObject,
  verifyEvidenceDigest,
} = require('../scripts/path-test-readonly-control-plane');
const { createEvidenceId, validateQualificationEvidence } = require('../src/lib/releaseQualification');
const {
  createSyntheticHistoricalInputs,
  writeSyntheticHistoricalInputs,
} = require('./fixtures/pathTestReadonlyControlPlane');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEST_NOW = Date.parse('2026-08-12T12:00:00.000Z');
const PHASE8_NOW = Date.parse('2026-08-13T12:00:00.000Z');
const temporaryRoots = [];
const syntheticInputs = createSyntheticHistoricalInputs();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadManifest() {
  return clone(syntheticInputs.manifest);
}

function loadDevEvidence() {
  return clone(syntheticInputs.evidence);
}

function createTemporaryRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-test-control-plane-'));
  temporaryRoots.push(root);
  return root;
}

function writeManifest(root, manifest = loadManifest()) {
  const filename = path.join(root, 'manifest.json');
  fs.writeFileSync(filename, `${JSON.stringify(manifest, null, 2)}\n`);
  return filename;
}

function expectedSourceState() {
  return [
    { path: 'scripts/path-test-readonly-control-plane.js', bytes: 100, sha256: 'a'.repeat(64) },
    { path: 'scripts/path-deploy.js', bytes: 200, sha256: 'b'.repeat(64) },
  ];
}

function remoteResult(manifest, instanceId = 'i-0123456789abcdef0') {
  const provenance = {};
  for (const component of ['admin', 'portal']) {
    const value = {
      schemaVersion: 1,
      releaseId: manifest.releaseId,
      environment: 'test',
      component,
      qualificationEvidenceId: manifest.qualification.evidenceId,
      source: clone(manifest.qualification.candidate.source),
      generatedAt: '2026-08-10T03:27:00.000Z',
    };
    const raw = Buffer.from(JSON.stringify(value));
    provenance[component] = { bytes: raw.length, rawSha256: sha256(raw), value };
  }
  return {
    instanceId,
    processId: 1234,
    identity: {
      Account: EXPECTED_ACCOUNT,
      Arn: `arn:aws:sts::${EXPECTED_ACCOUNT}:assumed-role/nwac-test-app-role/${instanceId}`,
      UserId: `AROATEST:${instanceId}`,
    },
    provenance,
  };
}

function framedRemote(value) {
  return `PATH_PHASE7_RESULT=${Buffer.from(JSON.stringify(value)).toString('base64')}\n`;
}

function successfulAdapter(manifest = loadManifest()) {
  const instanceId = 'i-0123456789abcdef0';
  const targetArns = {
    admin: `arn:aws:elasticloadbalancing:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:targetgroup/${TARGETS.admin.name}/abc123`,
    portal: `arn:aws:elasticloadbalancing:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:targetgroup/${TARGETS.portal.name}/def456`,
  };
  const adapter = {
    commandEvidence: [],
    async getLocalIdentity() {
      return { Account: EXPECTED_ACCOUNT, Arn: EXPECTED_OPERATOR_ARN, UserId: 'AIDATEST' };
    },
    async getCompute() {
      return {
        asg: {
          AutoScalingGroups: [{
            AutoScalingGroupName: EXPECTED_ASG,
            Instances: [{ InstanceId: instanceId, LifecycleState: 'InService', HealthStatus: 'Healthy' }],
          }],
        },
        ssm: { InstanceInformationList: [{ InstanceId: instanceId, PingStatus: 'Online' }] },
      };
    },
    admitInstances(instanceIds) {
      this.admittedInstances = [...instanceIds];
    },
    async getTarget(component) {
      return {
        group: {
          TargetGroups: [{
            TargetGroupName: TARGETS[component].name,
            TargetGroupArn: targetArns[component],
            Port: TARGETS[component].port,
          }],
        },
        health: {
          TargetHealthDescriptions: [{
            Target: { Id: instanceId, Port: TARGETS[component].port },
            TargetHealth: { State: 'healthy' },
          }],
        },
      };
    },
    async headArtifact(definition) {
      return {
        ContentLength: definition.bytes,
        LastModified: definition.lastModified || '2026-08-10T03:00:00.000Z',
        ETag: '"synthetic-etag"',
      };
    },
    async runRemote(requestedInstance) {
      return {
        instanceId: requestedInstance,
        commandId: 'synthetic-command-id',
        status: 'Success',
        statusDetails: 'Success',
        responseCode: 0,
        executionStartDateTime: '2026-08-12T12:00:00.000Z',
        executionEndDateTime: '2026-08-12T12:00:01.000Z',
        outputBytes: 100,
        outputSha256: 'c'.repeat(64),
        processTerminal: true,
        parsed: remoteResult(manifest, requestedInstance),
      };
    },
  };
  return adapter;
}

async function runSynthetic(options = {}) {
  const root = createTemporaryRoot();
  const manifest = options.manifest || loadManifest();
  const phase8CfaAttestation = options.phase8CfaAttestation === true;
  const historicalInputs = phase8CfaAttestation ? writeSyntheticHistoricalInputs(root) : null;
  const manifestPath = historicalInputs?.manifestPath || writeManifest(root, manifest);
  const attemptId = options.attemptId || (phase8CfaAttestation
    ? 'phase8c-p1-synthetic-attempt'
    : 'phase7b-synthetic-attempt');
  const evidenceOut = path.join(root, attemptId, 'final.json');
  const source = expectedSourceState();
  const adapter = options.adapter || successfulAdapter(manifest);
  return executeControlPlane({
    manifestPath,
    phase8CfaAttestation,
    devEvidencePath: historicalInputs?.devEvidencePath || null,
    attemptId,
    evidenceOut,
    adapter,
    nowMs: phase8CfaAttestation ? PHASE8_NOW : TEST_NOW,
    clock: options.clock || (() => new Date(phase8CfaAttestation
      ? '2026-08-13T12:00:00.000Z'
      : '2026-08-12T12:00:00.000Z')),
    clockMs: options.clockMs || (() => (phase8CfaAttestation ? PHASE8_NOW : TEST_NOW)),
    sourceStateProvider: options.sourceStateProvider || (() => clone(source)),
    expectedManifestSha256: historicalInputs?.manifestSha256 || null,
    expectedDevEvidenceSha256: historicalInputs?.devEvidenceSha256 || null,
    syntheticHistoricalInput: Boolean(historicalInputs),
  });
}

function expectManifestFailure(mutate, code) {
  const manifest = loadManifest();
  mutate(manifest);
  expect(() => validateManifestObject(manifest, { nowMs: TEST_NOW })).toThrow(expect.objectContaining({ code }));
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
    expect(fs.existsSync(root)).toBe(false);
  }
});

describe('Sprint 7B read-only TEST control-plane contract', () => {
  test('accepts only the exact CLI identity, manifest, and attempt-owned evidence path', () => {
    const attemptId = 'phase7b-cli-contract';
    const args = parseArgs([
      '--manifest', EXPECTED_MANIFEST_PATH,
      '--profile', EXPECTED_PROFILE,
      '--region', EXPECTED_REGION,
      '--attempt-id', attemptId,
      '--evidence-out', path.join(REPO_ROOT, 'tmp/release-qualification/test-control-plane', attemptId, 'final.json'),
      '--json',
    ]);
    expect(() => validateCliBoundary(args)).not.toThrow();
    for (const [field, replacement] of [
      ['profile', 'default'],
      ['region', 'us-east-1'],
      ['manifest', path.join(REPO_ROOT, 'other.json')],
      ['attemptId', 'bad'],
      ['evidenceOut', path.join(REPO_ROOT, 'tmp/wrong.json')],
    ]) {
      expect(() => validateCliBoundary({ ...args, [field]: replacement })).toThrow(ControlPlaneError);
    }
  });

  test('accepts the repository-owned synthetic r31 manifest and preserves all five identities', () => {
    const result = validateManifestObject(loadManifest(), { nowMs: TEST_NOW });
    expect(result).toMatchObject({
      releaseId: '20260809-two-step-review-assurance-r31',
      evidenceId: syntheticInputs.evidence.evidenceId,
      preflightEvidenceId: syntheticInputs.manifest.preflight.evidenceId,
    });
    expect(result.source).toEqual({
      admin: expect.objectContaining({ gitHead: expect.any(String), treeFingerprint: expect.any(String), gitDirty: false }),
      portal: expect.objectContaining({ gitHead: expect.any(String), treeFingerprint: expect.any(String), gitDirty: false }),
      shared: expect.objectContaining({ gitHead: expect.any(String), treeFingerprint: expect.any(String), gitDirty: false }),
    });
  });

  test.each([
    ['failed manifest', manifest => { manifest.status = 'failed'; }, 'FIELD_CONFLICT'],
    ['wrong profile', manifest => { manifest.profile = 'default'; }, 'FIELD_CONFLICT'],
    ['wrong region', manifest => { manifest.region = 'us-east-1'; }, 'FIELD_CONFLICT'],
    ['wrong account', manifest => { manifest.identity.account = '000000000000'; }, 'FIELD_CONFLICT'],
    ['wrong operator', manifest => { manifest.identity.arn = `arn:aws:iam::${EXPECTED_ACCOUNT}:user/Other`; }, 'FIELD_CONFLICT'],
    ['qualification NO-GO', manifest => { manifest.qualification.decision = 'NO-GO'; }, 'FIELD_CONFLICT'],
    ['expired qualification', manifest => { manifest.qualification.expiresAt = '2026-08-11T00:00:00.000Z'; }, 'MANIFEST_STALE'],
    ['component omission', manifest => { manifest.qualification.candidate.components.pop(); }, 'FIELD_CONFLICT'],
    ['source conflict', manifest => { manifest.preflight.source.portal.treeFingerprint = 'f'.repeat(64); }, 'FIELD_CONFLICT'],
    ['failed preflight', manifest => { manifest.preflight.checks[0].status = 'failed'; }, 'FIELD_CONFLICT'],
    ['failed deployment step', manifest => { manifest.steps[0].status = 'failed'; }, 'FIELD_CONFLICT'],
    ['wrong current bucket', manifest => { manifest.appApply.artifacts.admin.artifact = manifest.appApply.artifacts.admin.artifact.replace(EXPECTED_BUCKET, 'wrong'); }, 'FIELD_CONFLICT'],
    ['wrong current key', manifest => { manifest.appApply.artifacts.portal.artifact += '.wrong'; }, 'FIELD_CONFLICT'],
    ['wrong rollback key', manifest => { manifest.appApply.artifacts.admin.rollbackArtifact.key += '.wrong'; }, 'FIELD_CONFLICT'],
    ['failed retained smoke', manifest => { manifest.smokeResults[0].ok = false; }, 'FIELD_CONFLICT'],
  ])('rejects %s before AWS admission', (_name, mutate, code) => {
    expectManifestFailure(mutate, code);
  });

  test('emits complete incremental passed evidence with no release authority', async () => {
    const outcome = await runSynthetic();
    expect(outcome.final).toMatchObject({
      status: 'passed',
      releaseAuthority: 'none',
      effect: {
        awsReadsOnly: true,
        productMutation: false,
        databaseAccess: false,
        productHttpAccess: false,
        sesAccess: false,
      },
      cleanup: {
        status: 'unnecessary',
        residueDecision: 'no-declared-write-effect',
        independentProof: { completed: true, passed: true },
      },
    });
    expect(outcome.final.result.instances).toEqual(['i-0123456789abcdef0']);
    expect(outcome.final.result.targets).toHaveLength(2);
    expect(outcome.final.result.artifacts).toHaveLength(4);
    expect(outcome.final.result.remote).toHaveLength(1);
    expect(outcome.final.events.map(event => event.type)).toEqual([
      'invocation-received',
      'source-before',
      'manifest-accepted',
      'local-identity-proved',
      'compute-scope-proved',
      'target-health-proved',
      'artifact-presence-proved',
      'remote-provenance-proved',
      'source-stability-proved',
    ]);
    expect(verifyEvidenceDigest(outcome.retained.path)).toEqual({
      sha256: outcome.retained.sha256,
      bytes: outcome.retained.bytes,
    });
  });

  test.each([
    ['wrong live account', adapter => { adapter.getLocalIdentity = async () => ({ Account: '000000000000', Arn: EXPECTED_OPERATOR_ARN, UserId: 'x' }); }, 'FIELD_CONFLICT'],
    ['wrong live operator', adapter => { adapter.getLocalIdentity = async () => ({ Account: EXPECTED_ACCOUNT, Arn: `arn:aws:iam::${EXPECTED_ACCOUNT}:user/Other`, UserId: 'x' }); }, 'FIELD_CONFLICT'],
    ['absent ASG', adapter => { adapter.getCompute = async () => ({ asg: { AutoScalingGroups: [] }, ssm: { InstanceInformationList: [] } }); }, 'ASG_SCOPE_INVALID'],
    ['empty ASG', adapter => { adapter.getCompute = async () => ({ asg: { AutoScalingGroups: [{ AutoScalingGroupName: EXPECTED_ASG, Instances: [] }] }, ssm: { InstanceInformationList: [] } }); }, 'ASG_SCOPE_EMPTY'],
    ['unhealthy ASG instance', adapter => { const original = adapter.getCompute; adapter.getCompute = async () => { const value = await original(); value.asg.AutoScalingGroups[0].Instances[0].HealthStatus = 'Unhealthy'; return value; }; }, 'FIELD_CONFLICT'],
    ['not-InService ASG instance', adapter => { const original = adapter.getCompute; adapter.getCompute = async () => { const value = await original(); value.asg.AutoScalingGroups[0].Instances[0].LifecycleState = 'Pending'; return value; }; }, 'FIELD_CONFLICT'],
    ['SSM-offline ASG instance', adapter => { const original = adapter.getCompute; adapter.getCompute = async () => { const value = await original(); value.ssm.InstanceInformationList[0].PingStatus = 'ConnectionLost'; return value; }; }, 'SSM_INSTANCE_OFFLINE'],
    ['wrong target port', adapter => { const original = adapter.getTarget; adapter.getTarget = async component => { const value = await original(component); value.group.TargetGroups[0].Port += 1; return value; }; }, 'FIELD_CONFLICT'],
    ['wrong target ARN', adapter => { const original = adapter.getTarget; adapter.getTarget = async component => { const value = await original(component); value.group.TargetGroups[0].TargetGroupArn = value.group.TargetGroups[0].TargetGroupArn.replace(EXPECTED_ACCOUNT, '000000000000'); return value; }; }, 'TARGET_GROUP_IDENTITY_INVALID'],
    ['unhealthy target', adapter => { const original = adapter.getTarget; adapter.getTarget = async component => { const value = await original(component); value.health.TargetHealthDescriptions[0].TargetHealth.State = 'unhealthy'; return value; }; }, 'FIELD_CONFLICT'],
    ['wrong target membership', adapter => { const original = adapter.getTarget; adapter.getTarget = async component => { const value = await original(component); value.health.TargetHealthDescriptions[0].Target.Id = 'i-wrong'; return value; }; }, 'TARGET_MEMBERSHIP_MISMATCH'],
    ['missing artifact', adapter => { adapter.headArtifact = async () => { throw new ControlPlaneError('AWS_COMMAND_FAILED', 'not found'); }; }, 'AWS_COMMAND_FAILED'],
    ['artifact size mismatch', adapter => { const original = adapter.headArtifact; adapter.headArtifact = async definition => { const value = await original(definition); value.ContentLength += 1; return value; }; }, 'ARTIFACT_SIZE_MISMATCH'],
    ['rollback timestamp mismatch', adapter => { const original = adapter.headArtifact; adapter.headArtifact = async definition => { const value = await original(definition); if (definition.role === 'rollback') value.LastModified = '2026-08-01T00:00:00.000Z'; return value; }; }, 'ARTIFACT_TIME_MISMATCH'],
    ['wrong remote account', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.parsed.identity.Account = '000000000000'; return value; }; }, 'FIELD_CONFLICT'],
    ['wrong remote role', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.parsed.identity.Arn = `arn:aws:sts::${EXPECTED_ACCOUNT}:assumed-role/Other/${id}`; return value; }; }, 'REMOTE_ROLE_MISMATCH'],
    ['stale provenance release', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.parsed.provenance.admin.value.releaseId = 'stale'; return value; }; }, 'FIELD_CONFLICT'],
    ['conflicting provenance source', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.parsed.provenance.portal.value.source.shared.treeFingerprint = 'f'.repeat(64); return value; }; }, 'FIELD_CONFLICT'],
    ['malformed provenance digest', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.parsed.provenance.admin.rawSha256 = 'bad'; return value; }; }, 'FIELD_MALFORMED'],
    ['missing terminal process proof', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.processTerminal = false; return value; }; }, 'FIELD_CONFLICT'],
    ['missing transport digest', adapter => { const original = adapter.runRemote; adapter.runRemote = async id => { const value = await original(id); value.outputSha256 = null; return value; }; }, 'FIELD_MALFORMED'],
  ])('fails closed for %s and retains partial evidence', async (_name, mutate, code) => {
    const manifest = loadManifest();
    const adapter = successfulAdapter(manifest);
    mutate(adapter);
    const outcome = await runSynthetic({ manifest, adapter });
    expect(outcome.final.status).toBe('failed');
    expect(outcome.final.failure.code).toBe(code);
    expect(outcome.final.releaseAuthority).toBe('none');
    expect(verifyEvidenceDigest(outcome.retained.path).sha256).toBe(outcome.retained.sha256);
  });

  test('rejects missing, duplicate, malformed, and truncated remote frames', () => {
    const result = remoteResult(loadManifest());
    expect(() => parseRemoteOutput('')).toThrow(expect.objectContaining({ code: 'REMOTE_RESULT_COUNT_INVALID' }));
    const framed = framedRemote(result).trim();
    expect(() => parseRemoteOutput(`${framed}\n${framed}\n`)).toThrow(expect.objectContaining({ code: 'REMOTE_RESULT_COUNT_INVALID' }));
    expect(() => parseRemoteOutput('PATH_PHASE7_RESULT=%%%\n')).toThrow(ControlPlaneError);
    expect(() => parseRemoteOutput('PATH_PHASE7_RESULT=ew==\n')).toThrow(expect.objectContaining({ code: 'JSON_MALFORMED' }));
  });

  test('rejects every undeclared or broadened AWS and remote operation', () => {
    expect(() => assertAdmittedAwsOperation(['ses', 'send-email'])).toThrow(expect.objectContaining({ code: 'AWS_OPERATION_REJECTED' }));
    expect(() => assertAdmittedAwsOperation(['rds', 'describe-db-instances'])).toThrow(expect.objectContaining({ code: 'AWS_OPERATION_REJECTED' }));
    expect(() => assertAdmittedAwsOperation(['s3api', 'head-object', '--bucket', EXPECTED_BUCKET, '--key', 'other'])).toThrow(expect.objectContaining({ code: 'AWS_OPERATION_REJECTED' }));
    const instanceId = 'i-0123456789abcdef0';
    const context = { instances: new Set([instanceId]), commandIds: new Set(), targetArns: new Set() };
    for (const command of ['cat /opt/nwac/admin-dashboard/.env', 'curl http://127.0.0.1:5001', 'mysql -e SELECT', 'echo data > /tmp/write']) {
      const parameters = JSON.stringify({ commands: [command], executionTimeout: [String(DEFAULT_LIMITS.ssmExecutionSeconds)] });
      expect(() => assertAdmittedAwsOperation([
        'ssm', 'send-command', '--instance-ids', instanceId, '--document-name', 'AWS-RunShellScript', '--parameters', parameters,
      ], context)).toThrow(expect.objectContaining({ code: 'AWS_OPERATION_REJECTED' }));
    }
    const admittedCommand = buildRemoteCommand(instanceId);
    const encodedProgram = /Buffer\.from\('([^']+)'/u.exec(admittedCommand)?.[1];
    const admittedProgram = Buffer.from(encodedProgram, 'base64').toString('utf8');
    expect(admittedProgram).not.toMatch(/\.env|https?:\/\/|\bmysql\b|\bses\b/iu);
    expect(admittedProgram).toContain(PROVENANCE_PATHS.admin);
    expect(admittedProgram).toContain(PROVENANCE_PATHS.portal);
  });

  test('proves bounded successful SSM framing without cancellation', async () => {
    const instanceId = 'i-0123456789abcdef0';
    const context = { instances: new Set([instanceId]), commandIds: new Set(), targetArns: new Set() };
    const calls = [];
    const manifest = loadManifest();
    const invoke = args => {
      calls.push(args);
      if (args[1] === 'send-command') return { Command: { CommandId: 'command-success' } };
      return {
        Status: 'Success',
        StatusDetails: 'Success',
        ResponseCode: 0,
        StandardOutputContent: framedRemote(remoteResult(manifest, instanceId)),
      };
    };
    const result = await runBoundedSsm({ invoke, context, instanceId });
    expect(result).toMatchObject({ commandId: 'command-success', status: 'Success', responseCode: 0, processTerminal: true });
    expect(calls.map(args => args[1])).toEqual(['send-command', 'get-command-invocation']);
  });

  test('times out once, cancels once, proves terminal state, and does not retry', async () => {
    const instanceId = 'i-0123456789abcdef0';
    const context = { instances: new Set([instanceId]), commandIds: new Set(), targetArns: new Set() };
    const calls = [];
    let now = 0;
    let cancelled = false;
    const invoke = args => {
      calls.push(args[1]);
      if (args[1] === 'send-command') return { Command: { CommandId: 'command-timeout' } };
      if (args[1] === 'cancel-command') { cancelled = true; return { CommandId: 'command-timeout' }; }
      return cancelled ? { Status: 'Cancelled', ResponseCode: -1 } : { Status: 'InProgress' };
    };
    await expect(runBoundedSsm({
      invoke,
      context,
      instanceId,
      limits: { ...DEFAULT_LIMITS, ssmPollMs: 10, ssmTotalMs: 20, ssmCancellationMs: 20 },
      clockMs: () => now,
      sleep: async duration => { now += duration; },
    })).rejects.toMatchObject({ code: 'SSM_COMMAND_TIMEOUT' });
    expect(calls.filter(value => value === 'send-command')).toHaveLength(1);
    expect(calls.filter(value => value === 'cancel-command')).toHaveLength(1);
  });

  test('fails closed when timeout cancellation fails', async () => {
    const instanceId = 'i-0123456789abcdef0';
    const context = { instances: new Set([instanceId]), commandIds: new Set(), targetArns: new Set() };
    let now = 0;
    const invoke = args => {
      if (args[1] === 'send-command') return { Command: { CommandId: 'command-cancel-fail' } };
      if (args[1] === 'cancel-command') throw new ControlPlaneError('AWS_PERMISSION_DENIED', 'cancel denied');
      return { Status: 'InProgress' };
    };
    await expect(runBoundedSsm({
      invoke,
      context,
      instanceId,
      limits: { ...DEFAULT_LIMITS, ssmPollMs: 10, ssmTotalMs: 10, ssmCancellationMs: 10 },
      clockMs: () => now,
      sleep: async duration => { now += duration; },
    })).rejects.toMatchObject({ code: 'SSM_CANCELLATION_FAILED' });
  });

  test('fails closed for late/missing invocation and non-success terminal command', async () => {
    const instanceId = 'i-0123456789abcdef0';
    const run = async terminal => {
      const context = { instances: new Set([instanceId]), commandIds: new Set(), targetArns: new Set() };
      let call = 0;
      const invoke = args => {
        if (args[1] === 'send-command') return { Command: { CommandId: `command-${terminal}` } };
        call += 1;
        if (call === 1) throw new ControlPlaneError('AWS_COMMAND_FAILED', 'not ready', { diagnostic: 'InvocationDoesNotExist' });
        return terminal === 'Failed'
          ? { Status: 'Failed', ResponseCode: 1, StandardErrorContent: 'synthetic failure' }
          : { Status: 'Success', ResponseCode: 0, StandardOutputContent: '' };
      };
      return runBoundedSsm({ invoke, context, instanceId, sleep: async () => {} });
    };
    await expect(run('Failed')).rejects.toMatchObject({ code: 'SSM_COMMAND_FAILED' });
    await expect(run('Success')).rejects.toMatchObject({ code: 'REMOTE_RESULT_COUNT_INVALID' });
  });

  test('detects source drift and retains the failed terminal record', async () => {
    let capture = 0;
    const sourceStateProvider = () => {
      capture += 1;
      const value = expectedSourceState();
      if (capture > 1) value[0].sha256 = 'f'.repeat(64);
      return value;
    };
    const outcome = await runSynthetic({ sourceStateProvider });
    expect(outcome.final.status).toBe('failed');
    expect(outcome.final.failure.code).toBe('SOURCE_DRIFT');
  });

  test('rejects corrupted final evidence bytes', async () => {
    const outcome = await runSynthetic();
    fs.appendFileSync(outcome.retained.path, 'corrupt');
    expect(() => verifyEvidenceDigest(outcome.retained.path)).toThrow(expect.objectContaining({ code: 'EVIDENCE_DIGEST_MISMATCH' }));
  });
});

describe('Sprint 8C-P1 bounded provenance attestation', () => {
  test('keeps legacy validation stale while admitting only the explicit attestation CLI boundary', () => {
    expect(() => validateManifestObject(loadManifest(), { nowMs: PHASE8_NOW }))
      .toThrow(expect.objectContaining({ code: 'MANIFEST_STALE' }));

    const attemptId = 'phase8c-p1-cli-contract';
    const args = parseArgs([
      '--manifest', EXPECTED_MANIFEST_PATH,
      '--phase8-cfa-attestation',
      '--dev-evidence', EXPECTED_DEV_EVIDENCE_PATH,
      '--profile', EXPECTED_PROFILE,
      '--region', EXPECTED_REGION,
      '--attempt-id', attemptId,
      '--evidence-out', path.join(REPO_ROOT, 'tmp/release-qualification/test-control-plane', attemptId, 'final.json'),
      '--json',
    ]);
    expect(() => validateCliBoundary(args)).not.toThrow();
    expect(() => validateCliBoundary({ ...args, devEvidence: path.join(REPO_ROOT, 'other.json') }))
      .toThrow(expect.objectContaining({ code: 'DEV_EVIDENCE_PATH_REJECTED' }));
    expect(() => validateCliBoundary({ ...args, phase8CfaAttestation: false }))
      .toThrow(expect.objectContaining({ code: 'DEV_EVIDENCE_UNEXPECTED' }));
    expect(() => validateCliBoundary({ ...args, devEvidence: null }))
      .toThrow(expect.objectContaining({ code: 'DEV_EVIDENCE_PATH_REJECTED' }));
  });

  test('proves a checksum-bound synthetic DEV GO was live when deployment admission began', () => {
    const root = createTemporaryRoot();
    const inputs = writeSyntheticHistoricalInputs(root);
    const manifest = validateManifestObject(loadManifest(), {
      nowMs: PHASE8_NOW,
      historicalQualification: true,
    });
    const evidence = loadAndValidateHistoricalDevEvidence(
      inputs.devEvidencePath,
      manifest,
      {
        nowMs: PHASE8_NOW,
        expectedDevEvidenceSha256: inputs.devEvidenceSha256,
        syntheticHistoricalInput: true,
      }
    );
    expect(evidence.digest).toBe(inputs.devEvidenceSha256);
    expect(evidence.model).toMatchObject({
      evidenceId: manifest.evidenceId,
      generatedAt: '2026-08-10T03:23:30.461Z',
      expiresAt: '2026-08-13T03:23:30.461Z',
      deploymentAdmissionStartedAt: '2026-08-10T03:24:22.279Z',
      validAtDeploymentAdmission: true,
      currentStatus: 'expired',
      candidate: {
        components: ['admin', 'portal', 'shared'],
        source: manifest.source,
        schemaSha256: manifest.schemaSha256,
      },
    });
    expect(evidence.model.requiredChecks).toEqual(syntheticInputs.evidence.requiredChecks);
  });

  test.each([
    ['changed canonical bytes', evidence => { evidence.checks[0].status = 'failed'; }, 'FIELD_CONFLICT'],
    ['candidate source conflict', evidence => {
      evidence.candidate.source.portal.treeFingerprint = 'f'.repeat(64);
      evidence.evidenceId = createEvidenceId(evidence);
    }, 'FIELD_CONFLICT'],
    ['failed required check', evidence => {
      evidence.checks.find(check => check.id === 'portal-build').status = 'failed';
      evidence.evidenceId = createEvidenceId(evidence);
    }, 'FIELD_CONFLICT'],
  ])('rejects %s before any adapter operation', (_name, mutate, code) => {
    const manifest = validateManifestObject(loadManifest(), {
      nowMs: PHASE8_NOW,
      historicalQualification: true,
    });
    const evidence = loadDevEvidence();
    mutate(evidence);
    expect(() => validateHistoricalDevEvidenceObject(evidence, manifest, { nowMs: PHASE8_NOW }))
      .toThrow(expect.objectContaining({ code }));
  });

  test('independently rejects evidence generated after deployment admission began', () => {
    const manifest = validateManifestObject(loadManifest(), {
      nowMs: PHASE8_NOW,
      historicalQualification: true,
    });
    const evidence = loadDevEvidence();
    evidence.generatedAt = '2026-08-10T03:25:00.000Z';
    evidence.evidenceId = createEvidenceId(evidence);
    expect(() => validateHistoricalDevEvidenceObject(
      evidence,
      { ...manifest, evidenceId: evidence.evidenceId },
      { nowMs: PHASE8_NOW }
    )).toThrow(expect.objectContaining({ code: 'HISTORICAL_AUTHORITY_TIMING_INVALID' }));
  });

  test('rejects any retained DEV artifact byte drift independently of JSON semantics', () => {
    const root = createTemporaryRoot();
    const inputs = writeSyntheticHistoricalInputs(root);
    const copyPath = path.join(root, 'dev-evidence.json');
    fs.copyFileSync(inputs.devEvidencePath, copyPath);
    const manifest = validateManifestObject(loadManifest(), {
      nowMs: PHASE8_NOW,
      historicalQualification: true,
    });
    expect(loadAndValidateHistoricalDevEvidence(copyPath, manifest, {
      nowMs: PHASE8_NOW,
      expectedDevEvidenceSha256: inputs.devEvidenceSha256,
      syntheticHistoricalInput: true,
    }).digest).toBe(inputs.devEvidenceSha256);
    fs.appendFileSync(copyPath, ' ');
    expect(() => loadAndValidateHistoricalDevEvidence(copyPath, manifest, {
      nowMs: PHASE8_NOW,
      expectedDevEvidenceSha256: inputs.devEvidenceSha256,
      syntheticHistoricalInput: true,
    }))
      .toThrow(expect.objectContaining({ code: 'FIELD_CONFLICT' }));
  });

  test('rejects synthetic historical checksum overrides outside the unit-test boundary', () => {
    const root = createTemporaryRoot();
    const inputs = writeSyntheticHistoricalInputs(root);
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(() => loadAndValidateManifest(inputs.manifestPath, {
        nowMs: PHASE8_NOW,
        historicalQualification: true,
        expectedManifestSha256: inputs.manifestSha256,
        syntheticHistoricalInput: true,
      })).toThrow(expect.objectContaining({ code: 'SYNTHETIC_INPUT_REJECTED' }));
      expect(() => loadAndValidateHistoricalDevEvidence(inputs.devEvidencePath, {}, {
        nowMs: PHASE8_NOW,
        expectedDevEvidenceSha256: inputs.devEvidenceSha256,
        syntheticHistoricalInput: true,
      })).toThrow(expect.objectContaining({ code: 'SYNTHETIC_INPUT_REJECTED' }));
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });

  test('emits a short-lived CFA-only artifact with no release or deployment authority', async () => {
    const outcome = await runSynthetic({ phase8CfaAttestation: true });
    expect(outcome.final).toMatchObject({
      checkId: PHASE8_ATTESTATION_CHECK_ID,
      releaseAuthority: 'none',
      status: 'passed',
      attestation: {
        purpose: PHASE8_ATTESTATION_PURPOSE,
        allowedConsumer: 'frozen-phase8-cfa-harness-certification-exercise',
        releaseAuthority: 'none',
        historicalDevAuthority: {
          fileSha256: syntheticInputs.devEvidenceSha256,
          validAtDeploymentAdmission: true,
          currentStatus: 'expired',
        },
      },
      cleanup: {
        status: 'unnecessary',
        residueDecision: 'no-declared-write-effect',
        independentProof: { completed: true, passed: true },
      },
    });
    expect(outcome.final.attestation.prohibitedConsumers).toEqual([
      'deployment',
      'test-release-qualification',
      'prod-admission',
      'other-product-candidates',
    ]);
    expect(Date.parse(outcome.final.attestation.expiresAt) - Date.parse(outcome.final.attestation.issuedAt))
      .toBe(PHASE8_ATTESTATION_TTL_MS);
    expect(outcome.final).not.toHaveProperty('stage');
    expect(outcome.final).not.toHaveProperty('decision');
    expect(outcome.final).not.toHaveProperty('evidenceId');
    expect(validateQualificationEvidence({
      evidence: outcome.final,
      expectedStage: 'dev',
      currentSource: loadManifest().qualification.candidate.source,
      inventorySha256: loadDevEvidence().inventorySha256,
      schemaSha256: loadManifest().qualification.candidate.schemaSha256,
      requiredComponents: ['admin', 'portal', 'shared'],
      now: new Date(PHASE8_NOW),
    })).toEqual(expect.arrayContaining([
      'qualification evidence checksum mismatch',
      'qualification stage must be dev',
    ]));
    expect(outcome.final.events.map(event => event.type)).toContain('historical-dev-authority-proved');
    expect(verifyEvidenceDigest(outcome.retained.path).sha256).toBe(outcome.retained.sha256);
  });

  test('fails closed if the bounded Phase 8 attestation expires before finalization', async () => {
    let call = 0;
    const outcome = await runSynthetic({
      phase8CfaAttestation: true,
      clock: () => new Date(call++ === 0 ? '2026-08-13T12:00:00.000Z' : '2026-08-13T13:16:00.000Z'),
    });
    expect(outcome.final.status).toBe('failed');
    expect(outcome.final.failure).toMatchObject({
      code: 'ATTESTATION_WINDOW_EXPIRED',
      phase: 'attestation-finalization',
    });
    expect(outcome.final.releaseAuthority).toBe('none');
  });
});
