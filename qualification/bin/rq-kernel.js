#!/usr/bin/env node
'use strict';

const { canonicalize, parseStrictJson } = require('../src/canonical-json');
const { validateEvidenceBundle } = require('../src/evidence-validator');
const { runQualificationAttempt } = require('../src/kernel');
const { validatePlanForAdmission } = require('../src/plan-validator');
const { createProcessController } = require('../src/process-control');

function exactInput(value, required, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error(`${label} must be an object`), { code: 'INVALID_CLI_INPUT' });
  }
  const missing = required.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  const unknown = Object.keys(value).filter((key) => !required.includes(key));
  if (missing.length || unknown.length) {
    throw Object.assign(new Error(`${label} has missing or unknown fields`), {
      code: 'INVALID_CLI_INPUT',
      details: { missing, unknown },
    });
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(canonicalize(parseStrictJson(Buffer.concat(chunks))));
}

async function main() {
  const operation = process.argv[2];
  if (!['plan', 'run', 'validate'].includes(operation) || process.argv.length !== 3) {
    throw Object.assign(new Error('Usage: rq-kernel <plan|run|validate> with strict JSON on stdin'), {
      code: 'CLI_OPERATION_INVALID',
    });
  }
  const input = await readStdin();
  let output;
  if (operation === 'plan') {
    exactInput(input, ['plan', 'selectionInput'], 'plan input');
    output = validatePlanForAdmission(input.plan, input.selectionInput);
  } else if (operation === 'validate') {
    exactInput(input, ['bundle', 'selectionInput'], 'validation input');
    output = validateEvidenceBundle(input.bundle, input.selectionInput);
  } else {
    exactInput(input, ['invocation', 'processPolicy'], 'run input');
    if (Object.values(input.invocation.checkExecutions || {}).some((definition) => definition.cleanup !== undefined)) {
      throw Object.assign(new Error('The Phase 2 CLI admits only serializable read-only synthetic executions'), {
        code: 'CLI_CLEANUP_CALLBACK_UNSUPPORTED',
      });
    }
    output = await runQualificationAttempt({
      ...input.invocation,
      processController: createProcessController(input.processPolicy),
    });
  }
  process.stdout.write(`${canonicalize(output)}\n`);
}

main().catch((error) => {
  const failure = {
    code: error.code || 'CLI_OPERATION_FAILED',
    message: error.message,
    details: error.details || {},
  };
  process.stderr.write(`${canonicalize(failure)}\n`);
  process.exitCode = 1;
});
