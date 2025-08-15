import React, { useEffect, useMemo, useState } from 'react';
import { Box, Header, ButtonDropdown, Link } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import ReactFlow from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

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
  <Box>
        {!selectedWorkflow && (
          <div style={{ color: '#888' }}>Select a workflow to preview</div>
        )}
        {selectedWorkflow && (
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
      </Box>
    </BoardItem>
  );
};

export default WorkflowPreviewWidget;
