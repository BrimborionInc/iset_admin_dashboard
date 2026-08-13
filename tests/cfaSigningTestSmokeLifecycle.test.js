const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const sourcePath = path.resolve(__dirname, '..', 'scripts', 'cfa-signing-test-smoke.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const {
  EVIDENCE_CHUNK_BYTES,
  STATEFUL_LIMITS,
  admissionBundle,
  admissionEvidenceFile,
  createEvidenceChunk,
  deleteApplicant,
  executeStatefulLifecycle,
  parseArgs,
  parseSmokeJson,
  reconstructAdmissionEvidence,
  reconstructEvidence,
  statefulCommandPlan,
  statefulEvidenceFile,
  validateCompleteAdmission,
  waitForCommand,
} = require('../scripts/cfa-signing-test-smoke');
const {
  REQUIRED_OBJECTS,
  encodeResult,
  writeEvidenceFile,
} = require('../scripts/cfa-signing-schema-preflight');

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function completeAdmission(attemptId) {
  const largeDdl = Array.from({ length: 2_000 }, (_, index) => sha256(Buffer.from(`ddl-${index}`))).join('');
  const objects = Object.fromEntries(REQUIRED_OBJECTS.map((name, index) => {
    const rawDdl = index === 0 ? `CREATE TABLE ${name} (${largeDdl})` : `CREATE TABLE ${name} (id BIGINT)`;
    return [name, {
      rawDdl,
      rawDdlHash: sha256(Buffer.from(rawDdl)),
      structuralDdlHash: sha256(Buffer.from(`structural:${name}`)),
      columnsHash: sha256(Buffer.from(`columns:${name}`)),
      indexesHash: sha256(Buffer.from(`indexes:${name}`)),
      constraintsHash: sha256(Buffer.from(`constraints:${name}`)),
    }];
  }));
  return {
    status: 'PASS',
    attemptId,
    prerequisites: { noEmail: true },
    comparison: { stable: true },
    verifiedStatementCount: 8,
    postflightVerifiedStatementCount: 0,
    statementCatalogue: Array.from({ length: 68 }, (_, index) => ({ id: `statement-${index}` })),
    first: { objects },
    second: { objects },
  };
}

function transportFixture() {
  const attemptId = 'phase8b-transport-synthetic-0001';
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfa-admission-transport-'));
  const filename = path.join(root, 'admission-envelope.json');
  const admission = completeAdmission(attemptId);
  const manifest = writeEvidenceFile(filename, encodeResult(admission));
  const bytes = fs.readFileSync(filename);
  const count = Math.ceil(bytes.length / EVIDENCE_CHUNK_BYTES);
  const chunks = Array.from({ length: count }, (_, index) => createEvidenceChunk(bytes, manifest, index));
  return { admission, attemptId, bytes, chunks, filename, manifest, root };
}

function lifecycleResult(attemptId, phase) {
  const common = { attemptId, releaseAuthority: 'none', ok: true, status: 'PASS' };
  if (phase === 'execution') {
    return {
      ...common,
      mode: 'stateful-execution',
      cleanup: { database: true, objects: true },
      checks: [
        'live identity and full DDL verified',
        'synthetic CFA fixture seeded from verified schema',
        'real applicant Cognito authentication succeeded',
        'CFA signed with correct application/document/event lineage',
        'identical repeat signing was idempotent',
        'changed signing payload was rejected without changing completion state',
      ],
    };
  }
  if (phase === 'interrupted') {
    return {
      ...common,
      ok: false,
      status: 'INTERRUPTED',
      mode: 'post-sign-interruption',
      signed: { documentId: 1, objectKey: 'signed.pdf', eventId: 'event-1', objectSize: 10 },
      interruption: { checkpoint: 'durable-post-sign-evidence' },
    };
  }
  if (phase === 'recovery') return { ...common, mode: 'recovery-only', cleanup: { database: true, objects: true } };
  return {
    ...common,
    mode: 'verify-residue-only',
    residue: {
      database: Array.from({ length: 19 }, (_, index) => ({ scope: `scope-${index}`, count: 0 })),
      objects: [{ key: 'prior.pdf', absent: true }, { key: 'signed.pdf', absent: true }],
    },
  };
}

