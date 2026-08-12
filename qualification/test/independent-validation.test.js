'use strict';

const assert = require('node:assert/strict');
const { existsSync, mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalize,
  computeArtifactDigest,
  digestCanonical,
} = require('../src/canonical-json');
const { validateEvidenceBundle, validateEvidenceBytes } = require('../src/evidence-validator');
const {
  createAttemptId,
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
} = require('../src/identities');
const { assembleFinalEvidence, runQualificationAttempt } = require('../src/kernel');
const { commandDigest, createProcessController } = require('../src/process-control');
const { selectChecks } = require('../src/selector');

const CREATED_AT = '2026-08-10T18:00:00.000Z';
const EMPTY_DIGEST = '0'.repeat(64);
const packageRoot = resolve(__dirname, '..');
const commandRoot = join(__dirname, 'fixtures', 'commands');
const commandPath = (name) => join(commandRoot, `${name}.js`);

function digest(value = EMPTY_DIGEST) {
  return { algorithm: 'sha256', value };
}

function reference(schemaName, artifactId, value = EMPTY_DIGEST, schemaVersion = '1.0.0') {
  return { schemaName, schemaVersion, artifactId, contentDigest: digest(value) };
}

function finalize(artifact) {
  artifact.contentDigest = computeArtifactDigest(artifact);
  return artifact;
}

function withAuthorityDigest(value, referenceKey) {
  const material = { ...value };
  delete material[referenceKey];
  return {
    ...value,
    [referenceKey]: {
      ...value[referenceKey],
      contentDigest: digest(digestCanonical(material)),
    },
  };
}

const roleManifestRef = reference('role-manifest', 'synthetic-role-manifest', '1'.repeat(64));
const changeRef = reference('change-input', 'input.core', '2'.repeat(64));
const productCandidateId = createProductCandidateId({
  manifestRefs: [roleManifestRef],
  material: {
    repositories: [{
      repositoryRole: 'product',
      repositoryId: 'synthetic-product',
      sourceDigest: '3'.repeat(64),
      dependencyDigest: '4'.repeat(64),
      migrationDigest: '5'.repeat(64),
      generatedArtifactDigest: '6'.repeat(64),
    }],
  },
});

function packReference(packId, purpose) {
  return reference(purpose, `${packId}.${purpose}`, digestCanonical({ packId, purpose }));
}

function makePack(packId, stateful = false) {
  const pack = {
    packId,
    packVersion: '1.0.0',
    checkInstanceId: `check.${packId}`,
    checkDefinitionRef: packReference(packId, 'check-definition'),
    nativeContractRef: packReference(packId, 'native-contract'),
    maturity: 'mandatory',
    status: 'active',
    excludable: false,
    supportedTargetClasses: ['local'],
    dependencies: [],
    adapter: {
      adapterId: stateful ? 'synthetic-marker-adapter' : 'synthetic-process-adapter',
      adapterVersion: '1.0.0',
      capabilities: stateful ? ['local-write', 'pure-local-validation'] : ['pure-local-validation'],
    },
    capabilityProofs: [{
      capability: stateful ? 'local-write' : 'pure-local-validation',
      proofPolicyRef: packReference(packId, 'capability-policy'),
    }],
    effect: stateful ? {
      effectClass: 'stateful',
      effectTokens: ['synthetic-marker'],
      resourceScope: ['synthetic-temporary-root'],
      mutationBoundary: 'command-ready',
      exclusive: true,
    } : {
      effectClass: 'read-only',
      effectTokens: [],
      resourceScope: [],
      mutationBoundary: 'none',
      exclusive: false,
    },
    prerequisiteGates: [{
      gateId: `gate.${packId}`,
      proofType: 'synthetic-readiness',
      freshnessPolicyRef: packReference(packId, 'freshness-policy'),
      validatorRef: packReference(packId, 'prerequisite-validator'),
      blockingClosure: [],
      metadataOnlyOnFailure: false,
    }],
    commandDeclarationRefs: [packReference(packId, 'command-declaration')],
  };
  if (stateful) {
    pack.cleanup = {
      obligationId: `cleanup.${packId}`,
      ownerRef: packReference(packId, 'cleanup-owner'),
      terminationRequired: true,
      residueVerifierRef: packReference(packId, 'residue-verifier'),
      residueScope: ['synthetic-marker'],
      budgetMs: 500,
    };
  }
  return pack;
}

