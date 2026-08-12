'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  BuildPreservationError,
  runWithBuildPreservation,
  validatePreservationPlan,
} = require('../scripts/lib/release-build-preservation');
const {
  createBuildSteps,
  createPreservationPlan,
  parseArgs,
} = require('../scripts/release-build-contract');

const ADMIN_ROOT = path.resolve(__dirname, '..');
const PORTAL_ROOT = path.resolve(ADMIN_ROOT, '..', 'ISET-intake');
const temporaryRoots = [];

function createSyntheticContract() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rq-build-preservation-'));
  temporaryRoots.push(root);
  const repoRoot = path.join(root, 'admin-dashboard');
  const portalRoot = path.join(root, 'ISET-intake');
  fs.mkdirSync(repoRoot, { recursive: true });
  fs.mkdirSync(portalRoot, { recursive: true });
  return {
    root,
    repoRoot,
    portalRoot,
    plan: createPreservationPlan({ repoRoot, portalRoot }),
  };
}

function write(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, value);
}

function expectBuildResidueAbsent(plan) {
  for (const outputRoot of plan.outputRoots) expect(fs.existsSync(outputRoot)).toBe(false);
}

function captureFailure(action) {
  try {
    action();
  } catch (error) {
    return error;
  }
  throw new Error('expected action to fail');
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const root = temporaryRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
    expect(fs.existsSync(root)).toBe(false);
  }
});

