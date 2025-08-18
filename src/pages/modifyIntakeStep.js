import React, { useState, useEffect, useMemo, useRef } from "react";
// Ensure GOV.UK styles are available in-editor
import "../css/govuk-frontend.min.css";
// Initialize GOV.UK behaviours for dynamic previews
import { initAll as govukInitAll } from 'govuk-frontend';
import { DndProvider, useDrag, useDrop, useDragDropManager } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Grid, Box, Header, Button, Container, SpaceBetween, Alert } from "@cloudscape-design/components";
import { useParams, useHistory } from "react-router-dom";
import PropertiesPanel from './PropertiesPanel.js';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5001';

const setComponentConfigValue = (path, value, selectedComponent) => {
  if (!selectedComponent || !selectedComponent.props) return;
  const keys = path.split('.');
  let current = selectedComponent.props;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!(keys[i] in current)) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
};

const ComponentItem = ({ component, onAdd }) => (
  <div
    style={{ padding: "8px", border: "1px solid #ccc", cursor: "pointer" }}
    onClick={() => onAdd(component)}
  >
    {component.label}
  </div>
);

// Only create a DnDProvider if one isn't already present to avoid multiple HTML5Backend instances
const MaybeDndProvider = ({ children }) => {
  let hasProvider = true;
  try {
    // Will throw if not within a DnD context
    useDragDropManager();
  } catch (_) {
    hasProvider = false;
  }
  return hasProvider ? <>{children}</> : <DndProvider backend={HTML5Backend}>{children}</DndProvider>;
};

const PreviewArea = ({ components, setComponents, handleSelectComponent, selectedComponent }) => {
  const moveComponent = (dragIndex, hoverIndex) => {
    setComponents(prevComponents => {
      if (dragIndex < 0 || hoverIndex < 0 || dragIndex >= prevComponents.length || hoverIndex >= prevComponents.length) {
        return prevComponents;
      }
      const updated = [...prevComponents];
      const [moved] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, moved);
      return updated;
    });
  };
  return (
    <div className="stage">
  {components.map((comp, index) => (
        <DraggablePreviewItem
      key={comp?.props?.id || comp?.props?.name || comp?.templateId || `${comp.type}-${index}`}
          index={index}
          comp={comp}
          moveComponent={moveComponent}
          setComponents={setComponents}
          handleSelectComponent={handleSelectComponent}
      selectedComponent={selectedComponent}
        />
      ))}
      {components.length === 0 && (
        <Box color="inherit" textAlign="center" padding="m" variant="div" style={{ color: '#777' }}>
          Drag from the library or click a component to add it here
        </Box>
      )}
    </div>
  );
};

const DraggablePreviewItem = ({ comp, index, moveComponent, setComponents, handleSelectComponent, selectedComponent }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "REORDER_COMPONENT",
    item: { index },
    collect: monitor => ({ isDragging: !!monitor.isDragging() })
  }));

  const [, drop] = useDrop({
    accept: "REORDER_COMPONENT",
    hover: (dragged) => {
      if (dragged.index !== index && dragged.index !== undefined) {
        moveComponent(dragged.index, index);
        dragged.index = index;
      }
    }
  });

  const handleDelete = e => {
    e.stopPropagation();
    setComponents(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (selectedComponent?.index === index) handleSelectComponent(null);
      return updated;
    });
  };

  const handleClick = () => handleSelectComponent(index);

  // Server-rendered GOV.UK component (nunjucks output)
  function useNunjucksHTML({ templateKey, templateId, version = 1, props }) {
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const abortRef = useRef(null);
    const debounceRef = useRef(null);

    useEffect(() => {
      if (!props || !(templateKey || templateId)) { setHtml(''); setError(''); return; }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        if (abortRef.current) abortRef.current.abort();
        const ac = new AbortController(); abortRef.current = ac;
        setLoading(true); setError('');
        try {
          const res = await fetch(`${API_BASE}/api/render/component`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateKey, templateId, version, props }),
            signal: ac.signal
          });
          const txt = await res.text();
          if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
          setHtml(txt);
        } catch (e) {
          if (e.name !== 'AbortError') setError(String(e.message || e));
        } finally {
          setLoading(false);
        }
      }, 150);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
      };
    }, [templateKey, templateId, version, JSON.stringify(props)]);

    return { html, loading, error };
  }

  const RenderComponentCard = ({ comp }) => {
    // Prefer templateId from DB, fall back to key/type.
    const templateId  = comp?.templateId ?? comp?.template_id ?? comp?.id ?? null;
    const templateKey = comp?.template_key ?? comp?.type ?? null;
    const { html, loading, error } = useNunjucksHTML({
      templateId,
      templateKey,
      version: comp?.version ?? 1,
      props: comp?.props || {}
    });
    // Re-init GOV.UK behaviours when new HTML is injected
    useEffect(() => {
      try { if (typeof govukInitAll === 'function') govukInitAll(); } catch (_) {}
    }, [html]);
    if (!templateId && !templateKey) {
      return <div className="govuk-hint" style={{ color: '#b00' }}>Missing template reference</div>;
    }
    if (error) return <div className="govuk-hint" style={{ color: '#b00' }}>Render error: {error}</div>;
  if (loading && !html) return <div className="govuk-hint">Rendering…</div>;
    return <div className="govuk-embedded" dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div
      ref={node => drag(drop(node))}
      className={`stage-card${selectedComponent?.index === index ? ' selected' : ''}`}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'grab', opacity: isDragging ? 0.9 : 1 }}
      onClick={e => {
        if (selectedComponent?.index !== index) handleSelectComponent(index);
        e.stopPropagation();
      }}
    >
      <div className="handle" style={{ padding: 5, fontWeight: 'bold', userSelect: 'none' }}>⠿</div>
      <div
        onClick={handleClick}
        style={{
          flex: 1,
          // Keep rendered content clear of the drag handle (left) and delete icon (right)
          paddingLeft: 28,
          paddingRight: 36,
        }}
      >
        <RenderComponentCard comp={comp} />
      </div>
      <Button className="delete" onClick={handleDelete} iconName="close" variant="icon" />
    </div>
  );
};

