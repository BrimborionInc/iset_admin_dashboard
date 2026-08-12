#!/usr/bin/env node
'use strict';

const { resolve } = require('node:path');

const { validateAttemptId } = require('../src/identities');
const {
  PACK_PROFILES,
  PROFILES,
  executeNativeReadOnly,
  writeProtocolFrame,
} = require('../src/native-readonly-bridge');
const { validatePackBundle } = require('../src/pack-validator');
const { PROCESS_PROTOCOL_VERSION } = require('../src/process-control');

async function main() {
  const arguments_ = process.argv.slice(2);
  const [attemptId, packId, profile] = arguments_.length === 2
    ? [arguments_[0], 'ai-guidance-contract', arguments_[1]]
    : arguments_;
  if (
    ![2, 3].includes(arguments_.length)
    || !PACK_PROFILES[packId]
    || !PROFILES.includes(profile)
    || !PACK_PROFILES[packId].includes(profile)
  ) throw new Error('Expected exactly <attemptId> [packId] <profile> for an admitted pack/profile');
  validateAttemptId(attemptId);
  const qualificationRoot = resolve(__dirname, '..');
  const repositoryRoot = resolve(qualificationRoot, '..');
  const packFiles = {
    'ai-guidance-contract': 'admin-ai-guidance-contract.pack.json',
    'privacy-route-static': 'admin-privacy-route-static.pack.json',
    'admin-lint': 'admin-lint.pack.json',
    'portal-lint': 'portal-lint.pack.json',
    'admin-aggregate': 'admin-aggregate.pack.json',
  };
  const bundle = validatePackBundle({
    repositoryRoot,
    qualificationRoot,
    packPath: resolve(
      qualificationRoot,
      'packs',
      packFiles[packId],
    ),
    registryPath: resolve(qualificationRoot, 'registries', 'phase3-read-only.registry.json'),
    roleManifestPath: resolve(qualificationRoot, 'qualification-role-manifest.json'),
  });
  writeProtocolFrame({ type: 'ready', protocolVersion: PROCESS_PROTOCOL_VERSION, attemptId });
  const result = await executeNativeReadOnly(bundle, profile, { attemptId });
  writeProtocolFrame({
    type: 'result',
    protocolVersion: PROCESS_PROTOCOL_VERSION,
    attemptId,
    resultId: `native.${bundle.pack.packId}.${profile}`,
    status: result.outcome.status,
    payload: result,
  });
}

main().catch((error) => {
  process.stderr.write(`${JSON.stringify({
    error: 'native-readonly-bridge-failed',
    code: error.code || 'UNEXPECTED_ERROR',
    message: error.message,
  })}\n`);
  process.exitCode = 1;
});
