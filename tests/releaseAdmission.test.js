const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  buildActiveReleasePointer,
  buildImmutableArtifactRecord,
  buildPreflightPlan,
  createReleaseDescriptor,
  validatePrebuiltBuild,
  writeBuildManifest,
} = require('../scripts/lib/releaseAdmission');
const {
  assertArchiveContains,
  createZipFromDirectory,
} = require('../scripts/path-deploy');

const ownedTempRoots = new Set();

function createOwnedTempRoot(prefix) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  ownedTempRoots.add(root);
  return root;
}

function removeOwnedTempRoots() {
  const roots = [...ownedTempRoots];
  roots.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
  const residue = roots.filter(root => fs.existsSync(root));
  roots.filter(root => !fs.existsSync(root)).forEach(root => ownedTempRoots.delete(root));
  return residue;
}

function makeRepo(buildInfo = {}) {
  const root = createOwnedTempRoot('path-release-admission-');
  fs.mkdirSync(path.join(root, 'src', 'generated'), { recursive: true });
  fs.mkdirSync(path.join(root, 'build', 'static'), { recursive: true });
  const info = {
    packageVersion: '1.0.0',
    releaseId: 'release-1',
    buildTarget: 'production',
    gitCommit: 'abc123',
    gitDirty: false,
    ...buildInfo,
  };
  fs.writeFileSync(path.join(root, 'src', 'generated', 'buildInfo.js'), `const buildInfo = ${JSON.stringify(info, null, 2)};\n\nexport default buildInfo;\n`);
  fs.writeFileSync(path.join(root, 'build', 'static', 'main.js'), 'compiled application');
  return root;
}

