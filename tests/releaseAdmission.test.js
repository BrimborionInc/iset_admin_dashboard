const fs = require('fs');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  buildActiveReleasePointer,
  buildImmutableArtifactRecord,
  buildPreflightPlan,
  createReleaseDescriptor,
  validatePrebuiltBuild,
  writeBuildManifest,
} = require('../scripts/lib/releaseAdmission');
const {
  ADMIN_ENVIRONMENT_CONTRACTS,
  adminDeployConfigEvidence,
  assertAdminDeployConfigSourceUnchanged,
  assertDeploySourceState,
  assertArchiveContains,
  assertArchiveExcludesPrefixes,
  assertArchiveScriptAllowlist,
  assertSafeReleaseId,
  assertStagedArtifactUnchanged,
  buildAdminTestRemoteCommands,
  buildGitRepoState,
  buildReleaseId,
  buildVerifiedS3ArtifactCopyArgs,
  buildPortalTestRemoteCommands,
  buildRemoteServiceHealthCommands,
  buildTestAtomicPrepareCommands,
  buildTestAtomicCutoverCommands,
  buildTestExactPostflightCommands,
  buildTestRecoveryCommands,
  captureAdminDeployConfig,
  copyAdminRuntimeSql,
  copyAdmittedGitSourceDirectory,
  copyValidatedFrontendBuild,
  createIsolatedFrontendBuildProject,
  createZipFromDirectory,
  getEnvironmentConfig,
  parseArgs,
  promoteTestArtifactsAfterSmoke,
  runJsonNodeScript,
  assertTestRuntimeSmokeRequired,
  validateQualificationModeArgs,
} = require('../scripts/path-deploy');