const ModifyComponent = () => {
  const [components, setComponents] = useState([]);
  const [initialComponents, setInitialComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  // DB-only model (no file paths)
  // template lookups (filled after library fetch)
  const tplById = useMemo(() => new Map(availableComponents.map(t => [t.id, t])), [availableComponents]);
  const { id } = useParams();
  const history = useHistory();
  const [alert, setAlert] = useState(null);
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');
  const [initialName, setInitialName] = useState('');
  const [initialStatus, setInitialStatus] = useState('');
  // compute hasChanges (deep) to gate buttons
  const hasChanges = useMemo(() => {
    const a = { name, status, components };
    const b = { name: initialName, status: initialStatus, components: initialComponents };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [name, status, components, initialName, initialStatus, initialComponents]);

  useEffect(() => {
    if (id === 'new') {
      setComponents([]);
      setName('Untitled BlockStep');
      setStatus('active');
      setInitialComponents([]);
      setInitialName('Untitled BlockStep');
      setInitialStatus('active');
      setLoading(false);
    } else if (id) {
      // DB-backed step load
      const fetchStep = async () => {
        try {
          const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps/${id}`);
          if (res.status === 404) {
            // Step not found: initialize a draft instead of failing
            setAlert({ type: 'warning', message: `Step ${id} not found. Starting a new draft.` });
            setName('Untitled BlockStep');
            setStatus('active');
            setComponents([]);
            setInitialComponents([]);
            setInitialName('Untitled BlockStep');
            setInitialStatus('active');
            return; // finally still runs (loading -> false)
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          setName(data.name || 'Untitled BlockStep');
          setStatus(data.status || 'active');
          setInitialName(data.name || 'Untitled BlockStep');
          setInitialStatus(data.status || 'active');
          const comps = Array.isArray(data.components) ? data.components : [];
          // Dedupe by name/id to avoid accidental duplicates from prior saves
          const seen = new Set();
          const deduped = comps.filter(c => {
            const key = `${c?.props?.name || ''}::${c?.props?.id || ''}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setComponents(deduped);
          setInitialComponents(deduped);
        } catch (e) {
          console.error('Failed to load step', e);
        } finally {
          setLoading(false);
        }
      };
      fetchStep();
    }
  }, [id]);

  useEffect(() => {
    const fetchAvailableComponents = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/component-templates`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const parsed = data
          .filter(t => t.status === 'active')
          .map(t => ({
            id: t.id,
            type: t.type,
            label: t.label,
            description: t.description ?? '',
            props: JSON.parse(JSON.stringify(t.props || {})),
            editable_fields: t.editable_fields || [],
            has_options: !!t.has_options,
            option_schema: t.option_schema || null,
            template_key: t.key,
            version: t.version
          }));
        setAvailableComponents(parsed);
      } catch (err) {
        console.error('Failed to load component templates:', err);
        setAvailableComponents([]);
      }
    };
    fetchAvailableComponents();
  }, []);

  // Enrich components (loaded from DB) with template metadata once templates are known.
  useEffect(() => {
    if (!components.length || !availableComponents.length) return;
    setComponents(prev =>
      prev.map(c => {
        // if already enriched, keep as-is
        if (c.editable_fields && c.editable_fields.length) return c;
        const tpl =
          tplById.get(c.templateId ?? c.template_id ?? c.id) ||
          availableComponents.find(t => t.template_key === c.template_key || t.type === c.type);
        if (!tpl) return c;
        return {
          ...c,
          type: c.type ?? tpl.type,
          label: c.label ?? tpl.label,
          template_key: c.template_key ?? tpl.template_key,
          version: c.version ?? tpl.version,
          editable_fields: tpl.editable_fields || [],
          has_options: !!tpl.has_options,
          option_schema: tpl.option_schema || null
        };
      })
    );
  }, [components.length, availableComponents, tplById]);

  const handleSelectComponent = index => {
    setSelectedComponent(
      index !== null
        ? {
            ...components[index],
            index,
            props: {
              ...components[index].props,
              items: components[index].props?.items ?? [],
              mode: components[index].props?.props?.mode || 'static',
              endpoint: components[index].props?.props?.endpoint || null
            },
            // surface schema to properties panel (merge from template if missing)
            editable_fields: (() => {
              const existing = components[index].editable_fields;
              if (existing && existing.length) return existing;
              const tpl =
                tplById.get(
                  components[index].templateId ?? components[index].template_id ?? components[index].id
                ) ||
                availableComponents.find(
                  t => t.template_key === components[index].template_key || t.type === components[index].type
                );
              return tpl?.editable_fields || [];
            })()
          }
        : null
    );
  };

  function setNestedProp(obj, path, value) {
    if (!path) return;
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
  }

  const updateComponentProperty = (path, value, isNested = false) => {
    if (!selectedComponent) return;
    setComponents(prev => {
      const newComponents = prev.map((comp, idx) => {
        if (idx !== selectedComponent.index) return comp;
        const updatedProps = { ...comp.props };
        if (isNested) setNestedProp(updatedProps, path, value); else updatedProps[path] = value;
        return { ...comp, props: updatedProps };
      });
      setSelectedComponent(prevSel => prevSel ? { ...newComponents[selectedComponent.index], index: selectedComponent.index } : null);
      return newComponents;
    });
    setInitialComponents([]);
  };

  // normalise editor components to API payload
  const toApiComponents = (arr) =>
    (Array.isArray(arr) ? arr : []).map(c => ({
      templateId: c.templateId ?? c.template_id ?? c.id, // be forgiving
      props: c.props || {}
    }));

  const handleSaveTemplate = async () => {
    // DB-only save of step JSON
    try {
      const payload = { name, status, components: toApiComponents(components) };
      if (id === 'new') {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
        setAlert({ type: 'success', message: 'Created new Step.' });
        history.push(`/modify-component/${out.id}`);
      } else {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
        setAlert({ type: 'success', message: 'Saved changes.' });
      }
      setInitialComponents(components);
      setInitialName(name);
      setInitialStatus(status);
    } catch (e) {
      console.error('Save step failed', e);
      setAlert({ type: 'error', message: 'Failed to save step.' });
    }
  };

  const handleSaveAsNew = async () => {
    try {
      const payload = { name: `${name} (copy)`, status, components: toApiComponents(components) };
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
      setAlert({ type: 'success', message: 'Copied as new Step.' });
      history.push(`/modify-component/${out.id}`);
    } catch (e) {
      console.error('Save-as-new failed', e);
      setAlert({ type: 'error', message: 'Failed to create copy.' });
    }
  };

  const handleDelete = async () => {
    if (id === 'new') return;
    if (!window.confirm('Delete this step? This cannot be undone.')) return;
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/steps/${id}`, { method: 'DELETE' });
      const out = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setAlert({ type: 'warning', message: out?.error || 'Step is referenced by a workflow.' });
        return;
      }
      if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
      setAlert({ type: 'success', message: 'Step deleted.' });
      history.push('/modify-component/new');
    } catch (e) {
      console.error('Delete step failed', e);
      setAlert({ type: 'error', message: 'Failed to delete step.' });
    }
  };

  const handleCancel = () => history.push('/manage-components');

  /* existing state & effects unchanged */

  return (
    <MaybeDndProvider>
      <style>{`
        .stage { padding: 8px; background: #fafafa; min-height: 160px; border: 1px dashed #d5dbdb; }
        .stage-card { background:#fff; border:1px solid #d5dbdb; border-radius:8px; padding:12px; margin-bottom:12px; position:relative; }
        .stage-card.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
        .stage-card .handle { cursor:grab; position:absolute; left:8px; top:8px; opacity:0.6; }
        .stage-card .delete { cursor:pointer; position:absolute; right:8px; top:8px; opacity:0.7; }
  .stage .govuk-embedded { background:#fff; }
        /* GOV.UK background normalised inside editor */
        .stage .govuk-form-group { margin-bottom: 20px; }
        .stage .govuk-label, .stage .govuk-fieldset__legend { margin-bottom: 5px; }
      `}</style>
      <Container
        header={
          <Header
            variant="h2"
            description="Modify the intake step components"
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={handleCancel}>Cancel</Button>
                {id !== 'new' && <Button onClick={handleSaveAsNew} variant="normal">Save as New</Button>}
                {id !== 'new' && <Button onClick={handleDelete} variant="normal">Delete</Button>}
                <Button onClick={handleSaveTemplate} disabled={!hasChanges} variant="primary">Save Changes</Button>
              </SpaceBetween>
            }
          >
            Modify Intake Step
          </Header>
        }
      >
        {alert && (
          <Alert
            dismissible
            statusIconAriaLabel={alert.type === 'success' ? 'Success' : 'Error'}
            type={alert.type}
            onDismiss={() => setAlert(null)}
          >
            {alert.message}
          </Alert>
        )}
        <Grid gridDefinition={[{ colspan: 2 }, { colspan: 6 }, { colspan: 4 }]}>
          <Box padding="m">
            <Header variant="h3">Library</Header>
            {availableComponents.map((comp, index) => (
              <ComponentItem
                key={index}
                component={comp}
  onAdd={component => {
                  // Deep clone to avoid shared nested references between added components
                  const defaultProps = JSON.parse(JSON.stringify(component.props || {}));
                  if (Array.isArray(component.props?.items)) {
                    defaultProps.items = [...component.props.items];
                  }

                  // Sanitize defaults to avoid showing error state by default
                  const typeKey = String(component.type || component.template_key || '').toLowerCase();
                  const stripClasses = (cls, toRemove) => (String(cls || '')
                    .split(/\s+/)
                    .filter(c => c && !toRemove.includes(c))
                    .join(' '));
                  if (typeKey === 'input' || typeKey === 'text' || typeKey === 'email' || typeKey === 'number' || typeKey === 'password' || typeKey === 'phone' || typeKey === 'password-input') {
                    // Remove GOV.UK error classes from formGroup and control
                    if (defaultProps.formGroup && typeof defaultProps.formGroup === 'object') {
                      defaultProps.formGroup.classes = stripClasses(defaultProps.formGroup.classes, ['govuk-form-group--error']);
                    }
                    defaultProps.classes = stripClasses(defaultProps.classes, ['govuk-input--error']);
                    // If errorMessage exists, clear it to avoid macro rendering error state
                    if (defaultProps.errorMessage) {
                      try { delete defaultProps.errorMessage; } catch (_) { defaultProps.errorMessage = { text: '' }; }
                    }
                    // Apply requested alternative defaults
                    // 1) Label classes -> 'govuk-label--m' when not provided
                    if (!defaultProps.label || typeof defaultProps.label !== 'object') {
                      defaultProps.label = { text: (defaultProps.label && defaultProps.label.text) || 'Label', classes: 'govuk-label--m' };
                    } else if (!defaultProps.label.classes || String(defaultProps.label.classes).trim() === '') {
                      defaultProps.label.classes = 'govuk-label--m';
                    }
                    // 2) Hint default text when absent or empty
                    const hintText = defaultProps?.hint?.text;
                    if (!defaultProps.hint || typeof defaultProps.hint !== 'object' || !String(hintText || '').trim()) {
                      defaultProps.hint = { ...(defaultProps.hint || {}), text: 'This is the optional hint text' };
                    }
                  } else if (typeKey === 'radio' || typeKey === 'radios' || typeKey === 'checkbox' || typeKey === 'checkboxes') {
                    // Choice components: clean error state and set helpful defaults
                    if (defaultProps.formGroup && typeof defaultProps.formGroup === 'object') {
                      defaultProps.formGroup.classes = stripClasses(defaultProps.formGroup.classes, ['govuk-form-group--error']);
                    }
                    if (defaultProps.errorMessage) {
                      try { delete defaultProps.errorMessage; } catch (_) { defaultProps.errorMessage = { text: '' }; }
                    }
                    // Ensure fieldset legend with medium size by default
                    if (!defaultProps.fieldset || typeof defaultProps.fieldset !== 'object') {
                      defaultProps.fieldset = { legend: { text: 'Choose one option', classes: 'govuk-fieldset__legend--m' } };
                    } else {
                      const legend = defaultProps.fieldset.legend || {};
                      if (!legend.text) legend.text = 'Choose one option';
                      if (!legend.classes || String(legend.classes).trim() === '') legend.classes = 'govuk-fieldset__legend--m';
                      defaultProps.fieldset.legend = legend;
                    }
                    // Hint default text
                    const hintText = defaultProps?.hint?.text;
                    if (!defaultProps.hint || typeof defaultProps.hint !== 'object' || !String(hintText || '').trim()) {
                      defaultProps.hint = { ...(defaultProps.hint || {}), text: 'This is the optional hint text' };
                    }
                    // Ensure options array with sensible defaults if empty
                    if (!Array.isArray(defaultProps.items) || defaultProps.items.length === 0) {
                      defaultProps.items = [
                        { text: 'Yes', value: 'yes' },
                        { text: 'No', value: 'no' }
                      ];
                    } else {
                      // Normalize existing items to have text/value strings
                      defaultProps.items = defaultProps.items.map((it, idx) => ({
                        text: (it && (it.text || it.html)) ? (it.text || it.html) : `Option ${idx + 1}`,
                        value: typeof it?.value !== 'undefined' ? String(it.value) : ((it && (it.text || it.html)) ? (it.text || it.html) : `opt${idx + 1}`),
                        hint: it && it.hint ? it.hint : undefined,
                      }));
                    }
                  }
                  // Insert with unique name/id to prevent collisions like "input-1"
                  setComponents(prev => {
                    const used = new Set();
                    prev.forEach(c => {
                      const nm = c?.props?.name; if (nm) used.add(String(nm));
                      const idv = c?.props?.id; if (idv) used.add(String(idv));
                    });
                    // Derive a clean, lowercase base from existing name/id/type
                    const toSlug = (s) => String(s || '')
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/(^-|-$)/g, '') || 'field';
                    const basePrefix = toSlug(defaultProps.name || defaultProps.id || component.type || component.template_key || 'field');
                    const makeUnique = (base) => {
                      let candidate = base;
                      if (used.has(candidate)) {
                        const m = candidate.match(/^(.*?)-(\d+)$/);
                        let stem = m ? m[1] : candidate;
                        let i = m ? parseInt(m[2], 10) : 1;
                        do { i += 1; candidate = `${stem}-${i}`; } while (used.has(candidate));
                      }
                      return candidate;
                    };
                    const nameCandidate = makeUnique(basePrefix);
                    const idBase = toSlug(defaultProps.id || basePrefix);
                    const idCandidate = makeUnique(idBase);

                    const propsWithIds = { ...defaultProps, name: nameCandidate, id: idCandidate };

                    const newComponent = {
                      type: component.type,
                      label: component.label,
                      props: propsWithIds,
                      // for backend saves
                      templateId: component.id,
                      // for preview/template lookup
                      template_key: component.template_key, // specify backend template to render
                      // carry schema through so Properties panel can render controls
                      editable_fields: component.editable_fields || [],
                      has_options: component.has_options || false,
                      option_schema: component.option_schema || null
                    };
                    return [...prev, newComponent];
                  });
                }}
              />
            ))}
          </Box>

      <Box padding="m">
            <Header variant="h3">Working Area</Header>
            {!loading && (
              <PreviewArea
                components={components}
                setComponents={setComponents}
                handleSelectComponent={handleSelectComponent}
        selectedComponent={selectedComponent}
              />
            )}
          </Box>

          <Box padding="m">
            <PropertiesPanel
              selectedComponent={selectedComponent}
              updateComponentProperty={updateComponentProperty}
              pageProperties={{ name, status }}
              setPageProperties={({ name, status }) => {
                setName(name);
                setStatus(status);
                setInitialComponents([]);
              }}
            />
          </Box>
        </Grid>
      </Container>
  </MaybeDndProvider>
  );
};
export { setComponentConfigValue };
export default ModifyComponent;
