// Component contract validator (dev aid)
// Validates normalized workflow schema output against draft contract.
// Export validateWorkflow(workflowSchema:{steps,meta}) -> { ok, errors:[] }

const KEBAB_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isLangObj(v) {
  return v && typeof v === 'object' && (v.en || v.fr);
}

function push(errs, stepId, compId, code, msg, extra) {
  errs.push({ stepId, compId, code, message: msg, ...(extra||{}) });
}

function validateComponent(c, ctx, errs) {
  const { stepId, seenKeys } = ctx;
  if (!c.id) push(errs, stepId, c.id, 'missing_id', 'Component missing id');
  if (!c.type) push(errs, stepId, c.id, 'missing_type', 'Component missing type');
  if (c.storageKey) {
    if (!KEBAB_RE.test(c.storageKey)) push(errs, stepId, c.id, 'bad_storage_key', `storageKey '${c.storageKey}' not kebab-case`);
    if (seenKeys.has(c.storageKey)) push(errs, stepId, c.id, 'dup_storage_key', `Duplicate storageKey '${c.storageKey}'`);
    seenKeys.add(c.storageKey);
  }
  // Choice components
  if (['radio','checkboxes','select'].includes(c.type)) {
    if (!Array.isArray(c.options) || !c.options.length) {
      push(errs, stepId, c.id, 'options_empty', 'Choice component must have options');
    } else {
      c.options.forEach((o,i) => {
        if (o.value === undefined || o.value === null || o.value==='') push(errs, stepId, c.id, 'option_missing_value', `Option ${i} missing value`);
        if (!o.label) push(errs, stepId, c.id, 'option_missing_label', `Option ${i} missing label`);
      });
    }
  }
  if (c.type === 'summary-list') {
    if (!Array.isArray(c.rows) || !c.rows.length) {
      push(errs, stepId, c.id, 'rows_empty', 'summary-list requires rows');
    } else {
      c.rows.forEach((r,i) => { if (!r.key) push(errs, stepId, c.id, 'row_missing_key', `Row ${i} missing key`); });
    }
  }
  // Basic bilingual field checks
  ['label','hint'].forEach(f => { if (c[f] && !isLangObj(c[f])) push(errs, stepId, c.id, 'bad_lang_obj', `${f} should be bilingual object`); });
}

function validateWorkflow(schema) {
  const errors = [];
  if (!schema || !Array.isArray(schema.steps)) return { ok:false, errors:[{ code:'invalid_schema', message:'steps missing'}] };
  const seenKeys = new Set();
  schema.steps.forEach(step => {
    const stepId = step.stepId || 'step';
    (step.components||[]).forEach(c => validateComponent(c, { stepId, seenKeys }, errors));
  });
  return { ok: errors.length === 0, errors };
}

module.exports = { validateWorkflow };
