const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  ADMIN_SUPPORT_SCRIPT_FILES,
  RETIRED_RELEASE_ARTIFACT_PATHS,
  assertArchiveExcludesPrefixes,
  assertArchiveScriptAllowlist,
  buildPortalTestRemoteCommands,
  createZipFromDirectory,
} = require('../scripts/path-deploy');

describe('retired qualification packaging', () => {
  test('portal artifacts contain product runtime files without qualification support scripts', () => {
    const deploySource = fs.readFileSync(
      path.resolve(__dirname, '..', 'scripts', 'path-deploy.js'),
      'utf8'
    );
    const portalPackage = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '..', '..', 'ISET-intake', 'package.json'),
      'utf8'
    ));

    expect(deploySource).toContain('const PORTAL_REQUIRED_ARTIFACT_FILES = [');
    expect(deploySource).toContain("'build/index.html'");
    expect(deploySource).toContain("'public/NWAC_logo.png'");
    expect(deploySource).toContain("'package.json'");
    expect(deploySource).toContain("'package-lock.json'");
    expect(deploySource).toContain("'server.js'");
    expect(deploySource).toContain("'migrationRunner.js'");
    expect(deploySource).not.toContain('PORTAL_SUPPORT_SCRIPT_FILES');
    expect(deploySource).not.toContain('copyPortalSupportScripts');
    expect(portalPackage.scripts).not.toHaveProperty('smoke:cfa-signing');
  });

  test('admin runtime packaging is exactly the three maintained operational scripts', async () => {
    expect(ADMIN_SUPPORT_SCRIPT_FILES).toEqual([
      'application-assessment-backfill.js',
      'application-assessment-context-backfill.js',
      'application-assessment-option-b-smoke.js',
    ]);
    const adminPackage = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '..', 'package.json'),
      'utf8'
    ));
    expect(adminPackage.scripts).not.toHaveProperty('release:qualify');
    expect(adminPackage.scripts).not.toHaveProperty('release:test:postflight');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'path-retired-admin-package-'));
    const staging = path.join(root, 'staging');
    const allowedArchive = path.join(root, 'allowed.zip');
    fs.mkdirSync(path.join(staging, 'scripts'), { recursive: true });
    ADMIN_SUPPORT_SCRIPT_FILES.forEach(file => {
      fs.writeFileSync(path.join(staging, 'scripts', file), 'maintained runtime support');
    });
    await createZipFromDirectory(staging, allowedArchive);
    expect(assertArchiveScriptAllowlist(allowedArchive, ADMIN_SUPPORT_SCRIPT_FILES, 'admin')).toEqual(expect.objectContaining({
      status: 'passed',
    }));
    expect(assertArchiveExcludesPrefixes(allowedArchive, RETIRED_RELEASE_ARTIFACT_PATHS, 'admin')).toEqual(expect.objectContaining({
      status: 'passed',
    }));

    const forbiddenRelative = RETIRED_RELEASE_ARTIFACT_PATHS[0];
    fs.mkdirSync(path.dirname(path.join(staging, forbiddenRelative)), { recursive: true });
    fs.writeFileSync(path.join(staging, forbiddenRelative), 'must never ship');
    const forbiddenArchive = path.join(root, 'forbidden.zip');
    await createZipFromDirectory(staging, forbiddenArchive);
    expect(() => assertArchiveExcludesPrefixes(forbiddenArchive, RETIRED_RELEASE_ARTIFACT_PATHS, 'admin'))
      .toThrow('contains forbidden content');
    expect(() => assertArchiveScriptAllowlist(forbiddenArchive, ADMIN_SUPPORT_SCRIPT_FILES, 'admin'))
      .toThrow('exact runtime support-script allowlist');
  });

  test('TEST portal deployment replaces managed directories and removes retired scripts residue', () => {
    const commands = buildPortalTestRemoteCommands(
      'test-artifacts',
      'portal/release.zip',
      'ca-central-1',
      'a'.repeat(64)
    );
    const replacementCommandIndex = commands.findIndex(command => (
      command.includes('rm -rf /opt/nwac/portal/build') &&
      command.includes('/opt/nwac/portal/scripts')
    ));
    const checksumIndex = commands.findIndex(command => command.includes('sha256sum -c'));
    const extractionIndex = commands.findIndex(command => command === 'unzip -oq "$ARCHIVE" -d "$TMPDIR"');
    const completenessIndex = commands.findIndex(command => command.includes('missing portal artifact directory'));
    const restartIndex = commands.findIndex(command => command.includes('restart nwac-portal --update-env'));

    expect(checksumIndex).toBeGreaterThan(-1);
    expect(extractionIndex).toBeGreaterThan(checksumIndex);
    expect(completenessIndex).toBeGreaterThan(extractionIndex);
    expect(replacementCommandIndex).toBeGreaterThan(completenessIndex);
    expect(replacementCommandIndex).toBeGreaterThan(-1);
    expect(restartIndex).toBeGreaterThan(replacementCommandIndex);
    expect(commands.some(command => command.includes('$TMPDIR/scripts'))).toBe(false);
    expect(commands.some(command => command.includes('if ! unzip'))).toBe(false);
    expect(commands).toContain('DEPLOY_ROOT=$(mktemp -d /tmp/portal-deploy.XXXXXX)');
    expect(commands.some(command => command.includes('/tmp/portal.zip'))).toBe(false);
    expect(commands.some(command => command.includes('public/NWAC_logo.png'))).toBe(true);
    ['build', 'db', 'notifications', 'pdf', 'public', 'src', 'auth'].forEach(directory => {
      expect(commands[replacementCommandIndex]).toContain(`/opt/nwac/portal/${directory}`);
      const copyIndex = commands.findIndex(command => command.includes(`$TMPDIR/${directory}`));
      expect(copyIndex).toBeGreaterThan(replacementCommandIndex);
    });
  });
});
