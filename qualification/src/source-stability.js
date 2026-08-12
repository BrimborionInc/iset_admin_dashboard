'use strict';

const { computeArtifactDigest, digestCanonical } = require('./canonical-json');
const { SourceInventoryError, validateSourceInventory } = require('./source-inventory');

const SOURCE_STABILITY_VERSION = '1.0.0';
const SOURCE_STABILITY_PACK_VERSION = '1.0.0';
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;

function own(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new SourceInventoryError('INVALID_SHAPE', `${label} must be an object`);
  }
  const missing = keys.filter((key) => !own(value, key));
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (missing.length || unknown.length) {
    throw new SourceInventoryError('INVALID_SHAPE', `${label} has missing or unknown fields`, {
      missing,
      unknown,
    });
  }
}

function exactArray(value, expected, label) {
  if (!Array.isArray(value) || value.length !== expected.length
    || value.some((item, index) => item !== expected[index])) {
    throw new SourceInventoryError('INVALID_VALUE', `${label} conflicts with the certified contract`);
  }
}

function validateSourceStabilityPack(pack, registry) {
  exactKeys(pack, [
    'schemaVersion', 'packId', 'packVersion', 'contentDigest', 'maturity',
    'operatingStatus', 'releaseAuthority', 'testLevel', 'owner', 'purpose',
    'registryBinding', 'nativeAuthority', 'effects', 'certification', 'coverage',
  ], 'source-stability pack');
  if (
    pack.schemaVersion !== '1.0.0' || pack.packId !== 'candidate-source-stability'
    || pack.packVersion !== SOURCE_STABILITY_PACK_VERSION || pack.maturity !== 'advisory'
    || pack.operatingStatus !== 'active' || pack.releaseAuthority !== 'none'
    || pack.testLevel !== 'component/contract'
  ) throw new SourceInventoryError('PACK_CONTRACT_CONFLICT', 'Source-stability pack authority or version conflicts');
  exactKeys(pack.contentDigest, ['algorithm', 'value'], 'source-stability pack.contentDigest');
  if (
    pack.contentDigest.algorithm !== 'sha256' || !DIGEST_PATTERN.test(pack.contentDigest.value)
    || computeArtifactDigest(pack).value !== pack.contentDigest.value
  ) throw new SourceInventoryError('STALE_DIGEST', 'Source-stability pack digest is stale');
  exactKeys(pack.owner, ['repositoryId', 'domain'], 'source-stability pack.owner');
  if (pack.owner.repositoryId !== 'admin' || pack.owner.domain !== 'qualification-control-plane') {
    throw new SourceInventoryError('PACK_CONTRACT_CONFLICT', 'Source-stability pack owner is invalid');
  }
  exactKeys(pack.registryBinding, ['path', 'contentDigest'], 'source-stability pack.registryBinding');
  exactKeys(pack.registryBinding.contentDigest, ['algorithm', 'value'], 'source-stability pack.registryBinding.contentDigest');
  if (
    pack.registryBinding.path !== 'qualification/registries/phase3-source-roles.registry.json'
    || pack.registryBinding.contentDigest.algorithm !== 'sha256'
    || !DIGEST_PATTERN.test(pack.registryBinding.contentDigest.value)
  ) throw new SourceInventoryError('PACK_CONTRACT_CONFLICT', 'Source-stability registry binding is invalid');
  if (registry && pack.registryBinding.contentDigest.value !== registry.contentDigest.value) {
    throw new SourceInventoryError('REGISTRY_CONFLICT', 'Source-stability pack binds a different role registry');
  }
  exactKeys(pack.nativeAuthority, [
    'inventoryCommand', 'verifyCommand', 'semanticResultAuthority',
  ], 'source-stability pack.nativeAuthority');
  exactArray(pack.nativeAuthority.inventoryCommand, [
    'node', 'qualification/bin/rq-source-state.js', 'inventory', '--registry',
    'qualification/registries/phase3-source-roles.registry.json',
  ], 'source-stability inventory command');
  exactArray(pack.nativeAuthority.verifyCommand, [
    'node', 'qualification/bin/rq-source-state.js', 'verify', '--registry',
    'qualification/registries/phase3-source-roles.registry.json', '--baseline',
    '<content-addressed-baseline-ref>',
  ], 'source-stability verify command');
  if (pack.nativeAuthority.semanticResultAuthority !== 'validated-source-state') {
    throw new SourceInventoryError('PACK_CONTRACT_CONFLICT', 'Source-stability semantic authority is invalid');
  }
  exactKeys(pack.effects, ['effectClass', 'reads', 'writes', 'externalEffects'], 'source-stability pack.effects');
  if (pack.effects.effectClass !== 'read-only') {
    throw new SourceInventoryError('EFFECT_CONFLICT', 'Source-stability pack must remain read-only');
  }
  exactArray(pack.effects.reads, ['git-head-ref-index', 'declared-role-file-bytes'], 'source-stability reads');
  exactArray(pack.effects.writes, ['qualification-owned-temporary-evidence'], 'source-stability writes');
  exactArray(pack.effects.externalEffects, [], 'source-stability external effects');
  exactKeys(pack.certification, [
    'knownGoodRuns', 'pairedComparisons', 'deliberateMutationsRequired',
    'forcedInterruptionRequired', 'cumulativeRegressionRequired',
  ], 'source-stability pack.certification');
  if (
    pack.certification.knownGoodRuns !== 10 || pack.certification.pairedComparisons !== 5
    || pack.certification.deliberateMutationsRequired !== true
    || pack.certification.forcedInterruptionRequired !== true
    || pack.certification.cumulativeRegressionRequired !== true
  ) throw new SourceInventoryError('CERTIFICATION_CONFLICT', 'Source-stability certification boundary is weakened');
  exactKeys(pack.coverage, [
    'repositories', 'categories', 'excludedRepositories', 'openNoLossObligations',
  ], 'source-stability pack.coverage');
  exactArray(pack.coverage.repositories, ['admin', 'portal', 'shared'], 'source-stability repositories');
  exactArray(pack.coverage.categories, ['source-inventory', 'source-stability'], 'source-stability categories');
  exactArray(pack.coverage.excludedRepositories, ['intacct-mock-service'], 'source-stability excluded repositories');
  exactArray(pack.coverage.openNoLossObligations, ['RN02', 'RN04'], 'source-stability open obligations');
  return pack;
}

