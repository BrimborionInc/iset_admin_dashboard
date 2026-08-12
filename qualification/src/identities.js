'use strict';

const { randomUUID } = require('node:crypto');
const {
  CANONICALIZATION_PROFILE,
  DIGEST_ALGORITHM,
  canonicalize,
  digestCanonical,
} = require('./canonical-json');

const IDENTITY_DEFINITION_VERSION = '1.0.0';
const ATTEMPT_ID_PATTERN = /^attempt:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/+-]{0,255}$/u;

class IdentityError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.details = details;
  }
}

function assertExactKeys(value, required, optional, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new IdentityError('IDENTITY_SHAPE', `${label} must be an object`);
  }
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || unknown.length) {
    throw new IdentityError('IDENTITY_SHAPE', `${label} has missing or unknown fields`, { missing, unknown });
  }
}

function assertDigest(value, label) {
  if (typeof value !== 'string' || !HEX_DIGEST_PATTERN.test(value)) {
    throw new IdentityError('IDENTITY_DIGEST', `${label} must be a lowercase SHA-256 hex digest`);
  }
}

function assertOpaqueId(value, label) {
  if (typeof value !== 'string' || !OPAQUE_ID_PATTERN.test(value)) {
    throw new IdentityError('IDENTITY_VALUE', `${label} is not a valid opaque identifier`);
  }
}

function assertArtifactRef(reference, label) {
  assertExactKeys(reference, ['schemaName', 'schemaVersion', 'artifactId', 'contentDigest'], [], label);
  assertOpaqueId(reference.schemaName, `${label}.schemaName`);
  assertOpaqueId(reference.schemaVersion, `${label}.schemaVersion`);
  assertOpaqueId(reference.artifactId, `${label}.artifactId`);
  assertExactKeys(reference.contentDigest, ['algorithm', 'value'], [], `${label}.contentDigest`);
  if (reference.contentDigest.algorithm !== DIGEST_ALGORITHM) {
    throw new IdentityError('IDENTITY_ALGORITHM', `${label} uses an unsupported digest algorithm`);
  }
  assertDigest(reference.contentDigest.value, `${label}.contentDigest.value`);
}

function normalizeManifestRefs(manifestRefs) {
  if (!Array.isArray(manifestRefs) || manifestRefs.length === 0) {
    throw new IdentityError('IDENTITY_MANIFESTS', 'At least one manifest reference is required');
  }
  manifestRefs.forEach((reference, index) => assertArtifactRef(reference, `manifestRefs[${index}]`));
  const keyed = manifestRefs.map((reference) => [canonicalize(reference), reference]);
  keyed.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  for (let index = 1; index < keyed.length; index += 1) {
    if (keyed[index - 1][0] === keyed[index][0]) {
      throw new IdentityError('IDENTITY_MANIFESTS', 'Manifest references must be unique');
    }
  }
  return keyed.map(([, reference]) => reference);
}

function identityPreimage(identityKind, manifestRefs, material, target) {
  const preimage = {
    identityKind,
    definitionVersion: IDENTITY_DEFINITION_VERSION,
    canonicalizationProfile: CANONICALIZATION_PROFILE,
    digestAlgorithm: DIGEST_ALGORITHM,
    manifestRefs,
    material,
  };
  if (target !== undefined) preimage.target = target;
  return preimage;
}

function createContentIdentity(identityKind, { manifestRefs, material, target }) {
  if (!['productCandidateId', 'harnessVersion', 'environmentIdentity'].includes(identityKind)) {
    throw new IdentityError('IDENTITY_KIND', `Unsupported identity kind ${identityKind}`);
  }
  if (material === undefined) {
    throw new IdentityError('IDENTITY_MATERIAL', `${identityKind} requires explicit material`);
  }
  const normalizedRefs = normalizeManifestRefs(manifestRefs);
  if (identityKind === 'environmentIdentity' && target === undefined) {
    throw new IdentityError('IDENTITY_TARGET', 'environmentIdentity requires a proved target');
  }
  if (identityKind !== 'environmentIdentity' && target !== undefined) {
    throw new IdentityError('IDENTITY_TARGET', `${identityKind} must not contain an environment target`);
  }

  const identity = {
    identityKind,
    definitionVersion: IDENTITY_DEFINITION_VERSION,
    canonicalizationProfile: CANONICALIZATION_PROFILE,
    digestAlgorithm: DIGEST_ALGORITHM,
    digest: digestCanonical(identityPreimage(identityKind, normalizedRefs, material, target)),
    manifestRefs: normalizedRefs,
  };
  if (target !== undefined) identity.target = target;
  return identity;
}

