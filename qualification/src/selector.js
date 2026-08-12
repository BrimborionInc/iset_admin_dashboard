'use strict';

const { canonicalize, digestCanonical } = require('./canonical-json');

const ORIGIN_ORDER = Object.freeze([
  'mandatory-core',
  'impacted-domain',
  'dependency',
  'explicit-suite',
  'scheduled-full',
  'release-operation',
]);
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const VERSION_PATTERN = /^[0-9]+\.[0-9]+\.[0-9]+(?:-draft\.[0-9]+)?$/u;
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const TIMESTAMP_PATTERN = /^[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12][0-9]|3[01])T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}Z$/u;

class SelectionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SelectionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new SelectionError(code, message, details);
}

function compareStrings(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertRecord(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(code, `${label} must be an object`);
  }
}

function assertExactKeys(value, required, optional, label, code = 'INVALID_SELECTION_INPUT') {
  assertRecord(value, label, code);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    fail(code, `${label} has missing or unknown fields`, { label, missing, unknown });
  }
}

function assertOpaqueId(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (typeof value !== 'string' || !OPAQUE_ID_PATTERN.test(value)) {
    fail(code, `${label} must be an opaque identifier`, { label, value });
  }
}

function assertVersion(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (typeof value !== 'string' || !VERSION_PATTERN.test(value)) {
    fail(code, `${label} must be a semantic version`, { label, value });
  }
}

function assertBoolean(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (typeof value !== 'boolean') fail(code, `${label} must be boolean`, { label, value });
}

function assertUniqueStrings(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (!Array.isArray(value)) fail(code, `${label} must be an array`);
  const seen = new Set();
  value.forEach((item, index) => {
    assertOpaqueId(item, `${label}[${index}]`, code);
    if (seen.has(item)) fail(code, `${label} contains duplicate ${item}`, { label, item });
    seen.add(item);
  });
  return value;
}

function assertArtifactRef(reference, label, code = 'INVALID_SELECTION_INPUT') {
  assertExactKeys(reference, ['schemaName', 'schemaVersion', 'artifactId', 'contentDigest'], [], label, code);
  assertOpaqueId(reference.schemaName, `${label}.schemaName`, code);
  assertVersion(reference.schemaVersion, `${label}.schemaVersion`, code);
  assertOpaqueId(reference.artifactId, `${label}.artifactId`, code);
  assertExactKeys(reference.contentDigest, ['algorithm', 'value'], [], `${label}.contentDigest`, code);
  if (reference.contentDigest.algorithm !== 'sha256' || !DIGEST_PATTERN.test(reference.contentDigest.value)) {
    fail(code, `${label}.contentDigest must be a SHA-256 digest`);
  }
}

function assertReferenceArray(value, label, code = 'INVALID_SELECTION_INPUT') {
  if (!Array.isArray(value)) fail(code, `${label} must be an array`);
  const seen = new Set();
  value.forEach((reference, index) => {
    assertArtifactRef(reference, `${label}[${index}]`, code);
    const key = canonicalize(reference);
    if (seen.has(key)) fail(code, `${label} contains a duplicate reference`);
    seen.add(key);
  });
}

function assertContentIdentity(identity, identityKind, label) {
  assertExactKeys(
    identity,
    ['identityKind', 'definitionVersion', 'canonicalizationProfile', 'digestAlgorithm', 'digest', 'manifestRefs'],
    [],
    label,
    'IDENTITY_CONFLICT',
  );
  if (
    identity.identityKind !== identityKind
    || identity.definitionVersion !== '1.0.0'
    || identity.canonicalizationProfile !== 'RQ-C14N-1'
    || identity.digestAlgorithm !== 'sha256'
    || !DIGEST_PATTERN.test(identity.digest)
  ) {
    fail('IDENTITY_CONFLICT', `${label} has a stale or conflicting identity binding`);
  }
  assertReferenceArray(identity.manifestRefs, `${label}.manifestRefs`, 'IDENTITY_CONFLICT');
}

