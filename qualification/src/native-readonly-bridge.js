'use strict';

const { spawn } = require('node:child_process');
const {
  copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync,
  symlinkSync,
} = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, isAbsolute, join, relative, resolve } = require('node:path');

const { canonicalize, digestBytes, digestCanonical, parseStrictJson } = require('./canonical-json');
const { validateAttemptId } = require('./identities');
const { commandDigest, createProcessController } = require('./process-control');
const {
  ADMIN_AGGREGATE_EXTERNAL_SCOPE,
  ADMIN_AGGREGATE_PRODUCT_SCOPE,
  NATIVE_READONLY_ADAPTER_VERSION,
  collectAdminAggregateExternalScope,
  collectAdminAggregateProductScope,
} = require('./pack-validator');

const BRIDGE_VERSION = NATIVE_READONLY_ADAPTER_VERSION;
const OPERATION_CONTRACT_VERSION = '1.0.0';
const PACK_PROFILES = Object.freeze({
  'ai-guidance-contract': Object.freeze(['known-good', 'invalid-fixture', 'forced-interruption']),
  'privacy-route-static': Object.freeze(['known-good', 'mutation-proof', 'forced-interruption']),
  'admin-lint': Object.freeze(['known-good', 'deliberate-lint-error', 'forced-interruption']),
  'portal-lint': Object.freeze(['known-good', 'deliberate-lint-error', 'forced-interruption']),
  'admin-aggregate': Object.freeze([
    'known-good', 'frontend-failure', 'backend-failure', 'forced-interruption',
  ]),
});
const PROFILES = Object.freeze([...new Set(Object.values(PACK_PROFILES).flat())]);
const READ_ONLY_OPERATION = defineOperationSpec({
  capabilities: ['process.readonly.local'],
  effectClass: 'read-only',
  writePaths: [],
  cleanupOwner: 'none',
  residueScope: [],
  proofKind: 'not-applicable',
});
const ADMIN_TEMP_OPERATION = defineOperationSpec({
  capabilities: [
    'process.readonly.local', 'filesystem.temporary.local-write', 'network.loopback.local',
  ],
  effectClass: 'local-write',
  writePaths: ['native-test-owned-temporary-roots'],
  cleanupOwner: 'native-test-with-bridge-verification',
  residueScope: ['native-test-owned-temporary-roots'],
  proofKind: 'native-temp-delta-absence',
});
const ADMIN_MIRROR_TEMP_OPERATION = defineOperationSpec({
  capabilities: [
    'process.readonly.local', 'filesystem.temporary.local-write', 'network.loopback.local',
  ],
  effectClass: 'local-write',
  writePaths: ['qualification-owned-attempt-mirror', 'native-test-owned-temporary-roots'],
  cleanupOwner: 'native-readonly-bridge-and-native-test',
  residueScope: ['qualification-owned-attempt-mirror', 'native-test-owned-temporary-roots'],
  proofKind: 'attempt-mirror-and-native-temp-delta-absence',
});
const OPERATION_SPECS = Object.freeze({
  'ai-guidance-contract': Object.freeze({
    'known-good': READ_ONLY_OPERATION,
    'invalid-fixture': READ_ONLY_OPERATION,
    'forced-interruption': READ_ONLY_OPERATION,
  }),
  'privacy-route-static': Object.freeze({
    'known-good': READ_ONLY_OPERATION,
    'mutation-proof': READ_ONLY_OPERATION,
    'forced-interruption': READ_ONLY_OPERATION,
  }),
  'admin-lint': Object.freeze({
    'known-good': READ_ONLY_OPERATION,
    'deliberate-lint-error': READ_ONLY_OPERATION,
    'forced-interruption': READ_ONLY_OPERATION,
  }),
  'portal-lint': Object.freeze({
    'known-good': READ_ONLY_OPERATION,
    'deliberate-lint-error': READ_ONLY_OPERATION,
    'forced-interruption': READ_ONLY_OPERATION,
  }),
  'admin-aggregate': Object.freeze({
    'known-good': ADMIN_TEMP_OPERATION,
    'frontend-failure': ADMIN_MIRROR_TEMP_OPERATION,
    'backend-failure': ADMIN_MIRROR_TEMP_OPERATION,
    'forced-interruption': READ_ONLY_OPERATION,
  }),
});
const DEFAULT_OUTPUT_LIMIT = 65536;
const ADMIN_AGGREGATE_OUTPUT_LIMIT = 2 * 1024 * 1024;
const ADMIN_AGGREGATE_RESIDUE_PREFIXES = Object.freeze([
  'path-admin-environment-server-',
  'path-admin-test-environment-',
  'path-archive-preflight-',
  'path-artifact-',
  'path-local-launcher-contract-',
  'path-migration-failure-',
  'path-migration-replay-',
  'path-release-admission-',
  'path-schema-plan-safety-',
  'path-unowned-environment-',
]);

