'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Ajv2020 = require('ajv/dist/2020');
const { canonicalize, computeArtifactDigest, parseStrictJson } = require('./canonical-json');
const { IdentityError } = require('./identities');

const SCHEMA_FILES = Object.freeze({
  'path.release-qualification.qualification-plan': 'qualification-plan.schema.json',
  'path.release-qualification.execution-event': 'execution-event.schema.json',
  'path.release-qualification.check-result': 'check-result.schema.json',
  'path.release-qualification.failure': 'failure.schema.json',
  'path.release-qualification.cleanup-result': 'cleanup-result.schema.json',
  'path.release-qualification.final-evidence': 'final-evidence.schema.json',
});
const SUPPORTED_SCHEMA_VERSIONS = Object.freeze({
  'path.release-qualification.qualification-plan': '1.0.0-draft.2',
  'path.release-qualification.execution-event': '1.0.0-draft.1',
  'path.release-qualification.check-result': '1.0.0-draft.1',
  'path.release-qualification.failure': '1.0.0-draft.1',
  'path.release-qualification.cleanup-result': '1.0.0-draft.1',
  'path.release-qualification.final-evidence': '1.0.0-draft.2',
});

class SchemaValidationError extends Error {
  constructor(code, message, issues = []) {
    super(message);
    this.name = 'SchemaValidationError';
    this.code = code;
    this.issues = issues;
  }
}

function loadSchemaDocuments(schemaDirectory = path.resolve(__dirname, '..', 'schemas')) {
  return Object.fromEntries(
    Object.entries(SCHEMA_FILES).map(([name, filename]) => {
      const source = fs.readFileSync(path.join(schemaDirectory, filename), 'utf8');
      const schema = parseStrictJson(source);
      if (schema.$id === undefined) {
        throw new SchemaValidationError('SCHEMA_DEFINITION_INVALID', `${filename} has no $id`);
      }
      return [name, schema];
    }),
  );
}

function createSchemaRegistry(options = {}) {
  const schemas = loadSchemaDocuments(options.schemaDirectory);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    strictRequired: false,
    strictTypes: false,
    strictNumbers: true,
    allowUnionTypes: false,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false,
    validateFormats: false,
  });

  for (const schema of Object.values(schemas)) ajv.addSchema(schema);
  const validators = Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => {
      const validator = ajv.getSchema(schema.$id);
      if (!validator) throw new SchemaValidationError('SCHEMA_DEFINITION_INVALID', `No validator compiled for ${name}`);
      return [name, validator];
    }),
  );

  return Object.freeze({ ajv, schemas, validators });
}

function schemaIssues(errors) {
  return (errors || []).map((error) => ({
    instancePath: error.instancePath,
    schemaPath: error.schemaPath,
    keyword: error.keyword,
    message: error.message,
    params: error.params,
  }));
}

function assertIdentityShape(artifact) {
  const product = artifact.productCandidateId;
  const harness = artifact.harnessVersion;
  if (product !== undefined) {
    if (product.identityKind !== 'productCandidateId' || Object.prototype.hasOwnProperty.call(product, 'target')) {
      throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', 'productCandidateId has the wrong identity kind or contains an environment target');
    }
  }
  if (harness !== undefined) {
    if (harness.identityKind !== 'harnessVersion' || Object.prototype.hasOwnProperty.call(harness, 'target')) {
      throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', 'harnessVersion has the wrong identity kind or contains an environment target');
    }
  }
}

function assertPackBinding(testPackVersions, packId, packVersion, context) {
  if (!testPackVersions || !Object.prototype.hasOwnProperty.call(testPackVersions, packId)) {
    throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', `${context} references an unbound pack ${packId}`);
  }
  if (testPackVersions[packId].packVersion !== packVersion) {
    throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', `${context} pack version conflicts with testPackVersions`);
  }
}

