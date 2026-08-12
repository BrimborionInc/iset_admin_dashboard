'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeArtifactDigest, digestCanonical } = require('../src/canonical-json');
const {
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
} = require('../src/identities');
const { PlanValidationError, validatePlanForAdmission } = require('../src/plan-validator');
const { SelectionError, selectChecks } = require('../src/selector');

const CREATED_AT = '2026-08-10T12:00:00.000Z';
const SELECTION_TIME = '2026-08-10T12:00:00.000Z';
const EMPTY_DIGEST = '0'.repeat(64);

function digest(value = EMPTY_DIGEST) {
  return { algorithm: 'sha256', value };
}

function reference(schemaName, artifactId, value = EMPTY_DIGEST, schemaVersion = '1.0.0') {
  return { schemaName, schemaVersion, artifactId, contentDigest: digest(value) };
}

const ROLE_MANIFEST_REF = reference('role-manifest', 'synthetic-role-manifest', '1'.repeat(64));
const CHANGE_ALPHA_REF = reference('change-input', 'input.alpha', '2'.repeat(64));
const CHANGE_BETA_REF = reference('change-input', 'input.beta', '3'.repeat(64));
const SCHEDULE_REF = reference('schedule-trigger', 'scheduled.full', '4'.repeat(64));
const PRODUCT_IDENTITY = createProductCandidateId({
  manifestRefs: [ROLE_MANIFEST_REF],
  material: {
    repositories: [{
      repositoryRole: 'product',
      repositoryId: 'synthetic-product',
      sourceDigest: '5'.repeat(64),
      dependencyDigest: '6'.repeat(64),
      migrationDigest: '7'.repeat(64),
      generatedArtifactDigest: '8'.repeat(64),
    }],
  },
});

