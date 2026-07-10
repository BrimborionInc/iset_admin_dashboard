#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const TEST_ACCOUNT_ID = '124355655255';
const DEFAULT_PROFILE = 'nwac-test';
const DEFAULT_REGION = 'ca-central-1';
const DEFAULT_BUCKET = 'nwac-test-artifacts';
const DEFAULT_PORTAL_ENV = path.resolve(__dirname, '..', '..', 'ISET-intake', '.env.test');
const DEFAULT_LOCAL_BASE_URL = 'http://127.0.0.1:5000';

function parseArgs(argv) {
  const args = {
    profile: process.env.AWS_PROFILE || DEFAULT_PROFILE,
    region: process.env.AWS_REGION || DEFAULT_REGION,
    bucket: process.env.R1_INTAKE_SMOKE_BUCKET || DEFAULT_BUCKET,
    instanceId: process.env.R1_INTAKE_SMOKE_INSTANCE_ID || '',
    portalEnv: process.env.R1_INTAKE_SMOKE_PORTAL_ENV || DEFAULT_PORTAL_ENV,
    keepFixture: false,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--profile') args.profile = argv[++index];
    else if (token === '--region') args.region = argv[++index];
    else if (token === '--bucket') args.bucket = argv[++index];
    else if (token === '--instance-id') args.instanceId = argv[++index];
    else if (token === '--portal-env') args.portalEnv = argv[++index];
    else if (token === '--keep-fixture') args.keepFixture = true;
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${token}`);
    }
  }
  return args;
}

function usage() {
  console.log([
    'Usage: node scripts/r1-intake-completion-test-smoke.js [options]',
    '',
    'Creates one disposable TEST Cognito applicant and exercises the deployed',
    'portal intake completion boundary against the published TEST workflow and',
    'real TEST database. Cleanup is automatic unless --keep-fixture is supplied.',
    '',
    'Options:',
    '  --instance-id ID   Use a specific online nwac-test-app instance.',
    '  --profile NAME     AWS profile. Default: nwac-test.',
    '  --region REGION    AWS region. Default: ca-central-1.',
    '  --bucket NAME      Temporary script bucket. Default: nwac-test-artifacts.',
    '  --portal-env PATH  Portal .env.test used for Cognito pool discovery.',
    '  --keep-fixture     Retain TEST DB/Cognito/object-store fixture.',
    '  --json             Emit the structured result.',
  ].join('\n'));
}

function readEnvFile(filePath) {
  const env = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function aws(args, options) {
  return execFileSync('aws', [
    ...args,
    '--region',
    options.region,
    '--profile',
    options.profile,
  ], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 20 * 1024 * 1024,
  });
}

function awsJson(args, options) {
  const output = aws([...args, '--output', 'json'], options).trim();
  return output ? JSON.parse(output) : null;
}

function awsText(args, options) {
  return aws([...args, '--output', 'text'], options).trim();
}

function shellQuote(value) {
  return `'${String(value).replace(/'/gu, `'\\''`)}'`;
}

function randomPassword() {
  const random = crypto.randomBytes(12).toString('base64url').slice(0, 15);
  return `R1#${random}aA1!`;
}

function discoverInstanceId(options) {
  if (options.instanceId) return options.instanceId;
  const online = new Set(
    awsText([
      'ssm',
      'describe-instance-information',
      '--query',
      'InstanceInformationList[?PingStatus==`Online`].InstanceId',
    ], options).split(/\s+/u).filter(Boolean)
  );
  const running = awsText([
    'ec2',
    'describe-instances',
    '--filters',
    'Name=tag:Name,Values=nwac-test-app',
    'Name=instance-state-name,Values=running',
    '--query',
    'Reservations[].Instances[].InstanceId',
  ], options).split(/\s+/u).filter(Boolean);
  const instanceId = running.find(id => online.has(id));
  if (!instanceId) throw new Error('No online SSM-managed nwac-test-app instance found.');
  return instanceId;
}

function createCognitoUser({ email, password, givenName, familyName, poolId }, options) {
  aws([
    'cognito-idp',
    'admin-create-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--message-action',
    'SUPPRESS',
    '--user-attributes',
    `Name=email,Value=${email}`,
    'Name=email_verified,Value=true',
    `Name=preferred_username,Value=${email}`,
    `Name=given_name,Value=${givenName}`,
    `Name=family_name,Value=${familyName}`,
  ], options);
  aws([
    'cognito-idp',
    'admin-set-user-password',
    '--user-pool-id',
    poolId,
    '--username',
    email,
    '--password',
    password,
    '--permanent',
  ], options);
  const user = awsJson([
    'cognito-idp',
    'admin-get-user',
    '--user-pool-id',
    poolId,
    '--username',
    email,
  ], options);
  const sub = (user?.UserAttributes || []).find(attribute => attribute.Name === 'sub')?.Value;
  if (!sub) throw new Error('Unable to resolve disposable TEST applicant Cognito subject.');
  return sub;
}

