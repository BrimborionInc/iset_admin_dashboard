import React, { useEffect, useMemo, useState } from 'react';
import { Box, Header, ButtonDropdown, Link, SpaceBetween, Button, SegmentedControl, Modal } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { apiFetch } from '../auth/apiClient';
import jsonLogic from 'json-logic-js';
// Reuse the actual public portal component registry for faithful rendering
// The portal package is linked via file:../ISET-intake in package.json, so we can import its renderer registry directly.
import PortalRegistry from '../portalRendererRegistry';

// Helper to safely extract a display string from multilingual or raw values
const textOf = (v) => {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return v.en || v.fr || Object.values(v).find(x => typeof x === 'string') || '';
  return '';
};

// Adaptor for summary-list component so admin preview uses portal SummaryList with current collected answers
const SummaryListAdapter = ({ comp, answers }) => {
  const Comp = PortalRegistry['summary-list'];
  if (!Comp) return null;
  return <Comp comp={comp} values={answers} />;
};

// Smaller nodes and tighter default fallback spacing
const NODE_W = 160;
const NODE_H = 60;
const GAP_X = 180;
const GAP_Y = 96;

const elk = new ELK();

async function buildGraph(selectedWorkflow) {
  if (!selectedWorkflow) return { nodes: [], edges: [] };
  const steps = Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps : [];
  const routes = Array.isArray(selectedWorkflow.routes) ? selectedWorkflow.routes : [];

  const idSet = new Set(steps.map(s => s.id));
  const start = steps.find(s => s.is_start) || steps[0] || null;

  // Build adjacency and edges
  const adj = new Map();
  const edgeList = [];
  for (const s of steps) adj.set(s.id, []);
  const edgeLabelMap = new Map(); // key: src->tgt => combined label

  const pushEdge = (src, tgt, label) => {
    if (!src || !tgt || !idSet.has(src) || !idSet.has(tgt)) return;
    const key = `${src}->${tgt}`;
    adj.get(src)?.push(tgt);
    if (label) {
      edgeLabelMap.set(key, edgeLabelMap.has(key) ? `${edgeLabelMap.get(key)}, ${label}` : label);
    } else {
      if (!edgeLabelMap.has(key)) edgeLabelMap.set(key, '');
    }
  };

  for (const r of routes) {
    if (!r || !r.source_step_id) continue;
    if (r.mode === 'linear') {
      if (r.default_next_step_id) pushEdge(r.source_step_id, r.default_next_step_id, '');
    } else if (r.mode === 'by_option') {
      const opts = Array.isArray(r.options) ? r.options : [];
      for (const o of opts) {
        pushEdge(r.source_step_id, o.next_step_id, String(o.option_value));
      }
      if (r.default_next_step_id) pushEdge(r.source_step_id, r.default_next_step_id, '(default)');
    }
  }

  // Assign levels using BFS from start (fallback: scattered)
  const level = new Map();
  if (start) {
    const q = [start.id];
    level.set(start.id, 0);
    while (q.length) {
      const u = q.shift();
      const nexts = adj.get(u) || [];
      for (const v of nexts) {
        if (!level.has(v)) {
          level.set(v, (level.get(u) || 0) + 1);
          q.push(v);
        }
      }
    }
  }
  // Unreached nodes: assign incremental levels after max
  const maxLevel = Math.max(-1, ...Array.from(level.values()));
  let extra = 0;
  for (const s of steps) {
    if (!level.has(s.id)) level.set(s.id, maxLevel + 1 + (extra++));
  }

  // Arrange nodes into columns by level
  const byLevel = new Map();
  for (const s of steps) {
    const lv = level.get(s.id) || 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(s);
  }
  // Sort each column by name for stability
  for (const [lv, arr] of byLevel) arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const nodes = [];
  for (const [lv, arr] of Array.from(byLevel.entries()).sort((a, b) => a[0] - b[0])) {
    arr.forEach((s, idx) => {
      nodes.push({
        id: String(s.id),
        data: { label: s.name + (s.is_start ? ' •' : '') },
        position: { x: lv * GAP_X, y: idx * GAP_Y },
  sourcePosition: 'bottom',
  targetPosition: 'top',
        style: { width: NODE_W, height: NODE_H, borderRadius: 8, border: s.is_start ? '2px solid #0972d3' : '1px solid #d5dbdb', background: '#fff' }
      });
    });
  }

  // Build edges (merge labels) and keep meta for styling
  const rawEdges = [];
  let i = 0;
  for (const [key, label] of edgeLabelMap.entries()) {
    const [src, tgt] = key.split('->');
    const isDefault = label === '' || label === '(default)';
    rawEdges.push({ id: `e${i++}`, source: String(src), target: String(tgt), label: label || undefined, isDefault });
  }

  // Run ELK layout for better readability
  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      // tighten vertical layers and general spacing to shorten connectors
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '32',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'ORTHOGONAL'
    },
    children: steps.map(s => ({ id: String(s.id), width: NODE_W, height: NODE_H })),
    edges: rawEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  };

  try {
    const laid = await elk.layout(elkGraph);
    const byId = new Map(laid.children.map(c => [c.id, c]));
    const rfNodes = steps.map(s => ({
      id: String(s.id),
      data: { label: s.name + (s.is_start ? ' •' : '') },
      position: { x: byId.get(String(s.id))?.x || 0, y: byId.get(String(s.id))?.y || 0 },
  sourcePosition: 'bottom',
  targetPosition: 'top',
      style: { width: NODE_W, height: NODE_H, borderRadius: 8, border: s.is_start ? '2px solid #0972d3' : '1px solid #d5dbdb', background: '#fff' }
    }));
    const rfEdges = rawEdges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      label: e.label,
      markerEnd: { type: 'arrowclosed' },
      style: { stroke: e.isDefault ? '#9aa5b1' : '#0972d3' },
      labelStyle: { fill: e.isDefault ? '#4b5563' : '#0f172a', fontWeight: e.isDefault ? 400 : 600 }
    }));
    return { nodes: rfNodes, edges: rfEdges };
  } catch {
    // Fallback to simple grid if ELK fails
    const rfNodes = steps.map((s, idx) => ({
      id: String(s.id),
      data: { label: s.name + (s.is_start ? ' •' : '') },
      position: { x: (idx % 4) * GAP_X, y: Math.floor(idx / 4) * GAP_Y },
  sourcePosition: 'bottom', targetPosition: 'top',
      style: { width: NODE_W, height: NODE_H, borderRadius: 8, border: s.is_start ? '2px solid #0972d3' : '1px solid #d5dbdb', background: '#fff' }
    }));
    const rfEdges = rawEdges.map(e => ({ id: e.id, source: e.source, target: e.target, type: 'smoothstep', label: e.label, markerEnd: { type: 'arrowclosed' } }));
    return { nodes: rfNodes, edges: rfEdges };
  }
}