function authorityReference(schemaName, artifactId, value) {
  return reference(schemaName, artifactId, value, '1.0.0');
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

function createHarnessIdentity(policyRef, registryRef) {
  return createHarnessVersion({
    manifestRefs: [ROLE_MANIFEST_REF, policyRef, registryRef],
    material: {
      qualificationSourceDigest: '9'.repeat(64),
      dependencyDigest: 'a'.repeat(64),
      schemaSetDigest: 'b'.repeat(64),
    },
  });
}

function packReference(packId, purpose) {
  return reference(purpose, `${packId}.${purpose}`, digestCanonical({ packId, purpose }));
}

function makePack(packId, overrides = {}) {
  const base = {
    packId,
    packVersion: '1.0.0',
    checkInstanceId: `check.${packId}`,
    checkDefinitionRef: packReference(packId, 'check-definition'),
    nativeContractRef: packReference(packId, 'native-contract'),
    maturity: 'mandatory',
    status: 'active',
    excludable: true,
    supportedTargetClasses: ['local'],
    dependencies: [],
    adapter: {
      adapterId: 'synthetic-local-adapter',
      adapterVersion: '1.0.0',
      capabilities: ['pure-local-validation'],
    },
    capabilityProofs: [{
      capability: 'pure-local-validation',
      proofPolicyRef: packReference(packId, 'capability-policy'),
    }],
    effect: {
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
  return { ...base, ...overrides };
}

function makeBuildPack() {
  return makePack('build-safety', {
    excludable: false,
    adapter: {
      adapterId: 'synthetic-build-adapter',
      adapterVersion: '1.0.0',
      capabilities: ['local-write', 'pure-local-validation'],
    },
    capabilityProofs: [{
      capability: 'local-write',
      proofPolicyRef: packReference('build-safety', 'local-write-policy'),
    }, {
      capability: 'pure-local-validation',
      proofPolicyRef: packReference('build-safety', 'capability-policy'),
    }],
    effect: {
      effectClass: 'stateful',
      effectTokens: ['synthetic-build-output'],
      resourceScope: ['synthetic-worktree'],
      mutationBoundary: 'build-started',
      exclusive: true,
    },
    cleanup: {
      obligationId: 'cleanup.build-safety',
      ownerRef: packReference('build-safety', 'cleanup-owner'),
      terminationRequired: true,
      residueVerifierRef: packReference('build-safety', 'residue-verifier'),
      residueScope: ['synthetic-build-output'],
      budgetMs: 100,
    },
  });
}

function makeRegistry() {
  const packs = [
    makePack('alpha-contract', { dependencies: ['shared-contract'] }),
    makePack('beta-contract'),
    makeBuildPack(),
    makePack('core-control', { excludable: false }),
    makePack('diagnostics'),
    makePack('shared-contract'),
  ];
  const fullRegressionPackIds = packs.map((pack) => pack.packId).sort();
  return withAuthorityDigest({
    registryRef: authorityReference('pack-registry', 'synthetic-pack-registry', EMPTY_DIGEST),
    packs,
    impactMappings: [{ inputId: 'input.alpha', packIds: ['alpha-contract'], fullRegression: false },
      { inputId: 'input.beta', packIds: ['beta-contract'], fullRegression: false },
      { inputId: 'input.broad', packIds: fullRegressionPackIds, fullRegression: true },
      { inputId: 'input.core', packIds: ['core-control'], fullRegression: false }],
    suites: [{ suiteId: 'diagnostics', packIds: ['diagnostics'], fullRegression: false },
      { suiteId: 'full', packIds: fullRegressionPackIds, fullRegression: true }],
    operations: [{ operationId: 'build', packIds: ['build-safety'], fullRegression: false },
      { operationId: 'major-release', packIds: fullRegressionPackIds, fullRegression: true }],
    fullRegressionPackIds,
  }, 'registryRef');
}

function makePolicy() {
  return withAuthorityDigest({
    policyRef: authorityReference('selection-policy', 'synthetic-mc2-policy', EMPTY_DIGEST),
    mandatoryCorePackIds: ['core-control'],
    exclusionAuthorities: ['qualification-governance'],
    budgets: {
      startupMs: 100,
      executionMs: 1000,
      idleMs: 500,
      gracefulTerminationMs: 100,
      forcedTerminationMs: 100,
      cleanupMs: 200,
      finalizationMs: 100,
      totalAttemptMs: 1600,
    },
    cancellationPolicyRef: reference('cancellation-policy', 'synthetic-cancellation-policy', 'c'.repeat(64)),
  }, 'policyRef');
}

function makeAvailablePackVersions(packs) {
  return createTestPackVersions(packs.map((pack) => ({
    packId: pack.packId,
    packVersion: pack.packVersion,
    manifestRefs: [packReference(pack.packId, 'pack-manifest')],
    material: { assertionDigest: digestCanonical({ packId: pack.packId, kind: 'assertion' }) },
  })));
}

function buildSelectionInput(overrides = {}) {
  const registry = makeRegistry();
  const policy = makePolicy();
  const input = {
    productCandidateId: PRODUCT_IDENTITY,
    harnessVersion: createHarnessIdentity(policy.policyRef, registry.registryRef),
    availableTestPackVersions: makeAvailablePackVersions(registry.packs),
    target: { targetClass: 'local', targetName: 'synthetic-local' },
    changedInputs: [{ inputId: 'input.alpha', changeRef: CHANGE_ALPHA_REF }],
    operations: [],
    requestedSuites: [],
    scheduledFull: { enabled: false },
    exclusions: [],
    availableCapabilities: ['local-write', 'pure-local-validation'],
    selectionTime: SELECTION_TIME,
    policy,
    registry,
    ...overrides,
  };
  return input;
}

function refreshRegistryIdentity(input) {
  input.registry = withAuthorityDigest(input.registry, 'registryRef');
  input.harnessVersion = createHarnessIdentity(input.policy.policyRef, input.registry.registryRef);
  return input;
}

function refreshPolicyIdentity(input) {
  input.policy = withAuthorityDigest(input.policy, 'policyRef');
  input.harnessVersion = createHarnessIdentity(input.policy.policyRef, input.registry.registryRef);
  return input;
}

function validExclusion(packId = 'alpha-contract') {
  return {
    exclusionId: `exclude.${packId}`,
    packId,
    targetClass: 'local',
    reason: 'approved-synthetic-omission',
    approvingAuthority: 'qualification-governance',
    expiresAt: '2026-08-11T12:00:00.000Z',
    evidenceImpact: 'coverage-omitted',
  };
}

function finalize(artifact) {
  artifact.contentDigest = computeArtifactDigest(artifact);
  return artifact;
}

function buildPlan(input = buildSelectionInput(), selection = selectChecks(input)) {
  return finalize({
    schemaName: 'path.release-qualification.qualification-plan',
    schemaVersion: '1.0.0-draft.2',
    artifactId: 'plan.synthetic.dependencies-ordered',
    createdAt: CREATED_AT,
    producer: {
      authorityId: 'qualification-kernel',
      componentId: 'synthetic-plan-producer',
      componentVersion: '0.0.0',
      producerInstanceId: 'synthetic-producer',
    },
    lineageScope: 'pre-attempt',
    productCandidateId: input.productCandidateId,
    harnessVersion: input.harnessVersion,
    testPackVersions: selection.testPackVersions,
    parentArtifactRefs: [reference(
      'path.release-qualification.qualification-plan',
      'plan.synthetic.selection-resolved',
      'd'.repeat(64),
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
    invocationRef: reference('invocation', 'synthetic-invocation', 'e'.repeat(64)),
    requestedTarget: {
      targetClass: input.target.targetClass,
      targetName: input.target.targetName,
      policyRef: input.policy.policyRef,
    },
    requestedScope: {
      changeRefs: input.changedInputs.map((change) => change.changeRef),
      operations: input.operations,
      requestedSuites: input.requestedSuites,
      fullRegressionTriggers: input.scheduledFull.enabled ? [input.scheduledFull.triggerRef] : [],
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

function clone(value) {
  return structuredClone(value);
}

function expectCode(action, ErrorType, code, causeCode) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof ErrorType, `expected ${ErrorType.name}, received ${error?.constructor?.name}`);
    assert.equal(error.code, code);
    if (causeCode !== undefined) assert.equal(error.details.causeCode, causeCode);
    return true;
  });
}

function selectedByPack(selection, packId) {
  return selection.selectedChecks.find((check) => check.packId === packId);
}

test('MC2 selects core, impacted packs, dependencies, and excludes unrelated domains', () => {
  const selection = selectChecks(buildSelectionInput());
  assert.deepEqual(selection.selectedChecks.map((check) => check.packId), [
    'core-control',
    'shared-contract',
    'alpha-contract',
  ]);
  assert.deepEqual(selectedByPack(selection, 'core-control').inclusionOrigins, ['mandatory-core']);
  assert.deepEqual(selectedByPack(selection, 'shared-contract').inclusionOrigins, ['dependency']);
  assert.deepEqual(selectedByPack(selection, 'alpha-contract').inclusionOrigins, ['impacted-domain']);
  assert.equal(selectedByPack(selection, 'beta-contract'), undefined);
  assert.deepEqual(selection.executionOrder, [
    'check.core-control',
    'check.shared-contract',
    'check.alpha-contract',
  ]);
});

test('explicit suites, scheduled full, and release operations retain every attributable origin', () => {
  const input = buildSelectionInput({
    operations: ['build'],
    requestedSuites: ['diagnostics'],
    scheduledFull: { enabled: true, triggerRef: SCHEDULE_REF },
  });
  const selection = selectChecks(input);
  assert.deepEqual(selectedByPack(selection, 'diagnostics').inclusionOrigins, ['explicit-suite', 'scheduled-full']);
  assert.deepEqual(selectedByPack(selection, 'build-safety').inclusionOrigins, ['scheduled-full', 'release-operation']);
  assert.deepEqual(selectedByPack(selection, 'core-control').inclusionOrigins, ['mandatory-core', 'scheduled-full']);
  assert.deepEqual(selection.fullRegression, { selected: true, origins: ['scheduled-full'] });
});

test('explicit, broad-impact, and operation full regression are deterministic policy inputs', async (t) => {
  const cases = [{
    name: 'explicit-suite',
    overrides: { requestedSuites: ['full'] },
    origin: 'explicit-suite',
  }, {
    name: 'broad-impact',
    overrides: { changedInputs: [{ inputId: 'input.broad', changeRef: CHANGE_ALPHA_REF }] },
    origin: 'impacted-domain',
  }, {
    name: 'release-operation',
    overrides: { operations: ['major-release'] },
    origin: 'release-operation',
  }];
  for (const item of cases) {
    await t.test(item.name, () => {
      const selection = selectChecks(buildSelectionInput(item.overrides));
      assert.equal(selection.selectedChecks.length, 6);
      assert.deepEqual(selection.fullRegression, { selected: true, origins: [item.origin] });
    });
  }
});

test('selection and its digests repeat exactly and ignore object-key insertion order', () => {
  const input = buildSelectionInput();
  const first = selectChecks(input);
  const second = selectChecks(clone(input));
  const reordered = Object.fromEntries(Object.entries(clone(input)).reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first, selectChecks(reordered));
});

test('approved exclusions can remove only eligible non-mandatory roots', () => {
  const input = buildSelectionInput({ exclusions: [validExclusion()] });
  const selection = selectChecks(input);
  assert.deepEqual(selection.selectedChecks.map((check) => check.packId), ['core-control']);
  assert.deepEqual(selection.exclusions, [validExclusion()]);
});

test('unknown or unmapped changes, operations, and suites fail closed', async (t) => {
  const cases = [{
    name: 'change',
    input: buildSelectionInput({ changedInputs: [{ inputId: 'input.unknown', changeRef: CHANGE_ALPHA_REF }] }),
    code: 'UNMAPPED_INPUT',
  }, {
    name: 'operation',
    input: buildSelectionInput({ operations: ['unknown-operation'] }),
    code: 'UNMAPPED_OPERATION',
  }, {
    name: 'suite',
    input: buildSelectionInput({ requestedSuites: ['unknown-suite'] }),
    code: 'UNKNOWN_SUITE',
  }];
  for (const item of cases) {
    await t.test(item.name, () => expectCode(() => selectChecks(item.input), SelectionError, item.code));
  }
});

test('missing dependencies and dependency cycles fail deterministically', async (t) => {
  await t.test('missing', () => {
    const input = buildSelectionInput();
    input.registry.packs.find((pack) => pack.packId === 'alpha-contract').dependencies = ['missing-pack'];
    refreshRegistryIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'UNKNOWN_PACK');
  });
  await t.test('cycle', () => {
    const input = buildSelectionInput();
    input.registry.packs.find((pack) => pack.packId === 'shared-contract').dependencies = ['alpha-contract'];
    refreshRegistryIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'DEPENDENCY_CYCLE');
  });
});

test('duplicate pack definitions and stale pack versions fail closed', async (t) => {
  await t.test('duplicate', () => {
    const input = buildSelectionInput();
    input.registry.packs.push(clone(input.registry.packs[0]));
    refreshRegistryIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'PACK_VERSION_CONFLICT');
  });
  await t.test('stale-version', () => {
    const input = buildSelectionInput();
    input.availableTestPackVersions['alpha-contract'].packVersion = '2.0.0';
    expectCode(() => selectChecks(input), SelectionError, 'IDENTITY_CONFLICT');
  });
});

test('stale registry bytes and stale harness bindings cannot change selection', async (t) => {
  await t.test('registry-digest', () => {
    const input = buildSelectionInput();
    input.registry.impactMappings.find((mapping) => mapping.inputId === 'input.alpha').packIds.push('beta-contract');
    expectCode(() => selectChecks(input), SelectionError, 'STALE_REGISTRY');
  });
  await t.test('harness-binding', () => {
    const input = buildSelectionInput();
    input.registry.impactMappings.find((mapping) => mapping.inputId === 'input.alpha').packIds.push('beta-contract');
    input.registry = withAuthorityDigest(input.registry, 'registryRef');
    expectCode(() => selectChecks(input), SelectionError, 'IDENTITY_CONFLICT');
  });
  await t.test('authorized-mutation', () => {
    const input = buildSelectionInput();
    input.registry.impactMappings.find((mapping) => mapping.inputId === 'input.alpha').packIds.push('beta-contract');
    refreshRegistryIdentity(input);
    const selection = selectChecks(input);
    assert.ok(selectedByPack(selection, 'beta-contract'));
  });
});

test('target, maturity, availability, and capability requirements fail closed', async (t) => {
  const cases = [{
    name: 'target',
    build() {
      return buildSelectionInput({ target: { targetClass: 'test', targetName: 'synthetic-test' } });
    },
    code: 'TARGET_UNSUPPORTED',
  }, {
    name: 'maturity',
    build() {
      const input = buildSelectionInput();
      input.registry.packs.find((pack) => pack.packId === 'alpha-contract').maturity = 'candidate';
      return refreshRegistryIdentity(input);
    },
    code: 'PACK_NOT_MANDATORY',
  }, {
    name: 'status',
    build() {
      const input = buildSelectionInput();
      input.registry.packs.find((pack) => pack.packId === 'alpha-contract').status = 'suspended';
      return refreshRegistryIdentity(input);
    },
    code: 'PACK_UNAVAILABLE',
  }, {
    name: 'capability',
    build() {
      return buildSelectionInput({ operations: ['build'], availableCapabilities: ['pure-local-validation'] });
    },
    code: 'CAPABILITY_UNAVAILABLE',
  }];
  for (const item of cases) {
    await t.test(item.name, () => expectCode(() => selectChecks(item.build()), SelectionError, item.code));
  }
});

test('conflicting, expired, mandatory, and dependency exclusions fail closed', async (t) => {
  const cases = [{
    name: 'mandatory-core',
    exclusion: validExclusion('core-control'),
  }, {
    name: 'required-dependency',
    exclusion: validExclusion('shared-contract'),
  }, {
    name: 'expired',
    exclusion: { ...validExclusion(), expiresAt: SELECTION_TIME },
  }, {
    name: 'wrong-authority',
    exclusion: { ...validExclusion(), approvingAuthority: 'unapproved-authority' },
  }];
  for (const item of cases) {
    await t.test(item.name, () => {
      const input = buildSelectionInput({ exclusions: [item.exclusion] });
      expectCode(() => selectChecks(input), SelectionError, 'CONFLICTING_EXCLUSION');
    });
  }
});

test('stateful packs require declared cleanup and protected cleanup budget', async (t) => {
  await t.test('missing-cleanup', () => {
    const input = buildSelectionInput({ operations: ['build'] });
    delete input.registry.packs.find((pack) => pack.packId === 'build-safety').cleanup;
    refreshRegistryIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'CLEANUP_CONTRACT_MISSING');
  });
  await t.test('insufficient-budget', () => {
    const input = buildSelectionInput({ operations: ['build'] });
    input.policy.budgets.cleanupMs = 50;
    input.policy.budgets.totalAttemptMs = 1450;
    refreshPolicyIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'CLEANUP_CONTRACT_MISSING');
  });
});

