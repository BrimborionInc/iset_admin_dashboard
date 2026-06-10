import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Header, ButtonDropdown, Link, SpaceBetween, Button, SegmentedControl, Modal } from '@cloudscape-design/components';
import { BoardItem } from '@cloudscape-design/board-components';
import ReactFlow, { Background, Controls, Handle, MarkerType, MiniMap, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import './WorkflowPreviewWidget.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { apiFetch } from '../auth/apiClient';
import jsonLogic from 'json-logic-js';
// Reuse the actual public portal component registry for faithful rendering
// The portal package is linked via file:../ISET-intake in package.json, so we can import its renderer registry directly.
import PortalRegistry from '../portalRendererRegistry';
import FileUploadPreview from '../components/intake/FileUploadPreview';
import {
  buildConditionComponentLookup,
  componentConditionsSatisfied,
  componentSupportsConditionalVisibility,
  optionRevealChildren,
  visitComponentTree,
} from '../utils/intakeConditionalVisibility';

// Dedicated component for signature-ack preview so hooks are not used inside map callback
function SignatureAckPreview({ comp: c, answerObj, lang, setAnswer, errorMsg }) {
  const key = c.storageKey || c.id;
  const signedObj = answerObj;
  const isSigned = signedObj && typeof signedObj === 'object' && signedObj.signed;
  const signedName = isSigned ? (signedObj.name || '') : '';
  const [localName, setLocalName] = React.useState(isSigned ? signedName : '');
  React.useEffect(() => { if (!isSigned && signedName === '') setLocalName(''); }, [isSigned, signedName]);
  const resolve = (val, fallback = '') => {
    if (!val) return fallback;
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      if (typeof val.text !== 'undefined') return resolve(val.text, fallback);
      const candidate = val[lang] || val.en || val.fr || Object.values(val).find(v => typeof v === 'string');
      return resolve(candidate, fallback);
    }
    return fallback;
  };
  const actionLabel = resolve(c.actionLabel || c.props?.actionLabel, 'Sign Now');
  const clearLabel = resolve(c.clearLabel || c.props?.clearLabel, 'Clear');
  const placeholder = resolve(c.placeholder || c.props?.placeholder, 'Type your full name');
  const required = !!(c.required || c.props?.required);
  const handwritingFont = c.handwritingFont || c.props?.handwritingFont || 'cursive';
  const paddingScale = {
    s: { py: 6, px: 18, minHeight: 44 },
    m: { py: 22, px: 30, minHeight: 68 },
    l: { py: 38, px: 40, minHeight: 94 },
    xl: { py: 54, px: 52, minHeight: 120 }
  };
  const padKey = String(c.boxPadding || c.props?.boxPadding || 'm').toLowerCase();
  const pad = paddingScale[padKey] || paddingScale.m;
  const statusSigned = resolve(c.statusSignedText || c.props?.statusSignedText, 'Signed');
  const statusUnsigned = resolve(c.statusUnsignedText || c.props?.statusUnsignedText, 'Not signed');
  const canSign = !isSigned && localName.trim().length > 0;
  const doSign = () => { if (!canSign) return; setAnswer(c, { signed: true, name: localName.trim() }); };
  const doClear = () => { setLocalName(''); setAnswer(c, undefined); };
  const labelConfig = c.props?.label || {};
  const labelValue = resolve(labelConfig, resolve(c.label, ''));
  const labelClass = typeof labelConfig.classes === 'string' ? labelConfig.classes : (typeof c.labelClass === 'string' ? c.labelClass : '');
  const hintValue = resolve(c.hint || c.props?.hint, '');
  return (
    <div className={`govuk-form-group${errorMsg ? ' govuk-form-group--error' : ''}${c.formGroupClass ? ' ' + c.formGroupClass : ''}`} style={{ marginBottom: 20 }}>
      {labelValue && <label className={`govuk-label${labelClass ? ' ' + labelClass : ''}`} htmlFor={key}>{labelValue}</label>}
      {hintValue && <div className="govuk-hint" id={`${key}-hint`}>{hintValue}</div>}
      {errorMsg && <p className="govuk-error-message" id={`${key}-error`}><span className="govuk-visually-hidden">Error:</span> {errorMsg}</p>}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:4, flexWrap:'wrap' }}>
        <div style={{ flex:'0 0 34%', minWidth:260, maxWidth:420, position:'relative' }}>
          <input
            id={key}
            name={key}
            type="text"
            className={`govuk-input${isSigned ? ' sig-locked' : ''}`}
            style={{
              width:'100%',
              background:'#fff',
              border:'2px solid #0b0c0c',
              borderRadius:6,
              padding:`${pad.py}px ${pad.px}px`,
              fontFamily: isSigned ? handwritingFont : undefined,
              fontSize: isSigned ? '1.25rem' : undefined,
              textAlign:'center',
              minHeight: pad.minHeight,
              boxShadow:'0 1px 2px rgba(0,0,0,0.08)'
            }}
            value={isSigned ? signedName : localName}
            onChange={e => { if (!isSigned) setLocalName(e.target.value); }}
            placeholder={placeholder}
            readOnly={isSigned}
            aria-describedby={[hintValue ? `${key}-hint` : null, errorMsg ? `${key}-error` : null].filter(Boolean).join(' ') || undefined}
            aria-invalid={errorMsg ? 'true' : undefined}
            required={required}
          />
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, height: pad.minHeight }}>
          {!isSigned && <button type="button" className="govuk-button" style={{ margin:0, height: pad.minHeight, display:'flex', alignItems:'center', justifyContent:'center' }} disabled={!canSign} onClick={doSign}>{actionLabel}</button>}
          {isSigned && <button type="button" className="govuk-button govuk-button--warning" style={{ margin:0, height: pad.minHeight, display:'flex', alignItems:'center', justifyContent:'center' }} onClick={doClear}>{clearLabel}</button>}
        </div>
        <div className="govuk-hint signature-ack__status" style={{ flexBasis:'100%', marginTop:4 }}>{isSigned ? statusSigned : statusUnsigned}</div>
      </div>
    </div>
  );
}

