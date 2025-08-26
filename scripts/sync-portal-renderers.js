#!/usr/bin/env node
/**
 * Sync portal renderers into admin-dashboard/src/component-lib/portalRenderers.js
 * Rationale: CRA forbids importing source outside src/. We vendor a trimmed copy.
 * This script can be extended to minify or diff-check. For now, it reminds devs where the source lives.
 */
const fs = require('fs');
const path = require('path');
const SOURCE = path.resolve(__dirname, '../../ISET-intake/src/renderer/renderers.js');
const TARGET = path.resolve(__dirname, '../src/component-lib/portalRenderers.js');

if (!fs.existsSync(SOURCE)) {
  console.error('Source portal renderers not found at', SOURCE);
  process.exit(1);
}

const src = fs.readFileSync(SOURCE, 'utf8');
// For now, we just warn instead of overwriting since we manually trimmed the copy for bundle size.
console.log('Portal renderers source length:', src.length);
console.log('NOTE: Current vendored copy is trimmed. Manually reconcile if upstream changed.');
console.log('Future enhancement: parse & pick subset or replace wholesale.');