function makeRegistry() {
  const packs = [makePack('core-control'), makePack('marker-safety', true)];
  return withAuthorityDigest({
    registryRef: reference('pack-registry', 'phase2e.synthetic-registry'),
    packs,
    impactMappings: [{ inputId: 'input.core', packIds: ['core-control'], fullRegression: false }],
    suites: [{ suiteId: 'full', packIds: ['core-control', 'marker-safety'], fullRegression: true }],
    operations: [{ operationId: 'marker', packIds: ['marker-safety'], fullRegression: false }],
    fullRegressionPackIds: ['core-control', 'marker-safety'],
  }, 'registryRef');
}

function makePolicy() {
  return withAuthorityDigest({
    policyRef: reference('selection-policy', 'phase2e.synthetic-mc2'),
    mandatoryCorePackIds: ['core-control'],
    exclusionAuthorities: ['qualification-governance'],
    budgets: {
      startupMs: 800,
      executionMs: 1200,
      idleMs: 600,
      gracefulTerminationMs: 100,
      forcedTerminationMs: 800,
      cleanupMs: 600,
      finalizationMs: 100,
      totalAttemptMs: 3600,
    },
    cancellationPolicyRef: reference('cancellation-policy', 'phase2e.synthetic-cancellation', '7'.repeat(64)),
  }, 'policyRef');
}

const registry = makeRegistry();
const policy = makePolicy();
const harnessVersion = createHarnessVersion({
  manifestRefs: [roleManifestRef, policy.policyRef, registry.registryRef],
  material: {
    qualificationSourceDigest: '8'.repeat(64),
    dependencyDigest: '9'.repeat(64),
    schemaSetDigest: 'a'.repeat(64),
  },
});
const allPackVersions = createTestPackVersions(registry.packs.map((pack) => ({
  packId: pack.packId,
  packVersion: pack.packVersion,
  manifestRefs: [packReference(pack.packId, 'pack-manifest')],
  material: { assertionDigest: digestCanonical({ packId: pack.packId, assertion: 'phase2e' }) },
})));

function selectionInput({ marker = false } = {}) {
  return {
    productCandidateId,
    harnessVersion,
    availableTestPackVersions: allPackVersions,
    target: { targetClass: 'local', targetName: 'synthetic-local' },
    changedInputs: [{ inputId: 'input.core', changeRef }],
    operations: marker ? ['marker'] : [],
    requestedSuites: [],
    scheduledFull: { enabled: false },
    exclusions: [],
    availableCapabilities: ['local-write', 'pure-local-validation'],
    selectionTime: CREATED_AT,
    policy,
    registry,
  };
}

function buildPlan(input) {
  const selection = selectChecks(input);
  return finalize({
    schemaName: 'path.release-qualification.qualification-plan',
    schemaVersion: '1.0.0-draft.2',
    artifactId: 'plan.phase2e.synthetic',
    createdAt: CREATED_AT,
    producer: {
      authorityId: 'qualification-kernel',
      componentId: 'phase2e-plan-producer',
      componentVersion: '0.1.0',
      producerInstanceId: 'phase2e-test',
    },
    lineageScope: 'pre-attempt',
    productCandidateId: input.productCandidateId,
    harnessVersion: input.harnessVersion,
    testPackVersions: selection.testPackVersions,
    parentArtifactRefs: [reference(
      'path.release-qualification.qualification-plan',
      'plan.phase2e.selection-resolved',
      'b'.repeat(64),
      '1.0.0-draft.2',
    )],
    contentDigest: digest(),
    lifecycleState: 'DEPENDENCIES_ORDERED',
    completeness: { state: 'complete', missingEvidence: [] },
    sensitivity: 'internal',
    redaction: { state: 'none-required' },
    retentionPolicyRef: {
      policyId: 'qualification-evidence',
      policyVersion: '1.0.0',
      retentionClass: 'release-core',
    },
    invocationRef: reference('invocation', 'phase2e.synthetic-invocation', 'c'.repeat(64)),
    requestedTarget: {
      targetClass: input.target.targetClass,
      targetName: input.target.targetName,
      policyRef: input.policy.policyRef,
    },
    requestedScope: {
      changeRefs: input.changedInputs.map((change) => change.changeRef),
      operations: input.operations,
      requestedSuites: [],
      fullRegressionTriggers: [],
    },
    identityBindings: {
      productCandidateId: input.productCandidateId,
      harnessVersion: input.harnessVersion,
      availablePackRegistryRef: input.registry.registryRef,
    },
    selectionPolicyRef: input.policy.policyRef,
    packRegistryRef: input.registry.registryRef,
    selectedChecks: selection.selectedChecks,
    scopeResolution: selection.scopeResolution,
    dependencies: selection.dependencies,
    executionOrder: selection.executionOrder,
    prerequisiteGates: selection.prerequisiteGates,
    environmentRequirements: selection.environmentRequirements,
    declaredEffects: selection.declaredEffects,
    adapterRequirements: selection.adapterRequirements,
    commandDeclarationRefs: selection.commandDeclarationRefs,
    budgets: structuredClone(selection.budgets),
    cancellationPolicyRef: selection.cancellationPolicyRef,
    cleanupObligations: selection.cleanupObligations,
    evidenceContract: {
      schemaVersions: {
        'qualification-plan': '1.0.0-draft.2',
        'execution-event': '1.0.0-draft.1',
        'check-result': '1.0.0-draft.1',
        failure: '1.0.0-draft.1',
        'cleanup-result': '1.0.0-draft.1',
        'final-evidence': '1.0.0-draft.2',
      },
      canonicalizationProfile: 'RQ-C14N-1',
      digestAlgorithm: 'sha256',
      resultLimitBytes: 65536,
      logLimitBytes: 262144,
      retentionPolicyRef: {
        policyId: 'qualification-evidence',
        policyVersion: '1.0.0',
        retentionClass: 'release-core',
      },
    },
  });
}

