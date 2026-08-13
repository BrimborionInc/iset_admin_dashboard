#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  createEvidenceId,
  requiredChecksFor,
  resolveDomains,
  resolveOperationDomains,
  sha256Files,
  sha256Json,
  validateEvidenceIntegrity,
  validateInventory,
  validateQualificationEvidence,
} = require('../src/lib/releaseQualification');

const REPO_ROOT = path.resolve(__dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'docs', 'testing', 'release-coverage-inventory.json');
const REPOSITORIES = Object.freeze({
  admin: REPO_ROOT,
  portal: path.resolve(REPO_ROOT, '..', 'ISET-intake'),
  shared: path.resolve(REPO_ROOT, '..', 'shared'),
  intacctMock: path.resolve(REPO_ROOT, '..', 'intacct-mock-service'),
});
const CFA_CHECK_ID = 'test-cfa-signing';
const CFA_QUALIFICATION_TIMEOUT_MS = 75 * 60 * 1000;

function usage() {
  console.log([
    'Usage: node scripts/path-release-qualify.js <plan|run|validate> [options]',
    '',
    'Commands:',
    '  plan       Resolve changed domains and mandatory checks without running them.',
    '  run        Run the resolved checks and write objective GO/NO-GO evidence.',
    '  validate   Validate an evidence file checksum, expiry, and current source.',
    '',
    'Options:',
    '  --stage dev|test             Qualification stage. Default: dev.',
    '  --release-id ID              Required for run.',
    '  --full                       Qualify every release domain.',
    '  --base REPO=REF              Include committed changes since REF; repeatable.',
    '  --operation NAME             Declare a runtime/data operation; repeatable.',
    '  --dev-evidence PATH          Required for TEST acceptance.',
    '  --deployment-manifest PATH   Required for TEST acceptance.',
    '  --evidence PATH              Evidence file for validate.',
    '  --evidence-out PATH          Override output path for run.',
    '  --json                       Emit machine-readable output.',
    '',
    'Required checks cannot be skipped. Missing credentials or fixtures are recorded',
    'as unavailable and make the decision NO-GO.',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = {
    command: argv[0] || null,
    stage: 'dev',
    releaseId: null,
    full: false,
    bases: {},
    operations: [],
    devEvidence: null,
    deploymentManifest: null,
    evidence: null,
    evidenceOut: null,
    json: false,
  };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--stage') args.stage = String(argv[++index] || '').toLowerCase();
    else if (token === '--release-id') args.releaseId = argv[++index];
    else if (token === '--full') args.full = true;
    else if (token === '--base') {
      const [repo, ...refParts] = String(argv[++index] || '').split('=');
      const ref = refParts.join('=');
      if (!REPOSITORIES[repo] || !ref) throw new Error('--base must use REPO=REF with admin, portal, or shared');
      args.bases[repo] = ref;
    } else if (token === '--operation') args.operations.push(String(argv[++index] || ''));
    else if (token === '--dev-evidence') args.devEvidence = path.resolve(argv[++index] || '');
    else if (token === '--deployment-manifest') args.deploymentManifest = path.resolve(argv[++index] || '');
    else if (token === '--evidence') args.evidence = path.resolve(argv[++index] || '');
    else if (token === '--evidence-out') args.evidenceOut = path.resolve(argv[++index] || '');
    else if (token === '--json') args.json = true;
    else if (token === '--help' || token === '-h') args.command = 'help';
    else throw new Error(`Unknown option: ${token}`);
  }
  if (!['plan', 'run', 'validate', 'help'].includes(args.command)) throw new Error('Command must be plan, run, or validate');
  if (!['dev', 'test'].includes(args.stage)) throw new Error('--stage must be dev or test');
  if (args.command === 'run' && !args.releaseId) throw new Error('--release-id is required for run');
  return args;
}

function runGit(repo, args, allowFailure = false) {
  const result = spawnSync('git', ['-C', REPOSITORIES[repo], ...args], { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`git ${args.join(' ')} failed for ${repo}: ${result.stderr.trim()}`);
  return result.status === 0 ? result.stdout : '';
}

function gitFiles(repo) {
  return runGit(repo, ['ls-files', '-co', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .sort();
}

function repoState(repo) {
  const isGitWorktree = runGit(repo, ['rev-parse', '--is-inside-work-tree'], true).trim() === 'true';
  if (repo === 'intacctMock' && !isGitWorktree) {
    const files = [];
    function visit(current, relative = '') {
      fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).forEach(entry => {
        if (['node_modules', '.git'].includes(entry.name)) return;
        const nextRelative = relative ? `${relative}/${entry.name}` : entry.name;
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) visit(full, nextRelative);
        else if (entry.isFile()) files.push(nextRelative);
      });
    }
    visit(REPOSITORIES[repo]);
    return { gitHead: null, treeFingerprint: sha256Files(REPOSITORIES[repo], files), gitDirty: null, fileCount: files.length };
  }
  const files = gitFiles(repo);
  const status = runGit(repo, ['status', '--porcelain']).split(/\r?\n/u).filter(Boolean);
  return {
    gitHead: runGit(repo, ['rev-parse', 'HEAD']).trim(),
    treeFingerprint: sha256Files(REPOSITORIES[repo], files),
    gitDirty: status.length > 0,
    fileCount: files.length,
  };
}

function uncommittedFiles(repo) {
  const output = [
    runGit(repo, ['diff', '--name-only']),
    runGit(repo, ['diff', '--cached', '--name-only']),
    runGit(repo, ['ls-files', '--others', '--exclude-standard']),
  ].join('\n');
  return output.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
}

function changedFiles(args) {
  const changed = { admin: [], portal: [], shared: [], intacctMock: [] };
  if (args.full) {
    ['admin', 'portal', 'shared'].forEach(repo => { changed[repo] = gitFiles(repo); });
    const mockState = repoState('intacctMock');
    if (mockState.fileCount) changed.intacctMock = ['src/server.js', 'README.md'];
    return changed;
  }
  ['admin', 'portal', 'shared'].forEach(repo => {
    const files = new Set(uncommittedFiles(repo));
    if (args.bases[repo]) {
      runGit(repo, ['diff', '--name-only', `${args.bases[repo]}...HEAD`])
        .split(/\r?\n/u).filter(Boolean).forEach(file => files.add(file));
    }
    changed[repo] = Array.from(files).sort();
  });
  return changed;
}

function schemaFingerprint() {
  const root = path.join(REPO_ROOT, 'sql', 'migrations');
  const files = fs.readdirSync(root).filter(filename => filename.endsWith('.sql')).sort();
  return sha256Files(root, files);
}

function loadJson(filename) {
  return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function loadInventory() {
  return loadJson(INVENTORY_PATH);
}

function buildPlan(args, inventory) {
  let changed = changedFiles(args);
  let resolved;
  let components;
  let source;
  let inherited = null;

  if (args.stage === 'test') {
    if (!args.devEvidence || !args.deploymentManifest) {
      throw new Error('TEST acceptance requires --dev-evidence and --deployment-manifest');
    }
    inherited = loadJson(args.devEvidence);
    const integrityErrors = validateEvidenceIntegrity(inherited);
    if (integrityErrors.length || inherited.stage !== 'dev' || inherited.decision !== 'GO') {
      throw new Error(`DEV evidence is not admissible: ${[...integrityErrors, `stage=${inherited.stage}`, `decision=${inherited.decision}`].join('; ')}`);
    }
    if (inherited.releaseId !== args.releaseId) {
      throw new Error(`TEST release ID ${args.releaseId} does not match DEV evidence ${inherited.releaseId}`);
    }
    resolved = { domainIds: inherited.domains || [], unmatched: [] };
    components = inherited.candidate?.components || [];
    changed = inherited.changedFiles || changed;
    source = Object.fromEntries(components.map(repo => [repo, repoState(repo)]));
    const sourceErrors = validateQualificationEvidence({
      evidence: inherited,
      expectedStage: 'dev',
      currentSource: source,
      inventorySha256: sha256Json(inventory),
      schemaSha256: schemaFingerprint(),
      requiredComponents: components,
    });
    if (sourceErrors.length) throw new Error(`DEV evidence no longer matches the candidate: ${sourceErrors.join('; ')}`);
  } else {
    resolved = resolveDomains(inventory, changed, args.full);
    const operationResolution = resolveOperationDomains(inventory, args.operations.filter(Boolean));
    resolved.domainIds = Array.from(new Set([...resolved.domainIds, ...operationResolution.domainIds])).sort();
    resolved.unmatchedOperations = operationResolution.unmatched;
    components = ['admin', 'portal', 'shared'];
    source = Object.fromEntries(components.map(repo => [repo, repoState(repo)]));
  }

  const requiredChecks = requiredChecksFor(inventory, args.stage, resolved.domainIds);
  return {
    stage: args.stage,
    releaseId: args.releaseId,
    full: args.full,
    changedFiles: changed,
    domains: resolved.domainIds,
    unmatched: resolved.unmatched,
    unmatchedOperations: resolved.unmatchedOperations || [],
    requiredChecks,
    operations: args.stage === 'test' ? (inherited.operations || []) : args.operations.filter(Boolean).sort(),
    candidate: {
      components,
      source,
      schemaSha256: schemaFingerprint(),
    },
  };
}

function validateCommandReferences(inventory) {
  const errors = [];
  Object.entries(inventory.checks || {}).forEach(([id, check]) => {
    if (!Array.isArray(check.command) || check.command[0] !== 'node') return;
    const script = check.command[1];
    if (!script || !script.endsWith('.js')) return;
    const cwd = REPOSITORIES[check.cwd || 'admin'];
    if (!fs.existsSync(path.resolve(cwd, script))) errors.push(`check ${id} references missing script ${script}`);
  });
  return errors;
}

function validatePrerequisiteDeclarations(inventory) {
  const errors = [];
  const checks = inventory.checks || {};
  Object.entries(checks).forEach(([id, check]) => {
    if (check.prerequisites === undefined) return;
    if (!Array.isArray(check.prerequisites) || !check.prerequisites.length) {
      errors.push(`check ${id} prerequisites must be a non-empty array`);
      return;
    }
    if (new Set(check.prerequisites).size !== check.prerequisites.length) {
      errors.push(`check ${id} has duplicate prerequisites`);
    }
    check.prerequisites.forEach(prerequisiteId => {
      if (!checks[prerequisiteId]) errors.push(`check ${id} references unknown prerequisite ${prerequisiteId}`);
      if (prerequisiteId === id) errors.push(`check ${id} cannot depend on itself`);
    });
  });
  for (const stage of ['dev', 'test']) {
    const ordered = inventory.alwaysRequired?.[stage] || [];
    const positions = new Map(ordered.map((id, index) => [id, index]));
    ordered.forEach(id => {
      for (const prerequisiteId of checks[id]?.prerequisites || []) {
        if (!positions.has(prerequisiteId) || positions.get(prerequisiteId) >= positions.get(id)) {
          errors.push(`check ${id} prerequisite ${prerequisiteId} must be an earlier ${stage} mandatory check`);
        }
      }
    });
  }
  return errors;
}

function internalCheck(id, args, plan, inventory) {
  if (id === 'inventory-contract') {
    const errors = [
      ...validateInventory(inventory),
      ...validateCommandReferences(inventory),
      ...validatePrerequisiteDeclarations(inventory),
    ];
    if (plan.unmatched.length) errors.push(`unmapped changed files: ${plan.unmatched.map(item => `${item.repo}:${item.file}`).join(', ')}`);
    if (plan.unmatchedOperations.length) errors.push(`unmapped release operations: ${plan.unmatchedOperations.join(', ')}`);
    if (errors.length) throw new Error(errors.join('; '));
    return { inventoryDomains: inventory.domains.length, inventoryChecks: Object.keys(inventory.checks).length };
  }
  if (id === 'test-deployment-provenance') {
    const manifest = loadJson(args.deploymentManifest);
    if (manifest.status !== 'successful') throw new Error(`TEST deployment manifest status is ${manifest.status || 'missing'}`);
    if (manifest.releaseId !== args.releaseId) throw new Error(`TEST deployment release ID is ${manifest.releaseId}, expected ${args.releaseId}`);
    const devEvidence = loadJson(args.devEvidence);
    if (manifest.qualification?.evidenceId !== devEvidence.evidenceId) {
      throw new Error('TEST deployment manifest was not admitted by the supplied DEV qualification evidence');
    }
    for (const repo of devEvidence.candidate?.components || []) {
      const deployed = manifest.repos?.[repo === 'admin' ? 'adminDashboard' : repo];
      const qualified = devEvidence.candidate.source?.[repo];
      if (!deployed || !qualified || deployed.gitHead !== qualified.gitHead || deployed.treeFingerprint !== qualified.treeFingerprint) {
        throw new Error(`TEST deployment provenance does not match DEV evidence for ${repo}`);
      }
    }
    return { deploymentManifest: args.deploymentManifest, deploymentStatus: manifest.status };
  }
  if (id === 'test-rollback-readiness') {
    const manifest = loadJson(args.deploymentManifest);
    const deployed = [];
    if (manifest.app?.deployAdmin) deployed.push('admin');
    if (manifest.app?.deployPortal) deployed.push('portal');
    for (const component of deployed) {
      const artifact = manifest.appApply?.artifacts?.[component];
      if (!artifact?.artifact) throw new Error(`TEST manifest has no candidate ${component} artifact`);
      if (!artifact?.rollbackArtifact?.uri) throw new Error(`TEST manifest has no retained prior ${component} rollback artifact`);
      if (artifact.rollbackArtifact.uri === artifact.artifact) throw new Error(`TEST ${component} rollback artifact is not distinct from the candidate`);
    }
    return {
      components: deployed,
      rollbackArtifacts: Object.fromEntries(deployed.map(component => [
        component,
        manifest.appApply.artifacts[component].rollbackArtifact.uri,
      ])),
    };
  }
  if (id === 'candidate-source-stability') {
    const drift = [];
    for (const repo of plan.candidate.components || []) {
      const current = repoState(repo);
      const admitted = plan.candidate.source?.[repo];
      if (!admitted || admitted.gitHead !== current.gitHead || admitted.treeFingerprint !== current.treeFingerprint) {
        drift.push(repo);
      }
    }
    if (drift.length) throw new Error(`candidate source changed during qualification: ${drift.join(', ')}`);
    return { stableComponents: plan.candidate.components };
  }
  throw new Error(`Unknown internal check: ${id}`);
}

function createCfaInvocation(check, logDir, dependencies = {}) {
  const randomUUID = dependencies.randomUUID || crypto.randomUUID;
  const now = dependencies.now || (() => new Date());
  const attemptId = `release-cfa-${randomUUID()}`;
  const attemptDir = path.join(logDir, CFA_CHECK_ID, attemptId);
  const evidenceOut = path.join(attemptDir, 'result.json');
  fs.mkdirSync(path.dirname(attemptDir), { recursive: true });
  if (fs.existsSync(attemptDir)) throw new Error(`CFA attempt evidence path already exists: ${attemptDir}`);
  fs.mkdirSync(attemptDir, { recursive: false });
  const sprintStartedAt = now().toISOString();
  const forbidden = new Set(['--attempt-id', '--evidence-out', '--sprint-started-at']);
  if (check.command.some(value => forbidden.has(value))) {
    throw new Error('CFA inventory command must not contain qualifier-owned attempt arguments');
  }
  return {
    attemptId,
    evidenceOut,
    sprintStartedAt,
    command: [
      ...check.command,
      '--attempt-id', attemptId,
      '--evidence-out', evidenceOut,
      '--sprint-started-at', sprintStartedAt,
    ],
  };
}

function validateCfaQualificationEvidence(evidence, expected, dependencies = {}) {
  const nativeValidators = dependencies.nativeValidators || require('./cfa-signing-test-smoke');
  const lifecycle = evidence?.test?.lifecycle;
  const validateTerminal = (terminal, phase) => {
    if (terminal?.terminal !== true || terminal?.status !== 'Success' || terminal?.responseCode !== 0) {
      throw new Error(`CFA ${phase} terminal process evidence is incomplete`);
    }
  };
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new Error('CFA evidence must be one JSON object');
  }
  nativeValidators.validateStatefulResult(evidence, {
    phase: 'execution',
    attemptId: expected.attemptId,
    interrupted: false,
  });
  validateTerminal(lifecycle?.execution?.terminal, 'execution');
  nativeValidators.validateStatefulResult(lifecycle?.execution?.transport?.result, {
    phase: 'execution',
    attemptId: expected.attemptId,
    interrupted: false,
  });
  if (lifecycle?.interruption !== false || lifecycle?.recovery !== null) {
    throw new Error('CFA qualification lifecycle conflicts with a clean execution');
  }
  if (lifecycle?.cognito?.absent !== true) throw new Error('CFA Cognito cleanup absence is unproved');
  validateTerminal(lifecycle?.verification?.terminal, 'verification');
  nativeValidators.validateStatefulResult(lifecycle?.verification?.transport?.result, {
    phase: 'verification',
    attemptId: expected.attemptId,
    interrupted: false,
  });
  if (lifecycle?.bundle?.absent !== true) throw new Error('CFA remote bundle absence is unproved');
  const startedAt = Date.parse(evidence.startedAt);
  const finishedAt = Date.parse(evidence.finishedAt);
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt < startedAt) {
    throw new Error('CFA result timestamps are missing or invalid');
  }
  return {
    attemptId: expected.attemptId,
    releaseAuthority: 'none',
    status: evidence.status,
    processTerminal: true,
    cleanupComplete: true,
    residueVerified: true,
  };
}

function validateCfaQualificationEvidenceFile(filename, expected, dependencies = {}) {
  if (!fs.existsSync(filename)) throw new Error('CFA result evidence file is missing');
  let evidence;
  try {
    evidence = JSON.parse(fs.readFileSync(filename, 'utf8'));
  } catch (error) {
    throw new Error(`CFA result evidence is malformed: ${error.message || error}`);
  }
  return validateCfaQualificationEvidence(evidence, expected, dependencies);
}

function runCommandCheck(id, check, logDir, context = {}, dependencies = {}) {
  const missingEnv = (check.requiredEnv || []).filter(key => !process.env[key]);
  if (missingEnv.length) return { id, status: 'unavailable', reason: `missing environment: ${missingEnv.join(', ')}` };
  const now = dependencies.now || (() => new Date());
  const spawn = dependencies.spawnSync || spawnSync;
  let cfaInvocation = null;
  try {
    cfaInvocation = id === CFA_CHECK_ID ? createCfaInvocation(check, logDir, dependencies) : null;
  } catch (error) {
    return { id, status: 'failed', error: error.message || String(error) };
  }
  const admittedCommand = cfaInvocation?.command || check.command;
  const startedAt = now().toISOString();
  const [command, ...commandArgs] = admittedCommand;
  const cwd = REPOSITORIES[check.cwd || 'admin'];
  const result = spawn(command, commandArgs, {
    cwd,
    env: {
      ...process.env,
      PATH_RELEASE_QUALIFICATION_RELEASE_ID: context.plan?.releaseId || '',
      PATH_RELEASE_QUALIFICATION_ADMIN_FINGERPRINT: context.plan?.candidate?.source?.admin?.treeFingerprint || '',
      PATH_RELEASE_QUALIFICATION_PORTAL_FINGERPRINT: context.plan?.candidate?.source?.portal?.treeFingerprint || '',
      PATH_RELEASE_QUALIFICATION_SHARED_FINGERPRINT: context.plan?.candidate?.source?.shared?.treeFingerprint || '',
      PATH_RELEASE_QUALIFICATION_DEPLOYED_COMPONENTS: (context.deployedComponents || []).join(','),
    },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...(id === CFA_CHECK_ID ? { timeout: CFA_QUALIFICATION_TIMEOUT_MS, killSignal: 'SIGTERM' } : {}),
  });
  const finishedAt = now().toISOString();
  const log = [result.stdout || '', result.stderr || ''].filter(Boolean).join('\n');
  const logPath = path.join(logDir, `${id}.log`);
  fs.writeFileSync(logPath, log, 'utf8');
  const record = {
    id,
    status: result.status === 0 ? 'passed' : 'failed',
    startedAt,
    finishedAt,
    durationMs: Date.parse(finishedAt) - Date.parse(startedAt),
    command: admittedCommand,
    logPath,
    logSha256: crypto.createHash('sha256').update(log).digest('hex'),
  };
  if (result.error) {
    record.status = 'failed';
    record.error = result.error.message;
  }
  if (result.status !== 0) record.exitCode = result.status;
  if (result.signal) record.signal = result.signal;
  if (id === CFA_CHECK_ID && record.status === 'passed') {
    try {
      const details = (dependencies.validateCfaEvidenceFile || validateCfaQualificationEvidenceFile)(
        cfaInvocation.evidenceOut,
        { attemptId: cfaInvocation.attemptId, sprintStartedAt: cfaInvocation.sprintStartedAt },
        dependencies
      );
      const evidenceBytes = fs.readFileSync(cfaInvocation.evidenceOut);
      record.details = {
        ...details,
        evidencePath: cfaInvocation.evidenceOut,
        evidenceSha256: crypto.createHash('sha256').update(evidenceBytes).digest('hex'),
      };
    } catch (error) {
      record.status = 'failed';
      record.error = error.message || String(error);
    }
  }
  return record;
}

function prerequisiteBlockers(check, completedChecks) {
  const byId = new Map(completedChecks.map(result => [result.id, result]));
  return (check.prerequisites || []).map(id => {
    const result = byId.get(id);
    return { id, status: result?.status || 'missing' };
  }).filter(result => result.status !== 'passed');
}

function executeQualificationChecks(args, inventory, plan, logDir, dependencies = {}) {
  const checks = [];
  let deployedComponents = [];
  if (args.stage === 'test' && args.deploymentManifest) {
    const deployment = (dependencies.loadJson || loadJson)(args.deploymentManifest);
    if (deployment.app?.deployAdmin) deployedComponents.push('admin');
    if (deployment.app?.deployPortal) deployedComponents.push('portal');
    if (deployment.app?.deployShared) deployedComponents.push('shared');
  }
  for (const id of plan.requiredChecks) {
    const check = inventory.checks[id];
    (dependencies.writeProgress || (value => process.stderr.write(value)))(`[release-qualification] ${id}\n`);
    const blockers = prerequisiteBlockers(check, checks);
    if (blockers.length) {
      checks.push({
        id,
        status: 'blocked',
        reason: `prerequisite not passed: ${blockers.map(item => `${item.id}=${item.status}`).join(', ')}`,
        prerequisites: blockers,
      });
      continue;
    }
    if (check.type) {
      const now = dependencies.now || (() => new Date());
      const startedAt = now().toISOString();
      try {
        const details = (dependencies.internalCheck || internalCheck)(id, args, plan, inventory);
        const finishedAt = now().toISOString();
        checks.push({ id, status: 'passed', startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), details });
      } catch (error) {
        const finishedAt = now().toISOString();
        checks.push({ id, status: 'failed', startedAt, finishedAt, durationMs: Date.parse(finishedAt) - Date.parse(startedAt), error: error.message || String(error) });
      }
    } else {
      checks.push((dependencies.runCommandCheck || runCommandCheck)(
        id,
        check,
        logDir,
        { plan, deployedComponents },
        dependencies
      ));
    }
  }
  return checks;
}