function deleteCognitoUser({ email, poolId }, options) {
  try {
    aws([
      'cognito-idp',
      'admin-delete-user',
      '--user-pool-id',
      poolId,
      '--username',
      email,
    ], options);
  } catch (error) {
    const message = String(error.stderr || error.message || error);
    if (!/UserNotFoundException/u.test(message)) throw error;
  }
}

function cognitoUserIsAbsent({ email, poolId }, options) {
  try {
    aws([
      'cognito-idp',
      'admin-get-user',
      '--user-pool-id',
      poolId,
      '--username',
      email,
    ], options);
    return false;
  } catch (error) {
    return /UserNotFoundException/u.test(String(error.stderr || error.message || error));
  }
}

function uploadRemoteScript(source, key, options) {
  const tempFile = path.join(os.tmpdir(), `r1-intake-smoke-${process.pid}-${Date.now()}.js`);
  fs.writeFileSync(tempFile, source, 'utf8');
  try {
    aws([
      's3',
      'cp',
      tempFile,
      `s3://${options.bucket}/${key}`,
      '--only-show-errors',
    ], options);
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

function deleteRemoteScript(key, options) {
  try {
    aws([
      's3',
      'rm',
      `s3://${options.bucket}/${key}`,
      '--only-show-errors',
    ], options);
  } catch (_) {
    // The disposable runner object is best-effort cleanup; DB/object evidence is remote-runner-owned.
  }
}

function sendRemoteCommand(instanceId, commands, comment, options) {
  const paramsFile = path.join(os.tmpdir(), `r1-intake-params-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(paramsFile, JSON.stringify({ commands }), 'utf8');
  try {
    return awsText([
      'ssm',
      'send-command',
      '--instance-ids',
      instanceId,
      '--document-name',
      'AWS-RunShellScript',
      '--parameters',
      `file://${paramsFile}`,
      '--comment',
      comment,
      '--query',
      'Command.CommandId',
    ], options);
  } finally {
    fs.rmSync(paramsFile, { force: true });
  }
}

async function waitForCommand(instanceId, commandId, options) {
  for (;;) {
    let invocation = null;
    try {
      invocation = awsJson([
        'ssm',
        'get-command-invocation',
        '--command-id',
        commandId,
        '--instance-id',
        instanceId,
        '--query',
        '{Status:Status,Stdout:StandardOutputContent,Stderr:StandardErrorContent}',
      ], options);
    } catch (_) {
      invocation = null;
    }
    if (['', 'Pending', 'InProgress', 'Delayed'].includes(invocation?.Status || '')) {
      await new Promise(resolve => setTimeout(resolve, 2500));
      continue;
    }
    return invocation;
  }
}

function parseRemoteResult(stdout) {
  const marker = '@@R1_INTAKE_TEST_RESULT@@';
  const index = String(stdout || '').lastIndexOf(marker);
  if (index < 0) return null;
  try {
    return JSON.parse(String(stdout).slice(index + marker.length).trim());
  } catch (_) {
    return null;
  }
}