function assertIdentityConsistency(artifact) {
  assertIdentityShape(artifact);

  if (artifact.schemaName === 'path.release-qualification.qualification-plan' && artifact.identityBindings) {
    if (canonicalize(artifact.productCandidateId) !== canonicalize(artifact.identityBindings.productCandidateId)) {
      throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', 'Plan productCandidateId conflicts with identityBindings');
    }
    if (canonicalize(artifact.harnessVersion) !== canonicalize(artifact.identityBindings.harnessVersion)) {
      throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', 'Plan harnessVersion conflicts with identityBindings');
    }
    for (const check of artifact.selectedChecks || []) {
      assertPackBinding(artifact.testPackVersions, check.packId, check.packVersion, `selected check ${check.checkId}`);
    }
  }

  if (artifact.schemaName === 'path.release-qualification.check-result') {
    assertPackBinding(artifact.testPackVersions, artifact.packId, artifact.packVersion, `check result ${artifact.checkId}`);
  }

  if (artifact.schemaName === 'path.release-qualification.final-evidence') {
    if (
      canonicalize(artifact.productCandidateId) !== canonicalize(artifact.identitySummary.productCandidateId)
      || canonicalize(artifact.harnessVersion) !== canonicalize(artifact.identitySummary.harnessVersion)
      || artifact.attemptId !== artifact.identitySummary.attemptId
      || canonicalize(artifact.testPackVersions) !== canonicalize(artifact.identitySummary.testPackVersions)
    ) {
      throw new SchemaValidationError('IDENTITY_BINDING_CONFLICT', 'Final identitySummary conflicts with the common envelope');
    }
    for (const check of artifact.selectedScope.checks) {
      assertPackBinding(artifact.testPackVersions, check.packId, check.packVersion, `final selected check ${check.checkInstanceId}`);
    }
  }
}

function validateArtifact(input, registry = defaultRegistry) {
  let artifact;
  try {
    artifact = typeof input === 'string' || Buffer.isBuffer(input) || input instanceof Uint8Array
      ? parseStrictJson(input)
      : input;
    canonicalize(artifact);
  } catch (error) {
    if (error instanceof SchemaValidationError) throw error;
    throw new SchemaValidationError(error.code || 'MALFORMED_ARTIFACT', error.message, [error.details || {}]);
  }

  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) {
    throw new SchemaValidationError('MALFORMED_ARTIFACT', 'Qualification artifact must be a JSON object');
  }
  if (!Object.prototype.hasOwnProperty.call(SCHEMA_FILES, artifact.schemaName)) {
    throw new SchemaValidationError('UNSUPPORTED_SCHEMA', `Unsupported schema name ${String(artifact.schemaName)}`);
  }
  if (artifact.schemaVersion !== SUPPORTED_SCHEMA_VERSIONS[artifact.schemaName]) {
    throw new SchemaValidationError('UNSUPPORTED_SCHEMA_VERSION', `Unsupported ${artifact.schemaName} version ${String(artifact.schemaVersion)}`);
  }

  const validator = registry.validators[artifact.schemaName];
  if (!validator(artifact)) {
    throw new SchemaValidationError('SCHEMA_VALIDATION_FAILED', `${artifact.schemaName} failed schema validation`, schemaIssues(validator.errors));
  }

  const expectedDigest = computeArtifactDigest(artifact);
  if (canonicalize(artifact.contentDigest) !== canonicalize(expectedDigest)) {
    throw new SchemaValidationError('CONTENT_DIGEST_MISMATCH', `${artifact.schemaName} content digest does not match`, [{
      expected: expectedDigest,
      actual: artifact.contentDigest,
    }]);
  }

  try {
    assertIdentityConsistency(artifact);
  } catch (error) {
    if (error instanceof SchemaValidationError) throw error;
    if (error instanceof IdentityError) {
      throw new SchemaValidationError(error.code, error.message, [error.details]);
    }
    throw error;
  }

  return artifact;
}

const defaultRegistry = createSchemaRegistry();

module.exports = {
  SCHEMA_FILES,
  SUPPORTED_SCHEMA_VERSIONS,
  SchemaValidationError,
  createSchemaRegistry,
  loadSchemaDocuments,
  validateArtifact,
};