describe('native release build preservation contract', () => {
  test('keeps exact argument, command, working-directory, and output-root semantics', () => {
    expect(Array.from(parseArgs(['--all']))).toEqual(['admin', 'portal']);
    const baseEnv = { SYNTHETIC_ONLY: 'true' };
    const steps = createBuildSteps(new Set(['admin', 'portal']), {
      repoRoot: ADMIN_ROOT,
      portalRoot: PORTAL_ROOT,
      baseEnv,
    });

    expect(steps).toEqual([
      {
        id: 'admin-build',
        outputRoot: path.join(ADMIN_ROOT, 'tmp', 'release-qualification', 'admin-build-contract'),
        command: 'npm',
        args: ['run', 'build:test'],
        options: {
          cwd: ADMIN_ROOT,
          env: {
            ...baseEnv,
            BUILD_PATH: path.join(ADMIN_ROOT, 'tmp', 'release-qualification', 'admin-build-contract'),
            PATH_DEPLOY_ENV: 'test',
            PATH_RELEASE_ID: 'local-release-qualification',
          },
        },
      },
      {
        id: 'portal-build-info',
        outputRoot: null,
        command: process.execPath,
        args: [path.join(PORTAL_ROOT, 'scripts', 'write-build-info.js'), '--build-target', 'test'],
        options: {
          cwd: PORTAL_ROOT,
          env: {
            ...baseEnv,
            PATH_DEPLOY_ENV: 'test',
            PATH_RELEASE_ID: 'local-release-qualification',
          },
        },
      },
      {
        id: 'portal-build',
        outputRoot: path.join(PORTAL_ROOT, 'tmp', 'release-qualification', 'portal-build-contract'),
        command: 'npx',
        args: ['env-cmd', '-f', '.env.test', 'craco', 'build'],
        options: {
          cwd: PORTAL_ROOT,
          env: {
            ...baseEnv,
            BUILD_PATH: path.join(PORTAL_ROOT, 'tmp', 'release-qualification', 'portal-build-contract'),
            PATH_DEPLOY_ENV: 'test',
            PATH_RELEASE_ID: 'local-release-qualification',
          },
        },
      },
    ]);
  });

  test('declares exactly four generated files and two isolated output roots', () => {
    expect(createPreservationPlan()).toEqual({
      allowedRoots: [ADMIN_ROOT, PORTAL_ROOT],
      generatedFiles: [
        path.join(ADMIN_ROOT, 'src', 'generated', 'buildInfo.js'),
        path.join(ADMIN_ROOT, 'src', 'generated', 'publicReleaseNotes.js'),
        path.join(PORTAL_ROOT, 'src', 'generated', 'buildInfo.js'),
        path.join(PORTAL_ROOT, 'src', 'generated', 'publicBuildInfo.js'),
      ],
      outputRoots: [
        path.join(ADMIN_ROOT, 'tmp', 'release-qualification', 'admin-build-contract'),
        path.join(PORTAL_ROOT, 'tmp', 'release-qualification', 'portal-build-contract'),
      ],
    });
  });

  test('restores exact bytes and absence after an injected successful action', () => {
    const contract = createSyntheticContract();
    const [adminInfo, adminNotes, portalInfo, portalPublicInfo] = contract.plan.generatedFiles;
    const sentinel = path.join(contract.root, 'unrelated-sentinel.txt');
    write(adminInfo, Buffer.from([0, 1, 2, 255]));
    write(adminNotes, 'admin-notes-before');
    write(portalInfo, 'portal-info-before');
    write(sentinel, 'leave-me-alone');

    const outcome = runWithBuildPreservation(contract.plan, ({ outputRoots, assertOutputRoot }) => {
      for (const outputRoot of outputRoots) {
        assertOutputRoot(outputRoot);
        write(path.join(outputRoot, 'asset.txt'), 'synthetic-output');
      }
      for (const generatedFile of contract.plan.generatedFiles) write(generatedFile, 'changed');
      return 'child-pass';
    });

    expect(outcome.actionResult).toBe('child-pass');
    expect(outcome.evidence.restoration).toBe('passed');
    expect(fs.readFileSync(adminInfo)).toEqual(Buffer.from([0, 1, 2, 255]));
    expect(fs.readFileSync(adminNotes, 'utf8')).toBe('admin-notes-before');
    expect(fs.readFileSync(portalInfo, 'utf8')).toBe('portal-info-before');
    expect(fs.existsSync(portalPublicInfo)).toBe(false);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('leave-me-alone');
    expectBuildResidueAbsent(contract.plan);
  });

  test('restores exact state and preserves the child failure after an injected failure', () => {
    const contract = createSyntheticContract();
    const [adminInfo, , , portalPublicInfo] = contract.plan.generatedFiles;
    const childFailure = new Error('synthetic child failed');
    const sentinel = path.join(contract.root, 'unrelated-sentinel.txt');
    write(adminInfo, 'admin-before');
    write(sentinel, 'still-here');

    const caught = captureFailure(() =>
      runWithBuildPreservation(contract.plan, () => {
        write(adminInfo, 'admin-after');
        write(portalPublicInfo, 'created-by-child');
        for (const outputRoot of contract.plan.outputRoots) write(path.join(outputRoot, 'asset.txt'), 'output');
        throw childFailure;
      })
    );

    expect(caught).toBe(childFailure);
    expect(fs.readFileSync(adminInfo, 'utf8')).toBe('admin-before');
    expect(fs.existsSync(portalPublicInfo)).toBe(false);
    expect(fs.readFileSync(sentinel, 'utf8')).toBe('still-here');
    expectBuildResidueAbsent(contract.plan);
  });

  test.each([
    [
      'missing generated declaration',
      plan => ({ ...plan, generatedFiles: [] }),
      'BUILD_PRESERVATION_DECLARATION_MISSING',
    ],
    [
      'duplicate generated path',
      plan => ({ ...plan, generatedFiles: [...plan.generatedFiles, plan.generatedFiles[0]] }),
      'BUILD_PRESERVATION_PATH_DUPLICATE',
    ],
    [
      'escaping generated path',
      plan => ({ ...plan, generatedFiles: [...plan.generatedFiles, path.join(path.dirname(plan.allowedRoots[0]), 'escape.js')] }),
      'BUILD_PRESERVATION_PATH_ESCAPE',
    ],
    [
      'missing output declaration',
      plan => ({ ...plan, outputRoots: [] }),
      'BUILD_PRESERVATION_DECLARATION_MISSING',
    ],
  ])('fails closed for %s', (_label, mutate, expectedCode) => {
    const contract = createSyntheticContract();
    expect(captureFailure(() => validatePreservationPlan(mutate(contract.plan)))).toMatchObject({
      code: expectedCode,
    });
  });

  test('fails closed when an action requests an undeclared output root', () => {
    const contract = createSyntheticContract();
    const caught = captureFailure(() =>
      runWithBuildPreservation(contract.plan, ({ assertOutputRoot }) =>
        assertOutputRoot(path.join(contract.repoRoot, 'tmp', 'not-declared'))
      )
    );
    expect(caught).toMatchObject({ code: 'BUILD_PRESERVATION_OUTPUT_UNDECLARED' });
    expectBuildResidueAbsent(contract.plan);
  });

  test('reports exact restoration-failure evidence', () => {
    const contract = createSyntheticContract();
    const generatedFile = contract.plan.generatedFiles[0];
    const generatedParent = path.dirname(generatedFile);
    write(generatedFile, 'before');

    let caught;
    try {
      runWithBuildPreservation(contract.plan, () => {
        fs.rmSync(generatedParent, { recursive: true, force: true });
        write(generatedParent, 'blocks-restoration');
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BuildPreservationError);
    expect(caught).toMatchObject({
      code: 'BUILD_PRESERVATION_RESTORATION_FAILED',
      evidence: { restoration: 'failed', actionFailure: null },
    });
    expect(caught.evidence.failures).toEqual(
      expect.arrayContaining([expect.objectContaining({ phase: 'generated-restore', path: generatedFile })])
    );
    expectBuildResidueAbsent(contract.plan);
  });

  test('keeps the focused test and preservation helper outside product and qualification imports', () => {
    const helperSource = fs.readFileSync(path.join(ADMIN_ROOT, 'scripts', 'lib', 'release-build-preservation.js'), 'utf8');
    const wrapperSource = fs.readFileSync(path.join(ADMIN_ROOT, 'scripts', 'release-build-contract.js'), 'utf8');
    const testSource = fs.readFileSync(__filename, 'utf8');
    const combined = `${helperSource}\n${wrapperSource}\n${testSource}`;

    expect(helperSource).not.toMatch(/child_process|ISET-intake|qualification\/src/u);
    expect(testSource).not.toMatch(/scripts\/write-build-info|src\/generated\/.+require/u);
    expect(combined).not.toMatch(/qualification\/(?:src|packs|registries)/u);
  });
});