test('unknown selector fields and conflicting full mappings are rejected', async (t) => {
  await t.test('unknown-field', () => {
    const input = buildSelectionInput();
    input.ambientDefault = true;
    expectCode(() => selectChecks(input), SelectionError, 'INVALID_SELECTION_INPUT');
  });
  await t.test('partial-full-mapping', () => {
    const input = buildSelectionInput();
    input.registry.suites.find((suite) => suite.suiteId === 'full').packIds = ['core-control'];
    refreshRegistryIdentity(input);
    expectCode(() => selectChecks(input), SelectionError, 'INVALID_REGISTRY');
  });
});

test('a complete dependency-ordered plan is admitted against independent selection', () => {
  const input = buildSelectionInput();
  const selection = selectChecks(input);
  const plan = buildPlan(input, selection);
  const admission = validatePlanForAdmission(plan, input);
  assert.equal(admission.status, 'accepted');
  assert.deepEqual(admission.selection, selection);
  assert.equal(admission.admissionDigest.algorithm, 'sha256');
});

test('malformed or incomplete plans are rejected before semantic admission', async (t) => {
  await t.test('structural', () => {
    const input = buildSelectionInput();
    const plan = buildPlan(input);
    plan.unknownField = true;
    finalize(plan);
    expectCode(() => validatePlanForAdmission(plan, input), PlanValidationError, 'PLAN_STRUCTURE_INVALID');
  });
  await t.test('lifecycle', () => {
    const input = buildSelectionInput();
    const plan = buildPlan(input);
    plan.lifecycleState = 'SELECTION_RESOLVED';
    finalize(plan);
    expectCode(() => validatePlanForAdmission(plan, input), PlanValidationError, 'PLAN_LIFECYCLE_INVALID');
  });
  await t.test('lineage', () => {
    const input = buildSelectionInput();
    const plan = buildPlan(input);
    plan.parentArtifactRefs = [];
    finalize(plan);
    expectCode(() => validatePlanForAdmission(plan, input), PlanValidationError, 'PLAN_LINEAGE_INVALID');
  });
});

