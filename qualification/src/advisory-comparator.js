'use strict';

const { canonicalize, digestCanonical } = require('./canonical-json');
const { assertIdentitySeparation, validateAttemptId } = require('./identities');

const COMPARISON_VERSION = '1.0.0';

class AdvisoryComparisonError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AdvisoryComparisonError';
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new AdvisoryComparisonError(code, message, details);
}

function exactKeys(value, required, optional, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('INVALID_RECORD', `${label} must be an object`);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) fail('INVALID_RECORD', `${label} has missing or unknown fields`, { missing, unknown });
}

function finalize(record) {
  const material = { ...record };
  delete material.contentDigest;
  return Object.freeze({
    ...record,
    contentDigest: { algorithm: 'sha256', value: digestCanonical(material) },
  });
}

function validateDigest(record, label) {
  exactKeys(record.contentDigest, ['algorithm', 'value'], [], `${label}.contentDigest`);
  const material = { ...record };
  delete material.contentDigest;
  if (record.contentDigest.algorithm !== 'sha256' || record.contentDigest.value !== digestCanonical(material)) {
    fail('STALE_RECORD', `${label} content digest is stale`);
  }
}

function validateIdentityBindings(bindings, label) {
  exactKeys(bindings, [
    'productCandidateId', 'harnessVersion', 'attemptId', 'environmentIdentity', 'testPackVersions',
  ], [], label);
  try {
    assertIdentitySeparation(bindings);
  } catch (error) {
    fail('IDENTITY_CONFLICT', `${label} is invalid`, { cause: error.code || error.message });
  }
}

function createDirectRecord({
  pack,
  profile,
  identityBindings,
  nativeAuthorityBinding,
  phaseEvidence = null,
  command,
  outcome,
}) {
  validateIdentityBindings(identityBindings, 'direct.identityBindings');
  exactKeys(command, ['executable', 'arguments', 'workingDirectory'], [], 'direct.command');
  exactKeys(outcome, ['status', 'exitCode', 'signal', 'stdout', 'stderr'], [], 'direct.outcome');
  if (!['passed', 'failed'].includes(outcome.status)) fail('INVALID_RECORD', 'Direct outcome status is invalid');
  const expectedCommand = profile === 'known-good'
    ? pack.nativeAuthority.directKnownGoodCommand
    : pack.nativeAuthority.directDeliberateFailureCommand;
  if (
    !Array.isArray(expectedCommand)
    || canonicalize([command.executable, ...command.arguments]) !== canonicalize(expectedCommand)
    || command.workingDirectory !== nativeAuthorityBinding.workingDirectory
  ) fail('DIRECT_COMMAND_CONFLICT', 'Direct result is not bound to the pack-authorized native command');
  return finalize({
    recordKind: 'native-direct-result',
    recordVersion: COMPARISON_VERSION,
    packId: pack.packId,
    packVersion: pack.packVersion,
    maturity: pack.maturity,
    profile,
    identityBindings: structuredClone(identityBindings),
    nativeAuthorityBinding: structuredClone(nativeAuthorityBinding),
    nativeAuthorityDigest: { algorithm: 'sha256', value: digestCanonical(nativeAuthorityBinding) },
    phaseEvidence: structuredClone(phaseEvidence),
    command: structuredClone(command),
    outcome: structuredClone(outcome),
    releaseAuthority: 'none',
  });
}

function extractNativePayload(processResult) {
  exactKeys(processResult, [
    'processProtocolVersion', 'attemptId', 'commandId', 'commandInstanceId', 'commandContentDigest',
    'status', 'durationMs', 'readiness', 'result', 'exit', 'cancellation', 'termination', 'stdout',
    'stderr', 'protocolFrames', 'protocolErrors',
  ], [], 'processResult');
  if (
    processResult.result.status !== 'valid'
    || !processResult.result.frame
    || processResult.result.frame.payload?.resultKind !== 'native-readonly-result'
  ) fail('ADVISORY_EVIDENCE_INVALID', 'Advisory process lacks one valid native result');
  return processResult.result.frame.payload;
}

