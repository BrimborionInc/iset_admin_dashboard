'use strict';

const assert = require('node:assert/strict');
const {
  cpSync, existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, realpathSync,
  rmSync, symlinkSync, writeFileSync,
} = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
  canonicalize, computeArtifactDigest, digestBytes, digestCanonical, parseStrictJson,
} = require('../src/canonical-json');
const {
  SourceInventoryError, collectSourceInventory, loadSourceRoleRegistry,
  validateSourceInventory, validateSourceRoleRegistry,
} = require('../src/source-inventory');
const {
  compareSourceStability, validateSourceStability, validateSourceStabilityPack,
} = require('../src/source-stability');

const qualificationRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(qualificationRoot, '..');
const fixtureRoot = path.join(__dirname, 'fixtures', 'source-state');
const registryPath = path.join(qualificationRoot, 'registries', 'phase3-source-roles.registry.json');
const packPath = path.join(qualificationRoot, 'packs', 'candidate-source-stability.pack.json');
const cliPath = path.join(qualificationRoot, 'bin', 'rq-source-state.js');
const OID_A = 'a'.repeat(40);
const OID_B = 'b'.repeat(40);

function refreshDigest(value) {
  const copy = structuredClone(value);
  copy.contentDigest = { algorithm: 'sha256', value: '0'.repeat(64) };
  copy.contentDigest = computeArtifactDigest(copy);
  return copy;
}

function sourceRegistry() {
  return loadSourceRoleRegistry(registryPath);
}

function syntheticRegistry() {
  const registry = structuredClone(sourceRegistry());
  const roots = { admin: 'admin', portal: 'portal', shared: 'shared' };
  registry.repositories.forEach((repository) => {
    repository.root = roots[repository.repositoryId];
  });
  return refreshDigest(registry);
}

function createWorkspace(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'rq-source-state-'));
  cpSync(fixtureRoot, root, { recursive: true });
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    assert.equal(existsSync(root), false, 'synthetic source-state workspace must be removed');
  });
  return root;
}

function walk(root, current = '') {
  const entries = [];
  for (const name of readdirSync(path.join(root, current)).sort()) {
    if (name === '.git') continue;
    const relativePath = current ? `${current}/${name}` : name;
    const stat = lstatSync(path.join(root, relativePath));
    if (stat.isDirectory()) entries.push(...walk(root, relativePath));
    else entries.push(relativePath);
  }
  return entries;
}

function snapshotProvider(options = {}) {
  return (root, repositoryId) => {
    const paths = options.paths?.[repositoryId] || walk(root);
    const untracked = new Set(options.untracked?.[repositoryId] || []);
    return {
      head: options.head?.[repositoryId] || OID_A,
      tree: options.tree?.[repositoryId] || OID_B,
      ref: options.ref?.[repositoryId] || 'main',
      paths,
      dirtyPaths: options.dirty?.[repositoryId] || [],
      statusDigest: digestCanonical(options.dirty?.[repositoryId] || []),
      indexEntries: paths.filter((entry) => !untracked.has(entry)).map((entry) => ({
        mode: '100644',
        oid: digestBytes(entry),
        stage: '0',
        path: entry,
      })),
    };
  };
}

function inventory(root, options = {}) {
  return collectSourceInventory({
    registry: options.registry || syntheticRegistry(),
    workspaceRoot: root,
    snapshotProvider: options.snapshotProvider || snapshotProvider(options),
    shouldInterrupt: options.shouldInterrupt,
    expectedHeads: options.expectedHeads,
  });
}

function assertOnlyIdentityChanged(before, after, identity) {
  for (const candidate of ['productCandidateId', 'harnessVersion', 'testPackVersions']) {
    assert.equal(
      before.identityDigests[candidate] === after.identityDigests[candidate],
      candidate !== identity,
      `${candidate} changed contrary to its declared role`,
    );
  }
}

function runGit(cwd, args) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', shell: false });
  assert.equal(result.status, 0, result.stderr || `git ${args[0]} failed`);
}

function initializeGitWorkspace(root) {
  for (const repositoryId of ['admin', 'portal', 'shared']) {
    const cwd = path.join(root, repositoryId);
    runGit(cwd, ['init', '-q']);
    runGit(cwd, ['config', 'user.name', 'Qualification Fixture']);
    runGit(cwd, ['config', 'user.email', 'qualification-fixture@example.invalid']);
    runGit(cwd, ['add', '.']);
    runGit(cwd, ['commit', '-q', '-m', 'synthetic source state']);
  }
}

