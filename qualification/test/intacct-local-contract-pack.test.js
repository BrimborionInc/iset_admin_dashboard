'use strict';

const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');
const test = require('node:test');

const { parseStrictJson } = require('../src/canonical-json');
const { PACK_PROFILES } = require('../src/native-readonly-bridge');
const {
  PACK_CONTRACTS,
  PackValidationError,
  validatePackManifest,
} = require('../src/pack-validator');

const repositoryRoot = resolve(__dirname, '..', '..');
const qualificationRoot = resolve(__dirname, '..');
const activePackIds = Object.freeze([
  'ai-guidance-contract',
  'privacy-route-static',
  'admin-lint',
  'portal-lint',
  'admin-aggregate',
]);
const retainedArtifacts = Object.freeze([
  'packs/intacct-local-contract.pack.json',
  'test/fixtures/packs/intacct-local-contract-invalid/docs/data/integrations/intacct-interface-fidelity-manifest.json',
  'test/fixtures/packs/intacct-local-contract-invalid/isetadminserver.js',
  'test/fixtures/packs/intacct-local-contract-invalid/intacct-mock-service/src/server.js',
]);

test('Intacct local tooling is retained but excluded from active PATH qualification', () => {
  const registry = parseStrictJson(readFileSync(
    join(qualificationRoot, 'registries', 'phase3-read-only.registry.json'),
  ));
  const roleManifest = parseStrictJson(readFileSync(
    join(qualificationRoot, 'qualification-role-manifest.json'),
  ));
  const inactivePack = parseStrictJson(readFileSync(
    join(qualificationRoot, 'packs', 'intacct-local-contract.pack.json'),
  ));

  assert.deepEqual(registry.packs.map((entry) => entry.packId), activePackIds);
  assert.deepEqual(Object.keys(PACK_CONTRACTS), activePackIds);
  assert.deepEqual(Object.keys(PACK_PROFILES), activePackIds);
  assert.equal(Object.values(PACK_PROFILES).flat().length, 16);
  assert.equal(PACK_CONTRACTS['intacct-local-contract'], undefined);
  assert.equal(PACK_PROFILES['intacct-local-contract'], undefined);
  assert.equal(roleManifest.packExternalReadOnlyInputs['intacct-local-contract'], undefined);
  assert.equal(roleManifest.roles.certification.some((path) => (
    path.includes('intacct-local-contract-invalid')
  )), false);
  assert.equal(registry.releaseAuthority, 'none');

  assert.equal(inactivePack.packId, 'intacct-local-contract');
  assert.equal(inactivePack.releaseInfluence, 'none');
  assert.throws(() => validatePackManifest(inactivePack), (error) => {
    assert.ok(error instanceof PackValidationError);
    assert.equal(error.code, 'PACK_NOT_AUTHORIZED');
    return true;
  });
  for (const path of retainedArtifacts) {
    assert.equal(existsSync(join(qualificationRoot, path)), true, `${path} must remain retained`);
  }

  const rootPackage = parseStrictJson(readFileSync(join(repositoryRoot, 'package.json')));
  assert.equal(rootPackage.scripts['audit:intacct-contract'], 'node scripts/intacct-contract-audit.js');
  assert.equal(existsSync(join(repositoryRoot, 'scripts', 'intacct-contract-audit.js')), true);
  assert.equal(existsSync(join(
    repositoryRoot,
    'docs/data/integrations/intacct-interface-fidelity-manifest.json',
  )), true);
  assert.equal(existsSync(resolve(repositoryRoot, '../intacct-mock-service/src/server.js')), true);
});

test('active bridge and CLI have no Intacct operation or admission path', () => {
  const bridgeSource = readFileSync(join(qualificationRoot, 'src', 'native-readonly-bridge.js'), 'utf8');
  const validatorSource = readFileSync(join(qualificationRoot, 'src', 'pack-validator.js'), 'utf8');
  const cliSource = readFileSync(join(qualificationRoot, 'bin', 'rq-native-readonly.js'), 'utf8');

  assert.doesNotMatch(bridgeSource, /intacct-local-contract|rq-intacct/iu);
  assert.doesNotMatch(validatorSource, /intacct-local-contract|INTACCT_CONTRACT_INPUTS/iu);
  assert.doesNotMatch(cliSource, /intacct-local-contract/iu);
});