function validateNativeOperation(pack, native) {
  exactKeys(native.operationContract, [
    'contractVersion', 'adapterId', 'adapterVersion', 'operationId', 'packId', 'profile',
    'capabilities', 'effects', 'cleanup',
  ], [], 'native.operationContract');
  const operation = native.operationContract;
  exactKeys(operation.effects, ['effectClass', 'writePaths', 'externalEffects'], [], 'native.operationContract.effects');
  exactKeys(
    operation.cleanup,
    ['required', 'cleanupOwner', 'residueScope', 'proofKind'],
    [],
    'native.operationContract.cleanup',
  );
  if (
    native.resultVersion !== pack.requiredAdapter.adapterVersion
    || operation.contractVersion !== '1.0.0'
    || operation.adapterId !== pack.requiredAdapter.adapterId
    || operation.adapterVersion !== pack.requiredAdapter.adapterVersion
    || operation.packId !== pack.packId
    || operation.profile !== native.profile
    || operation.operationId !== `${pack.packId}:${native.profile}`
  ) fail('ADAPTER_CONFLICT', 'Advisory result is not bound to the admitted adapter operation');
  if (
    !Array.isArray(operation.capabilities)
    || !Array.isArray(operation.effects.writePaths)
    || !Array.isArray(operation.effects.externalEffects)
    || !Array.isArray(operation.cleanup.residueScope)
    || operation.capabilities.some((capability) => !pack.requiredAdapter.capabilities.includes(capability))
    || operation.effects.writePaths.some((path) => !pack.declaredEffects.writePaths.includes(path))
    || operation.effects.externalEffects.length
  ) fail('ADAPTER_CONFLICT', 'Advisory operation broadens the admitted capability or effect boundary');
  exactKeys(native.declaredEffects, ['effectClass', 'readPaths', 'writePaths', 'externalEffects'], [], 'native.declaredEffects');
  if (
    !Array.isArray(native.declaredEffects.readPaths)
    || !Array.isArray(native.declaredEffects.writePaths)
    || !Array.isArray(native.declaredEffects.externalEffects)
    || native.declaredEffects.readPaths.some((path) => !pack.declaredEffects.readPaths.includes(path))
    ||
    native.declaredEffects.effectClass !== operation.effects.effectClass
    || canonicalize(native.declaredEffects.writePaths) !== canonicalize(operation.effects.writePaths)
    || canonicalize(native.declaredEffects.externalEffects) !== canonicalize(operation.effects.externalEffects)
  ) fail('ADAPTER_CONFLICT', 'Advisory result effects conflict with the admitted operation');
  exactKeys(native.cleanup, [
    'required', 'status', 'cleanupOwner', 'residueScope', 'independentProof', 'residueDecision',
    'mirrorRootDigest', 'residueObserved', 'residuePaths', 'errors',
  ], [], 'native.cleanup');
  exactKeys(native.cleanup.independentProof, ['kind', 'completed', 'passed'], [], 'native.cleanup.independentProof');
  if (
    !Array.isArray(native.cleanup.residueScope)
    || !Array.isArray(native.cleanup.residuePaths)
    || !Array.isArray(native.cleanup.errors)
    ||
    native.cleanup.required !== operation.cleanup.required
    || native.cleanup.cleanupOwner !== operation.cleanup.cleanupOwner
    || canonicalize(native.cleanup.residueScope) !== canonicalize(operation.cleanup.residueScope)
    || native.cleanup.independentProof.kind !== operation.cleanup.proofKind
  ) fail('ADAPTER_CONFLICT', 'Advisory cleanup evidence conflicts with the admitted operation');
}

function createAdvisoryRecord({ pack, identityBindings, processResult }) {
  validateIdentityBindings(identityBindings, 'advisory.identityBindings');
  if (processResult.attemptId !== identityBindings.attemptId) fail('IDENTITY_CONFLICT', 'Advisory process attempt is stale');
  const native = extractNativePayload(processResult);
  if (
    native.packId !== pack.packId
    || native.packVersion !== pack.packVersion
    || native.maturity !== pack.maturity
    || native.releaseAuthority !== 'none'
  ) fail('PACK_CONFLICT', 'Advisory native result conflicts with the admitted pack');
  validateNativeOperation(pack, native);
  if (
    processResult.termination.proved !== true
    || processResult.stdout.truncated
    || processResult.stderr.truncated
    || native.outcome.stdout.truncated
    || native.outcome.stderr.truncated
  ) fail('ADVISORY_EVIDENCE_INVALID', 'Advisory execution is incomplete, truncated, or not terminated');
  return finalize({
    recordKind: 'native-advisory-result',
    recordVersion: COMPARISON_VERSION,
    packId: native.packId,
    packVersion: native.packVersion,
    maturity: native.maturity,
    profile: native.profile,
    operationContract: structuredClone(native.operationContract),
    identityBindings: structuredClone(identityBindings),
    nativeAuthorityBinding: structuredClone(native.nativeAuthorityBinding),
    nativeAuthorityDigest: structuredClone(native.nativeAuthorityDigest),
    processEvidence: {
      processStatus: processResult.status,
      commandId: processResult.commandId,
      commandContentDigest: processResult.commandContentDigest,
      readinessProved: processResult.readiness.proved,
      terminationProved: processResult.termination.proved,
      cancellation: processResult.cancellation,
      wrapperExit: processResult.exit,
    },
    phaseEvidence: structuredClone(native.phaseEvidence || null),
    outcome: structuredClone(native.outcome),
    declaredEffects: structuredClone(native.declaredEffects),
    cleanup: structuredClone(native.cleanup),
    releaseAuthority: 'none',
  });
}

