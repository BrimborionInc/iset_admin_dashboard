// Step Validation Engine (Deterministic, Advisory)
// Produces an array of issues: { id, category, severity, message, details?, componentIndex?, componentName?, fieldPath? }
// Severity: error | warning | info (advisory)

// Categories: structure, i18n, accessibility, options, logic, config, linkage

// Helper: safe bilingual string extractor
function extractLang(val, lang='en') {
  if (!val) return '';
  if (typeof val === 'string') return val.trim();
  if (typeof val === 'object') {
    if ('en' in val || 'fr' in val) return String(val[lang] ?? val.en ?? val.fr ?? '').trim();
    if ('text' in val) return extractLang(val.text, lang);
  }
  return '';
}

function isI18n(val) {
  return val && typeof val === 'object' && (Object.prototype.hasOwnProperty.call(val,'en') || Object.prototype.hasOwnProperty.call(val,'fr'));
}

// Generate a stable id for issue
let issueCounter = 0;
function issueId(prefix) { issueCounter += 1; return `${prefix}-${issueCounter}`; }

/**
 * Validate a step definition.
 * @param {Object} step { name, status, components: [{ template_key, props: {} }] }
 * @param {Object} [opts]
 * @returns {Array} issues
 */
export function validateStep(step, opts = {}) {
  issueCounter = 0; // reset per run
  const issues = [];
  if (!step || typeof step !== 'object') return [{ id: issueId('fatal'), category: 'structure', severity: 'error', message: 'Invalid step object' }];
  const components = Array.isArray(step.components) ? step.components : [];

  // 1. Duplicate data keys (name/id) among components
  const keyMap = new Map();
  components.forEach((c, idx) => {
    const key = c?.props?.name || c?.props?.id;
    if (!key) return;
    if (!keyMap.has(key)) keyMap.set(key, []);
    keyMap.get(key).push(idx);
  });
  for (const [k, list] of keyMap.entries()) {
    if (list.length > 1) {
      issues.push({ id: issueId('dupkey'), category: 'structure', severity: 'error', message: `Duplicate data key '${k}' across ${list.length} components`, details: { key: k, indices: list } });
    }
  }

  // 2. Component-level bilingual completeness (EN/FR) for key fields
  const translatablePaths = [
    ['label','text'],
    ['fieldset','legend','text'],
    ['hint','text'],
    ['errorMessage','text'],
    ['titleText'],
    ['summaryText'],
    ['text']
  ];
  components.forEach((c, idx) => {
    const props = c?.props || {};
    translatablePaths.forEach(pathArr => {
      const val = pathArr.reduce((acc,k)=> (acc && acc[k] !== undefined ? acc[k] : undefined), props);
      if (!val) return; // empty/undefined means user may intentionally omit
      if (isI18n(val)) {
        const en = extractLang(val,'en');
        const fr = extractLang(val,'fr');
        if (en && !fr) {
          issues.push({ id: issueId('i18n'), category: 'i18n', severity: 'warning', message: `Missing FR translation for ${pathArr.join('.')}`, componentIndex: idx, componentName: props.name });
        } else if (fr && !en) {
          issues.push({ id: issueId('i18n'), category: 'i18n', severity: 'warning', message: `Missing EN translation for ${pathArr.join('.')}`, componentIndex: idx, componentName: props.name });
        }
      } else if (typeof val === 'string' && val.trim()) {
        // string present but not bilingual
        issues.push({ id: issueId('i18n'), category: 'i18n', severity: 'info', message: `Value at ${pathArr.join('.')} not bilingual (will show same for all languages)`, componentIndex: idx, componentName: props.name });
      }
    });
  });

  // 3. Option list quality: duplicates / empty labels
  components.forEach((c, idx) => {
    const t = String(c?.template_key || c?.type || '').toLowerCase();
    const optionBearing = ['radio','radios','checkbox','checkboxes','select'];
    if (!optionBearing.includes(t)) return;
    const items = Array.isArray(c?.props?.items) ? c.props.items : [];
    const valueCounts = new Map();
    let emptyLabels = 0;
    items.forEach(it => {
      if (!it) return;
      const label = extractLang(it.text,'en');
      const val = (it.value != null ? String(it.value) : '').trim();
      if (!label) emptyLabels += 1;
      if (val) valueCounts.set(val, (valueCounts.get(val)||0)+1);
    });
    const dups = Array.from(valueCounts.entries()).filter(([,c])=>c>1).map(([v])=>v);
    if (dups.length) {
      issues.push({ id: issueId('optdup'), category: 'options', severity: 'error', message: `Duplicate option values: ${dups.join(', ')}`, componentIndex: idx, componentName: c?.props?.name });
    }
    if (emptyLabels>0) {
      issues.push({ id: issueId('optlbl'), category: 'options', severity: 'warning', message: `${emptyLabels} option(s) missing label text`, componentIndex: idx, componentName: c?.props?.name });
    }
  });

  // 4. Accessibility: inputs must have a label or legend
  const inputTypes = new Set(['input','textarea','select','radio','radios','checkbox','checkboxes','date-input','file-upload','character-count','password-input']);
  components.forEach((c, idx) => {
    const t = String(c?.template_key || c?.type || '').toLowerCase();
    if (!inputTypes.has(t)) return;
    const p = c?.props || {};
    const label = p?.label?.text || p?.fieldset?.legend?.text || p?.titleText || p?.text;
    const labelEn = extractLang(label,'en');
    if (!labelEn) {
      issues.push({ id: issueId('a11y'), category: 'accessibility', severity: 'error', message: 'Input missing accessible label/legend text', componentIndex: idx, componentName: p.name });
    }
  });

  // 5. Validation configuration sanity (required without message, pattern invalid, rule duplicates)
  components.forEach((c, idx) => {
    const v = c?.props?.validation;
    if (!v) return;
    if (v.required && !(extractLang(v.requiredMessage,'en'))) {
      issues.push({ id: issueId('val'), category: 'config', severity: 'warning', message: 'Required flag set but EN requiredMessage missing', componentIndex: idx, componentName: c?.props?.name });
    }
    if (Array.isArray(v.rules)) {
      const ruleIds = new Set();
      v.rules.forEach(r => {
        if (!r) return;
        if (r.id && ruleIds.has(r.id)) {
          issues.push({ id: issueId('valdup'), category: 'config', severity: 'info', message: `Duplicate rule id '${r.id}'`, componentIndex: idx, componentName: c?.props?.name });
        }
        if (r.id) ruleIds.add(r.id);
        if (r.pattern) {
          try { new RegExp(r.pattern); } catch (e) { issues.push({ id: issueId('regex'), category: 'config', severity: 'error', message: `Invalid regex in rule '${r.id || 'pattern'}': ${e.message}`, componentIndex: idx, componentName: c?.props?.name }); }
        }
        // Equality predicate literal audit on option-bearing components
        try {
          const t = String(c?.template_key || c?.type || '').toLowerCase();
          const optionBearing = ['radio','radios','checkbox','checkboxes','select'];
          if (optionBearing.includes(t) && r.type === 'predicate' && r.when && typeof r.when === 'object' && Object.keys(r.when).length === 1 && r.when['==']) {
            const arr = r.when['=='];
            if (Array.isArray(arr) && arr.length === 2) {
              const a = arr[0];
              const b = arr[1];
              const compName = c?.props?.name;
              let fieldRef = null; let literal = null;
              if (a && typeof a === 'object' && a.var && typeof b === 'string') { fieldRef = a.var; literal = b; }
              else if (b && typeof b === 'object' && b.var && typeof a === 'string') { fieldRef = b.var; literal = a; }
              if (fieldRef && literal != null && fieldRef === compName) {
                const opts = Array.isArray(c?.props?.items) ? c.props.items : (Array.isArray(c?.props?.options)? c.props.options : []);
                const values = opts.map(o => (o && o.value != null ? String(o.value) : '')).filter(v=>v);
                if (values.length) {
                  const exact = values.includes(literal);
                  const ciMatch = values.find(v => v.toLowerCase() === String(literal).toLowerCase());
                  if (!exact) {
                    if (ciMatch) {
                      issues.push({
                        id: issueId('logic'),
                        category: 'logic',
                        severity: 'error',
                        message: `Rule compares to '${literal}' but option value is '${ciMatch}' (case mismatch)`,
                        suggestion: `Change literal to '${ciMatch}' for consistency`,
                        componentIndex: idx,
                        componentName: compName
                      });
                    } else {
                      issues.push({
                        id: issueId('logic'),
                        category: 'logic',
                        severity: 'error',
                        message: `Rule compares to '${literal}' but no option with that value exists (valid values: ${values.join(', ')})`,
                        suggestion: `Use one of: ${values.join(', ')}`,
                        componentIndex: idx,
                        componentName: compName
                      });
                    }
                  }
                }
              }
            }
          }
        } catch (_) { /* ignore */ }
      });
    }
  });

  // 6. Conditional linkage: ensure conditionalChildId targets exist
  const existingKeys = new Set();
  components.forEach(c => { ['id','templateId','template_id'].forEach(k => { if (c && c[k]) existingKeys.add(String(c[k])); }); if (c?.props?.name) existingKeys.add(String(c.props.name)); });
  components.forEach((c, idx) => {
    const t = String(c?.template_key || c?.type || '').toLowerCase();
    if (!['radio','radios','checkbox','checkboxes'].includes(t)) return;
    const items = Array.isArray(c?.props?.items) ? c.props.items : [];
    items.forEach((it,i) => {
      if (it && it.conditionalChildId && !existingKeys.has(String(it.conditionalChildId))) {
        issues.push({ id: issueId('cond'), category: 'linkage', severity: 'warning', message: `Option ${i+1} references missing conditional child '${it.conditionalChildId}'`, componentIndex: idx, componentName: c?.props?.name });
      }
    });
  });

  // 7. Summary List: if present, ensure configured
  components.forEach((c, idx) => {
    const t = String(c?.template_key || c?.type || '').toLowerCase();
    if (t !== 'summary-list') return;
    const p = c?.props || {};
    if (!p.workflowId) {
      issues.push({ id: issueId('summary'), category: 'config', severity: 'info', message: 'Summary list has no workflow selected (placeholder rows will be used)', componentIndex: idx, componentName: p.name });
    } else if (!Array.isArray(p.included) || p.included.length === 0) {
      issues.push({ id: issueId('summary'), category: 'config', severity: 'warning', message: 'Summary list workflow selected but no fields included', componentIndex: idx, componentName: p.name });
    }
  });

  // 8. Page name / status sanity
  if (!step.name || !String(step.name).trim()) {
    issues.push({ id: issueId('stepname'), category: 'structure', severity: 'error', message: 'Step name is blank' });
  }
  if (!['active','inactive','active'.toUpperCase(),'Inactive','Active'].includes(step.status)) {
    issues.push({ id: issueId('status'), category: 'structure', severity: 'info', message: `Unexpected status '${step.status}'` });
  }

  // Sort issues: error > warning > info; then category
  const order = { error:0, warning:1, info:2 };
  issues.sort((a,b)=> (order[a.severity]-order[b.severity]) || a.category.localeCompare(b.category));
  return issues;
}

export function summarizeIssues(issues) {
  const acc = { error:0, warning:0, info:0 };
  (issues||[]).forEach(i => { if (acc[i.severity] != null) acc[i.severity]+=1; });
  return acc;
}

export default validateStep;
