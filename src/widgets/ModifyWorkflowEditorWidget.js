import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Header, ButtonDropdown, Grid, SpaceBetween,
  Container, FormField, Select
} from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';

import ReactFlow, { ReactFlowProvider, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';

import ELK from 'elkjs/lib/elk.bundled.js';

// ---------- Demo data (you can replace this with your real model) ----------
const sampleBlockSteps = [
  { id: 'lib-1', name: 'Collect Personal Info' },
  { id: 'lib-2', name: 'Eligibility Check' },
  { id: 'lib-3', name: 'Document Upload' },
];

const initialSteps = [
  {
    id: 'A',
    name: 'Collect Personal Info',
    routing: { mode: 'linear', next: 'B' }
  },
  {
    id: 'B',
    name: 'Programme Type',
    // Branching by an option on THIS step
    routing: {
      mode: 'byOption',
      fieldKey: 'programme',                 // purely descriptive in this demo
      options: ['Training', 'Wage Subsidy', 'Other'],
      mapping: {
        'Training': 'C',
        'Wage Subsidy': 'C'
        // 'Other' -> falls through to defaultNext
      },
      defaultNext: 'D'
    }
  },
  { id: 'C', name: 'Eligibility Check', routing: { mode: 'linear', next: 'D' } },
  { id: 'D', name: 'Document Upload',   routing: { mode: 'linear' } } // terminal
];

// ---------- Helpers ----------
const elk = new ELK();
const NODE_SIZE = { width: 220, height: 90 };

function buildEdgesFromModel(steps) {
  // For 'byOption' we group options that map to the same target and place one labeled edge per target.
  const edges = [];
  const byId = Object.fromEntries(steps.map(s => [s.id, s]));

  for (const step of steps) {
    const r = step.routing || {};
    if (r.mode === 'linear') {
      if (r.next) edges.push({ source: step.id, target: r.next, label: '' });
    } else if (r.mode === 'byOption') {
      const groups = new Map(); // target -> [option1, option2...]
      for (const opt of (r.options || [])) {
        const tgt = r.mapping?.[opt] || r.defaultNext;
        if (!tgt) continue;
        if (!groups.has(tgt)) groups.set(tgt, []);
        groups.get(tgt).push(opt);
      }
      for (const [target, opts] of groups) {
        edges.push({
          source: step.id,
          target,
          label: opts.join(', ')
        });
      }
    }
  }

  // De-duplicate identical (source,target) pairs; combine labels
  const dedup = new Map();
  for (const e of edges) {
    const key = `${e.source}->${e.target}`;
    if (!dedup.has(key)) dedup.set(key, { ...e });
    else {
      const prev = dedup.get(key);
      const labels = [prev.label, e.label].filter(Boolean);
      dedup.set(key, { ...e, label: labels.join(', ') });
    }
  }
  return [...dedup.values()].map((e, i) => ({ id: `e${i}`, ...e }));
}

async function elkLayout(steps, edges) {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '80',
      'elk.spacing.nodeNode': '40',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'ORTHOGONAL'
    },
    children: steps.map(s => ({
      id: s.id,
      width: NODE_SIZE.width,
      height: NODE_SIZE.height
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target]
    }))
  };
  const res = await elk.layout(graph);
  // Annotate with positions
  const nodePos = new Map(res.children.map(c => [c.id, c]));
  return {
    nodes: steps.map(s => ({
      id: s.id,
      position: { x: nodePos.get(s.id)?.x || 0, y: nodePos.get(s.id)?.y || 0 },
      data: { label: s.name, stepId: s.id },
      type: 'default',
      style: {
        width: NODE_SIZE.width,
        height: NODE_SIZE.height,
        border: '1px solid #d5dbdb',
        borderRadius: 8,
        background: 'white',
        padding: 8
      }
    })),
    edges: res.edges.map(e => {
      const orig = edges.find(x => x.id === e.id) || {};
      return {
        id: e.id,
        source: e.sources[0],
        target: e.targets[0],
        label: orig.label || '',
        // Let React Flow compute a nice path; ELK gives us ranks that keep it tidy
        type: 'smoothstep',
        markerEnd: { type: 'arrowclosed' },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
        labelBgStyle: { fill: '#ffffff' }
      };
    })
  };
}

const stepOptionsFrom = (steps, excludeId) =>
  steps.filter(s => s.id !== excludeId).map(s => ({ label: s.name, value: s.id }));

const selectObj = (value, opts) => opts.find(o => o.value === value) || null;

