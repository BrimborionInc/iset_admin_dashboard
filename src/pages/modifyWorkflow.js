import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Header, Grid, SpaceBetween, Container, FormField, Select, Button, Input } from '@cloudscape-design/components';
import ReactFlow, { ReactFlowProvider, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

// API base from .env (CRA exposes REACT_APP_* at build time)
const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

// ----- Demo library (left panel fallback if API empty) -----
const sampleBlockSteps = [
  { id: 'lib-1', name: 'Collect Personal Info' },
  { id: 'lib-2', name: 'Programme Type' },
  { id: 'lib-3', name: 'Document Upload' }
];

// Start with an empty workflow canvas
const initialSteps = [];

// ----- Helpers -----
const elk = new ELK();
const NODE_SIZE = { width: 220, height: 90 };

// Compute the bounding box of laid-out nodes (flow coordinates)
function calcBounds(laidOutNodes) {
  if (!laidOutNodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of laidOutNodes) {
    const w = (n.style && n.style.width) || NODE_SIZE.width;
    const h = (n.style && n.style.height) || NODE_SIZE.height;
    const x1 = n.position.x, y1 = n.position.y;
    const x2 = x1 + w, y2 = y1 + h;
    if (x1 < minX) minX = x1; if (y1 < minY) minY = y1;
    if (x2 > maxX) maxX = x2; if (y2 > maxY) maxY = y2;
  }
  return { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

function nextStepId(steps) {
  let max = 0;
  for (const s of steps) {
    const m = /^S(\d+)$/.exec(s.id);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `S${max + 1}`;
}

function deepCloneRouting(r) {
  if (!r) return r;
  if (r.mode === 'byOption') {
    return { mode: 'byOption', fieldKey: r.fieldKey, options: [...(r.options || [])], mapping: { ...(r.mapping || {}) }, defaultNext: r.defaultNext };
  }
  return { mode: 'linear', next: r.next };
}

function removeStepAndRewire(prevSteps, deletedId) {
  const steps = prevSteps.map(s => ({ ...s, routing: deepCloneRouting(s.routing) }));
  const deleted = steps.find(s => s.id === deletedId);
  if (!deleted) return steps;
  const fallback = (deleted.routing?.mode === 'linear' && deleted.routing.next) || (deleted.routing?.mode === 'byOption' && deleted.routing.defaultNext) || undefined;
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

// ----- Validation (minimal v1) -----
function validateWorkflow(steps) {
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

function buildEdgesFromModel(steps) {
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

async function elkLayout(steps, edges) {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '120',
      'elk.spacing.nodeNode': '60',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'ORTHOGONAL'
    },
    children: steps.map(s => ({ id: s.id, width: NODE_SIZE.width, height: NODE_SIZE.height })),
    edges: edges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  };
  const res = await elk.layout(graph);
  const byId = new Map(res.children.map(c => [c.id, c]));
  return {
    nodes: steps.map(s => ({
      id: s.id,
      position: { x: byId.get(s.id)?.x || 0, y: byId.get(s.id)?.y || 0 },
  // carry through referenced DB step id (if any) for properties panel field fetching
  data: { label: s.name, stepId: s.stepId },
      targetPosition: 'top',
      sourcePosition: 'bottom',
      style: { width: NODE_SIZE.width, height: NODE_SIZE.height, border: '1px solid #d5dbdb', borderRadius: 8, background: 'white', padding: 8 }
    })),
    edges: res.edges.map(e => {
      const orig = edges.find(x => x.id === e.id) || {};
      return { id: e.id, source: e.sources[0], target: e.targets[0], label: orig.label || '', type: 'smoothstep', markerEnd: { type: 'arrowclosed' }, labelBgPadding: [4, 2], labelBgBorderRadius: 4, labelBgStyle: { fill: '#ffffff' } };
    })
  };
}

const stepOptionsFrom = (steps, excludeId) => steps.filter(s => s.id !== excludeId).map(s => ({ label: s.name, value: s.id }));
const selectObj = (value, opts) => opts.find(o => o.value === value) || null;

function PropertiesPanel({ steps, selectedId, onChange, onDelete }) {
  const step = steps.find(s => s.id === selectedId) || null;
  const stepOpts = useMemo(() => (step ? stepOptionsFrom(steps, step.id) : []), [steps, step?.id]);
  const routing = step?.routing || { mode: 'linear' };

  // Dynamic field/options from backend step definition (radio/select items)
  const [fieldChoices, setFieldChoices] = useState([]); // [{label,value}]
  const [optionsByField, setOptionsByField] = useState({}); // { fieldKey: [{value,label}] }
  const [labelByValue, setLabelByValue] = useState({}); // { value: label }
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldErr, setFieldErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFieldErr(null);
      setFieldChoices([]); setOptionsByField({}); setLabelByValue({});
      if (!step?.stepId) return; // no DB backing
      try {
        setLoadingFields(true);
        const res = await fetch(`${API_BASE}/api/steps/${step.stepId}`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const choices = [];
        const map = {};
        (data.components || []).forEach(c => {
          const key = (c.props && c.props.name) || null;
          const tkey = c.templateKey || '';
          if (!key) return;
          if (tkey === 'radio' || tkey === 'select') {
            const items = Array.isArray(c.props?.items) ? c.props.items : [];
            const opts = items.map(it => ({ value: String(it?.value ?? ''), label: String(it?.text ?? String(it?.value ?? '')) })).filter(o => o.value.length > 0);
            if (opts.length) { choices.push({ label: key, value: key }); map[key] = opts; }
          }
        });
        if (cancelled) return;
        setFieldChoices(choices);
        setOptionsByField(map);
        if (step && step.routing?.mode === 'byOption') {
          const currentKey = step.routing.fieldKey;
            const useKey = (currentKey && map[currentKey]) ? currentKey : (choices[0]?.value || currentKey);
          if (useKey && (!currentKey || !Array.isArray(step.routing.options))) {
            const newOpts = (map[useKey] || []).map(o => o.value);
            onChange({ ...step, routing: { mode: 'byOption', fieldKey: useKey, options: newOpts, mapping: {}, defaultNext: undefined } });
          }
          const forLabels = (useKey && map[useKey]) ? map[useKey] : [];
          setLabelByValue(Object.fromEntries(forLabels.map(o => [o.value, o.label])));
        }
        setLoadingFields(false);
      } catch (e) {
        if (!cancelled) { setFieldErr(String(e)); setLoadingFields(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [step?.stepId]);

  useEffect(() => {
    if (!step || step.routing?.mode !== 'byOption') return;
    const fk = step.routing.fieldKey;
    if (!fk) { setLabelByValue({}); return; }
    const list = optionsByField[fk] || [];
    setLabelByValue(Object.fromEntries(list.map(o => [o.value, o.label])));
    const values = list.map(o => o.value);
    if (values.length && JSON.stringify(values) !== JSON.stringify(step.routing.options || [])) {
      onChange({ ...step, routing: { ...step.routing, options: values, mapping: {} } });
    }
  }, [optionsByField, step?.routing?.fieldKey]);

  if (!step) return (
    <Box textAlign="center" color="inherit" padding="m">
      <span style={{ color: '#888' }}>[Select a step]</span>
    </Box>
  );
  const setRouting = (newRouting) => onChange({ ...step, routing: newRouting });
  return (
    <SpaceBetween size="s">
      <Container header={<Header variant="h3">{step.name}</Header>}>
        <FormField label="Step title">
          <Input value={step.name} onChange={({ detail }) => onChange({ ...step, name: detail.value })} />
        </FormField>
        <FormField label="Routing mode">
          <Select
            selectedOption={{ label: routing.mode === 'byOption' ? 'By option' : 'Linear', value: routing.mode }}
            onChange={({ detail }) => {
              const mode = detail.selectedOption.value;
              if (mode === 'linear') setRouting({ mode: 'linear', next: undefined });
              else {
                const existing = routing.mode === 'byOption' ? routing : null;
                const firstKey = fieldChoices[0]?.value || existing?.fieldKey || 'optionField';
                const values = (optionsByField[firstKey] || []).map(o => o.value);
                setRouting({
                  mode: 'byOption',
                  fieldKey: firstKey,
                  options: values.length ? values : (existing?.options || []),
                  mapping: existing?.mapping || {},
                  defaultNext: existing?.defaultNext
                });
              }
            }}
            options={[{ label: 'Linear', value: 'linear' }, { label: 'By option', value: 'byOption' }]}
          />
        </FormField>
        {routing.mode === 'linear' && (
          <FormField label="Next step">
            <Select
              placeholder="(none / end)"
              selectedOption={selectObj(routing.next, stepOpts)}
              onChange={({ detail }) => setRouting({ mode: 'linear', next: detail.selectedOption?.value })}
              options={stepOpts}
              filteringType="auto"
            />
          </FormField>
        )}
        {routing.mode === 'byOption' && (
          <SpaceBetween size="s">
            <FormField label="Option field (on this step)">
              <Select
                placeholder={loadingFields ? 'Loading…' : (fieldErr ? 'Failed to load fields' : 'Choose a field')}
                selectedOption={routing.fieldKey ? selectObj(routing.fieldKey, fieldChoices) : null}
                onChange={({ detail }) => {
                  const fk = detail.selectedOption?.value; if (!fk) return;
                  const values = (optionsByField[fk] || []).map(o => o.value);
                  setRouting({ ...routing, fieldKey: fk, options: values, mapping: {} });
                }}
                options={fieldChoices}
                filteringType="auto"
              />
            </FormField>
            <Container header={<Header variant="h4">Option mappings</Header>}>
              <SpaceBetween size="xs">
                {routing.options.map(opt => {
                  const selected = selectObj(routing.mapping?.[opt], stepOpts);
                  return (
                    <FormField key={opt} label={labelByValue[opt] || opt}>
                      <Select
                        placeholder="Choose next step"
                        selectedOption={selected}
                        onChange={({ detail }) => {
                          const next = detail.selectedOption?.value;
                          console.log('[map]', step.id, routing.fieldKey, `${opt} -> ${next}`);
                          setRouting({ ...routing, mapping: { ...(routing.mapping || {}), [opt]: next } });
                        }}
                        options={stepOpts}
                        filteringType="auto"
                      />
                    </FormField>
                  );
                })}
              </SpaceBetween>
            </Container>
            <FormField label="Default next (for unmapped options)">
              <Select
                placeholder="Choose default"
                selectedOption={selectObj(routing.defaultNext, stepOpts)}
                onChange={({ detail }) => setRouting({ ...routing, defaultNext: detail.selectedOption?.value })}
                options={stepOpts}
                filteringType="auto"
              />
            </FormField>
          </SpaceBetween>
        )}
      </Container>
      <Button onClick={() => onDelete(step.id)}>Delete step</Button>
    </SpaceBetween>
  );
}

export default function ModifyWorkflowEditorWidget() {
  const rfWrapRef = useRef(null);
  const [steps, setSteps] = useState(initialSteps);
  const [selectedId, setSelectedId] = useState(null);
  // (removed old fitRAF throttling)
  const [library, setLibrary] = useState([]); // loaded from /api/steps
  const [libStatus, setLibStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'done'
  const edgesModel = useMemo(() => buildEdgesFromModel(steps), [steps]);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [rf, setRf] = useState(null);
  // Fit logic: wait for container size to stabilise before fitting
  const needFitRef = useRef(false);
  const fitTimerRef = useRef(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  // Validation state
  const validation = useMemo(() => validateWorkflow(steps), [steps]);

  // Mirror validation into node className
  useEffect(() => {
    setNodes(ns => ns.map(n => {
      const hasError = !!validation.byStep[n.id]?.errors?.length;
      return { ...n, className: hasError ? 'node-error' : undefined };
    }));
  }, [validation.byStep, setNodes]);

  useEffect(() => { setNodes(ns => ns.map(n => ({ ...n, selected: n.id === selectedId }))); }, [selectedId, setNodes]);

  // Layout on structure change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { nodes: laidOutNodes, edges: laidOutEdges } = await elkLayout(steps, edgesModel);
      if (!cancelled) {
        const withSel = laidOutNodes.map(n => ({ ...n, selected: n.id === selectedId }));
        setNodes(withSel);
        setEdges(laidOutEdges);
        // request a fit once the wrapper has settled
        needFitRef.current = true;
        // small debounce in case multiple changes batch together
        if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
        fitTimerRef.current = setTimeout(() => {
          fitTimerRef.current = 0;
            if (needFitRef.current && rf && nodes.length + laidOutNodes.length >= 0) {
            try { rf.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
            needFitRef.current = false;
          }
        }, 120);
      }
    })();
    return () => { cancelled = true; };
  }, [steps, edgesModel, setNodes, setEdges, rf, selectedId]);

  // Observe container resizes; when width/height change, re-fit after a brief idle
  useEffect(() => {
    const el = rfWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.round(cr.width), h = Math.round(cr.height);
      if (w === 0 || h === 0) return;
      if (w !== sizeRef.current.w || h !== sizeRef.current.h) {
        sizeRef.current = { w, h };
        needFitRef.current = true;
        if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
        fitTimerRef.current = setTimeout(() => {
          fitTimerRef.current = 0;
          if (needFitRef.current && rf) {
            try { rf.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
            needFitRef.current = false;
          }
        }, 120);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [rf]);
  // Log RF container size once (avoid spam on every render)
  useEffect(() => {
    const el = rfWrapRef.current;
    if (el) console.log('RF wrapper size:', el.clientWidth, el.clientHeight);
  }, []);

  // Keyboard affordance: Esc clears selection
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Load Step Library from API (/api/steps)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLibStatus('loading');
        const res = await fetch(`${API_BASE}/api/steps`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (cancelled) return;
  const items = rows.map(r => ({ id: `step-${r.id}`, stepId: r.id, name: r.name }));
        setLibrary(items);
        setLibStatus('done');
      } catch (e) {
        console.error('library fetch failed', e);
        if (!cancelled) setLibStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addFromLibrary = useCallback((lib) => {
    setSteps(prev => {
      const newId = nextStepId(prev);
      const newStep = { id: newId, name: lib.name, stepId: lib.stepId, routing: { mode: 'linear' } };
      const copy = prev.map(s => ({ ...s, routing: deepCloneRouting(s.routing) }));
      if (selectedId) {
        const idx = copy.findIndex(s => s.id === selectedId);
        if (idx !== -1) {
          const sel = copy[idx];
          if (sel.routing?.mode === 'linear') {
            const oldNext = sel.routing.next || undefined;
            sel.routing.next = newId;
            if (oldNext) newStep.routing.next = oldNext;
            const out = [...copy.slice(0, idx + 1), newStep, ...copy.slice(idx + 1)];
            setSelectedId(newId);
            return out;
          }
        }
      }
      const last = copy[copy.length - 1];
      if (last?.routing?.mode === 'linear' && !last.routing.next) last.routing.next = newId;
      setSelectedId(newId);
      return [...copy, newStep];
    });
  }, [selectedId]);

  const updateStep = useCallback((updated) => { setSteps(prev => prev.map(s => (s.id === updated.id ? updated : s))); }, []);
  const deleteStep = useCallback((id) => { setSteps(prev => removeStepAndRewire(prev, id)); setSelectedId(curr => (curr === id ? null : curr)); }, []);

  // --- Toolbar actions ---
  const fit = useCallback(() => { if (rf) rf.fitView({ padding: 0.2, includeHiddenNodes: true }); }, [rf]);

  const appendStep = useCallback(() => {
    setSteps(prev => {
      const newId = nextStepId(prev);
      const newStep = { id: newId, name: 'New Step', routing: { mode: 'linear' } };
      const copy = prev.map(s => ({ ...s, routing: deepCloneRouting(s.routing) }));
      const last = copy[copy.length - 1];
      if (last?.routing?.mode === 'linear' && !last.routing.next) last.routing.next = newId;
      setSelectedId(newId);
      return [...copy, newStep];
    });
  }, []);

  const insertAfterSelected = useCallback(() => {
    if (!selectedId) return appendStep();
    setSteps(prev => {
      const newId = nextStepId(prev);
      const newStep = { id: newId, name: 'New Step', routing: { mode: 'linear' } };
      const copy = prev.map(s => ({ ...s, routing: deepCloneRouting(s.routing) }));
      const idx = copy.findIndex(s => s.id === selectedId);
      if (idx === -1) return copy;
      const sel = copy[idx];
      if (sel.routing?.mode !== 'linear') {
        const last = copy[copy.length - 1];
        if (last?.routing?.mode === 'linear' && !last.routing.next) last.routing.next = newId;
        setSelectedId(newId);
        return [...copy, newStep];
      }
      const oldNext = sel.routing.next || undefined;
      sel.routing.next = newId;
      if (oldNext) newStep.routing.next = oldNext;
      const out = [...copy.slice(0, idx + 1), newStep, ...copy.slice(idx + 1)];
      setSelectedId(newId);
      return out;
    });
  }, [selectedId, appendStep]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    // eslint-disable-next-line no-alert
    if (window.confirm('Delete the selected step?')) deleteStep(selectedId);
  }, [selectedId, deleteStep]);

  return (
    <Box padding="m">
      {validation.errors.length > 0 && (
        <Container header={<Header variant="h3">Validation</Header>}>
          <Box variant="span">{validation.errors.length} error{validation.errors.length > 1 ? 's' : ''}</Box>
          <Box margin={{ top: 's' }}>
            {validation.errors.slice(0, 3).map((e, i) => <div key={i}>• {e}</div>)}
            {validation.errors.length > 3 && <div style={{ color: '#555' }}>…and {validation.errors.length - 3} more</div>}
          </Box>
        </Container>
      )}
      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 6 }, { colspan: 4 }]}>
        <Box padding="m">
          <Header variant="h3">BlockStep Library</Header>
          <SpaceBetween size="xs">
            {library.map(step => (
              <Button
                key={step.id}
                onClick={() => { console.log('add click', step.name); addFromLibrary(step); }}
                variant="normal"
                formAction="none"
                style={{ width: '100%', justifyContent: 'flex-start' }}
              >
                {step.name}
              </Button>
            ))}
            {libStatus === 'loading' && <Box variant="div" color="text-status-info">Loading…</Box>}
            {libStatus === 'error' && (
              <Box variant="div" color="text-status-danger">Failed to load library from {API_BASE || '(no base)'}</Box>
            )}
          </SpaceBetween>
        </Box>
        <Box padding="m">
          <Header variant="h3">Working Area</Header>
          {/* Clear-selection affordance (only when something is selected) */}
          <div style={{ textAlign: 'right', marginBottom: 8 }}>
            {selectedId && (
              <Button variant="link" onClick={() => setSelectedId(null)}>Clear selection (Esc)</Button>
            )}
          </div>
          {/* Tiny toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button onClick={fit}>Fit</Button>
            <Button onClick={appendStep}>Append step</Button>
            <Button onClick={insertAfterSelected} disabled={!selectedId}>Insert after selected</Button>
            <Button onClick={deleteSelected} disabled={!selectedId}>Delete</Button>
          </div>
          <div
            ref={rfWrapRef}
            style={{
              width: '100%',
              height: '70vh',
              overflow: 'hidden',
              border: '1px solid #e0e0e0',
              borderRadius: 6,
              background: 'white'
            }}
          >
            <ReactFlowProvider>
              <ReactFlow
                onInit={setRf}
                nodes={nodes}
                edges={edges}
                onNodeClick={(_, node) => { console.log('node click', node.id); setSelectedId(node.id); }}
                onPaneClick={() => { console.log('pane click'); setSelectedId(null); }}
                style={{ width: '100%', height: '100%' }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={false}
                selectionOnDrag={false}
                zoomOnScroll={false}
                proOptions={{ hideAttribution: true }}
              />
            </ReactFlowProvider>
          </div>
        </Box>
        <Box padding="m">
          <Header variant="h3">Step Properties</Header>
          <PropertiesPanel steps={steps} selectedId={selectedId} onChange={updateStep} onDelete={deleteStep} />
        </Box>
      </Grid>
      <style>{`
        .react-flow__node { display: flex; align-items: center; justify-content: center; font-weight: 500; cursor: pointer; transition: box-shadow 120ms ease, background-color 120ms ease; }
        .react-flow__node:hover { box-shadow: 0 0 0 2px #6b7280 inset; background-color: #f9fafb; }
        .react-flow__node.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
        .node-error { box-shadow: 0 0 0 2px #d13212 inset !important; }
        .react-flow__edge-text, .react-flow__edge-textbg { pointer-events: none; }
      `}</style>
    </Box>
  );
}

// Dev-only: tame Chrome's noisy ResizeObserver loop error without hiding real errors
if (typeof window !== 'undefined') {
  const swallowROError = (ev) => {
    const msg = (ev && ev.message) || (ev && ev.reason && ev.reason.message) || (ev && ev.error && ev.error.message) || '';
    if (typeof msg === 'string' && (msg.includes('ResizeObserver loop limit exceeded') || msg.includes('ResizeObserver loop completed with undelivered notifications'))) {
      ev.preventDefault && ev.preventDefault();
      ev.stopImmediatePropagation && ev.stopImmediatePropagation();
      return true;
    }
    return false;
  };
  window.addEventListener('error', swallowROError, true);
  window.addEventListener('unhandledrejection', swallowROError, true);
}
