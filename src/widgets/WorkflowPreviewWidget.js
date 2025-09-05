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
const SummaryListAdapter = ({ comp, answers, lang }) => {
  const Comp = PortalRegistry['summary-list'];
  if (!Comp) return null;
  return <Comp comp={comp} values={answers} lang={lang} />;
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
  const [mode, setMode] = useState('graph'); // graph | interactive | summary | json
  const [previewLang, setPreviewLang] = useState('en'); // 'en' | 'fr'
  const [runtime, setRuntime] = useState(null); // { steps, meta }
  const [runner, setRunner] = useState({ stepIndex: 0, answers: {}, errors: {}, warnings: {}, history: [] });
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const errorSummaryRef = React.useRef(null);
  const focusErrorSummaryNext = React.useRef(false);
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

  // --- Validation (unified schema parity with public portal) --------------
  // Helper: flatten top-level components plus single-level option children (conditional reveals)
  function flattenComponents(stepObj){
    const list = [];
    if(!stepObj || !Array.isArray(stepObj.components)) return list;
    for(const c of stepObj.components){
      if(!c) continue;
      list.push(c);
      if(Array.isArray(c.options)){
        for(const opt of c.options){
          if(opt && Array.isArray(opt.children)){
            for(const ch of opt.children){ if(ch) list.push(ch); }
          }
        }
      }
    }
    return list;
  }
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
  function valueIsEmpty(val){
    if(val==null) return true; if(typeof val==='string') return val.trim()===''; if(Array.isArray(val)) return val.length===0; return false;
  }
  function mergedLogicData(stepObj){
    const data = { ...answers };
    const comps = flattenComponents(stepObj);
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
          if(valueIsEmpty(value)) return { failed:false }; const num=Number(value); if(!Number.isFinite(num)) return { failed:false }; if(rule.min!=null && num<rule.min) return { failed:true, message: failMsg()||`Value must be ≥ ${rule.min}`}; if(rule.max!=null && num>rule.max) return { failed:true, message: failMsg()||`Value must be ≤ ${rule.max}`}; return { failed:false };
        }
        case 'length': {
          if(typeof value!=='string'||value==='') return { failed:false }; if(rule.minLength!=null && value.length<rule.minLength) return { failed:true, message: failMsg()||`Minimum ${rule.minLength} characters.`}; if(rule.maxLength!=null && value.length>rule.maxLength) return { failed:true, message: failMsg()||`Maximum ${rule.maxLength} characters.`}; return { failed:false };
        }
        case 'pattern': { if(typeof value!=='string'||value==='') return { failed:false }; if(!rule.pattern) return { failed:false }; try { const re=new RegExp(rule.pattern, rule.flags||''); if(!re.test(value)) return { failed:true, message: failMsg()||'Invalid format.' }; } catch { return { failed:false }; } return { failed:false }; }
        case 'compare': { const resolve=o=> (typeof o==='string' && Object.prototype.hasOwnProperty.call(data,o))?data[o]:o; const l=resolve(rule.left); const r=resolve(rule.right); const op=rule.op; let ok=true; switch(op){ case '==': ok = l==r; break; case '!=': ok = l!=r; break; case '>': ok = Number(l)>Number(r); break; case '>=': ok = Number(l)>=Number(r); break; case '<': ok = Number(l)<Number(r); break; case '<=': ok = Number(l)<=Number(r); break; default: ok=true; } if(!ok) return { failed:true, message: failMsg()||'Values do not match.' }; return { failed:false }; }
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
  const compList = flattenComponents(currentStep);
    const errs={}; const warns={};
    compList.forEach(c=>{
      const k = c.storageKey || c.id; if(!k) return; const val = answers[k];
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
      if(isReq && valueIsEmpty(val)){
        const reqMsg = migrated.requiredMessage ? msgFor(migrated.requiredMessage) : (migrated.errorMessage ? msgFor(migrated.errorMessage) : 'This field is required');
        errs[k]=reqMsg; return; // skip further rules
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
          history: [...r.history, r.stepIndex],
          stepIndex: idx,
          errors: {},
          warnings: {}
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
          <div style={{ flex: 1, minHeight: 300, border: '1px solid #d8d8d8', borderRadius: 6, background: '#f3f2f1', padding: 16, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {!runtime && <div style={{ color: '#888' }}>Loading runtime schema...</div>}
            {runtime?.error && <div style={{ color: '#d4351c' }}>{runtime.error}</div>}
            {runtime && !runtime.error && currentStep && (
              <div>
                <div style={{ marginBottom: 12, fontWeight: 600, fontSize: 16 }}>{currentStep.title?.[previewLang] || currentStep.title?.en || currentStep.stepId}</div>
                <div className="govuk-width-container" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  {/* Live region for change validations */}
                  <div aria-live="polite" className="govuk-visually-hidden">{liveAnnouncement}</div>
                  {Object.keys(runner.errors||{}).length>0 && (
                    <div ref={errorSummaryRef} tabIndex="-1" className="govuk-error-summary" aria-labelledby="wp-error-summary-title" role="alert" style={{marginBottom:16}}>
                      <h2 className="govuk-error-summary__title" id="wp-error-summary-title" style={{fontSize:18}}>There is a problem</h2>
                      <div className="govuk-error-summary__body">
                        <ul className="govuk-list govuk-error-summary__list">
                          {Object.entries(runner.errors).map(([k,m])=>{
                                    const all = flattenComponents(currentStep);
                                    const comp = all.find(c=> (c.storageKey||c.id)===k);
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
                    if (type === 'summary-list') {
                      return <SummaryListAdapter key={c.id} comp={c} answers={answers} lang={previewLang} />;
                    }
                    const Comp = PortalRegistry[type];
                    if (!Comp) return <div key={c.id} style={{ fontSize: 12, color: '#666' }}>[Unsupported: {type}]</div>;
                    const val = answers[key];
                    const renderChild = (child) => {
                      if (!child || !child.type) return null;
                      const ChildComp = PortalRegistry[child.type];
                      if (!ChildComp) return <div key={child.id || child.storageKey} style={{ fontSize: 12, color: '#666' }}>[Unsupported: {child.type}]</div>;
                      const childKey = child.storageKey || child.id;
                      const childVal = answers[childKey];
                      return <ChildComp key={child.id || childKey} comp={child} value={childVal} onChange={v => setAnswer(child, v)} error={runner.errors[childKey]} values={answers} lang={previewLang} />;
                    };
                    return <Comp key={c.id} comp={c} value={val} onChange={v => setAnswer(c, v)} error={runner.errors[key]} values={answers} lang={previewLang} render={renderChild} />;
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
      </Box>
    </BoardItem>
  );
};

export default WorkflowPreviewWidget;
