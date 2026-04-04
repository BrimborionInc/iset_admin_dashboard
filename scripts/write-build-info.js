#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGE_JSON_PATH = path.join(REPO_ROOT, 'package.json');
const OUTPUT_PATH = path.join(REPO_ROOT, 'src', 'generated', 'buildInfo.js');

function parseArgs(argv) {
  const args = {
    buildTarget: '',
    releaseId: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--build-target' || token === '-t') {
      args.buildTarget = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (token === '--release-id') {
      args.releaseId = String(argv[index + 1] || '');
      index += 1;
      continue;
    }
    if (!token.startsWith('-') && !args.buildTarget) {
      args.buildTarget = String(token);
    }
  }

  return args;
}

function runGit(args) {
  try {
    return execFileSync('git', ['-C', REPO_ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) {
    return '';
  }
}

function buildDisplayLabel(buildInfo) {
  const parts = [`v${buildInfo.packageVersion}`];
  if (buildInfo.releaseId) {
    parts.push(buildInfo.releaseId);
  }
  if (buildInfo.gitShort) {
    parts.push(buildInfo.gitDirty ? `${buildInfo.gitShort}-dirty` : buildInfo.gitShort);
  }
  if (buildInfo.buildTarget) {
    parts.push(buildInfo.buildTarget);
  }
  return parts.join(' | ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'));
  const gitCommit = runGit(['rev-parse', 'HEAD']);
  const gitShort = runGit(['rev-parse', '--short=8', 'HEAD']);
  const dirtyOutput = runGit(['status', '--porcelain', '--untracked-files=no']);
  const releaseId = args.releaseId || process.env.PATH_RELEASE_ID || '';
  const buildTarget = args.buildTarget || process.env.PATH_DEPLOY_ENV || process.env.NODE_ENV || '';

  const buildInfo = {
    packageVersion: String(packageJson.version || '0.0.0'),
    releaseId,
    buildTarget,
    builtAt: new Date().toISOString(),
    gitCommit,
    gitShort,
    gitDirty: Boolean(dirtyOutput),
  };
  buildInfo.displayLabel = buildDisplayLabel(buildInfo);

  const output = [
    'const buildInfo = ' + JSON.stringify(buildInfo, null, 2) + ';',
    '',
    'export default buildInfo;',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, output, 'utf8');
  console.log(`Wrote ${path.relative(REPO_ROOT, OUTPUT_PATH)}: ${buildInfo.displayLabel}`);
}

main();
