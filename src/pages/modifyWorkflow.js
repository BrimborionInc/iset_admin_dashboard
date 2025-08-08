import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Header, Grid, SpaceBetween, Container, FormField, Select
} from '@cloudscape-design/components';

import ReactFlow, { ReactFlowProvider, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';

import ELK from 'elkjs/lib/elk.bundled.js';

// ----- Demo data -----
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
  { id: 'D', name: 'Document Upload', routing: { mode: 'linear' } } // terminal
];

// ----- Helpers -----
const elk = new ELK();
const NODE_SIZE = { width: 220, height: 90 };

function buildEdgesFromModel(steps) {
  const edges = [];
  for (const step of steps) {
    const r = step.routing || {};
    if (r.mode === 'linear') {
      if (r.next) edges.push({ source: step.id, target: r.next, label: '' });
    } else if (r.mode === 'byOption') {
      const groups = new Map(); // target -> [options...]
      for (const opt of (r.options || [])) {
        const tgt = r.mapping?.[opt] || r.defaultNext;
        if (!tgt) continue;
        if (!groups.has(tgt)) groups.set(tgt, []);
        groups.get(tgt).push(opt);
      }
      for (const [target, opts] of groups) {
        edges.push({ source: step.id, target, label: opts.join(', ') });
      }
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
      style: {
        width: NODE_SIZE.width, height: NODE_SIZE.height,
        border: '1px solid #d5dbdb', borderRadius: 8, background: 'white', padding: 8
      }
    })),
    edges: res.edges.map(e => {
      const orig = edges.find(x => x.id === e.id) || {};
      return {
        id: e.id, source: e.sources[0], target: e.targets[0],
        label: orig.label || '', type: 'smoothstep', markerEnd: { type: 'arrowclosed' },
        labelBgPadding: [4, 2], labelBgBorderRadius: 4, labelBgStyle: { fill: '#ffffff' }
      };
    })
  };
}

const stepOptionsFrom = (steps, excludeId) =>
  steps.filter(s => s.id !== excludeId).map(s => ({ label: s.name, value: s.id }));
const selectObj = (value, opts) => opts.find(o => o.value === value) || null;

// ----- Properties panel -----
function PropertiesPanel({ steps, selectedId, onChange }) {
  const step = steps.find(s => s.id === selectedId) || null;
  const stepOpts = useMemo(() => (step ? stepOptionsFrom(steps, step.id) : []), [steps, step?.id]);
  const routing = step?.routing || { mode: 'linear' };

  if (!step) {
    return (
      <Box textAlign="center" color="inherit" padding="m">
        <span style={{ color: '#888' }}>[Select a step]</span>
      </Box>
    );
  }

  const setRouting = (newRouting) => onChange({ ...step, routing: newRouting });

  return (
    <SpaceBetween size="s">
      <Container header={<Header variant="h3">{step.name}</Header>}>
        <FormField label="Routing mode">
          <Select
            selectedOption={{ label: routing.mode === 'byOption' ? 'By option' : 'Linear', value: routing.mode }}
            onChange={({ detail }) => {
              const mode = detail.selectedOption.value;
              if (mode === 'linear') setRouting({ mode: 'linear', next: undefined });
              else {
                const existing = routing.mode === 'byOption' ? routing : null;
                setRouting({
                  mode: 'byOption',
                  fieldKey: existing?.fieldKey || 'optionField',
                  options: existing?.options || ['Option A', 'Option B'],
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
    </SpaceBetween>
  );
}

// ----- Main -----
export default function ModifyWorkflowEditorWidget() {
  const rfWrapRef = useRef(null);
  const [steps, setSteps] = useState(initialSteps);
  const [selectedId, setSelectedId] = useState(null);

  const edgesModel = useMemo(() => buildEdgesFromModel(steps), [steps]);
  const [nodes, setNodes] = useNodesState([]);   // onNodesChange not needed (read-only)

  // Mirror selectedId into nodes array for controlled selection
  useEffect(() => {
    setNodes(ns => ns.map(n => ({ ...n, selected: n.id === selectedId })));
  }, [selectedId, setNodes]);
  const [edges, setEdges] = useEdgesState([]);
  const [rf, setRf] = useState(null);

  // Layout on structure change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { nodes: laidOutNodes, edges: laidOutEdges } = await elkLayout(steps, edgesModel);
      if (!cancelled) { setNodes(laidOutNodes); setEdges(laidOutEdges); }
    })();
    return () => { cancelled = true; };
  }, [steps, edgesModel, setNodes, setEdges]);

  // Fit after nodes render
  useEffect(() => {
    if (rf && nodes.length) rf.fitView({ padding: 0.2, includeHiddenNodes: true });
  }, [rf, nodes.length, edges.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = rfWrapRef.current;
    if (el) console.log('RF wrapper size:', el.clientWidth, el.clientHeight);
  });

  const addFromLibrary = useCallback((lib) => {
    setSteps(prev => {
      const newId = String.fromCharCode(65 + prev.length); // A, B, C...
      const newStep = { id: newId, name: lib.name, routing: { mode: 'linear' } };
      const next = [...prev.map(s => ({ ...s })), newStep];
      const last = next[next.length - 2];
      if (last && last.routing?.mode === 'linear' && !last.routing.next) last.routing.next = newId;
      return next;
    });
  }, []);

  const updateStep = useCallback((updated) => {
    setSteps(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  }, []);

  return (
    <Box padding="m">
      <Grid gridDefinition={[{ colspan: 2 }, { colspan: 6 }, { colspan: 4 }]}>
        {/* Left: Library */}
        <Box padding="m">
          <Header variant="h3">BlockStep Library</Header>
          <SpaceBetween size="xs">
            {sampleBlockSteps.map(step => (
              <Box
                key={step.id}
                variant="div"
                padding="xs"
                borderRadius="xs"
                background="container"
                onClick={() => addFromLibrary(step)}
                style={{ cursor: 'pointer' }}
              >
                {step.name}
              </Box>
            ))}
          </SpaceBetween>
        </Box>

        {/* Middle: Working Area */}
        <Box padding="m">
          <Header variant="h3">Working Area</Header>
          {/* Plain div = the measured parent. No extra wrappers. */}
          <div
            ref={rfWrapRef}
            style={{
              width: '100%',
              height: '70vh',
              overflow: 'auto',
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
                  fitView
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

        {/* Right: Properties */}
        <Box padding="m">
          <Header variant="h3">Step Properties</Header>
          <PropertiesPanel
            steps={steps}
            selectedId={selectedId}
            onChange={updateStep}
          />
        </Box>
      </Grid>

      <style>{`
        .react-flow__node {
          display: flex; align-items: center; justify-content: center; font-weight: 500;
        }
        .react-flow__node.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
  .react-flow__edge-text, .react-flow__edge-textbg { pointer-events: none; }
      `}</style>
    </Box>
  );
}