class NativeReadOnlyBridgeError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'NativeReadOnlyBridgeError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new NativeReadOnlyBridgeError(code, message, details);
}

function defineOperationSpec({
  capabilities, effectClass, writePaths, cleanupOwner, residueScope, proofKind,
}) {
  return Object.freeze({
    capabilities: Object.freeze([...capabilities]),
    effects: Object.freeze({
      effectClass,
      writePaths: Object.freeze([...writePaths]),
      externalEffects: Object.freeze([]),
    }),
    cleanup: Object.freeze({
      required: writePaths.length > 0,
      cleanupOwner,
      residueScope: Object.freeze([...residueScope]),
      proofKind,
    }),
  });
}

function getOperationContract(packId, profile) {
  const spec = OPERATION_SPECS[packId]?.[profile];
  if (!spec) fail('UNSUPPORTED_PROFILE', `Unsupported ${String(packId)} profile ${String(profile)}`);
  return {
    contractVersion: OPERATION_CONTRACT_VERSION,
    adapterId: 'native-readonly-bridge',
    adapterVersion: BRIDGE_VERSION,
    operationId: `${packId}:${profile}`,
    packId,
    profile,
    capabilities: [...spec.capabilities],
    effects: {
      effectClass: spec.effects.effectClass,
      writePaths: [...spec.effects.writePaths],
      externalEffects: [...spec.effects.externalEffects],
    },
    cleanup: {
      required: spec.cleanup.required,
      cleanupOwner: spec.cleanup.cleanupOwner,
      residueScope: [...spec.cleanup.residueScope],
      proofKind: spec.cleanup.proofKind,
    },
  };
}

function validateOperationContract(pack, profile, operation) {
  const expected = getOperationContract(pack.packId, profile);
  if (canonicalize(operation) !== canonicalize(expected)) {
    fail('OPERATION_CONTRACT_CONFLICT', 'Operation declaration differs from the immutable adapter contract');
  }
  if (
    pack.requiredAdapter.adapterId !== operation.adapterId
    || pack.requiredAdapter.adapterVersion !== operation.adapterVersion
  ) fail('ADAPTER_BINDING_CONFLICT', 'Operation does not match the pack adapter binding');
  if (operation.capabilities.some((capability) => !pack.requiredAdapter.capabilities.includes(capability))) {
    fail('CAPABILITY_BROADENED', 'Operation requests a capability outside the pack ceiling');
  }
  if (operation.effects.writePaths.some((path) => !pack.declaredEffects.writePaths.includes(path))) {
    fail('EFFECT_BROADENED', 'Operation requests a write outside the pack ceiling');
  }
  if (operation.effects.externalEffects.length || pack.declaredEffects.externalEffects.length) {
    fail('EFFECT_BROADENED', 'Native read-only operations cannot declare external effects');
  }
  const writes = operation.effects.writePaths.length > 0;
  if (
    operation.effects.effectClass !== (writes ? 'local-write' : 'read-only')
    || operation.cleanup.required !== writes
    || canonicalize(operation.cleanup.residueScope) !== canonicalize(operation.effects.writePaths)
  ) fail('CLEANUP_CONTRACT_CONFLICT', 'Operation effects and cleanup obligation disagree');
  if (writes && (!pack.cleanup.required || operation.cleanup.cleanupOwner === 'none')) {
    fail('CLEANUP_CONTRACT_CONFLICT', 'Stateful operation lacks an admitted cleanup owner');
  }
  if (!writes && (operation.cleanup.cleanupOwner !== 'none' || operation.cleanup.proofKind !== 'not-applicable')) {
    fail('CLEANUP_CONTRACT_CONFLICT', 'Read-only operation declares an unnecessary cleanup action');
  }
  return true;
}