test('plan identity, authority, target, and scope conflicts fail closed', async (t) => {
  const cases = [{
    name: 'identity',
    code: 'PLAN_IDENTITY_CONFLICT',
    mutate(plan) {
      const replacement = createProductCandidateId({
        manifestRefs: [ROLE_MANIFEST_REF],
        material: { repositories: [{ repositoryRole: 'product', repositoryId: 'other', sourceDigest: 'f'.repeat(64) }] },
      });
      plan.productCandidateId = replacement;
      plan.identityBindings.productCandidateId = replacement;
    },
  }, {
    name: 'authority',
    code: 'PLAN_AUTHORITY_CONFLICT',
    mutate(plan) {
      plan.packRegistryRef = reference('pack-registry', 'other-registry', 'f'.repeat(64));
    },
  }, {
    name: 'target',
    code: 'PLAN_TARGET_MISMATCH',
    mutate(plan) {
      plan.requestedTarget.targetName = 'other-local';
    },
  }, {
    name: 'scope',
    code: 'PLAN_SCOPE_MISMATCH',
    mutate(plan) {
      plan.requestedScope.requestedSuites = ['diagnostics'];
    },
  }];
  for (const item of cases) {
    await t.test(item.name, () => {
      const input = buildSelectionInput();
      const plan = buildPlan(input);
      item.mutate(plan);
      finalize(plan);
      expectCode(() => validatePlanForAdmission(plan, input), PlanValidationError, item.code);
    });
  }
});