function evidencePath(args) {
  if (args.evidenceOut) return args.evidenceOut;
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  return path.join(REPO_ROOT, 'tmp', 'release-qualification', args.stage, `${args.releaseId}--${stamp}.json`);
}

function runQualification(args, inventory, plan) {
  const outputPath = evidencePath(args);
  const logDir = `${outputPath}.logs`;
  fs.mkdirSync(logDir, { recursive: true });
  const checks = executeQualificationChecks(args, inventory, plan, logDir);

  const blocking = checks.filter(check => check.status !== 'passed');
  const generatedAt = new Date();
  const evidence = {
    schemaVersion: 1,
    generatedAt: generatedAt.toISOString(),
    expiresAt: new Date(generatedAt.getTime() + (args.stage === 'dev' ? 72 : 24) * 60 * 60 * 1000).toISOString(),
    stage: args.stage,
    releaseId: args.releaseId,
    decision: blocking.length ? 'NO-GO' : 'GO',
    inventoryPath: INVENTORY_PATH,
    inventorySha256: sha256Json(inventory),
    domains: plan.domains,
    changedFiles: plan.changedFiles,
    operations: plan.operations,
    candidate: plan.candidate,
    requiredChecks: plan.requiredChecks,
    checks,
    blockers: blocking.map(check => ({ id: check.id, status: check.status, reason: check.reason || check.error || `exit ${check.exitCode}` })),
  };
  evidence.evidenceId = createEvidenceId(evidence);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return { evidence, outputPath };
}