function validateOperationResources(pack, operation, declaration) {
  validateOperationContract(pack, operation.profile, operation);
  const expectsMirror = operation.cleanup.residueScope.includes('qualification-owned-attempt-mirror');
  const expectsNativeResidue = operation.cleanup.residueScope.includes('native-test-owned-temporary-roots');
  if (Boolean(declaration.mirror) !== expectsMirror) {
    fail('CLEANUP_RESOURCE_CONFLICT', 'Attempt-mirror resource does not match the admitted cleanup contract');
  }
  if (expectsMirror && (
    typeof declaration.mirror.cleanup !== 'function'
    || typeof declaration.mirror.proveAbsent !== 'function'
  )) fail('CLEANUP_RESOURCE_CONFLICT', 'Attempt mirror lacks separate cleanup and residue-proof operations');
  if (
    Boolean(declaration.residueBaseline) !== expectsNativeResidue
    || Boolean(declaration.residueProbe) !== expectsNativeResidue
  ) fail('CLEANUP_RESOURCE_CONFLICT', 'Native temporary residue resources do not match the admitted contract');
  if (expectsNativeResidue && (
    !Array.isArray(declaration.residueBaseline) || typeof declaration.residueProbe !== 'function'
  )) fail('CLEANUP_RESOURCE_CONFLICT', 'Native temporary residue proof is incomplete');
  const admittedInputs = new Set(pack.inputs.map((input) => input.path));
  if (
    !Array.isArray(declaration.inputRefs)
    || declaration.inputRefs.some((input) => !admittedInputs.has(input.path))
  ) fail('INPUT_BINDING_CONFLICT', 'Operation reads an input outside the admitted pack');
  return true;
}

function exactInput(pack, role) {
  const matches = pack.inputs.filter((input) => input.role === role);
  if (matches.length !== 1) fail('INPUT_BINDING_CONFLICT', `Expected exactly one ${role} input`);
  return matches[0];
}

function inputByPath(pack, path) {
  const matches = pack.inputs.filter((input) => input.path === path);
  if (matches.length !== 1) fail('INPUT_BINDING_CONFLICT', `Expected exactly one input for ${path}`);
  return matches[0];
}

function snapshotAdminAggregateResidue() {
  return readdirSync(tmpdir()).filter((name) => (
    ADMIN_AGGREGATE_RESIDUE_PREFIXES.some((prefix) => name.startsWith(prefix))
  )).sort();
}

function copyFileInto(source, destination) {
  mkdirSync(dirname(destination), { recursive: true });
  copyFileSync(source, destination);
}

function copyAdminAggregateScope(repositoryRoot, mirrorAdminRoot, scope) {
  const containerRoot = dirname(mirrorAdminRoot);
  for (const file of scope.files) {
    let source;
    let destination;
    if (file.path.startsWith('../ISET-intake/')) {
      const path = file.path.slice('../ISET-intake/'.length);
      source = resolve(repositoryRoot, '../ISET-intake', path);
      destination = resolve(containerRoot, 'ISET-intake', path);
    } else if (file.path.startsWith('../shared/')) {
      const path = file.path.slice('../shared/'.length);
      source = resolve(repositoryRoot, '../shared', path);
      destination = resolve(containerRoot, 'shared', path);
    } else {
      source = resolve(repositoryRoot, file.path);
      destination = resolve(mirrorAdminRoot, file.path);
    }
    copyFileInto(source, destination);
  }
}

