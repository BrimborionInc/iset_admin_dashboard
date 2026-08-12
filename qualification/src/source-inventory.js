'use strict';

const {
  lstatSync, readFileSync, realpathSync,
} = require('node:fs');
const { isAbsolute, relative, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  computeArtifactDigest, digestBytes, digestCanonical, parseStrictJson,
} = require('./canonical-json');

const SOURCE_ROLE_REGISTRY_VERSION = '1.0.0';
const SOURCE_INVENTORY_VERSION = '1.0.0';
const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_OID_PATTERN = /^[0-9a-f]{40,64}$/u;
const ROLE_IDENTITIES = Object.freeze([
  'productCandidateId', 'harnessVersion', 'testPackVersions',
]);

class SourceInventoryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'SourceInventoryError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new SourceInventoryError(code, message, details);
}

function assertRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_SHAPE', `${label} must be an object`);
  }
}

function assertExactKeys(value, required, optional, label) {
  assertRecord(value, label);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    fail('INVALID_SHAPE', `${label} has missing or unknown fields`, { missing, unknown });
  }
}

function assertStrings(value, label) {
  if (!Array.isArray(value) || value.length === 0) fail('INVALID_SHAPE', `${label} must be a non-empty array`);
  const seen = new Set();
  value.forEach((item, index) => {
    if (typeof item !== 'string' || item.length === 0 || item.includes('\0')) {
      fail('INVALID_VALUE', `${label}[${index}] must be a non-empty NUL-free string`);
    }
    if (seen.has(item)) fail('DUPLICATE_VALUE', `${label} repeats ${item}`);
    seen.add(item);
  });
}

function assertDigest(value, label) {
  assertExactKeys(value, ['algorithm', 'value'], [], label);
  if (value.algorithm !== 'sha256' || !DIGEST_PATTERN.test(value.value)) {
    fail('INVALID_DIGEST', `${label} must be a SHA-256 digest`);
  }
}

function assertContentDigest(value, label) {
  assertDigest(value.contentDigest, `${label}.contentDigest`);
  const expected = computeArtifactDigest(value).value;
  if (expected !== value.contentDigest.value) {
    fail('STALE_DIGEST', `${label} content digest is stale`, {
      expected,
      observed: value.contentDigest.value,
    });
  }
}

function normalizePath(path, label = 'path') {
  if (
    typeof path !== 'string' || path.length === 0 || isAbsolute(path)
    || path.includes('\0') || path.includes('\\')
  ) fail('INVALID_PATH', `${label} must be a relative POSIX path`);
  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    fail('PATH_ESCAPE', `${label} contains an empty, current, or parent segment`, { path });
  }
  return path;
}

function globPattern(pattern) {
  if (pattern === '**') return /^.*$/u;
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      index += 1;
      if (pattern[index + 1] === '/') {
        index += 1;
        source += '(?:.*/)?';
      } else {
        source += '.*';
      }
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[|\\{}()[\]^$+?.]/gu, '\\$&');
    }
  }
  return new RegExp(`${source}$`, 'u');
}

function matchesAny(path, patterns) {
  return patterns.some((pattern) => globPattern(pattern).test(path));
}