function createProductCandidateId(inputs) {
  return createContentIdentity('productCandidateId', inputs);
}

function createHarnessVersion(inputs) {
  return createContentIdentity('harnessVersion', inputs);
}

function createEnvironmentIdentity(inputs) {
  return createContentIdentity('environmentIdentity', inputs);
}

function verifyContentIdentity(identity, { material }) {
  assertExactKeys(
    identity,
    ['identityKind', 'definitionVersion', 'canonicalizationProfile', 'digestAlgorithm', 'digest', 'manifestRefs'],
    ['target'],
    'identity',
  );
  if (!['productCandidateId', 'harnessVersion', 'environmentIdentity'].includes(identity.identityKind)) {
    throw new IdentityError('IDENTITY_KIND', 'Identity kind is unsupported');
  }
  if (identity.definitionVersion !== IDENTITY_DEFINITION_VERSION) {
    throw new IdentityError('IDENTITY_VERSION', 'Identity definition version is unsupported');
  }
  if (identity.canonicalizationProfile !== CANONICALIZATION_PROFILE) {
    throw new IdentityError('IDENTITY_PROFILE', 'Canonicalization profile is unsupported');
  }
  if (identity.digestAlgorithm !== DIGEST_ALGORITHM) {
    throw new IdentityError('IDENTITY_ALGORITHM', 'Digest algorithm is unsupported');
  }
  assertDigest(identity.digest, 'identity.digest');
  const normalizedRefs = normalizeManifestRefs(identity.manifestRefs);
  if (canonicalize(normalizedRefs) !== canonicalize(identity.manifestRefs)) {
    throw new IdentityError('IDENTITY_MANIFEST_ORDER', 'Manifest references are not in canonical order');
  }
  if (identity.identityKind === 'environmentIdentity' && identity.target === undefined) {
    throw new IdentityError('IDENTITY_TARGET', 'Environment identity has no target');
  }
  if (identity.identityKind !== 'environmentIdentity' && identity.target !== undefined) {
    throw new IdentityError('IDENTITY_TARGET', 'Only environment identity may contain a target');
  }
  const expected = digestCanonical(
    identityPreimage(identity.identityKind, normalizedRefs, material, identity.target),
  );
  if (identity.digest !== expected) {
    throw new IdentityError('IDENTITY_DIGEST_MISMATCH', 'Identity digest does not match its material', {
      expected,
      actual: identity.digest,
    });
  }
  return true;
}

function createAttemptId(uuid = randomUUID()) {
  const attemptId = `attempt:${String(uuid).toLowerCase()}`;
  validateAttemptId(attemptId);
  return attemptId;
}

function validateAttemptId(attemptId) {
  if (typeof attemptId !== 'string' || !ATTEMPT_ID_PATTERN.test(attemptId)) {
    throw new IdentityError('ATTEMPT_ID', 'Attempt ID must contain a valid lowercase RFC 4122 UUID');
  }
  return true;
}