function createAdminAggregateNegativeMirror(bundle, attemptId, profile) {
  validateAttemptId(attemptId);
  if (bundle.pack.packId !== 'admin-aggregate' || !['frontend-failure', 'backend-failure'].includes(profile)) {
    fail('PACK_NOT_SUPPORTED', 'Admin aggregate mirror requires an admitted failure profile');
  }
  const containerRoot = mkdtempSync(join(tmpdir(), `rq-admin-aggregate-${attemptId.slice(-12)}-`));
  const mirrorAdminRoot = join(containerRoot, 'admin-dashboard');
  try {
    mkdirSync(mirrorAdminRoot, { recursive: true });
    const productScope = collectAdminAggregateProductScope(bundle.repositoryRoot);
    const externalScope = collectAdminAggregateExternalScope(bundle.repositoryRoot);
    if (inputByPath(bundle.pack, ADMIN_AGGREGATE_PRODUCT_SCOPE).contentDigest.value !== productScope.contentDigest) {
      fail('INPUT_FINGERPRINT_DRIFT', 'Admin aggregate product scope changed before mirror creation');
    }
    if (inputByPath(bundle.pack, ADMIN_AGGREGATE_EXTERNAL_SCOPE).contentDigest.value !== externalScope.contentDigest) {
      fail('INPUT_FINGERPRINT_DRIFT', 'Admin aggregate external scope changed before mirror creation');
    }
    copyAdminAggregateScope(bundle.repositoryRoot, mirrorAdminRoot, productScope);
    copyAdminAggregateScope(bundle.repositoryRoot, mirrorAdminRoot, externalScope);
    for (const path of ['package.json', 'package-lock.json']) {
      copyFileInto(resolve(bundle.repositoryRoot, path), resolve(mirrorAdminRoot, path));
    }
    symlinkSync(resolve(bundle.repositoryRoot, 'node_modules'), resolve(mirrorAdminRoot, 'node_modules'), 'dir');
    symlinkSync(resolve(bundle.repositoryRoot, 'node_modules'), resolve(containerRoot, 'node_modules'), 'dir');
    symlinkSync(
      resolve(bundle.repositoryRoot, '../ISET-intake/node_modules'),
      resolve(containerRoot, 'ISET-intake/node_modules'),
      'dir',
    );
    const sentinelPath = profile === 'frontend-failure'
      ? 'qualification/test/fixtures/packs/admin-aggregate-negative/frontend-failure.test.js'
      : 'qualification/test/fixtures/packs/admin-aggregate-negative/backend-failure.test.js';
    const sentinel = inputByPath(bundle.pack, sentinelPath);
    const destination = profile === 'frontend-failure'
      ? resolve(mirrorAdminRoot, 'src/__tests__/qualification-frontend-failure.test.js')
      : resolve(mirrorAdminRoot, 'tests/qualification-backend-failure.test.js');
    copyFileInto(resolve(bundle.repositoryRoot, sentinel.path), destination);
    let cleaned = false;
    const proveAbsent = () => !existsSync(containerRoot);
    return {
      root: mirrorAdminRoot,
      containerRoot,
      scriptPath: resolve(mirrorAdminRoot, 'scripts/run-test-all.js'),
      inputRefs: bundle.pack.inputs.filter((input) => (
        input.role !== 'certification-fixture' || input.path === sentinel.path
      )),
      cleanup() {
        if (!cleaned) {
          rmSync(containerRoot, { recursive: true, force: true });
          cleaned = true;
        }
        return proveAbsent();
      },
      proveAbsent,
    };
  } catch (error) {
    rmSync(containerRoot, { recursive: true, force: true });
    throw error;
  }
}

function deriveAdminAggregatePhaseEvidence(stdoutBytes, stderrBytes, profile, exitCode, signal) {
  const lines = `${stdoutBytes.toString('utf8')}\n${stderrBytes.toString('utf8')}`
    .split(/\r?\n/u)
    .map((line) => line.trim());
  const markerIndexes = {
    frontend: lines.indexOf('[test:all] frontend suites'),
    backend: lines.indexOf('[test:all] backend, authorization, validation, and tooling suites'),
    passed: lines.indexOf('[test:all] all admin suites passed'),
    frontendFailed: lines.indexOf('[test:all] frontend suites failed with exit code 1'),
    backendFailed: lines.indexOf('[test:all] backend, authorization, validation, and tooling suites failed with exit code 1'),
  };
  const exactCounts = Object.fromEntries(Object.entries(markerIndexes).map(([name, index]) => [
    name,
    index < 0 ? 0 : lines.filter((line) => line === lines[index]).length,
  ]));
  const expected = profile === 'known-good'
    ? markerIndexes.frontend >= 0 && markerIndexes.backend > markerIndexes.frontend
      && markerIndexes.passed > markerIndexes.backend && exitCode === 0 && signal === null
    : profile === 'frontend-failure'
      ? markerIndexes.frontend >= 0 && markerIndexes.frontendFailed > markerIndexes.frontend
        && markerIndexes.backend < 0 && exitCode === 1 && signal === null
      : markerIndexes.frontend >= 0 && markerIndexes.backend > markerIndexes.frontend
        && markerIndexes.backendFailed > markerIndexes.backend && markerIndexes.passed < 0
        && exitCode === 1 && signal === null;
  const countsValid = Object.values(exactCounts).every((count) => count <= 1);
  const phases = [
    {
      phaseId: 'frontend',
      order: 1,
      started: markerIndexes.frontend >= 0,
      status: markerIndexes.frontendFailed >= 0
        ? 'failed'
        : markerIndexes.backend >= 0 || markerIndexes.passed >= 0 ? 'passed' : 'incomplete',
    },
    {
      phaseId: 'backend',
      order: 2,
      started: markerIndexes.backend >= 0,
      status: markerIndexes.backendFailed >= 0
        ? 'failed'
        : markerIndexes.passed >= 0 ? 'passed' : markerIndexes.backend >= 0 ? 'incomplete' : 'not-started',
    },
  ];
  return Object.freeze({
    evidenceKind: 'content-bound-native-phase-markers',
    parserAuthority: 'aggregate-lifecycle-only-not-product-semantics',
    profile,
    valid: expected && countsValid,
    exactCounts,
    phases,
  });
}