function validateSourceRoleRegistry(registry) {
  assertExactKeys(registry, [
    'schemaVersion', 'registryId', 'contentDigest', 'authority', 'protectedPaths',
    'repositories', 'identityRoleMap',
  ], [], 'source role registry');
  if (registry.schemaVersion !== SOURCE_ROLE_REGISTRY_VERSION) {
    fail('UNSUPPORTED_VERSION', 'Source role registry version is unsupported');
  }
  if (registry.registryId !== 'phase3-source-roles') {
    fail('REGISTRY_NOT_AUTHORIZED', 'Source role registry ID is not authorized');
  }
  assertExactKeys(registry.authority, [
    'selectionAuthority', 'releaseAuthority', 'currentGateAuthority',
  ], [], 'source role registry.authority');
  if (
    registry.authority.selectionAuthority !== 'advisory-certification-only'
    || registry.authority.releaseAuthority !== 'none'
    || registry.authority.currentGateAuthority !== 'unchanged'
  ) fail('AUTHORITY_CONFLICT', 'Source role registry cannot grant release authority');
  assertStrings(registry.protectedPaths, 'source role registry.protectedPaths');
  registry.protectedPaths.forEach((pattern) => normalizePath(pattern, 'protected path pattern'));
  assertExactKeys(registry.identityRoleMap, ROLE_IDENTITIES, [], 'source role registry.identityRoleMap');
  for (const identity of ROLE_IDENTITIES) {
    assertStrings(registry.identityRoleMap[identity], `identityRoleMap.${identity}`);
  }
  const declaredRoles = new Set();
  if (!Array.isArray(registry.repositories) || registry.repositories.length !== 3) {
    fail('REGISTRY_SCOPE_CONFLICT', 'Source role registry must contain admin, portal, and shared repositories');
  }
  const repositoryIds = [];
  registry.repositories.forEach((repository, repositoryIndex) => {
    assertExactKeys(repository, ['repositoryId', 'root', 'rules'], [], `repositories[${repositoryIndex}]`);
    if (typeof repository.repositoryId !== 'string' || !repository.repositoryId) {
      fail('INVALID_VALUE', `repositories[${repositoryIndex}].repositoryId is invalid`);
    }
    if (
      typeof repository.root !== 'string' || !repository.root || isAbsolute(repository.root)
      || repository.root.split('/').filter((part) => part === '..').length > 1
    ) fail('PATH_ESCAPE', `repositories[${repositoryIndex}].root escapes the workspace boundary`);
    repositoryIds.push(repository.repositoryId);
    if (!Array.isArray(repository.rules) || repository.rules.length === 0) {
      fail('INVALID_SHAPE', `repositories[${repositoryIndex}].rules must not be empty`);
    }
    repository.rules.forEach((rule, ruleIndex) => {
      assertExactKeys(rule, [
        'roleId', 'identity', 'patterns', 'allowUntracked',
      ], [], `repositories[${repositoryIndex}].rules[${ruleIndex}]`);
      if (typeof rule.roleId !== 'string' || !rule.roleId) fail('INVALID_VALUE', 'Source role ID is invalid');
      if (!ROLE_IDENTITIES.includes(rule.identity)) fail('INVALID_VALUE', 'Source role identity is invalid');
      if (typeof rule.allowUntracked !== 'boolean') fail('INVALID_VALUE', 'allowUntracked must be boolean');
      assertStrings(rule.patterns, `repositories[${repositoryIndex}].rules[${ruleIndex}].patterns`);
      rule.patterns.forEach((pattern) => normalizePath(pattern, 'source role pattern'));
      declaredRoles.add(rule.roleId);
    });
  });
  if (new Set(repositoryIds).size !== repositoryIds.length) fail('DUPLICATE_VALUE', 'Repository IDs must be unique');
  if (repositoryIds.slice().sort().join(',') !== 'admin,portal,shared') {
    fail('REGISTRY_SCOPE_CONFLICT', 'Source role registry must name exactly admin, portal, and shared');
  }
  const mappedRoles = new Map();
  for (const [identity, roles] of Object.entries(registry.identityRoleMap)) {
    roles.forEach((role) => {
      if (!declaredRoles.has(role)) fail('ROLE_CONFLICT', `${identity} references undeclared role ${role}`);
      if (mappedRoles.has(role) && mappedRoles.get(role) !== identity) {
        fail('ROLE_CONFLICT', `Source role ${role} is assigned to conflicting identities`);
      }
      mappedRoles.set(role, identity);
    });
  }
  for (const role of declaredRoles) {
    if (!mappedRoles.has(role)) fail('ROLE_CONFLICT', `Source role ${role} has no identity mapping`);
  }
  assertContentDigest(registry, 'source role registry');
  return registry;
}

