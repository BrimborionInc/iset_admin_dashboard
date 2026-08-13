#!/usr/bin/env node

/*
 * Runs the authenticated CFA signing smoke against the deployed TEST portal.
 * Cognito provisioning is performed with the nwac-test operator profile; the
 * database fixture and HTTP checks run on the TEST app host through SSM.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync, spawnSync } = require('child_process');
const { discoverVerifiedTestInstanceAwsIdentity } = require('./lib/test-instance-aws-identity');
const { REQUIRED_OBJECTS, decodeResult, fixtureIdentity } = require('./cfa-signing-schema-preflight');

const EXPECTED_AWS_ACCOUNT = '124355655255';
const EXPECTED_AWS_ARN = 'arn:aws:iam::124355655255:user/CODEX_CLI_Admin';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const EXPECTED_TEST_DB_HOST = 'nwac-test-db.cluster-cn4yoy2s4w5t.ca-central-1.rds.amazonaws.com';
const EXPECTED_TEST_DB_USER = 'app_admin';
const EXPECTED_TEST_DB_SERVER_HOSTNAME = 'ip-172-16-0-199';
const EXPECTED_TEST_DB_PORT = 3306;
const EXPECTED_TEST_DB_PRINCIPAL = 'app_admin@10.48.%';
const EXPECTED_TEST_DB_VERSION = '8.0.42';
const DEFAULT_LIMITS = Object.freeze({
  awsCommandMs: 20_000,
  pollMs: 1_000,
  remoteCommandMs: 90_000,
  cancellationMs: 30_000,
  maxOutputBytes: 4 * 1024 * 1024,
});
const EVIDENCE_CHUNK_BYTES = 15 * 1024;
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.CFA_SIGNING_TEST_BUCKET || DEFAULT_BUCKET,
    instanceId: '',
    portalEnv: path.resolve(__dirname, '..', '..', 'ISET-intake', '.env.test'),
    attemptId: '',
    evidenceOut: '',
    admissionOnly: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--portal-env') args.portalEnv = path.resolve(argv[++index]);
    else if (token === '--attempt-id') args.attemptId = argv[++index];
    else if (token === '--evidence-out') args.evidenceOut = path.resolve(argv[++index]);
    else if (token === '--admission-only') args.admissionOnly = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      console.log('Usage: node scripts/cfa-signing-test-smoke.js [--profile nwac-test] [--region ca-central-1] [--instance-id ID] [--attempt-id ID --evidence-out PATH --admission-only] [--json]');
      process.exit(0);
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function aws(args, options) {
  return execFileSync('aws', [...args, '--region', options.region, '--profile', options.profile], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 32 * 1024 * 1024,
    timeout: DEFAULT_LIMITS.awsCommandMs,
  });
}

function awsJson(args, options) {
  const output = aws([...args, '--output', 'json'], options).trim();
  return output ? JSON.parse(output) : null;
}

function awsText(args, options) {
  return aws([...args, '--output', 'text'], options).trim();
}

function readEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  }
  return env;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

function discoverInstanceId(options) {
  if (options.instanceId) return options.instanceId;
  const online = new Set(awsText([
    'ssm', 'describe-instance-information',
    '--query', 'InstanceInformationList[?PingStatus==`Online`].InstanceId',
  ], options).split(/\s+/u).filter(Boolean));
  const running = awsText([
    'ec2', 'describe-instances',
    '--filters', 'Name=tag:Name,Values=nwac-test-app', 'Name=instance-state-name,Values=running',
    '--query', 'Reservations[].Instances[].InstanceId',
  ], options).split(/\s+/u).filter(Boolean);
  const instanceId = running.find(id => online.has(id));
  if (!instanceId) throw new Error('No online SSM-managed nwac-test-app instance found');
  return instanceId;
}

function cancelCommand(commandId, options) {
  aws(['ssm', 'cancel-command', '--command-id', commandId], options);
}

function waitForCommand(instanceId, commandId, options, dependencies = {}) {
  const now = dependencies.now || Date.now;
  const sleep = dependencies.sleep || (milliseconds => spawnSync('sleep', [String(milliseconds / 1000)]));
  const getInvocation = dependencies.getInvocation || (() => {
    let result = null;
    try {
      result = awsJson([
        'ssm', 'get-command-invocation', '--command-id', commandId, '--instance-id', instanceId,
        '--query', '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}',
      ], options);
    } catch (_) {
      result = null;
    }
    return result;
  });
  const cancel = dependencies.cancel || (() => cancelCommand(commandId, options));
  const deadline = now() + (dependencies.remoteCommandMs || DEFAULT_LIMITS.remoteCommandMs);
  for (;;) {
    const result = getInvocation();
    if (result && !['Pending', 'InProgress', 'Delayed'].includes(result.Status)) return result;
    if (now() >= deadline) {
      cancel();
      const cancellationDeadline = now() + (dependencies.cancellationMs || DEFAULT_LIMITS.cancellationMs);
      while (now() < cancellationDeadline) {
        const cancelled = getInvocation();
        if (cancelled && !['Pending', 'InProgress', 'Delayed', 'Cancelling'].includes(cancelled.Status)) {
          const error = new Error(`Remote TEST command timed out and terminated as ${cancelled.Status}`);
          error.code = 'CFA_REMOTE_TIMEOUT';
          error.invocation = cancelled;
          throw error;
        }
        sleep(dependencies.pollMs || DEFAULT_LIMITS.pollMs);
      }
      const error = new Error('Remote TEST command cancellation did not reach a terminal state');
      error.code = 'CFA_REMOTE_CANCELLATION_FAILED';
      throw error;
    }
    sleep(dependencies.pollMs || DEFAULT_LIMITS.pollMs);
  }
}

function sendCommand(instanceId, commands, options) {
  const paramsFile = path.join(os.tmpdir(), `cfa-signing-test-params-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify({ commands }), 'utf8');
  try {
    return awsText([
      'ssm', 'send-command', '--instance-ids', instanceId,
      '--document-name', 'AWS-RunShellScript', '--parameters', `file://${paramsFile}`,
      '--comment', 'PATH CFA signing TEST acceptance', '--query', 'Command.CommandId',
    ], options);
  } finally {
    fs.rmSync(paramsFile, { force: true });
  }
}

function createApplicant({ email, password, poolId }, options) {
  aws([
    'cognito-idp', 'admin-create-user', '--user-pool-id', poolId, '--username', email,
    '--message-action', 'SUPPRESS', '--user-attributes',
    `Name=email,Value=${email}`, 'Name=email_verified,Value=true',
    'Name=given_name,Value=CFA', 'Name=family_name,Value=SigningSmoke',
  ], options);
  aws([
    'cognito-idp', 'admin-set-user-password', '--user-pool-id', poolId,
    '--username', email, '--password', password, '--permanent',
  ], options);
  const user = awsJson([
    'cognito-idp', 'admin-get-user', '--user-pool-id', poolId, '--username', email,
  ], options);
  const sub = (user.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error('TEST Cognito user did not return a sub');
  return sub;
}

function deleteApplicant(email, poolId, options) {
  if (!email || !poolId) return;
  try {
    aws(['cognito-idp', 'admin-delete-user', '--user-pool-id', poolId, '--username', email], options);
  } catch (error) {
    if (!/UserNotFoundException/u.test(String(error.stderr || error.message || error))) throw error;
  }
}

function randomPassword() {
  return `CfaTest-${crypto.randomBytes(8).toString('hex')}Aa1!`;
}

function parseSmokeJson(stdout) {
  const text = String(stdout || '').trim();
  const start = text.indexOf('{');
  if (start < 0) throw new Error(`TEST smoke emitted no JSON: ${text.slice(0, 1000)}`);
  return JSON.parse(text.slice(start));
}

function admissionEvidenceFile(bundle) {
  return path.posix.join(bundle.remoteRoot, 'evidence', 'admission-envelope.json');
}

function validateAdmissionTransportManifest(manifest, expected) {
  if (manifest?.schemaVersion !== 1 || manifest?.transport !== 'cfa-admission-file-chunks-v1') {
    throw new Error('cfa_evidence_transport_manifest_invalid');
  }
  if (manifest.status !== 'PASS' || manifest.attemptId !== expected.attemptId) {
    throw new Error('cfa_evidence_transport_identity_mismatch');
  }
  if (manifest.evidenceFile !== expected.evidenceFile) throw new Error('cfa_evidence_transport_path_mismatch');
  if (!Number.isInteger(manifest.evidenceBytes) || manifest.evidenceBytes <= 0 || manifest.evidenceBytes > MAX_EVIDENCE_BYTES) {
    throw new Error('cfa_evidence_transport_size_invalid');
  }
  for (const field of ['evidenceFileSha256', 'admissionEvidenceSha256']) {
    if (!/^[a-f0-9]{64}$/u.test(String(manifest[field] || ''))) throw new Error(`cfa_evidence_transport_${field}_invalid`);
  }
  if (!Number.isInteger(manifest.admissionEvidenceBytes) || manifest.admissionEvidenceBytes <= 0) {
    throw new Error('cfa_evidence_transport_admission_size_invalid');
  }
  return Object.freeze({ ...manifest });
}

function createEvidenceChunk(bytes, manifest, index) {
  if (!Buffer.isBuffer(bytes)) throw new Error('cfa_evidence_chunk_source_invalid');
  const count = Math.ceil(manifest.evidenceBytes / EVIDENCE_CHUNK_BYTES);
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('cfa_evidence_chunk_index_invalid');
  const offset = index * EVIDENCE_CHUNK_BYTES;
  const chunk = bytes.subarray(offset, Math.min(offset + EVIDENCE_CHUNK_BYTES, bytes.length));
  return Object.freeze({
    schemaVersion: 1,
    index,
    count,
    offset,
    chunkBytes: chunk.length,
    evidenceBytes: manifest.evidenceBytes,
    evidenceFileSha256: manifest.evidenceFileSha256,
    data: chunk.toString('base64'),
  });
}

function reconstructAdmissionEvidence(manifestInput, readChunk) {
  const manifest = validateAdmissionTransportManifest(manifestInput, {
    attemptId: manifestInput?.attemptId,
    evidenceFile: manifestInput?.evidenceFile,
  });
  const count = Math.ceil(manifest.evidenceBytes / EVIDENCE_CHUNK_BYTES);
  const seen = new Set();
  const buffers = [];
  for (let expectedIndex = 0; expectedIndex < count; expectedIndex += 1) {
    const chunk = readChunk(expectedIndex);
    if (!chunk || typeof chunk !== 'object') throw new Error(`cfa_evidence_chunk_missing:${expectedIndex}`);
    if (seen.has(chunk.index)) throw new Error(`cfa_evidence_chunk_duplicated:${chunk.index}`);
    if (chunk.index !== expectedIndex) throw new Error(`cfa_evidence_chunk_reordered:${expectedIndex}:${chunk.index}`);
    seen.add(chunk.index);
    const expectedOffset = expectedIndex * EVIDENCE_CHUNK_BYTES;
    const expectedBytes = Math.min(EVIDENCE_CHUNK_BYTES, manifest.evidenceBytes - expectedOffset);
    if (
      chunk.schemaVersion !== 1 ||
      chunk.count !== count ||
      chunk.offset !== expectedOffset ||
      chunk.chunkBytes !== expectedBytes ||
      chunk.evidenceBytes !== manifest.evidenceBytes ||
      chunk.evidenceFileSha256 !== manifest.evidenceFileSha256 ||
      typeof chunk.data !== 'string'
    ) throw new Error(`cfa_evidence_chunk_contract_invalid:${expectedIndex}`);
    const bytes = Buffer.from(chunk.data, 'base64');
    if (bytes.length !== expectedBytes || bytes.toString('base64') !== chunk.data) {
      throw new Error(`cfa_evidence_chunk_truncated_or_malformed:${expectedIndex}`);
    }
    buffers.push(bytes);
  }
  const bytes = Buffer.concat(buffers);
  if (bytes.length !== manifest.evidenceBytes) throw new Error('cfa_evidence_reconstruction_size_mismatch');
  const digest = sha256(bytes);
  if (digest !== manifest.evidenceFileSha256) throw new Error('cfa_evidence_reconstruction_digest_mismatch');
  let envelope;
  try {
    envelope = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new Error(`cfa_evidence_reconstruction_json_invalid:${error.message}`);
  }
  if (
    envelope.status !== manifest.status ||
    envelope.evidenceSha256 !== manifest.admissionEvidenceSha256 ||
    Number(envelope.evidenceBytes) !== manifest.admissionEvidenceBytes
  ) throw new Error('cfa_evidence_envelope_manifest_mismatch');
  const admission = decodeResult(envelope);
  if (admission.attemptId !== manifest.attemptId) throw new Error('cfa_evidence_admission_attempt_mismatch');
  return { admission, bytes, digest, envelope };
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function writeJsonAtomic(filename, value) {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temporary, filename);
}

function admissionBundle(attemptId) {
  const files = [
    {
      relativePath: 'admin-dashboard/scripts/lib/live-mysql-schema-guard.js',
      sourcePath: path.resolve(__dirname, 'lib', 'live-mysql-schema-guard.js'),
    },
    {
      relativePath: 'admin-dashboard/scripts/cfa-signing-schema-preflight.js',
      sourcePath: path.resolve(__dirname, 'cfa-signing-schema-preflight.js'),
    },
    {
      relativePath: 'portal/scripts/cfa-signing-smoke.js',
      sourcePath: path.resolve(__dirname, '..', '..', 'ISET-intake', 'scripts', 'cfa-signing-smoke.js'),
    },
    {
      relativePath: 'portal/s3Provider.js',
      sourcePath: path.resolve(__dirname, '..', '..', 'ISET-intake', 's3Provider.js'),
    },
  ].map(file => {
    const bytes = fs.readFileSync(file.sourcePath);
    return {
      ...file,
      bytes: bytes.length,
      sha256: sha256(bytes),
      gzipBase64: zlib.gzipSync(bytes, { level: 9 }).toString('base64'),
    };
  });
  const digest = sha256(Buffer.from(JSON.stringify(files.map(file => ({
    relativePath: file.relativePath,
    bytes: file.bytes,
    sha256: file.sha256,
  })))));
  return {
    attemptId,
    digest,
    remoteRoot: `/tmp/rq-cfa-signing-admission-${digest.slice(0, 20)}-${sha256(Buffer.from(attemptId)).slice(0, 12)}`,
    files,
  };
}

function runRemote(instanceId, commands, options, label) {
  const commandId = sendCommand(instanceId, commands, options);
  const invocation = waitForCommand(instanceId, commandId, options);
  if (invocation.Status !== 'Success') {
    throw new Error(`${label} failed (${invocation.Status}): ${String(invocation.Stderr || invocation.Stdout || '').slice(0, 4000)}`);
  }
  return { commandId, invocation };
}

function installAdmissionBundle(instanceId, bundle, options) {
  const commandIds = [];
  const directories = [...new Set(bundle.files.map(file => path.posix.dirname(path.posix.join(bundle.remoteRoot, file.relativePath))))];
  const prepared = runRemote(instanceId, [
    'set -euo pipefail',
    `rm -rf ${shellQuote(bundle.remoteRoot)}`,
    `install -d -m 700 ${shellQuote(bundle.remoteRoot)}`,
    ...directories.map(directory => `install -d -m 700 ${shellQuote(directory)}`),
  ], options, 'CFA admission bundle root preparation');
  commandIds.push(prepared.commandId);
  for (const file of bundle.files) {
    const target = path.posix.join(bundle.remoteRoot, file.relativePath);
    const installed = runRemote(instanceId, [
      'set -euo pipefail',
      `printf %s ${shellQuote(file.gzipBase64)} | base64 -d | gzip -d > ${shellQuote(target)}`,
      `test "$(sha256sum ${shellQuote(target)} | cut -d ' ' -f 1)" = ${shellQuote(file.sha256)}`,
      `chmod 600 ${shellQuote(target)}`,
    ], options, `CFA admission bundle install ${file.relativePath}`);
    commandIds.push(installed.commandId);
  }
  return commandIds;
}

function removeAdmissionBundle(instanceId, bundle, options) {
  const evidenceFile = admissionEvidenceFile(bundle);
  return runRemote(instanceId, [
    'set -euo pipefail',
    `rm -rf ${shellQuote(bundle.remoteRoot)}`,
    `test ! -e ${shellQuote(evidenceFile)}`,
    `test ! -e ${shellQuote(bundle.remoteRoot)}`,
  ], options, 'CFA admission bundle cleanup');
}

function runAdmissionPreflight(instanceId, bundle, attemptId, options) {
  const executable = path.posix.join(bundle.remoteRoot, 'admin-dashboard/scripts/cfa-signing-schema-preflight.js');
  const evidenceFile = admissionEvidenceFile(bundle);
  return runRemote(instanceId, [
    'set -euo pipefail',
    `cd ${shellQuote(bundle.remoteRoot)}`,
    [
      'NODE_PATH=/opt/nwac/admin-dashboard/node_modules:/opt/nwac/portal/node_modules',
      'node', shellQuote(executable),
      '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
      '--attempt-id', shellQuote(attemptId),
      '--evidence-file', shellQuote(evidenceFile),
      '--expected-database', shellQuote('iset_intake'),
      '--expected-db-host', shellQuote(EXPECTED_TEST_DB_HOST),
      '--expected-db-user', shellQuote(EXPECTED_TEST_DB_USER),
      '--expected-db-server-hostname', shellQuote(EXPECTED_TEST_DB_SERVER_HOSTNAME),
      '--expected-db-port', shellQuote(EXPECTED_TEST_DB_PORT),
      '--expected-db-principal', shellQuote(EXPECTED_TEST_DB_PRINCIPAL),
      '--expected-db-version', shellQuote(EXPECTED_TEST_DB_VERSION),
      '--json',
    ].join(' '),
  ], options, 'CFA read-only admission');
}

function remoteEvidenceChunkCommand(manifest, index) {
  const code = `'use strict';const fs=require('fs');const crypto=require('crypto');` +
    `const filename=${JSON.stringify(manifest.evidenceFile)};` +
    `const expectedBytes=${manifest.evidenceBytes};const expectedSha=${JSON.stringify(manifest.evidenceFileSha256)};` +
    `const index=${index};const chunkBytes=${EVIDENCE_CHUNK_BYTES};` +
    `const stat=fs.lstatSync(filename);` +
    `if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==expectedBytes)throw new Error('cfa_remote_evidence_file_invalid');` +
    `const bytes=fs.readFileSync(filename);` +
    `if(crypto.createHash('sha256').update(bytes).digest('hex')!==expectedSha)throw new Error('cfa_remote_evidence_digest_mismatch');` +
    `const count=Math.ceil(expectedBytes/chunkBytes);const offset=index*chunkBytes;` +
    `const chunk=bytes.subarray(offset,Math.min(offset+chunkBytes,bytes.length));` +
    `const value={schemaVersion:1,index,count,offset,chunkBytes:chunk.length,evidenceBytes:expectedBytes,evidenceFileSha256:expectedSha,data:chunk.toString('base64')};` +
    `process.stdout.write('CFA_ADMISSION_CHUNK='+JSON.stringify(value)+'\\n');`;
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  return `node -e ${shellQuote(`eval(Buffer.from('${encoded}','base64').toString('utf8'))`)}`;
}

function parseEvidenceChunk(stdout) {
  const line = String(stdout || '').split(/\r?\n/u).find(item => item.startsWith('CFA_ADMISSION_CHUNK='));
  if (!line) throw new Error('cfa_evidence_chunk_marker_missing');
  return JSON.parse(line.slice('CFA_ADMISSION_CHUNK='.length));
}

function retrieveAdmissionEvidence(instanceId, bundle, manifestInput, options, dependencies = {}) {
  const manifest = validateAdmissionTransportManifest(manifestInput, {
    attemptId: bundle.attemptId,
    evidenceFile: admissionEvidenceFile(bundle),
  });
  const count = Math.ceil(manifest.evidenceBytes / EVIDENCE_CHUNK_BYTES);
  const commandIds = [];
  const chunks = [];
  const fetchChunk = dependencies.fetchChunk || (index => {
    const result = runRemote(instanceId, [
      'set -euo pipefail',
      remoteEvidenceChunkCommand(manifest, index),
    ], options, `CFA admission evidence chunk ${index + 1}/${count}`);
    commandIds.push(result.commandId);
    return parseEvidenceChunk(result.invocation.Stdout);
  });
  const reconstructed = reconstructAdmissionEvidence(manifest, index => {
    const chunk = fetchChunk(index);
    chunks.push({
      index: chunk?.index,
      offset: chunk?.offset,
      chunkBytes: chunk?.chunkBytes,
      evidenceFileSha256: chunk?.evidenceFileSha256,
    });
    return chunk;
  });
  return {
    admission: reconstructed.admission,
    manifest,
    commandIds,
    chunks,
    reconstructedBytes: reconstructed.bytes.length,
    reconstructedSha256: reconstructed.digest,
  };
}

function validateCompleteAdmission(admission, attemptId) {
  if (
    admission?.status !== 'PASS' ||
    admission?.attemptId !== attemptId ||
    admission?.prerequisites?.noEmail !== true ||
    admission?.comparison?.stable !== true ||
    Number(admission?.verifiedStatementCount) !== 8 ||
    Number(admission?.postflightVerifiedStatementCount) !== 0 ||
    !Array.isArray(admission?.statementCatalogue) ||
    admission.statementCatalogue.length !== 68
  ) throw new Error('CFA read-only admission evidence was incomplete or conflicting');
  for (const phase of ['first', 'second']) {
    const objects = admission?.[phase]?.objects;
    if (!objects || Object.keys(objects).length !== REQUIRED_OBJECTS.length) {
      throw new Error(`cfa_admission_${phase}_object_set_incomplete`);
    }
    for (const name of REQUIRED_OBJECTS) {
      const proof = objects[name];
      if (
        typeof proof?.rawDdl !== 'string' || !proof.rawDdl.trim() ||
        !/^[a-f0-9]{64}$/u.test(String(proof.rawDdlHash || '')) ||
        !/^[a-f0-9]{64}$/u.test(String(proof.structuralDdlHash || '')) ||
        !/^[a-f0-9]{64}$/u.test(String(proof.columnsHash || '')) ||
        !/^[a-f0-9]{64}$/u.test(String(proof.indexesHash || '')) ||
        !/^[a-f0-9]{64}$/u.test(String(proof.constraintsHash || ''))
      ) throw new Error(`cfa_admission_${phase}_raw_ddl_incomplete:${name}`);
    }
  }
  return admission;
}

function portalRunnerCommand(bundle, args) {
  return [
    'NODE_PATH=/opt/nwac/admin-dashboard/node_modules:/opt/nwac/portal/node_modules',
    'node', shellQuote(path.posix.join(bundle.remoteRoot, 'portal/scripts/cfa-signing-smoke.js')),
    ...args,
  ].join(' ');
}

function statefulCommandPlan({ bundle, attemptId, applicant, portalAwsArn, workflow }) {
  if (!bundle?.remoteRoot) throw new Error('Stateful CFA bundle is required');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(String(attemptId || ''))) throw new Error('Fresh attemptId is required');
  if (!applicant?.email || !applicant?.password || !applicant?.sub) throw new Error('Complete applicant identity is required');
  if (!portalAwsArn) throw new Error('Post-environment AWS principal is required');
  if (!Number.isInteger(Number(workflow?.id)) || Number(workflow.id) <= 0 || !workflow?.name || !workflow?.workflowType) {
    throw new Error('Exact admitted workflow is required');
  }
  const fixtureStamp = path.posix.join(bundle.remoteRoot, 'evidence', 'fixture-stamp.json');
  const common = [
    '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
    '--expected-database', shellQuote('iset_intake'),
    '--expected-db-host', shellQuote(EXPECTED_TEST_DB_HOST),
    '--expected-db-user', shellQuote(EXPECTED_TEST_DB_USER),
    '--expected-db-server-hostname', shellQuote(EXPECTED_TEST_DB_SERVER_HOSTNAME),
    '--expected-db-port', shellQuote(EXPECTED_TEST_DB_PORT),
    '--expected-db-principal', shellQuote(EXPECTED_TEST_DB_PRINCIPAL),
    '--expected-db-version', shellQuote(EXPECTED_TEST_DB_VERSION),
    '--expected-aws-account', shellQuote(EXPECTED_AWS_ACCOUNT),
    '--expected-aws-arn', shellQuote(portalAwsArn),
    '--attempt-id', shellQuote(attemptId),
  ];
  return Object.freeze({
    fixtureStamp,
    execute: portalRunnerCommand(bundle, [
      ...common,
      '--base-url', shellQuote('http://127.0.0.1:5000'),
      '--workflow-id', shellQuote(workflow.id),
      '--workflow-name', shellQuote(workflow.name),
      '--workflow-type', shellQuote(workflow.workflowType),
      '--applicant-email', shellQuote(applicant.email),
      '--applicant-password', shellQuote(applicant.password),
      '--applicant-sub', shellQuote(applicant.sub),
      '--fixture-stamp-out', shellQuote(fixtureStamp),
      '--json',
    ]),
    recover: portalRunnerCommand(bundle, [
      ...common,
      '--recovery-only',
      '--fixture-stamp', shellQuote(fixtureStamp),
      '--json',
    ]),
    verifyResidue: portalRunnerCommand(bundle, [
      ...common,
      '--verify-residue-only',
      '--fixture-stamp', shellQuote(fixtureStamp),
      '--json',
    ]),
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.profile !== DEFAULT_PROFILE) throw new Error(`--profile must be ${DEFAULT_PROFILE}`);
  if (options.region !== DEFAULT_REGION) throw new Error(`--region must be ${DEFAULT_REGION}`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/u.test(options.attemptId)) throw new Error('Fresh --attempt-id is required');
  if (!options.evidenceOut) throw new Error('--evidence-out is required');
  const identity = awsJson(['sts', 'get-caller-identity'], options);
  if (identity?.Account !== EXPECTED_AWS_ACCOUNT || identity?.Arn !== EXPECTED_AWS_ARN) {
    throw new Error(`AWS identity did not match authorized TEST operator ${EXPECTED_AWS_ARN}`);
  }
  if (!fs.existsSync(options.portalEnv)) throw new Error(`Portal TEST env not found: ${options.portalEnv}`);
  const portalEnv = readEnvFile(options.portalEnv);
  const poolId = portalEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('COGNITO_USER_POOL_ID not found in portal TEST env');

  const marker = fixtureIdentity(options.attemptId);
  const applicant = {
    email: marker.applicantEmail,
    password: randomPassword(),
    sub: null,
  };
  const instanceId = discoverInstanceId(options);
  const remoteAwsIdentity = await discoverVerifiedTestInstanceAwsIdentity({
    expectedAccountId: EXPECTED_AWS_ACCOUNT,
    issueCommand: commands => sendCommand(instanceId, commands, options),
    waitForCommand: commandId => waitForCommand(instanceId, commandId, options),
  });
  if (options.admissionOnly) {
    const bundle = admissionBundle(options.attemptId);
    const remotePath = path.posix.join(bundle.remoteRoot, 'portal/scripts/cfa-signing-smoke.js');
    const report = {
      ok: false,
      mode: 'admission-only',
      releaseAuthority: 'none',
      attemptId: options.attemptId,
      startedAt: new Date().toISOString(),
      operator: { account: identity.Account, arn: identity.Arn },
      instance: { id: instanceId, preEnvironmentArn: remoteAwsIdentity.arn },
      bundle: {
        digest: bundle.digest,
        remoteRoot: bundle.remoteRoot,
        files: bundle.files.map(file => ({ relativePath: file.relativePath, bytes: file.bytes, sha256: file.sha256 })),
      },
      commands: [],
    };
    let bundlePresent = false;
    try {
      bundlePresent = true;
      report.commands.push(...installAdmissionBundle(instanceId, bundle, options));
      const portalIdentityCommandId = sendCommand(instanceId, [
        'set -euo pipefail',
        'cd /opt/nwac/portal',
        [
          'NODE_PATH=/opt/nwac/admin-dashboard/node_modules:/opt/nwac/portal/node_modules',
          'node', shellQuote(remotePath),
          '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
          '--expected-aws-account', shellQuote(EXPECTED_AWS_ACCOUNT),
          '--identity-only',
          '--json',
        ].join(' '),
      ], options);
      report.commands.push(portalIdentityCommandId);
      const portalIdentityInvocation = waitForCommand(instanceId, portalIdentityCommandId, options);
      if (portalIdentityInvocation.Status !== 'Success') {
        throw new Error(`Portal-context AWS identity discovery failed (${portalIdentityInvocation.Status}): ${String(portalIdentityInvocation.Stderr || portalIdentityInvocation.Stdout || '').slice(0, 4000)}`);
      }
      const portalIdentityReport = parseSmokeJson(portalIdentityInvocation.Stdout);
      const portalAwsIdentity = portalIdentityReport?.identity?.aws;
      if (
        portalIdentityReport?.ok !== true ||
        portalAwsIdentity?.account !== EXPECTED_AWS_ACCOUNT ||
        !new RegExp(`^arn:aws:(?:iam|sts)::${EXPECTED_AWS_ACCOUNT}:`).test(String(portalAwsIdentity?.arn || ''))
      ) {
        throw new Error(`Portal-context AWS identity did not fail closed to TEST account ${EXPECTED_AWS_ACCOUNT}.`);
      }
      report.instance.postEnvironmentArn = portalAwsIdentity.arn;

      const admission = runAdmissionPreflight(instanceId, bundle, options.attemptId, options);
      report.commands.push(admission.commandId);
      const transportManifest = parseSmokeJson(admission.invocation.Stdout);
      const retrieved = retrieveAdmissionEvidence(instanceId, bundle, transportManifest, options);
      report.commands.push(...retrieved.commandIds);
      report.admissionTransport = {
        manifest: retrieved.manifest,
        chunks: retrieved.chunks,
        reconstructedBytes: retrieved.reconstructedBytes,
        reconstructedSha256: retrieved.reconstructedSha256,
      };
      report.admission = validateCompleteAdmission(retrieved.admission, options.attemptId);
      report.ok = true;
    } finally {
      if (bundlePresent) {
        const cleanup = removeAdmissionBundle(instanceId, bundle, options);
        report.commands.push(cleanup.commandId);
        report.bundle.cleanup = { status: cleanup.invocation.Status, absent: true };
      }
      report.finishedAt = new Date().toISOString();
      writeJsonAtomic(options.evidenceOut, report);
    }
    if (options.json) console.log(JSON.stringify(report, null, 2));
    else console.log(`[PASS] CFA read-only admission ${options.attemptId}`);
    return;
  }
  const bundle = admissionBundle(options.attemptId);
  const remotePath = path.posix.join(bundle.remoteRoot, 'portal/scripts/cfa-signing-smoke.js');
  let bundlePresent = false;
  let report = null;
  try {
    bundlePresent = true;
    const bundleCommandIds = installAdmissionBundle(instanceId, bundle, options);
    const preflightRun = runAdmissionPreflight(instanceId, bundle, options.attemptId, options);
    const preflightCommandId = preflightRun.commandId;
    const preflightManifest = parseSmokeJson(preflightRun.invocation.Stdout);
    const preflightRetrieval = retrieveAdmissionEvidence(instanceId, bundle, preflightManifest, options);
    const preflight = validateCompleteAdmission(preflightRetrieval.admission, options.attemptId);

    const portalIdentityCommandId = sendCommand(instanceId, [
      'set -euo pipefail',
      'cd /opt/nwac/portal',
      [
        'NODE_PATH=/opt/nwac/admin-dashboard/node_modules:/opt/nwac/portal/node_modules',
        'node', shellQuote(remotePath),
        '--env-file', shellQuote('/opt/nwac/portal/.env.test'),
        '--expected-aws-account', shellQuote(EXPECTED_AWS_ACCOUNT),
        '--identity-only',
        '--json',
      ].join(' '),
    ], options);
    const portalIdentityInvocation = waitForCommand(instanceId, portalIdentityCommandId, options);
    if (portalIdentityInvocation.Status !== 'Success') {
      throw new Error(`Portal-context AWS identity discovery failed (${portalIdentityInvocation.Status}): ${String(portalIdentityInvocation.Stderr || portalIdentityInvocation.Stdout || '').slice(0, 4000)}`);
    }
    const portalIdentityReport = parseSmokeJson(portalIdentityInvocation.Stdout);
    const portalAwsIdentity = portalIdentityReport?.identity?.aws;
    if (
      portalIdentityReport?.ok !== true ||
      portalAwsIdentity?.account !== EXPECTED_AWS_ACCOUNT ||
      !new RegExp(`^arn:aws:(?:iam|sts)::${EXPECTED_AWS_ACCOUNT}:`).test(String(portalAwsIdentity?.arn || ''))
    ) {
      throw new Error(`Portal-context AWS identity did not fail closed to TEST account ${EXPECTED_AWS_ACCOUNT}.`);
    }

    applicant.sub = createApplicant({ ...applicant, poolId }, options);
    const commandPlan = statefulCommandPlan({
      bundle,
      attemptId: options.attemptId,
      applicant,
      portalAwsArn: portalAwsIdentity.arn,
      workflow: preflight.prerequisites.workflow,
    });
    const commands = [
      'set -euo pipefail',
      `cd ${shellQuote(path.posix.join(bundle.remoteRoot, 'portal'))}`,
      commandPlan.execute,
    ];
    const commandId = sendCommand(instanceId, commands, options);
    const invocation = waitForCommand(instanceId, commandId, options);
    if (invocation.Status !== 'Success') {
      throw new Error(`Remote TEST smoke failed (${invocation.Status}): ${String(invocation.Stderr || invocation.Stdout || '').slice(0, 4000)}`);
    }
    report = parseSmokeJson(invocation.Stdout);
    if (!report.ok) throw new Error('Remote TEST CFA signing smoke returned ok=false');
    report.test = {
      instanceId,
      commandId,
      preflightCommandId,
      portalIdentityCommandId,
      preflight,
      preflightTransport: {
        manifest: preflightRetrieval.manifest,
        chunks: preflightRetrieval.chunks,
        commandIds: preflightRetrieval.commandIds,
        reconstructedBytes: preflightRetrieval.reconstructedBytes,
        reconstructedSha256: preflightRetrieval.reconstructedSha256,
      },
      bundleCommandIds,
      bundleDigest: bundle.digest,
      fixtureStamp: commandPlan.fixtureStamp,
      recoveryCommand: commandPlan.recover,
      residueCommand: commandPlan.verifyResidue,
      operatorArn: identity.Arn,
      instanceRoleArn: remoteAwsIdentity.arn,
      portalContextArn: portalAwsIdentity.arn,
    };
  } finally {
    if (applicant.sub) deleteApplicant(applicant.email, poolId, options);
    if (bundlePresent) removeAdmissionBundle(instanceId, bundle, options);
    if (report) {
      report.finishedAt = new Date().toISOString();
      writeJsonAtomic(options.evidenceOut, report);
    }
  }

  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const check of report.checks || []) console.log(`[PASS] ${check}`);
    console.log('[PASS] TEST fixture, Cognito identity, and object cleaned up');
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}

module.exports = {
  DEFAULT_LIMITS,
  EVIDENCE_CHUNK_BYTES,
  admissionBundle,
  admissionEvidenceFile,
  createEvidenceChunk,
  parseArgs,
  parseEvidenceChunk,
  parseSmokeJson,
  reconstructAdmissionEvidence,
  retrieveAdmissionEvidence,
  statefulCommandPlan,
  validateAdmissionTransportManifest,
  validateCompleteAdmission,
  waitForCommand,
};