function summarize(result) {
  return (result?.checks || [])
    .map(check => `${check.status.padEnd(4)} ${check.name}`)
    .join('\n');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!fs.existsSync(options.portalEnv)) {
    throw new Error(`Portal env file not found: ${options.portalEnv}`);
  }
  const identity = awsJson(['sts', 'get-caller-identity'], options);
  if (String(identity?.Account || '') !== TEST_ACCOUNT_ID) {
    throw new Error(`Refusing to run outside TEST account ${TEST_ACCOUNT_ID}.`);
  }

  const portalEnv = readEnvFile(options.portalEnv);
  const poolId =
    portalEnv.COGNITO_APPLICANT_USER_POOL_ID ||
    portalEnv.COGNITO_PORTAL_USER_POOL_ID ||
    portalEnv.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error('Applicant Cognito user-pool ID is missing from portal .env.test.');

  const suffix = crypto.randomBytes(5).toString('hex');
  const stamp = `r1-${Date.now()}-${suffix}`;
  const applicant = {
    email: `codex.portal.r1.${suffix}@example.com`,
    password: randomPassword(),
    givenName: 'Codex',
    familyName: `R1 ${suffix}`,
  };
  let cognitoCreated = false;
  let remoteKey = null;
  let result = null;
  let runError = null;

  try {
    const instanceId = discoverInstanceId(options);
    console.log(`[r1-intake-test] TEST identity ${identity.Arn}`);
    console.log(`[r1-intake-test] Using ${instanceId}`);
    applicant.sub = createCognitoUser({ ...applicant, poolId }, options);
    cognitoCreated = true;

    remoteKey = `ssm-scripts/r1-intake-completion-${stamp}.js`;
    uploadRemoteScript(`(${remoteRunner.toString()})();\n`, remoteKey, options);
    const remotePath = `/tmp/r1-intake-completion-${stamp}.js`;
    const commands = [
      'set -euo pipefail',
      `aws s3 cp ${shellQuote(`s3://${options.bucket}/${remoteKey}`)} ${shellQuote(remotePath)} --region ${shellQuote(options.region)} --only-show-errors`,
      `trap 'rm -f ${shellQuote(remotePath)}' EXIT`,
      'cd /opt/nwac/portal',
      [
        `FIXTURE_STAMP=${shellQuote(stamp)}`,
        `APPLICANT_EMAIL=${shellQuote(applicant.email)}`,
        `APPLICANT_PASSWORD=${shellQuote(applicant.password)}`,
        `APPLICANT_SUB=${shellQuote(applicant.sub)}`,
        `KEEP_FIXTURE=${options.keepFixture ? '1' : '0'}`,
        `PORTAL_LOCAL_BASE_URL=${shellQuote(DEFAULT_LOCAL_BASE_URL)}`,
        `node ${shellQuote(remotePath)}`,
      ].join(' '),
    ];
    const commandId = sendRemoteCommand(
      instanceId,
      commands,
      'Codex R1 intake completion TEST rehearsal',
      options
    );
    console.log(`[r1-intake-test] SSM command ${commandId}`);
    const invocation = await waitForCommand(instanceId, commandId, options);
    result = parseRemoteResult(invocation?.Stdout);
    if (invocation?.Status !== 'Success') {
      throw new Error(`Remote rehearsal failed with status ${invocation?.Status || 'unknown'}: ${invocation?.Stderr || invocation?.Stdout || ''}`);
    }
    if (!result) throw new Error('Remote rehearsal emitted no parseable result.');
    const failures = (result.checks || []).filter(check => check.status === 'FAIL');
    if (failures.length) throw new Error(`${failures.length} TEST rehearsal check(s) failed.`);
  } catch (error) {
    runError = error;
  } finally {
    if (remoteKey) deleteRemoteScript(remoteKey, options);
    if (cognitoCreated && !options.keepFixture) {
      try {
        deleteCognitoUser({ email: applicant.email, poolId }, options);
      } catch (error) {
        runError = runError || error;
      }
    }
  }

  if (cognitoCreated && !options.keepFixture) {
    const absent = cognitoUserIsAbsent({ email: applicant.email, poolId }, options);
    if (result) result.cognitoCleanup = absent ? 'verified_absent' : 'failed';
    if (!absent) runError = runError || new Error('Disposable TEST Cognito applicant still exists after cleanup.');
  }
  if (runError) throw runError;

  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(summarize(result));
    console.log(`[r1-intake-test] Fixture IDs: ${JSON.stringify(result.fixtureIds)}`);
    console.log(`[r1-intake-test] Cleanup: DB=${result.cleanup?.database}, objects=${result.cleanup?.objects}, Cognito=${result.cognitoCleanup || 'kept'}`);
  }
}