function validateRecord(record, kind, label) {
  exactKeys(record, kind === 'native-direct-result' ? [
    'recordKind', 'recordVersion', 'packId', 'packVersion', 'maturity', 'profile', 'identityBindings',
    'nativeAuthorityBinding', 'nativeAuthorityDigest', 'phaseEvidence', 'command', 'outcome',
    'releaseAuthority', 'contentDigest',
  ] : [
    'recordKind', 'recordVersion', 'packId', 'packVersion', 'maturity', 'profile', 'identityBindings',
    'operationContract', 'nativeAuthorityBinding', 'nativeAuthorityDigest', 'processEvidence',
    'phaseEvidence', 'outcome', 'declaredEffects', 'cleanup', 'releaseAuthority', 'contentDigest',
  ], [], label);
  if (record.recordKind !== kind || record.recordVersion !== COMPARISON_VERSION || record.releaseAuthority !== 'none') {
    fail('INVALID_RECORD', `${label} has conflicting authority or version`);
  }
  validateAttemptId(record.identityBindings.attemptId);
  validateIdentityBindings(record.identityBindings, `${label}.identityBindings`);
  validateDigest(record, label);
  if (record.nativeAuthorityDigest.algorithm !== 'sha256'
    || record.nativeAuthorityDigest.value !== digestCanonical(record.nativeAuthorityBinding)) {
    fail('STALE_RECORD', `${label} native authority digest is stale`);
  }
}

function compareAdvisoryToDirect(direct, advisory) {
  validateRecord(direct, 'native-direct-result', 'direct');
  validateRecord(advisory, 'native-advisory-result', 'advisory');
  const differences = [];
  const compare = (field, left, right) => {
    if (canonicalize(left) !== canonicalize(right)) differences.push(field);
  };
  compare('packId', direct.packId, advisory.packId);
  compare('packVersion', direct.packVersion, advisory.packVersion);
  compare('maturity', direct.maturity, advisory.maturity);
  compare('profile', direct.profile, advisory.profile);
  compare('productCandidateId', direct.identityBindings.productCandidateId, advisory.identityBindings.productCandidateId);
  compare('environmentIdentity', direct.identityBindings.environmentIdentity, advisory.identityBindings.environmentIdentity);
  compare('testPackVersions', direct.identityBindings.testPackVersions, advisory.identityBindings.testPackVersions);
  compare('nativeAuthorityBinding', direct.nativeAuthorityBinding, advisory.nativeAuthorityBinding);
  compare('nativeStatus', direct.outcome.status, advisory.outcome.status);
  compare('nativeExitCode', direct.outcome.exitCode, advisory.outcome.exitCode);
  compare('nativeSignal', direct.outcome.signal, advisory.outcome.signal);
  compare('phaseEvidence', direct.phaseEvidence, advisory.phaseEvidence);
  if (direct.identityBindings.attemptId === advisory.identityBindings.attemptId) differences.push('attemptId-not-distinct');
  if (advisory.processEvidence.terminationProved !== true) differences.push('termination-unproved');
  const status = differences.length === 0 ? 'matched' : 'disagreement';
  return finalize({
    recordKind: 'native-advisory-comparison',
    recordVersion: COMPARISON_VERSION,
    packId: advisory.packId,
    packVersion: advisory.packVersion,
    directAttemptId: direct.identityBindings.attemptId,
    advisoryAttemptId: advisory.identityBindings.attemptId,
    directHarnessVersion: direct.identityBindings.harnessVersion,
    advisoryHarnessVersion: advisory.identityBindings.harnessVersion,
    status,
    differences,
    comparisonBasis: [
      'identity-and-pack-binding',
      'native-authority-binding',
      'native-exit-status',
      'bounded-termination',
    ],
    unstructuredOutputComparison: 'retained-not-semantic-authority',
    mandatoryStop: status !== 'matched',
    releaseAuthority: 'none',
  });
}

module.exports = {
  AdvisoryComparisonError,
  COMPARISON_VERSION,
  compareAdvisoryToDirect,
  createAdvisoryRecord,
  createDirectRecord,
};