function loadSourceRoleRegistry(path) {
  let registry;
  try {
    registry = parseStrictJson(readFileSync(path));
  } catch (error) {
    if (error instanceof SourceInventoryError) throw error;
    fail('INVALID_JSON', 'Source role registry is not strict JSON', { cause: error.code || error.message });
  }
  return validateSourceRoleRegistry(registry);
}

function runGit(repositoryRoot, args, { allowNonzero = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: repositoryRoot,
    encoding: null,
    shell: false,
    timeout: 10000,
    maxBuffer: 16 * 1024 * 1024,
    env: { PATH: process.env.PATH },
  });
  if (result.error) fail('GIT_OPERATION_FAILED', `Git ${args[0]} did not complete`, { cause: result.error.message });
  if (result.signal) fail('GIT_OPERATION_FAILED', `Git ${args[0]} ended by signal`, { signal: result.signal });
  if (result.status !== 0 && !allowNonzero) {
    fail('GIT_OPERATION_FAILED', `Git ${args[0]} exited nonzero`, {
      exitCode: result.status,
      stderrDigest: digestBytes(result.stderr || Buffer.alloc(0)),
    });
  }
  return result;
}

function splitNul(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

function parseIndexEntries(buffer) {
  return splitNul(buffer).map((entry) => {
    const tab = entry.indexOf('\t');
    if (tab === -1) fail('GIT_EVIDENCE_INVALID', 'Git index entry has no path separator');
    const [mode, oid, stage] = entry.slice(0, tab).split(' ');
    const path = normalizePath(entry.slice(tab + 1), 'Git index path');
    if (!/^[0-7]{6}$/u.test(mode) || !GIT_OID_PATTERN.test(oid) || !/^[0-3]$/u.test(stage)) {
      fail('GIT_EVIDENCE_INVALID', 'Git index entry is malformed', { path });
    }
    return { mode, oid, stage, path };
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function parseDirtyPaths(buffer) {
  const tokens = splitNul(buffer);
  const paths = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.length < 4 || token[2] !== ' ') fail('GIT_EVIDENCE_INVALID', 'Git status entry is malformed');
    paths.push(normalizePath(token.slice(3), 'Git status path'));
    if (['R', 'C'].includes(token[0]) || ['R', 'C'].includes(token[1])) {
      index += 1;
      if (!tokens[index]) fail('GIT_EVIDENCE_INVALID', 'Git rename status omits its source path');
      paths.push(normalizePath(tokens[index], 'Git status source path'));
    }
  }
  return [...new Set(paths)].sort();
}

function nativeGitSnapshot(repositoryRoot) {
  const head = runGit(repositoryRoot, ['rev-parse', 'HEAD']).stdout.toString('utf8').trim();
  const tree = runGit(repositoryRoot, ['rev-parse', 'HEAD^{tree}']).stdout.toString('utf8').trim();
  if (!GIT_OID_PATTERN.test(head) || !GIT_OID_PATTERN.test(tree)) {
    fail('GIT_EVIDENCE_INVALID', 'Git HEAD or tree identity is malformed');
  }
  const refResult = runGit(repositoryRoot, ['symbolic-ref', '--short', '-q', 'HEAD'], { allowNonzero: true });
  const ref = refResult.status === 0 ? refResult.stdout.toString('utf8').trim() : 'DETACHED';
  const indexEntries = parseIndexEntries(runGit(repositoryRoot, ['ls-files', '--stage', '-z']).stdout);
  const paths = splitNul(runGit(repositoryRoot, [
    'ls-files', '-z', '--cached', '--others', '--exclude-standard',
  ]).stdout).map((path) => normalizePath(path, 'Git visible path')).sort();
  const statusBytes = runGit(repositoryRoot, [
    'status', '--porcelain=v1', '-z', '--untracked-files=all',
  ]).stdout;
  return {
    head,
    tree,
    ref,
    indexEntries,
    paths: [...new Set(paths)],
    dirtyPaths: parseDirtyPaths(statusBytes),
    statusDigest: digestBytes(statusBytes),
  };
}

function pathWithin(root, candidate, label) {
  const child = relative(root, candidate);
  if (child.startsWith('..') || isAbsolute(child)) fail('PATH_ESCAPE', `${label} resolves outside its repository`);
}

function selectRule(repository, path, tracked) {
  const rule = repository.rules.find((candidate) => matchesAny(path, candidate.patterns));
  if (!rule || (!tracked && !rule.allowUntracked)) {
    fail('UNMAPPED_PATH', `Source path ${repository.repositoryId}:${path} has no admitted role`, {
      repositoryId: repository.repositoryId,
      path,
      tracked,
    });
  }
  return rule;
}

function collectSourceInventory({
  registry,
  workspaceRoot,
  snapshotProvider = nativeGitSnapshot,
  shouldInterrupt = () => false,
  expectedHeads = {},
}) {
  validateSourceRoleRegistry(registry);
  const workspace = realpathSync(workspaceRoot);
  const workspaceParent = realpathSync(resolve(workspace, '..'));
  const repositories = [];
  let visitedFiles = 0;
  for (const repository of registry.repositories) {
    const repositoryRoot = realpathSync(resolve(workspace, repository.root));
    pathWithin(workspaceParent, repositoryRoot, `Repository ${repository.repositoryId}`);
    const snapshot = snapshotProvider(repositoryRoot, repository.repositoryId);
    if (!snapshot || !GIT_OID_PATTERN.test(snapshot.head) || !GIT_OID_PATTERN.test(snapshot.tree)) {
      fail('GIT_EVIDENCE_INVALID', `Repository ${repository.repositoryId} has invalid Git identity`);
    }
    if (
      !Array.isArray(snapshot.paths) || !Array.isArray(snapshot.indexEntries)
      || !Array.isArray(snapshot.dirtyPaths) || typeof snapshot.statusDigest !== 'string'
    ) fail('GIT_EVIDENCE_INVALID', `Repository ${repository.repositoryId} has incomplete Git evidence`);
    if (expectedHeads[repository.repositoryId] && expectedHeads[repository.repositoryId] !== snapshot.head) {
      fail('GIT_HEAD_CONFLICT', `Repository ${repository.repositoryId} HEAD conflicts with the admitted head`, {
        expected: expectedHeads[repository.repositoryId],
        observed: snapshot.head,
      });
    }
    const indexByPath = new Map(snapshot.indexEntries.map((entry) => [entry.path, entry]));
    const files = [];
    const protectedExclusions = [];
    for (const path of [...new Set(snapshot.paths)].sort()) {
      if (matchesAny(path, registry.protectedPaths)) {
        protectedExclusions.push(path);
        continue;
      }
      const tracked = indexByPath.has(path);
      const rule = selectRule(repository, path, tracked);
      const candidate = resolve(repositoryRoot, path);
      pathWithin(repositoryRoot, candidate, `Source path ${repository.repositoryId}:${path}`);
      let stat;
      try {
        stat = lstatSync(candidate);
      } catch (error) {
        fail('MISSING_PATH', `Source path ${repository.repositoryId}:${path} is missing`, { cause: error.code });
      }
      if (stat.isSymbolicLink()) fail('SYMLINK_PATH', 'Source inventory does not follow symbolic links', { path });
      if (!stat.isFile()) fail('UNSUPPORTED_PATH', 'Source inventory accepts regular files only', { path });
      pathWithin(repositoryRoot, realpathSync(candidate), `Resolved source path ${repository.repositoryId}:${path}`);
      visitedFiles += 1;
      if (shouldInterrupt({ repositoryId: repository.repositoryId, path, visitedFiles })) {
        fail('INTERRUPTED', 'Source inventory was interrupted before completion', {
          partialEvidence: {
            complete: false,
            interrupted: true,
            repositoriesCompleted: repositories.length,
            filesCompleted: files.length,
          },
        });
      }
      const contentDigest = digestBytes(readFileSync(candidate));
      const indexEntry = indexByPath.get(path);
      files.push({
        path,
        roleId: rule.roleId,
        identity: rule.identity,
        tracked,
        indexMode: indexEntry ? indexEntry.mode : null,
        indexOid: indexEntry ? indexEntry.oid : null,
        contentDigest,
      });
    }
    const roleIds = [...new Set(repository.rules.map((rule) => rule.roleId))].sort();
    const roles = roleIds.map((roleId) => {
      const roleFiles = files.filter((file) => file.roleId === roleId);
      const rule = repository.rules.find((candidate) => candidate.roleId === roleId);
      return {
        roleId,
        identity: rule.identity,
        fileCount: roleFiles.length,
        contentDigest: digestCanonical(roleFiles.map(({ path, contentDigest }) => ({ path, contentDigest }))),
      };
    });
    repositories.push({
      repositoryId: repository.repositoryId,
      head: snapshot.head,
      tree: snapshot.tree,
      ref: snapshot.ref,
      clean: snapshot.dirtyPaths.filter((path) => !matchesAny(path, registry.protectedPaths)).length === 0,
      dirtyPaths: snapshot.dirtyPaths.filter((path) => !matchesAny(path, registry.protectedPaths)).sort(),
      statusDigest: digestCanonical(snapshot.dirtyPaths
        .filter((path) => !matchesAny(path, registry.protectedPaths)).sort()),
      indexDigest: digestCanonical(files
        .filter((file) => file.tracked)
        .map(({ path, indexMode, indexOid }) => ({ path, indexMode, indexOid }))),
      protectedExclusions,
      roles,
      files,
    });
  }
  const roleMaterial = (identity) => repositories.flatMap((repository) => repository.roles
    .filter((role) => registry.identityRoleMap[identity].includes(role.roleId))
    .map((role) => ({
      repositoryId: repository.repositoryId,
      roleId: role.roleId,
      fileCount: role.fileCount,
      contentDigest: role.contentDigest,
    })));
  const artifact = {
    schemaVersion: SOURCE_INVENTORY_VERSION,
    inventoryId: 'pending',
    registry: {
      registryId: registry.registryId,
      schemaVersion: registry.schemaVersion,
      contentDigest: registry.contentDigest,
    },
    complete: true,
    interrupted: false,
    repositories,
    identityDigests: {
      productCandidateId: digestCanonical(roleMaterial('productCandidateId')),
      harnessVersion: digestCanonical(roleMaterial('harnessVersion')),
      testPackVersions: digestCanonical(roleMaterial('testPackVersions')),
    },
  };
  artifact.inventoryId = `source-inventory:${digestCanonical({
    registry: artifact.registry,
    repositories: artifact.repositories,
    identityDigests: artifact.identityDigests,
  })}`;
  artifact.contentDigest = computeArtifactDigest(artifact);
  return Object.freeze(structuredClone(artifact));
}

function validateSourceInventory(inventory) {
  assertExactKeys(inventory, [
    'schemaVersion', 'inventoryId', 'registry', 'complete', 'interrupted',
    'repositories', 'identityDigests', 'contentDigest',
  ], [], 'source inventory');
  if (inventory.schemaVersion !== SOURCE_INVENTORY_VERSION) fail('UNSUPPORTED_VERSION', 'Source inventory version is unsupported');
  if (inventory.complete !== true || inventory.interrupted !== false) {
    fail('PARTIAL_EVIDENCE', 'Source inventory is incomplete or interrupted');
  }
  assertExactKeys(inventory.registry, ['registryId', 'schemaVersion', 'contentDigest'], [], 'source inventory.registry');
  assertDigest(inventory.registry.contentDigest, 'source inventory.registry.contentDigest');
  assertExactKeys(inventory.identityDigests, ROLE_IDENTITIES, [], 'source inventory.identityDigests');
  ROLE_IDENTITIES.forEach((identity) => {
    if (!DIGEST_PATTERN.test(inventory.identityDigests[identity])) fail('INVALID_DIGEST', `${identity} digest is invalid`);
  });
  if (!Array.isArray(inventory.repositories) || inventory.repositories.length !== 3) {
    fail('REGISTRY_SCOPE_CONFLICT', 'Source inventory does not contain three repositories');
  }
  const repositoryIds = [];
  inventory.repositories.forEach((repository, repositoryIndex) => {
    assertExactKeys(repository, [
      'repositoryId', 'head', 'tree', 'ref', 'clean', 'dirtyPaths', 'statusDigest',
      'indexDigest', 'protectedExclusions', 'roles', 'files',
    ], [], `source inventory.repositories[${repositoryIndex}]`);
    if (!GIT_OID_PATTERN.test(repository.head) || !GIT_OID_PATTERN.test(repository.tree)) {
      fail('GIT_EVIDENCE_INVALID', 'Source inventory repository Git identity is malformed');
    }
    if (typeof repository.ref !== 'string' || typeof repository.clean !== 'boolean') {
      fail('INVALID_VALUE', 'Source inventory repository state is malformed');
    }
    if (
      !DIGEST_PATTERN.test(repository.statusDigest) || !DIGEST_PATTERN.test(repository.indexDigest)
      || !Array.isArray(repository.dirtyPaths) || !Array.isArray(repository.protectedExclusions)
      || !Array.isArray(repository.roles) || !Array.isArray(repository.files)
    ) fail('INVALID_SHAPE', 'Source inventory repository collections or digests are malformed');
    repositoryIds.push(repository.repositoryId);
    repository.files.forEach((file, fileIndex) => {
      assertExactKeys(file, [
        'path', 'roleId', 'identity', 'tracked', 'indexMode', 'indexOid', 'contentDigest',
      ], [], `source inventory.repositories[${repositoryIndex}].files[${fileIndex}]`);
      normalizePath(file.path, 'source inventory file path');
      if (!ROLE_IDENTITIES.includes(file.identity) || typeof file.roleId !== 'string') {
        fail('INVALID_VALUE', 'Source inventory file role is malformed');
      }
      if (typeof file.tracked !== 'boolean' || !DIGEST_PATTERN.test(file.contentDigest)) {
        fail('INVALID_VALUE', 'Source inventory file tracking or digest is malformed');
      }
      if (file.tracked && (!/^[0-7]{6}$/u.test(file.indexMode) || !GIT_OID_PATTERN.test(file.indexOid))) {
        fail('GIT_EVIDENCE_INVALID', 'Tracked source inventory file lacks valid index evidence');
      }
      if (!file.tracked && (file.indexMode !== null || file.indexOid !== null)) {
        fail('GIT_EVIDENCE_INVALID', 'Untracked source inventory file has index evidence');
      }
    });
  });
  if (repositoryIds.slice().sort().join(',') !== 'admin,portal,shared') {
    fail('REGISTRY_SCOPE_CONFLICT', 'Source inventory repository identities conflict with the registry');
  }
  const expectedId = `source-inventory:${digestCanonical({
    registry: inventory.registry,
    repositories: inventory.repositories,
    identityDigests: inventory.identityDigests,
  })}`;
  if (inventory.inventoryId !== expectedId) fail('STALE_INVENTORY', 'Source inventory ID is stale');
  assertContentDigest(inventory, 'source inventory');
  return inventory;
}

module.exports = {
  SOURCE_INVENTORY_VERSION,
  SOURCE_ROLE_REGISTRY_VERSION,
  SourceInventoryError,
  collectSourceInventory,
  globPattern,
  loadSourceRoleRegistry,
  matchesAny,
  nativeGitSnapshot,
  normalizePath,
  validateSourceInventory,
  validateSourceRoleRegistry,
};
