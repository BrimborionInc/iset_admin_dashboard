// Workflow normalization logic extracted from publish endpoint.
// Converts DB workflow + steps + components into portal schema shape.
// Options:
//   auditTemplates: boolean (default false) - run Nunjucks render audit of templates
//   schemaVersion: string (default '1.1')
// Returns { steps, meta, templates: { counts, metaMap }, raw: { usedTemplateIds } }

const path = require('path');
const fs = require('fs');
const nunjucks = require('nunjucks');
const { SUPPORTED_COMPONENT_TYPES } = require('./constants');

// Local nunjucks env (fallback to default if already configured elsewhere)
let env;
try {
  env = nunjucks.configure([
    path.join(__dirname, '..', '..', 'node_modules/govuk-frontend/dist'),
    path.join(__dirname, '..', '..', 'node_modules/govuk-frontend')
  ], { autoescape: true, noCache: true });
} catch (_) {
  env = nunjucks; // reuse global
}

function safeParse(v, fallback) {
  if (v == null) return fallback;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}


function toI18nObject(raw, fallback) {
  if (!raw) {
    if (!fallback) return undefined;
    if (typeof fallback === 'string') return { en: fallback, fr: fallback };
    if (typeof fallback === 'object') {
      const en = typeof fallback.en === 'string' ? fallback.en : (typeof fallback.fr === 'string' ? fallback.fr : '');
      const fr = typeof fallback.fr === 'string' ? fallback.fr : (typeof fallback.en === 'string' ? fallback.en : en);
      return en || fr ? { en, fr } : undefined;
    }
    return undefined;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    return { en: trimmed, fr: trimmed };
  }
  if (typeof raw === 'object') {
    if (typeof raw.text !== 'undefined') return toI18nObject(raw.text, fallback);
    const en = typeof raw.en === 'string' && raw.en.trim() ? raw.en.trim() : undefined;
    const fr = typeof raw.fr === 'string' && raw.fr.trim() ? raw.fr.trim() : undefined;
    if (en || fr) {
      return { en: en || fr || '', fr: fr || en || '' };
    }
  }
  const str = String(raw).trim();
  if (!str) return toI18nObject(fallback, undefined);
  return { en: str, fr: str };
}

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b ?? a;
}

function toIdSlug(label, type, index, used) {
  const base = (String(label || `${type}-${index+1}`) || 'field').toLowerCase().normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `${type}-${index+1}`;
  let cand = base || `${type}-${index+1}`;
  let i = 2;
  while (used.has(cand)) { cand = `${base}-${i++}`; }
  used.add(cand);
  return cand;
}

function inferNormalize(tplType, props, options) {
  const tRaw = String(tplType || '').toLowerCase();
  const t = (tRaw === 'checkbox' ? 'checkboxes' : (tRaw === 'radios' ? 'radio' : tRaw));
  if (t === 'date' || t === 'date-input') return 'date-iso';
  if (t === 'number') return 'number';
  if (t === 'input') {
    const it = String(props?.type || '').toLowerCase();
    if (it === 'number') return 'number';
    if (it === 'email') return 'trim';
    return 'trim';
  }
  if (t === 'textarea' || t === 'text') return 'trim';
  if ((t === 'radio' || t === 'select') && Array.isArray(options) && options.length) {
    // Relaxed inference: do NOT coerce numeric-looking radio/select values to 'number' automatically.
    // Reason: numeric normalization caused predicate comparisons ("1" vs 1) to mismatch when authoring expects string values.
    // Only infer yes/no normalization shortcut.
    const lc = options.map(o => String(o.value).toLowerCase());
    const allYN = lc.every(v => v === 'yes' || v === 'no' || v === 'true' || v === 'false');
    if (allYN) return 'yn-01';
    return 'none';
  }
  return 'none';
}