function budgets() {
  return {
    startupMs: 800,
    executionMs: 1200,
    idleMs: 600,
    gracefulShutdownMs: 100,
    forcedTerminationMs: 800,
    totalMs: 3000,
  };
}

function outputLimits() {
  return { stdoutBytes: 16384, stderrBytes: 4096, resultFrameBytes: 8192 };
}

function declaration(name, argumentsList, attemptId, commandInstanceId) {
  return {
    attemptId,
    commandId: name,
    commandInstanceId,
    executablePath: process.execPath,
    arguments: argumentsList,
    workingDirectory: packageRoot,
    environment: { RQ_SYNTHETIC_TEST: 'admitted' },
    expectedContentDigest: commandDigest(commandPath(name)),
    budgets: budgets(),
    outputLimits: outputLimits(),
  };
}

function processPolicy(invocations) {
  const grouped = new Map();
  for (const invocation of invocations) {
    const command = grouped.get(invocation.name) || {
      commandId: invocation.name,
      scriptPath: commandPath(invocation.name),
      contentDigest: commandDigest(commandPath(invocation.name)),
      allowedArgumentVectors: [],
    };
    command.allowedArgumentVectors.push(invocation.arguments);
    grouped.set(invocation.name, command);
  }
  return {
    executablePath: process.execPath,
    allowedCwdRoot: packageRoot,
    allowedEnvironmentKeys: ['RQ_SYNTHETIC_TEST'],
    commands: [...grouped.values()],
  };
}

function controller(invocations) {
  return createProcessController(processPolicy(invocations));
}

function passedAssertion(packId) {
  return [{
    assertionId: `assertion.${packId}.passed`,
    status: 'passed',
    contractRef: packReference(packId, 'native-contract'),
    expected: { type: 'string', value: 'pass' },
    observed: { type: 'string', value: 'pass' },
  }];
}

function executionDefinition(packId, processDeclaration) {
  return {
    commandDeclarationRef: packReference(packId, 'command-declaration'),
    processDeclaration,
    testLevel: 'component-contract',
    nativeRunnerRef: packReference(packId, 'native-runner'),
    nativeContractRefs: [packReference(packId, 'native-contract')],
    assertions: passedAssertion(packId),
    prerequisiteResults: [{
      gateId: `gate.${packId}`,
      status: 'passed',
      proofRefs: [packReference(packId, 'prerequisite-validator')],
    }],
    effectsObserved: {
      declaredEffectTokens: packId === 'marker-safety' ? ['synthetic-marker'] : [],
      observedEffectTokens: packId === 'marker-safety' ? ['synthetic-marker'] : [],
      undeclaredEffectTokens: [],
    },
  };
}

