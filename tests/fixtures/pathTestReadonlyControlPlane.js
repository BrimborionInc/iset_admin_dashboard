'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  ARTIFACTS,
  EXPECTED_ACCOUNT,
  EXPECTED_ASG,
  EXPECTED_BUCKET,
  EXPECTED_OPERATOR_ARN,
  EXPECTED_PROFILE,
  EXPECTED_REGION,
  TARGETS,
} = require('../../scripts/path-test-readonly-control-plane');
const { createEvidenceId } = require('../../src/lib/releaseQualification');

const RELEASE_ID = '20260809-two-step-review-assurance-r31';
const GENERATED_AT = '2026-08-10T03:23:30.461Z';
const EXPIRES_AT = '2026-08-13T03:23:30.461Z';
const ADMISSION_STARTED_AT = '2026-08-10T03:24:22.279Z';

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function sourceIdentity(seed) {
  return {
    gitHead: seed.repeat(40),
    treeFingerprint: seed.repeat(64),
    gitDirty: false,
    fileCount: 1,
  };
}

function sourceSet() {
  return {
    admin: sourceIdentity('a'),
    portal: sourceIdentity('b'),
    shared: sourceIdentity('c'),
  };
}

function repoSource(source) {
  return {
    adminDashboard: { ...source.admin },
    portal: { ...source.portal },
    shared: { ...source.shared },
  };
}

function createSyntheticHistoricalInputs() {
  const source = sourceSet();
  const schemaSha256 = 'd'.repeat(64);
  const requiredChecks = ['inventory-contract', 'portal-build', 'candidate-source-stability'];
  const evidence = {
    schemaVersion: 1,
    generatedAt: GENERATED_AT,
    expiresAt: EXPIRES_AT,
    stage: 'dev',
    releaseId: RELEASE_ID,
    decision: 'GO',
    inventorySha256: 'e'.repeat(64),
    candidate: {
      components: ['admin', 'portal', 'shared'],
      source,
      schemaSha256,
    },
    requiredChecks,
    checks: requiredChecks.map(id => ({ id, status: 'passed' })),
    blockers: [],
  };
  evidence.evidenceId = createEvidenceId(evidence);

  const preflightSource = repoSource(source);
  const preflightChecks = ['admin-tests', 'admin-lint', 'portal-tests', 'portal-lint', 'privacy-routes']
    .map(id => ({ id, status: 'successful' }));
  const manifest = {
    generatedAt: '2026-08-10T03:30:18.512Z',
    status: 'successful',
    releaseId: RELEASE_ID,
    environment: 'test',
    profile: EXPECTED_PROFILE,
    region: EXPECTED_REGION,
    identity: {
      account: EXPECTED_ACCOUNT,
      arn: EXPECTED_OPERATOR_ARN,
      userId: 'synthetic-operator',
    },
    qualification: {
      stage: 'dev',
      decision: 'GO',
      evidenceId: evidence.evidenceId,
      releaseId: RELEASE_ID,
      expiresAt: EXPIRES_AT,
      candidate: {
        components: ['admin', 'portal', 'shared'],
        source,
        schemaSha256,
      },
    },
    repos: repoSource(source),
    preflight: {
      schemaVersion: 1,
      originalSource: preflightSource,
      source: repoSource(source),
      checks: preflightChecks,
      evidenceId: 'f'.repeat(64),
    },
    steps: [{
      name: 'release.qualification',
      status: 'successful',
      startedAt: ADMISSION_STARTED_AT,
      finishedAt: '2026-08-10T03:24:22.283Z',
    }],
    appApply: {
      deployAdmin: true,
      deployPortal: true,
      refreshProd: false,
      artifacts: {
        admin: {
          artifact: `s3://${EXPECTED_BUCKET}/${ARTIFACTS.adminCurrent.key}`,
          archiveBytes: 111,
          rollbackArtifact: {
            uri: `s3://${EXPECTED_BUCKET}/${ARTIFACTS.adminRollback.key}`,
            key: ARTIFACTS.adminRollback.key,
            bytes: 101,
            lastModified: '2026-08-10T02:49:26.000Z',
          },
        },
        portal: {
          artifact: `s3://${EXPECTED_BUCKET}/${ARTIFACTS.portalCurrent.key}`,
          archiveBytes: 222,
          rollbackArtifact: {
            uri: `s3://${EXPECTED_BUCKET}/${ARTIFACTS.portalRollback.key}`,
            key: ARTIFACTS.portalRollback.key,
            bytes: 202,
            lastModified: '2026-08-10T02:51:06.000Z',
          },
        },
      },
    },
    smokeResults: ['admin', 'portal'].map(component => ({
      service: component,
      targetGroupName: TARGETS[component].name,
      targetGroupArn: `arn:aws:elasticloadbalancing:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:targetgroup/${TARGETS[component].name}/synthetic`,
      ok: true,
      targets: [{ id: 'i-0123456789abcdef0', port: TARGETS[component].port, state: 'healthy' }],
    })),
    synthetic: {
      purpose: 'clean-checkout unit input',
      asg: EXPECTED_ASG,
    },
  };

  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const devEvidenceBytes = Buffer.from(`${JSON.stringify(evidence, null, 2)}\n`);
  return {
    manifest,
    evidence,
    manifestBytes,
    devEvidenceBytes,
    manifestSha256: sha256(manifestBytes),
    devEvidenceSha256: sha256(devEvidenceBytes),
  };
}

function writeSyntheticHistoricalInputs(root) {
  const inputs = createSyntheticHistoricalInputs();
  const manifestPath = path.join(root, 'synthetic-r31-manifest.json');
  const devEvidencePath = path.join(root, 'synthetic-r31-dev-evidence.json');
  fs.writeFileSync(manifestPath, inputs.manifestBytes, { flag: 'wx' });
  fs.writeFileSync(devEvidencePath, inputs.devEvidenceBytes, { flag: 'wx' });
  return { ...inputs, manifestPath, devEvidencePath };
}

module.exports = {
  createSyntheticHistoricalInputs,
  writeSyntheticHistoricalInputs,
};