function remoteRunner() {
  const crypto = require('crypto');
  const { createRequire } = require('module');
  const portalRequire = createRequire('/opt/nwac/portal/package.json');
  try {
    portalRequire('dotenv').config({ path: '/opt/nwac/portal/.env.test' });
    portalRequire('dotenv').config({ path: '/opt/nwac/portal/.env' });
  } catch (_) {
    // The deployed process already has these values; dotenv supports the ad hoc SSM process.
  }
  const mysql = portalRequire('mysql2/promise');
  const { deleteObject, headObject } = portalRequire('./s3Provider');
  const {
    validateWorkflowCompletionPayload,
  } = portalRequire('./src/services/intakeWorkflowCompletionValidation');

  const config = {
    stamp: requiredEnv('FIXTURE_STAMP'),
    email: requiredEnv('APPLICANT_EMAIL'),
    password: requiredEnv('APPLICANT_PASSWORD'),
    sub: requiredEnv('APPLICANT_SUB'),
    keepFixture: process.env.KEEP_FIXTURE === '1',
    baseUrl: stripTrailingSlash(process.env.PORTAL_LOCAL_BASE_URL || 'http://127.0.0.1:5000'),
  };
  const result = {
    status: 'running',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    checks: [],
    fixtureIds: {},
    publishedWorkflow: null,
    sideEffects: null,
    cleanup: { database: 'not_run', objects: 'not_run' },
  };
  let connection = null;
  let session = null;
  let expectedObjectKeys = [];

  execute().catch(() => {
    // execute records and emits its own failure result.
  });

  async function execute() {
    let primaryError = null;
    try {
      connection = await mysql.createConnection(dbConfig());
      await cleanupFixture({ quiet: true });
      const userId = await seedUser();
      result.fixtureIds.userId = userId;
      session = await login(userId);
      const workflowResponse = await apiRequest('/api/runtime/workflow-schema');
      expect('deployed published workflow schema is available', workflowResponse.status === 200 && Array.isArray(workflowResponse.json?.schema), {
        status: workflowResponse.status,
        stepCount: workflowResponse.json?.schema?.length || 0,
      });
      if (workflowResponse.status !== 200 || !Array.isArray(workflowResponse.json?.schema)) {
        throw new Error('published_workflow_unavailable');
      }

      const workflow = workflowResponse.json;
      const workflowId = Number(workflow?.meta?.workflowId || 0) || null;
      result.publishedWorkflow = {
        workflowId,
        stepCount: workflow.schema.length,
        version: workflow.version || workflow?.meta?.version || null,
      };
      const validPayload = buildValidPayload(workflow, config.email);
      const validCheck = validateWorkflowCompletionPayload(workflow, validPayload);
      expect('generated payload satisfies deployed applicable-path validator', validCheck.ok, {
        issues: validCheck.issues,
        applicableStepIds: validCheck.applicableStepIds,
        answerCount: Object.keys(validPayload).length,
      });
      if (!validCheck.ok) throw new Error('valid_fixture_payload_rejected');

      const missingSignature = findApplicableSignature(workflow, validPayload);
      if (!missingSignature) throw new Error('no_applicable_required_signature_found');
      const invalidPayload = clone(validPayload);
      delete invalidPayload[missingSignature.field];
      const invalidCheck = validateWorkflowCompletionPayload(workflow, invalidPayload);
      expect('fixture removes one genuinely applicable published-workflow signature', !invalidCheck.ok && invalidCheck.missing.includes(missingSignature.field), {
        field: missingSignature.field,
        stepId: missingSignature.stepId,
        firstInvalidStepId: invalidCheck.firstInvalidStepId,
      });
      if (invalidCheck.ok || !invalidCheck.missing.includes(missingSignature.field)) {
        throw new Error('invalid_fixture_not_rejected_locally');
      }

      await persistInputState(userId, workflowId, invalidPayload, invalidCheck.applicableStepIds);
      const beforeInvalid = await coreSnapshot(userId);
      expect('fixture begins with zero core completion records', coreCountsAreZero(beforeInvalid), beforeInvalid);

      const rejected = await apiRequest('/api/intake/complete', { method: 'POST', body: {} });
      const afterInvalid = await coreSnapshot(userId);
      expect('missing applicable signature returns field/step-specific 422',
        rejected.status === 422 &&
          rejected.json?.error === 'submission_incomplete' &&
          Array.isArray(rejected.json?.missing) &&
          rejected.json.missing.includes(missingSignature.field) &&
          rejected.json?.firstInvalidStepId === missingSignature.stepId,
        {
          status: rejected.status,
          error: rejected.json?.error || null,
          missing: rejected.json?.missing || [],
          firstInvalidStepId: rejected.json?.firstInvalidStepId || null,
        }
      );
      expect('422 leaves client/submission/application/case counts at zero', coreCountsAreZero(afterInvalid), afterInvalid);

      await persistInputState(userId, workflowId, validPayload, validCheck.applicableStepIds);
      const completed = await apiRequest('/api/intake/complete', { method: 'POST', body: {} });
      expect('valid published-workflow payload completes once',
        completed.status === 201 &&
          Number(completed.json?.id) > 0 &&
          Number(completed.json?.application_id) > 0 &&
          Number(completed.json?.case_id) > 0,
        { status: completed.status, body: completed.json }
      );
      if (completed.status !== 201) throw new Error('valid_completion_failed');

      result.fixtureIds = {
        userId,
        submissionId: Number(completed.json.id),
        applicationId: Number(completed.json.application_id),
        caseId: Number(completed.json.case_id),
        reference: completed.json.reference_number,
      };
      const coherent = await coherentResult(userId, result.fixtureIds);
      expect('real TEST database contains one coherent client/case/submission/application result', coherent.ok, coherent);

      const beforeRetry = await sideEffectSnapshot(userId, result.fixtureIds);
      expectedObjectKeys = beforeRetry.documentKeys.slice();
      const objectStateBeforeRetry = await objectState(expectedObjectKeys);
      expect('existing signed-form post-commit path produced five linked documents and objects',
        beforeRetry.documentCount === 5 && objectStateBeforeRetry.every(item => item.exists),
        { documents: beforeRetry.documents, objects: objectStateBeforeRetry }
      );

      const retried = await apiRequest('/api/intake/complete', { method: 'POST', body: {} });
      const afterRetry = await sideEffectSnapshot(userId, result.fixtureIds);
      const objectStateAfterRetry = await objectState(expectedObjectKeys);
      expect('coherent retry returns the existing result idempotently',
        retried.status === 200 &&
          retried.json?.idempotent === true &&
          Number(retried.json?.id) === result.fixtureIds.submissionId &&
          Number(retried.json?.application_id) === result.fixtureIds.applicationId &&
          Number(retried.json?.case_id) === result.fixtureIds.caseId &&
          retried.json?.reference_number === result.fixtureIds.reference,
        { status: retried.status, body: retried.json }
      );
      expect('retry creates no duplicate core rows or repeated post-commit work',
        JSON.stringify(afterRetry) === JSON.stringify(beforeRetry) &&
          objectStateAfterRetry.every(item => item.exists),
        { beforeRetry, afterRetry, objects: objectStateAfterRetry }
      );
      result.sideEffects = beforeRetry;
    } catch (error) {
      primaryError = error;
      fail('remote R1 rehearsal completed without an unexpected error', {
        error: error?.stack || error?.message || String(error),
      });
    } finally {
      if (connection && !config.keepFixture) {
        try {
          await cleanupFixture();
        } catch (cleanupError) {
          fail('TEST fixture cleanup completed', {
            error: cleanupError?.stack || cleanupError?.message || String(cleanupError),
          });
          primaryError = primaryError || cleanupError;
        }
      } else if (config.keepFixture) {
        result.cleanup = { database: 'kept', objects: 'kept' };
      }
      if (connection) await connection.end().catch(() => {});
      result.status = result.checks.some(check => check.status === 'FAIL') || primaryError ? 'failed' : 'passed';
      result.finishedAt = new Date().toISOString();
      console.log('@@R1_INTAKE_TEST_RESULT@@' + JSON.stringify(result));
      if (result.status !== 'passed') process.exitCode = 1;
    }
  }

  function requiredEnv(key) {
    const value = String(process.env[key] || '').trim();
    if (!value) throw new Error(`Missing env ${key}`);
    return value;
  }

  function stripTrailingSlash(value) {
    return String(value || '').replace(/\/+$/u, '');
  }

  function dbConfig() {
    return {
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER,
      password: process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'iset_intake',
      connectTimeout: 10000,
    };
  }

  function addCheck(status, name, details = {}) {
    result.checks.push({ status, name, details });
  }

  function expect(name, condition, details = {}) {
    addCheck(condition ? 'PASS' : 'FAIL', name, details);
  }

  function fail(name, details = {}) {
    addCheck('FAIL', name, details);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  async function query(sql, params = []) {
    return connection.query(sql, params);
  }

  async function insert(sql, params = []) {
    const [response] = await query(sql, params);
    return Number(response.insertId);
  }

  async function seedUser() {
    const userId = await insert(
      `INSERT INTO user (name, email, cognito_sub, email_verified, suspended, preferred_language)
       VALUES (?, ?, ?, 1, 0, 'en')`,
      [`Codex R1 ${config.stamp.slice(-8)}`, config.email, config.sub]
    );
    expect('disposable TEST applicant DB identity seeded', userId > 0, { userId });
    return userId;
  }

  async function fetchImpl(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);
    try {
      return await fetch(url, { ...options, signal: options.signal || controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function responseBody(response) {
    const text = await response.text();
    try {
      return { text, json: text ? JSON.parse(text) : null };
    } catch (_) {
      return { text, json: null };
    }
  }

  function setCookies(response) {
    if (typeof response.headers?.getSetCookie === 'function') return response.headers.getSetCookie();
    const single = response.headers?.get?.('set-cookie');
    return single ? [single] : [];
  }

  async function login(expectedUserId) {
    const response = await fetchImpl(`${config.baseUrl}/api/auth/password-login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: config.email, password: config.password }),
      redirect: 'manual',
    });
    const body = await responseBody(response);
    const cookieHeader = setCookies(response)
      .map(cookie => String(cookie).split(';')[0])
      .filter(Boolean)
      .join('; ');
    session = { cookieHeader };
    const me = await apiRequest('/api/me');
    expect('disposable applicant authenticates through deployed TEST portal',
      response.status === 200 &&
        body.json?.success === true &&
        me.status === 200 &&
        me.json?.authenticated === true &&
        Number(me.json?.id) === Number(expectedUserId),
      { loginStatus: response.status, meStatus: me.status, meId: me.json?.id || null }
    );
    return session;
  }

  async function apiRequest(route, options = {}) {
    const headers = { Accept: 'application/json', ...(options.headers || {}) };
    let body = options.body;
    if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    }
    if (session?.cookieHeader) headers.Cookie = session.cookieHeader;
    const response = await fetchImpl(`${config.baseUrl}${route}`, {
      method: options.method || 'GET',
      headers,
      body,
      redirect: 'manual',
    });
    const parsed = await responseBody(response);
    return { status: response.status, text: parsed.text, json: parsed.json };
  }

  function keyFor(component) {
    return component?.storageKey || component?.name || component?.props?.name || component?.id || null;
  }

  function preferredOption(component) {
    const key = String(keyFor(component) || '').toLowerCase();
    const options = component?.options || component?.items || [];
    const values = options.map(option => String(option?.value));
    const preferred = [
      [/conflict/u, 'no_conflict'],
      [/has.reg.number/u, '0'],
      [/biological.sex/u, 'female'],
      [/gender/u, 'female'],
      [/legal.indigenous.identity/u, 'first_nations_status'],
      [/preferred.language/u, 'en'],
      [/visible.minority/u, 'false'],
      [/marital/u, 'single'],
      [/dependent.children/u, 'no'],
      [/disability/u, 'no'],
      [/social.assistance/u, 'no'],
      [/case.worker/u, 'no'],
      [/labour.force/u, 'unemployed'],
      [/highest.education/u, 'secondary_school_diploma_or_ged'],
      [/target.program/u, 'not_yet'],
      [/loan.grant/u, 'no'],
      [/childcare/u, 'no'],
    ];
    for (const [pattern, value] of preferred) {
      if (pattern.test(key) && values.includes(value)) return value;
    }
    for (const value of ['no', 'false', '0', 'none', 'not_applicable', 'en']) {
      if (values.includes(value)) return value;
    }
    return options[0]?.value;
  }

  function valueFor(component, applicantEmail) {
    const key = String(keyFor(component) || '').toLowerCase();
    const type = String(component?.type || component?.template_key || '').toLowerCase();
    const options = component?.options || component?.items || [];
    if (type === 'signature-ack') {
      return { signed: true, name: 'Codex R1 Applicant', signedAt: new Date().toISOString() };
    }
    if (type === 'date' || type === 'date-input') return '1990-01-01';
    if (['radio', 'radios', 'select'].includes(type)) return preferredOption(component);
    if (type === 'checkbox' || type === 'checkboxes') {
      return options.length ? [options[0].value] : true;
    }
    if (type === 'file-upload') {
      return { filePath: `uploads/r1-smoke/${config.stamp}/${key}.pdf`, name: `${key}.pdf` };
    }
    if (/email/u.test(key)) return applicantEmail;
    if (/sin|social.insurance/u.test(key)) return '123 456 789';
    if (/phone|telephone/u.test(key)) return '5555551234';
    if (/postal|postcode/u.test(key)) return 'K1A 0B1';
    if (/first.name/u.test(key)) return 'Codex';
    if (/last.name/u.test(key)) return 'Applicant';
    if (/province/u.test(key)) return 'on';
    if (/income|expense|amount|cost|rent|funding/u.test(key) || component?.inputType === 'number') return '0';
    return 'Test value';
  }

  function buildValidPayload(workflow, applicantEmail) {
    const answers = {};
    const visit = component => {
      if (!component || typeof component !== 'object') return;
      const key = keyFor(component);
      if (key) answers[key] = valueFor(component, applicantEmail);
      (component.children || []).forEach(visit);
      (component.options || component.items || []).forEach(option => {
        (option?.children || option?.conditional?.children || []).forEach(visit);
      });
    };
    (workflow?.schema || []).forEach(step => (step?.components || []).forEach(visit));
    return answers;
  }

  function findApplicableSignature(workflow, payload) {
    const signatures = [];
    const visit = (component, stepId) => {
      if (!component || typeof component !== 'object') return;
      if (String(component.type || component.template_key || '').toLowerCase() === 'signature-ack') {
        signatures.push({ field: keyFor(component), stepId });
      }
      (component.children || []).forEach(child => visit(child, stepId));
      (component.options || component.items || []).forEach(option => {
        (option?.children || option?.conditional?.children || []).forEach(child => visit(child, stepId));
      });
    };
    (workflow?.schema || []).forEach(step => (step?.components || []).forEach(component => visit(component, step?.stepId)));
    signatures.sort((left, right) => (left.field === 'consent' ? -1 : right.field === 'consent' ? 1 : 0));
    for (const candidate of signatures) {
      if (!candidate.field) continue;
      const next = clone(payload);
      delete next[candidate.field];
      const check = validateWorkflowCompletionPayload(workflow, next);
      const issue = check.issues.find(item => item.field === candidate.field && item.reason === 'required');
      if (issue) return { field: candidate.field, stepId: issue.stepId || candidate.stepId || null };
    }
    return null;
  }

  async function persistInputState(userId, workflowId, payload, history) {
    const checksum = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const finalStepId = Array.isArray(history) && history.length ? history[history.length - 1] : null;
    await query(
      `INSERT INTO input_json_state
        (user_id, session_token, workflow_id, step_cursor, input_payload, history, doc_refs, client_id, checksum_sha256, version, expires_at)
       VALUES (?, '', ?, ?, CAST(? AS JSON), CAST(? AS JSON), CAST('[]' AS JSON), NULL, ?, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR))
       ON DUPLICATE KEY UPDATE
         workflow_id = VALUES(workflow_id),
         step_cursor = VALUES(step_cursor),
         input_payload = VALUES(input_payload),
         history = VALUES(history),
         doc_refs = VALUES(doc_refs),
         client_id = NULL,
         checksum_sha256 = VALUES(checksum_sha256),
         version = version + 1,
         expires_at = VALUES(expires_at)`,
      [userId, workflowId || 'iset-v1', finalStepId, JSON.stringify(payload), JSON.stringify(history || []), checksum]
    );
  }

  async function coreSnapshot(userId) {
    const [[row]] = await query(
      `SELECT
         (SELECT COUNT(*) FROM client WHERE applicant_cognito_sub = ?) AS clients,
         (SELECT COUNT(*) FROM iset_application_submission WHERE user_id = ?) AS submissions,
         (SELECT COUNT(*) FROM iset_application a JOIN iset_application_submission s ON s.id = a.submission_id WHERE s.user_id = ?) AS applications,
         (SELECT COUNT(*) FROM iset_case c JOIN client cl ON cl.id = c.client_id WHERE cl.applicant_cognito_sub = ?) AS cases,
         (SELECT COUNT(*) FROM iset_document WHERE applicant_user_id = ?) AS documents,
         (SELECT COUNT(*) FROM iset_event_entry WHERE actor_applicant_user_id = ?) AS events`,
      [config.sub, userId, userId, config.sub, userId, userId]
    );
    return Object.fromEntries(Object.entries(row || {}).map(([key, value]) => [key, Number(value)]));
  }

  function coreCountsAreZero(snapshot) {
    return ['clients', 'submissions', 'applications', 'cases', 'documents', 'events']
      .every(key => Number(snapshot?.[key] || 0) === 0);
  }

  async function coherentResult(userId, ids) {
    const [rows] = await query(
      `SELECT s.id AS submission_id, s.reference_number, s.user_id,
              a.id AS application_id, a.client_id AS application_client_id, a.case_id,
              c.client_id AS case_client_id, cl.applicant_cognito_sub
         FROM iset_application_submission s
         JOIN iset_application a ON a.submission_id = s.id
         JOIN iset_case c ON c.id = a.case_id
         JOIN client cl ON cl.id = a.client_id
        WHERE s.user_id = ?`,
      [userId]
    );
    const row = rows[0] || null;
    return {
      ok: rows.length === 1 &&
        Number(row?.submission_id) === ids.submissionId &&
        Number(row?.application_id) === ids.applicationId &&
        Number(row?.case_id) === ids.caseId &&
        Number(row?.application_client_id) === Number(row?.case_client_id) &&
        row?.applicant_cognito_sub === config.sub,
      rowCount: rows.length,
      submissionId: row?.submission_id || null,
      applicationId: row?.application_id || null,
      caseId: row?.case_id || null,
      clientIdsMatch: row ? Number(row.application_client_id) === Number(row.case_client_id) : false,
    };
  }

  async function sideEffectSnapshot(userId, ids) {
    const core = await coreSnapshot(userId);
    const [documents] = await query(
      `SELECT id, document_category, file_path
         FROM iset_document
        WHERE application_id = ? AND applicant_user_id = ?
        ORDER BY id`,
      [ids.applicationId, userId]
    );
    const [events] = await query(
      `SELECT id, event_type
         FROM iset_event_entry
        WHERE (subject_type = 'case' AND subject_id = ?)
           OR actor_applicant_user_id = ?
        ORDER BY id`,
      [String(ids.caseId), userId]
    );
    let notifications = [];
    if (events.length) {
      const placeholders = events.map(() => '?').join(',');
      [notifications] = await query(
        `SELECT id, event_key
           FROM iset_internal_notification
          WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.eventId')) IN (${placeholders})
          ORDER BY id`,
        events.map(event => event.id)
      );
    }
    return {
      core,
      documentCount: documents.length,
      documents: documents.map(row => ({ id: Number(row.id), category: row.document_category })),
      documentKeys: documents.map(row => row.file_path).sort(),
      events: events.map(row => ({ id: row.id, type: row.event_type })),
      notifications: notifications.map(row => ({ id: Number(row.id), event: row.event_key })),
    };
  }

  async function objectState(keys) {
    const states = [];
    for (const key of keys) {
      const state = await headObject({ key });
      states.push({ key, exists: Boolean(state?.exists), size: Number(state?.size || 0) });
    }
    return states;
  }

  function placeholders(values) {
    return values.map(() => '?').join(',');
  }

  async function resolveFixtureRows() {
    const [users] = await query('SELECT id FROM user WHERE email = ? OR cognito_sub = ?', [config.email, config.sub]);
    const userIds = users.map(row => Number(row.id));
    const [clients] = await query(
      'SELECT id FROM client WHERE applicant_cognito_sub = ? OR applicant_account_email = ?',
      [config.sub, config.email]
    );
    const clientIds = clients.map(row => Number(row.id));
    let clientEvents = [];
    if (clientIds.length) {
      [clientEvents] = await query(
        `SELECT id FROM client_applicant_account_event WHERE client_id IN (${placeholders(clientIds)})`,
        clientIds
      );
    }
    let submissions = [];
    if (userIds.length) {
      [submissions] = await query(
        `SELECT id FROM iset_application_submission WHERE user_id IN (${placeholders(userIds)})`,
        userIds
      );
    }
    const submissionIds = submissions.map(row => Number(row.id));
    let applications = [];
    if (submissionIds.length) {
      [applications] = await query(
        `SELECT id, case_id FROM iset_application WHERE submission_id IN (${placeholders(submissionIds)})`,
        submissionIds
      );
    }
    const applicationIds = applications.map(row => Number(row.id));
    const caseIds = [...new Set(applications.map(row => Number(row.case_id)).filter(Boolean))];
    let documents = [];
    const documentWhere = [];
    const documentParams = [];
    if (userIds.length) {
      documentWhere.push(`applicant_user_id IN (${placeholders(userIds)})`);
      documentParams.push(...userIds);
    }
    if (applicationIds.length) {
      documentWhere.push(`application_id IN (${placeholders(applicationIds)})`);
      documentParams.push(...applicationIds);
    }
    if (documentWhere.length) {
      [documents] = await query(
        `SELECT id, file_path FROM iset_document WHERE ${documentWhere.join(' OR ')}`,
        documentParams
      );
    }
    let events = [];
    const eventWhere = [];
    const eventParams = [];
    if (userIds.length) {
      eventWhere.push(`actor_applicant_user_id IN (${placeholders(userIds)})`);
      eventParams.push(...userIds);
    }
    if (caseIds.length) {
      eventWhere.push(`(subject_type = 'case' AND subject_id IN (${placeholders(caseIds)}))`);
      eventParams.push(...caseIds.map(String));
    }
    if (eventWhere.length) {
      [events] = await query(`SELECT id FROM iset_event_entry WHERE ${eventWhere.join(' OR ')}`, eventParams);
    }
    const eventIds = events.map(row => row.id);
    let notifications = [];
    if (eventIds.length) {
      [notifications] = await query(
        `SELECT id FROM iset_internal_notification
          WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.eventId')) IN (${placeholders(eventIds)})`,
        eventIds
      );
    }
    return {
      userIds,
      clientIds,
      clientEventIds: clientEvents.map(row => Number(row.id)),
      submissionIds,
      applicationIds,
      caseIds,
      documents,
      eventIds,
      notificationIds: notifications.map(row => Number(row.id)),
    };
  }

  async function cleanupFixture({ quiet = false } = {}) {
    const fixture = await resolveFixtureRows();
    const objectKeys = [...new Set(fixture.documents.map(row => row.file_path).filter(Boolean))];
    const objectFailures = [];
    for (const key of objectKeys) {
      try {
        await deleteObject({ key });
      } catch (error) {
        objectFailures.push({ key, error: error?.message || String(error) });
      }
    }

    await connection.beginTransaction();
    try {
      if (fixture.notificationIds.length) {
        await query(
          `DELETE FROM iset_internal_notification_dismissal WHERE notification_id IN (${placeholders(fixture.notificationIds)})`,
          fixture.notificationIds
        );
        await query(
          `DELETE FROM iset_internal_notification WHERE id IN (${placeholders(fixture.notificationIds)})`,
          fixture.notificationIds
        );
      }
      if (fixture.eventIds.length) {
        await query(`DELETE FROM iset_event_receipt WHERE event_id IN (${placeholders(fixture.eventIds)})`, fixture.eventIds);
        await query(`DELETE FROM iset_event_entry WHERE id IN (${placeholders(fixture.eventIds)})`, fixture.eventIds);
      }
      if (fixture.documents.length) {
        const documentIds = fixture.documents.map(row => Number(row.id));
        await query(`DELETE FROM iset_document WHERE id IN (${placeholders(documentIds)})`, documentIds);
      }
      if (fixture.applicationIds.length) {
        await query(`DELETE FROM iset_application WHERE id IN (${placeholders(fixture.applicationIds)})`, fixture.applicationIds);
      }
      if (fixture.submissionIds.length) {
        await query(
          `DELETE FROM iset_application_submission WHERE id IN (${placeholders(fixture.submissionIds)})`,
          fixture.submissionIds
        );
      }
      if (fixture.caseIds.length) {
        await query(`DELETE FROM iset_case WHERE id IN (${placeholders(fixture.caseIds)})`, fixture.caseIds);
      }
      if (fixture.clientEventIds.length) {
        await query(
          `DELETE FROM client_applicant_account_event WHERE id IN (${placeholders(fixture.clientEventIds)})`,
          fixture.clientEventIds
        );
      }
      if (fixture.clientIds.length) {
        await query(`DELETE FROM client WHERE id IN (${placeholders(fixture.clientIds)})`, fixture.clientIds);
      }
      if (fixture.userIds.length) {
        const params = fixture.userIds;
        await query(`DELETE FROM input_json_state WHERE user_id IN (${placeholders(params)})`, params);
        await query(`DELETE FROM iset_application_draft_dynamic WHERE user_id IN (${placeholders(params)})`, params);
        await query(`DELETE FROM pending_uploads WHERE user_id IN (${placeholders(params)})`, params);
        await query(`DELETE FROM iset_application_file WHERE user_id IN (${placeholders(params)})`, params);
        await query(`DELETE FROM user_session_audit WHERE user_id IN (${placeholders(params)})`, params);
        await query(`DELETE FROM user WHERE id IN (${placeholders(params)})`, params);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }

    const residue = await resolveFixtureRows();
    const objectResidue = [];
    for (const key of objectKeys) {
      const state = await headObject({ key });
      if (state?.exists) objectResidue.push(key);
    }
    const databaseEmpty = [
      residue.userIds,
      residue.clientIds,
      residue.clientEventIds,
      residue.submissionIds,
      residue.applicationIds,
      residue.caseIds,
      residue.documents,
      residue.eventIds,
      residue.notificationIds,
    ].every(values => values.length === 0);
    if (!quiet) {
      result.cleanup = {
        database: databaseEmpty ? 'verified_empty' : 'residue',
        objects: !objectFailures.length && !objectResidue.length ? 'verified_absent' : 'residue',
      };
      expect('TEST database fixture cleanup leaves no residue', databaseEmpty, { residue });
      expect('TEST generated signed-form object cleanup leaves no residue',
        objectFailures.length === 0 && objectResidue.length === 0,
        { objectFailures, objectResidue }
      );
    }
    if (!databaseEmpty || objectFailures.length || objectResidue.length) {
      throw new Error('r1_fixture_cleanup_incomplete');
    }
  }
}

main().catch(error => {
  console.error('[r1-intake-test] Failed:', error?.message || error);
  process.exitCode = 1;
});