function fileMap(inventory) {
  return new Map(inventory.repositories.flatMap((repository) => repository.files.map((file) => [
    `${repository.repositoryId}:${file.path}`,
    { repositoryId: repository.repositoryId, ...file },
  ])));
}

function identityChanges(baseline, observed) {
  return Object.keys(baseline.identityDigests)
    .filter((identity) => baseline.identityDigests[identity] !== observed.identityDigests[identity])
    .sort();
}

function compareSourceStability(baseline, observed, { expectedBaselineId } = {}) {
  validateSourceInventory(baseline);
  validateSourceInventory(observed);
  if (expectedBaselineId && baseline.inventoryId !== expectedBaselineId) {
    throw new SourceInventoryError('STALE_BASELINE', 'Source stability baseline does not match its admitted ID', {
      expected: expectedBaselineId,
      observed: baseline.inventoryId,
    });
  }
  if (baseline.registry.contentDigest.value !== observed.registry.contentDigest.value) {
    throw new SourceInventoryError('REGISTRY_CONFLICT', 'Before and after inventories use different role registries');
  }
  const baselineRepositories = new Map(baseline.repositories.map((repository) => [repository.repositoryId, repository]));
  const observedRepositories = new Map(observed.repositories.map((repository) => [repository.repositoryId, repository]));
  const repositoryChanges = [];
  for (const repositoryId of [...new Set([...baselineRepositories.keys(), ...observedRepositories.keys()])].sort()) {
    const before = baselineRepositories.get(repositoryId);
    const after = observedRepositories.get(repositoryId);
    if (!before || !after) {
      repositoryChanges.push({ repositoryId, change: before ? 'removed' : 'added' });
      continue;
    }
    if (
      before.head !== after.head || before.tree !== after.tree || before.ref !== after.ref
      || before.indexDigest !== after.indexDigest
    ) {
      repositoryChanges.push({
        repositoryId,
        change: 'git-identity',
        beforeHead: before.head,
        afterHead: after.head,
        beforeTree: before.tree,
        afterTree: after.tree,
        beforeRef: before.ref,
        afterRef: after.ref,
        beforeIndexDigest: before.indexDigest,
        afterIndexDigest: after.indexDigest,
      });
    }
  }
  const beforeFiles = fileMap(baseline);
  const afterFiles = fileMap(observed);
  const fileChanges = [];
  for (const key of [...new Set([...beforeFiles.keys(), ...afterFiles.keys()])].sort()) {
    const before = beforeFiles.get(key);
    const after = afterFiles.get(key);
    if (!before || !after) {
      const value = before || after;
      fileChanges.push({
        repositoryId: value.repositoryId,
        path: value.path,
        roleId: value.roleId,
        identity: value.identity,
        change: before ? 'removed' : 'added',
        beforeDigest: before ? before.contentDigest : null,
        afterDigest: after ? after.contentDigest : null,
      });
    } else if (
      before.contentDigest !== after.contentDigest || before.roleId !== after.roleId
      || before.identity !== after.identity || before.tracked !== after.tracked
    ) {
      fileChanges.push({
        repositoryId: after.repositoryId,
        path: after.path,
        roleId: after.roleId,
        identity: after.identity,
        change: before.roleId !== after.roleId || before.identity !== after.identity ? 'role-changed' : 'modified',
        beforeDigest: before.contentDigest,
        afterDigest: after.contentDigest,
      });
    }
  }
  const dirtyRepositories = observed.repositories
    .filter((repository) => !repository.clean)
    .map((repository) => ({ repositoryId: repository.repositoryId, dirtyPaths: repository.dirtyPaths }));
  const affectedIdentities = identityChanges(baseline, observed);
  // Git refs remain provenance facts; admitted path bytes and index state determine stability.
  const stable = fileChanges.length === 0 && dirtyRepositories.length === 0
    && repositoryChanges.every((change) => change.change === 'git-identity'
      && change.beforeIndexDigest === change.afterIndexDigest);
  const result = {
    schemaVersion: SOURCE_STABILITY_VERSION,
    stabilityId: 'pending',
    baselineInventoryId: baseline.inventoryId,
    observedInventoryId: observed.inventoryId,
    status: stable ? 'stable' : 'drifted',
    stable,
    affectedIdentities,
    repositoryChanges,
    fileChanges,
    dirtyRepositories,
    releaseAuthority: 'none',
  };
  result.stabilityId = `source-stability:${digestCanonical(result)}`;
  result.contentDigest = computeArtifactDigest(result);
  return Object.freeze(structuredClone(result));
}

function validateSourceStability(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new SourceInventoryError('INVALID_SHAPE', 'Source stability result must be an object');
  }
  const expected = computeArtifactDigest(result).value;
  if (!result.contentDigest || result.contentDigest.value !== expected) {
    throw new SourceInventoryError('STALE_DIGEST', 'Source stability result digest is stale');
  }
  if (result.schemaVersion !== SOURCE_STABILITY_VERSION || result.releaseAuthority !== 'none') {
    throw new SourceInventoryError('AUTHORITY_CONFLICT', 'Source stability result version or authority is invalid');
  }
  if (!['stable', 'drifted'].includes(result.status) || result.stable !== (result.status === 'stable')) {
    throw new SourceInventoryError('INVALID_VALUE', 'Source stability terminal status is inconsistent');
  }
  return result;
}

module.exports = {
  SOURCE_STABILITY_PACK_VERSION,
  SOURCE_STABILITY_VERSION,
  compareSourceStability,
  validateSourceStability,
  validateSourceStabilityPack,
};
