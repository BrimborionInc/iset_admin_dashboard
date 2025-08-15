import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Button, Header, SpaceBetween } from '@cloudscape-design/components';
import ReactFlow, { ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { buildEdgesFromModel } from '../utils/workflowEditorUtils';

const elk = new ELK();
const NODE_SIZE = { width: 220, height: 90 };

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

const WorkflowCanvasWidget = ({ steps = [], selectedId, onSelect, onDelete, onLayout }) => {
  const rfWrapRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [rf, setRf] = useState(null);
  const edgesModel = useMemo(() => buildEdgesFromModel(steps), [steps]);
  const nodesRef = useRef([]);
  const sizeRef = useRef({ w: 0, h: 0 });
  const needFitRef = useRef(false);
  const raf1Ref = useRef(0);
  const raf2Ref = useRef(0);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  const setViewportToBounds = useCallback((bounds, padding = 0.2) => {
    if (!rf || !bounds) return;
    const { w, h } = sizeRef.current;
    if (w <= 0 || h <= 0) return;
    const padX = bounds.width * padding;
    const padY = bounds.height * padding;
    const bw = Math.max(1, bounds.width + padX * 2);
    const bh = Math.max(1, bounds.height + padY * 2);
    const zoom = Math.max(0.01, Math.min(2, Math.min(w / bw, h / bh)));
    const targetX = bounds.x - padX;
    const targetY = bounds.y - padY;
    const x = (w - bw * zoom) / 2 - targetX * zoom;
    const y = (h - bh * zoom) / 2 - targetY * zoom;
    try { rf.setViewport({ x, y, zoom }); } catch {}
  }, [rf]);

  const scheduleFit = useCallback((explicitNodes) => {
    if (!rf) return;
    needFitRef.current = true;
    if (raf1Ref.current) cancelAnimationFrame(raf1Ref.current);
    if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current);
    raf1Ref.current = requestAnimationFrame(() => {
      raf2Ref.current = requestAnimationFrame(() => {
        if (needFitRef.current && rf && sizeRef.current.w > 0 && sizeRef.current.h > 0) {
          const list = Array.isArray(explicitNodes) && explicitNodes.length ? explicitNodes : nodesRef.current;
          const b = calcBounds(list || []);
          if (b) setViewportToBounds(b, 0.2); else { try { rf.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {} }
          needFitRef.current = false;
        }
      });
    });
  }, [rf, setViewportToBounds]);

  const onRFInit = useCallback((inst) => {
    setRf(inst);
    requestAnimationFrame(() => {
      const b = calcBounds(nodesRef.current || []);
      if (b) {
        try {
          const { clientWidth: w, clientHeight: h } = rfWrapRef.current || { clientWidth: 0, clientHeight: 0 };
          sizeRef.current = { w, h };
          inst.setViewport({ x: 0, y: 0, zoom: 1 });
        } catch {}
        try { setViewportToBounds(b, 0.2); } catch {}
      } else {
        try { inst.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
      }
    });
  }, [setViewportToBounds]);

  useEffect(() => () => {
    if (raf1Ref.current) cancelAnimationFrame(raf1Ref.current);
    if (raf2Ref.current) cancelAnimationFrame(raf2Ref.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const laidOutEdges = edgesModel;
      const { nodes: laidOutNodes, edges: finalEdges } = await elkLayout(steps, laidOutEdges);
      if (!cancelled) {
        const withSel = laidOutNodes.map(n => ({ ...n, selected: n.id === selectedId }));
        setNodes(withSel);
        setEdges(finalEdges);
        scheduleFit(withSel);
        onLayout && onLayout({ nodes: withSel, edges: finalEdges });
      }
    })();
    return () => { cancelled = true; };
  }, [steps, edgesModel, selectedId, scheduleFit, onLayout]);

  useEffect(() => { setNodes(ns => ns.map(n => ({ ...n, selected: n.id === selectedId }))); }, [selectedId]);

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
        scheduleFit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [scheduleFit]);

  const fit = useCallback(() => {
    if (!rf) return;
    const b = calcBounds(nodesRef.current || []);
    if (b) setViewportToBounds(b, 0.2); else try { rf.fitView({ padding: 0.2, includeHiddenNodes: true }); } catch {}
  }, [rf, setViewportToBounds]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    onDelete && onDelete(selectedId);
  }, [selectedId, onDelete]);

  const itemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
  };

  return (
    <BoardItem header={<Header variant="h2">Working Area</Header>} i18nStrings={itemI18n}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Button onClick={fit}>Zoom to Fit</Button>
        <Button onClick={deleteSelected} disabled={!selectedId}>Delete Step</Button>
      </div>
      <div
        ref={rfWrapRef}
        style={{ width: '100%', height: '70vh', overflow: 'hidden', border: '1px solid #e0e0e0', borderRadius: 6, background: 'white', position: 'relative', zIndex: 0 }}
      >
        <ReactFlowProvider>
          <ReactFlow
            onInit={onRFInit}
            nodes={nodes}
            edges={edges}
            onNodeClick={(_, node) => { onSelect && onSelect(node.id); }}
            onPaneClick={() => { onSelect && onSelect(null); }}
            style={{ width: '100%', height: '100%' }}
            fitView
            minZoom={0.1}
            maxZoom={2}
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
    </BoardItem>
  );
};

export default WorkflowCanvasWidget;