test('plan check, dependency, capability, effect, cleanup, and budget mutations fail closed', async (t) => {
  const cases = [{
    name: 'selected-check-omission',
    code: 'PLAN_SELECTION_MISMATCH',
    mutate(plan) { plan.selectedChecks.pop(); },
  }, {
    name: 'dependency-omission',
    code: 'PLAN_DEPENDENCY_MISMATCH',
    mutate(plan) { plan.dependencies = []; },
  }, {
    name: 'ordering',
    code: 'PLAN_DEPENDENCY_MISMATCH',
    mutate(plan) { plan.executionOrder.reverse(); },
  }, {
    name: 'capability',
    code: 'PLAN_CAPABILITY_MISMATCH',
    mutate(plan) { plan.environmentRequirements.pop(); },
  }, {
    name: 'effect',
    code: 'PLAN_EFFECT_MISMATCH',
    mutate(plan) { plan.declaredEffects[0].effectTokens = ['undeclared-effect']; },
  }, {
    name: 'cleanup',
    code: 'PLAN_CLEANUP_MISMATCH',
    input: buildSelectionInput({ operations: ['build'] }),
    mutate(plan) { plan.cleanupObligations = []; },
  }, {
    name: 'budget',
    code: 'PLAN_BUDGET_INVALID',
    mutate(plan) { plan.budgets.totalAttemptMs = 1; },
  }];
  for (const item of cases) {
    await t.test(item.name, () => {
      const input = item.input || buildSelectionInput();
      const plan = buildPlan(input);
      item.mutate(plan);
      finalize(plan);
      expectCode(() => validatePlanForAdmission(plan, input), PlanValidationError, item.code);
    });
  }
});

test('selection failures remain attributable when plan admission recomputes scope', () => {
  const input = buildSelectionInput({ changedInputs: [{ inputId: 'input.unknown', changeRef: CHANGE_ALPHA_REF }] });
  const planInput = buildSelectionInput();
  const plan = buildPlan(planInput);
  expectCode(
    () => validatePlanForAdmission(plan, input),
    PlanValidationError,
    'PLAN_SELECTION_REJECTED',
    'UNMAPPED_INPUT',
  );
});