describe('CFA TEST outer lifecycle contract', () => {
  test('admission-only path is strict and exits before Cognito fixture creation', () => {
    const admission = source.indexOf('if (options.admissionOnly) {', source.indexOf('async function main()'));
    const createApplicant = source.indexOf('applicant.sub = createApplicant(');
    expect(admission).toBeGreaterThan(-1);
    expect(createApplicant).toBeGreaterThan(admission);
    expect(source).toContain("throw new Error('Fresh --attempt-id is required')");
    expect(source).toContain("throw new Error('--evidence-out is required')");
    expect(source).toContain("mode: 'admission-only'");
    expect(source).toContain("releaseAuthority: 'none'");
  });

  test('uses a content-addressed attempt-owned bundle and proves its removal', () => {
    expect(source).toContain("relativePath: 'admin-dashboard/scripts/lib/live-mysql-schema-guard.js'");
    expect(source).toContain("relativePath: 'admin-dashboard/scripts/cfa-signing-schema-preflight.js'");
    expect(source).toContain("relativePath: 'portal/scripts/cfa-signing-smoke.js'");
    expect(source).toContain("relativePath: 'portal/s3Provider.js'");
    expect(source).toContain('/tmp/rq-cfa-signing-admission-');
    expect(source).toContain('sha256sum');
    expect(source).toContain('test ! -e');
    expect(source).not.toContain('s3 cp');
    expect(source).not.toContain('put-object');
    const first = admissionBundle('phase8b-lifecycle-0001');
    const repeat = admissionBundle('phase8b-lifecycle-0001');
    const other = admissionBundle('phase8b-lifecycle-0002');
    expect(first.digest).toBe(repeat.digest);
    expect(first.remoteRoot).toBe(repeat.remoteRoot);
    expect(other.remoteRoot).not.toBe(first.remoteRoot);
  });

  test('reconstructs and validates complete evidence larger than the observed SSM output limit', () => {
    const fixture = transportFixture();
    try {
      expect(fixture.bytes.length).toBeGreaterThan(24_000);
      expect(fixture.chunks.length).toBeGreaterThan(1);
      expect(Buffer.byteLength(`CFA_ADMISSION_CHUNK=${JSON.stringify(fixture.chunks[0])}\n`)).toBeLessThan(24_000);
      const reconstructed = reconstructAdmissionEvidence(fixture.manifest, index => fixture.chunks[index]);
      expect(reconstructed.bytes).toEqual(fixture.bytes);
      expect(reconstructed.digest).toBe(fixture.manifest.evidenceFileSha256);
      expect(reconstructed.admission).toEqual(fixture.admission);
      expect(validateCompleteAdmission(reconstructed.admission, fixture.attemptId)).toEqual(fixture.admission);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
    expect(fs.existsSync(fixture.root)).toBe(false);
  });

  test.each([
    ['missing', (chunks, index) => (index === 1 ? null : chunks[index]), 'cfa_evidence_chunk_missing:1'],
    ['duplicated', (chunks, index) => (index === 1 ? chunks[0] : chunks[index]), 'cfa_evidence_chunk_duplicated:0'],
    ['reordered', (chunks, index) => (index === 0 ? chunks[1] : chunks[index]), 'cfa_evidence_chunk_reordered:0:1'],
    ['truncated', (chunks, index) => (index === 1 ? { ...chunks[index], data: chunks[index].data.slice(0, -4) } : chunks[index]), 'cfa_evidence_chunk_truncated_or_malformed:1'],
    ['corrupted', (chunks, index) => {
      if (index !== 0) return chunks[index];
      const bytes = Buffer.from(chunks[index].data, 'base64');
      bytes[0] ^= 1;
      return { ...chunks[index], data: bytes.toString('base64') };
    }, 'cfa_evidence_reconstruction_digest_mismatch'],
  ])('rejects %s bounded evidence content', (_label, readChunk, message) => {
    const fixture = transportFixture();
    try {
      expect(() => reconstructAdmissionEvidence(fixture.manifest, index => readChunk(fixture.chunks, index)))
        .toThrow(message);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
    expect(fs.existsSync(fixture.root)).toBe(false);
  });

  test('binds the remote evidence file to the attempt-owned bundle and proves file and root absence', () => {
    const bundle = admissionBundle('phase8b-transport-cleanup-0001');
    expect(admissionEvidenceFile(bundle)).toBe(`${bundle.remoteRoot}/evidence/admission-envelope.json`);
    expect(source).toContain('const evidenceFile = admissionEvidenceFile(bundle);');
    expect(source).toContain('`test ! -e ${shellQuote(evidenceFile)}`');
    expect(source).toContain('`test ! -e ${shellQuote(bundle.remoteRoot)}`');
  });

  test('bounds AWS execution, remote polling, cancellation, output, and evidence writes', () => {
    expect(source).toContain('awsCommandMs: 20_000');
    expect(source).toContain('remoteCommandMs: 90_000');
    expect(source).toContain('cancellationMs: 30_000');
    expect(source).toContain("'ssm', 'cancel-command'");
    expect(source).toContain("error.code = 'CFA_REMOTE_TIMEOUT'");
    expect(source).toContain("error.code = 'CFA_REMOTE_CANCELLATION_FAILED'");
    expect(source).toContain('fs.renameSync(temporary, filename)');
  });

  test('records timeout after one cancellation and terminal descendant-process outcome', () => {
    let clock = 0;
    let cancelled = 0;
    const states = [{ Status: 'InProgress' }, { Status: 'InProgress' }, { Status: 'Cancelled', Stdout: '', Stderr: '' }];
    expect(() => waitForCommand('i-test', 'command-1', {}, {
      now: () => clock,
      sleep: milliseconds => { clock += milliseconds; },
      getInvocation: () => states.shift() || { Status: 'Cancelled' },
      cancel: () => { cancelled += 1; },
      remoteCommandMs: 1,
      cancellationMs: 10,
      pollMs: 1,
    })).toThrow('Remote TEST command timed out and terminated as Cancelled');
    expect(cancelled).toBe(1);
  });

  test('fails closed when cancellation cannot prove a terminal process state', () => {
    let clock = 0;
    expect(() => waitForCommand('i-test', 'command-2', {}, {
      now: () => clock,
      sleep: milliseconds => { clock += milliseconds; },
      getInvocation: () => ({ Status: 'InProgress' }),
      cancel: () => {},
      remoteCommandMs: 1,
      cancellationMs: 2,
      pollMs: 1,
    })).toThrow('Remote TEST command cancellation did not reach a terminal state');
  });

  test('rejects malformed or missing process evidence and conflicting arguments', () => {
    expect(() => parseSmokeJson('no structured evidence')).toThrow('TEST smoke emitted no JSON');
    expect(() => parseSmokeJson('{not-json')).toThrow();
    expect(() => parseArgs(['--unknown'])).toThrow('Unknown argument');
  });

  test('binds stateful, recovery, and residue commands to one admitted attempt, workflow, principal, and fixture stamp', () => {
    const attemptId = 'phase8b-command-binding-0001';
    const bundle = admissionBundle(attemptId);
    const marker = require('../scripts/cfa-signing-schema-preflight').fixtureIdentity(attemptId);
    const plan = statefulCommandPlan({
      bundle,
      attemptId,
      applicant: {
        email: marker.applicantEmail,
        password: 'Synthetic-Password-Aa1!',
        sub: '00000000-0000-4000-8000-000000000001',
      },
      portalAwsArn: 'arn:aws:iam::124355655255:user/SES_backend',
      workflow: { id: 17, name: 'Funding Agreement', workflowType: 'consent-cm-prefill' },
      interruptAfterSignedEvidence: true,
    });

    for (const command of [plan.execute, plan.recover, plan.verifyResidue]) {
      expect(command).toContain(`${bundle.remoteRoot}/portal/scripts/cfa-signing-smoke.js`);
      expect(command).toContain("--attempt-id 'phase8b-command-binding-0001'");
      expect(command).toContain("--expected-aws-arn 'arn:aws:iam::124355655255:user/SES_backend'");
    }
    expect(plan.execute).toContain("--workflow-id '17'");
    expect(plan.execute).toContain("--workflow-name 'Funding Agreement'");
    expect(plan.execute).toContain("--workflow-type 'consent-cm-prefill'");
    expect(plan.execute).toContain(`--applicant-email '${marker.applicantEmail}'`);
    expect(plan.execute).toContain(`--fixture-stamp-out '${plan.fixtureStamp}'`);
    expect(plan.execute).toContain('--interrupt-after-signed-evidence');
    expect(plan.execute).toContain(`--evidence-file '${statefulEvidenceFile(bundle, 'execution')}'`);
    expect(plan.recover).toContain('--recovery-only');
    expect(plan.recover).toContain(`--fixture-stamp '${plan.fixtureStamp}'`);
    expect(plan.recover).toContain(`--evidence-file '${statefulEvidenceFile(bundle, 'recovery')}'`);
    expect(plan.verifyResidue).toContain('--verify-residue-only');
    expect(plan.verifyResidue).toContain(`--fixture-stamp '${plan.fixtureStamp}'`);
    expect(plan.verifyResidue).toContain(`--evidence-file '${statefulEvidenceFile(bundle, 'verification')}'`);
    expect(() => statefulCommandPlan({ bundle, attemptId, applicant: {}, portalAwsArn: 'arn', workflow: {} }))
      .toThrow('Complete applicant identity is required');
  });

  test('requires an explicit attempt and evidence path for both admission and future stateful execution', () => {
    expect(source.indexOf("throw new Error('Fresh --attempt-id is required')"))
      .toBeLessThan(source.indexOf('const identity = awsJson('));
    expect(source.indexOf("throw new Error('--evidence-out is required')"))
      .toBeLessThan(source.indexOf('const identity = awsJson('));
    expect(source).toContain('const marker = fixtureIdentity(options.attemptId);');
    expect(source).toContain('const preflightManifest = parseSmokeJson(preflightRun.invocation.Stdout);');
    expect(source).toContain('const preflightRetrieval = retrieveAdmissionEvidence(instanceId, bundle, preflightManifest, options);');
    expect(source).toContain('const preflight = validateCompleteAdmission(preflightRetrieval.admission, options.attemptId);');
    expect(source).toContain('workflow: preflight.prerequisites.workflow');
  });

  test('never prints or retains portal environment values', () => {
    expect(source).not.toContain('console.log(portalEnv');
    expect(source).not.toContain('JSON.stringify(portalEnv');
    expect(source).not.toContain('DB_PASS:');
  });

  test.each(['execution', 'recovery', 'verification'])('reconstructs independently validated bounded %s evidence', phase => {
    const attemptId = `phase8c-result-transport-${phase}-0001`;
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cfa-result-transport-'));
    const filename = path.join(root, `${phase}.json`);
    const result = lifecycleResult(attemptId, phase);
    result.schema = {
      rawDdl: Array.from({ length: 2_000 }, (_, index) => sha256(Buffer.from(`${phase}-${index}`))).join(''),
    };
    const manifest = writeEvidenceFile(filename, encodeResult(result));
    const bytes = fs.readFileSync(filename);
    const chunks = Array.from(
      { length: Math.ceil(bytes.length / EVIDENCE_CHUNK_BYTES) },
      (_, index) => createEvidenceChunk(bytes, manifest, index)
    );
    try {
      expect(bytes.length).toBeGreaterThan(24_000);
      const reconstructed = reconstructEvidence(manifest, index => chunks[index], {
        attemptId,
        evidenceFile: filename,
        statuses: ['PASS'],
      });
      expect(reconstructed.result).toEqual(result);
      expect(reconstructed.digest).toBe(manifest.evidenceFileSha256);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
    expect(fs.existsSync(root)).toBe(false);
  });

  test('executes interruption recovery and a genuinely separate verifier in order before bundle removal', async () => {
    const attemptId = 'phase8c-lifecycle-interruption-0001';
    const actions = [];
    const results = {
      execution: lifecycleResult(attemptId, 'interrupted'),
      recovery: lifecycleResult(attemptId, 'recovery'),
      verification: lifecycleResult(attemptId, 'verification'),
    };
    const outcome = await executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId,
      interruptAfterSignedEvidence: true,
      sprintStartedAt: 1_000,
    }, {
      now: () => 2_000,
      dispatch: async ({ phase, command, timeoutMs }) => {
        actions.push(`dispatch:${phase}:${command}:${timeoutMs}`);
        return {
          commandId: `command-${phase}`,
          invocation: phase === 'execution'
            ? { Status: 'Failed', ResponseCode: 137 }
            : { Status: 'Success', ResponseCode: 0 },
        };
      },
      retrieve: async ({ phase, statuses }) => {
        actions.push(`retrieve:${phase}:${statuses.join(',')}`);
        return { result: results[phase], reconstructedSha256: `sha-${phase}` };
      },
      cleanupApplicant: async () => {
        actions.push('cognito:delete-and-prove');
        return { absent: true };
      },
      finalizeBundle: async () => {
        actions.push('bundle:remove-and-prove');
        return { absent: true };
      },
    });

    expect(actions).toEqual([
      `dispatch:execution:execute:${STATEFUL_LIMITS.executionMs}`,
      'retrieve:execution:INTERRUPTED',
      `dispatch:recovery:recover:${STATEFUL_LIMITS.cleanupMs}`,
      'retrieve:recovery:PASS',
      'cognito:delete-and-prove',
      `dispatch:verification:verify:${STATEFUL_LIMITS.verificationMs}`,
      'retrieve:verification:PASS',
      'bundle:remove-and-prove',
    ]);
    expect(outcome.execution.terminal).toEqual({ status: 'Failed', responseCode: 137, terminal: true });
    expect(outcome.recovery.evidence.result.mode).toBe('recovery-only');
    expect(outcome.verification.evidence.result.mode).toBe('verify-residue-only');
  });

  test('runs a separate verifier after clean execution without dispatching recovery', async () => {
    const attemptId = 'phase8c-lifecycle-clean-0001';
    const actions = [];
    const results = {
      execution: lifecycleResult(attemptId, 'execution'),
      verification: lifecycleResult(attemptId, 'verification'),
    };
    await executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId,
      interruptAfterSignedEvidence: false,
      sprintStartedAt: 1_000,
    }, {
      now: () => 2_000,
      dispatch: async ({ phase }) => {
        actions.push(`dispatch:${phase}`);
        return { commandId: phase, invocation: { Status: 'Success', ResponseCode: 0 } };
      },
      retrieve: async ({ phase }) => {
        actions.push(`retrieve:${phase}`);
        return { result: results[phase], reconstructedSha256: `sha-${phase}` };
      },
      cleanupApplicant: async () => {
        actions.push('cognito');
        return { absent: true };
      },
      finalizeBundle: async () => {
        actions.push('bundle');
        return { absent: true };
      },
    });
    expect(actions).toEqual(['dispatch:execution', 'retrieve:execution', 'cognito', 'dispatch:verification', 'retrieve:verification', 'bundle']);
  });

  test('fails before verifier or bundle removal when recovery evidence is not independently valid', async () => {
    const attemptId = 'phase8c-lifecycle-invalid-recovery-0001';
    const actions = [];
    await expect(executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId,
      interruptAfterSignedEvidence: true,
      sprintStartedAt: 1_000,
    }, {
      now: () => 2_000,
      dispatch: async ({ phase }) => {
        actions.push(`dispatch:${phase}`);
        return {
          commandId: phase,
          invocation: phase === 'execution'
            ? { Status: 'Failed', ResponseCode: 137 }
            : { Status: 'Success', ResponseCode: 0 },
        };
      },
      retrieve: async ({ phase }) => {
        actions.push(`retrieve:${phase}`);
        return {
          result: phase === 'execution'
            ? lifecycleResult(attemptId, 'interrupted')
            : { ...lifecycleResult(attemptId, 'recovery'), cleanup: null },
          reconstructedSha256: `sha-${phase}`,
        };
      },
      cleanupApplicant: async () => { actions.push('cognito'); return { absent: true }; },
      finalizeBundle: async () => { actions.push('bundle'); return { absent: true }; },
    })).rejects.toThrow('cfa_recovery_result_incomplete');
    expect(actions).toEqual(['dispatch:execution', 'retrieve:execution', 'dispatch:recovery', 'retrieve:recovery']);
  });

  test('requires explicit terminal response evidence before retrieval or cleanup', async () => {
    const actions = [];
    await expect(executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId: 'phase8c-terminal-proof-0001',
      interruptAfterSignedEvidence: false,
      sprintStartedAt: 1_000,
    }, {
      now: () => 2_000,
      dispatch: async () => {
        actions.push('dispatch');
        return { commandId: 'execution', invocation: { Status: 'Success', ResponseCode: null } };
      },
      retrieve: async () => { actions.push('retrieve'); },
      cleanupApplicant: async () => { actions.push('cleanup'); return { absent: true }; },
      finalizeBundle: async () => { actions.push('bundle'); return { absent: true }; },
    })).rejects.toThrow('cfa_execution_terminal_process_unproved');
    expect(actions).toEqual(['dispatch']);
  });

  test('validates independent verifier evidence before removing the bundle', async () => {
    const attemptId = 'phase8c-invalid-verifier-0001';
    const actions = [];
    await expect(executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId,
      interruptAfterSignedEvidence: false,
      sprintStartedAt: 1_000,
    }, {
      now: () => 2_000,
      dispatch: async ({ phase }) => {
        actions.push(`dispatch:${phase}`);
        return { commandId: phase, invocation: { Status: 'Success', ResponseCode: 0 } };
      },
      retrieve: async ({ phase }) => {
        actions.push(`retrieve:${phase}`);
        const result = phase === 'execution'
          ? lifecycleResult(attemptId, 'execution')
          : lifecycleResult(attemptId, 'verification');
        if (phase === 'verification') result.residue.database[7].count = 1;
        return { result, reconstructedSha256: `sha-${phase}` };
      },
      cleanupApplicant: async () => { actions.push('cognito'); return { absent: true }; },
      finalizeBundle: async () => { actions.push('bundle'); return { absent: true }; },
    })).rejects.toThrow('cfa_independent_residue_result_incomplete');
    expect(actions).toEqual([
      'dispatch:execution',
      'retrieve:execution',
      'cognito',
      'dispatch:verification',
      'retrieve:verification',
    ]);
  });

  test('proves Cognito absence after deletion and fails closed when the user remains', () => {
    const calls = [];
    const absentAws = args => {
      calls.push(args[1]);
      if (args[1] === 'admin-get-user') {
        const error = new Error('UserNotFoundException');
        error.stderr = 'UserNotFoundException';
        throw error;
      }
      return '';
    };
    expect(deleteApplicant('attempt@example.test', 'pool', {}, { aws: absentAws })).toEqual({
      username: 'attempt@example.test', deleted: true, absent: true,
    });
    expect(calls).toEqual(['admin-delete-user', 'admin-get-user']);
    expect(() => deleteApplicant('attempt@example.test', 'pool', {}, { aws: () => '' }))
      .toThrow('cfa_cognito_residue_detected');
  });

  test('enforces the recorded attempt and sprint duration bounds', async () => {
    let clock = 1_000;
    const dependencies = {
      now: () => clock,
      dispatch: async ({ phase }) => {
        clock += STATEFUL_LIMITS.attemptMs + 1;
        return { commandId: phase, invocation: { Status: 'Success', ResponseCode: 0 } };
      },
      retrieve: async () => ({
        result: lifecycleResult('phase8c-duration-0001', 'execution'),
        reconstructedSha256: 'sha-execution',
      }),
      cleanupApplicant: async () => ({ absent: true }),
      finalizeBundle: async () => ({ absent: true }),
    };
    await expect(executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId: 'phase8c-duration-0001',
      interruptAfterSignedEvidence: false,
      sprintStartedAt: 1_000,
    }, dependencies)).rejects.toThrow('cfa_attempt_duration_exceeded');
    clock = 1_000;
    await expect(executeStatefulLifecycle({
      plan: { execute: 'execute', recover: 'recover', verifyResidue: 'verify' },
      attemptId: 'phase8c-duration-0002',
      interruptAfterSignedEvidence: false,
      sprintStartedAt: clock - STATEFUL_LIMITS.sprintMs - 1,
    }, { ...dependencies, dispatch: async () => { throw new Error('must not dispatch'); } }))
      .rejects.toThrow('cfa_sprint_duration_exceeded');
    expect(STATEFUL_LIMITS.attemptMs).toBe(15 * 60_000);
    expect(STATEFUL_LIMITS.cleanupMs).toBe(3 * 60_000);
    expect(STATEFUL_LIMITS.verificationMs).toBe(3 * 60_000);
    expect(STATEFUL_LIMITS.sprintMs).toBe(75 * 60_000);
  });
});