function makeRepo(buildInfo = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-release-admission-'));
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
  const cleanRepoState = (repoPath, head) => {
    const leaf = path.basename(repoPath);
    const expectedLeaf = leaf === 'admin'
      ? 'admin-dashboard'
      : (leaf === 'portal' ? 'ISET-intake' : 'shared');
    const exactPath = path.join(path.dirname(repoPath), expectedLeaf);
    return ({
    path: exactPath,
    gitTopLevel: exactPath,
    repositoryValid: true,
    repositoryProofErrors: [],
    gitHead: head,
    gitDetached: true,
    gitBranch: null,
    gitSpecialIndexFlagCount: 0,
    gitSpecialIndexFlags: [],
    treeFingerprint: `${head}-fingerprint`,
    gitDirty: false,
    gitStatusCount: 0,
    gitStatus: [],
  });
  };

  const makeAdminConfigFixture = (environment = 'test') => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admin-config-fixture-'));
    const filename = path.join(root, `admin-${environment}.env`);
    const secretFixture = environment === 'test'
      ? { DB_PASS: 'fixture-password', AWS_ACCESS_KEY_ID: 'FIXTUREACCESS', AWS_SECRET_ACCESS_KEY: 'fixture-secret' }
      : {};
    const content = `${Object.entries({ ...ADMIN_ENVIRONMENT_CONTRACTS[environment], ...secretFixture })
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`;
    fs.writeFileSync(filename, content, { mode: 0o600 });
    return {
      root,
      filename,
      sha256: crypto.createHash('sha256').update(content).digest('hex'),
    };
  };

  test('release IDs and AWS regions reject path and shell syntax at the CLI boundary', () => {
    expect(assertSafeReleaseId('20260825-signing-lineage-r2')).toBe('20260825-signing-lineage-r2');
    expect(buildReleaseId({ releaseId: 'release_2.1' })).toBe('release_2.1');
    for (const releaseId of [
      'release with spaces',
      'release;touch-bad',
      '../release',
      '.hidden-release',
      `r${'x'.repeat(128)}`,
    ]) {
      expect(() => buildReleaseId({ releaseId })).toThrow('--release-id');
    }
    expect(getEnvironmentConfig({ env: 'test', region: 'ca-central-1' }).region).toBe('ca-central-1');
    for (const region of ['ca-central-1;touch-bad', 'ca central 1', '../region']) {
      expect(() => getEnvironmentConfig({ env: 'test', region })).toThrow('--region');
    }
  });

  test('nonzero JSON child results preserve structured failure evidence for the release manifest', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-json-child-failure-'));
    const child = path.join(root, 'failing-child.js');
    fs.writeFileSync(child, [
      "require('fs').writeSync(1, JSON.stringify({ status: 'failed', error: { message: 'bounded migration failed', code: 'fixture_failure' }, command: { status: 'Failed' } }) + '\\n');",
      'process.exit(9);',
      '',
    ].join('\n'));
    try {
      runJsonNodeScript(child, [], root);
      throw new Error('Expected child failure');
    } catch (error) {
      expect(error.message).toBe('bounded migration failed');
      expect(error.details).toEqual(expect.objectContaining({
        script: 'failing-child.js',
        exitCode: 9,
        result: expect.objectContaining({
          status: 'failed',
          command: { status: 'Failed' },
        }),
      }));
    }
  });

  test('remote artifact download treats bucket, key, and region as literal shell arguments', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-remote-download-'));
    const fakeBin = path.join(root, 'bin');
    const fakeAws = path.join(fakeBin, 'aws');
    const recordedArgs = path.join(root, 'aws-args');
    const injectedMarker = path.join(root, 'injected');
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(fakeAws, '#!/bin/sh\nprintf "%s\\n" "$@" > "$PATH_TEST_AWS_ARGS"\n');
    fs.chmodSync(fakeAws, 0o755);
    const bucket = `bucket;touch ${injectedMarker}`;
    const key = 'releases/value with spaces;echo-bad/admin.zip';
    const region = `ca-central-1;touch ${injectedMarker}`;
    const commands = buildAdminTestRemoteCommands(
      bucket,
      key,
      region,
      [],
      'a'.repeat(64)
    );
    const assignments = commands.filter(command => command.startsWith('PATH_DEPLOY_'));
    const download = commands.find(command => command.startsWith('aws s3 cp '));
    const result = spawnSync('bash', ['-c', [
      'set -euo pipefail',
      ...assignments,
      `ARCHIVE='${path.join(root, 'archive.zip')}'`,
      download,
    ].join('\n')], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        PATH_TEST_AWS_ARGS: recordedArgs,
      },
    });
    expect(result.status).toBe(0);
    expect(fs.existsSync(injectedMarker)).toBe(false);
    expect(fs.readFileSync(recordedArgs, 'utf8').trim().split('\n')).toEqual([
      's3',
      'cp',
      `s3://${bucket}/${key}`,
      path.join(root, 'archive.zip'),
      '--region',
      region,
    ]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('admin config admission freezes one regular target-bound artifact without exposing its path', () => {
    const fixture = makeAdminConfigFixture('test');
    const state = captureAdminDeployConfig({
      adminEnvFile: fixture.filename,
      adminEnvSha256: fixture.sha256,
    }, { name: 'test' }, { snapshot: true });

    expect(state.sha256).toBe(fixture.sha256);
    expect(fs.statSync(state.snapshotPath).mode & 0o077).toBe(0);
    expect(fs.readFileSync(state.snapshotPath)).toEqual(fs.readFileSync(fixture.filename));
    expect(adminDeployConfigEvidence(state)).toEqual({
      environment: 'test',
      purpose: 'admin_frontend_build_and_runtime_config',
      sha256: fixture.sha256,
      bytes: fs.statSync(fixture.filename).size,
    });
    expect(adminDeployConfigEvidence(state)).not.toHaveProperty('sourcePath');
    expect(assertAdminDeployConfigSourceUnchanged(state)).toEqual(expect.objectContaining({ status: 'passed' }));
  });

  test('admin config admission rejects hash drift, wrong target, and symlinks', () => {
    const fixture = makeAdminConfigFixture('test');
    expect(() => captureAdminDeployConfig({
      adminEnvFile: fixture.filename,
      adminEnvSha256: '0'.repeat(64),
    }, { name: 'test' })).toThrow('SHA-256 mismatch');
    expect(() => captureAdminDeployConfig({
      adminEnvFile: fixture.filename,
      adminEnvSha256: fixture.sha256,
    }, { name: 'prod' })).toThrow('does not match the proven PROD target contract');

    const symlink = path.join(fixture.root, 'linked.env');
    fs.symlinkSync(fixture.filename, symlink);
    expect(() => captureAdminDeployConfig({
      adminEnvFile: symlink,
      adminEnvSha256: fixture.sha256,
    }, { name: 'test' })).toThrow('regular, non-symlink');
  });

  test('TEST config admission requires runtime secrets without recording their values', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admin-config-no-secrets-'));
    const filename = path.join(root, 'admin-test.env');
    const content = `${Object.entries(ADMIN_ENVIRONMENT_CONTRACTS.test)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')}\n`;
    fs.writeFileSync(filename, content, { mode: 0o600 });
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    expect(() => captureAdminDeployConfig({
      adminEnvFile: filename,
      adminEnvSha256: sha256,
    }, { name: 'test' })).toThrow('missing required TEST secret inputs');
  });

  test('frozen admin config detects source changes after admission', () => {
    const fixture = makeAdminConfigFixture('test');
    const state = captureAdminDeployConfig({
      adminEnvFile: fixture.filename,
      adminEnvSha256: fixture.sha256,
    }, { name: 'test' }, { snapshot: true });
    fs.appendFileSync(fixture.filename, 'UNREVIEWED=value\n');
    expect(() => assertAdminDeployConfigSourceUnchanged(state)).toThrow('changed after admission');
  });

  test('admin environment hash CLI inputs are explicit', () => {
    expect(parseArgs([
      'plan', '--env', 'test', '--admin-env-file', '/secure/admin.env',
      '--admin-env-sha256', 'a'.repeat(64),
    ])).toEqual(expect.objectContaining({
      adminEnvFile: '/secure/admin.env',
      adminEnvSha256: 'a'.repeat(64),
    }));
  });

  test('prebuilt builds are bound to the reviewed external config hash', () => {
    const root = makeRepo();
    const input = { adminEnvironment: { purpose: 'admin_frontend_build_config', sha256: 'a'.repeat(64), bytes: 100 } };
    writeBuildManifest({ repoRoot: root, externalInputs: input });
    expect(validatePrebuiltBuild({
      repoRoot: root,
      expected: {
        buildTarget: 'production', releaseId: 'release-1', gitCommit: 'abc123',
        externalInputs: input,
      },
    })).toEqual(expect.objectContaining({ buildInfo: expect.any(Object) }));
    expect(() => validatePrebuiltBuild({
      repoRoot: root,
      expected: {
        buildTarget: 'production', releaseId: 'release-1', gitCommit: 'abc123',
        externalInputs: { adminEnvironment: { ...input.adminEnvironment, sha256: 'b'.repeat(64) } },
      },
    })).toThrow('external input mismatch');
  });

  test('TEST remote admission verifies archive hash and completeness before replacement', () => {
    const commands = buildAdminTestRemoteCommands(
      'bucket', 'releases/r2/admin.zip', 'ca-central-1', [], 'a'.repeat(64)
    );
    const checksumIndex = commands.findIndex(command => command.includes('sha256sum -c'));
    const extractionIndex = commands.findIndex(command => command === 'unzip -qo "$ARCHIVE" -d "$TMPDIR"');
    const completenessIndex = commands.findIndex(command => command.includes('missing admin artifact directory'));
    const replacementIndex = commands.findIndex(command => command.includes('rm -rf /opt/nwac/admin-dashboard/src'));
    expect(checksumIndex).toBeGreaterThan(-1);
    expect(extractionIndex).toBeGreaterThan(checksumIndex);
    expect(completenessIndex).toBeGreaterThan(extractionIndex);
    expect(replacementIndex).toBeGreaterThan(completenessIndex);
    expect(commands.some(command => command.includes('if ! unzip'))).toBe(false);
    expect(commands).toContain('DEPLOY_ROOT=$(mktemp -d /tmp/admin-deploy.XXXXXX)');
    expect(commands.some(command => command.includes('/tmp/admin.zip'))).toBe(false);
    expect(commands.some(command => command.includes('portal sibling link is not coherent'))).toBe(true);
    expect(commands.some(command => (
      command.includes('public/nwac-logo.png') && command.includes('public/nwac-consent-logo.png')
    ))).toBe(true);
  });

  test.each([
    ['admin', buildAdminTestRemoteCommands('bucket', 'admin.zip', 'ca-central-1', [], 'a'.repeat(64)), 'unzip -qo "$ARCHIVE" -d "$TMPDIR"'],
    ['portal', buildPortalTestRemoteCommands('bucket', 'portal.zip', 'ca-central-1', 'a'.repeat(64)), 'unzip -oq "$ARCHIVE" -d "$TMPDIR"'],
  ])('TEST %s extraction propagates an unzip failure instead of reporting success', (_component, commands, extractionCommand) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-unzip-failure-'));
    const fakeBin = path.join(root, 'bin');
    fs.mkdirSync(fakeBin);
    const fakeUnzip = path.join(fakeBin, 'unzip');
    fs.writeFileSync(fakeUnzip, '#!/bin/sh\nexit 7\n');
    fs.chmodSync(fakeUnzip, 0o755);
    const extraction = commands.find(command => command === extractionCommand);
    const result = spawnSync('bash', ['-c', [
      'set -e',
      `ARCHIVE='${path.join(root, 'archive.zip')}'`,
      `TMPDIR='${path.join(root, 'staging')}'`,
      'mkdir -p "$TMPDIR"',
      extraction,
      'exit 0',
    ].join('\n')], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
    });
    expect(extraction).toBeTruthy();
    expect(result.status).toBe(7);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test.each([
    ['admin', buildAdminTestRemoteCommands],
    ['portal', buildPortalTestRemoteCommands],
  ])('TEST %s checksum command verifies the expanded unique archive path', (_component, buildCommands) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-archive-checksum-'));
    const archivePath = path.join(root, 'archive with spaces.zip');
    fs.writeFileSync(archivePath, 'candidate archive');
    const checksum = crypto.createHash('sha256').update('candidate archive').digest('hex');
    const commands = _component === 'admin'
      ? buildCommands('bucket', 'artifact.zip', 'ca-central-1', [], checksum)
      : buildCommands('bucket', 'artifact.zip', 'ca-central-1', checksum);
    const checksumCommand = commands.find(command => command.includes('sha256sum -c'));
    const result = spawnSync('bash', ['-c', [
      `ARCHIVE='${archivePath}'`,
      checksumCommand,
    ].join('\n')]);
    expect(result.status).toBe(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test.each([
    ['healthy process and endpoint', 0, 0],
    ['failed endpoint', 7, 0],
    ['missing PM2 process', 0, 1],
  ])('remote service health gate is fail-closed for %s', (_label, curlExit, pm2PidMode) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-remote-health-'));
    const fakeBin = path.join(root, 'bin');
    fs.mkdirSync(fakeBin);
    const fakePm2 = path.join(fakeBin, 'pm2');
    const fakeCurl = path.join(fakeBin, 'curl');
    fs.writeFileSync(fakePm2, [
      '#!/bin/sh',
      'if [ "$1" = "pid" ]; then',
      pm2PidMode === 0 ? '  echo "$PATH_TEST_HEALTH_PID"' : '  echo 0',
      '  exit 0',
      'fi',
      'exit 0',
      '',
    ].join('\n'));
    fs.writeFileSync(fakeCurl, `#!/bin/sh\nexit ${curlExit}\n`);
    fs.chmodSync(fakePm2, 0o755);
    fs.chmodSync(fakeCurl, 0o755);
    const commands = buildRemoteServiceHealthCommands({
      pm2Name: 'fixture-service',
      port: 5999,
      serviceLabel: 'fixture',
      attempts: 1,
      delaySeconds: 0,
    });
    const result = spawnSync('bash', ['-c', [
      'set -euo pipefail',
      `PM2_BIN='${fakePm2}'`,
      ...commands,
    ].join('\n')], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH}`,
        PATH_TEST_HEALTH_PID: String(process.pid),
      },
    });
    const expectedSuccess = curlExit === 0 && pm2PidMode === 0;
    expect(result.status === 0).toBe(expectedSuccess);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('isolated frontend build source excludes every root dotenv file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-isolated-frontend-source-'));
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), '.env*\nnode_modules/\n');
    fs.writeFileSync(path.join(root, 'package.json'), '{}\n');
    fs.writeFileSync(path.join(root, 'src', 'index.js'), 'export default true;\n');
    fs.writeFileSync(path.join(root, '.env'), 'REACT_APP_UNREVIEWED=true\n');
    fs.writeFileSync(path.join(root, '.env.production.local'), 'REACT_APP_UNREVIEWED_LOCAL=true\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: root }).status).toBe(0);
    expect(spawnSync('git', ['add', '.gitignore', 'package.json', 'src/index.js'], { cwd: root }).status).toBe(0);

    const isolated = createIsolatedFrontendBuildProject(root, 'test-fixture');
    try {
      expect(fs.readFileSync(path.join(isolated.projectRoot, 'src', 'index.js'), 'utf8')).toContain('export default true');
      expect(fs.existsSync(path.join(isolated.projectRoot, '.env'))).toBe(false);
      expect(fs.existsSync(path.join(isolated.projectRoot, '.env.production.local'))).toBe(false);
      expect(fs.lstatSync(path.join(isolated.projectRoot, 'node_modules')).isSymbolicLink()).toBe(true);
    } finally {
      fs.rmSync(isolated.tempRoot, { recursive: true, force: true });
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('staged frontend build validation rejects bytes added after initial admission', () => {
    const root = makeRepo();
    const destination = path.join(root, 'staged-build');
    const expected = {
      buildTarget: 'production',
      releaseId: 'release-1',
      gitCommit: 'abc123',
    };
    writeBuildManifest({ repoRoot: root });
    expect(validatePrebuiltBuild({ repoRoot: root, expected })).toEqual(expect.objectContaining({
      assets: expect.any(Object),
    }));

    fs.writeFileSync(path.join(root, 'build', 'late-unreviewed.js'), 'unreviewed');
    expect(() => copyValidatedFrontendBuild({
      repoRoot: root,
      sourceBuildPath: path.join(root, 'build'),
      destinationBuildPath: destination,
      expected,
      label: 'fixture',
    })).toThrow('Prebuilt asset checksum mismatch');

    fs.rmSync(path.join(root, 'build', 'late-unreviewed.js'));
    expect(copyValidatedFrontendBuild({
      repoRoot: root,
      sourceBuildPath: path.join(root, 'build'),
      destinationBuildPath: destination,
      expected,
      label: 'fixture',
    })).toEqual(expect.objectContaining({ assets: expect.any(Object) }));
    fs.writeFileSync(path.join(destination, 'static', 'main.js'), 'tampered after staging');
    expect(() => validatePrebuiltBuild({
      repoRoot: root,
      buildPath: destination,
      expected,
    })).toThrow('Prebuilt asset checksum mismatch');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('runtime staging rejects ignored files instead of packaging unproved source', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admitted-runtime-source-'));
    const destination = path.join(root, 'staging');
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), 'runtime/ignored.js\n');
    fs.writeFileSync(path.join(root, 'runtime', 'tracked.js'), 'module.exports = true;\n');
    fs.writeFileSync(path.join(root, 'runtime', 'ignored.js'), 'module.exports = false;\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: root }).status).toBe(0);
    expect(spawnSync('git', ['add', '.gitignore', 'runtime/tracked.js'], { cwd: root }).status).toBe(0);

    expect(() => copyAdmittedGitSourceDirectory(
      root,
      'runtime',
      destination,
      'fixture runtime'
    )).toThrow('ignored or otherwise unadmitted source files: runtime/ignored.js');
    expect(fs.existsSync(destination)).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('whole-repository admitted copy treats dot as the repository root', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admitted-root-source-'));
    const destination = path.join(root, 'outside-staging');
    fs.mkdirSync(path.join(root, 'runtime'), { recursive: true });
    fs.writeFileSync(path.join(root, '.gitignore'), 'outside-staging/\n');
    fs.writeFileSync(path.join(root, 'runtime', 'tracked.js'), 'module.exports = true;\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: root }).status).toBe(0);
    expect(spawnSync('git', ['add', '.gitignore', 'runtime/tracked.js'], { cwd: root }).status).toBe(0);

    expect(copyAdmittedGitSourceDirectory(root, '.', destination, 'fixture root')).toBe(true);
    expect(fs.readFileSync(path.join(destination, 'runtime', 'tracked.js'), 'utf8')).toContain('true');
    expect(fs.existsSync(path.join(destination, '.git'))).toBe(false);
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('TEST mutable artifact aliases require completed post-install smoke evidence', () => {
    const appResult = {
      artifacts: {
        portal: { immutableKey: 'portal-immutable' },
        admin: { immutableKey: 'admin-immutable' },
      },
    };
    const promotions = [];
    const snapshotArtifact = (_artifact, _envConfig, _snapshotRoot, component) => ({ component });
    const restoreArtifact = jest.fn();
    const promoteArtifact = artifact => {
      promotions.push(artifact.immutableKey);
      return { bootstrapCompatibilityArtifact: `${artifact.immutableKey}-alias` };
    };
    expect(() => promoteTestArtifactsAfterSmoke(appResult, null, {}, {
      promoteArtifact,
      snapshotArtifact,
      restoreArtifact,
    }))
      .toThrow('require successful post-install smoke evidence');
    expect(promotions).toEqual([]);

    expect(promoteTestArtifactsAfterSmoke(appResult, [{ ok: true }], {}, {
      promoteArtifact,
      snapshotArtifact,
      restoreArtifact,
    }))
      .toEqual(expect.objectContaining({ skipped: false }));
    expect(promotions).toEqual(['portal-immutable', 'admin-immutable']);

    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const runStart = source.indexOf('async function handleRun');
    const runEnd = source.indexOf('async function handleSmoke', runStart);
    const runSource = source.slice(runStart, runEnd);
    expect(runSource.indexOf("'app.deploy'"))
      .toBeLessThan(runSource.indexOf("'smoke.check'"));
    expect(runSource.indexOf("'smoke.check'"))
      .toBeLessThan(runSource.indexOf("'app.alias-promote'"));
  });

  test.each([
    ['second component', 'admin'],
    ['second alias copy in first component', 'portal'],
  ])('TEST bootstrap aliases are restored when promotion fails during the %s', (_label, failingComponent) => {
    const appResult = {
      artifacts: {
        portal: { immutableKey: 'portal-new', bootstrapCompatibilityKey: 'portal-latest' },
        admin: { immutableKey: 'admin-new', bootstrapCompatibilityKey: 'admin-latest' },
      },
    };
    const activeAliases = {
      portal: 'portal-old',
      admin: 'admin-old',
    };
    const snapshotArtifact = (_artifact, _envConfig, _snapshotRoot, component) => ({
      component,
      value: activeAliases[component],
    });
    const restoreArtifact = snapshot => {
      activeAliases[snapshot.component] = snapshot.value;
    };
    const promoteArtifact = (artifact) => {
      const component = artifact.immutableKey.startsWith('portal') ? 'portal' : 'admin';
      activeAliases[component] = artifact.immutableKey;
      if (component === failingComponent) {
        throw new Error(`forced-${component}-promotion-failure`);
      }
      return { bootstrapCompatibilityArtifact: artifact.immutableKey };
    };

    expect(() => promoteTestArtifactsAfterSmoke(appResult, [{ ok: true }], {}, {
      promoteArtifact,
      snapshotArtifact,
      restoreArtifact,
    })).toThrow(`forced-${failingComponent}-promotion-failure`);
    expect(activeAliases).toEqual({
      portal: 'portal-old',
      admin: 'admin-old',
    });
  });

  test('PROD admin config remains build-only and source is rechecked around staging', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const prodStart = source.indexOf('async function deployAdminToProdNative');
    const prodEnd = source.indexOf('async function deployPortalToProdNative', prodStart);
    const prodSource = source.slice(prodStart, prodEnd);
    expect(prodSource).not.toContain("path.join(stagingPath, '.env.production')");
    expect(prodSource).toContain('before admin PROD staging');
    expect(prodSource).toContain('after admin PROD staging');
    expect(prodSource).toContain('before admin PROD upload');
    expect(prodSource).toContain('stagedFilePaths');
  });

  test('compatibility artifact admission re-hashes staged bytes immediately before upload', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-staged-prod-artifact-'));
    const archivePath = path.join(root, 'admin.zip');
    fs.writeFileSync(archivePath, 'reviewed-bytes');
    const artifact = {
      localArchivePath: archivePath,
      sha256: crypto.createHash('sha256').update('reviewed-bytes').digest('hex'),
      archiveBytes: Buffer.byteLength('reviewed-bytes'),
    };
    expect(assertStagedArtifactUnchanged(artifact, 'admin')).toEqual({
      sha256: artifact.sha256,
      bytes: artifact.archiveBytes,
    });
    fs.writeFileSync(archivePath, 'changed-bytes!');
    expect(fs.statSync(archivePath).size).toBe(artifact.archiveBytes);
    expect(() => assertStagedArtifactUnchanged(artifact, 'admin'))
      .toThrow('Staged admin artifact changed before upload');
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('verified S3 artifact copies preserve metadata without requesting object tags', () => {
    expect(buildVerifiedS3ArtifactCopyArgs({
      bucket: 'artifact-bucket',
      sourceKey: 'releases/release-1/admin/admin-sha.zip',
      destinationKey: 'admin/admin-dashboard-latest.zip',
    })).toEqual([
      's3', 'cp',
      's3://artifact-bucket/releases/release-1/admin/admin-sha.zip',
      's3://artifact-bucket/admin/admin-dashboard-latest.zip',
      '--copy-props', 'metadata-directive',
    ]);
  });

  test('TEST app deployment rejects every dirty source repository before packaging', () => {
    const appPlan = { deployAdmin: true, deployPortal: true, deployShared: false };
    const repoState = {
      adminDashboard: cleanRepoState('/admin', 'admin-head'),
      portal: {
        ...cleanRepoState('/portal', 'portal-head'),
        gitDirty: true,
        gitStatusCount: 1,
        gitStatus: ['?? sql/ops/untracked-repair.sql'],
      },
      shared: cleanRepoState('/shared', 'shared-head'),
    };

    expect(() => assertDeploySourceState(
      { allowDirty: true, dirtyReason: 'TEST must still reject this override' },
      { name: 'test' },
      appPlan,
      repoState
    )).toThrow('Refusing TEST app deploy from a dirty source tree');
  });

  test.each([
    ['missing sibling', {
      path: '/missing-portal',
      gitTopLevel: null,
      repositoryValid: false,
      repositoryProofErrors: ['repository_path_missing'],
      gitHead: null,
      treeFingerprint: null,
      gitDirty: false,
      gitStatus: [],
    }],
    ['non-git sibling', {
      path: '/not-a-repo',
      gitTopLevel: null,
      repositoryValid: false,
      repositoryProofErrors: ['git_toplevel_unavailable'],
      gitHead: null,
      treeFingerprint: null,
      gitDirty: false,
      gitStatus: [],
    }],
  ])('TEST app deployment rejects %s repository proof', (_label, invalidPortal) => {
    expect(() => assertDeploySourceState(
      { allowDirty: false },
      { name: 'test' },
      { deployAdmin: true, deployPortal: true, deployShared: false },
      {
        adminDashboard: cleanRepoState('/admin', 'admin-head'),
        portal: invalidPortal,
        shared: cleanRepoState('/shared', 'shared-head'),
      }
    )).toThrow('without exact Git repository proof');
  });

  test('release repository proof requires a clean detached commit, exact basename, and ordinary index flags', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'path-detached-release-repo-'));
    const repo = path.join(parent, 'admin-dashboard');
    fs.mkdirSync(repo);
    fs.writeFileSync(path.join(repo, 'tracked.js'), 'module.exports = true;\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: repo }).status).toBe(0);
    expect(spawnSync('git', ['add', 'tracked.js'], { cwd: repo }).status).toBe(0);
    expect(spawnSync('git', ['-c', 'user.name=PATH Test', '-c', 'user.email=path-test@example.invalid', 'commit', '-qm', 'fixture'], { cwd: repo }).status).toBe(0);

    const branchState = buildGitRepoState(repo, 'admin-dashboard');
    expect(branchState.repositoryValid).toBe(false);
    expect(branchState.repositoryProofErrors).toContain('head_not_detached');
    expect(spawnSync('git', ['checkout', '--detach', '-q'], { cwd: repo }).status).toBe(0);
    expect(buildGitRepoState(repo, 'admin-dashboard')).toEqual(expect.objectContaining({
      repositoryValid: true,
      gitDetached: true,
      gitDirty: false,
      gitSpecialIndexFlagCount: 0,
    }));

    expect(spawnSync('git', ['update-index', '--skip-worktree', 'tracked.js'], { cwd: repo }).status).toBe(0);
    const specialFlagState = buildGitRepoState(repo, 'admin-dashboard');
    expect(specialFlagState.repositoryValid).toBe(false);
    expect(specialFlagState.repositoryProofErrors).toContain('git_special_index_flags_present');
    expect(specialFlagState.gitSpecialIndexFlags).toEqual(expect.arrayContaining([
      expect.objectContaining({ flag: 'S', path: 'tracked.js' }),
    ]));
    expect(buildGitRepoState(repo, 'ISET-intake').repositoryProofErrors).toContain('repository_basename_mismatch');
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

  test('the orchestrator writes the manifest and consumes qualification/preflight before remote plan or mutation', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const runStart = source.indexOf('async function handleRun');
    const manifestWrite = source.indexOf('writeManifest(manifestPath, manifest)', runStart);
    const qualification = source.indexOf("'release.qualification'", runStart);
    const preflight = source.indexOf("'release.preflight'", runStart);
    const remotePlan = source.indexOf("'plan.resolve'", runStart);
    expect(manifestWrite).toBeGreaterThan(runStart);
    expect(qualification).toBeGreaterThan(runStart);
    expect(preflight).toBeGreaterThan(qualification);
    expect(remotePlan).toBeGreaterThan(preflight);
    ['db.restore-point', 'test-db.refresh', 'schema.apply', 'data.apply', 'app.stage.portal', 'app.deploy'].forEach(step => {
      expect(source.indexOf(`'${step}'`, runStart)).toBeGreaterThan(preflight);
    });
  });

  test.each(['handlePlan', 'handleRun'])('%s proves exact clean repositories and writes a manifest before remote plan resolution', handlerName => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const handlerStart = source.indexOf(`async function ${handlerName}`);
    const nextHandler = source.indexOf('\nasync function ', handlerStart + 1);
    const handlerSource = source.slice(handlerStart, nextHandler > handlerStart ? nextHandler : undefined);
    expect(handlerStart).toBeGreaterThan(-1);
    expect(handlerSource.indexOf('buildRepoState()')).toBeGreaterThan(-1);
    expect(handlerSource.indexOf('assertDeploySourceState(')).toBeGreaterThan(
      handlerSource.indexOf('buildRepoState()')
    );
    expect(handlerSource.indexOf('buildPlanIntent(')).toBeGreaterThan(
      handlerSource.indexOf('assertDeploySourceState(')
    );
    expect(handlerSource.indexOf('writeManifest(manifestPath, manifest)')).toBeGreaterThan(
      handlerSource.indexOf('buildPlanIntent(')
    );
    expect(handlerSource.indexOf("'plan.resolve'")).toBeGreaterThan(
      handlerSource.indexOf('writeManifest(manifestPath, manifest)')
    );
  });

  test('TEST and PROD artifact staging writes release qualification provenance', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    expect(source).toContain('writeStagingReleaseProvenance');
    expect(source).toContain('.path-release-provenance.json');
    expect(source).toContain('qualificationEvidenceId');
    expect(source).toContain("'application-assessment-option-b-smoke.js'");
    expect(source).not.toContain("'privacy-route-denial-smoke.js'");
  });

  test('archive-content preflight verifies required runtime and smoke scripts before upload', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-archive-preflight-'));
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

  test('admin archive support scripts are an exact allowlist', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-admin-script-allowlist-'));
    const staging = path.join(temp, 'staging');
    const archive = path.join(temp, 'artifact.zip');
    fs.mkdirSync(path.join(staging, 'scripts'), { recursive: true });
    const allowed = [
      'application-assessment-backfill.js',
      'application-assessment-context-backfill.js',
      'application-assessment-option-b-smoke.js',
    ];
    allowed.forEach(file => fs.writeFileSync(path.join(staging, 'scripts', file), 'runtime'));
    await createZipFromDirectory(staging, archive);
    expect(assertArchiveScriptAllowlist(archive, allowed, 'admin fixture')).toEqual(expect.objectContaining({
      status: 'passed',
      allowedScriptFiles: allowed.map(file => `scripts/${file}`).sort(),
    }));

    fs.writeFileSync(path.join(staging, 'scripts', 'unexpected-retired.js'), 'retired');
    await createZipFromDirectory(staging, path.join(temp, 'forbidden.zip'));
    expect(() => assertArchiveScriptAllowlist(path.join(temp, 'forbidden.zip'), allowed, 'admin fixture'))
      .toThrow('exact runtime support-script allowlist');
  });

  test('changed TEST runtime cannot bypass exact postflight smoke', () => {
    expect(() => assertTestRuntimeSmokeRequired(
      { skipSmoke: true },
      { name: 'test' },
      { deployAdmin: true, deployPortal: true, deployShared: false }
    )).toThrow('cannot use --skip-smoke');
    expect(assertTestRuntimeSmokeRequired(
      { skipSmoke: true },
      { name: 'prod' },
      { deployAdmin: true, deployPortal: true, deployShared: true }
    )).toEqual({ required: false, skipped: true });
  });

  test('TEST atomic rollout stages, arms recovery, cuts over, proves exact readiness, and only then promotes aliases', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const runStart = source.indexOf('async function handleRun');
    const runEnd = source.indexOf('async function handleSmoke', runStart);
    const runSource = source.slice(runStart, runEnd);
    const orderedSteps = [
      "'app.stage.portal'",
      "'app.stage.admin'",
      "'app.recovery-plan'",
      "'app.prepare'",
      "'app.cutover'",
      "'app.postflight'",
      "'smoke.check'",
      "'app.alias-promote'",
    ];
    let prior = -1;
    orderedSteps.forEach(step => {
      const current = runSource.indexOf(step);
      expect(current).toBeGreaterThan(prior);
      prior = current;
    });
    expect(runSource.indexOf("'app.recover'", runSource.indexOf('} catch (error)'))).toBeGreaterThan(prior);

    const context = {
      releaseId: 'release-r2',
      region: 'ca-central-1',
      qualificationDecision: 'UNQUALIFIED',
      repos: {
        adminDashboard: { gitHead: 'admin-head', treeFingerprint: 'admin-tree' },
        portal: { gitHead: 'portal-head', treeFingerprint: 'portal-tree' },
      },
      artifacts: {
        admin: { bucket: 'bucket', immutableKey: 'admin.zip', sha256: 'a'.repeat(64) },
        portal: { bucket: 'bucket', immutableKey: 'portal.zip', sha256: 'b'.repeat(64) },
      },
    };
    const prepare = buildTestAtomicPrepareCommands(context);
    expect(prepare.findIndex(command => command.includes('recovery-context.json')))
      .toBeLessThan(prepare.findIndex(command => command.includes('npm ci')));
    expect(prepare.some(command => command.includes('candidate-admin'))).toBe(true);
    expect(prepare.some(command => command.includes('candidate-portal'))).toBe(true);
    const cutover = buildTestAtomicCutoverCommands(context);
    expect(cutover.some(command => command.includes('backup/admin-dashboard'))).toBe(true);
    expect(cutover.some(command => command.includes('backup/portal'))).toBe(true);
    expect(cutover.some(command => command.includes('rm -rf /opt/nwac/admin-dashboard'))).toBe(false);
    expect(cutover.some(command => command.includes('rm -rf /opt/nwac/portal'))).toBe(false);
    const postflight = buildTestExactPostflightCommands(context).join('\n');
    expect(postflight).toContain('/readyz');
    expect(postflight).toContain('path-build-manifest.json');
    expect(postflight).toContain('.path-release-provenance.json');
  });

  test('failure recovery swaps both untouched app backups back and is idempotently verifiable', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-test-atomic-recovery-'));
    const optNwac = path.join(root, 'opt', 'nwac');
    const homeAdmin = path.join(root, 'home', 'ec2-user', 'admin-dashboard');
    const txRoot = path.join(optNwac, '.path-release-transactions', 'release-r2');
    const backup = path.join(txRoot, 'backup');
    const fakeBin = path.join(root, 'bin');
    [
      path.join(optNwac, 'admin-dashboard'),
      path.join(optNwac, 'portal'),
      path.join(optNwac, 'shared'),
      path.join(backup, 'admin-dashboard'),
      path.join(backup, 'portal'),
      path.join(backup, 'shared'),
      path.join(backup, 'home-admin-build'),
      path.join(homeAdmin, 'build'),
      fakeBin,
    ].forEach(directory => fs.mkdirSync(directory, { recursive: true }));
    fs.writeFileSync(path.join(optNwac, 'admin-dashboard', 'marker'), 'failed-new-admin');
    fs.writeFileSync(path.join(optNwac, 'portal', 'marker'), 'failed-new-portal');
    fs.writeFileSync(path.join(optNwac, 'shared', 'marker'), 'failed-new-shared');
    fs.writeFileSync(path.join(homeAdmin, 'build', 'marker'), 'failed-new-build');
    fs.writeFileSync(path.join(backup, 'admin-dashboard', 'marker'), 'prior-admin');
    fs.writeFileSync(path.join(backup, 'portal', 'marker'), 'prior-portal');
    fs.writeFileSync(path.join(backup, 'shared', 'marker'), 'prior-shared');
    fs.writeFileSync(path.join(backup, 'home-admin-build', 'marker'), 'prior-build');
    for (const component of ['admin', 'portal']) {
      const appDirectory = component === 'admin' ? 'admin-dashboard' : 'portal';
      const provenance = JSON.stringify({ releaseId: `prior-${component}` });
      fs.writeFileSync(path.join(backup, appDirectory, '.path-release-provenance.json'), provenance);
      fs.writeFileSync(
        path.join(txRoot, `prior-${component}-provenance.sha256`),
        `${crypto.createHash('sha256').update(provenance).digest('hex')}\n`
      );
      fs.writeFileSync(path.join(txRoot, `prior-${component}-running`), '0\n');
    }
    fs.writeFileSync(path.join(txRoot, 'state'), 'cutover-complete\n');
    const fakePm2 = path.join(fakeBin, 'pm2');
    fs.writeFileSync(fakePm2, '#!/bin/sh\nif [ "$1" = pid ]; then echo 0; fi\nexit 0\n');
    fs.chmodSync(fakePm2, 0o755);

    const commands = buildTestRecoveryCommands({ releaseId: 'release-r2' })
      .map(command => command
        .replaceAll('/opt/nwac', optNwac)
        .replaceAll('/home/ec2-user/admin-dashboard', homeAdmin));
    const result = spawnSync('bash', ['-c', commands.join('\n')], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    expect(result.status).toBe(0);
    expect(fs.readFileSync(path.join(optNwac, 'admin-dashboard', 'marker'), 'utf8')).toBe('prior-admin');
    expect(fs.readFileSync(path.join(optNwac, 'portal', 'marker'), 'utf8')).toBe('prior-portal');
    expect(fs.readFileSync(path.join(optNwac, 'shared', 'marker'), 'utf8')).toBe('prior-shared');
    expect(fs.readFileSync(path.join(homeAdmin, 'build', 'marker'), 'utf8')).toBe('prior-build');
    expect(fs.readFileSync(path.join(txRoot, 'state'), 'utf8').trim()).toBe('recovered');
    expect(fs.readdirSync(path.join(txRoot, 'failed')).some(name => name.startsWith('admin-dashboard-'))).toBe(true);
    expect(fs.readdirSync(path.join(txRoot, 'failed')).some(name => name.startsWith('portal-'))).toBe(true);
    const repeated = spawnSync('bash', ['-c', commands.join('\n')], {
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    expect(repeated.status).toBe(0);
  });

  test('admin SQL staging contains canonical migrations and excludes operational repair artifacts', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-runtime-sql-'));
    const fixtureRepo = path.join(temp, 'repo');
    const staging = path.join(temp, 'staging');
    const archive = path.join(temp, 'artifact.zip');
    fs.mkdirSync(path.join(fixtureRepo, 'sql', 'migrations'), { recursive: true });
    fs.mkdirSync(path.join(fixtureRepo, 'sql', 'ops'), { recursive: true });
    fs.writeFileSync(path.join(fixtureRepo, 'sql', 'migrations', '001_runtime.sql'), 'SELECT 1;\n');
    fs.writeFileSync(path.join(fixtureRepo, 'sql', 'ops', 'repair.sql'), 'SELECT 2;\n');
    expect(spawnSync('git', ['init', '-q'], { cwd: fixtureRepo }).status).toBe(0);
    expect(spawnSync('git', ['add', 'sql/migrations/001_runtime.sql', 'sql/ops/repair.sql'], {
      cwd: fixtureRepo,
    }).status).toBe(0);

    expect(copyAdminRuntimeSql(staging, fixtureRepo)).toBe(true);
    expect(fs.existsSync(path.join(staging, 'sql', 'migrations', '001_runtime.sql'))).toBe(true);
    expect(fs.existsSync(path.join(staging, 'sql', 'ops'))).toBe(false);

    await createZipFromDirectory(staging, archive);
    expect(assertArchiveContains(
      archive,
      ['sql/migrations/001_runtime.sql'],
      'admin fixture'
    )).toEqual(expect.objectContaining({ status: 'passed' }));
    expect(assertArchiveExcludesPrefixes(
      archive,
      ['sql/ops'],
      'admin fixture'
    )).toEqual(expect.objectContaining({ status: 'passed' }));
  });

  test('archive exclusion preflight rejects forbidden directory content', async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-archive-exclusion-'));
    const staging = path.join(temp, 'staging');
    const archive = path.join(temp, 'artifact.zip');
    fs.mkdirSync(path.join(staging, 'sql', 'ops'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'sql', 'ops', 'repair.sql'), 'SELECT 1;\n');
    await createZipFromDirectory(staging, archive);

    expect(() => assertArchiveExcludesPrefixes(
      archive,
      ['sql/ops'],
      'fixture'
    )).toThrow('contains forbidden content');
  });

  test('TEST portal preflight builds outside tracked portal output and cleans it after the run', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const prepareStart = source.indexOf('function preparePortalFrontendBuild');
    const prepareEnd = source.indexOf('function joinS3Key', prepareStart);
    const prepareSource = source.slice(prepareStart, prepareEnd);
    expect(prepareSource).toContain("path.join(REPO_ROOT, 'tmp', 'path-deploy-builds'");
    expect(prepareSource).toContain('BUILD_PATH: buildPath');
    expect(prepareSource).not.toContain("removePath(path.join(PORTAL_ROOT, 'build-test'))");

    const deployStart = source.indexOf('async function stagePortalForTestNative');
    const deployEnd = source.indexOf('async function deploySharedToProdNative', deployStart);
    expect(source.slice(deployStart, deployEnd)).toContain('copyValidatedFrontendBuild({');

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
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'path-artifact-'));
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

describe('--skip-qualification CLI flag', () => {
  test('defaults to false when flag is absent', () => {
    expect(parseArgs(['--env', 'test']).skipQualification).toBe(false);
  });

  test('sets skipQualification true when flag is present', () => {
    expect(parseArgs(['--env', 'test', '--skip-qualification']).skipQualification).toBe(true);
  });

  test('flag position does not affect other parsed args', () => {
    const args = parseArgs(['--skip-qualification', '--env', 'prod', '--skip-data', '--yes']);
    expect(args.skipQualification).toBe(true);
    expect(args.env).toBe('prod');
    expect(args.skipData).toBe(true);
    expect(args.yes).toBe(true);
  });

  test('--skip-qualification and --qualification-evidence are mutually exclusive', () => {
    expect(() => validateQualificationModeArgs(parseArgs([
      '--skip-qualification',
      '--qualification-evidence',
      'evidence.json',
      '--yes',
    ]))).toThrow('--skip-qualification and --qualification-evidence are mutually exclusive');
  });

  test('--skip-qualification cannot be mixed with the historical emergency path', () => {
    expect(() => validateQualificationModeArgs(parseArgs([
      '--skip-qualification',
      '--emergency-release',
      '--yes',
    ]))).toThrow('--skip-qualification cannot be combined with --emergency-release');
  });

  test('--skip-qualification requires explicit operator acknowledgement', () => {
    expect(() => validateQualificationModeArgs(parseArgs([
      '--skip-qualification',
      '--env',
      'test',
    ]))).toThrow('--skip-qualification requires --yes');
    expect(() => validateQualificationModeArgs(parseArgs([
      '--skip-qualification',
      '--env',
      'test',
      '--yes',
    ]))).not.toThrow();
  });

  test('UNQUALIFIED decision is recorded in the manifest when gate is bypassed', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    expect(source).toContain("decision: 'UNQUALIFIED'");
    expect(source).toContain('skipQualification: true');
  });

  test('skip path still goes through the release.qualification step — no ordering bypass', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const runStart = source.indexOf('async function handleRun');
    const qualStep = source.indexOf("'release.qualification'", runStart);
    const skipBranch = source.indexOf('args.skipQualification', qualStep);
    expect(qualStep).toBeGreaterThan(runStart);
    expect(skipBranch).toBeGreaterThan(qualStep);
    const preflight = source.indexOf("'release.preflight'", runStart);
    expect(preflight).toBeGreaterThan(qualStep);
  });

  test('provenance writer records qualificationDecision field', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    expect(source).toContain('qualificationDecision');
    const provenanceStart = source.indexOf('function writeStagingReleaseProvenance');
    const provenanceEnd = source.indexOf('\nfunction createZipFromDirectory', provenanceStart);
    expect(source.slice(provenanceStart, provenanceEnd)).toContain('qualificationDecision');
  });

  test('provenance qualificationDecision is UNQUALIFIED string — not GO or qualified', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'), 'utf8');
    const skipBlock = source.slice(
      source.indexOf('args.skipQualification)'),
      source.indexOf('return admitReleaseQualification')
    );
    expect(skipBlock).toContain("'UNQUALIFIED'");
    expect(skipBlock).not.toContain("'GO'");
  });
});
