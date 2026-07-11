const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const BUILD_MANIFEST_NAME = 'path-build-manifest.json';

function sha256Buffer(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sha256File(filename) {
  return sha256Buffer(fs.readFileSync(filename));
}

function listFiles(root, current = root) {
  const entries = fs.readdirSync(current, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name));
  const files = [];
  entries.forEach(entry => {
    const full = path.join(current, entry.name);
    const relative = path.relative(root, full).split(path.sep).join('/');
    if (relative === BUILD_MANIFEST_NAME) return;
    if (entry.isDirectory()) files.push(...listFiles(root, full));
    else if (entry.isFile()) files.push(relative);
  });
  return files;
}

function hashDirectory(root) {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Build directory not found: ${root}`);
  }
  const hash = crypto.createHash('sha256');
  const files = listFiles(root);
  files.forEach(relative => {
    hash.update(relative);
    hash.update('\0');
    hash.update(fs.readFileSync(path.join(root, relative)));
    hash.update('\0');
  });
  return { sha256: hash.digest('hex'), fileCount: files.length };
}

function readGeneratedBuildInfo(repoRoot) {
  const filename = path.join(repoRoot, 'src', 'generated', 'buildInfo.js');
  const source = fs.readFileSync(filename, 'utf8');
  const match = source.match(/const\s+buildInfo\s*=\s*(\{[\s\S]*?\});\s*\n/u);
  if (!match) throw new Error(`Unable to parse generated build info: ${filename}`);
  return JSON.parse(match[1]);
}

function writeBuildManifest({ repoRoot, buildPath = path.join(repoRoot, 'build') }) {
  const buildInfo = readGeneratedBuildInfo(repoRoot);
  const assets = hashDirectory(buildPath);
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    buildInfo,
    assets,
  };
  fs.writeFileSync(path.join(buildPath, BUILD_MANIFEST_NAME), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function validatePrebuiltBuild({ repoRoot, buildPath = path.join(repoRoot, 'build'), expected }) {
  const manifestPath = path.join(buildPath, BUILD_MANIFEST_NAME);
  if (!fs.existsSync(manifestPath)) throw new Error(`Prebuilt manifest is missing: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1) throw new Error('Unsupported prebuilt manifest schema');
  const info = manifest.buildInfo || {};
  const checks = [
    ['build target', info.buildTarget, expected.buildTarget],
    ['release ID', info.releaseId, expected.releaseId],
    ['Git commit', info.gitCommit, expected.gitCommit],
  ];
  checks.forEach(([label, actual, wanted]) => {
    if (String(actual || '') !== String(wanted || '')) {
      throw new Error(`Prebuilt ${label} mismatch: found '${actual || '<missing>'}', expected '${wanted || '<missing>'}'`);
    }
  });
  if (info.gitDirty && !expected.allowDirty) throw new Error('Prebuilt manifest was produced from a dirty source tree');
  const assets = hashDirectory(buildPath);
  if (assets.sha256 !== manifest.assets?.sha256 || assets.fileCount !== manifest.assets?.fileCount) {
    throw new Error('Prebuilt asset checksum mismatch');
  }
  return { manifestPath, buildInfo: info, assets };
}

function buildPreflightPlan(appPlan) {
  const needsBoth = Boolean(appPlan.deployShared);
  const checks = [];
  if (appPlan.deployAdmin || needsBoth) {
    checks.push({ id: 'admin-tests', repo: 'adminDashboard', command: 'npm', args: ['test'] });
    checks.push({ id: 'admin-lint', repo: 'adminDashboard', command: 'npm', args: ['run', 'lint', '--', '--quiet'] });
  }
  if (appPlan.deployPortal || needsBoth) {
    checks.push({ id: 'portal-tests', repo: 'portal', command: 'npm', args: ['test'] });
    checks.push({ id: 'portal-lint', repo: 'portal', command: 'npm', args: ['run', 'lint', '--', '--quiet'] });
  }
  if (appPlan.deployAdmin || appPlan.deployPortal || needsBoth) {
    checks.push({ id: 'privacy-routes', repo: 'adminDashboard', command: 'npm', args: ['run', 'smoke:privacy-routes'] });
  }
  return checks;
}

function buildImmutableArtifactRecord({ component, releaseId, archivePath }) {
  const sha256 = sha256File(archivePath);
  const extension = path.extname(archivePath) || '.zip';
  return {
    component,
    sha256,
    bytes: fs.statSync(archivePath).size,
    key: `releases/${String(releaseId)}/${component}/${component}-${sha256}${extension}`,
  };
}

function createReleaseDescriptor({ releaseId, environment, requiredComponents, artifacts, source, preflight }) {
  const artifactMap = artifacts || {};
  const missing = requiredComponents.filter(component => !artifactMap[component]?.sha256 || !artifactMap[component]?.key);
  if (missing.length) throw new Error(`Release descriptor is incomplete: missing ${missing.join(', ')}`);
  const descriptor = {
    schemaVersion: 1,
    releaseId,
    environment,
    source,
    preflight,
    artifacts: Object.fromEntries(requiredComponents.map(component => [component, artifactMap[component]])),
  };
  return { ...descriptor, descriptorSha256: sha256Buffer(JSON.stringify(descriptor)) };
}

function buildActiveReleasePointer(descriptor) {
  if (!descriptor?.descriptorSha256 || !descriptor?.releaseId) throw new Error('A complete release descriptor is required');
  return {
    schemaVersion: 1,
    releaseId: descriptor.releaseId,
    descriptorKey: `releases/${descriptor.releaseId}/release-descriptor.json`,
    descriptorSha256: descriptor.descriptorSha256,
  };
}

module.exports = {
  BUILD_MANIFEST_NAME,
  buildActiveReleasePointer,
  buildImmutableArtifactRecord,
  buildPreflightPlan,
  createReleaseDescriptor,
  hashDirectory,
  readGeneratedBuildInfo,
  sha256File,
  validatePrebuiltBuild,
  writeBuildManifest,
};