const WorkflowPreviewWidget = ({ selectedWorkflow, actions, toggleHelpPanel, HelpContent }) => {
  const [{ nodes, edges }, setGraph] = useState({ nodes: [], edges: [] });
  const rfRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const [mode, setMode] = useState('graph'); // graph | interactive | json
  const [runtime, setRuntime] = useState(null); // { steps, meta }
  const [runner, setRunner] = useState({ stepIndex: 0, answers: {}, errors: {}, history: [] });
  const [showAnswers, setShowAnswers] = useState(false);
  const apiBase = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

  // Load runtime schema only when workflow changes (retain answers & position when switching modes)
  useEffect(() => {
    if (!selectedWorkflow) { setRuntime(null); setRunner({ stepIndex: 0, answers: {}, errors: {}, history: [] }); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch(`/api/workflows/${selectedWorkflow.id}/preview`);
        if (!cancelled) {
          if (resp.ok) {
            const data = await resp.json();
            setRuntime(data);
            setRunner({ stepIndex: 0, answers: {}, errors: {}, history: [] });
          } else {
            setRuntime({ error: 'Failed to load runtime schema' });
          }
        }
      } catch (e) {
        if (!cancelled) setRuntime({ error: 'Failed to load runtime schema' });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWorkflow?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = await buildGraph(selectedWorkflow);
      if (!cancelled) setGraph(g);
    })();
    return () => { cancelled = true; };
  }, [selectedWorkflow]);

  // Fit view on first init and on container resize
  const onRFInit = React.useCallback((inst) => {
    rfRef.current = inst;
    try { inst.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (rfRef.current) {
        try { rfRef.current.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Interactive helpers
  const steps = runtime?.steps || [];
  const currentStep = steps[runner.stepIndex] || null;
  const answers = runner.answers;

  const setAnswer = (comp, value) => {
    setRunner(r => ({ ...r, answers: { ...r.answers, [comp.storageKey || comp.id]: value } }));
  };
  const validateStep = () => {
    if (!currentStep) return {};
    const errs = {};
    (currentStep.components || []).forEach(c => {
      const key = c.storageKey || c.id;
      if (c.required) {
        const v = answers[key];
        if (v == null || v === '' || (Array.isArray(v) && !v.length)) errs[key] = 'Required';
      }
    });
    setRunner(r => ({ ...r, errors: errs }));
    return errs;
  };
  const next = () => {
    const errs = validateStep();
    if (Object.keys(errs).length) return;
    if (!currentStep) return;
    // Branching logic
    let nextId = null;
    if (Array.isArray(currentStep.branching)) {
      for (const b of currentStep.branching) {
        try { if (jsonLogic.apply(b.condition, answers)) { nextId = b.nextStepId; break; } } catch { /* ignore */ }
      }
    }
    if (!nextId && currentStep.defaultNextStepId) nextId = currentStep.defaultNextStepId;
    if (!nextId && currentStep.nextStepId) nextId = currentStep.nextStepId;
    if (nextId) {
      const idx = steps.findIndex(s => s.stepId === nextId);
      if (idx >= 0) {
        setRunner(r => ({
          ...r,
          // append current step to history (path stack); if user had gone back and chose a different branch, we prune any forward history implicitly since we base on current r.history
          history: [...r.history, r.stepIndex],
          stepIndex: idx,
          errors: {}
        }));
        setShowAnswers(false);
        return;
      }
    }
  // End reached – show answers modal
  setShowAnswers(true);
  // Automatically switch to JSON output view so author sees final answer object
  setMode('json');
  setRunner(r => ({ ...r }));
  };
  const back = () => {
    setRunner(r => {
      if (!r.history.length) return r; // nothing to go back to
      const newHistory = [...r.history];
      const prevIdx = newHistory.pop();
      return { ...r, stepIndex: prevIdx, history: newHistory, errors: {} };
    });
    setShowAnswers(false);
  };

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          info={
            <Link
              variant="info"
              onFollow={() => toggleHelpPanel && HelpContent && toggleHelpPanel(<HelpContent />, 'Workflow Preview Help')}
            >
              Info
            </Link>
          }
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <SegmentedControl
                selectedId={mode}
                onChange={e => setMode(e.detail.selectedId)}
                options={[
                  { id: 'graph', text: 'Graph' },
                  { id: 'interactive', text: 'Interactive' },
                  { id: 'json', text: 'Output JSON' }
                ]}
              />
            </SpaceBetween>
          }
        >
          Workflow Preview
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions && actions.removeItem && actions.removeItem()}
        />
      }
  >
  <Box style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {!selectedWorkflow && (
          <div style={{ color: '#888' }}>Select a workflow to preview</div>
        )}
        {selectedWorkflow && mode === 'graph' && (
          <div ref={containerRef} style={{ height: 420, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff' }}>
            <ReactFlow
              onInit={onRFInit}
              nodes={nodes}
              edges={edges}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag
              zoomOnScroll
              fitView
              proOptions={{ hideAttribution: true }}
            />
          </div>
        )}
  {selectedWorkflow && mode === 'interactive' && (
          <div style={{ flex: 1, minHeight: 300, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!runtime && <div style={{ color: '#888' }}>Loading runtime schema...</div>}
            {runtime?.error && <div style={{ color: '#d4351c' }}>{runtime.error}</div>}
            {runtime && !runtime.error && currentStep && (
              <div>
                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 16 }}>{currentStep.title?.en || currentStep.stepId}</div>
                <div className="govuk-width-container" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {(currentStep.components || []).map(c => {
                    const type = c.type;
                    const key = c.storageKey || c.id;
                    if (type === 'summary-list') {
                      return <SummaryListAdapter key={c.id} comp={c} answers={answers} />;
                    }
                    const Comp = PortalRegistry[type];
                    if (!Comp) return <div key={c.id} style={{ fontSize: 12, color: '#666' }}>[Unsupported: {type}]</div>;
                    const val = answers[key];
                    return <Comp key={c.id} comp={c} value={val} onChange={v => setAnswer(c, v)} error={runner.errors[key]} values={answers} />;
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button disabled={!runner.history.length} onClick={back}>Back</Button>
                  <Button variant="primary" onClick={next}>{runner.stepIndex < steps.length - 1 ? 'Next' : 'Finish'}</Button>
                </div>
                {runner.stepIndex === steps.length - 1 && <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>Finish simulates end of workflow; data not persisted.</div>}
              </div>
            )}
            {showAnswers && (
              <Modal
                visible={showAnswers}
                onDismiss={() => setShowAnswers(false)}
                size="large"
                header="Collected Answers"
                footer={<SpaceBetween direction="horizontal" size="xs"><Button variant="primary" onClick={() => setShowAnswers(false)}>Close</Button></SpaceBetween>}
              >
                <div style={{ maxHeight: 400, overflow: 'auto', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre' }}>
                  {JSON.stringify(answers, null, 2)}
                </div>
              </Modal>
            )}
          </div>
        )}
        {selectedWorkflow && mode === 'json' && (
          <div style={{ flex: 1, minHeight: 300, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', display: 'flex', flexDirection: 'column' }}>
            {runtime?.error && <div style={{ color: '#d4351c' }}>{runtime.error}</div>}
            {!runtime && !runtime?.error && <div style={{ color: '#888', padding: 12 }}>Loading runtime schema…</div>}
            {runtime && !runtime.error && (() => {
              // Build full skeleton of all storage keys from schema, overlay live answers
              const out = {};
              (runtime.steps || []).forEach(s => {
                (s.components || []).forEach(c => {
                  if (!c.storageKey) return; // skip non-storing components
                  if (Object.prototype.hasOwnProperty.call(out, c.storageKey)) return; // first wins
                  // default value heuristic
                  let defVal = null;
                  if (c.type === 'checkboxes') defVal = [];
                  out[c.storageKey] = defVal;
                });
              });
              // Overlay current answers
              Object.keys(answers || {}).forEach(k => { out[k] = answers[k]; });
              const jsonStr = JSON.stringify(out, null, 2);
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderBottom: '1px solid #f0f2f4', background: '#f8f9fa', borderTopLeftRadius: 6, borderTopRightRadius: 6 }}>
                    <div style={{ fontWeight: 600 }}>Output JSON <span style={{ fontWeight: 400, color: '#555', fontSize: 12 }}>(null =&gt; unanswered)</span></div>
                    <Button
                      variant="icon"
                      iconName="copy"
                      ariaLabel="Copy JSON"
                      onClick={() => { try { navigator.clipboard.writeText(jsonStr); } catch {} }}
                    />
                  </div>
                  <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
                    <pre style={{ margin: 0 }}>{jsonStr}</pre>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </Box>
    </BoardItem>
  );
};

export default WorkflowPreviewWidget;