function assertBudgets(budgets) {
  const keys = [
    'startupMs',
    'executionMs',
    'idleMs',
    'gracefulTerminationMs',
    'forcedTerminationMs',
    'cleanupMs',
    'finalizationMs',
    'totalAttemptMs',
  ];
  assertExactKeys(budgets, keys, [], 'policy.budgets', 'INVALID_POLICY');
  for (const key of keys) {
    if (!Number.isSafeInteger(budgets[key]) || budgets[key] < 1) {
      fail('INVALID_POLICY', `policy.budgets.${key} must be a positive safe integer`);
    }
  }
  if (budgets.idleMs > budgets.executionMs) {
    fail('INVALID_POLICY', 'idle timeout cannot exceed execution timeout');
  }
  const protectedMinimum = budgets.startupMs
    + budgets.executionMs
    + budgets.gracefulTerminationMs
    + budgets.forcedTerminationMs
    + budgets.cleanupMs
    + budgets.finalizationMs;
  if (budgets.totalAttemptMs < protectedMinimum) {
    fail('INVALID_POLICY', 'total attempt timeout does not preserve execution, termination, cleanup, and finalization');
  }
}

function assertAuthorityDigest(value, referenceKey, label, code) {
  const material = { ...value };
  delete material[referenceKey];
  const expected = digestCanonical(material);
  const actual = value[referenceKey].contentDigest.value;
  if (actual !== expected) {
    fail(code, `${label} reference digest is stale or conflicts with its content`, { expected, actual });
  }
}