describe('release admission', () => {
  afterEach(() => {
    expect(removeOwnedTempRoots()).toEqual([]);
  });

  test('accepts only an exact, untampered prebuilt production tree', () => {
    const root = makeRepo();
    writeBuildManifest({ repoRoot: root });
    expect(validatePrebuiltBuild({
      repoRoot: root,
      expected: { buildTarget: 'production', releaseId: 'release-1', gitCommit: 'abc123' },
    }).assets.fileCount).toBe(1);
    fs.appendFileSync(path.join(root, 'build', 'static', 'main.js'), 'tampered');
    expect(() => validatePrebuiltBuild({
      repoRoot: root,
      expected: { buildTarget: 'production', releaseId: 'release-1', gitCommit: 'abc123' },
    })).toThrow('checksum mismatch');
  });

  test.each([
    ['wrong target', { buildTarget: 'test' }, 'build target mismatch'],
    ['stale release', { releaseId: 'old-release' }, 'release ID mismatch'],
    ['wrong commit', { gitCommit: 'old-commit' }, 'Git commit mismatch'],
    ['dirty build', { gitDirty: true }, 'dirty source tree'],
  ])('rejects %s', (_label, buildInfo, expectedError) => {
    const root = makeRepo(buildInfo);
    writeBuildManifest({ repoRoot: root });
    expect(() => validatePrebuiltBuild({
      repoRoot: root,
      expected: { buildTarget: 'production', releaseId: 'release-1', gitCommit: 'abc123' },
    })).toThrow(expectedError);
  });

  test('preflight scope covers both apps when shared runtime is released', () => {
    expect(buildPreflightPlan({ deployAdmin: false, deployPortal: false, deployShared: true }).map(check => check.id)).toEqual([
      'admin-tests',
      'admin-lint',
      'portal-tests',
      'portal-lint',
      'privacy-routes',
    ]);
  });

  test('the orchestrator consumes qualification and preflight before every mutation boundary', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const runStart = source.indexOf('async function handleRun');
    const qualification = source.indexOf("'release.qualification'", runStart);
    const preflight = source.indexOf("'release.preflight'", runStart);
    expect(qualification).toBeGreaterThan(runStart);
    expect(preflight).toBeGreaterThan(qualification);
    ['db.restore-point', 'test-db.refresh', 'schema.apply', 'data.apply', 'app.deploy'].forEach(step => {
      expect(source.indexOf(`'${step}'`, runStart)).toBeGreaterThan(preflight);
    });
  });

  test('TEST and PROD artifact staging writes release qualification provenance', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    expect(source).toContain('writeStagingReleaseProvenance');
    expect(source).toContain('.path-release-provenance.json');
    expect(source).toContain('qualificationEvidenceId');
    expect(source).toContain("'privacy-route-denial-smoke.js'");
  });

  test('archive-content preflight verifies required runtime and smoke scripts before upload', async () => {
    const temp = createOwnedTempRoot('path-archive-preflight-');
    const staging = path.join(temp, 'staging');
    const archive = path.join(temp, 'artifact.zip');
    fs.mkdirSync(path.join(staging, 'scripts', 'lib'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'scripts', 'smoke.js'), 'smoke');
    fs.writeFileSync(path.join(staging, 'scripts', 'lib', 'guard.js'), 'guard');
    await createZipFromDirectory(staging, archive);

    expect(assertArchiveContains(
      archive,
      ['scripts/smoke.js', 'scripts/lib/guard.js'],
      'fixture'
    )).toEqual(expect.objectContaining({ status: 'passed', component: 'fixture' }));
    expect(() => assertArchiveContains(
      archive,
      ['scripts/missing-runtime.js'],
      'fixture'
    )).toThrow('missing required runtime/test content');
  });

  test('TEST portal preflight builds outside tracked portal output and cleans it after the run', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const prepareStart = source.indexOf('function preparePortalFrontendBuild');
    const prepareEnd = source.indexOf('function joinS3Key', prepareStart);
    const prepareSource = source.slice(prepareStart, prepareEnd);
    expect(prepareSource).toContain("path.join(REPO_ROOT, 'tmp', 'path-deploy-builds'");
    expect(prepareSource).toContain('BUILD_PATH: buildPath');
    expect(prepareSource).not.toContain("removePath(path.join(PORTAL_ROOT, 'build-test'))");

    const deployStart = source.indexOf('async function deployPortalToTestNative');
    const deployEnd = source.indexOf('async function deploySharedToProdNative', deployStart);
    expect(source.slice(deployStart, deployEnd)).toContain("copyDirectoryIfExists(buildPath, path.join(stagingPath, 'build'))");

    const runStart = source.indexOf('async function handleRun');
    const runEnd = source.indexOf('async function handleSmoke', runStart);
    expect(source.slice(runStart, runEnd)).toContain('finally {\n    cleanupPreparedBuilds(args);');
  });

  test('immutable staging and a complete descriptor precede a production refresh', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const deployStart = source.indexOf('async function deployProdApplicationsNative');
    const descriptor = source.indexOf('uploadProdReleaseDescriptor', deployStart);
    const refresh = source.indexOf('startProdInstanceRefresh', deployStart);
    expect(source.indexOf('immutableKey', deployStart)).toBeGreaterThan(deployStart);
    expect(descriptor).toBeGreaterThan(deployStart);
    expect(refresh).toBeGreaterThan(descriptor);
  });

  test('an interrupted staging set cannot produce an active release pointer', () => {
    const temp = createOwnedTempRoot('path-artifact-');
    const archive = path.join(temp, 'admin.zip');
    fs.writeFileSync(archive, 'immutable admin archive');
    const admin = buildImmutableArtifactRecord({ component: 'admin', releaseId: 'release-1', archivePath: archive });
    expect(admin.key).toMatch(/^releases\/release-1\/admin\/admin-[a-f0-9]{64}\.zip$/u);
    expect(() => createReleaseDescriptor({
      releaseId: 'release-1',
      environment: 'prod',
      requiredComponents: ['admin', 'portal'],
      artifacts: { admin },
      source: {},
      preflight: {},
    })).toThrow('missing portal');
  });

  test('rollback selects a complete immutable descriptor rather than reconstructing artifacts', () => {
    const artifacts = {
      admin: { key: 'releases/release-0/admin/admin-a.zip', sha256: 'a' },
      portal: { key: 'releases/release-0/portal/portal-b.zip', sha256: 'b' },
    };
    const descriptor = createReleaseDescriptor({
      releaseId: 'release-0',
      environment: 'prod',
      requiredComponents: ['admin', 'portal'],
      artifacts,
      source: { admin: 'commit-a', portal: 'commit-b' },
      preflight: { evidenceId: 'proof-0' },
    });
    expect(buildActiveReleasePointer(descriptor)).toEqual({
      schemaVersion: 1,
      releaseId: 'release-0',
      descriptorKey: 'releases/release-0/release-descriptor.json',
      descriptorSha256: descriptor.descriptorSha256,
    });
  });
});