function packProfiles(packId) {
  const profiles = PACK_PROFILES[packId];
  if (!profiles) fail('PACK_NOT_SUPPORTED', `Unsupported native pack ${String(packId)}`);
  return profiles;
}

function buildNativeDeclaration(bundle, profile, attemptId) {
  if (!packProfiles(bundle.pack.packId).includes(profile)) {
    fail('UNSUPPORTED_PROFILE', `Unsupported ${bundle.pack.packId} profile ${String(profile)}`);
  }
  const { pack } = bundle;
  const certificationFixtures = pack.inputs.filter((input) => input.role === 'certification-fixture');
  const interruptionFixture = certificationFixtures.find((input) => input.path.endsWith('/hang.js'));
  if (!interruptionFixture) fail('INPUT_BINDING_CONFLICT', 'Forced-interruption fixture is missing');

  if (profile === 'forced-interruption') {
    validateAttemptId(attemptId);
    return {
      executablePath: realpathSync(process.execPath),
      scriptPath: realpathSync(join(bundle.repositoryRoot, interruptionFixture.path)),
      arguments: ['idle', attemptId],
      workingDirectory: bundle.repositoryRoot,
      inputRefs: [interruptionFixture],
      authorityKind: 'synthetic-interruption-fixture',
    };
  }
  if (pack.packId === 'privacy-route-static') {
    const script = inputByPath(pack, pack.nativeAuthority.scriptPath);
    const mutationTest = inputByPath(pack, pack.nativeAuthority.knownBadFixturePath);
    const jestEntry = inputByPath(pack, 'node_modules/jest/bin/jest.js');
    const inputRefs = pack.inputs.filter((input) => input.role !== 'certification-fixture');
    if (profile === 'mutation-proof') {
      return {
        executablePath: realpathSync(process.execPath),
        scriptPath: realpathSync(join(bundle.repositoryRoot, jestEntry.path)),
        arguments: [
          '--config', 'tests/jest.config.js', '--runInBand', '--runTestsByPath',
          mutationTest.path, '--no-cache',
        ],
        workingDirectory: bundle.repositoryRoot,
        inputRefs,
        authorityKind: 'native-product-mutation-assertion',
      };
    }
    return {
      executablePath: realpathSync(process.execPath),
      scriptPath: realpathSync(join(bundle.repositoryRoot, script.path)),
      arguments: ['--json'],
      workingDirectory: bundle.repositoryRoot,
      inputRefs,
      authorityKind: 'native-product-assertion',
    };
  }
  if (pack.packId === 'admin-lint' || pack.packId === 'portal-lint') {
    const eslintEntry = inputByPath(pack, pack.nativeAuthority.scriptPath);
    const invalidFixture = inputByPath(pack, pack.nativeAuthority.knownBadFixturePath);
    const inputRefs = pack.inputs.filter((input) => input.role !== 'certification-fixture');
    const portalLint = pack.packId === 'portal-lint';
    return {
      executablePath: realpathSync(process.execPath),
      scriptPath: realpathSync(join(bundle.repositoryRoot, eslintEntry.path)),
      arguments: profile === 'deliberate-lint-error'
        ? portalLint
          ? [
            '--no-eslintrc', '--config', 'package.json', '--ext', '.js,.jsx', '--quiet', '--no-cache',
            '--no-ignore', '../admin-dashboard/qualification/test/fixtures/packs/portal-lint.invalid.js',
          ]
          : [
            '--config', '.eslintrc.cjs', '--ext', '.js,.jsx', '--quiet', '--no-cache', '--no-ignore',
            invalidFixture.path,
          ]
        : ['--ext', '.js,.jsx', 'src', '--quiet', '--no-cache'],
      workingDirectory: realpathSync(resolve(bundle.repositoryRoot, pack.nativeAuthority.workingDirectory)),
      inputRefs: profile === 'deliberate-lint-error' ? [...inputRefs, invalidFixture] : inputRefs,
      authorityKind: 'native-product-assertion',
    };
  }
  if (pack.packId === 'admin-aggregate') {
    const script = inputByPath(pack, pack.nativeAuthority.scriptPath);
    const residueBaseline = snapshotAdminAggregateResidue();
    if (profile === 'frontend-failure' || profile === 'backend-failure') {
      const mirror = createAdminAggregateNegativeMirror(bundle, attemptId, profile);
      return {
        executablePath: realpathSync(process.execPath),
        scriptPath: mirror.scriptPath,
        arguments: [],
        workingDirectory: mirror.root,
        inputRefs: mirror.inputRefs,
        authorityKind: 'native-product-aggregate-deliberate-phase-failure',
        authorityScriptPath: script.path,
        authorityWorkingDirectory: '{attemptMirror}',
        mirror,
        residueBaseline,
        residueProbe: snapshotAdminAggregateResidue,
      };
    }
    return {
      executablePath: realpathSync(process.execPath),
      scriptPath: realpathSync(join(bundle.repositoryRoot, script.path)),
      arguments: [],
      workingDirectory: bundle.repositoryRoot,
      inputRefs: pack.inputs.filter((input) => input.role !== 'certification-fixture'),
      authorityKind: 'native-product-aggregate-assertion',
      residueBaseline,
      residueProbe: snapshotAdminAggregateResidue,
    };
  }
  const script = exactInput(pack, 'native-runner');
  const defaultFixture = exactInput(pack, 'native-default-fixture');
  const invalidFixture = certificationFixtures.find((input) => input.path === pack.nativeAuthority.knownBadFixturePath);
  if (!invalidFixture) fail('INPUT_BINDING_CONFLICT', 'Deliberate-invalid fixture is missing');
  return {
    executablePath: realpathSync(process.execPath),
    scriptPath: realpathSync(join(bundle.repositoryRoot, script.path)),
    arguments: profile === 'invalid-fixture' ? [invalidFixture.path] : [],
    workingDirectory: bundle.repositoryRoot,
    inputRefs: profile === 'invalid-fixture' ? [script, invalidFixture] : [script, defaultFixture],
    authorityKind: 'native-product-assertion',
  };
}