test('source pack and role registry are strict, advisory, and preserve the five-pack control plane', () => {
  const registry = sourceRegistry();
  const pack = parseStrictJson(readFileSync(packPath));
  assert.equal(validateSourceStabilityPack(pack, registry), pack);
  assert.deepEqual(registry.repositories.map(({ repositoryId }) => repositoryId), ['admin', 'portal', 'shared']);
  assert.deepEqual(registry.protectedPaths, ['sql/ops/prod-feedback-180-181-*20260810.sql']);
  assert.equal(pack.releaseAuthority, 'none');
  assert.deepEqual(pack.coverage.openNoLossObligations, ['RN02', 'RN04']);

  const activeRegistry = parseStrictJson(readFileSync(path.join(
    qualificationRoot, 'registries', 'phase3-read-only.registry.json',
  )));
  assert.deepEqual(activeRegistry.packs.map(({ packId }) => packId), [
    'ai-guidance-contract',
    'privacy-route-static',
    'admin-lint',
    'portal-lint',
    'admin-aggregate',
  ]);
  assert.equal(activeRegistry.releaseAuthority, 'none');
});

test('ten frozen inventories and five direct/advisory pairs are canonical and identical', (t) => {
  const root = createWorkspace(t);
  const runs = Array.from({ length: 10 }, () => inventory(root));
  runs.forEach((result) => {
    assert.equal(validateSourceInventory(result), result);
    assert.equal(canonicalize(result), canonicalize(runs[0]));
  });
  for (let index = 0; index < 5; index += 1) {
    const direct = inventory(root);
    const advisory = inventory(root);
    assert.equal(canonicalize(direct), canonicalize(advisory));
    const stability = compareSourceStability(direct, advisory, {
      expectedBaselineId: direct.inventoryId,
    });
    assert.equal(validateSourceStability(stability).status, 'stable');
  }
});

test('product, harness, pack, migration, generated, and dependency changes remain identity-separated', (t) => {
  const root = createWorkspace(t);
  const baseline = inventory(root);
  const cases = [
    ['admin/src/app.js', 'productCandidateId'],
    ['admin/qualification/src/kernel.js', 'harnessVersion'],
    ['admin/qualification/packs/example.pack.json', 'testPackVersions'],
    ['admin/sql/migrations/001.marker', 'productCandidateId'],
    ['admin/src/generated/build.js', 'productCandidateId'],
    ['admin/package-lock.json', 'productCandidateId'],
  ];
  for (const [relativePath, identity] of cases) {
    const absolutePath = path.join(root, relativePath);
    const original = readFileSync(absolutePath);
    writeFileSync(absolutePath, Buffer.concat([original, Buffer.from('\nmutation')]));
    const changed = inventory(root);
    assertOnlyIdentityChanged(baseline, changed, identity);
    assert.equal(compareSourceStability(baseline, changed).status, 'drifted');
    writeFileSync(absolutePath, original);
  }
  assert.equal(canonicalize(inventory(root)), canonicalize(baseline));
});

test('stability reports exact drift, dirty roles, and Git provenance without conflating identity', (t) => {
  const root = createWorkspace(t);
  const baseline = inventory(root);
  writeFileSync(path.join(root, 'admin', 'qualification', 'src', 'kernel.js'), 'changed harness byte\n');
  const observed = inventory(root, {
    dirty: { admin: ['qualification/src/kernel.js'] },
    head: { admin: 'c'.repeat(40) },
  });
  const result = compareSourceStability(baseline, observed);
  assert.equal(result.status, 'drifted');
  assert.deepEqual(result.affectedIdentities, ['harnessVersion']);
  assert.deepEqual(result.fileChanges.map(({ path: changedPath }) => changedPath), [
    'qualification/src/kernel.js',
  ]);
  assert.deepEqual(result.dirtyRepositories, [{
    repositoryId: 'admin',
    dirtyPaths: ['qualification/src/kernel.js'],
  }]);
  assert.equal(result.repositoryChanges[0].afterHead, 'c'.repeat(40));
});

test('scope admission rejects missing, symlinked, escaping, unmapped, stale, and conflicting inputs', (t) => {
  const root = createWorkspace(t);
  const basePaths = {
    admin: walk(path.join(root, 'admin')),
    portal: walk(path.join(root, 'portal')),
    shared: walk(path.join(root, 'shared')),
  };
  assert.throws(() => inventory(root, {
    paths: { ...basePaths, admin: [...basePaths.admin, 'missing.js'] },
  }), (error) => error instanceof SourceInventoryError && error.code === 'MISSING_PATH');

  symlinkSync(path.join(root, 'admin', 'src', 'app.js'), path.join(root, 'admin', 'linked.js'));
  assert.throws(() => inventory(root), (error) => error.code === 'SYMLINK_PATH');
  rmSync(path.join(root, 'admin', 'linked.js'));

  assert.throws(() => inventory(root, {
    paths: { ...basePaths, admin: [...basePaths.admin, '../escape'] },
  }), (error) => error.code === 'PATH_ESCAPE');

  writeFileSync(path.join(root, 'admin', 'unmapped-product.js'), 'untracked\n');
  assert.throws(() => inventory(root, {
    untracked: { admin: ['unmapped-product.js'] },
  }), (error) => error.code === 'UNMAPPED_PATH');
  rmSync(path.join(root, 'admin', 'unmapped-product.js'));

  assert.throws(() => inventory(root, {
    expectedHeads: { admin: 'd'.repeat(40) },
  }), (error) => error.code === 'GIT_HEAD_CONFLICT');

  const staleRegistry = structuredClone(syntheticRegistry());
  staleRegistry.authority.currentGateAuthority = 'changed';
  assert.throws(() => validateSourceRoleRegistry(staleRegistry), (error) => error.code === 'AUTHORITY_CONFLICT');

  const conflictRegistry = structuredClone(syntheticRegistry());
  conflictRegistry.identityRoleMap.harnessVersion.push('product');
  conflictRegistry.contentDigest = computeArtifactDigest(conflictRegistry);
  assert.throws(() => validateSourceRoleRegistry(conflictRegistry), (error) => error.code === 'ROLE_CONFLICT');
});