function invocation({ input, plan, attemptId, processController, definitions }) {
  return {
    plan,
    selectionInput: input,
    attemptId,
    recordedAt: CREATED_AT,
    producer: {
      authorityId: 'qualification-kernel',
      componentId: 'pure-local-kernel',
      componentVersion: '0.1.0',
      producerInstanceId: 'phase2e-test',
    },
    processController,
    checkExecutions: definitions,
    decisionRuleRef: reference('advisory-decision-rule', 'phase2e.synthetic-rule', 'd'.repeat(64)),
    validatorVersion: '0.1.0',
  };
}

async function runReadOnly(attemptId = createAttemptId()) {
  const input = selectionInput();
  const plan = buildPlan(input);
  const args = [attemptId];
  const processController = controller([{ name: 'pass', arguments: args }]);
  const definitions = {
    'check.core-control': executionDefinition(
      'core-control',
      declaration('pass', args, attemptId, 'core-control'),
    ),
  };
  const result = await runQualificationAttempt(invocation({ input, plan, attemptId, processController, definitions }));
  return { input, plan, result, definitions };
}

function errorCodes(report) {
  return new Set(report.errors.map((error) => error.code));
}

test('ten fresh attempts pass with frozen product, harness, and pack identities', async () => {
  const attempts = new Set();
  for (let index = 0; index < 10; index += 1) {
    const { input, result } = await runReadOnly();
    attempts.add(result.bundle.finalEvidence.attemptId);
    assert.equal(result.bundle.finalEvidence.producerAdvisoryStatus, 'GO');
    assert.deepEqual(result.bundle.finalEvidence.harnessVersion, harnessVersion);
    assert.deepEqual(result.bundle.finalEvidence.productCandidateId, productCandidateId);
    const report = validateEvidenceBundle(result.bundle, input);
    assert.equal(report.status, 'accepted', JSON.stringify(report.errors, null, 2));
    assert.equal(report.qualificationValidity, 'valid');
    assert.equal(report.releaseAuthority, 'none');
  }
  assert.equal(attempts.size, 10);
});