function validatePrerequisite(prerequisite, pack, index) {
  const label = `pack ${pack.packId}.prerequisiteGates[${index}]`;
  assertExactKeys(
    prerequisite,
    ['gateId', 'proofType', 'freshnessPolicyRef', 'validatorRef', 'blockingClosure', 'metadataOnlyOnFailure'],
    [],
    label,
    'INVALID_PACK_DEFINITION',
  );
  assertOpaqueId(prerequisite.gateId, `${label}.gateId`, 'INVALID_PACK_DEFINITION');
  assertOpaqueId(prerequisite.proofType, `${label}.proofType`, 'INVALID_PACK_DEFINITION');
  assertArtifactRef(prerequisite.freshnessPolicyRef, `${label}.freshnessPolicyRef`, 'INVALID_PACK_DEFINITION');
  assertArtifactRef(prerequisite.validatorRef, `${label}.validatorRef`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(prerequisite.blockingClosure, `${label}.blockingClosure`, 'INVALID_PACK_DEFINITION');
  assertBoolean(prerequisite.metadataOnlyOnFailure, `${label}.metadataOnlyOnFailure`, 'INVALID_PACK_DEFINITION');
}

function validateEffect(effect, packId) {
  const label = `pack ${packId}.effect`;
  assertExactKeys(
    effect,
    ['effectClass', 'effectTokens', 'resourceScope', 'mutationBoundary', 'exclusive'],
    [],
    label,
    'INVALID_PACK_DEFINITION',
  );
  if (!['read-only', 'stateful'].includes(effect.effectClass)) {
    fail('INVALID_PACK_DEFINITION', `${label}.effectClass is unsupported`);
  }
  assertUniqueStrings(effect.effectTokens, `${label}.effectTokens`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(effect.resourceScope, `${label}.resourceScope`, 'INVALID_PACK_DEFINITION');
  assertOpaqueId(effect.mutationBoundary, `${label}.mutationBoundary`, 'INVALID_PACK_DEFINITION');
  assertBoolean(effect.exclusive, `${label}.exclusive`, 'INVALID_PACK_DEFINITION');
  if (effect.effectClass === 'stateful' && (!effect.effectTokens.length || !effect.resourceScope.length)) {
    fail('CLEANUP_CONTRACT_MISSING', `stateful pack ${packId} must declare effect tokens and resource scope`);
  }
}

function validateCleanup(cleanup, pack) {
  if (cleanup === undefined) {
    if (pack.effect.effectClass === 'stateful') {
      fail('CLEANUP_CONTRACT_MISSING', `stateful pack ${pack.packId} has no cleanup contract`);
    }
    return;
  }
  if (pack.effect.effectClass !== 'stateful') {
    fail('INVALID_PACK_DEFINITION', `read-only pack ${pack.packId} cannot declare mutation cleanup`);
  }
  const label = `pack ${pack.packId}.cleanup`;
  assertExactKeys(
    cleanup,
    ['obligationId', 'ownerRef', 'terminationRequired', 'residueVerifierRef', 'residueScope', 'budgetMs'],
    [],
    label,
    'INVALID_PACK_DEFINITION',
  );
  assertOpaqueId(cleanup.obligationId, `${label}.obligationId`, 'INVALID_PACK_DEFINITION');
  assertArtifactRef(cleanup.ownerRef, `${label}.ownerRef`, 'INVALID_PACK_DEFINITION');
  if (cleanup.terminationRequired !== true) {
    fail('CLEANUP_CONTRACT_MISSING', `${label} must require termination before cleanup`);
  }
  assertArtifactRef(cleanup.residueVerifierRef, `${label}.residueVerifierRef`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(cleanup.residueScope, `${label}.residueScope`, 'INVALID_PACK_DEFINITION');
  if (!cleanup.residueScope.length || !Number.isSafeInteger(cleanup.budgetMs) || cleanup.budgetMs < 1) {
    fail('CLEANUP_CONTRACT_MISSING', `${label} must declare residue scope and a positive budget`);
  }
}

function validatePack(pack, index) {
  const label = `registry.packs[${index}]`;
  assertExactKeys(
    pack,
    [
      'packId', 'packVersion', 'checkInstanceId', 'checkDefinitionRef', 'nativeContractRef',
      'maturity', 'status', 'excludable', 'supportedTargetClasses', 'dependencies',
      'adapter', 'capabilityProofs', 'effect', 'prerequisiteGates', 'commandDeclarationRefs',
    ],
    ['cleanup'],
    label,
    'INVALID_PACK_DEFINITION',
  );
  assertOpaqueId(pack.packId, `${label}.packId`, 'INVALID_PACK_DEFINITION');
  assertVersion(pack.packVersion, `${label}.packVersion`, 'INVALID_PACK_DEFINITION');
  assertOpaqueId(pack.checkInstanceId, `${label}.checkInstanceId`, 'INVALID_PACK_DEFINITION');
  assertArtifactRef(pack.checkDefinitionRef, `${label}.checkDefinitionRef`, 'INVALID_PACK_DEFINITION');
  assertArtifactRef(pack.nativeContractRef, `${label}.nativeContractRef`, 'INVALID_PACK_DEFINITION');
  if (!['experimental', 'advisory', 'candidate', 'mandatory'].includes(pack.maturity)) {
    fail('INVALID_PACK_DEFINITION', `${label}.maturity is unsupported`);
  }
  if (!['active', 'suspended', 'quarantined'].includes(pack.status)) {
    fail('INVALID_PACK_DEFINITION', `${label}.status is unsupported`);
  }
  assertBoolean(pack.excludable, `${label}.excludable`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(pack.supportedTargetClasses, `${label}.supportedTargetClasses`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(pack.dependencies, `${label}.dependencies`, 'INVALID_PACK_DEFINITION');
  assertExactKeys(pack.adapter, ['adapterId', 'adapterVersion', 'capabilities'], [], `${label}.adapter`, 'INVALID_PACK_DEFINITION');
  assertOpaqueId(pack.adapter.adapterId, `${label}.adapter.adapterId`, 'INVALID_PACK_DEFINITION');
  assertVersion(pack.adapter.adapterVersion, `${label}.adapter.adapterVersion`, 'INVALID_PACK_DEFINITION');
  assertUniqueStrings(pack.adapter.capabilities, `${label}.adapter.capabilities`, 'INVALID_PACK_DEFINITION');
  if (!Array.isArray(pack.capabilityProofs)) fail('INVALID_PACK_DEFINITION', `${label}.capabilityProofs must be an array`);
  const capabilitySet = new Set();
  pack.capabilityProofs.forEach((proof, proofIndex) => {
    assertExactKeys(proof, ['capability', 'proofPolicyRef'], [], `${label}.capabilityProofs[${proofIndex}]`, 'INVALID_PACK_DEFINITION');
    assertOpaqueId(proof.capability, `${label}.capabilityProofs[${proofIndex}].capability`, 'INVALID_PACK_DEFINITION');
    assertArtifactRef(proof.proofPolicyRef, `${label}.capabilityProofs[${proofIndex}].proofPolicyRef`, 'INVALID_PACK_DEFINITION');
    if (capabilitySet.has(proof.capability)) fail('INVALID_PACK_DEFINITION', `${label} repeats capability ${proof.capability}`);
    if (!pack.adapter.capabilities.includes(proof.capability)) {
      fail('INVALID_PACK_DEFINITION', `${label} capability ${proof.capability} is absent from its adapter`);
    }
    capabilitySet.add(proof.capability);
  });
  validateEffect(pack.effect, pack.packId);
  if (!Array.isArray(pack.prerequisiteGates)) fail('INVALID_PACK_DEFINITION', `${label}.prerequisiteGates must be an array`);
  const gateIds = new Set();
  pack.prerequisiteGates.forEach((gate, gateIndex) => {
    validatePrerequisite(gate, pack, gateIndex);
    if (gateIds.has(gate.gateId)) fail('INVALID_PACK_DEFINITION', `${label} repeats gate ${gate.gateId}`);
    gateIds.add(gate.gateId);
  });
  assertReferenceArray(pack.commandDeclarationRefs, `${label}.commandDeclarationRefs`, 'INVALID_PACK_DEFINITION');
  validateCleanup(pack.cleanup, pack);
}

function validateMapping(mapping, idField, label) {
  assertExactKeys(mapping, [idField, 'packIds', 'fullRegression'], [], label, 'INVALID_REGISTRY');
  assertOpaqueId(mapping[idField], `${label}.${idField}`, 'INVALID_REGISTRY');
  assertUniqueStrings(mapping.packIds, `${label}.packIds`, 'INVALID_REGISTRY');
  assertBoolean(mapping.fullRegression, `${label}.fullRegression`, 'INVALID_REGISTRY');
}

function indexMappings(mappings, idField, label) {
  if (!Array.isArray(mappings)) fail('INVALID_REGISTRY', `${label} must be an array`);
  const indexed = new Map();
  mappings.forEach((mapping, index) => {
    validateMapping(mapping, idField, `${label}[${index}]`);
    if (indexed.has(mapping[idField])) fail('INVALID_REGISTRY', `${label} repeats ${mapping[idField]}`);
    indexed.set(mapping[idField], mapping);
  });
  return indexed;
}

function validateAvailablePackVersions(versions, packsById) {
  assertRecord(versions, 'availableTestPackVersions', 'IDENTITY_CONFLICT');
  const versionIds = Object.keys(versions).sort();
  const packIds = [...packsById.keys()].sort();
  if (canonicalize(versionIds) !== canonicalize(packIds)) {
    fail('IDENTITY_CONFLICT', 'available test-pack identities do not match the registry pack set');
  }
  for (const packId of packIds) {
    const identity = versions[packId];
    assertExactKeys(identity, ['packVersion', 'digestAlgorithm', 'digest', 'manifestRefs'], [], `availableTestPackVersions.${packId}`, 'IDENTITY_CONFLICT');
    if (
      identity.packVersion !== packsById.get(packId).packVersion
      || identity.digestAlgorithm !== 'sha256'
      || !DIGEST_PATTERN.test(identity.digest)
    ) {
      fail('IDENTITY_CONFLICT', `test-pack identity for ${packId} is stale or conflicts with the registry`);
    }
    assertReferenceArray(identity.manifestRefs, `availableTestPackVersions.${packId}.manifestRefs`, 'IDENTITY_CONFLICT');
  }
}

function validateSelectionInput(input) {
  canonicalize(input);
  assertExactKeys(input, [
    'productCandidateId', 'harnessVersion', 'availableTestPackVersions', 'target',
    'changedInputs', 'operations', 'requestedSuites', 'scheduledFull', 'exclusions',
    'availableCapabilities', 'selectionTime', 'policy', 'registry',
  ], [], 'selection input');
  assertContentIdentity(input.productCandidateId, 'productCandidateId', 'productCandidateId');
  assertContentIdentity(input.harnessVersion, 'harnessVersion', 'harnessVersion');
  assertExactKeys(input.target, ['targetClass', 'targetName'], [], 'target');
  assertOpaqueId(input.target.targetClass, 'target.targetClass');
  assertOpaqueId(input.target.targetName, 'target.targetName');
  assertUniqueStrings(input.operations, 'operations');
  assertUniqueStrings(input.requestedSuites, 'requestedSuites');
  assertUniqueStrings(input.availableCapabilities, 'availableCapabilities');
  if (typeof input.selectionTime !== 'string' || !TIMESTAMP_PATTERN.test(input.selectionTime)) {
    fail('INVALID_SELECTION_INPUT', 'selectionTime must be a canonical timestamp');
  }
  if (!Array.isArray(input.changedInputs)) fail('INVALID_SELECTION_INPUT', 'changedInputs must be an array');
  const changedIds = new Set();
  input.changedInputs.forEach((change, index) => {
    assertExactKeys(change, ['inputId', 'changeRef'], [], `changedInputs[${index}]`);
    assertOpaqueId(change.inputId, `changedInputs[${index}].inputId`);
    assertArtifactRef(change.changeRef, `changedInputs[${index}].changeRef`);
    if (changedIds.has(change.inputId)) fail('INVALID_SELECTION_INPUT', `changed input ${change.inputId} is duplicated`);
    changedIds.add(change.inputId);
  });
  assertExactKeys(input.scheduledFull, ['enabled'], ['triggerRef'], 'scheduledFull');
  assertBoolean(input.scheduledFull.enabled, 'scheduledFull.enabled');
  if (input.scheduledFull.enabled) {
    if (input.scheduledFull.triggerRef === undefined) fail('INVALID_SELECTION_INPUT', 'scheduled full regression requires a trigger reference');
    assertArtifactRef(input.scheduledFull.triggerRef, 'scheduledFull.triggerRef');
  } else if (input.scheduledFull.triggerRef !== undefined) {
    fail('INVALID_SELECTION_INPUT', 'disabled scheduled full regression cannot carry a trigger reference');
  }

  assertExactKeys(input.policy, ['policyRef', 'mandatoryCorePackIds', 'exclusionAuthorities', 'budgets', 'cancellationPolicyRef'], [], 'policy', 'INVALID_POLICY');
  assertArtifactRef(input.policy.policyRef, 'policy.policyRef', 'INVALID_POLICY');
  assertUniqueStrings(input.policy.mandatoryCorePackIds, 'policy.mandatoryCorePackIds', 'INVALID_POLICY');
  assertUniqueStrings(input.policy.exclusionAuthorities, 'policy.exclusionAuthorities', 'INVALID_POLICY');
  assertArtifactRef(input.policy.cancellationPolicyRef, 'policy.cancellationPolicyRef', 'INVALID_POLICY');
  assertBudgets(input.policy.budgets);
  assertAuthorityDigest(input.policy, 'policyRef', 'policy', 'STALE_POLICY');

  assertExactKeys(input.registry, ['registryRef', 'packs', 'impactMappings', 'suites', 'operations', 'fullRegressionPackIds'], [], 'registry', 'INVALID_REGISTRY');
  assertArtifactRef(input.registry.registryRef, 'registry.registryRef', 'INVALID_REGISTRY');
  if (!Array.isArray(input.registry.packs)) fail('INVALID_REGISTRY', 'registry.packs must be an array');
  const packsById = new Map();
  const checkIds = new Set();
  input.registry.packs.forEach((pack, index) => {
    validatePack(pack, index);
    if (packsById.has(pack.packId)) fail('PACK_VERSION_CONFLICT', `registry repeats pack ${pack.packId}`);
    if (checkIds.has(pack.checkInstanceId)) fail('PACK_VERSION_CONFLICT', `registry repeats check instance ${pack.checkInstanceId}`);
    packsById.set(pack.packId, pack);
    checkIds.add(pack.checkInstanceId);
  });
  assertAuthorityDigest(input.registry, 'registryRef', 'registry', 'STALE_REGISTRY');
  const harnessManifestRefs = new Set(input.harnessVersion.manifestRefs.map((reference) => canonicalize(reference)));
  for (const [label, reference] of [
    ['policy', input.policy.policyRef],
    ['registry', input.registry.registryRef],
  ]) {
    if (!harnessManifestRefs.has(canonicalize(reference))) {
      fail('IDENTITY_CONFLICT', `harnessVersion is not bound to the current ${label} reference`);
    }
  }
  validateAvailablePackVersions(input.availableTestPackVersions, packsById);
  const impactMappings = indexMappings(input.registry.impactMappings, 'inputId', 'registry.impactMappings');
  const suites = indexMappings(input.registry.suites, 'suiteId', 'registry.suites');
  const operations = indexMappings(input.registry.operations, 'operationId', 'registry.operations');
  assertUniqueStrings(input.registry.fullRegressionPackIds, 'registry.fullRegressionPackIds', 'INVALID_REGISTRY');

  const allMappedPackIds = [
    ...input.policy.mandatoryCorePackIds,
    ...input.registry.fullRegressionPackIds,
    ...[...impactMappings.values()].flatMap((mapping) => mapping.packIds),
    ...[...suites.values()].flatMap((mapping) => mapping.packIds),
    ...[...operations.values()].flatMap((mapping) => mapping.packIds),
    ...input.registry.packs.flatMap((pack) => pack.dependencies),
  ];
  for (const packId of allMappedPackIds) {
    if (!packsById.has(packId)) fail('UNKNOWN_PACK', `registry or policy references unknown pack ${packId}`);
  }
  const fullSet = [...input.registry.fullRegressionPackIds].sort();
  for (const mapping of [...impactMappings.values(), ...suites.values(), ...operations.values()]) {
    if (mapping.fullRegression && canonicalize([...mapping.packIds].sort()) !== canonicalize(fullSet)) {
      fail('INVALID_REGISTRY', 'a full-regression mapping must name the exact full-regression pack set');
    }
  }

  if (!Array.isArray(input.exclusions)) fail('INVALID_SELECTION_INPUT', 'exclusions must be an array');
  const exclusionIds = new Set();
  const excludedPacks = new Set();
  input.exclusions.forEach((exclusion, index) => {
    const label = `exclusions[${index}]`;
    assertExactKeys(exclusion, ['exclusionId', 'packId', 'targetClass', 'reason', 'approvingAuthority', 'expiresAt', 'evidenceImpact'], [], label);
    for (const field of ['exclusionId', 'packId', 'targetClass', 'reason', 'approvingAuthority', 'evidenceImpact']) {
      assertOpaqueId(exclusion[field], `${label}.${field}`);
    }
    if (typeof exclusion.expiresAt !== 'string' || !TIMESTAMP_PATTERN.test(exclusion.expiresAt)) {
      fail('INVALID_SELECTION_INPUT', `${label}.expiresAt must be a canonical timestamp`);
    }
    if (exclusionIds.has(exclusion.exclusionId) || excludedPacks.has(exclusion.packId)) {
      fail('CONFLICTING_EXCLUSION', `${label} duplicates an exclusion identity or pack`);
    }
    exclusionIds.add(exclusion.exclusionId);
    excludedPacks.add(exclusion.packId);
  });

  return { packsById, impactMappings, suites, operations };
}

function selectChecks(input) {
  const { packsById, impactMappings, suites, operations } = validateSelectionInput(input);
  const roots = new Map();
  const fullRegressionOrigins = new Set();
  const addOrigin = (packId, origin) => {
    if (!packsById.has(packId)) fail('UNKNOWN_PACK', `selection references unknown pack ${packId}`);
    if (!roots.has(packId)) roots.set(packId, new Set());
    roots.get(packId).add(origin);
  };
  const applyMapping = (mapping, origin) => {
    mapping.packIds.forEach((packId) => addOrigin(packId, origin));
    if (mapping.fullRegression) fullRegressionOrigins.add(origin);
  };

  input.policy.mandatoryCorePackIds.forEach((packId) => addOrigin(packId, 'mandatory-core'));
  const mappedInputs = [];
  for (const change of input.changedInputs) {
    const mapping = impactMappings.get(change.inputId);
    if (!mapping) fail('UNMAPPED_INPUT', `changed input ${change.inputId} has no impact mapping`);
    applyMapping(mapping, 'impacted-domain');
    mappedInputs.push(change.inputId);
  }
  for (const suiteId of input.requestedSuites) {
    const mapping = suites.get(suiteId);
    if (!mapping) fail('UNKNOWN_SUITE', `requested suite ${suiteId} is unknown`);
    applyMapping(mapping, 'explicit-suite');
  }
  for (const operationId of input.operations) {
    const mapping = operations.get(operationId);
    if (!mapping) fail('UNMAPPED_OPERATION', `operation ${operationId} is unknown or unmapped`);
    applyMapping(mapping, 'release-operation');
  }
  if (input.scheduledFull.enabled) {
    input.registry.fullRegressionPackIds.forEach((packId) => addOrigin(packId, 'scheduled-full'));
    fullRegressionOrigins.add('scheduled-full');
  }

  const exclusions = [...input.exclusions].sort((left, right) => compareStrings(left.exclusionId, right.exclusionId));
  const excludedPacks = new Set();
  for (const exclusion of exclusions) {
    const pack = packsById.get(exclusion.packId);
    if (!pack) fail('UNKNOWN_PACK', `exclusion references unknown pack ${exclusion.packId}`);
    if (exclusion.targetClass !== input.target.targetClass) {
      fail('CONFLICTING_EXCLUSION', `exclusion ${exclusion.exclusionId} targets another environment class`);
    }
    if (!input.policy.exclusionAuthorities.includes(exclusion.approvingAuthority)) {
      fail('CONFLICTING_EXCLUSION', `exclusion ${exclusion.exclusionId} has no approved authority`);
    }
    if (exclusion.expiresAt <= input.selectionTime) {
      fail('CONFLICTING_EXCLUSION', `exclusion ${exclusion.exclusionId} is expired`);
    }
    if (!roots.has(exclusion.packId)) {
      fail('CONFLICTING_EXCLUSION', `exclusion ${exclusion.exclusionId} has no selected scope`);
    }
    const origins = roots.get(exclusion.packId);
    if (!pack.excludable || [...origins].some((origin) => ['mandatory-core', 'scheduled-full', 'release-operation'].includes(origin))) {
      fail('CONFLICTING_EXCLUSION', `exclusion ${exclusion.exclusionId} would remove mandatory evidence`);
    }
    roots.delete(exclusion.packId);
    excludedPacks.add(exclusion.packId);
  }

  const queue = [...roots.keys()].sort();
  for (let index = 0; index < queue.length; index += 1) {
    const pack = packsById.get(queue[index]);
    for (const dependencyId of pack.dependencies) {
      if (excludedPacks.has(dependencyId)) {
        fail('CONFLICTING_EXCLUSION', `excluded pack ${dependencyId} is required by ${pack.packId}`);
      }
      const firstVisit = !roots.has(dependencyId);
      addOrigin(dependencyId, 'dependency');
      if (firstVisit) queue.push(dependencyId);
    }
  }

  const availableCapabilities = new Set(input.availableCapabilities);
  for (const packId of roots.keys()) {
    const pack = packsById.get(packId);
    if (pack.maturity !== 'mandatory') fail('PACK_NOT_MANDATORY', `selected pack ${packId} is not mandatory`);
    if (pack.status !== 'active') fail('PACK_UNAVAILABLE', `selected pack ${packId} is ${pack.status}`);
    if (!pack.supportedTargetClasses.includes(input.target.targetClass)) {
      fail('TARGET_UNSUPPORTED', `selected pack ${packId} does not support ${input.target.targetClass}`);
    }
    for (const proof of pack.capabilityProofs) {
      if (!availableCapabilities.has(proof.capability)) {
        fail('CAPABILITY_UNAVAILABLE', `selected pack ${packId} requires unavailable capability ${proof.capability}`);
      }
    }
    if (pack.cleanup && pack.cleanup.budgetMs > input.policy.budgets.cleanupMs) {
      fail('CLEANUP_CONTRACT_MISSING', `selected pack ${packId} cleanup exceeds the protected cleanup budget`);
    }
  }

  const adjacency = new Map([...roots.keys()].map((packId) => [packId, []]));
  const indegree = new Map([...roots.keys()].map((packId) => [packId, 0]));
  const dependencyPairs = [];
  for (const packId of roots.keys()) {
    for (const dependencyId of packsById.get(packId).dependencies) {
      adjacency.get(dependencyId).push(packId);
      indegree.set(packId, indegree.get(packId) + 1);
      dependencyPairs.push([dependencyId, packId]);
    }
  }
  const ready = [...indegree.entries()].filter(([, count]) => count === 0).map(([packId]) => packId).sort();
  const orderedPackIds = [];
  while (ready.length) {
    const packId = ready.shift();
    orderedPackIds.push(packId);
    for (const dependant of adjacency.get(packId).sort()) {
      indegree.set(dependant, indegree.get(dependant) - 1);
      if (indegree.get(dependant) === 0) {
        ready.push(dependant);
        ready.sort();
      }
    }
  }
  if (orderedPackIds.length !== roots.size) {
    const cyclicPackIds = [...indegree.entries()].filter(([, count]) => count > 0).map(([packId]) => packId).sort();
    fail('DEPENDENCY_CYCLE', 'selected pack dependencies contain a cycle', { cyclicPackIds });
  }

  const originRank = new Map(ORIGIN_ORDER.map((origin, index) => [origin, index]));
  const selectedChecks = orderedPackIds.map((packId) => {
    const pack = packsById.get(packId);
    return {
      checkInstanceId: pack.checkInstanceId,
      checkDefinitionRef: pack.checkDefinitionRef,
      packId,
      packVersion: pack.packVersion,
      nativeContractRef: pack.nativeContractRef,
      adapterCapabilities: [...pack.adapter.capabilities].sort(),
      inclusionOrigins: [...roots.get(packId)].sort((left, right) => originRank.get(left) - originRank.get(right)),
    };
  });
  const selectedPackIds = new Set(orderedPackIds);
  const testPackVersions = Object.fromEntries(
    Object.entries(input.availableTestPackVersions)
      .filter(([packId]) => selectedPackIds.has(packId))
      .sort(([left], [right]) => compareStrings(left, right)),
  );
  const dependencies = dependencyPairs
    .map(([predecessor, dependant]) => ({
      predecessor: packsById.get(predecessor).checkInstanceId,
      dependant: packsById.get(dependant).checkInstanceId,
      reason: 'pack-dependency',
      relationship: 'dependency',
    }))
    .sort((left, right) => compareStrings(canonicalize(left), canonicalize(right)));
  const selectedPacks = orderedPackIds.map((packId) => packsById.get(packId));
  const prerequisiteGates = selectedPacks.flatMap((pack) => pack.prerequisiteGates.map((gate) => ({
    gateId: gate.gateId,
    checkInstanceId: pack.checkInstanceId,
    proofType: gate.proofType,
    freshnessPolicyRef: gate.freshnessPolicyRef,
    validatorRef: gate.validatorRef,
    blockingClosure: gate.blockingClosure,
    metadataOnlyOnFailure: gate.metadataOnlyOnFailure,
  })));
  const environmentRequirements = selectedPacks.flatMap((pack) => pack.capabilityProofs.map((proof) => ({
    checkInstanceId: pack.checkInstanceId,
    capability: proof.capability,
    proofPolicyRef: proof.proofPolicyRef,
  })));
  const declaredEffects = selectedPacks.map((pack) => ({ checkInstanceId: pack.checkInstanceId, ...pack.effect }));
  const adapterRequirements = selectedPacks.map((pack) => ({
    checkInstanceId: pack.checkInstanceId,
    adapterId: pack.adapter.adapterId,
    adapterVersion: pack.adapter.adapterVersion,
    capabilities: [...pack.adapter.capabilities].sort(),
  }));
  const commandDeclarationRefs = selectedPacks.flatMap((pack) => pack.commandDeclarationRefs);
  const cleanupObligations = selectedPacks.filter((pack) => pack.cleanup).map((pack) => ({
    obligationId: pack.cleanup.obligationId,
    checkInstanceId: pack.checkInstanceId,
    ownerRef: pack.cleanup.ownerRef,
    terminationRequired: pack.cleanup.terminationRequired,
    residueVerifierRef: pack.cleanup.residueVerifierRef,
    residueScope: pack.cleanup.residueScope,
    budgetMs: pack.cleanup.budgetMs,
  }));

  const selectionRecord = {
    policyRef: input.policy.policyRef,
    registryRef: input.registry.registryRef,
    productCandidateId: input.productCandidateId,
    harnessVersion: input.harnessVersion,
    target: input.target,
    testPackVersions,
    scopeResolution: { mappedInputs: mappedInputs.sort(), rejectedInputs: [] },
    selectedChecks,
    dependencies,
    executionOrder: orderedPackIds.map((packId) => packsById.get(packId).checkInstanceId),
    prerequisiteGates,
    environmentRequirements,
    declaredEffects,
    adapterRequirements,
    commandDeclarationRefs,
    budgets: input.policy.budgets,
    cancellationPolicyRef: input.policy.cancellationPolicyRef,
    cleanupObligations,
    exclusions,
    fullRegression: {
      selected: fullRegressionOrigins.size > 0,
      origins: [...fullRegressionOrigins].sort((left, right) => originRank.get(left) - originRank.get(right)),
    },
    selectionInputDigest: { algorithm: 'sha256', value: digestCanonical(input) },
  };
  return {
    ...selectionRecord,
    selectionOutputDigest: { algorithm: 'sha256', value: digestCanonical(selectionRecord) },
  };
}

module.exports = {
  ORIGIN_ORDER,
  SelectionError,
  selectChecks,
};
