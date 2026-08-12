#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { dirname, resolve } = require('node:path');

const { canonicalize, parseStrictJson } = require('../src/canonical-json');
const {
  collectSourceInventory, loadSourceRoleRegistry, validateSourceInventory,
} = require('../src/source-inventory');
const { compareSourceStability } = require('../src/source-stability');

function usage() {
  return 'Usage: rq-source-state <inventory|verify> --registry <path> [--baseline <path>] [--workspace-root <path>]';
}

function parseArguments(argv) {
  const [operation, ...rest] = argv;
  if (!['inventory', 'verify'].includes(operation)) throw new Error(usage());
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    const value = rest[index + 1];
    if (!['--registry', '--baseline', '--workspace-root'].includes(key) || !value) throw new Error(usage());
    if (Object.prototype.hasOwnProperty.call(options, key)) throw new Error(`Duplicate option ${key}`);
    options[key] = value;
  }
  if (!options['--registry'] || (operation === 'verify' && !options['--baseline'])) throw new Error(usage());
  if (operation === 'inventory' && options['--baseline']) throw new Error('--baseline is valid only for verify');
  return { operation, options };
}

function main() {
  const { operation, options } = parseArguments(process.argv.slice(2));
  const registryPath = resolve(options['--registry']);
  const workspaceRoot = resolve(options['--workspace-root'] || dirname(dirname(dirname(registryPath))));
  const registry = loadSourceRoleRegistry(registryPath);
  const observed = collectSourceInventory({ registry, workspaceRoot });
  if (operation === 'inventory') {
    process.stdout.write(`${canonicalize(observed)}\n`);
    return;
  }
  const baseline = validateSourceInventory(parseStrictJson(readFileSync(resolve(options['--baseline']))));
  const result = compareSourceStability(baseline, observed, { expectedBaselineId: baseline.inventoryId });
  process.stdout.write(`${canonicalize(result)}\n`);
  if (!result.stable) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error.code || 'RQ_SOURCE_STATE_ERROR'}: ${error.message}\n`);
  process.exitCode = 2;
}