// Adaptor for summary-list component so admin preview uses portal SummaryList with current collected answers
const SummaryListAdapter = ({ comp, answers, lang }) => {
  const Comp = PortalRegistry['summary-list'];
  if (!Comp) return null;
  return <Comp comp={comp} values={answers} lang={lang} />;
};

const GRAPH_NODE_W = 236;
const GRAPH_NODE_H = 86;
const DISPLAY_ONLY_TYPES = new Set([
  'paragraph',
  'text-block',
  'summary-list',
  'panel',
  'inset-text',
  'warning-text',
  'details',
  'accordion',
  'label',
]);

const elk = new ELK();

const formatOptionLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const summarizeEdgeLabels = (labels, hasDefault) => {
  const uniqueLabels = Array.from(new Set((labels || []).filter(Boolean)));
  let summary = '';
  if (uniqueLabels.length === 1) {
    summary = uniqueLabels[0];
  } else if (uniqueLabels.length === 2) {
    summary = uniqueLabels.join(', ');
  } else if (uniqueLabels.length > 2) {
    summary = `${uniqueLabels.slice(0, 2).join(', ')} +${uniqueLabels.length - 2}`;
  }
  if (hasDefault) summary = summary ? `${summary}; default` : 'Default';
  return summary.length > 56 ? `${summary.slice(0, 53)}...` : summary;
};

const WorkflowStepNode = ({ data, selected }) => (
  <div className={`workflow-preview-node${data.isStart ? ' workflow-preview-node--start' : ''}${selected ? ' workflow-preview-node--selected' : ''}`}>
    <Handle type="target" position={data.targetPosition} className="workflow-preview-node__handle" />
    <div className="workflow-preview-node__meta">
      <span>{data.stepLabel}</span>
      {data.isStart && <span className="workflow-preview-node__badge">Start</span>}
    </div>
    <div className="workflow-preview-node__title" title={data.label}>
      {data.label}
    </div>
    <Handle type="source" position={data.sourcePosition} className="workflow-preview-node__handle" />
  </div>
);

const workflowNodeTypes = { workflowStep: WorkflowStepNode };

async function buildGraph(selectedWorkflow, direction = 'DOWN') {
  if (!selectedWorkflow) return { nodes: [], edges: [] };
  const steps = Array.isArray(selectedWorkflow.steps) ? selectedWorkflow.steps : [];
  const routes = Array.isArray(selectedWorkflow.routes) ? selectedWorkflow.routes : [];

  const idSet = new Set(steps.map(s => s.id));
  const start = steps.find(s => s.is_start) || steps[0] || null;

  const adj = new Map();
  for (const s of steps) adj.set(s.id, []);
  const edgeMap = new Map();

  const pushEdge = (src, tgt, label, { isDefault = false, isBranch = false } = {}) => {
    if (!src || !tgt || !idSet.has(src) || !idSet.has(tgt)) return;
    const key = `${src}->${tgt}`;
    const nexts = adj.get(src) || [];
    if (!nexts.includes(tgt)) nexts.push(tgt);
    adj.set(src, nexts);
    const existing = edgeMap.get(key) || { source: String(src), target: String(tgt), labels: [], hasDefault: false, isBranch: false };
    if (label) existing.labels.push(label);
    existing.hasDefault = existing.hasDefault || isDefault;
    existing.isBranch = existing.isBranch || isBranch;
    edgeMap.set(key, existing);
  };

  const routeSequence = new Map();
  const visitedOrder = [];
  if (start) {
    const q = [start.id];
    const seen = new Set([start.id]);
    while (q.length) {
      const current = q.shift();
      visitedOrder.push(current);
      const route = routes.find((candidate) => candidate.source_step_id === current);
      if (!route) continue;
      const nextIds = [];
      if (route.mode === 'by_option') {
        (Array.isArray(route.options) ? route.options : []).forEach((option) => {
          if (option?.next_step_id) nextIds.push(option.next_step_id);
        });
      }
      if (route.default_next_step_id) nextIds.push(route.default_next_step_id);
      nextIds.forEach((nextId) => {
        if (!idSet.has(nextId) || seen.has(nextId)) return;
        seen.add(nextId);
        q.push(nextId);
      });
    }
  }
  steps.forEach((step) => {
    if (!visitedOrder.includes(step.id)) visitedOrder.push(step.id);
  });
  visitedOrder.forEach((stepId, index) => routeSequence.set(stepId, index + 1));

  for (const r of routes) {
    if (!r || !r.source_step_id) continue;
    if (r.mode === 'linear') {
      if (r.default_next_step_id) pushEdge(r.source_step_id, r.default_next_step_id);
    } else if (r.mode === 'by_option') {
      const opts = Array.isArray(r.options) ? r.options : [];
      for (const o of opts) {
        pushEdge(r.source_step_id, o.next_step_id, formatOptionLabel(o.option_value), { isBranch: true });
      }
      if (r.default_next_step_id) pushEdge(r.source_step_id, r.default_next_step_id, '', { isDefault: true, isBranch: true });
    }
  }

  const rawEdges = [];
  let i = 0;
  for (const edge of edgeMap.values()) {
    rawEdges.push({
      ...edge,
      id: `preview-edge-${i++}`,
      label: summarizeEdgeLabels(edge.labels, edge.hasDefault),
      fullLabel: [...edge.labels, edge.hasDefault ? 'Default' : null].filter(Boolean).join(', '),
    });
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction === 'RIGHT' ? 'RIGHT' : 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': direction === 'RIGHT' ? '118' : '92',
      'elk.spacing.nodeNode': direction === 'RIGHT' ? '48' : '44',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.edgeRouting': 'ORTHOGONAL'
    },
    children: steps.map(s => ({ id: String(s.id), width: GRAPH_NODE_W, height: GRAPH_NODE_H })),
    edges: rawEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
  };

  const nodePosition = {
    sourcePosition: direction === 'RIGHT' ? Position.Right : Position.Bottom,
    targetPosition: direction === 'RIGHT' ? Position.Left : Position.Top,
  };

  const makeNode = (step, position) => ({
    id: String(step.id),
    type: 'workflowStep',
    data: {
      label: step.name,
      isStart: Boolean(step.is_start),
      stepLabel: `Step ${routeSequence.get(step.id) || ''}`.trim(),
      sourcePosition: nodePosition.sourcePosition,
      targetPosition: nodePosition.targetPosition,
    },
    position,
    ...nodePosition,
    style: { width: GRAPH_NODE_W, height: GRAPH_NODE_H },
  });

  const makeEdge = (edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    label: edge.label || undefined,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    className: [
      'workflow-preview-edge',
      edge.isBranch ? 'workflow-preview-edge--branch' : 'workflow-preview-edge--linear',
      edge.hasDefault ? 'workflow-preview-edge--default' : '',
    ].filter(Boolean).join(' '),
    labelBgPadding: [8, 4],
    labelBgBorderRadius: 6,
    labelBgStyle: { fill: '#ffffff', fillOpacity: 0.96 },
    labelStyle: {
      fill: edge.isBranch ? '#0f172a' : '#424650',
      fontSize: 11,
      fontWeight: edge.isBranch ? 600 : 500,
    },
    data: { fullLabel: edge.fullLabel },
  });

  try {
    const laid = await elk.layout(elkGraph);
    const byId = new Map((laid.children || []).map(c => [c.id, c]));
    const rfNodes = steps.map(step => makeNode(step, {
      x: byId.get(String(step.id))?.x || 0,
      y: byId.get(String(step.id))?.y || 0,
    }));
    return { nodes: rfNodes, edges: rawEdges.map(makeEdge) };
  } catch {
    const rfNodes = steps.map((step, idx) => makeNode(step, {
      x: direction === 'RIGHT' ? idx * (GRAPH_NODE_W + 96) : (idx % 3) * (GRAPH_NODE_W + 72),
      y: direction === 'RIGHT' ? (idx % 3) * (GRAPH_NODE_H + 54) : Math.floor(idx / 3) * (GRAPH_NODE_H + 68),
    }));
    return { nodes: rfNodes, edges: rawEdges.map(makeEdge) };
  }
}