// ---------- Properties panel ----------
function PropertiesPanel({ steps, selectedId, onChange }) {
  const step = steps.find(s => s.id === selectedId) || null;
  const stepOpts = useMemo(
    () => (step ? stepOptionsFrom(steps, step.id) : []),
    [steps, step?.id]
  );
  const routing = step?.routing || { mode: 'linear' };

  if (!step) {
    return (
      <Box textAlign="center" color="inherit" padding="m">
        <span style={{ color: '#888' }}>[Select a step]</span>
      </Box>
    );
  }

  // Handlers
  const setRouting = (newRouting) => {
    onChange({ ...step, routing: newRouting });
  };

  return (
    <SpaceBetween size="s">
      <Container header={<Header variant="h3">{step.name}</Header>}>
        <FormField label="Routing mode">
          <Select
            selectedOption={{ label: routing.mode === 'byOption' ? 'By option' : 'Linear', value: routing.mode }}
            onChange={({ detail }) => {
              const mode = detail.selectedOption.value;
              if (mode === 'linear') {
                setRouting({ mode: 'linear', next: undefined });
              } else {
                // initialise a simple byOption config
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
            options={[
              { label: 'Linear', value: 'linear' },
              { label: 'By option', value: 'byOption' }
            ]}
          />
        </FormField>

        {routing.mode === 'linear' && (
          <FormField label="Next step">
            <Select
              placeholder="(none / end)"
              selectedOption={selectObj(routing.next, stepOpts)}
              onChange={({ detail }) =>
                setRouting({ mode: 'linear', next: detail.selectedOption?.value })
              }
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
                onChange={({ detail }) =>
                  setRouting({ ...routing, fieldKey: detail.selectedOption.value })
                }
                options={[
                  { label: routing.fieldKey, value: routing.fieldKey }
                ]}
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
                          setRouting({
                            ...routing,
                            mapping: { ...(routing.mapping || {}), [opt]: next }
                          });
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
                onChange={({ detail }) =>
                  setRouting({ ...routing, defaultNext: detail.selectedOption?.value })
                }
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

// ---------- Main widget ----------
function ModifyWorkflowEditorWidgetInner({ actions }) {
  const [steps, setSteps] = useState(initialSteps);
  const [selectedId, setSelectedId] = useState(null);

  const edgesModel = useMemo(() => buildEdgesFromModel(steps), [steps]);
  const rfWrapRef = useRef(null);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rf, setRf] = useState(null); // React Flow instance

  // Layout with ELK on any structure change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { nodes: laidOutNodes, edges: laidOutEdges } = await elkLayout(steps, edgesModel);
      if (!cancelled) {
        setNodes(laidOutNodes);
        setEdges(laidOutEdges);
      }
    })();
    return () => { cancelled = true; };
  }, [steps, edgesModel, setNodes, setEdges]);

  // Fit once nodes/edges are in the canvas
  useEffect(() => {
    if (rf && nodes.length) {
      rf.fitView({ padding: 0.2, includeHiddenNodes: true });
    }
  }, [rf, nodes.length, edges.length]);

  const stepSelectHandler = useCallback((evt, node) => {
    setSelectedId(node.id);
  }, []);

  const updateStep = useCallback((updated) => {
    setSteps(prev => prev.map(s => (s.id === updated.id ? updated : s)));
  }, []);

  // Library “add to flow” demo: append a new step and set linear next from last step if applicable
  const addFromLibrary = useCallback((lib) => {
    setSteps(prev => {
      const newId = String.fromCharCode(65 + prev.length); // A, B, C...
      const newStep = { id: newId, name: lib.name, routing: { mode: 'linear' } };
      const next = [...prev, newStep];

      // if last step has linear with empty next, wire it to the new step
      const last = prev[prev.length - 1];
      if (last && last.routing?.mode === 'linear' && !last.routing.next) {
        last.routing.next = newId;
      }
  useEffect(() => {
    const el = rfWrapRef.current;
    if (el) console.log('RF wrapper size:', el.clientWidth, el.clientHeight);
  });
      return next.map(s => ({ ...s }));
    });
  }, []);

  const stepListOptions = useMemo(
    () => steps.map(s => ({ label: s.name, value: s.id })),
    [steps]
  );

  return (
    <BoardItem
      header={
        <Header
          actions={
            <ButtonDropdown
              items={[{ id: 'remove', text: 'Remove' }]}
              ariaLabel="Board item settings"
              variant="icon"
              onItemClick={() => actions?.removeItem?.()}
            />
          }
        >
          Intake Workflow Editor (demo)
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={
        <ButtonDropdown
          items={[{ id: 'remove', text: 'Remove' }]}
          ariaLabel="Board item settings"
          variant="icon"
          onItemClick={() => actions?.removeItem?.()}
        />
      }
    >
      <Box>
        <Grid gridDefinition={[{ colspan: 2 }, { colspan: 6 }, { colspan: 4 }]}>
          {/* Left: Library */}
          <Box padding="m">
            <Header variant="h3">BlockStep Library</Header>
            <SpaceBetween size="xs">
              {sampleBlockSteps.map(step => (
                <Box key={step.id} variant="div" padding="xs" borderRadius="xs" background="container" onClick={() => addFromLibrary(step)} style={{ cursor: 'pointer' }}>
                  {step.name}
                </Box>
              ))}
            </SpaceBetween>
          </Box>

          {/* Middle: Working Area */}
          <Box padding="m" data-testid="working-area" style={{ minHeight: 420 }}>
            <Header variant="h3">Working Area</Header>
            <Box padding="s" borderRadius="xs" background="container" style={{ height: 360 }}>
              <div style={{ width: '100%', height: '100%' }}>
                <ReactFlowProvider>
                  <ReactFlow
                    onInit={setRf}
                    nodes={nodes}
                    edges={edges}
                    defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    onNodeClick={stepSelectHandler}
                    nodesDraggable={false}
                    nodesConnectable={false}
                    elementsSelectable
                    panOnDrag
                    zoomOnScroll
                    proOptions={{ hideAttribution: true }}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                  />
                </ReactFlowProvider>
          <Box padding="m">
            <Header variant="h3">Working Area</Header>
            {/* Plain div = the measured parent. No extra wrappers. */}
            <div
              ref={rfWrapRef}
              style={{
                width: '100%',
                height: 520,
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
                  fitView
                  style={{ width: '100%', height: '100%' }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable
                  panOnDrag
                  zoomOnScroll
                  proOptions={{ hideAttribution: true }}
                />
              </ReactFlowProvider>
            </div>
          </Box>
