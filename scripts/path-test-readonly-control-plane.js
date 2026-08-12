#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXPECTED_MANIFEST_PATH = path.join(
  REPO_ROOT,
  'tmp/path-deploy/test/20260809-two-step-review-assurance-r31--2026-08-10T03-24-21-698Z.json'
);
const EXPECTED_PROFILE = 'nwac-test';
const EXPECTED_REGION = 'ca-central-1';
const EXPECTED_ACCOUNT = '124355655255';
const EXPECTED_OPERATOR_ARN = `arn:aws:iam::${EXPECTED_ACCOUNT}:user/CODEX_CLI_Admin`;
const EXPECTED_REMOTE_ROLE = 'nwac-test-app-role';
const EXPECTED_ASG = 'nwac-test-asg';
const EXPECTED_BUCKET = 'nwac-test-artifacts';
const EXPECTED_SSM_DOCUMENT = 'AWS-RunShellScript';
const EXPECTED_SSM_DOCUMENT_ARN = `arn:aws:ssm:${EXPECTED_REGION}::document/${EXPECTED_SSM_DOCUMENT}`;
const CHECK_ID = 'test-readonly-control-plane';
const OPERATION_CLASS = 'release-operation:test-readonly-provenance';
const RELEASE_AUTHORITY = 'none';
const EVIDENCE_ROOT = path.join(REPO_ROOT, 'tmp/release-qualification/test-control-plane');
const PROVENANCE_PATHS = Object.freeze({
  admin: '/opt/nwac/admin-dashboard/.path-release-provenance.json',
  portal: '/opt/nwac/portal/.path-release-provenance.json',
});
const TARGETS = Object.freeze({
  admin: Object.freeze({ name: 'nwac-test-admin-tg', port: 5001 }),
  portal: Object.freeze({ name: 'nwac-test-portal-tg', port: 5000 }),
});
const ARTIFACTS = Object.freeze({
  adminCurrent: Object.freeze({
    component: 'admin',
    role: 'current',
    key: 'admin-dashboard/admin-dashboard-20260809-232714.zip',
  }),
  portalCurrent: Object.freeze({
    component: 'portal',
    role: 'current',
    key: 'portal/portal-20260809-232859.zip',
  }),
  adminRollback: Object.freeze({
    component: 'admin',
    role: 'rollback',
    key: 'admin-dashboard/admin-dashboard-20260809-224917.zip',
  }),
  portalRollback: Object.freeze({
    component: 'portal',
    role: 'rollback',
    key: 'portal/portal-20260809-225102.zip',
  }),
});
const SOURCE_PATHS = Object.freeze([
  __filename,
  path.join(REPO_ROOT, 'scripts/path-deploy.js'),
  path.join(REPO_ROOT, 'scripts/lib/test-instance-aws-identity.js'),
]);
const DEFAULT_LIMITS = Object.freeze({
  awsCommandMs: 20_000,
  ssmExecutionSeconds: 60,
  ssmPollMs: 1_000,
  ssmTotalMs: 90_000,
  ssmCancellationMs: 20_000,
  totalAttemptMs: 300_000,
  maxOutputBytes: 4 * 1024 * 1024,
  maxProvenanceBytes: 1024 * 1024,
});

class ControlPlaneError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ControlPlaneError';
    this.code = code;
    this.details = details;
  }
}

function usage() {
  process.stdout.write([
    'Usage: node scripts/path-test-readonly-control-plane.js [options]',
    '',
    'Options:',
    `  --manifest PATH       Exact retained r31 manifest (required)`,
    `  --profile NAME        Must be ${EXPECTED_PROFILE}`,
    `  --region REGION       Must be ${EXPECTED_REGION}`,
    '  --attempt-id ID       Fresh attempt identifier (required)',
    '  --evidence-out PATH   Attempt-owned final.json path (required)',
    '  --json                Emit the final result as JSON',
    '  --help                Show this help',
  ].join('\n') + '\n');
}

function parseArgs(argv) {
  const args = {
    manifest: null,
    profile: null,
    region: null,
    attemptId: null,
    evidenceOut: null,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--manifest') args.manifest = argv[++index];
    else if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--attempt-id') args.attemptId = argv[++index];
    else if (token === '--evidence-out') args.evidenceOut = argv[++index];
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new ControlPlaneError('ARGUMENT_INVALID', `Unknown option: ${token}`);
  }
  return args;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readFileBounded(filename, maxBytes) {
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new ControlPlaneError('SOURCE_NOT_REGULAR', `Required input is not a regular file: ${filename}`);
  }
  if (stat.size > maxBytes) {
    throw new ControlPlaneError('SOURCE_TOO_LARGE', `Required input exceeds its byte limit: ${filename}`);
  }
  return fs.readFileSync(filename);
}

function parseJsonBytes(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new ControlPlaneError('JSON_MALFORMED', `${label} is not valid JSON: ${error.message}`);
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ControlPlaneError('FIELD_MALFORMED', `${label} must be an object`);
  }
  return value;
}

function requireExact(actual, expected, label) {
  if (actual !== expected) {
    throw new ControlPlaneError('FIELD_CONFLICT', `${label} must equal ${JSON.stringify(expected)}`);
  }
}

function requireNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ControlPlaneError('FIELD_MALFORMED', `${label} must be a non-empty string`);
  }
  return value;
}

function requireDigest(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new ControlPlaneError('FIELD_MALFORMED', `${label} must be a lowercase SHA-256 digest`);
  }
  return value;
}

function requireTimestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) {
    throw new ControlPlaneError('FIELD_MALFORMED', `${label} must be an ISO timestamp`);
  }
  return value;
}

function sameTimestamp(left, right) {
  return Number.isFinite(Date.parse(left))
    && Number.isFinite(Date.parse(right))
    && Date.parse(left) === Date.parse(right);
}

function sourceIdentity(source, label) {
  const value = requireObject(source, label);
  return {
    gitHead: requireNonEmptyString(value.gitHead, `${label}.gitHead`),
    treeFingerprint: requireDigest(value.treeFingerprint, `${label}.treeFingerprint`),
    gitDirty: value.gitDirty,
  };
}

function assertSameSource(actual, expected, label) {
  const normalized = sourceIdentity(actual, label);
  requireExact(normalized.gitHead, expected.gitHead, `${label}.gitHead`);
  requireExact(normalized.treeFingerprint, expected.treeFingerprint, `${label}.treeFingerprint`);
  requireExact(normalized.gitDirty, false, `${label}.gitDirty`);
}