function nativeDeclaration(bundle, profile, attemptId) {
  let declaration;
  try {
    declaration = buildNativeDeclaration(bundle, profile, attemptId);
    const operation = getOperationContract(bundle.pack.packId, profile);
    validateOperationResources(bundle.pack, operation, declaration);
    return { ...declaration, operation };
  } catch (error) {
    if (declaration?.mirror) declaration.mirror.cleanup();
    throw error;
  }
}

function createCapture(limit, onOverflow) {
  const chunks = [];
  let observedBytes = 0;
  let capturedBytes = 0;
  let truncated = false;
  return {
    receive(chunk) {
      observedBytes += chunk.length;
      if (capturedBytes < limit) {
        const retained = chunk.subarray(0, limit - capturedBytes);
        chunks.push(retained);
        capturedBytes += retained.length;
      }
      if (observedBytes > limit && !truncated) {
        truncated = true;
        onOverflow();
      }
    },
    evidence() {
      const bytes = Buffer.concat(chunks);
      return {
        observedBytes,
        capturedBytes,
        truncated,
        capturedBase64: bytes.toString('base64'),
        digestAlgorithm: 'sha256',
        capturedDigest: digestBytes(bytes),
      };
    },
  };
}

function collectCleanupEvidence(operation, resources, attemptId) {
  const cleanup = operation.cleanup;
  if (!cleanup.required) {
    return {
      required: false,
      status: 'unnecessary',
      cleanupOwner: 'none',
      residueScope: [],
      independentProof: { kind: 'not-applicable', completed: true, passed: true },
      residueDecision: 'no-declared-write-effect',
      mirrorRootDigest: null,
      residueObserved: false,
      residuePaths: [],
      errors: [],
    };
  }

  const errors = [];
  const residuePaths = [];
  const usesMirror = cleanup.residueScope.includes('qualification-owned-attempt-mirror');
  const usesNativeResidue = cleanup.residueScope.includes('native-test-owned-temporary-roots');
  const mirrorRootDigest = usesMirror
    ? digestCanonical({ attemptId, scope: 'qualification-owned-attempt-mirror' })
    : null;

  if (usesMirror) {
    try {
      resources.mirror.cleanup();
    } catch (error) {
      errors.push({ stage: 'cleanup', resource: 'qualification-owned-attempt-mirror', message: error.message });
    }
    try {
      if (!resources.mirror.proveAbsent()) residuePaths.push('qualification-owned-attempt-mirror');
    } catch (error) {
      errors.push({ stage: 'residue-proof', resource: 'qualification-owned-attempt-mirror', message: error.message });
    }
  }

  if (usesNativeResidue) {
    try {
      const after = resources.residueProbe();
      const baseline = new Set(resources.residueBaseline);
      residuePaths.push(...after.filter((path) => !baseline.has(path)));
    } catch (error) {
      errors.push({ stage: 'residue-proof', resource: 'native-test-owned-temporary-roots', message: error.message });
    }
  }

  const residueObserved = residuePaths.length > 0;
  const proofCompleted = errors.length === 0;
  const residueAbsent = proofCompleted && !residueObserved;
  return {
    required: true,
    status: residueAbsent ? 'completed' : 'failed',
    cleanupOwner: cleanup.cleanupOwner,
    residueScope: [...cleanup.residueScope],
    independentProof: {
      kind: cleanup.proofKind,
      completed: proofCompleted,
      passed: residueAbsent,
    },
    residueDecision: !proofCompleted
      ? 'residue-proof-failed'
      : residueAbsent ? 'zero-residue-proved' : 'residue-present',
    mirrorRootDigest,
    residueObserved,
    residuePaths,
    errors,
  };
}

