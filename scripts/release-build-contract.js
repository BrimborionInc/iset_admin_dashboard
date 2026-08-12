#!/usr/bin/env node
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');
const { runWithBuildPreservation } = require('./lib/release-build-preservation');

const REPO_ROOT = path.resolve(__dirname, '..');
const PORTAL_ROOT = path.resolve(REPO_ROOT, '..', 'ISET-intake');

function parseArgs(argv) {
  const selected = new Set();
  argv.forEach(token => {
    if (token === '--admin') selected.add('admin');
    else if (token === '--portal') selected.add('portal');
    else if (token === '--all') {
      selected.add('admin');
      selected.add('portal');
    } else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/release-build-contract.js --admin|--portal|--all');
      process.exit(0);
    } else throw new Error(`Unknown option: ${token}`);
  });
  if (!selected.size) throw new Error('Select --admin, --portal, or --all');
  return selected;
}

function run(command, args, options) {
  const result = spawnSync(command, args, { ...options, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}

function createPreservationPlan({ repoRoot = REPO_ROOT, portalRoot = PORTAL_ROOT } = {}) {
  return {
    allowedRoots: [repoRoot, portalRoot],
    generatedFiles: [
      path.join(repoRoot, 'src', 'generated', 'buildInfo.js'),
      path.join(repoRoot, 'src', 'generated', 'publicReleaseNotes.js'),
      path.join(portalRoot, 'src', 'generated', 'buildInfo.js'),
      path.join(portalRoot, 'src', 'generated', 'publicBuildInfo.js'),
    ],
    outputRoots: [
      path.join(repoRoot, 'tmp', 'release-qualification', 'admin-build-contract'),
      path.join(portalRoot, 'tmp', 'release-qualification', 'portal-build-contract'),
    ],
  };
}

function createBuildSteps(selected, { repoRoot = REPO_ROOT, portalRoot = PORTAL_ROOT, baseEnv = process.env } = {}) {
  const steps = [];

  if (selected.has('admin')) {
    const outputRoot = path.join(repoRoot, 'tmp', 'release-qualification', 'admin-build-contract');
    steps.push({
      id: 'admin-build',
      outputRoot,
      command: 'npm',
      args: ['run', 'build:test'],
      options: {
        cwd: repoRoot,
        env: {
          ...baseEnv,
          BUILD_PATH: outputRoot,
          PATH_DEPLOY_ENV: 'test',
          PATH_RELEASE_ID: 'local-release-qualification',
        },
      },
    });
  }

  if (selected.has('portal')) {
    const outputRoot = path.join(portalRoot, 'tmp', 'release-qualification', 'portal-build-contract');
    steps.push({
      id: 'portal-build-info',
      outputRoot: null,
      command: process.execPath,
      args: [path.join(portalRoot, 'scripts', 'write-build-info.js'), '--build-target', 'test'],
      options: {
        cwd: portalRoot,
        env: { ...baseEnv, PATH_DEPLOY_ENV: 'test', PATH_RELEASE_ID: 'local-release-qualification' },
      },
    });
    steps.push({
      id: 'portal-build',
      outputRoot,
      command: 'npx',
      args: ['env-cmd', '-f', '.env.test', 'craco', 'build'],
      options: {
        cwd: portalRoot,
        env: {
          ...baseEnv,
          BUILD_PATH: outputRoot,
          PATH_DEPLOY_ENV: 'test',
          PATH_RELEASE_ID: 'local-release-qualification',
        },
      },
    });
  }

  return steps;
}

function main(argv = process.argv.slice(2)) {
  const selected = parseArgs(argv);
  const preservationPlan = createPreservationPlan();
  const steps = createBuildSteps(selected);

  runWithBuildPreservation(preservationPlan, ({ assertOutputRoot }) => {
    for (const step of steps) {
      if (step.outputRoot) assertOutputRoot(step.outputRoot);
      run(step.command, step.args, step.options);
    }
  });

  console.log(`Release build contract: PASS (${Array.from(selected).join(', ')})`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Release build contract: FAIL (${error.message || error})`);
    process.exitCode = 1;
  }
}

module.exports = {
  createBuildSteps,
  createPreservationPlan,
  main,
  parseArgs,
};