function createTestPackVersions(packDefinitions) {
  if (!Array.isArray(packDefinitions) || packDefinitions.length === 0) {
    throw new IdentityError('PACK_IDENTITIES', 'At least one test-pack definition is required');
  }
  const versions = Object.create(null);
  for (const definition of packDefinitions) {
    assertExactKeys(definition, ['packId', 'packVersion', 'manifestRefs', 'material'], [], 'test-pack definition');
    assertOpaqueId(definition.packId, 'packId');
    assertOpaqueId(definition.packVersion, 'packVersion');
    if (Object.prototype.hasOwnProperty.call(versions, definition.packId)) {
      throw new IdentityError('PACK_IDENTITIES', `Duplicate test-pack identity ${definition.packId}`);
    }
    const manifestRefs = normalizeManifestRefs(definition.manifestRefs);
    versions[definition.packId] = {
      packVersion: definition.packVersion,
      digestAlgorithm: DIGEST_ALGORITHM,
      digest: digestCanonical({
        identityKind: 'testPackVersion',
        definitionVersion: IDENTITY_DEFINITION_VERSION,
        canonicalizationProfile: CANONICALIZATION_PROFILE,
        digestAlgorithm: DIGEST_ALGORITHM,
        packId: definition.packId,
        packVersion: definition.packVersion,
        manifestRefs,
        material: definition.material,
      }),
      manifestRefs,
    };
  }
  return Object.fromEntries(Object.entries(versions).sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
}

function verifyTestPackVersions(testPackVersions, packMaterials) {
  if (!testPackVersions || typeof testPackVersions !== 'object' || Array.isArray(testPackVersions)) {
    throw new IdentityError('PACK_IDENTITIES', 'testPackVersions must be an object');
  }
  const packIds = Object.keys(testPackVersions);
  if (packIds.length === 0) throw new IdentityError('PACK_IDENTITIES', 'testPackVersions must not be empty');
  for (const packId of packIds) {
    const identity = testPackVersions[packId];
    assertExactKeys(identity, ['packVersion', 'digestAlgorithm', 'digest', 'manifestRefs'], [], `testPackVersions.${packId}`);
    if (identity.digestAlgorithm !== DIGEST_ALGORITHM) {
      throw new IdentityError('IDENTITY_ALGORITHM', `Unsupported digest algorithm for ${packId}`);
    }
    assertDigest(identity.digest, `testPackVersions.${packId}.digest`);
    if (!Object.prototype.hasOwnProperty.call(packMaterials, packId)) {
      throw new IdentityError('PACK_MATERIAL_MISSING', `No verification material supplied for ${packId}`);
    }
    const expected = createTestPackVersions([{
      packId,
      packVersion: identity.packVersion,
      manifestRefs: identity.manifestRefs,
      material: packMaterials[packId],
    }])[packId];
    if (identity.digest !== expected.digest || canonicalize(identity.manifestRefs) !== canonicalize(expected.manifestRefs)) {
      throw new IdentityError('IDENTITY_DIGEST_MISMATCH', `Test-pack identity ${packId} does not match its material`);
    }
  }
  return true;
}

function assertIdentitySeparation({
  productCandidateId,
  harnessVersion,
  attemptId,
  environmentIdentity,
  testPackVersions,
}) {
  if (productCandidateId?.identityKind !== 'productCandidateId') {
    throw new IdentityError('IDENTITY_BINDING', 'productCandidateId is bound to the wrong identity kind');
  }
  if (harnessVersion?.identityKind !== 'harnessVersion') {
    throw new IdentityError('IDENTITY_BINDING', 'harnessVersion is bound to the wrong identity kind');
  }
  if (environmentIdentity?.identityKind !== 'environmentIdentity') {
    throw new IdentityError('IDENTITY_BINDING', 'environmentIdentity is bound to the wrong identity kind');
  }
  validateAttemptId(attemptId);
  if (!testPackVersions || Object.keys(testPackVersions).length === 0) {
    throw new IdentityError('IDENTITY_BINDING', 'testPackVersions is missing');
  }
  return true;
}

module.exports = {
  ATTEMPT_ID_PATTERN,
  IDENTITY_DEFINITION_VERSION,
  IdentityError,
  assertIdentitySeparation,
  createAttemptId,
  createEnvironmentIdentity,
  createHarnessVersion,
  createProductCandidateId,
  createTestPackVersions,
  validateAttemptId,
  verifyContentIdentity,
  verifyTestPackVersions,
};