function parseS3Uri(uri, label) {
  const match = /^s3:\/\/([^/]+)\/(.+)$/u.exec(requireNonEmptyString(uri, label));
  if (!match) throw new ControlPlaneError('FIELD_MALFORMED', `${label} must be an S3 URI`);
  return { bucket: match[1], key: match[2] };
}

function validateManifestObject(manifest, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  requireObject(manifest, 'manifest');
  requireExact(manifest.status, 'successful', 'manifest.status');
  requireExact(manifest.environment, 'test', 'manifest.environment');
  requireExact(manifest.profile, EXPECTED_PROFILE, 'manifest.profile');
  requireExact(manifest.region, EXPECTED_REGION, 'manifest.region');
  const releaseId = requireNonEmptyString(manifest.releaseId, 'manifest.releaseId');

  const identity = requireObject(manifest.identity, 'manifest.identity');
  requireExact(String(identity.account), EXPECTED_ACCOUNT, 'manifest.identity.account');
  requireExact(identity.arn, EXPECTED_OPERATOR_ARN, 'manifest.identity.arn');
  requireNonEmptyString(identity.userId, 'manifest.identity.userId');

  const qualification = requireObject(manifest.qualification, 'manifest.qualification');
  requireExact(qualification.stage, 'dev', 'manifest.qualification.stage');
  requireExact(qualification.decision, 'GO', 'manifest.qualification.decision');
  requireExact(qualification.releaseId, releaseId, 'manifest.qualification.releaseId');
  const evidenceId = requireDigest(qualification.evidenceId, 'manifest.qualification.evidenceId');
  const expiresAt = requireTimestamp(qualification.expiresAt, 'manifest.qualification.expiresAt');
  if (Date.parse(expiresAt) <= nowMs) {
    throw new ControlPlaneError('MANIFEST_STALE', 'The retained qualification evidence has expired');
  }

  const candidate = requireObject(qualification.candidate, 'manifest.qualification.candidate');
  const components = candidate.components;
  if (!Array.isArray(components) || JSON.stringify(components) !== JSON.stringify(['admin', 'portal', 'shared'])) {
    throw new ControlPlaneError('FIELD_CONFLICT', 'manifest qualification components must be admin, portal, shared');
  }
  const candidateSource = requireObject(candidate.source, 'manifest.qualification.candidate.source');
  const source = {
    admin: sourceIdentity(candidateSource.admin, 'manifest candidate admin'),
    portal: sourceIdentity(candidateSource.portal, 'manifest candidate portal'),
    shared: sourceIdentity(candidateSource.shared, 'manifest candidate shared'),
  };
  for (const [name, value] of Object.entries(source)) requireExact(value.gitDirty, false, `manifest candidate ${name}.gitDirty`);

  const repos = requireObject(manifest.repos, 'manifest.repos');
  assertSameSource(repos.adminDashboard, source.admin, 'manifest.repos.adminDashboard');
  assertSameSource(repos.portal, source.portal, 'manifest.repos.portal');
  assertSameSource(repos.shared, source.shared, 'manifest.repos.shared');

  const preflight = requireObject(manifest.preflight, 'manifest.preflight');
  requireExact(preflight.schemaVersion, 1, 'manifest.preflight.schemaVersion');
  requireDigest(preflight.evidenceId, 'manifest.preflight.evidenceId');
  const expectedChecks = new Set(['admin-tests', 'admin-lint', 'portal-tests', 'portal-lint', 'privacy-routes']);
  if (!Array.isArray(preflight.checks) || preflight.checks.length !== expectedChecks.size) {
    throw new ControlPlaneError('FIELD_MALFORMED', 'manifest.preflight.checks is incomplete');
  }
  for (const check of preflight.checks) {
    requireObject(check, 'manifest.preflight.check');
    if (!expectedChecks.delete(check.id)) throw new ControlPlaneError('FIELD_CONFLICT', `Unexpected or duplicate preflight check: ${check.id}`);
    requireExact(check.status, 'successful', `preflight check ${check.id}.status`);
  }
  if (expectedChecks.size) throw new ControlPlaneError('FIELD_CONFLICT', 'manifest preflight checks are incomplete');
  for (const branch of ['originalSource', 'source']) {
    const branchSource = requireObject(preflight[branch], `manifest.preflight.${branch}`);
    assertSameSource(branchSource.adminDashboard, source.admin, `manifest.preflight.${branch}.adminDashboard`);
    assertSameSource(branchSource.portal, source.portal, `manifest.preflight.${branch}.portal`);
    assertSameSource(branchSource.shared, source.shared, `manifest.preflight.${branch}.shared`);
  }

  if (!Array.isArray(manifest.steps) || manifest.steps.length === 0 || manifest.steps.some(step => step?.status !== 'successful')) {
    throw new ControlPlaneError('FIELD_CONFLICT', 'Every retained deployment step must be successful');
  }
  const appApply = requireObject(manifest.appApply, 'manifest.appApply');
  requireExact(appApply.deployAdmin, true, 'manifest.appApply.deployAdmin');
  requireExact(appApply.deployPortal, true, 'manifest.appApply.deployPortal');
  requireExact(appApply.refreshProd, false, 'manifest.appApply.refreshProd');
  const manifestArtifacts = requireObject(appApply.artifacts, 'manifest.appApply.artifacts');

  const artifacts = {};
  for (const component of ['admin', 'portal']) {
    const entry = requireObject(manifestArtifacts[component], `manifest.appApply.artifacts.${component}`);
    const current = parseS3Uri(entry.artifact, `${component} current artifact`);
    requireExact(current.bucket, EXPECTED_BUCKET, `${component} current bucket`);
    requireExact(current.key, ARTIFACTS[`${component}Current`].key, `${component} current key`);
    if (!Number.isInteger(entry.archiveBytes) || entry.archiveBytes <= 0) {
      throw new ControlPlaneError('FIELD_MALFORMED', `${component} archiveBytes must be positive`);
    }
    const rollback = requireObject(entry.rollbackArtifact, `${component} rollback artifact`);
    const rollbackUri = parseS3Uri(rollback.uri, `${component} rollback URI`);
    requireExact(rollbackUri.bucket, EXPECTED_BUCKET, `${component} rollback bucket`);
    requireExact(rollbackUri.key, ARTIFACTS[`${component}Rollback`].key, `${component} rollback URI key`);
    requireExact(rollback.key, rollbackUri.key, `${component} rollback key`);
    if (!Number.isInteger(rollback.bytes) || rollback.bytes <= 0) {
      throw new ControlPlaneError('FIELD_MALFORMED', `${component} rollback bytes must be positive`);
    }
    requireTimestamp(rollback.lastModified, `${component} rollback lastModified`);
    artifacts[`${component}Current`] = { ...ARTIFACTS[`${component}Current`], bytes: entry.archiveBytes };
    artifacts[`${component}Rollback`] = {
      ...ARTIFACTS[`${component}Rollback`],
      bytes: rollback.bytes,
      lastModified: rollback.lastModified,
    };
  }

  if (!Array.isArray(manifest.smokeResults) || manifest.smokeResults.length !== 2) {
    throw new ControlPlaneError('FIELD_MALFORMED', 'manifest.smokeResults must contain admin and portal');
  }
  for (const [component, expected] of Object.entries(TARGETS)) {
    const result = manifest.smokeResults.find(value => value?.service === component);
    if (!result) throw new ControlPlaneError('FIELD_CONFLICT', `manifest smoke result missing ${component}`);
    requireExact(result.targetGroupName, expected.name, `${component} smoke target group`);
    requireExact(result.ok, true, `${component} smoke status`);
    requireNonEmptyString(result.targetGroupArn, `${component} smoke target ARN`);
    if (!Array.isArray(result.targets) || result.targets.length === 0 || result.targets.some(target => target.state !== 'healthy')) {
      throw new ControlPlaneError('FIELD_CONFLICT', `${component} retained smoke targets must be healthy`);
    }
  }

  return {
    releaseId,
    evidenceId,
    preflightEvidenceId: preflight.evidenceId,
    expiresAt,
    identity: { account: String(identity.account), arn: identity.arn, userId: identity.userId },
    source,
    schemaSha256: requireDigest(candidate.schemaSha256, 'manifest candidate schemaSha256'),
    artifacts,
  };
}