test('stateful synthetic marker cleans up only after termination and proves zero residue independently', async (t) => {
  const attemptId = createAttemptId();
  const root = mkdtempSync(join(tmpdir(), 'rq-process-control-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const input = selectionInput({ marker: true });
  const plan = buildPlan(input);
  const passArgs = [attemptId];
  const createArgs = ['create', root, attemptId];
  const removeArgs = ['remove', root, attemptId];
  const processController = controller([
    { name: 'pass', arguments: passArgs },
    { name: 'write-marker', arguments: createArgs },
    { name: 'write-marker', arguments: removeArgs },
  ]);
  const core = executionDefinition('core-control', declaration('pass', passArgs, attemptId, 'core-control'));
  const marker = executionDefinition(
    'marker-safety',
    declaration('write-marker', createArgs, attemptId, 'marker-create'),
  );
  const markerPath = join(root, `${attemptId.slice('attempt:'.length)}.marker`);
  const residueVerifierRef = packReference('marker-safety', 'residue-verifier');
  marker.cleanup = {
    processDeclaration: declaration('write-marker', removeArgs, attemptId, 'marker-remove'),
    cleanupOwner: {
      authorityId: 'marker-cleanup-owner',
      contractRef: packReference('marker-safety', 'cleanup-owner'),
      version: '1.0.0',
      capabilityTokens: ['local-write'],
      effectTokens: ['synthetic-marker'],
    },
    affectedResources: [{
      resourceId: 'synthetic-attempt-marker',
      resourceType: 'temporary',
      effectToken: 'synthetic-marker',
      evidenceRefs: [packReference('marker-safety', 'command-declaration')],
      sensitivity: 'internal',
    }],
    declaredResidueScope: [{
      scopeId: 'synthetic-attempt-marker',
      resourceType: 'temporary',
      expectedState: 'absent',
    }],
    residueVerifier: {
      authorityId: 'independent-marker-verifier',
      contractRef: residueVerifierRef,
      independentFromCleanupOwner: true,
    },
    async verifyResidue() {
      const absent = !existsSync(markerPath);
      return {
        residueDecision: absent ? 'zero-residue' : 'residue-found',
        residueAssertions: [{
          assertionId: 'marker-absent',
          scopeId: 'synthetic-attempt-marker',
          expected: 'absent',
          observed: absent ? 'absent' : 'present',
          evidenceRefs: [residueVerifierRef],
        }],
        ...(absent ? {} : {
          remainingResidue: {
            knownResources: ['synthetic-attempt-marker'],
            unknownScope: false,
            safetyImpact: 'low',
            escalationRef: residueVerifierRef,
          },
          escalation: {
            mandatoryStop: true,
            containmentEvidenceRefs: [residueVerifierRef],
            nextSafeActionRef: residueVerifierRef,
          },
        }),
      };
    },
  };
  const result = await runQualificationAttempt(invocation({
    input,
    plan,
    attemptId,
    processController,
    definitions: { 'check.core-control': core, 'check.marker-safety': marker },
  }));
  assert.equal(existsSync(markerPath), false);
  assert.equal(result.bundle.cleanupResults.length, 1);
  assert.equal(result.bundle.cleanupResults[0].residueDecision, 'zero-residue');
  assert.equal(result.bundle.finalEvidence.producerAdvisoryStatus, 'GO');
  const report = validateEvidenceBundle(result.bundle, input);
  assert.equal(report.status, 'accepted', JSON.stringify(report.errors, null, 2));
});

test('failed prerequisites emit a blocked result and final NO-GO without dispatch', async () => {
  const attemptId = createAttemptId();
  const input = selectionInput();
  const plan = buildPlan(input);
  const args = [attemptId];
  const processController = controller([{ name: 'pass', arguments: args }]);
  const blocked = executionDefinition(
    'core-control',
    declaration('pass', args, attemptId, 'must-not-dispatch'),
  );
  blocked.prerequisiteResults[0].status = 'failed';
  const result = await runQualificationAttempt(invocation({
    input,
    plan,
    attemptId,
    processController,
    definitions: { 'check.core-control': blocked },
  }));
  assert.equal(result.bundle.attachments.length, 0);
  assert.equal(result.bundle.checkResults[0].status, 'blocked');
  assert.equal(result.bundle.checkResults[0].executionFacts.terminalKind, 'not-started');
  assert.equal(result.bundle.finalEvidence.producerAdvisoryStatus, 'NO-GO');
  const report = validateEvidenceBundle(result.bundle, input);
  assert.equal(report.status, 'accepted', JSON.stringify(report.errors, null, 2));
  assert.equal(report.reconstructedAdvisoryStatus, 'NO-GO');
});

test('final evidence assembly is byte-deterministic for the same immutable inputs', async () => {
  const { input, result } = await runReadOnly();
  const final = result.bundle.finalEvidence;
  const finalEventRef = final.parentArtifactRefs.find((reference) => reference.schemaName === 'path.release-qualification.execution-event');
  const reassemblyInput = {
    context: {
      plan: result.bundle.plan,
      attemptId: final.attemptId,
      recordedAt: final.createdAt,
      producer: final.producer,
    },
    admission: result.admission,
    eventGraph: final.eventGraph,
    checkResults: result.bundle.checkResults,
    failures: result.bundle.failures,
    cleanupResults: result.bundle.cleanupResults,
    attachments: result.bundle.attachments,
    prerequisiteResults: final.prerequisiteResults,
    missingItems: final.missingOrPartialEvidence.items,
    finalEventRef,
    decisionRuleRef: final.decisionRuleRef,
    validatorVersion: final.validationHandoff.validatorVersion,
  };
  const first = assembleFinalEvidence(reassemblyInput);
  const second = assembleFinalEvidence(structuredClone(reassemblyInput));
  assert.equal(canonicalize(first), canonicalize(second));
  assert.equal(validateEvidenceBundle({ ...result.bundle, finalEvidence: first }, input).status, 'accepted');
});

test('independent validation rejects schema-invalid, stale, missing, corrupt, and conflicting evidence', async (t) => {
  const { input, result } = await runReadOnly();
  const base = result.bundle;
  const cases = [{
    name: 'artifact digest mutation',
    code: 'CONTENT_DIGEST_MISMATCH',
    mutate(bundle) {
      bundle.checkResults[0].contentDigest.value = '0'.repeat(64);
    },
  }, {
    name: 'stale attempt identity',
    code: 'IDENTITY_LINEAGE_CONFLICT',
    mutate(bundle) {
      bundle.events[2].attemptId = createAttemptId();
      bundle.events[2].contentDigest = computeArtifactDigest(bundle.events[2]);
    },
  }, {
    name: 'missing selected result',
    code: 'CHECK_RESULT_MISSING',
    mutate(bundle) {
      bundle.checkResults = [];
    },
  }, {
    name: 'corrupt attachment bytes',
    code: 'ATTACHMENT_DIGEST_MISMATCH',
    mutate(bundle) {
      bundle.attachments[0].bytesBase64 = Buffer.from('{}').toString('base64');
      bundle.attachments[0].sizeBytes = 2;
    },
  }, {
    name: 'duplicate result',
    code: 'DUPLICATE_CHECK_RESULT',
    mutate(bundle) {
      bundle.checkResults.push(structuredClone(bundle.checkResults[0]));
    },
  }];
  for (const item of cases) {
    await t.test(item.name, () => {
      const bundle = structuredClone(base);
      item.mutate(bundle);
      const report = validateEvidenceBundle(bundle, input);
      assert.equal(report.status, 'rejected');
      assert.ok(errorCodes(report).has(item.code), JSON.stringify(report.errors, null, 2));
      assert.equal(report.releaseAuthority, 'none');
    });
  }
});

test('schema-valid scope and advisory mutations are rejected as qualification-invalid', async (t) => {
  const { input, result } = await runReadOnly();
  await t.test('selection scope', () => {
    const bundle = structuredClone(result.bundle);
    bundle.finalEvidence.selectedScope.checks[0].inclusionOrigins = ['explicit-suite'];
    bundle.finalEvidence.contentDigest = computeArtifactDigest(bundle.finalEvidence);
    const report = validateEvidenceBundle(bundle, input);
    assert.equal(report.schemaValidity, 'valid');
    assert.equal(report.status, 'rejected');
    assert.ok(errorCodes(report).has('SELECTED_SCOPE_CONFLICT'));
  });
  await t.test('producer status', () => {
    const bundle = structuredClone(result.bundle);
    bundle.finalEvidence.producerAdvisoryStatus = 'NO-GO';
    bundle.finalEvidence.contentDigest = computeArtifactDigest(bundle.finalEvidence);
    const report = validateEvidenceBundle(bundle, input);
    assert.equal(report.schemaValidity, 'valid');
    assert.equal(report.status, 'rejected');
    assert.ok(errorCodes(report).has('ADVISORY_STATUS_CONFLICT'));
  });
});

test('strict-byte validation rejects duplicate JSON keys before schema validation', () => {
  const report = validateEvidenceBytes('{"plan":{},"plan":{}}', selectionInput());
  assert.equal(report.status, 'rejected');
  assert.equal(report.schemaValidity, 'invalid');
  assert.ok(errorCodes(report).has('DUPLICATE_KEY'));
});

test('thin CLI validates plans and evidence without granting release authority', async () => {
  const { input, plan, result } = await runReadOnly();
  const cli = join(packageRoot, 'bin', 'rq-kernel.js');
  const planned = spawnSync(process.execPath, [cli, 'plan'], {
    cwd: packageRoot,
    input: canonicalize({ plan, selectionInput: input }),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(planned.status, 0, planned.stderr);
  assert.equal(JSON.parse(planned.stdout).status, 'accepted');

  const validated = spawnSync(process.execPath, [cli, 'validate'], {
    cwd: packageRoot,
    input: canonicalize({ bundle: result.bundle, selectionInput: input }),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(validated.status, 0, validated.stderr);
  const report = JSON.parse(validated.stdout);
  assert.equal(report.status, 'accepted', JSON.stringify(report.errors, null, 2));
  assert.equal(report.releaseAuthority, 'none');

  const runAttemptId = createAttemptId();
  const runArgs = [runAttemptId];
  const runDefinition = executionDefinition(
    'core-control',
    declaration('pass', runArgs, runAttemptId, 'cli-core-control'),
  );
  const runInvocation = invocation({
    input,
    plan,
    attemptId: runAttemptId,
    processController: controller([{ name: 'pass', arguments: runArgs }]),
    definitions: { 'check.core-control': runDefinition },
  });
  delete runInvocation.processController;
  const executed = spawnSync(process.execPath, [cli, 'run'], {
    cwd: packageRoot,
    input: canonicalize({
      invocation: runInvocation,
      processPolicy: processPolicy([{ name: 'pass', arguments: runArgs }]),
    }),
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  });
  assert.equal(executed.status, 0, executed.stderr);
  const execution = JSON.parse(executed.stdout);
  assert.equal(execution.bundle.finalEvidence.producerAdvisoryStatus, 'GO');
  assert.equal(validateEvidenceBundle(execution.bundle, input).status, 'accepted');
});