function handleValidate(args, inventory) {
  if (!args.evidence) throw new Error('--evidence is required for validate');
  const evidence = loadJson(args.evidence);
  const components = evidence.candidate?.components || [];
  const currentSource = Object.fromEntries(components.map(repo => [repo, repoState(repo)]));
  const errors = validateQualificationEvidence({
    evidence,
    expectedStage: args.stage,
    currentSource,
    inventorySha256: sha256Json(inventory),
    schemaSha256: schemaFingerprint(),
    requiredComponents: components,
  });
  return { valid: errors.length === 0, errors, evidenceId: evidence.evidenceId };
}

function printPlan(plan, inventory) {
  console.log(`Stage: ${plan.stage}`);
  console.log(`Release: ${plan.releaseId || '<not set>'}`);
  console.log(`Components: ${plan.candidate.components.join(', ') || 'none'}`);
  console.log(`Domains: ${plan.domains.join(', ') || 'none'}`);
  console.log(`Checks (${plan.requiredChecks.length}):`);
  plan.requiredChecks.forEach(id => console.log(`- ${id}: ${inventory.checks[id].description}`));
  if (plan.unmatched.length) console.log(`Unmapped changes: ${plan.unmatched.map(item => `${item.repo}:${item.file}`).join(', ')}`);
  if (plan.unmatchedOperations.length) console.log(`Unmapped operations: ${plan.unmatchedOperations.join(', ')}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === 'help') return usage();
  const inventory = loadInventory();
  const inventoryErrors = [...validateInventory(inventory), ...validatePrerequisiteDeclarations(inventory)];
  if (inventoryErrors.length) throw new Error(`Invalid coverage inventory: ${inventoryErrors.join('; ')}`);

  if (args.command === 'validate') {
    const result = handleValidate(args, inventory);
    if (args.json) console.log(JSON.stringify(result, null, 2));
    else console.log(result.valid ? 'Qualification evidence: VALID' : `Qualification evidence: INVALID\n${result.errors.join('\n')}`);
    if (!result.valid) process.exitCode = 1;
    return;
  }

  const plan = buildPlan(args, inventory);
  if (args.command === 'plan') {
    if (args.json) console.log(JSON.stringify(plan, null, 2));
    else printPlan(plan, inventory);
    if (plan.unmatched.length || plan.unmatchedOperations.length) process.exitCode = 1;
    return;
  }

  const result = runQualification(args, inventory, plan);
  if (args.json) console.log(JSON.stringify({ ...result.evidence, evidencePath: result.outputPath }, null, 2));
  else {
    console.log(`Release qualification: ${result.evidence.decision}`);
    console.log(`Evidence: ${result.outputPath}`);
    result.evidence.blockers.forEach(blocker => console.log(`- ${blocker.id}: ${blocker.status} (${blocker.reason})`));
  }
  if (result.evidence.decision !== 'GO') process.exitCode = 1;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Release qualification failed: ${error.message || error}`);
    process.exitCode = 1;
  }
}

module.exports = {
  CFA_QUALIFICATION_TIMEOUT_MS,
  createCfaInvocation,
  executeQualificationChecks,
  prerequisiteBlockers,
  runCommandCheck,
  validateCfaQualificationEvidence,
  validateCfaQualificationEvidenceFile,
  validateCommandReferences,
  validatePrerequisiteDeclarations,
};