function loadAndValidateManifest(manifestPath, options = {}) {
  const bytes = readFileBounded(manifestPath, 16 * 1024 * 1024);
  const model = validateManifestObject(parseJsonBytes(bytes, 'retained TEST manifest'), options);
  return { bytes, digest: sha256(bytes), model };
}

function captureSourceState(paths = SOURCE_PATHS) {
  return paths.map(filename => {
    const bytes = readFileBounded(filename, 32 * 1024 * 1024);
    return {
      path: path.relative(REPO_ROOT, filename).replace(/\\/gu, '/'),
      bytes: bytes.length,
      sha256: sha256(bytes),
    };
  });
}

function assertStableSource(before, after) {
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new ControlPlaneError('SOURCE_DRIFT', 'Admitted local source changed during the attempt', { before, after });
  }
}

function validateCliBoundary(args) {
  if (args.help) return;
  requireExact(args.profile, EXPECTED_PROFILE, '--profile');
  requireExact(args.region, EXPECTED_REGION, '--region');
  if (!args.manifest || path.resolve(args.manifest) !== EXPECTED_MANIFEST_PATH) {
    throw new ControlPlaneError('MANIFEST_PATH_REJECTED', `--manifest must be ${EXPECTED_MANIFEST_PATH}`);
  }
  if (typeof args.attemptId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(args.attemptId)) {
    throw new ControlPlaneError('ATTEMPT_ID_INVALID', '--attempt-id must be an explicit fresh identifier');
  }
  const expectedEvidence = path.join(EVIDENCE_ROOT, args.attemptId, 'final.json');
  if (!args.evidenceOut || path.resolve(args.evidenceOut) !== expectedEvidence) {
    throw new ControlPlaneError('EVIDENCE_PATH_REJECTED', `--evidence-out must be ${expectedEvidence}`);
  }
}

