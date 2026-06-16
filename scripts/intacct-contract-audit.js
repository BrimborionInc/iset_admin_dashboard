#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(
  repoRoot,
  'docs/data/integrations/intacct-interface-fidelity-manifest.json'
);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function relativeDisplay(filePath) {
  const rel = path.relative(repoRoot, filePath);
  return rel.startsWith('..') ? filePath : rel;
}

function printKnownGaps(knownGaps) {
  if (!Array.isArray(knownGaps) || knownGaps.length === 0) return;
  console.log('\nKnown Sage fidelity gaps:');
  for (const gap of knownGaps) {
    const severity = gap.severity || 'unknown';
    const status = gap.status || 'unknown';
    console.log(`- ${gap.id} [${severity}, ${status}]: ${gap.summary}`);
  }
}

function main() {
  const manifest = readJson(manifestPath);
  const checks = Array.isArray(manifest.localContractChecks)
    ? manifest.localContractChecks
    : [];
  const failures = [];
  const warnings = [];

  console.log('Intacct contract audit');
  console.log(`Manifest: ${path.relative(repoRoot, manifestPath)}`);
  console.log(`Last updated: ${manifest.lastUpdated || 'unknown'}`);
  console.log('Scope: local PATH/mock drift guard, not Sage certification.\n');

  for (const check of checks) {
    const checkId = check.id || '(unnamed-check)';
    const filePath = path.resolve(repoRoot, check.file || '');
    const required = toArray(check.mustContain);
    let content = '';

    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (err) {
      const issue = `${checkId}: cannot read ${relativeDisplay(filePath)} (${err.message})`;
      failures.push(issue);
      console.log(`FAIL ${issue}`);
      continue;
    }

    const missing = required.filter((needle) => !content.includes(needle));
    if (missing.length === 0) {
      console.log(`PASS ${checkId} (${relativeDisplay(filePath)})`);
      continue;
    }

    const issue = `${checkId}: missing ${missing.map((entry) => JSON.stringify(entry)).join(', ')} in ${relativeDisplay(filePath)}`;
    if (check.severity === 'advisory') {
      warnings.push(issue);
      console.log(`WARN ${issue}`);
    } else {
      failures.push(issue);
      console.log(`FAIL ${issue}`);
    }
  }

  printKnownGaps(manifest.knownGaps);

  if (warnings.length) {
    console.log(`\nWarnings: ${warnings.length}`);
  }

  if (failures.length) {
    console.error(`\nAudit failed: ${failures.length} local contract check(s) failed.`);
    process.exit(1);
  }

  console.log('\nAudit passed: local PATH/mock contract checks are in sync.');
  console.log(`For Sage fidelity status, see ${manifest.auditDoc}.`);
}

main();
