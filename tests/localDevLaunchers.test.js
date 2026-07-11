const path = require('path');
const { execFileSync } = require('child_process');

const { buildLaunchPlan, describeLaunchPlan, validateLaunchPlan } = require('../scripts/local-dev-launcher');

const repoRoot = path.resolve(__dirname, '..');

describe('cross-platform local launchers', () => {
  test('the stack plan uses executable commands and carries required environment markers', () => {
    const plan = describeLaunchPlan(validateLaunchPlan(buildLaunchPlan({ root: path.dirname(repoRoot) })));
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