function writeAtomic(filename, bytes) {
  const temporary = `${filename}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, bytes, { flag: 'wx' });
  fs.renameSync(temporary, filename);
}

function createEvidenceRecorder(evidenceOut, attemptId, clock = () => new Date()) {
  const root = path.dirname(evidenceOut);
  if (fs.existsSync(root) && fs.readdirSync(root).length > 0) {
    throw new ControlPlaneError('EVIDENCE_ROOT_NOT_FRESH', `Evidence root is not empty: ${root}`);
  }
  fs.mkdirSync(root, { recursive: true });
  const eventsPath = path.join(root, 'events.ndjson');
  let sequence = 0;
  const events = [];
  function record(type, payload = {}) {
    const event = { sequence: ++sequence, at: clock().toISOString(), type, payload };
    events.push(event);
    fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
    writeAtomic(path.join(root, 'partial.json'), `${JSON.stringify({ attemptId, events }, null, 2)}\n`);
    return event;
  }
  function finalize(value) {
    const body = `${JSON.stringify(value, null, 2)}\n`;
    writeAtomic(evidenceOut, body);
    writeAtomic(`${evidenceOut}.sha256`, `${sha256(Buffer.from(body))}  ${path.basename(evidenceOut)}\n`);
    return { path: evidenceOut, sha256: sha256(Buffer.from(body)), bytes: Buffer.byteLength(body) };
  }
  return { root, eventsPath, record, finalize, get events() { return [...events]; } };
}

function verifyEvidenceDigest(evidenceOut) {
  const bytes = fs.readFileSync(evidenceOut);
  const digestLine = fs.readFileSync(`${evidenceOut}.sha256`, 'utf8').trim();
  const expected = digestLine.split(/\s+/u)[0];
  const actual = sha256(bytes);
  if (!/^[a-f0-9]{64}$/u.test(expected) || actual !== expected) {
    throw new ControlPlaneError('EVIDENCE_DIGEST_MISMATCH', 'Final evidence digest does not match retained bytes');
  }
  return { sha256: actual, bytes: bytes.length };
}

function sanitizedFailure(error, phase) {
  return {
    code: error?.code || 'UNCLASSIFIED',
    phase,
    message: String(error?.message || error).slice(0, 4000),
    details: error?.details || {},
  };
}

function validateLocalIdentity(identity) {
  requireObject(identity, 'local identity');
  requireExact(String(identity.Account), EXPECTED_ACCOUNT, 'local identity account');
  requireExact(identity.Arn, EXPECTED_OPERATOR_ARN, 'local identity ARN');
  return { account: String(identity.Account), arn: identity.Arn, userId: requireNonEmptyString(identity.UserId, 'local identity user ID') };
}

function validateCompute(asgResponse, ssmResponse) {
  const groups = asgResponse?.AutoScalingGroups;
  if (!Array.isArray(groups) || groups.length !== 1 || groups[0]?.AutoScalingGroupName !== EXPECTED_ASG) {
    throw new ControlPlaneError('ASG_SCOPE_INVALID', `Expected exactly one ${EXPECTED_ASG} group`);
  }
  const instances = groups[0].Instances;
  if (!Array.isArray(instances) || instances.length === 0) {
    throw new ControlPlaneError('ASG_SCOPE_EMPTY', `${EXPECTED_ASG} has no instances`);
  }
  const admitted = [];
  for (const instance of instances) {
    requireNonEmptyString(instance.InstanceId, 'ASG instance ID');
    requireExact(instance.LifecycleState, 'InService', `${instance.InstanceId} lifecycle`);
    requireExact(instance.HealthStatus, 'Healthy', `${instance.InstanceId} health`);
    admitted.push(instance.InstanceId);
  }
  if (new Set(admitted).size !== admitted.length) throw new ControlPlaneError('ASG_SCOPE_AMBIGUOUS', 'ASG returned duplicate instances');
  const onlineRows = ssmResponse?.InstanceInformationList;
  if (!Array.isArray(onlineRows)) throw new ControlPlaneError('SSM_SCOPE_INVALID', 'SSM instance inventory is missing');
  const online = new Set(onlineRows.filter(row => row?.PingStatus === 'Online').map(row => row.InstanceId));
  const missing = admitted.filter(instanceId => !online.has(instanceId));
  if (missing.length) throw new ControlPlaneError('SSM_INSTANCE_OFFLINE', 'Not every admitted ASG instance is online in SSM', { missing });
  return admitted.sort();
}

function targetGroupArnPattern(name) {
  return new RegExp(`^arn:aws:elasticloadbalancing:${EXPECTED_REGION}:${EXPECTED_ACCOUNT}:targetgroup/${name}/[A-Za-z0-9]+$`, 'u');
}

function validateTargetGroupIdentity(component, groupResponse) {
  const expected = TARGETS[component];
  const groups = groupResponse?.TargetGroups;
  if (!Array.isArray(groups) || groups.length !== 1) throw new ControlPlaneError('TARGET_GROUP_AMBIGUOUS', `${component} target group lookup was not exact`);
  const group = groups[0];
  requireExact(group.TargetGroupName, expected.name, `${component} target group name`);
  requireExact(group.Port, expected.port, `${component} target group port`);
  if (!targetGroupArnPattern(expected.name).test(group.TargetGroupArn || '')) {
    throw new ControlPlaneError('TARGET_GROUP_IDENTITY_INVALID', `${component} target group ARN does not belong to TEST`);
  }
  return group;
}

function validateTarget(component, groupResponse, healthResponse, admittedInstances) {
  const expected = TARGETS[component];
  const group = validateTargetGroupIdentity(component, groupResponse);
  const descriptions = healthResponse?.TargetHealthDescriptions;
  if (!Array.isArray(descriptions) || descriptions.length === 0) throw new ControlPlaneError('TARGET_HEALTH_EMPTY', `${component} has no registered targets`);
  const targets = descriptions.map(row => {
    const id = requireNonEmptyString(row?.Target?.Id, `${component} target ID`);
    requireExact(row.Target.Port, expected.port, `${component} target port`);
    requireExact(row?.TargetHealth?.State, 'healthy', `${component} target health`);
    return id;
  }).sort();
  if (new Set(targets).size !== targets.length || JSON.stringify(targets) !== JSON.stringify(admittedInstances)) {
    throw new ControlPlaneError('TARGET_MEMBERSHIP_MISMATCH', `${component} target membership does not equal the admitted ASG/SSM set`, {
      admittedInstances,
      targets,
    });
  }
  return { component, name: expected.name, arn: group.TargetGroupArn, port: expected.port, targets };
}

function validateHeadObject(definition, response) {
  requireObject(response, `${definition.component} ${definition.role} HeadObject`);
  if (Number(response.ContentLength) !== definition.bytes) {
    throw new ControlPlaneError('ARTIFACT_SIZE_MISMATCH', `${definition.component} ${definition.role} artifact size differs from the manifest`);
  }
  if (definition.lastModified && !sameTimestamp(response.LastModified, definition.lastModified)) {
    throw new ControlPlaneError('ARTIFACT_TIME_MISMATCH', `${definition.component} rollback lastModified differs from the manifest`);
  }
  return {
    component: definition.component,
    role: definition.role,
    bucket: EXPECTED_BUCKET,
    key: definition.key,
    contentLength: Number(response.ContentLength),
    lastModified: requireTimestamp(response.LastModified, `${definition.component} ${definition.role} LastModified`),
    eTag: typeof response.ETag === 'string' ? response.ETag : null,
    versionId: typeof response.VersionId === 'string' ? response.VersionId : null,
  };
}

function validateRemoteIdentity(identity, instanceId) {
  requireObject(identity, `remote identity ${instanceId}`);
  requireExact(String(identity.Account), EXPECTED_ACCOUNT, `remote identity ${instanceId} account`);
  const pattern = new RegExp(`^arn:aws:sts::${EXPECTED_ACCOUNT}:assumed-role/${EXPECTED_REMOTE_ROLE}/[^/]+$`, 'u');
  if (!pattern.test(identity.Arn || '')) throw new ControlPlaneError('REMOTE_ROLE_MISMATCH', `Remote identity on ${instanceId} is not ${EXPECTED_REMOTE_ROLE}`);
  return { account: String(identity.Account), arn: identity.Arn, userId: requireNonEmptyString(identity.UserId, 'remote identity user ID') };
}

function validateProvenance(component, entry, manifestModel) {
  requireObject(entry, `${component} remote provenance`);
  requireDigest(entry.rawSha256, `${component} raw provenance digest`);
  if (!Number.isInteger(entry.bytes) || entry.bytes <= 0 || entry.bytes > DEFAULT_LIMITS.maxProvenanceBytes) {
    throw new ControlPlaneError('PROVENANCE_SIZE_INVALID', `${component} provenance byte count is invalid`);
  }
  const value = requireObject(entry.value, `${component} provenance value`);
  requireExact(value.schemaVersion, 1, `${component} provenance schemaVersion`);
  requireExact(value.releaseId, manifestModel.releaseId, `${component} provenance releaseId`);
  requireExact(value.environment, 'test', `${component} provenance environment`);
  requireExact(value.component, component, `${component} provenance component`);
  requireExact(value.qualificationEvidenceId, manifestModel.evidenceId, `${component} provenance qualificationEvidenceId`);
  const deployedSource = requireObject(value.source, `${component} provenance source`);
  for (const repository of ['admin', 'portal', 'shared']) {
    assertSameSource(deployedSource[repository], manifestModel.source[repository], `${component} provenance source.${repository}`);
  }
  return {
    component,
    path: PROVENANCE_PATHS[component],
    rawSha256: entry.rawSha256,
    bytes: entry.bytes,
    value: {
      schemaVersion: value.schemaVersion,
      releaseId: value.releaseId,
      environment: value.environment,
      component: value.component,
      qualificationEvidenceId: value.qualificationEvidenceId,
      source: value.source,
      generatedAt: requireTimestamp(value.generatedAt, `${component} provenance generatedAt`),
    },
  };
}

function parseRemoteOutput(output) {
  const marker = 'PATH_PHASE7_RESULT=';
  const matches = String(output || '').split(/\r?\n/u).filter(line => line.startsWith(marker));
  if (matches.length !== 1) throw new ControlPlaneError('REMOTE_RESULT_COUNT_INVALID', 'Remote output must contain exactly one framed result');
  let bytes;
  try {
    bytes = Buffer.from(matches[0].slice(marker.length), 'base64');
  } catch (error) {
    throw new ControlPlaneError('REMOTE_RESULT_MALFORMED', `Remote result encoding failed: ${error.message}`);
  }
  if (bytes.length === 0 || bytes.length > DEFAULT_LIMITS.maxOutputBytes) {
    throw new ControlPlaneError('REMOTE_RESULT_TRUNCATED', 'Remote result is empty or exceeds its bound');
  }
  return parseJsonBytes(bytes, 'remote framed result');
}

function validateRemoteResult(instanceId, result, manifestModel) {
  requireObject(result, `remote result ${instanceId}`);
  requireExact(result.instanceId, instanceId, 'remote result instanceId');
  const identity = validateRemoteIdentity(result.identity, instanceId);
  const provenance = requireObject(result.provenance, 'remote provenance');
  return {
    instanceId,
    processId: Number.isInteger(result.processId) ? result.processId : null,
    identity,
    provenance: [
      validateProvenance('admin', provenance.admin, manifestModel),
      validateProvenance('portal', provenance.portal, manifestModel),
    ],
  };
}

function validateRemoteTransport(invocation) {
  requireObject(invocation, 'remote transport result');
  const commandId = requireNonEmptyString(invocation.commandId, 'remote transport commandId');
  requireExact(invocation.status, 'Success', 'remote transport status');
  requireExact(Number(invocation.responseCode), 0, 'remote transport responseCode');
  requireExact(invocation.processTerminal, true, 'remote transport processTerminal');
  if (!Number.isInteger(invocation.outputBytes) || invocation.outputBytes <= 0) {
    throw new ControlPlaneError('REMOTE_EVIDENCE_INCOMPLETE', 'remote transport outputBytes must be positive');
  }
  requireDigest(invocation.outputSha256, 'remote transport outputSha256');
  return commandId;
}

function remoteProgram(instanceId) {
  return `'use strict';const fs=require('fs');const crypto=require('crypto');const {spawnSync}=require('child_process');const paths=${JSON.stringify(PROVENANCE_PATHS)};const aws=spawnSync('aws',['sts','get-caller-identity','--region','${EXPECTED_REGION}','--no-cli-pager','--output','json'],{encoding:'utf8',timeout:15000,maxBuffer:${DEFAULT_LIMITS.maxOutputBytes}});if(aws.error)throw aws.error;if(aws.status!==0)throw new Error(String(aws.stderr||aws.stdout||'remote STS failed'));const identity=JSON.parse(aws.stdout);const provenance={};for(const [component,filename]of Object.entries(paths)){const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size<=0||stat.size>${DEFAULT_LIMITS.maxProvenanceBytes})throw new Error(component+' provenance is not an admitted regular file');const raw=fs.readFileSync(filename);provenance[component]={bytes:raw.length,rawSha256:crypto.createHash('sha256').update(raw).digest('hex'),value:JSON.parse(raw.toString('utf8'))};}const result={instanceId:${JSON.stringify(instanceId)},processId:process.pid,identity,provenance};process.stdout.write('PATH_PHASE7_RESULT='+Buffer.from(JSON.stringify(result)).toString('base64')+'\\n');`;
}

function buildRemoteCommand(instanceId) {
  const encoded = Buffer.from(remoteProgram(instanceId), 'utf8').toString('base64');
  return `node -e "eval(Buffer.from('${encoded}','base64').toString('utf8'))"`;
}

function optionValue(args, option) {
  const index = args.indexOf(option);
  return index === -1 ? null : args[index + 1];
}

function assertAdmittedAwsOperation(args, context = {}) {
  if (!Array.isArray(args) || args.length < 2) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'AWS operation is incomplete');
  const operation = `${args[0]}:${args[1]}`;
  const allowed = new Set([
    'sts:get-caller-identity',
    'autoscaling:describe-auto-scaling-groups',
    'ssm:describe-instance-information',
    'elbv2:describe-target-groups',
    'elbv2:describe-target-health',
    's3api:head-object',
    'ssm:send-command',
    'ssm:get-command-invocation',
    'ssm:cancel-command',
  ]);
  if (!allowed.has(operation)) throw new ControlPlaneError('AWS_OPERATION_REJECTED', `Unsupported AWS operation: ${operation}`);
  const serialized = args.join(' ');
  if (/\.env(?:\b|\.)|\b(?:ses|rds|cognito-idp|secretsmanager)\b|https?:\/\/|\b(?:mysql|psql|rm|mv|cp|touch|mkdir|tee)\b|[<>]/iu.test(serialized)) {
    throw new ControlPlaneError('AWS_OPERATION_REJECTED', `AWS operation contains a prohibited target: ${operation}`);
  }
  if (operation === 'autoscaling:describe-auto-scaling-groups') {
    requireExact(optionValue(args, '--auto-scaling-group-names'), EXPECTED_ASG, 'ASG request target');
  } else if (operation === 'elbv2:describe-target-groups') {
    const name = optionValue(args, '--names');
    if (!Object.values(TARGETS).some(target => target.name === name)) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'Target-group request is outside the admitted names');
  } else if (operation === 'elbv2:describe-target-health') {
    if (!context.targetArns?.has(optionValue(args, '--target-group-arn'))) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'Target-health request is outside discovered target groups');
  } else if (operation === 's3api:head-object') {
    requireExact(optionValue(args, '--bucket'), EXPECTED_BUCKET, 'HeadObject bucket');
    if (!Object.values(ARTIFACTS).some(artifact => artifact.key === optionValue(args, '--key'))) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'HeadObject key is outside the admitted artifacts');
  } else if (operation === 'ssm:send-command') {
    const instanceId = optionValue(args, '--instance-ids');
    if (!context.instances?.has(instanceId)) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'SendCommand instance is outside the admitted ASG/SSM set');
    requireExact(optionValue(args, '--document-name'), EXPECTED_SSM_DOCUMENT, 'SSM document');
    const parameters = parseJsonBytes(Buffer.from(optionValue(args, '--parameters') || ''), 'SSM parameters');
    requireExact(parameters.commands?.length, 1, 'SSM command count');
    requireExact(parameters.commands[0], buildRemoteCommand(instanceId), 'SSM remote command');
    requireExact(parameters.executionTimeout?.[0], String(DEFAULT_LIMITS.ssmExecutionSeconds), 'SSM execution timeout');
  } else if (operation === 'ssm:get-command-invocation') {
    if (!context.commandIds?.has(optionValue(args, '--command-id'))) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'GetCommandInvocation command ID was not issued by this attempt');
    if (!context.instances?.has(optionValue(args, '--instance-id'))) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'GetCommandInvocation instance is outside the admitted set');
  } else if (operation === 'ssm:cancel-command') {
    if (!context.commandIds?.has(optionValue(args, '--command-id'))) throw new ControlPlaneError('AWS_OPERATION_REJECTED', 'CancelCommand command ID was not issued by this attempt');
  }
  return operation;
}

function sanitizeDiagnostic(value) {
  return String(value || '')
    .replace(/AKIA[A-Z0-9]{16}/gu, '[REDACTED_ACCESS_KEY]')
    .replace(/(secret|token|password|credential)(\s*[=:]\s*)[^\s,;]+/giu, '$1$2[REDACTED]')
    .slice(0, 4000);
}

function createAwsInvoker(options = {}) {
  const profile = options.profile || EXPECTED_PROFILE;
  const region = options.region || EXPECTED_REGION;
  const limits = { ...DEFAULT_LIMITS, ...(options.limits || {}) };
  const spawn = options.spawn || spawnSync;
  const clockMs = options.clockMs || (() => Date.now());
  const commandEvidence = [];
  const context = {
    instances: new Set(),
    targetArns: new Set(),
    commandIds: new Set(),
  };

  function invoke(args, label) {
    const operation = assertAdmittedAwsOperation(args, context);
    const fullArgs = [...args, '--profile', profile, '--region', region, '--no-cli-pager', '--output', 'json'];
    const startedMs = clockMs();
    const result = spawn('aws', fullArgs, {
      cwd: REPO_ROOT,
      env: process.env,
      encoding: 'utf8',
      timeout: limits.awsCommandMs,
      killSignal: 'SIGTERM',
      maxBuffer: limits.maxOutputBytes,
      windowsHide: true,
    });
    const stdout = String(result.stdout || '');
    const stderr = String(result.stderr || '');
    const evidence = {
      label,
      operation,
      command: 'aws',
      args: fullArgs,
      startedAt: new Date(startedMs).toISOString(),
      durationMs: Math.max(0, clockMs() - startedMs),
      status: result.status,
      signal: result.signal || null,
      stdoutBytes: Buffer.byteLength(stdout),
      stdoutSha256: sha256(Buffer.from(stdout)),
      stderrBytes: Buffer.byteLength(stderr),
      stderrSha256: sha256(Buffer.from(stderr)),
    };
    commandEvidence.push(evidence);
    if (result.error) {
      const code = result.error.code === 'ETIMEDOUT' ? 'AWS_COMMAND_TIMEOUT' : 'AWS_COMMAND_FAILED';
      throw new ControlPlaneError(code, `${label} did not complete`, { evidence, diagnostic: sanitizeDiagnostic(result.error.message) });
    }
    if (result.status !== 0) {
      const diagnostic = sanitizeDiagnostic(stderr || stdout || `exit ${result.status}`);
      const code = /AccessDenied|UnauthorizedOperation|not authorized/iu.test(diagnostic) ? 'AWS_PERMISSION_DENIED' : 'AWS_COMMAND_FAILED';
      throw new ControlPlaneError(code, `${label} failed: ${diagnostic}`, { evidence, diagnostic });
    }
    let parsed;
    try {
      parsed = JSON.parse(stdout || '{}');
    } catch (error) {
      throw new ControlPlaneError('AWS_OUTPUT_MALFORMED', `${label} returned malformed JSON`, { evidence });
    }
    return parsed;
  }

  return { invoke, context, commandEvidence, limits };
}

function sleepMs(duration) {
  return new Promise(resolve => setTimeout(resolve, duration));
}

async function runBoundedSsm(options) {
  const {
    invoke,
    context,
    instanceId,
    limits = DEFAULT_LIMITS,
    clockMs = () => Date.now(),
    sleep = sleepMs,
  } = options;
  const parameters = JSON.stringify({
    commands: [buildRemoteCommand(instanceId)],
    executionTimeout: [String(DEFAULT_LIMITS.ssmExecutionSeconds)],
  });
  const sent = invoke([
    'ssm', 'send-command',
    '--instance-ids', instanceId,
    '--document-name', EXPECTED_SSM_DOCUMENT,
    '--comment', `PATH Phase 7 read-only provenance ${instanceId}`,
    '--timeout-seconds', String(DEFAULT_LIMITS.ssmExecutionSeconds),
    '--parameters', parameters,
  ], `send read-only provenance command to ${instanceId}`);
  const commandId = requireNonEmptyString(sent?.Command?.CommandId, 'SSM command ID');
  context.commandIds.add(commandId);
  const deadline = clockMs() + limits.ssmTotalMs;
  let invocation = null;
  while (clockMs() < deadline) {
    try {
      invocation = invoke([
        'ssm', 'get-command-invocation',
        '--command-id', commandId,
        '--instance-id', instanceId,
      ], `poll read-only provenance command ${commandId}`);
    } catch (error) {
      if (error.code === 'AWS_COMMAND_FAILED' && /InvocationDoesNotExist/u.test(error.details?.diagnostic || error.message)) {
        await sleep(limits.ssmPollMs);
        continue;
      }
      throw error;
    }
    if (!['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) break;
    await sleep(limits.ssmPollMs);
  }
  if (!invocation || ['Pending', 'InProgress', 'Delayed'].includes(invocation.Status)) {
    let cancellation;
    try {
      cancellation = invoke(['ssm', 'cancel-command', '--command-id', commandId], `cancel timed-out provenance command ${commandId}`);
    } catch (error) {
      throw new ControlPlaneError('SSM_CANCELLATION_FAILED', `Timed-out SSM command ${commandId} could not be cancelled`, {
        commandId,
        cancellationFailure: sanitizedFailure(error, 'ssm-cancellation'),
      });
    }
    const cancellationDeadline = clockMs() + limits.ssmCancellationMs;
    let terminal = null;
    while (clockMs() < cancellationDeadline) {
      try {
        terminal = invoke([
          'ssm', 'get-command-invocation',
          '--command-id', commandId,
          '--instance-id', instanceId,
        ], `prove cancelled provenance command ${commandId} terminal`);
      } catch (error) {
        if (error.code === 'AWS_COMMAND_FAILED' && /InvocationDoesNotExist/u.test(error.details?.diagnostic || error.message)) {
          await sleep(limits.ssmPollMs);
          continue;
        }
        throw error;
      }
      if (!['Pending', 'InProgress', 'Delayed', 'Cancelling'].includes(terminal.Status)) break;
      await sleep(limits.ssmPollMs);
    }
    if (!terminal || ['Pending', 'InProgress', 'Delayed', 'Cancelling'].includes(terminal.Status)) {
      throw new ControlPlaneError('SSM_TERMINATION_UNPROVED', `Timed-out SSM command ${commandId} did not reach a terminal state`, { commandId, cancellation });
    }
    throw new ControlPlaneError('SSM_COMMAND_TIMEOUT', `SSM command ${commandId} timed out and reached ${terminal.Status}`, {
      commandId,
      cancellation,
      terminalStatus: terminal.Status,
    });
  }
  if (invocation.Status !== 'Success' || Number(invocation.ResponseCode) !== 0) {
    throw new ControlPlaneError('SSM_COMMAND_FAILED', `SSM command ${commandId} completed as ${invocation.Status}`, {
      commandId,
      status: invocation.Status,
      responseCode: invocation.ResponseCode,
      stderr: sanitizeDiagnostic(invocation.StandardErrorContent),
    });
  }
  const parsed = parseRemoteOutput(invocation.StandardOutputContent);
  return {
    instanceId,
    commandId,
    status: invocation.Status,
    statusDetails: invocation.StatusDetails || invocation.Status,
    responseCode: invocation.ResponseCode,
    executionStartDateTime: invocation.ExecutionStartDateTime || null,
    executionEndDateTime: invocation.ExecutionEndDateTime || null,
    outputBytes: Buffer.byteLength(String(invocation.StandardOutputContent || '')),
    outputSha256: sha256(Buffer.from(String(invocation.StandardOutputContent || ''))),
    processTerminal: true,
    parsed,
  };
}

function createLiveAdapter(options = {}) {
  const aws = createAwsInvoker(options);
  return {
    commandEvidence: aws.commandEvidence,
    async getLocalIdentity() {
      return aws.invoke(['sts', 'get-caller-identity'], 'prove local TEST identity');
    },
    async getCompute() {
      const asg = aws.invoke([
        'autoscaling', 'describe-auto-scaling-groups',
        '--auto-scaling-group-names', EXPECTED_ASG,
      ], `discover ${EXPECTED_ASG}`);
      const ssm = aws.invoke(['ssm', 'describe-instance-information'], 'discover SSM-online instances');
      return { asg, ssm };
    },
    admitInstances(instanceIds) {
      for (const instanceId of instanceIds) aws.context.instances.add(instanceId);
    },
    async getTarget(component) {
      const definition = TARGETS[component];
      const group = aws.invoke(['elbv2', 'describe-target-groups', '--names', definition.name], `discover ${definition.name}`);
      const arn = validateTargetGroupIdentity(component, group).TargetGroupArn;
      aws.context.targetArns.add(arn);
      const health = aws.invoke(['elbv2', 'describe-target-health', '--target-group-arn', arn], `read ${definition.name} target health`);
      return { group, health };
    },
    async headArtifact(definition) {
      return aws.invoke(['s3api', 'head-object', '--bucket', EXPECTED_BUCKET, '--key', definition.key], `head ${definition.component} ${definition.role} artifact`);
    },
    async runRemote(instanceId) {
      return runBoundedSsm({
        invoke: aws.invoke,
        context: aws.context,
        instanceId,
        limits: aws.limits,
      });
    },
  };
}

async function executeControlPlane(options) {
  const {
    manifestPath,
    attemptId,
    evidenceOut,
    adapter,
    nowMs = Date.now(),
    clock = () => new Date(),
    clockMs = () => Date.now(),
  } = options;
  const sourceStateProvider = options.sourceStateProvider
    || (() => captureSourceState([...SOURCE_PATHS, manifestPath]));
  const recorder = options.recorder || createEvidenceRecorder(evidenceOut, attemptId, clock);
  const startedAt = clock().toISOString();
  const attemptDeadline = clockMs() + DEFAULT_LIMITS.totalAttemptMs;
  let phase = 'invocation';
  let sourceBefore = null;
  let sourceAfter = null;
  let manifest = null;
  const collected = {};
  let failure = null;
  function proveAttemptTime() {
    if (clockMs() > attemptDeadline) throw new ControlPlaneError('ATTEMPT_TIMEOUT', 'Attempt total timeout elapsed');
  }

  try {
    recorder.record('invocation-received', { attemptId, checkId: CHECK_ID, operationClass: OPERATION_CLASS });
    phase = 'source-before';
    sourceBefore = sourceStateProvider('before');
    recorder.record('source-before', { source: sourceBefore });

    phase = 'manifest-validation';
    manifest = loadAndValidateManifest(manifestPath, { nowMs });
    recorder.record('manifest-accepted', {
      path: path.relative(REPO_ROOT, manifestPath).replace(/\\/gu, '/'),
      sha256: manifest.digest,
      releaseId: manifest.model.releaseId,
      qualificationEvidenceId: manifest.model.evidenceId,
      preflightEvidenceId: manifest.model.preflightEvidenceId,
      source: manifest.model.source,
    });
    proveAttemptTime();

    phase = 'local-identity';
    collected.localIdentity = validateLocalIdentity(await adapter.getLocalIdentity());
    recorder.record('local-identity-proved', collected.localIdentity);
    proveAttemptTime();

    phase = 'compute-scope';
    const compute = await adapter.getCompute();
    collected.instances = validateCompute(compute.asg, compute.ssm);
    adapter.admitInstances?.(collected.instances);
    recorder.record('compute-scope-proved', { asg: EXPECTED_ASG, instances: collected.instances });
    proveAttemptTime();

    phase = 'target-health';
    collected.targets = [];
    for (const component of ['admin', 'portal']) {
      const target = await adapter.getTarget(component);
      collected.targets.push(validateTarget(component, target.group, target.health, collected.instances));
      proveAttemptTime();
    }
    recorder.record('target-health-proved', { targets: collected.targets });

    phase = 'artifact-presence';
    collected.artifacts = [];
    for (const key of ['adminCurrent', 'portalCurrent', 'adminRollback', 'portalRollback']) {
      const definition = manifest.model.artifacts[key];
      collected.artifacts.push(validateHeadObject(definition, await adapter.headArtifact(definition)));
      proveAttemptTime();
    }
    recorder.record('artifact-presence-proved', { artifacts: collected.artifacts });

    phase = 'remote-provenance';
    collected.remote = [];
    for (const instanceId of collected.instances) {
      proveAttemptTime();
      const invocation = await adapter.runRemote(instanceId);
      validateRemoteTransport(invocation);
      const normalized = validateRemoteResult(instanceId, invocation.parsed, manifest.model);
      collected.remote.push({
        ...normalized,
        transport: {
          commandId: invocation.commandId,
          status: invocation.status,
          statusDetails: invocation.statusDetails,
          responseCode: invocation.responseCode,
          executionStartDateTime: invocation.executionStartDateTime,
          executionEndDateTime: invocation.executionEndDateTime,
          outputBytes: invocation.outputBytes,
          outputSha256: invocation.outputSha256,
          processTerminal: invocation.processTerminal,
        },
      });
      recorder.record('remote-provenance-proved', collected.remote[collected.remote.length - 1]);
      proveAttemptTime();
    }

    phase = 'source-after';
    sourceAfter = sourceStateProvider('after');
    assertStableSource(sourceBefore, sourceAfter);
    recorder.record('source-stability-proved', { source: sourceAfter });
  } catch (error) {
    failure = sanitizedFailure(error, phase);
    recorder.record('attempt-failed', { failure });
    try {
      sourceAfter = sourceStateProvider('after-failure');
    } catch (sourceError) {
      failure.details.sourceAfterFailure = sanitizedFailure(sourceError, 'source-after-failure');
    }
  }

  const final = {
    schemaVersion: 1,
    checkId: CHECK_ID,
    operationClass: OPERATION_CLASS,
    releaseAuthority: RELEASE_AUTHORITY,
    attemptId,
    status: failure ? 'failed' : 'passed',
    startedAt,
    finishedAt: clock().toISOString(),
    effect: {
      class: 'external-read-with-control-plane-record',
      awsReadsOnly: true,
      ssmCommandHistoryCreated: Boolean(collected.remote?.length || adapter.commandEvidence?.some(value => value.operation === 'ssm:send-command')),
      productMutation: false,
      databaseAccess: false,
      productHttpAccess: false,
      sesAccess: false,
    },
    cleanup: {
      status: 'unnecessary',
      owner: CHECK_ID,
      residueScope: ['local child processes', 'remote SSM read processes'],
      residueDecision: failure ? 'unresolved-on-failure' : 'no-declared-write-effect',
      independentProof: {
        completed: !failure,
        passed: !failure && collected.remote.every(value => value.transport.processTerminal),
        basis: 'Every admitted local AWS child and remote SSM invocation returned terminal evidence; SSM command history is retained evidence, not residue.',
      },
    },
    sourceBefore,
    sourceAfter,
    manifest: manifest ? {
      path: path.relative(REPO_ROOT, manifestPath).replace(/\\/gu, '/'),
      sha256: manifest.digest,
      releaseId: manifest.model.releaseId,
      qualificationEvidenceId: manifest.model.evidenceId,
      preflightEvidenceId: manifest.model.preflightEvidenceId,
      expiresAt: manifest.model.expiresAt,
      source: manifest.model.source,
    } : null,
    result: collected,
    commands: adapter.commandEvidence || [],
    failure,
    events: recorder.events,
  };
  const retained = recorder.finalize(final);
  return { final, retained };
}

async function main(argv = process.argv.slice(2)) {
  let args;
  try {
    args = parseArgs(argv);
    if (args.help) {
      usage();
      return 0;
    }
    validateCliBoundary(args);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 2;
  }

  const adapter = createLiveAdapter({ profile: args.profile, region: args.region });
  let outcome;
  try {
    outcome = await executeControlPlane({
      manifestPath: path.resolve(args.manifest),
      attemptId: args.attemptId,
      evidenceOut: path.resolve(args.evidenceOut),
      adapter,
    });
  } catch (error) {
    process.stderr.write(`${error.stack || error.message}\n`);
    return 1;
  }
  if (args.json) process.stdout.write(`${JSON.stringify(outcome.final)}\n`);
  else process.stdout.write(`${CHECK_ID}: ${outcome.final.status}; evidence=${outcome.retained.path}\n`);
  return outcome.final.status === 'passed' ? 0 : 1;
}

if (require.main === module) {
  main().then(code => { process.exitCode = code; });
}

module.exports = {
  ARTIFACTS,
  CHECK_ID,
  ControlPlaneError,
  DEFAULT_LIMITS,
  EXPECTED_ACCOUNT,
  EXPECTED_ASG,
  EXPECTED_BUCKET,
  EXPECTED_MANIFEST_PATH,
  EXPECTED_OPERATOR_ARN,
  EXPECTED_PROFILE,
  EXPECTED_REGION,
  EXPECTED_REMOTE_ROLE,
  PROVENANCE_PATHS,
  TARGETS,
  assertAdmittedAwsOperation,
  assertStableSource,
  buildRemoteCommand,
  captureSourceState,
  createAwsInvoker,
  createEvidenceRecorder,
  createLiveAdapter,
  executeControlPlane,
  loadAndValidateManifest,
  main,
  parseArgs,
  parseRemoteOutput,
  runBoundedSsm,
  sha256,
  validateCliBoundary,
  validateCompute,
  validateHeadObject,
  validateLocalIdentity,
  validateManifestObject,
  validateRemoteResult,
  validateRemoteTransport,
  validateTarget,
  validateTargetGroupIdentity,
  verifyEvidenceDigest,
};
