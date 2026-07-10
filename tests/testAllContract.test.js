const fs = require('fs');
const path = require('path');

const ADMIN_ROOT = path.resolve(__dirname, '..');
const PORTAL_ROOT = path.resolve(ADMIN_ROOT, '..', 'ISET-intake');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

describe('aggregate test command contract', () => {
  test.each([
    ['admin', ADMIN_ROOT],
    ['portal', PORTAL_ROOT],
  ])('%s npm test is the deterministic aggregate runner', (_name, root) => {
    const pkg = readJson(path.join(root, 'package.json'));
    expect(pkg.scripts.test).toBe('node scripts/run-test-all.js');
    expect(pkg.scripts['test:all']).toBe('node scripts/run-test-all.js');
    expect(fs.existsSync(path.join(root, 'scripts', 'run-test-all.js'))).toBe(true);
  });

  test('legacy admin test-named files are real suites under the backend Jest config', () => {
    const radioTest = fs.readFileSync(path.join(ADMIN_ROOT, 'tests', 'radio.validation.test.js'), 'utf8');
    expect(radioTest).toMatch(/\bdescribe\s*\(/u);
    expect(radioTest).toMatch(/\btest\s*\(/u);
    expect(fs.existsSync(path.join(ADMIN_ROOT, 'tests', 'jest.config.js'))).toBe(true);
  });
});
