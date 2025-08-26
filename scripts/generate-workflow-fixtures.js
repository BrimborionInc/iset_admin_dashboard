#!/usr/bin/env node
/**
 * Generate normalized workflow preview fixtures with optional validation.
 *
 * Outputs:
 *   tests/fixtures/workflows/_workflows-list.json  -> summary list
 *   tests/fixtures/workflows/workflow-<id>.json    -> per-workflow preview + validation
 *
 * Env vars (optional):
 *   ADMIN_BASE_URL  Base URL to the admin API (default http://localhost:5001)
 *   FIXTURE_VALIDATE true/false to include validation (?validate=true)
 *   WORKFLOW_IDS     Comma-separated list to restrict (e.g. "1,2,5")
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');

(async () => {
  const base = process.env.ADMIN_BASE_URL || 'http://localhost:5001';
  const apiBase = base.replace(/\/$/, '') + '/api';
  const validate = String(process.env.FIXTURE_VALIDATE || 'true').toLowerCase() === 'true';
  const restrict = (process.env.WORKFLOW_IDS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter(n => !isNaN(n));

  const outDir = path.resolve(__dirname, '..', 'tests', 'fixtures', 'workflows');
  fs.mkdirSync(outDir, { recursive: true });

  function log(msg) { process.stdout.write(msg + '\n'); }

  log(`[fixtures] API base: ${apiBase}`);
  log(`[fixtures] Validation: ${validate}`);
  if (restrict.length) log(`[fixtures] Restricting to workflow IDs: ${restrict.join(', ')}`);

  let workflows = [];
  try {
    const listResp = await axios.get(`${apiBase}/workflows`);
    workflows = Array.isArray(listResp.data) ? listResp.data : [];
  } catch (e) {
    console.error('[fixtures] Failed to fetch workflows list:', e.message);
    process.exitCode = 1;
    return;
  }

  if (restrict.length) {
    workflows = workflows.filter(w => restrict.includes(Number(w.id)));
  }
  if (!workflows.length) {
    log('[fixtures] No workflows found (after restriction). Nothing to do.');
    return;
  }

  const summary = [];
  for (const wf of workflows) {
    const id = wf.id;
    try {
      const url = `${apiBase}/workflows/${id}/preview` + (validate ? '?validate=true' : '');
      const resp = await axios.get(url);
      const payload = resp.data || {};
      const filePath = path.join(outDir, `workflow-${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
      const valErrors = payload.validation && payload.validation.errors ? payload.validation.errors.length : 0;
      const valWarnings = payload.validation && payload.validation.warnings ? payload.validation.warnings.length : 0;
      summary.push({ id, name: wf.name, status: wf.status, steps: Array.isArray(payload.steps) ? payload.steps.length : 0, valErrors, valWarnings });
      log(`[fixtures] Saved workflow-${id}.json (steps=${summary[summary.length-1].steps}, errors=${valErrors}, warnings=${valWarnings})`);
    } catch (e) {
      console.error(`[fixtures] Failed workflow ${id}:`, e.response?.status, e.message);
      summary.push({ id, name: wf.name, status: wf.status, error: e.message });
    }
  }

  // Write list file
  const listPath = path.join(outDir, '_workflows-list.json');
  fs.writeFileSync(listPath, JSON.stringify({ generatedAt: new Date().toISOString(), base: apiBase, validate, workflows: summary }, null, 2), 'utf8');
  log(`[fixtures] Wrote summary ${path.relative(process.cwd(), listPath)}`);

  // Simple exit status: 0 even if some had errors (report inside summary)
})();
