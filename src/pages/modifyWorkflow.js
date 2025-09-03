import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Modal, Button, SpaceBetween } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
// Use shared authenticated fetch helper
import { apiFetch } from '../auth/apiClient';
import WorkflowPropertiesEditorWidget from '../widgets/WorkflowPropertiesEditorWidget';
import IntakeStepLibraryWidget from '../widgets/IntakeStepLibraryWidget';
import WorkflowCanvasWidget from '../widgets/WorkflowCanvasWidget';
import StepPropertiesWidget from '../widgets/StepPropertiesWidget';
import { nextStepId, deepCloneRouting, removeStepAndRewire, validateWorkflow } from '../utils/workflowEditorUtils';

// API base from .env (CRA exposes REACT_APP_* at build time)
const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

// ----- Demo library (left panel fallback if API empty) -----
// (removed unused local sample library)

// Start with an empty workflow canvas
const initialSteps = [];
const STORAGE_KEY = 'mw:steps-v1';

// (Step Properties UI moved to widgets/StepPropertiesWidget)

export default function ModifyWorkflowEditorWidget() {
  const [steps, setSteps] = useState(initialSteps);
  const [selectedId, setSelectedId] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  // Workflow meta
  const [wfId, setWfId] = useState(null); // numeric id or null
  const [wfName, setWfName] = useState('');
  const [wfStatus, setWfStatus] = useState('draft');
  // (Summary step auto-toggle removed; authors must add a summary step manually as a normal intake step.)
  const [startUiId, setStartUiId] = useState(null); // UI step id for start
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [library, setLibrary] = useState([]); // loaded from /api/steps
  const [libStatus, setLibStatus] = useState('idle'); // 'idle' | 'loading' | 'error' | 'done'

  // Persist steps to sessionStorage to survive accidental remounts.
  // If no ?id is present (creating a new workflow), start with a blank canvas and clear any stale persisted map.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const idStr = sp.get('id');
      if (!idStr) {
        // New workflow: ensure a blank canvas
        sessionStorage.removeItem(STORAGE_KEY);
        setSteps([]);
        setSelectedId(null);
        setStartUiId(null);
        return;
      }
      // Existing workflow: optionally restore last in-progress canvas
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.length && steps.length === 0) {
          setSteps(saved);
        }
      }
    } catch {}
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Parse ?id= to load existing workflow
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const idStr = sp.get('id');
    const idNum = idStr ? Number(idStr) : null;
    if (idNum && Number.isFinite(idNum)) setWfId(idNum);
    else {
      // New workflow: reset meta state
      setWfId(null);
      setWfName('');
      setWfStatus('draft');
      setStartUiId(null);
    }
  }, []);

  // Load workflow details if wfId present
  useEffect(() => {
    if (!wfId) return;
    let cancelled = false;
    (async () => {
      try {
  const resp = await apiFetch(`/api/workflows/${wfId}`);
  if (!resp.ok) throw new Error(`Load workflow HTTP ${resp.status}`);
  const data = await resp.json();
        if (cancelled) return;
        setWfName(data.name || '');
  setWfStatus(data.status || 'draft');
  // (Removed summary heuristic; existing summary steps load like any other.)
        // Build UI steps from DB steps, assign stable UI ids
        const uiSteps = (data.steps || []).map((s, idx) => ({ id: `S${idx + 1}`, name: s.name, stepId: s.id, routing: { mode: 'linear' } }));
        const byDbToUi = new Map();
        uiSteps.forEach(u => byDbToUi.set(u.stepId, u.id));
        // Attach routing from routes
        for (const r of (data.routes || [])) {
          const srcUi = byDbToUi.get(r.source_step_id);
          if (!srcUi) continue;
          const step = uiSteps.find(s => s.id === srcUi);
          if (!step) continue;
          if (r.mode === 'linear') {
            step.routing = { mode: 'linear', next: r.default_next_step_id ? byDbToUi.get(r.default_next_step_id) : undefined };
          } else if (r.mode === 'by_option') {
            const opts = Array.isArray(r.options) ? r.options : [];
            const mapping = {};
            const values = [];
            for (const o of opts) {
              values.push(String(o.option_value));
              mapping[String(o.option_value)] = byDbToUi.get(o.next_step_id);
            }
            step.routing = { mode: 'byOption', fieldKey: r.field_key || '', options: values, mapping, defaultNext: r.default_next_step_id ? byDbToUi.get(r.default_next_step_id) : undefined };
          }
        }
        setSteps(uiSteps);
        const start = (data.steps || []).find(s => s.is_start);
        if (start) setStartUiId(byDbToUi.get(start.id) || null);
        else {
          // fallback: first node
          setStartUiId(uiSteps[0]?.id || null);
        }
  // Establish baseline now that existing workflow data loaded (no setTimeout needed)
  baselineRef.current = snapshot();
  baselineReadyRef.current = true;
  dirtyRef.current = false;
  setIsDirty(false);
      } catch (e) {
        // If load fails, leave as-is (new)
      }
    })();
    return () => { cancelled = true; };
  }, [wfId]);
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps));
    } catch {}
  }, [steps]);

  // Validation + dirty tracking
  const validation = useMemo(() => validateWorkflow(steps), [steps]);
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const baselineRef = useRef(null);
  const baselineReadyRef = useRef(false);

  const snapshot = useCallback(() => {
    const normSteps = steps.map(s => ({
      id: s.id,
      name: s.name,
      stepId: s.stepId,
      routing: (() => {
        const r = s.routing || { mode: 'linear' };
        if (r.mode === 'linear') return { mode: 'linear', next: r.next || null };
        const mapping = r.mapping || {};
        const sortedKeys = Object.keys(mapping).sort();
        const sortedMapping = {};
        for (const k of sortedKeys) sortedMapping[k] = mapping[k] || null;
        return { mode: 'byOption', fieldKey: r.fieldKey || '', options: Array.isArray(r.options) ? [...r.options] : [], mapping: sortedMapping, defaultNext: r.defaultNext || null };
      })()
    }));
    return { wfName: wfName || '', wfStatus: wfStatus || 'draft', startUiId: startUiId || null, steps: normSteps };
  }, [steps, wfName, wfStatus, startUiId]);

  // Track whether any user-initiated edit has occurred to avoid premature dirty flag
  const userEditRef = useRef(false);
  const markUserEdited = () => { userEditRef.current = true; };

  const recomputeDirty = useCallback(() => {
    if (!baselineReadyRef.current || !baselineRef.current) return; // no baseline yet
    if (!userEditRef.current) return; // suppress until a user edit actually occurs
    try {
      const curr = snapshot();
      const changed = JSON.stringify(curr) !== JSON.stringify(baselineRef.current);
      dirtyRef.current = changed;
      setIsDirty(changed);
      if (window?.DEBUG_WORKFLOW_DIRTY) {
        console.log('[WF Dirty] Recompute', { changed, curr, baseline: baselineRef.current });
      }
    } catch {
      dirtyRef.current = false;
      setIsDirty(false);
    }
  }, [snapshot]);

  // Initialize baseline for new workflow (no id) once.
  useEffect(() => {
    if (baselineReadyRef.current) return;
    if (wfId) return; // existing workflow handled after load
    baselineRef.current = snapshot();
    baselineReadyRef.current = true;
    dirtyRef.current = false;
    setIsDirty(false);
  }, [wfId, snapshot]);

  // Recompute only after baseline established and on dependency change
  useEffect(() => { recomputeDirty(); }, [recomputeDirty, steps, wfName, wfStatus, startUiId]);
  // (Removed auto placeholder summary step effect.)
  // Keyboard affordance: Esc clears selection
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') setSelectedId(null); };
    window.addEventListener('keydown', onKeyDown);
      if (window?.DEBUG_WORKFLOW_DIRTY) {
        console.log('[WF Dirty] Baseline initialised', baselineRef.current);
      }
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Load Step Library from API (/api/steps)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLibStatus('loading');
  const res = await apiFetch('/api/steps', { headers: { Accept: 'application/json' } });
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
    markUserEdited();
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

  const updateStep = useCallback((updated) => { markUserEdited(); setSteps(prev => prev.map(s => (s.id === updated.id ? updated : s))); }, []);
  const deleteStep = useCallback((id) => { markUserEdited(); setSteps(prev => removeStepAndRewire(prev, id)); setSelectedId(curr => (curr === id ? null : curr)); }, []);

  const deleteSelected = useCallback(() => { if (!selectedId) return; setShowDeleteModal(true); }, [selectedId]);

  // Build API payload from UI model
  const toApiPayload = useCallback(() => {
    // Exclude placeholder summary step(s) (no stepId) from persistence
    const realSteps = steps.filter(s => s.stepId);
    const uiToDb = new Map(realSteps.map(s => [s.id, s.stepId]));
    const stepIds = realSteps.map(s => s.stepId);
    // Start step must also be a real step
    const startDbId = startUiId && uiToDb.get(startUiId) ? uiToDb.get(startUiId) : (realSteps[0]?.stepId || null);
    const routes = [];
    for (const s of realSteps) {
    if (window?.DEBUG_WORKFLOW_DIRTY) {
      console.log('[WF Dirty] Saved – baseline reset', baselineRef.current);
    }
      const r = s.routing || {};
      if (r.mode === 'linear') {
        if (r.next && uiToDb.get(r.next)) routes.push({ source_step_id: s.stepId, mode: 'linear', default_next_step_id: uiToDb.get(r.next) || null });
      } else if (r.mode === 'byOption') {
        const options = [];
        const mapping = r.mapping || {};
        const values = Array.isArray(r.options) ? r.options : [];
        for (const v of values) {
          if (mapping[v] && uiToDb.get(mapping[v])) options.push({ option_value: String(v), next_step_id: uiToDb.get(mapping[v]) || null });
        }
        routes.push({ source_step_id: s.stepId, mode: 'by_option', field_key: r.fieldKey || null, default_next_step_id: (r.defaultNext && uiToDb.get(r.defaultNext)) ? uiToDb.get(r.defaultNext) : null, options });
      }
    }
    return { name: wfName || 'Untitled Workflow', status: wfStatus || 'draft', steps: stepIds, start_step_id: startDbId, routes };
  }, [steps, wfName, wfStatus, startUiId]);

  const publishWorkflow = useCallback(async () => {
    if (!wfId) return;
    try {
      setSaving(true); setSaveMsg('');
  await apiFetch(`/api/workflows/${wfId}/publish`, { method: 'POST' });
      setSaveMsg('Published.');
    } catch (e) { setSaveMsg('Publish failed'); }
    finally { setSaving(false); setTimeout(() => setSaveMsg(''), 3000); }
  }, [wfId]);

  const saveWorkflow = useCallback(async () => {
    setSaveMsg('');
    setSaving(true);
    try {
      const body = toApiPayload();
      if (wfId) {
  const resp = await apiFetch(`/api/workflows/${wfId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!resp.ok) throw new Error('Save failed');
        setSaveMsg('Saved.');
      } else {
        const resp = await apiFetch('/api/workflows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!resp.ok) throw new Error('Create failed');
        const created = await resp.json();
        if (created?.id) setWfId(created.id);
        setSaveMsg('Created.');
        // Update URL to include id
        if (created?.id) {
          const u = new URL(window.location.href);
          u.searchParams.set('id', created.id);
          window.history.replaceState({}, '', u.toString());
        }
      }
  // Reset baseline to new saved snapshot
  baselineRef.current = snapshot();
  baselineReadyRef.current = true;
  dirtyRef.current = false;
  setIsDirty(false);
    } catch (e) {
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 3000);
    }
  }, [wfId, toApiPayload, snapshot]);

  // Exclude placeholder summary step from start step options
  const startOptions = steps.filter(s => s.stepId).map(s => ({ label: s.name, value: s.id }));

  const LAYOUT_KEY = 'mw:board-layout-v1';
  // Default layout: top row 4 cols for properties; second row 1/2/1
  const initialItems = [
    { id: 'wfProps', rowSpan: 2, columnSpan: 4, data: { title: 'Workflow Properties' } },
    { id: 'library', rowSpan: 6, columnSpan: 1, data: { title: 'Intake Step Library' } },
    { id: 'canvas', rowSpan: 6, columnSpan: 2, data: { title: 'Working Area' } },
    { id: 'stepProps', rowSpan: 6, columnSpan: 1, data: { title: 'Step Properties' } },
  ];
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (Array.isArray(saved) && saved.every(it => it && it.id && it.rowSpan && it.columnSpan)) return saved;
      }
    } catch {}
    return initialItems;
  });
  useEffect(() => {
    try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const renderItem = (item) => {
    switch (item.id) {
      case 'wfProps':
        return (
          <WorkflowPropertiesEditorWidget
              name={wfName}
              status={wfStatus}
              startUiId={startUiId}
              startOptions={startOptions}
              onChange={(delta) => {
                if (Object.prototype.hasOwnProperty.call(delta, 'name')) { markUserEdited(); setWfName(delta.name); }
                if (Object.prototype.hasOwnProperty.call(delta, 'status')) { markUserEdited(); setWfStatus(delta.status); }
                if (Object.prototype.hasOwnProperty.call(delta, 'startUiId')) { markUserEdited(); setStartUiId(delta.startUiId); }
              }}
            onSave={saveWorkflow}
            onPublish={publishWorkflow}
            saving={saving}
            saveMsg={saveMsg}
            onClear={() => setSaveMsg('')}
            dirty={isDirty}
          />
        );
      case 'library':
        return (
          <IntakeStepLibraryWidget
            items={library}
            status={libStatus}
            apiBase={API_BASE}
            onAdd={addFromLibrary}
          />
        );
      case 'canvas':
        return (
          <WorkflowCanvasWidget
            steps={steps}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onDelete={() => setShowDeleteModal(true)}
            errorsByStep={validation.byStep}
            startId={startUiId}
          />
        );
      case 'stepProps':
        return (
          <StepPropertiesWidget
            apiBase={API_BASE}
            steps={steps}
            selectedId={selectedId}
            workflowId={wfId}
            onChange={(updated) => setSteps(prev => prev.map(s => (s.id === updated.id ? updated : s)))}
            onDelete={(id) => { setSteps(prev => removeStepAndRewire(prev, id)); setSelectedId(curr => (curr === id ? null : curr)); }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Box padding="m">
  {/* Summary auto-toggle removed */}
      <Board
        renderItem={renderItem}
        items={items}
        onItemsChange={(e) => setItems(e.detail.items)}
        i18nStrings={{
          liveAnnouncementDndStarted: (operationType) =>
            operationType === 'resize' ? 'Resizing' : 'Dragging',
          liveAnnouncementDndItemReordered: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
          },
          liveAnnouncementDndItemResized: (operation) => {
            const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
            const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
            const sizeAnnouncement = operation.direction === 'horizontal'
              ? `columns ${operation.placement.width}${columnsConstraint}`
              : `rows ${operation.placement.height}${rowsConstraint}`;
            return `Item resized to ${sizeAnnouncement}.`;
          },
          liveAnnouncementDndItemInserted: (operation) => {
            const columns = `column ${operation.placement.x + 1}`;
            const rows = `row ${operation.placement.y + 1}`;
            return `Item inserted to ${columns}, ${rows}.`;
          },
          liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
          liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          liveAnnouncementItemRemoved: (op) => `Removed item ${op.item.data.title}.`,
          navigationAriaLabel: 'Board navigation',
          navigationAriaDescription: 'Click on non-empty item to move focus over',
          navigationItemAriaLabel: (item) => (item ? item.data.title : 'Empty'),
        }}
      />
      {/* Delete confirmation modal */}
      <Modal
        visible={showDeleteModal}
        header="Delete Step"
        onDismiss={() => setShowDeleteModal(false)}
        footer={
          <SpaceBetween size="xs" direction="horizontal">
            <Button onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { if (selectedId) { setSteps(prev => removeStepAndRewire(prev, selectedId)); setSelectedId(null); } setShowDeleteModal(false); }}>Delete</Button>
          </SpaceBetween>
        }
      >
        Are you sure you want to delete this step? This action cannot be undone.
      </Modal>
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

// (Removed page-level ResizeObserver error suppression; handled globally in src/index.js during development)

// Manage summary step insertion/removal side-effect outside component return for clarity
// (Placed after export for readability – executed on module load? Not desired) => Move into component scope above if needed.
