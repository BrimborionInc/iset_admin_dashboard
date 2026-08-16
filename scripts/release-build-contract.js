#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

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

function snapshot(filename) {
  return fs.existsSync(filename) ? fs.readFileSync(filename) : null;
}

function restore(filename, value) {
  if (value === null) fs.rmSync(filename, { force: true });
  else fs.writeFileSync(filename, value);
}

function main() {
  const selected = parseArgs(process.argv.slice(2));
  const adminBuildInfo = path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js');
  const adminReleaseNotes = path.join(REPO_ROOT, 'src', 'generated', 'publicReleaseNotes.js');
  const portalBuildInfo = path.join(PORTAL_ROOT, 'src', 'generated', 'buildInfo.js');
  const savedAdminInfo = snapshot(adminBuildInfo);
  const savedAdminReleaseNotes = snapshot(adminReleaseNotes);
  const savedPortalInfo = snapshot(portalBuildInfo);
  const adminBuildPath = path.join(REPO_ROOT, 'tmp', 'release-qualification', 'admin-build-contract');
  const portalBuildPath = path.join(REPO_ROOT, 'tmp', 'release-qualification', 'portal-build-contract');

  try {
    if (selected.has('admin')) {
      fs.rmSync(adminBuildPath, { recursive: true, force: true });
      run('npm', ['run', 'build:test'], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          BUILD_PATH: adminBuildPath,
          PATH_DEPLOY_ENV: 'test',
          PATH_RELEASE_ID: 'local-release-qualification',
        },
      });
    }
    if (selected.has('portal')) {
      fs.rmSync(portalBuildPath, { recursive: true, force: true });
      run(process.execPath, [path.join(PORTAL_ROOT, 'scripts', 'write-build-info.js'), '--build-target', 'test'], {
        cwd: PORTAL_ROOT,
        env: { ...process.env, PATH_DEPLOY_ENV: 'test', PATH_RELEASE_ID: 'local-release-qualification' },
      });
      run('npx', ['env-cmd', '-f', '.env.test', 'craco', 'build'], {
        cwd: PORTAL_ROOT,
        env: {
          ...process.env,
          BUILD_PATH: portalBuildPath,
          PATH_DEPLOY_ENV: 'test',
          PATH_RELEASE_ID: 'local-release-qualification',
        },
      });
    }
  } finally {
    fs.rmSync(adminBuildPath, { recursive: true, force: true });
    fs.rmSync(portalBuildPath, { recursive: true, force: true });
    restore(adminBuildInfo, savedAdminInfo);
    restore(adminReleaseNotes, savedAdminReleaseNotes);
    restore(portalBuildInfo, savedPortalInfo);
  }

  console.log(`Release build contract: PASS (${Array.from(selected).join(', ')})`);
}

try {
  main();
} catch (error) {
  console.error(`Release build contract: FAIL (${error.message || error})`);
  process.exitCode = 1;
}