const WorkflowPreviewWidget = ({ selectedWorkflow, actions, toggleHelpPanel, HelpContent }) => {
  const [{ nodes, edges }, setGraph] = useState({ nodes: [], edges: [] });
  const rfRef = React.useRef(null);
  const containerRef = React.useRef(null);
  const graphTouchedRef = React.useRef(false);
  const [mode, setMode] = useState('graph'); // graph | interactive | summary | json
  const [graphDirection, setGraphDirection] = useState('DOWN');
  const [previewLang, setPreviewLang] = useState('en'); // 'en' | 'fr'
  const [runtime, setRuntime] = useState(null); // { steps, meta }
  const [runner, setRunner] = useState({ stepIndex: 0, answers: {}, errors: {}, warnings: {}, history: [] });
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const errorSummaryRef = React.useRef(null);
  const focusErrorSummaryNext = React.useRef(false);
  const [showAnswers, setShowAnswers] = useState(false);
  // Load runtime schema only when workflow changes (retain answers & position when switching modes)
  useEffect(() => {
    if (!selectedWorkflow) {
      setRuntime(null);
      setRunner({ stepIndex: 0, answers: {}, errors: {}, warnings: {}, history: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch(`/api/workflows/${selectedWorkflow.id}/preview`);
        if (!cancelled) {
          if (resp.ok) {
            const data = await resp.json();
            setRuntime(data);
            setRunner({ stepIndex: 0, answers: {}, errors: {}, warnings: {}, history: [] });
          } else {
            setRuntime({ error: 'Failed to load runtime schema' });
          }
        }
      } catch (e) {
        if (!cancelled) setRuntime({ error: 'Failed to load runtime schema' });
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWorkflow]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const g = await buildGraph(selectedWorkflow, graphDirection);
      if (!cancelled) {
        graphTouchedRef.current = false;
        setGraph(g);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedWorkflow, graphDirection]);

  const fitGraph = useCallback((padding = 0.18) => {
    const instance = rfRef.current;
    if (!instance) return;
    requestAnimationFrame(() => {
      try {
        instance.fitView({ padding, includeHiddenNodes: true, duration: 240 });
      } catch {
        // React Flow may not be ready on the first paint.
      }
    });
  }, []);

  const onRFInit = React.useCallback((inst) => {
    rfRef.current = inst;
    fitGraph();
  }, [fitGraph]);

  useEffect(() => {
    if (mode !== 'graph' || !nodes.length) return;
    graphTouchedRef.current = false;
    fitGraph();
  }, [edges.length, fitGraph, mode, nodes.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!graphTouchedRef.current) fitGraph(0.2);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitGraph]);

  // Interactive helpers
  const steps = useMemo(() => (Array.isArray(runtime?.steps) ? runtime.steps : []), [runtime]);
  const hasSummaryList = useMemo(() => {
    if (!steps.length) return false;
    return steps.some(s => Array.isArray(s.components) && s.components.some(c => c && c.type === 'summary-list'));
  }, [steps]);

  // If current mode is summary but no summary list exists anymore, fallback to graph
  useEffect(() => {
    if (mode === 'summary' && !hasSummaryList) setMode('graph');
  }, [mode, hasSummaryList]);
  const currentStep = steps[runner.stepIndex] || null;
  const answers = runner.answers;
  const componentLookup = useMemo(() => buildConditionComponentLookup(steps), [steps]);

  const componentIsVisible = useCallback((component, currentAnswers) => {
    if (!component || typeof component !== 'object') return false;
    if (!componentSupportsConditionalVisibility(component)) return true;
    return componentConditionsSatisfied(component, currentAnswers, componentLookup);
  }, [componentLookup]);

  const currentStepComponents = useMemo(() => {
    const components = [];
    visitComponentTree(currentStep?.components || [], (component) => {
      components.push(component);
    });
    return components;
  }, [currentStep]);

  const hiddenConditionalKeys = useMemo(() => {
    const hidden = new Set();
    currentStepComponents.forEach((component) => {
      if (!componentSupportsConditionalVisibility(component)) return;
      if (componentIsVisible(component, answers)) return;
      const key = component.storageKey || component.id;
      if (key) hidden.add(key);
    });
    return hidden;
  }, [answers, componentIsVisible, currentStepComponents]);

  useEffect(() => {
    if (!hiddenConditionalKeys.size) return;
    setRunner((previous) => {
      let changed = false;
      const nextAnswers = { ...previous.answers };
      const nextErrors = { ...previous.errors };
      const nextWarnings = { ...(previous.warnings || {}) };
      hiddenConditionalKeys.forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(nextAnswers, key)) {
          delete nextAnswers[key];
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(nextErrors, key)) {
          delete nextErrors[key];
          changed = true;
        }
        if (Object.prototype.hasOwnProperty.call(nextWarnings, key)) {
          delete nextWarnings[key];
          changed = true;
        }
      });
      return changed ? { ...previous, answers: nextAnswers, errors: nextErrors, warnings: nextWarnings } : previous;
    });
  }, [hiddenConditionalKeys]);

  const componentWouldRender = useCallback((component, currentAnswers) => {
    if (!component || typeof component !== 'object') return false;
    if (!componentIsVisible(component, currentAnswers)) return false;
    const type = String(component.type || '').toLowerCase();
    if (PortalRegistry[type] || type === 'warning-text' || type === 'signature-ack') return true;
    if (Array.isArray(component.children) && component.children.some((child) => componentWouldRender(child, currentAnswers))) {
      return true;
    }
    if (Array.isArray(component.options)) {
      return component.options.some((option) =>
        optionRevealChildren(option).some((child) => componentWouldRender(child, currentAnswers))
      );
    }
    return false;
  }, [componentIsVisible]);

  const stepHasVisibleContent = useCallback((stepObj, currentAnswers) => {
    if (!stepObj || typeof stepObj !== 'object') return false;
    const description = stepObj.description;
    const hasDescription =
      (typeof description === 'string' && description.trim().length > 0) ||
      (!!description &&
        typeof description === 'object' &&
        Object.values(description).some((value) => typeof value === 'string' && value.trim().length > 0));
    if (hasDescription) return true;
    return Array.isArray(stepObj.components)
      ? stepObj.components.some((component) => componentWouldRender(component, currentAnswers))
      : false;
  }, [componentWouldRender]);

  const resolveNextStepIndex = useCallback((fromIndex, currentAnswers) => {
    const sourceStep = steps[fromIndex];
    if (!sourceStep) return -1;
    let nextStepId = null;
    if (Array.isArray(sourceStep.branching)) {
      for (const branch of sourceStep.branching) {
        try {
          if (jsonLogic.apply(branch?.condition, currentAnswers)) {
            nextStepId = branch?.nextStepId;
            break;
          }
        } catch {
          // Ignore malformed branch rules in preview.
        }
      }
    }
    if (!nextStepId && sourceStep.defaultNextStepId) nextStepId = sourceStep.defaultNextStepId;
    if (!nextStepId && sourceStep.nextStepId) nextStepId = sourceStep.nextStepId;
    if (nextStepId) {
      const nextIndex = steps.findIndex((candidateStep) => candidateStep.stepId === nextStepId);
      if (nextIndex !== -1) return nextIndex;
    }
    return fromIndex < steps.length - 1 ? fromIndex + 1 : -1;
  }, [steps]);

  const findNextVisibleStepIndex = useCallback((fromIndex, currentAnswers) => {
    const visited = new Set([fromIndex]);
    let candidateIndex = resolveNextStepIndex(fromIndex, currentAnswers);
    while (candidateIndex !== -1 && !visited.has(candidateIndex)) {
      const candidateStep = steps[candidateIndex];
      if (stepHasVisibleContent(candidateStep, currentAnswers)) return candidateIndex;
      visited.add(candidateIndex);
      candidateIndex = resolveNextStepIndex(candidateIndex, currentAnswers);
    }
    return -1;
  }, [resolveNextStepIndex, stepHasVisibleContent, steps]);

  const visibleStepIndices = useMemo(() => {
    const indices = steps.reduce((acc, stepObj, idx) => {
      if (stepHasVisibleContent(stepObj, answers)) acc.push(idx);
      return acc;
    }, []);
    return indices.length ? indices : steps.map((_, idx) => idx);
  }, [answers, stepHasVisibleContent, steps]);

  const hasVisibleNextStep = useMemo(
    () => findNextVisibleStepIndex(runner.stepIndex, answers) !== -1,
    [answers, findNextVisibleStepIndex, runner.stepIndex]
  );
  const currentVisibleStepIndex = visibleStepIndices.indexOf(runner.stepIndex);
  const currentVisibleStepNumber = currentVisibleStepIndex >= 0 ? currentVisibleStepIndex + 1 : 1;
  const totalVisibleSteps = visibleStepIndices.length || 1;

  useEffect(() => {
    if (!steps.length) return;
    if (stepHasVisibleContent(currentStep, answers)) return;
    const nextVisible = visibleStepIndices[0];
    if (!Number.isInteger(nextVisible) || nextVisible === runner.stepIndex) return;
    setRunner((previous) => ({ ...previous, stepIndex: nextVisible, history: [], errors: {}, warnings: {} }));
  }, [answers, currentStep, runner.stepIndex, stepHasVisibleContent, steps.length, visibleStepIndices]);

  const collectActiveComponents = useCallback((stepObj, currentAnswers) => {
    const active = [];
    const visit = (component) => {
      if (!component || !componentIsVisible(component, currentAnswers)) return;
      active.push(component);
      if (Array.isArray(component.children)) component.children.forEach((child) => visit(child));
      const type = String(component.type || '').toLowerCase();
      if (type !== 'radio' && type !== 'checkbox' && type !== 'checkboxes') return;
      const key = component.storageKey || component.id;
      const selected = currentAnswers[key];
      const selectedSet = new Set(Array.isArray(selected) ? selected.map(String) : [String(selected)]);
      const options = Array.isArray(component.options) ? component.options : [];
      options.forEach((option) => {
        if (!selectedSet.has(String(option.value))) return;
        optionRevealChildren(option).forEach((child) => visit(child));
      });
    };
    (Array.isArray(stepObj?.components) ? stepObj.components : []).forEach((component) => visit(component));
    return active;
  }, [componentIsVisible]);

  const activeComponents = useMemo(
    () => collectActiveComponents(currentStep, answers),
    [answers, collectActiveComponents, currentStep]
  );

  const flattenComponents = useCallback((stepObj) => {
    const list = [];
    visitComponentTree(stepObj?.components || [], (component) => {
      list.push(component);
    });
    return list;
  }, []);

  const msgFor = (m) => {
    if (!m) return '';
    if (typeof m === 'string') return m;
    if (typeof m === 'object') return m[previewLang] || m.en || m.fr || Object.values(m).find(x => typeof x === 'string') || '';
    return String(m);
  };
  function migrateValidation(raw){
    if(!raw||typeof raw!=='object') return { required:false, rules:[] };
    const v = JSON.parse(JSON.stringify(raw));
    if(!v.requiredMessage && v.errorMessage){
      if(typeof v.errorMessage==='object') v.requiredMessage = v.errorMessage; else v.requiredMessage = { en: v.errorMessage, fr: v.errorMessage };
    }
    if(v.pattern){
      const exists = Array.isArray(v.rules)&&v.rules.some(r=> (r.type||r.kind)==='pattern');
      if(!exists){ v.rules = [...(v.rules||[]), { id:'auto-pattern', type:'pattern', trigger:['submit'], pattern:v.pattern }]; }
      delete v.pattern;
    }
    if(v.minLength){
      const exists = Array.isArray(v.rules)&&v.rules.some(r=> (r.type||r.kind)==='length');
      if(!exists){ v.rules = [...(v.rules||[]), { id:'auto-length', type:'length', trigger:['submit'], minLength:v.minLength }]; }
      delete v.minLength;
    }
    if(Array.isArray(v.rules)){
      v.rules = v.rules.map(r=>{ if(!r) return r; const out={...r}; if(!out.type && out.kind) out.type=out.kind; if(out.type==='atLeastOne' && Array.isArray(out.keys) && !out.fields) out.fields=out.keys; if(!Array.isArray(out.trigger)||!out.trigger.length) out.trigger=['submit']; if(!out.severity) out.severity='error'; if(out.block===undefined) out.block= out.severity==='error'; return out; });
    } else v.rules=[];
    return v;
  }
  const FILE_UPLOAD_VALUE_KEYS = ['filePath', 'file_path', 'path', 'key', 'fileId', 'file_id', 'name', 'originalFilename', 'original_filename'];
  function hasFileUploadValue(val){
    if (val === undefined || val === null) return false;
    if (typeof val === 'string') return false;
    if (typeof val === 'number') return Number.isFinite(val);
    if (Array.isArray(val)) return val.some(hasFileUploadValue);
    if (typeof val === 'object') {
      return FILE_UPLOAD_VALUE_KEYS.some((k) => {
        const v = val[k];
        if (v === undefined || v === null) return false;
        if (typeof v === 'string') return v.trim() !== '';
        if (typeof v === 'number') return Number.isFinite(v);
        return false;
      });
    }
    return false;
  }
  function extractDateInputParts(value) {
    if (value === undefined || value === null) return { empty: true };
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return { empty: true };
      const match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!match) return { empty: false, complete: false };
      return { empty: false, complete: true, year: match[1], month: match[2], day: match[3] };
    }
    if (typeof value === 'object' && !Array.isArray(value)) {
      const day = String(value.day || value.d || '').trim();
      const month = String(value.month || value.m || '').trim();
      const year = String(value.year || value.y || '').trim();
      if ([day, month, year].every(part => part === '')) return { empty: true };
      return { empty: false, complete: Boolean(day && month && year && year.length === 4), day, month, year };
    }
    return { empty: false, complete: false };
  }
  function validateDateInputValue(value) {
    const parts = extractDateInputParts(value);
    if (parts.empty) return { ok: false, reason: 'empty' };
    if (!parts.complete) return { ok: false, reason: 'incomplete' };
    if (!/^\d{1,2}$/.test(parts.day) || !/^\d{1,2}$/.test(parts.month) || !/^\d{4}$/.test(parts.year)) {
      return { ok: false, reason: 'invalid' };
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return { ok: false, reason: 'invalid' };
    if (month < 1 || month > 12) return { ok: false, reason: 'invalid' };
    const maxDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (day < 1 || day > maxDay) return { ok: false, reason: 'invalid' };
    return { ok: true };
  }
  function valueIsEmpty(val, compType){
    if (String(compType || '').toLowerCase() === 'file-upload') return !hasFileUploadValue(val);
    const type = String(compType || '').toLowerCase();
    if (type === 'date' || type === 'date-input') return extractDateInputParts(val).empty;
    if(val==null) return true; if(typeof val==='string') return val.trim()===''; if(Array.isArray(val)) return val.length===0; return false;
  }
  function mergedLogicData(stepObj){
    const data = { ...answers };
    const comps = activeComponents.length && stepObj === currentStep ? activeComponents : flattenComponents(stepObj);
    comps.forEach(c=>{
      const sk = c.storageKey || c.id; const id = c.id; if(sk && id){ const val = answers[sk]; if(val!==undefined && data[id]===undefined) data[id]=val; if(answers[id]!==undefined && data[sk]===undefined) data[sk]=answers[id]; }
    });
    return data;
  }
  function evaluateRule(rule, comp, value, data){
    const type = rule.type || rule.kind;
    const failMsg = ()=> msgFor(rule.message) || '';
    try {
      switch(type){
        case 'predicate': {
          if(!rule.when) return { failed:false }; const res = !!jsonLogic.apply(rule.when, data); return res ? { failed:true, message: failMsg() || 'Invalid' } : { failed:false };
        }
        case 'atLeastOne': {
          const fields = Array.isArray(rule.fields)?rule.fields:[]; const ok = fields.some(f=>{ const v=data[f]; if(v==null) return false; if(Array.isArray(v)) return v.length>0; if(typeof v==='object') return Object.keys(v).length>0; return String(v).trim()!==''; }); return ok?{failed:false}:{failed:true,message:failMsg()||'Provide at least one value.'};
        }
        case 'range': {
          if(valueIsEmpty(value, comp?.type)) return { failed:false }; const num=Number(value); if(!Number.isFinite(num)) return { failed:false }; if(rule.min!=null && num<rule.min) return { failed:true, message: failMsg()||`Value must be ≥ ${rule.min}`}; if(rule.max!=null && num>rule.max) return { failed:true, message: failMsg()||`Value must be ≤ ${rule.max}`}; return { failed:false };
        }
        case 'length': {
          if(typeof value!=='string'||value==='') return { failed:false }; if(rule.minLength!=null && value.length<rule.minLength) return { failed:true, message: failMsg()||`Minimum ${rule.minLength} characters.`}; if(rule.maxLength!=null && value.length>rule.maxLength) return { failed:true, message: failMsg()||`Maximum ${rule.maxLength} characters.`}; return { failed:false };
        }
        case 'pattern': { if(typeof value!=='string'||value==='') return { failed:false }; if(!rule.pattern) return { failed:false }; try { const re=new RegExp(rule.pattern, rule.flags||''); if(!re.test(value)) return { failed:true, message: failMsg()||'Invalid format.' }; } catch { return { failed:false }; } return { failed:false }; }
        case 'compare': { const resolve=o=> (typeof o==='string' && Object.prototype.hasOwnProperty.call(data,o))?data[o]:o; const l=resolve(rule.left); const r=resolve(rule.right); const op=rule.op; let ok=true; switch(op){ case '==': ok = l === r; break; case '!=': ok = l !== r; break; case '>': ok = Number(l)>Number(r); break; case '>=': ok = Number(l)>=Number(r); break; case '<': ok = Number(l)<Number(r); break; case '<=': ok = Number(l)<=Number(r); break; default: ok=true; } if(!ok) return { failed:true, message: failMsg()||'Values do not match.' }; return { failed:false }; }
        default: return { failed:false };
      }
    } catch { return { failed:false }; }
  }
  function evaluateChangeRules(comp, nextVal){
    focusErrorSummaryNext.current = false; // live feedback shouldn't shift focus
    const k = comp.storageKey || comp.id; if(!k) return;
    const rawValidation = (() => {
      const base = (comp.validation && typeof comp.validation === 'object') ? JSON.parse(JSON.stringify(comp.validation)) : {};
      const fromProps = (comp.props && comp.props.validation && typeof comp.props.validation === 'object') ? comp.props.validation : null;
      if (fromProps) {
        // Only fill fields missing in base (so DB-promoted values win)
        if (base.requiredMessage == null && fromProps.requiredMessage != null) base.requiredMessage = fromProps.requiredMessage;
        if (base.rules == null && Array.isArray(fromProps.rules)) base.rules = JSON.parse(JSON.stringify(fromProps.rules));
        else if (Array.isArray(base.rules) && Array.isArray(fromProps.rules)) {
          // Merge by id (keep existing first)
            const seen = new Set(base.rules.map(r=>r&&r.id));
            fromProps.rules.forEach(r=>{ if(r && r.id && !seen.has(r.id)) base.rules.push(r); });
        }
        if (base.required == null && fromProps.required != null) base.required = fromProps.required;
      }
      return base;
    })();
    const migrated = migrateValidation(rawValidation);
    const rules = migrated.rules || [];
    const data = { ...mergedLogicData(currentStep), [k]: nextVal };
    let firstError=null; let warning=null;
    for(const r of rules){
      const triggers = Array.isArray(r.trigger)?r.trigger:['submit'];
      if(!triggers.includes('change')) continue;
      const { failed, message } = evaluateRule(r, comp, nextVal, data);
      if(failed){
        if((r.severity||'error')==='warn') { warning = message; continue; }
        firstError = message || 'Invalid'; break;
      }
    }
    setRunner(r=>{ const errors={...r.errors}; if(firstError) errors[k]=firstError; else delete errors[k]; const warnings={...(r.warnings||{})}; if(warning) warnings[k]=warning; else delete warnings[k]; if(firstError && r.errors[k]!==firstError){ setLiveAnnouncement(`${comp.label ? (typeof comp.label==='object'? (comp.label.en||Object.values(comp.label)[0]) : comp.label)+': ':''}${firstError}`);} else if(!firstError && r.errors[k]){ setLiveAnnouncement(''); } return { ...r, errors, warnings }; });
  }
  const setAnswer = (comp, value) => {
    const key = comp.storageKey || comp.id;
    setRunner(r => ({ ...r, answers: { ...r.answers, [key]: value } }));
    setTimeout(()=> evaluateChangeRules(comp, value),0);
  };
  const validateStep = () => {
    if(!currentStep) return {};
    focusErrorSummaryNext.current = true;
    const data = mergedLogicData(currentStep);
    const compList = activeComponents;
    const errs={}; const warns={};
    compList.forEach(c=>{
      const k = c.storageKey || c.id; if(!k) return; const val = answers[k];
      const type = String(c.type || '').toLowerCase();
      if (DISPLAY_ONLY_TYPES.has(type) || type === 'signature-ack') return;
      const rawValidation = (() => {
        const base = (c.validation && typeof c.validation === 'object') ? JSON.parse(JSON.stringify(c.validation)) : {};
        const fromProps = (c.props && c.props.validation && typeof c.props.validation === 'object') ? c.props.validation : null;
        if (fromProps) {
          if (base.requiredMessage == null && fromProps.requiredMessage != null) base.requiredMessage = fromProps.requiredMessage;
          if (base.rules == null && Array.isArray(fromProps.rules)) base.rules = JSON.parse(JSON.stringify(fromProps.rules));
          else if (Array.isArray(base.rules) && Array.isArray(fromProps.rules)) {
            const seen = new Set(base.rules.map(r=>r&&r.id));
            fromProps.rules.forEach(r=>{ if(r && r.id && !seen.has(r.id)) base.rules.push(r); });
          }
          if (base.required == null && fromProps.required != null) base.required = fromProps.required;
        }
        return base;
      })();
      const migrated = migrateValidation(rawValidation || {});
  const isReq = c.required || (c.props && c.props.required) || migrated.required;
      if(isReq && valueIsEmpty(val, c?.type)){
        const reqMsg = migrated.requiredMessage ? msgFor(migrated.requiredMessage) : (migrated.errorMessage ? msgFor(migrated.errorMessage) : 'This field is required');
        errs[k]=reqMsg; return; // skip further rules
      }
      if ((type === 'date' || type === 'date-input') && !valueIsEmpty(val, c?.type)) {
        const dateCheck = validateDateInputValue(val);
        if (!dateCheck.ok) {
          const dateMsg = migrated.requiredMessage ? msgFor(migrated.requiredMessage) : (migrated.errorMessage ? msgFor(migrated.errorMessage) : 'Enter a valid date.');
          errs[k] = dateMsg || 'Enter a valid date.';
          return;
        }
      }
      for(const r of migrated.rules){
        const triggers = Array.isArray(r.trigger)?r.trigger:['submit'];
        if(!triggers.includes('submit')) continue;
        const { failed, message } = evaluateRule(r, c, val, data);
        if(failed){
          if((r.severity||'error')==='warn'){ if(!warns[k]) warns[k]=message||'Check value'; continue; }
          errs[k]=message||'Invalid'; if(r.block!==false) break; // stop further rules
        }
      }
    });
    setRunner(r => ({ ...r, errors: errs, warnings: warns }));
    return errs;
  };
  const next = () => {
    const errs = validateStep();
    if (Object.keys(errs).length) return;
    if (!currentStep) return;
    const nextIndex = findNextVisibleStepIndex(runner.stepIndex, answers);
    if (nextIndex >= 0) {
      setRunner(r => ({
        ...r,
        history: [...r.history, r.stepIndex],
        stepIndex: nextIndex,
        errors: {},
        warnings: {}
      }));
      setShowAnswers(false);
      return;
    }
    setShowAnswers(true);
    setMode('json');
    setRunner(r => ({ ...r }));
  };
  const back = () => {
    setRunner(r => {
      if (!r.history.length) return r; // nothing to go back to
      const newHistory = [...r.history];
      const prevIdx = newHistory.pop();
      return { ...r, stepIndex: prevIdx, history: newHistory, errors: {}, warnings: {} };
    });
    setShowAnswers(false);
  };

  // Error summary focus management
  useEffect(()=>{
    const hasErrors = Object.keys(runner.errors||{}).length>0;
    if(hasErrors && focusErrorSummaryNext.current && errorSummaryRef.current){
      try{ errorSummaryRef.current.focus(); }catch{}
      focusErrorSummaryNext.current=false;
    }
  }, [runner.errors]);

  function anchorIdFor(comp){
    const key = comp.storageKey || comp.id; const type = String(comp.type||'').toLowerCase();
    if(type==='radio'||type==='checkbox'||type==='checkboxes') return `${key}-0`;
    if(type==='date'||type==='date-input') return `${key}-day`;
    return key;
  }

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
                options={(() => {
                  const base = [
                    { id: 'graph', text: 'Graph' },
                    { id: 'interactive', text: 'Interactive' }
                  ];
                  if (hasSummaryList) base.push({ id: 'summary', text: 'Summary' });
                  base.push({ id: 'json', text: 'Output JSON' });
                  return base;
                })()}
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
          items={[
            { id: 'lang-en', text: 'English' },
            { id: 'lang-fr', text: 'Français' },
            { id: 'layout-down', text: 'Graph: Vertical layout' },
            { id: 'layout-right', text: 'Graph: Horizontal layout' },
            { id: 'remove', text: 'Remove' }
          ]}
          ariaLabel="Workflow preview settings"
          variant="icon"
          onItemClick={({ detail }) => {
            if (!detail || !detail.id) return;
            switch (detail.id) {
              case 'lang-en':
                setPreviewLang('en');
                break;
              case 'lang-fr':
                setPreviewLang('fr');
                break;
              case 'layout-down':
                setGraphDirection('DOWN');
                break;
              case 'layout-right':
                setGraphDirection('RIGHT');
                break;
              case 'remove':
                actions && actions.removeItem && actions.removeItem();
                break;
              default:
                break;
            }
          }}
        />
      }
  >
      <div className="workflow-preview-shell">
        {!selectedWorkflow && (
          <div style={{ color: '#888' }}>Select a workflow to preview</div>
        )}
        {selectedWorkflow && mode === 'graph' && (
          <div ref={containerRef} className="workflow-preview-graph">
            <ReactFlow
              onInit={onRFInit}
              nodes={nodes}
              edges={edges}
              nodeTypes={workflowNodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              panOnDrag={true}
              selectionOnDrag={false}
              zoomOnScroll
              zoomOnPinch
              zoomOnDoubleClick={false}
              minZoom={0.08}
              maxZoom={2.4}
              fitView
              fitViewOptions={{ padding: 0.18 }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              onMoveStart={() => { graphTouchedRef.current = true; }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#d8dee8" gap={22} size={1} />
              <Controls
                showInteractive={false}
                onFitView={() => {
                  graphTouchedRef.current = false;
                  fitGraph();
                }}
              />
              <MiniMap
                className="workflow-preview-minimap"
                pannable
                zoomable
                nodeColor={(node) => (node?.data?.isStart ? '#0972d3' : '#d9e2ec')}
                maskColor="rgba(15, 23, 42, 0.08)"
              />
            </ReactFlow>
          </div>
        )}
        {selectedWorkflow && mode === 'interactive' && (
          <div style={{ flex: 1, minHeight: 300, border: '1px solid #d8d8d8', borderRadius: 6, background: '#f3f2f1', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!runtime && <div style={{ color: '#888' }}>Loading runtime schema...</div>}
            {runtime?.error && <div style={{ color: '#d4351c' }}>{runtime.error}</div>}
            {runtime && !runtime.error && currentStep && (
              <div>
                <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{currentStep.title?.[previewLang] || currentStep.title?.en || currentStep.stepId}</div>
                  <div style={{ fontSize: 12, color: '#555' }}>{`Step ${currentVisibleStepNumber} of ${totalVisibleSteps}`}</div>
                </div>
                <div className="govuk-width-container" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {/* Live region for change validations */}
                  <div aria-live="polite" className="govuk-visually-hidden">{liveAnnouncement}</div>
                  {Object.keys(runner.errors||{}).length>0 && (
                    <div ref={errorSummaryRef} tabIndex="-1" className="govuk-error-summary" aria-labelledby="wp-error-summary-title" role="alert" style={{marginBottom:16}}>
                      <h2 className="govuk-error-summary__title" id="wp-error-summary-title" style={{fontSize:18}}>There is a problem</h2>
                      <div className="govuk-error-summary__body">
                        <ul className="govuk-list govuk-error-summary__list">
                          {Object.entries(runner.errors).map(([k,m])=>{
                                    const comp = activeComponents.find(c=> (c.storageKey||c.id)===k) || flattenComponents(currentStep).find(c=> (c.storageKey||c.id)===k);
                                    const anchor = comp? anchorIdFor(comp): k;
                                    return <li key={k}><a href={`#${anchor}`}>{m}</a></li>;
                                  })}
                        </ul>
                      </div>
                    </div>
                  )}
                  {(currentStep.components || []).map(c => {
                    const type = c.type;
                    const key = c.storageKey || c.id;
                    if (!componentIsVisible(c, answers)) return null;
                    if (type === 'summary-list') {
                      return <SummaryListAdapter key={c.id} comp={c} answers={answers} lang={previewLang} />;
                    }
                    if (type === 'signature-ack') {
                      const errorMsg = runner.errors[key];
                      return (
                        <SignatureAckPreview
                          key={c.id}
                          comp={c}
                          answerObj={answers[key]}
                          lang={previewLang}
                          setAnswer={setAnswer}
                          errorMsg={errorMsg}
                        />
                      );
                    }
                    // Inline adapter for warning-text (non-input, display-only)
                    if (type === 'warning-text') {
                      const text = (() => {
                        const t = c.text || c.props?.text;
                        if (t && typeof t === 'object') return t[previewLang] || t.en || t.fr || Object.values(t)[0];
                        return t || '';
                      })();
                      const assistive = (() => {
                        const t = c.iconFallbackText || c.props?.iconFallbackText;
                        if (t && typeof t === 'object') return t[previewLang] || t.en || t.fr || Object.values(t)[0];
                        return t || '';
                      })();
                      return (
                        <div key={c.id} className={`govuk-warning-text ${c.classes || c.props?.classes || ''}`} role={c.role || c.props?.role || 'alert'} style={{ marginBottom: 16 }}>
                          <span className="govuk-warning-text__icon" aria-hidden="true">!</span>
                          <strong className="govuk-warning-text__text">
                            {assistive && <span className="govuk-warning-text__assistive">{assistive} </span>}{text}
                          </strong>
                        </div>
                      );
                    }
                    if (type === 'file-upload') {
                      return <FileUploadPreview key={c.id} comp={c} lang={previewLang} />;
                    }
                    const Comp = PortalRegistry[type];
                    if (!Comp) {
                      return (
                        <div key={c.id} style={{ padding: '8px 12px', border: '1px solid #d5dbdb', borderRadius: 6, background: '#fff', color: '#555', fontSize: 12, marginBottom: 12 }}>
                          Unsupported preview renderer: {type}
                        </div>
                      );
                    }
                    const val = answers[key];
                    const renderChild = (child) => {
                      if (!child || !child.type) return null;
                      if (!componentIsVisible(child, answers)) return null;
                      const ChildComp = PortalRegistry[child.type];
                      if (!ChildComp) {
                        return (
                          <div key={child.id || child.storageKey} style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                            [Unsupported: {child.type}]
                          </div>
                        );
                      }
                      const childKey = child.storageKey || child.id;
                      const childVal = answers[childKey];
                      return <ChildComp key={child.id || childKey} comp={child} value={childVal} onChange={v => setAnswer(child, v)} error={runner.errors[childKey]} values={answers} lang={previewLang} />;
                    };
                    return <Comp key={c.id} comp={c} value={val} onChange={v => setAnswer(c, v)} error={runner.errors[key]} values={answers} lang={previewLang} render={renderChild} />;
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button disabled={!runner.history.length} onClick={back}>Back</Button>
                  <Button variant="primary" onClick={next}>{hasVisibleNextStep ? 'Next' : 'Finish'}</Button>
                </div>
                {!hasVisibleNextStep && <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>Finish simulates end of workflow; data not persisted.</div>}
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
        {selectedWorkflow && mode === 'summary' && hasSummaryList && (
          <div style={{ flex: 1, minHeight: 300, border: '1px solid #e0e0e0', borderRadius: 6, background: '#fff', padding: 16, overflow: 'auto' }}>
            {!runtime && <div style={{ color: '#888' }}>Loading summary…</div>}
            {runtime?.error && <div style={{ color: '#d4351c' }}>{runtime.error}</div>}
            {runtime && !runtime.error && (
              <div style={{ maxWidth: 800 }}>
                {(steps || []).filter(s => Array.isArray(s.components) && s.components.some(c => c.type === 'summary-list')).map(s => (
                  <div key={s.stepId || s.id} style={{ marginBottom: 32 }}>
                    <h3 style={{ marginTop: 0 }}>{s.title?.[previewLang] || s.title?.en || 'Summary'}</h3>
                    {s.components.filter(c => c.type === 'summary-list').map(c => (
                      <SummaryListAdapter key={c.id} comp={c} answers={answers} lang={previewLang} />
                    ))}
                  </div>
                ))}
                {!steps.some(s => Array.isArray(s.components) && s.components.some(c => c.type === 'summary-list')) && (
                  <div style={{ color: '#666', fontSize: 14 }}>No summary-list component found.</div>
                )}
                <div style={{ marginTop: 12, fontSize: 12, color: '#555' }}>Values reflect current Interactive answers; open Interactive mode to change them.</div>
              </div>
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
      </div>
    </BoardItem>
  );
};

export default WorkflowPreviewWidget;