function slugify(s) {
  return (String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')) || '';
}

// Primary builder
async function buildWorkflowSchema({ pool, workflowId, auditTemplates = false, schemaVersion = '1.1' }) {
  // Load workflow
  const [[wf]] = await pool.query(`SELECT id, name, status FROM iset_intake.workflow WHERE id = ?`, [workflowId]);
  if (!wf) throw Object.assign(new Error('Workflow not found'), { code: 404 });

  const [stepRows] = await pool.query(`
    SELECT s.id AS step_id, s.name AS step_name, ws.is_start
    FROM iset_intake.workflow_step ws
    JOIN iset_intake.step s ON s.id = ws.step_id
    WHERE ws.workflow_id = ?
  `, [workflowId]);

  const [routeRows] = await pool.query(`
    SELECT workflow_id, source_step_id, mode, field_key, default_next_step_id
    FROM iset_intake.workflow_route WHERE workflow_id = ?
  `, [workflowId]);
  const [optRows] = await pool.query(`
    SELECT workflow_id, source_step_id, option_value, next_step_id
    FROM iset_intake.workflow_route_option WHERE workflow_id = ?
  `, [workflowId]);

  // Route map
  const bySrc = new Map();
  for (const r of routeRows) bySrc.set(r.source_step_id, { ...r, options: [] });
  for (const o of optRows) {
    const r = bySrc.get(o.source_step_id) || { options: [] };
    r.options = r.options || [];
    r.options.push({ option_value: String(o.option_value), next_step_id: o.next_step_id });
    bySrc.set(o.source_step_id, r);
  }

  // Step slug generation
  const slugCounts = new Map();
  const slugMap = new Map();
  function toSlug(name) {
    const base = String(name || 'step').toLowerCase().normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'step';
    const cnt = (slugCounts.get(base) || 0) + 1;
    slugCounts.set(base, cnt);
    return cnt === 1 ? base : `${base}-${cnt}`;
  }
  for (const s of stepRows) slugMap.set(s.step_id, toSlug(s.step_name));

  // BFS ordering
  const idSet = new Set(stepRows.map(s => s.step_id));
  const start = stepRows.find(s => s.is_start) || stepRows[0] || null;
  const adj = new Map();
  for (const s of stepRows) adj.set(s.step_id, []);
  for (const r of routeRows) {
    if (r.mode === 'linear' && r.default_next_step_id && idSet.has(r.default_next_step_id)) {
      adj.get(r.source_step_id)?.push(r.default_next_step_id);
    } else if (r.mode === 'by_option') {
      const opts = (bySrc.get(r.source_step_id)?.options) || [];
      for (const o of opts) if (idSet.has(o.next_step_id)) adj.get(r.source_step_id)?.push(o.next_step_id);
      if (r.default_next_step_id && idSet.has(r.default_next_step_id)) adj.get(r.source_step_id)?.push(r.default_next_step_id);
    }
  }
  const order = [];
  const seen = new Set();
  if (start) {
    const q = [start.step_id];
    seen.add(start.step_id);
    while (q.length) {
      const u = q.shift();
      order.push(u);
      for (const v of adj.get(u) || []) if (!seen.has(v)) { seen.add(v); q.push(v); }
    }
  }
  for (const s of stepRows) if (!seen.has(s.step_id)) order.push(s.step_id);

  const stepsOut = [];
  const usedTemplateIds = new Set();
  const usedTemplateCounts = new Map();
  const usedTemplateMeta = new Map();
  const placeholderNames = new Set(['example-radio', 'first-name', 'last-name', 'input', 'text-input', 'field', 'checkboxes', 'radio']);
  // Global alias -> storageKey map so summary-list rows referencing original authoring keys (id/name)
  // still resolve after normalization may have substituted a slug.
  const aliasToStorageKey = new Map();

  for (const stepId of order) {
    const row = stepRows.find(s => s.step_id === stepId);
    const route = bySrc.get(stepId) || null;
    const stepSlug = slugMap.get(stepId);
    const out = {
      stepId: stepSlug,
      type: 'schema',
      title: { en: row?.step_name || 'Step', fr: row?.step_name || 'Step' },
      description: { en: '', fr: '' },
      components: []
    };

    if (route) {
      if (route.mode === 'linear') {
        if (route.default_next_step_id && slugMap.get(route.default_next_step_id)) {
          out.nextStepId = slugMap.get(route.default_next_step_id);
        }
      } else if (route.mode === 'by_option') {
        const rules = [];
        for (const o of (route.options || [])) {
          const tgt = slugMap.get(o.next_step_id);
            if (!tgt) continue;
            rules.push({
              condition: { '==': [ { var: route.field_key || '' }, String(o.option_value) ] },
              nextStepId: tgt
            });
        }
        if (rules.length) out.branching = rules;
        if (route.default_next_step_id && slugMap.get(route.default_next_step_id)) {
          out.defaultNextStepId = slugMap.get(route.default_next_step_id);
        }
      }
    }

    // components for step
    const [compRows] = await pool.query(
      `SELECT sc.position, ct.id AS template_id, ct.version AS template_version, ct.type AS tpl_type, ct.default_props, sc.props_overrides, ct.template_key
         FROM iset_intake.step_component sc
         JOIN iset_intake.component_template ct ON ct.id = sc.template_id
        WHERE sc.step_id = ?
        ORDER BY sc.position`,
      [stepId]
    );
    const usedIds = new Set();
  // Track original authoring props.id -> component index for conditional embedding
  const authoringIdIndex = new Map();
  // Track which component indices become embedded children (to prune later)
  const consumedChildIndices = new Set();
    for (let i = 0; i < compRows.length; i++) {
      const c = compRows[i];
      const defaults = safeParse(c.default_props, {});
      const overrides = safeParse(c.props_overrides, {});
      const props = deepMerge(defaults || {}, overrides || {});
      const tplType = (c.tpl_type || '').toLowerCase();

      usedTemplateIds.add(c.template_id);
      const tKey = c.template_key || 'unknown';
      const tVer = Number(c.template_version) || 0;
      const k = `${tKey}@${tVer}`;
      const cnt = (usedTemplateCounts.get(k) || 0) + 1;
      usedTemplateCounts.set(k, cnt);
      usedTemplateMeta.set(k, { id: c.template_id, template_key: tKey, version: tVer, type: tplType });

      const candidateTypes = new Set([
        tplType,
        tplType === 'checkbox' ? 'checkboxes' : null,
        tplType === 'radios' ? 'radio' : null,
        tplType === 'date' ? 'date-input' : null,
      ].filter(Boolean));
      const isSupported = Array.from(candidateTypes).some(t => SUPPORTED_COMPONENT_TYPES.has(t));
      if (!isSupported) {
        const reason = `Unsupported component type: '${tplType}' (template_key=${c.template_key || 'n/a'})`;
        const err = new Error(reason);
        err.code = 400;
        err.details = { step: row?.step_name, step_id: stepId, position: i + 1, template_key: c.template_key, type: tplType };
        throw err;
      }

      const labelText = props?.fieldset?.legend?.text ?? props?.label?.text ?? props?.titleText ?? '';
      const hintText = props?.hint?.text ?? props?.text ?? '';
      const asLang = (v, lang) => {
        if (v && typeof v === 'object') {
          const val = v[lang] ?? v.en ?? v.fr;
          return typeof val === 'string' ? val : (val == null ? '' : String(val));
        }
        return v == null ? '' : String(v);
      };
      const labelEn = asLang(labelText, 'en');
      const labelFr = asLang(labelText, 'fr') || labelEn;
      const hintEn = asLang(hintText, 'en');
      const hintFr = asLang(hintText, 'fr') || hintEn;

      let options = null;
      if (['radio','radios','checkbox','checkboxes','select'].includes(tplType)) {
        const items = Array.isArray(props?.items) ? props.items : [];
        options = items.map(it => ({
          label: it?.text ?? it?.html ?? String(it?.value ?? ''),
          value: typeof it?.value !== 'undefined' ? it.value : (it?.text ?? it?.html ?? '')
        }));
      }

  // Derive a stable slug from the resolved (English) label text; avoid using raw object -> '[object Object]'
  let labelSlugBase = labelEn && typeof labelEn === 'string' && labelEn.trim() ? labelEn : '';
  if (!labelSlugBase) labelSlugBase = (typeof labelText === 'string' ? labelText : '') || `${tplType || 'field'}-${i+1}`;
  let labelSlug = slugify(labelSlugBase) || `${tplType || 'field'}-${i+1}`;
  if (labelSlug === 'object-object') labelSlug = `${tplType || 'field'}-${i+1}`;
      const routeField = route && route.mode === 'by_option' ? (route.field_key || '').trim() : '';
      const fieldNameProp = (props?.fieldName || props?.field_name || props?.fieldname || '').toString().trim();
      const nameProp = (props?.name || '').toString().trim();
      const idProp = (props?.id || '').toString().trim();
      let chosenKey = '';
      if (routeField) chosenKey = routeField; else if (fieldNameProp) chosenKey = fieldNameProp; else if (nameProp) chosenKey = nameProp; else if (idProp && !placeholderNames.has(idProp.toLowerCase())) chosenKey = idProp; else chosenKey = labelSlug;
      if (!chosenKey || placeholderNames.has(chosenKey.toLowerCase())) chosenKey = labelSlug;
      const id = toIdSlug(chosenKey || labelSlug, tplType || 'field', i, usedIds);

      // Content only components
      if (tplType === 'paragraph' || c.template_key === 'text-block') {
        const paraText = props?.text ?? labelText ?? '';
        stepsOut.push; // no-op keep linter calm
        out.components.push({
          id: toIdSlug('paragraph', 'paragraph', i, usedIds),
          type: 'paragraph',
          text: { en: asLang(paraText, 'en'), fr: asLang(paraText, 'fr') },
          class: props?.classes || undefined,
        });
        continue;
      }
      if (tplType === 'inset-text') {
        const txt = props?.text ?? hintText ?? labelText ?? '';
        out.components.push({
          id: toIdSlug('inset-text', 'inset-text', i, usedIds),
          type: 'inset-text',
          text: { en: asLang(txt, 'en'), fr: asLang(txt, 'fr') },
        });
        continue;
      }
      if (tplType === 'warning-text') {
        const txt = props?.text ?? hintText ?? labelText ?? '';
        out.components.push({
          id: toIdSlug('warning-text', 'warning-text', i, usedIds),
          type: 'warning-text',
          text: { en: asLang(txt, 'en'), fr: asLang(txt, 'fr') },
        });
        continue;
      }

      if (tplType === 'summary-list') {
        const included = Array.isArray(props?.included) ? props.included : [];
        const rows = [];
        const priorIndex = new Map();
        for (const pc of out.components) if (pc && pc.storageKey) priorIndex.set(pc.storageKey, pc);
        for (const r of included) {
          if (!r || !r.key) continue;
          const resolvedKey = aliasToStorageKey.get(r.key) || r.key;
          const source = priorIndex.get(resolvedKey) || priorIndex.get(r.key);
          // Prefer explicit override, then snapshot labelEn/labelFr, then source label, then key
          let baseLabel = source?.label || null;
          if (!baseLabel) {
            if (r.labelEn || r.labelFr) {
              baseLabel = { en: r.labelEn || r.labelFr || r.key, fr: r.labelFr || r.labelEn || r.key };
            } else {
              baseLabel = { en: r.key, fr: r.key };
            }
          }
          const finalLabel = (r.labelOverride && typeof r.labelOverride === 'object') ? {
            en: r.labelOverride.en || baseLabel.en || r.key,
            fr: r.labelOverride.fr || r.labelOverride.en || baseLabel.fr || baseLabel.en || r.key
          } : baseLabel;
          const rowObj = { key: resolvedKey, label: finalLabel };
          if (resolvedKey !== r.key) rowObj.originalKey = r.key;
          rows.push(rowObj);
        }
        out.components.push({
          id: toIdSlug('summary-list', 'summary-list', i, usedIds),
          type: 'summary-list',
          rows,
          hideEmpty: props.hideEmpty !== false,
          emptyFallback: (props.emptyFallback && typeof props.emptyFallback === 'object') ? props.emptyFallback : { en: 'Not provided', fr: 'Non fourni' }
        });
        continue;
      }

      const normalisedType = (tplType === 'checkbox' ? 'checkboxes' : tplType === 'radios' ? 'radio' : tplType);
      const component = {
        id,
        type: normalisedType,
        label: { en: labelEn || id, fr: labelFr || labelEn || id },
        hint: (hintEn || hintFr) ? { en: hintEn, fr: hintFr } : undefined,
        class: props?.classes || undefined,
        required: !!(props?.validation && typeof props.validation === 'object' ? props.validation.required : props?.required),
        storageKey: chosenKey || id,
      };
      if (props?.label?.classes) component.labelClass = String(props.label.classes).trim();
      if (props?.fieldset?.legend?.classes) component.legendClass = String(props.fieldset.legend.classes).trim();
      if (tplType === 'character-count') {
        const ml = props?.maxlength ?? props?.maxLength; if (ml!==undefined && ml!==null && ml!=='') { const n=Number(ml); if(!isNaN(n)&&n>0) component.maxLength=n; }
        const th = props?.threshold; if (th!==undefined && th!==null && th!=='') { const n=Number(th); if(!isNaN(n)&&n>=0) component.threshold=n; }
        const rowsVal = props?.rows; if (rowsVal!==undefined && rowsVal!==null && rowsVal!=='') { const n=Number(rowsVal); if(!isNaN(n)&&n>0) component.rows=n; }
      }
      if (tplType === 'input') {
        if (props?.type) component.inputType = props.type;
        if (props?.autocomplete) component.autocomplete = props.autocomplete;
        if (props?.inputmode || props?.inputMode) component.inputMode = props.inputmode || props.inputMode;
        if (props?.pattern) component.pattern = props.pattern;
        if (typeof props?.spellcheck !== 'undefined') component.spellcheck = !!props.spellcheck;
        if (typeof props?.disabled !== 'undefined') component.disabled = !!props.disabled;
        if (props?.prefix && (props.prefix.text || props.prefix.html)) component.prefix = { text: props.prefix.text || props.prefix.html, classes: props.prefix.classes || undefined };
        if (props?.suffix && (props.suffix.text || props.suffix.html)) component.suffix = { text: props.suffix.text || props.suffix.html, classes: props.suffix.classes || undefined };
        if (props?.describedBy || props?.describedby) component.extraDescribedBy = String(props.describedBy || props.describedby);
        if (props?.formGroup?.classes) component.formGroupClass = props.formGroup.classes;
        // Preserve input masking directive if provided (authoring stores as props.mask)
        if (props?.mask) {
          const rawMask = String(props.mask).trim();
          if (rawMask) {
            // Allow only known masks to reduce risk of arbitrary injection
            const allowed = new Set(['phone-na','sin-ca','sin','postal-code-ca','postal-code-us','date-iso','time-hm','currency']);
            const lc = rawMask.toLowerCase();
            if (allowed.has(lc)) component.mask = lc === 'sin' ? 'sin-ca' : lc; // normalise alias
            else component.mask = lc; // fallback: still emit for forward compatibility
          }
        } else if (props?.inputMask) { // legacy / alternate key
          component.mask = String(props.inputMask).trim().toLowerCase();
        }
      }
      if (tplType === 'signature-ack') {
        const actionLabel = toI18nObject(props?.actionLabel, 'Sign Now');
        if (actionLabel) component.actionLabel = actionLabel;
        const clearLabel = toI18nObject(props?.clearLabel, 'Clear');
        if (clearLabel) component.clearLabel = clearLabel;
        const placeholder = toI18nObject(props?.placeholder, 'Type your full name');
        if (placeholder) component.placeholder = placeholder;
        const signedText = toI18nObject(props?.statusSignedText, 'Signed');
        if (signedText) component.statusSignedText = signedText;
        const unsignedText = toI18nObject(props?.statusUnsignedText, 'Not signed');
        if (unsignedText) component.statusUnsignedText = unsignedText;
        component.boxPadding = String(props?.boxPadding || 'm').toLowerCase();
        if (props?.handwritingFont) component.handwritingFont = String(props.handwritingFont);
        if (props?.formGroup?.classes) component.formGroupClass = String(props.formGroup.classes);
      }

      if (tplType === 'file-upload') {
        if (typeof props?.multiple !== 'undefined') component.multiple = !!props.multiple;
        if (props?.accept) component.accept = String(props.accept);
        if (props?.maxSizeMb != null) {
          const n = Number(props.maxSizeMb);
          if (!isNaN(n) && n > 0) component.maxSizeMb = n;
        }
        if (props?.documentType) component.documentType = String(props.documentType);
        if (typeof props?.showMimeList !== 'undefined') component.showMimeList = !!props.showMimeList;
        if (typeof props?.showMaxSize !== 'undefined') component.showMaxSize = !!props.showMaxSize;
        if (typeof props?.disabled !== 'undefined') component.disabled = !!props.disabled;
        // Conditional visibility (v1): emit props.conditions if present and structurally valid ({ all: [] })
        try {
          const conds = props && props.conditions;
          if (conds && typeof conds === 'object' && Array.isArray(conds.all) && conds.all.length) {
            const sanitized = conds.all
              .filter(r => r && typeof r === 'object' && r.ref && r.op)
              .map(r => {
                const out = { ref: String(r.ref), op: String(r.op) };
                if (!['exists','notExists'].includes(r.op) && r.value !== undefined && r.value !== null && r.value !== '') out.value = String(r.value);
                return out;
              });
            if (sanitized.length) component.conditions = { all: sanitized };
          }
        } catch { /* swallow condition extraction errors */ }
      }
      if (tplType === 'date-input') {
        if (props?.namePrefix) component.namePrefix = props.namePrefix;
        if (Array.isArray(props?.items)) component.dateFields = props.items.map(f => ({ name: f?.name, classes: f?.classes })).filter(f => f.name);
      }
      if (options) {
        const srcItems = Array.isArray(props?.items) ? props.items : [];
        component.options = options.map((o, idx) => {
          const src = srcItems[idx] || {};
          const opt = src && src.id ? { ...o, id: String(src.id) } : { ...o };
          if (src.conditionalChildId) opt.conditionalChildId = String(src.conditionalChildId);
          if (src.hint && typeof src.hint === 'object') {
            // Preserve per-option hint if provided (parallel to label text)
            const h = src.hint.text || src.hint.html || src.hint;
            if (h) opt.hint = h;
          }
            return opt;
        });
      }
      if (['radio','radios','checkbox','checkboxes'].includes(tplType) && props) {
        if (props.name) component.name = String(props.name);
        if (props.idPrefix || props.id_prefix) component.idPrefix = String(props.idPrefix || props.id_prefix);
      }
      const inferred = inferNormalize(tplType, props, options || []);
      component.normalize = component.normalize && component.normalize !== 'none' ? component.normalize : inferred;

      if (props?.validation && typeof props.validation === 'object') {
        const v = props.validation;
        // Normalise rules per updated validation model (post step-level removal).
        // - Drop any malformed entries (non-object)
        // - Drop predicate rules lacking a 'when' clause (legacy editor created these for required)
        // - Preserve only recognised fields for each rule type
        const safeRules = Array.isArray(v.rules)
          ? v.rules
              .filter(r => r && typeof r === 'object')
              .map(r => {
                const type = r.type || r.kind || undefined;
                if (type === 'predicate' && !r.when) {
                  // Legacy required placeholder; skip (required flag handled separately)
                  return null;
                }
                const out = {
                  id: r.id,
                  type,
                  trigger: Array.isArray(r.trigger) ? r.trigger : (r.trigger ? [r.trigger] : undefined),
                  message: r.message,
                  severity: r.severity,
                  block: r.block !== false
                };
                if (type === 'pattern' && r.pattern) { out.pattern = r.pattern; if (r.flags) out.flags = r.flags; }
                if (type === 'length') { if (r.minLength != null) out.minLength = r.minLength; if (r.maxLength != null) out.maxLength = r.maxLength; }
                if (type === 'range') { if (r.min != null) out.min = r.min; if (r.max != null) out.max = r.max; }
                if (type === 'predicate' && r.when) out.when = r.when;
                if (type === 'atLeastOne' && Array.isArray(r.fields)) out.fields = r.fields;
                if (type === 'compare') { out.left = r.left; out.right = r.right; out.op = r.op; }
                return out;
              })
              .filter(r => r && r.type) // prune nulls / empty
          : undefined;
        const validationOut = {
          required: typeof v.required === 'boolean' ? v.required : undefined,
          requiredMessage: (v.requiredMessage && typeof v.requiredMessage === 'object') ? v.requiredMessage : undefined,
          errorMessage: (v.errorMessage && typeof v.errorMessage === 'object') ? v.errorMessage : undefined,
          rules: safeRules && safeRules.length ? safeRules : undefined
        };
        // Promote errorMessage -> requiredMessage if required true and no dedicated requiredMessage provided
        if (!validationOut.requiredMessage && validationOut.required && validationOut.errorMessage) {
          validationOut.requiredMessage = validationOut.errorMessage;
        }
        // If field not required, drop stray requiredMessage to avoid confusion
        if (!validationOut.required && validationOut.requiredMessage) delete validationOut.requiredMessage;
        // Remove empty container if nothing meaningful remains
        const hasContent = (
          validationOut.required === true ||
          (validationOut.requiredMessage && Object.keys(validationOut.requiredMessage).length) ||
          (validationOut.rules && validationOut.rules.length)
        );
        if (hasContent) component.validation = validationOut;
        if (typeof v.required === 'boolean' && v.required && !component.required) component.required = true;
      }

      out.components.push(component);
      // Register alias mappings (original authoring identifiers) -> final storageKey
      try {
        const aliases = new Set();
        if (idProp) aliases.add(idProp);
        if (nameProp) aliases.add(nameProp);
        if (fieldNameProp) aliases.add(fieldNameProp);
        aliases.add(labelSlug); // label-derived slug used earlier; harmless if same
        for (const a of aliases) {
          if (!a) continue;
          if (!aliasToStorageKey.has(a)) aliasToStorageKey.set(a, component.storageKey);
        }
        // Always map storageKey to itself
        if (component.storageKey && !aliasToStorageKey.has(component.storageKey)) aliasToStorageKey.set(component.storageKey, component.storageKey);
      } catch { /* ignore alias registration errors */ }
      // Record mapping from authoring identifiers to component index for later conditional embedding
      if (props) {
        const origId = props.id != null ? String(props.id).trim() : '';
        if (origId) authoringIdIndex.set(origId, out.components.length - 1);
        // Also index by props.name (data key) because conditionalChildId currently stores the data key, not the DOM id
        const nameKey = props.name != null ? String(props.name).trim() : '';
        if (nameKey && !authoringIdIndex.has(nameKey)) {
          authoringIdIndex.set(nameKey, out.components.length - 1);
        }
      }
    }

    // Second pass: embed conditional children for radios / checkboxes
    for (let pIdx = 0; pIdx < out.components.length; pIdx++) {
      const parent = out.components[pIdx];
      if (!parent || !Array.isArray(parent.options)) continue;
      // Only process choice components
      if (!(parent.type === 'radio' || parent.type === 'checkboxes')) continue;
      for (const opt of parent.options) {
        if (!opt || !opt.conditionalChildId) continue;
        const targetId = String(opt.conditionalChildId).trim();
        if (!targetId) continue;
        const childIdx = authoringIdIndex.get(targetId);
        if (childIdx == null) continue; // no matching component
        if (childIdx === pIdx) continue; // safety: don't embed self
        const childComp = out.components[childIdx];
        if (!childComp || consumedChildIndices.has(childIdx)) continue; // already consumed elsewhere
        // Attach as option.children (array) for renderer compatibility
        if (!Array.isArray(opt.children)) opt.children = [];
        opt.children.push(childComp);
        // Mark child for removal from top-level components list
        consumedChildIndices.add(childIdx);
        // Remove the marker field to simplify published schema (renderer only needs nested children)
        delete opt.conditionalChildId;
      }
    }
    if (consumedChildIndices.size) {
      // Rebuild components array without consumed children
      out.components = out.components.filter((_, idx) => !consumedChildIndices.has(idx));
    }
    stepsOut.push(out);
  }

  // Optional template audit (render compile test)
  if (auditTemplates && usedTemplateIds.size) {
    const ids = Array.from(usedTemplateIds);
    const [tpls] = await pool.query(
      `SELECT id, template_key, version, type, export_njk_template, default_props, status
         FROM iset_intake.component_template
        WHERE id IN (${Array(ids.length).fill('?').join(',')})`,
      ids
    );
    const bad = [];
    for (const r of tpls) {
      if (!r.export_njk_template || !String(r.export_njk_template).trim()) {
        bad.push({ template_key: r.template_key, version: r.version, reason: 'MISSING_TEMPLATE' });
        continue;
      }
      try {
        const p = typeof r.default_props === 'string' ? JSON.parse(r.default_props) : (r.default_props || {});
        env.renderString(r.export_njk_template, { props: p });
      } catch (e) {
        bad.push({ template_key: r.template_key, version: r.version, reason: 'RENDER_ERROR', detail: String(e.message || e).slice(0, 200) });
      }
    }
    if (bad.length) {
      const err = new Error('Template audit failed');
      err.code = 400; err.details = { templates: bad }; throw err;
    }
  }

  const templates = Array.from(usedTemplateCounts.keys()).map(k => ({
    ...(usedTemplateMeta.get(k) || {}),
    count: usedTemplateCounts.get(k) || 0,
  }));
  const meta = {
    schemaVersion,
    generatedAt: new Date().toISOString(),
    workflow: { id: wf.id, name: wf.name, status: wf.status },
    counts: {
      steps: stepsOut.length,
      components: stepsOut.reduce((acc, s) => acc + (Array.isArray(s.components) ? s.components.length : 0), 0)
    },
    templates
  };

  return { steps: stepsOut, meta, templates: { counts: usedTemplateCounts, metaMap: usedTemplateMeta }, raw: { usedTemplateIds } };
}

module.exports = { buildWorkflowSchema };