test('protected paths are excluded before byte access and cannot influence an identity', (t) => {
  const root = createWorkspace(t);
  const basePaths = {
    admin: walk(path.join(root, 'admin')),
    portal: walk(path.join(root, 'portal')),
    shared: walk(path.join(root, 'shared')),
  };
  const protectedPath = 'sql/ops/prod-feedback-180-181-synthetic-20260810.sql';
  const baseline = inventory(root);
  const excluded = inventory(root, {
    paths: { ...basePaths, admin: [...basePaths.admin, protectedPath] },
  });
  assert.deepEqual(excluded.repositories[0].protectedExclusions, [protectedPath]);
  assert.deepEqual(excluded.identityDigests, baseline.identityDigests);
  assert.equal(excluded.repositories[0].files.some(({ path: filePath }) => filePath === protectedPath), false);
});

test('reordered JSON remains canonical while interruption, partial, stale, and conflicting evidence fails closed', (t) => {
  const root = createWorkspace(t);
  const registry = syntheticRegistry();
  const reordered = Object.fromEntries(Object.entries(registry).reverse());
  assert.equal(validateSourceRoleRegistry(reordered), reordered);
  assert.equal(canonicalize(reordered), canonicalize(registry));

  assert.throws(() => inventory(root, {
    shouldInterrupt: ({ visitedFiles }) => visitedFiles === 3,
  }), (error) => error.code === 'INTERRUPTED' && error.details.partialEvidence.complete === false);

  const baseline = inventory(root);
  const partial = structuredClone(baseline);
  partial.complete = false;
  partial.interrupted = true;
  partial.contentDigest = computeArtifactDigest(partial);
  assert.throws(() => validateSourceInventory(partial), (error) => error.code === 'PARTIAL_EVIDENCE');
  assert.throws(() => compareSourceStability(baseline, baseline, {
    expectedBaselineId: 'source-inventory:stale',
  }), (error) => error.code === 'STALE_BASELINE');

  const stale = structuredClone(baseline);
  stale.repositories[0].files[0].contentDigest = 'f'.repeat(64);
  assert.throws(() => validateSourceInventory(stale), (error) => (
    error.code === 'STALE_INVENTORY' || error.code === 'STALE_DIGEST'
  ));

  const otherRegistry = structuredClone(registry);
  otherRegistry.repositories[0].rules[0].patterns = [...otherRegistry.repositories[0].rules[0].patterns].reverse();
  otherRegistry.contentDigest = computeArtifactDigest(otherRegistry);
  const conflicting = inventory(root, { registry: otherRegistry });
  assert.throws(() => compareSourceStability(baseline, conflicting), (error) => error.code === 'REGISTRY_CONFLICT');
});

test('standalone direct inventory and verify commands match the in-process advisory boundary', (t) => {
  const root = createWorkspace(t);
  initializeGitWorkspace(root);
  const registry = syntheticRegistry();
  const temporaryRegistryPath = path.join(root, 'source-roles.registry.json');
  const baselinePath = path.join(root, 'baseline.json');
  writeFileSync(temporaryRegistryPath, `${canonicalize(registry)}\n`);

  let first;
  for (let index = 0; index < 5; index += 1) {
    const direct = spawnSync(process.execPath, [
      cliPath, 'inventory', '--registry', temporaryRegistryPath, '--workspace-root', root,
    ], { cwd: repositoryRoot, encoding: 'utf8', shell: false, timeout: 10000 });
    assert.equal(direct.status, 0, direct.stderr);
    const directInventory = validateSourceInventory(parseStrictJson(direct.stdout));
    const advisoryInventory = collectSourceInventory({ registry, workspaceRoot: root });
    assert.equal(canonicalize(directInventory), canonicalize(advisoryInventory));
    first ||= directInventory;
  }
  writeFileSync(baselinePath, `${canonicalize(first)}\n`);
  const verified = spawnSync(process.execPath, [
    cliPath, 'verify', '--registry', temporaryRegistryPath, '--baseline', baselinePath,
    '--workspace-root', root,
  ], { cwd: repositoryRoot, encoding: 'utf8', shell: false, timeout: 10000 });
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(validateSourceStability(parseStrictJson(verified.stdout)).status, 'stable');
});