function declaredOperationEffects(declaration) {
  return {
    effectClass: declaration.operation.effects.effectClass,
    readPaths: declaration.inputRefs.map((input) => input.path),
    writePaths: [...declaration.operation.effects.writePaths],
    externalEffects: [...declaration.operation.effects.externalEffects],
  };
}

function executeNativeReadOnly(bundle, profile, { outputLimitBytes, attemptId } = {}) {
  const effectiveOutputLimit = outputLimitBytes || (
    bundle.pack.packId === 'admin-aggregate' ? ADMIN_AGGREGATE_OUTPUT_LIMIT : DEFAULT_OUTPUT_LIMIT
  );
  if (!Number.isSafeInteger(effectiveOutputLimit) || effectiveOutputLimit < 1) {
    return Promise.reject(new NativeReadOnlyBridgeError('INVALID_OUTPUT_LIMIT', 'outputLimitBytes must be positive'));
  }
  const declaration = nativeDeclaration(bundle, profile, attemptId);
  return new Promise((resolve, reject) => {
    let child;
    let finished = false;
    let overflowed = false;
    const stopForOverflow = () => {
      overflowed = true;
      if (child && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    };
    const stdout = createCapture(effectiveOutputLimit, stopForOverflow);
    const stderr = createCapture(effectiveOutputLimit, stopForOverflow);
    try {
      child = spawn(declaration.executablePath, [declaration.scriptPath, ...declaration.arguments], {
        cwd: declaration.workingDirectory,
        env: Object.create(null),
        shell: false,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      const cleanup = collectCleanupEvidence(declaration.operation, declaration, attemptId);
      reject(new NativeReadOnlyBridgeError('NATIVE_DISPATCH_FAILED', 'Native command could not be dispatched', {
        cause: error.message,
        cleanup,
      }));
      return;
    }
    child.stdout.on('data', (chunk) => stdout.receive(chunk));
    child.stderr.on('data', (chunk) => stderr.receive(chunk));
    child.once('error', (error) => {
      if (finished) return;
      finished = true;
      const cleanup = collectCleanupEvidence(declaration.operation, declaration, attemptId);
      reject(new NativeReadOnlyBridgeError('NATIVE_PROCESS_ERROR', 'Native command emitted a process error', {
        cause: error.message,
        cleanup,
      }));
    });
    child.once('close', (code, signal) => {
      if (finished) return;
      finished = true;
      const nativeAuthorityBinding = {
        authorityKind: declaration.authorityKind,
        executablePath: declaration.executablePath,
        scriptPath: declaration.authorityScriptPath || declaration.scriptPath,
        scriptDigest: digestBytes(readFileSync(declaration.scriptPath)),
        arguments: declaration.arguments,
        workingDirectory: declaration.authorityWorkingDirectory || declaration.workingDirectory,
        inputRefs: declaration.inputRefs.map((input) => ({
          inputId: input.inputId,
          role: input.role,
          path: input.path,
          contentDigest: input.contentDigest,
        })),
      };
      const cleanup = collectCleanupEvidence(declaration.operation, declaration, attemptId);
      const residueAbsent = cleanup.status !== 'failed';
      const stdoutEvidence = stdout.evidence();
      const stderrEvidence = stderr.evidence();
      const phaseEvidence = bundle.pack.packId === 'admin-aggregate'
        ? deriveAdminAggregatePhaseEvidence(
          Buffer.from(stdoutEvidence.capturedBase64, 'base64'),
          Buffer.from(stderrEvidence.capturedBase64, 'base64'),
          profile,
          code,
          signal,
        )
        : null;
      const result = {
        resultKind: 'native-readonly-result',
        resultVersion: BRIDGE_VERSION,
        packId: bundle.pack.packId,
        packVersion: bundle.pack.packVersion,
        maturity: bundle.pack.maturity,
        profile,
        operationContract: structuredClone(declaration.operation),
        nativeAuthorityBinding,
        nativeAuthorityDigest: { algorithm: 'sha256', value: digestCanonical(nativeAuthorityBinding) },
        outcome: {
          status: !overflowed && residueAbsent && code === 0 && signal === null ? 'passed' : 'failed',
          exitCode: code,
          signal,
          outputLimitExceeded: overflowed,
          stdout: stdoutEvidence,
          stderr: stderrEvidence,
        },
        phaseEvidence,
        declaredEffects: declaredOperationEffects(declaration),
        cleanup,
        releaseAuthority: 'none',
      };
      resolve(Object.freeze(result));
    });
  });
}

function bridgeCommandPath(qualificationRoot) {
  return realpathSync(join(qualificationRoot, 'bin', 'rq-native-readonly.js'));
}

function createAdvisoryProcessController(bundle, attemptId, profiles = PROFILES) {
  validateAttemptId(attemptId);
  profiles.forEach((profile) => {
    if (!packProfiles(bundle.pack.packId).includes(profile)) {
      fail('UNSUPPORTED_PROFILE', `Unsupported ${bundle.pack.packId} profile ${profile}`);
    }
  });
  const scriptPath = bridgeCommandPath(bundle.qualificationRoot);
  return createProcessController({
    executablePath: process.execPath,
    allowedCwdRoot: bundle.repositoryRoot,
    allowedEnvironmentKeys: [],
    commands: [{
      commandId: `phase3.${bundle.pack.packId}.advisory`,
      scriptPath,
      contentDigest: commandDigest(scriptPath),
      allowedArgumentVectors: profiles.map((profile) => [attemptId, bundle.pack.packId, profile]),
    }],
  });
}

function createAdvisoryProcessDeclaration(bundle, attemptId, profile) {
  validateAttemptId(attemptId);
  if (!packProfiles(bundle.pack.packId).includes(profile)) {
    fail('UNSUPPORTED_PROFILE', `Unsupported ${bundle.pack.packId} profile ${String(profile)}`);
  }
  const scriptPath = bridgeCommandPath(bundle.qualificationRoot);
  return {
    attemptId,
    commandId: `phase3.${bundle.pack.packId}.advisory`,
    commandInstanceId: `command.${bundle.pack.packId}.${profile}`,
    executablePath: process.execPath,
    arguments: [attemptId, bundle.pack.packId, profile],
    workingDirectory: bundle.repositoryRoot,
    environment: {},
    expectedContentDigest: commandDigest(scriptPath),
    budgets: structuredClone(bundle.pack.timeouts),
    outputLimits: bundle.pack.packId === 'admin-aggregate' ? {
      stdoutBytes: 1024 * 1024,
      stderrBytes: 256 * 1024,
      resultFrameBytes: 768 * 1024,
    } : {
      stdoutBytes: 262144,
      stderrBytes: 65536,
      resultFrameBytes: 196608,
    },
  };
}

async function runAdvisoryProcess(bundle, attemptId, profile) {
  const controller = createAdvisoryProcessController(bundle, attemptId, [profile]);
  const execution = controller.start(createAdvisoryProcessDeclaration(bundle, attemptId, profile));
  await execution.started;
  return execution.result;
}

function writeProtocolFrame(frame) {
  process.stdout.write(`${canonicalize(frame)}\n`);
}

module.exports = {
  BRIDGE_VERSION,
  NativeReadOnlyBridgeError,
  OPERATION_CONTRACT_VERSION,
  OPERATION_SPECS,
  PACK_PROFILES,
  PROFILES,
  collectCleanupEvidence,
  createAdvisoryProcessController,
  createAdvisoryProcessDeclaration,
  createAdminAggregateNegativeMirror,
  deriveAdminAggregatePhaseEvidence,
  snapshotAdminAggregateResidue,
  executeNativeReadOnly,
  getOperationContract,
  runAdvisoryProcess,
  validateOperationContract,
  validateOperationResources,
  writeProtocolFrame,
};
