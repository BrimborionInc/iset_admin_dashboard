// Shared helpers for the Modify Workflow editor widgets

export function nextStepId(steps) {
  let max = 0;
  for (const s of steps) {
    const m = /^S(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `S${max + 1}`;
}

export function deepCloneRouting(r) {
  if (!r) return r;
  if (r.mode === 'byOption') {
    return { mode: 'byOption', fieldKey: r.fieldKey, options: [...(r.options || [])], mapping: { ...(r.mapping || {}) }, defaultNext: r.defaultNext };
  }
  return { mode: 'linear', next: r.next };
}

export function removeStepAndRewire(prevSteps, deletedId) {
  const steps = prevSteps.map(s => ({ ...s, routing: deepCloneRouting(s.routing) }));
  const deleted = steps.find(s => s.id === deletedId);
  if (!deleted) return steps;
  const fallback = (deleted.routing?.mode === 'linear' && deleted.routing.next)
    || (deleted.routing?.mode === 'byOption' && deleted.routing.defaultNext)
    || undefined;
  for (const s of steps) {
    const r = s.routing || {};
    if (r.mode === 'linear') {
      if (r.next === deletedId) r.next = fallback;
    } else if (r.mode === 'byOption') {
      if (r.defaultNext === deletedId) r.defaultNext = fallback;
      if (r.mapping) {
        for (const k of Object.keys(r.mapping)) {
          if (r.mapping[k] === deletedId) {
            if (fallback) r.mapping[k] = fallback; else delete r.mapping[k];
          }
        }
      }
    }
  }
  return steps.filter(s => s.id !== deletedId);
}

export function validateWorkflow(steps) {
  const ids = new Set(steps.map(s => s.id));
  const byStep = {};
  const errors = [];
  for (const s of steps) {
    const stepErrors = [];
    const r = s.routing || {};
    if (r.mode === 'linear') {
      if (r.next && !ids.has(r.next)) stepErrors.push(`Next points to missing step "${r.next}"`);
    } else if (r.mode === 'byOption') {
      const options = r.options || [];
      const mapping = r.mapping || {};
      const unmapped = options.filter(o => !mapping[o]);
      if (unmapped.length && !r.defaultNext) stepErrors.push(`Unmapped options: ${unmapped.join(', ')} and no defaultNext`);
      const targets = [...Object.values(mapping), r.defaultNext].filter(Boolean);
      for (const tgt of targets) if (!ids.has(tgt)) stepErrors.push(`Target "${tgt}" does not exist`);
    }
    if (stepErrors.length) {
      byStep[s.id] = { errors: stepErrors };
      errors.push(...stepErrors.map(msg => `${s.name}: ${msg}`));
    }
  }
  return { errors, byStep };
}

export function buildEdgesFromModel(steps) {
  const edges = [];
  for (const step of steps) {
    const r = step.routing || {};
    if (r.mode === 'linear') {
      if (r.next) edges.push({ source: step.id, target: r.next, label: '' });
    } else if (r.mode === 'byOption') {
      const groups = new Map();
      for (const opt of (r.options || [])) {
        const tgt = r.mapping?.[opt] || r.defaultNext;
        if (!tgt) continue;
        if (!groups.has(tgt)) groups.set(tgt, []);
        groups.get(tgt).push(opt);
      }
      for (const [target, opts] of groups) edges.push({ source: step.id, target, label: opts.join(', ') });
    }
  }
  const dedup = new Map();
  edges.forEach((e, i) => {
    const key = `${e.source}->${e.target}`;
    if (!dedup.has(key)) dedup.set(key, { id: `e${i}`, ...e });
    else {
      const prev = dedup.get(key);
      const label = [prev.label, e.label].filter(Boolean).join(', ');
      dedup.set(key, { ...prev, label });
    }
  });
  return [...dedup.values()];
}
