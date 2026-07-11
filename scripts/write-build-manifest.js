#!/usr/bin/env node

const path = require('path');
const { writeBuildManifest } = require('./lib/releaseAdmission');

function parseRepoRoot(argv) {
  const index = argv.indexOf('--repo-root');
  return index >= 0 ? path.resolve(argv[index + 1] || '.') : path.resolve(__dirname, '..');
}

try {
  const repoRoot = parseRepoRoot(process.argv.slice(2));
  const manifest = writeBuildManifest({ repoRoot });
  console.log(`Wrote ${path.join(repoRoot, 'build', 'path-build-manifest.json')} (${manifest.assets.fileCount} files)`);
} catch (error) {
  console.error(`[write-build-manifest] ${error.message}`);
  process.exit(1);
}

