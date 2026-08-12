const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { buildLaunchPlan, describeLaunchPlan, validateLaunchPlan } = require('../scripts/local-dev-launcher');

const repoRoot = path.resolve(__dirname, '..');
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

function createSyntheticLauncherPrerequisites() {
  const root = createOwnedTempRoot('path-local-launcher-contract-');
  ['admin-dashboard', 'ISET-intake', 'intacct-mock-service'].forEach(directory => {
    fs.mkdirSync(path.join(root, directory), { recursive: true });
  });
  const minioBinary = path.join(root, 'ISET-intake', 'qualification-minio-sentinel');
  fs.writeFileSync(minioBinary, 'inert qualification prerequisite\n');
  return {
    root,
    minioBinary,
    portalEnvironment: {
      OBJECT_ACCESS_KEY: 'qualification-nonsecret-access',
      OBJECT_SECRET_KEY: 'qualification-nonsecret-secret',
    },
  };
}

describe('cross-platform local launchers', () => {
  afterEach(() => {
    expect(removeOwnedTempRoots()).toEqual([]);
  });

  test('the stack plan uses executable commands and carries required environment markers', () => {
    const prerequisites = createSyntheticLauncherPrerequisites();
    const plan = describeLaunchPlan(validateLaunchPlan(buildLaunchPlan({
      root: prerequisites.root,
      portalEnvironment: prerequisites.portalEnvironment,
      ambientEnvironment: {},
      minioBinary: prerequisites.minioBinary,
    })));
    expect(plan.map(item => item.name)).toEqual([
      'portal-frontend',
      'portal-backend',
      'minio',
      'admin-frontend',
      'admin-backend',
      'intacct-mock',
    ]);
    expect(plan.find(item => item.name === 'admin-frontend').envKeys).toEqual(['BROWSER', 'PORT']);
    expect(plan.find(item => item.name === 'admin-backend').envKeys).toContain('ENABLE_UNSAFE_ADMIN_DEBUG_ROUTES');
    expect(JSON.stringify(plan)).not.toMatch(/powershell|set PORT=|set ENABLE_/iu);
    expect(JSON.stringify(plan)).not.toContain('qualification-nonsecret-access');
    expect(JSON.stringify(plan)).not.toContain('qualification-nonsecret-secret');
  });

  test('bounded frontend and backend plans expose port and debug-route policy without starting listeners', () => {
    const frontend = JSON.parse(execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'start-admin-frontend.js'),
      '--dry-run',
    ], { encoding: 'utf8' }));
    const backend = JSON.parse(execFileSync(process.execPath, [
      path.join(repoRoot, 'scripts', 'start-admin-server.js'),
      '--dry-run',
    ], { encoding: 'utf8' }));
    expect(frontend).toMatchObject({ port: '3001', buildTarget: 'local-start' });
    expect(backend).toMatchObject({ unsafeDebugRoutes: 'true', args: ['isetadminserver.js'] });
  });
});
