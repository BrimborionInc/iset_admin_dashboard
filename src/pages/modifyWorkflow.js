import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Header, Grid, SpaceBetween, Container, FormField, Select, Button, Input } from '@cloudscape-design/components';
import ReactFlow, { ReactFlowProvider, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

// API base from .env (CRA injects REACT_APP_* at build time)
const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

// ----- Demo data fallback -----
const sampleBlockSteps = [
  { id: 'lib-1', name: 'Collect Personal Info' },
  { id: 'lib-2', name: 'Programme Type' },
  { id: 'lib-3', name: 'Document Upload' }
];

const initialSteps = [
  { id: 'A', name: 'Collect Personal Info', routing: { mode: 'linear', next: 'B' } },
  {
    id: 'B',
    name: 'Programme Type',
    routing: {
      mode: 'byOption',
      fieldKey: 'programme',
      options: ['Training', 'Wage Subsidy', 'Other'],
      mapping: { Training: 'C', 'Wage Subsidy': 'C' },
      defaultNext: 'D'
    }
  },
  { id: 'C', name: 'Eligibility Check', routing: { mode: 'linear', next: 'D' } },
  { id: 'D', name: 'Document Upload', routing: { mode: 'linear' } }
];

// ----- Helpers -----
const elk = new ELK();
const NODE_SIZE = { width: 220, height: 90 };

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
      data: { label: s.name, stepId: s.id },
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
          <Input
            value={step.name}
            onChange={({ detail }) => onChange({ ...step, name: detail.value })}
          />
        </FormField>
        <FormField label="Routing mode">
          <Select
            selectedOption={{ label: routing.mode === 'byOption' ? 'By option' : 'Linear', value: routing.mode }}
            onChange={({ detail }) => {
              const mode = detail.selectedOption.value;
              if (mode === 'linear') setRouting({ mode: 'linear', next: undefined });
              else {
                const existing = routing.mode === 'byOption' ? routing : null;
                setRouting({ mode: 'byOption', fieldKey: existing?.fieldKey || 'optionField', options: existing?.options || ['Option A', 'Option B'], mapping: existing?.mapping || {}, defaultNext: existing?.defaultNext });
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
                selectedOption={{ label: routing.fieldKey, value: routing.fieldKey }}
                onChange={({ detail }) => setRouting({ ...routing, fieldKey: detail.selectedOption.value })}
                options={[{ label: routing.fieldKey, value: routing.fieldKey }]}
              />
            </FormField>
            <Container header={<Header variant="h4">Option mappings</Header>}>
              <SpaceBetween size="xs">
                {routing.options.map(opt => {
                  const selected = selectObj(routing.mapping?.[opt], stepOpts);
                  return (
                    <FormField key={opt} label={opt}>
                      <Select
                        placeholder="Choose next step"
                        selectedOption={selected}
                        onChange={({ detail }) => {
                          const next = detail.selectedOption?.value;
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
  const [library, setLibrary] = useState(sampleBlockSteps);
  const [libStatus, setLibStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'done'
  const edgesModel = useMemo(() => buildEdgesFromModel(steps), [steps]);
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [rf, setRf] = useState(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { nodes: laidOutNodes, edges: laidOutEdges } = await elkLayout(steps, edgesModel);
      if (!cancelled) { setNodes(laidOutNodes); setEdges(laidOutEdges); }
    })();
    return () => { cancelled = true; };
  }, [steps, edgesModel, setNodes, setEdges]);

  useEffect(() => { if (rf && nodes.length) rf.fitView({ padding: 0.2, includeHiddenNodes: true }); }, [rf, nodes.length, edges.length]);
  useEffect(() => { const el = rfWrapRef.current; if (el) console.log('RF wrapper size:', el.clientWidth, el.clientHeight); });

  // Load Blockstep Library from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLibStatus('loading');
        const res = await fetch(`${API_BASE}/api/blocksteps`, { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = await res.json();
        if (cancelled) return;
        const items = rows.map(r => ({
          id: `lib-${r.id}`,
          name: r.name,
          templateId: r.id,
          type: r.type
        }));
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
      const newStep = { id: newId, name: lib.name, routing: { mode: 'linear' } };
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
          {/* Tiny toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <Button onClick={fit}>Fit</Button>
            <Button onClick={appendStep}>Append step</Button>
            <Button onClick={insertAfterSelected} disabled={!selectedId}>Insert after selected</Button>
            <Button onClick={deleteSelected} disabled={!selectedId}>Delete</Button>
          </div>
          <div ref={rfWrapRef} style={{ width: '100%', height: '70vh', overflow: 'auto', border: '1px solid #e0e0e0', borderRadius: 6, background: 'white' }}>
            <ReactFlowProvider>
              <ReactFlow
                onInit={setRf}
                nodes={nodes}
                edges={edges}
                onNodeClick={(_, node) => setSelectedId(node.id)}
                onPaneClick={() => setSelectedId(null)}
                fitView
                style={{ width: '100%', height: '100%' }}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
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
        .react-flow__node { display: flex; align-items: center; justify-content: center; font-weight: 500; }
        .react-flow__node.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
  .node-error { box-shadow: 0 0 0 2px #d13212 inset !important; }
        .react-flow__edge-text, .react-flow__edge-textbg { pointer-events: none; }
      `}</style>
    </Box>
  );
}
