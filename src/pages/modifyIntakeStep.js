import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from "react";
// Ensure GOV.UK styles are available in-editor
import "../css/govuk-frontend.min.css";
// Initialize GOV.UK behaviours for dynamic previews
import { initAll as govukInitAll } from 'govuk-frontend';
import { DndProvider, useDrag, useDrop, useDragDropManager } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Grid, Box, Header, Button, Container, SpaceBetween, Alert, ExpandableSection, SegmentedControl } from "@cloudscape-design/components";
import { useParams, useHistory, useLocation } from "react-router-dom";
import PropertiesPanel from './PropertiesPanel.js';
import TranslationsWidget from '../widgets/TranslationsWidget';

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

const PreviewArea = ({ components, setComponents, handleSelectComponent, selectedComponent, previewLang = 'en' }) => {
  // Flatten bilingual { en, fr } to strings for display safety
  const flattenTranslations = (val, lang = 'en') => {
    const isLangObj = (v) => v && typeof v === 'object' && (
      Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'fr')
    );
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (Array.isArray(val)) return val.map(v => flattenTranslations(v, lang));
    if (isLangObj(val)) return String(val[lang] ?? val.en ?? val.fr ?? '');
    if (val && typeof val === 'object') {
      const out = Array.isArray(val) ? [] : {};
      for (const [k, v] of Object.entries(val)) out[k] = flattenTranslations(v, lang);
      return out;
    }
    return val;
  };
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
    key={(comp?.templateId || comp?.template_id || comp?.id || comp?.props?.id || comp?.props?.name || `${comp.type}-${index}`) + `-${index}`}
          index={index}
      comp={comp}
          moveComponent={moveComponent}
          setComponents={setComponents}
          handleSelectComponent={handleSelectComponent}
    selectedComponent={selectedComponent}
    previewLang={previewLang}
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

const DraggablePreviewItem = ({ comp, index, moveComponent, setComponents, handleSelectComponent, selectedComponent, previewLang = 'en' }) => {
  const handleRef = useRef(null);
  const pendingFocusTargetRef = useRef(null); // stores original mousedown target when selecting
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "REORDER_COMPONENT",
    item: { index },
    collect: monitor => ({ isDragging: !!monitor.isDragging() })
  }));
  // Apply drag behaviour only to the handle, not the whole card, so text selection isn't hijacked
  useEffect(() => { if (handleRef.current) drag(handleRef.current); }, [drag]);

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

  const RenderComponentCard = React.memo(({ comp, previewLang = 'en', pendingFocusTargetRef, isSelected }) => {
    // Flatten any bilingual values like { en, fr } down to a single string for preview rendering
    const flattenTranslations = (val, lang = 'en') => {
      const isLangObj = (v) => v && typeof v === 'object' && (
        Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'fr')
      );
      const pickLang = (v) => {
        // Prefer requested language, then English, then French, then text/html fields, else empty string
        if (typeof v === 'string' || typeof v === 'number') return String(v);
        if (isLangObj(v)) {
          const cand = v[lang] ?? v.en ?? v.fr;
          return typeof cand === 'string' || typeof cand === 'number' ? String(cand) : '';
        }
        if (v && typeof v === 'object') {
          // if it is a GOV.UK macro object like { text: '...', html: '...' }, keep as object
          // but recurse into its values
          const out = Array.isArray(v) ? [] : {};
          if (Array.isArray(v)) {
            for (const item of v) out.push(flattenTranslations(item, lang));
            return out;
          }
          for (const [k, val2] of Object.entries(v)) out[k] = flattenTranslations(val2, lang);
          return out;
        }
        return v;
      };
      return pickLang(val);
    };

    // Prefer templateId from DB, fall back to key/type.
    const templateId  = comp?.templateId ?? comp?.template_id ?? comp?.id ?? null;
    const templateKey = comp?.template_key ?? comp?.type ?? null;
    // Prepare props for preview (strings only)
  const previewProps = useMemo(() => flattenTranslations(comp?.props || {}, previewLang), [comp?.props, previewLang]);
    const { html, loading, error } = useNunjucksHTML({
      templateId,
      templateKey,
      version: comp?.version ?? 1,
      props: previewProps
    });
    const containerRef = useRef(null);

    // Re-init GOV.UK behaviours when new HTML is injected
    // Initialise GOV.UK only once (global) to avoid repeated DOM mutations that can steal focus
  useEffect(() => {
      if (!html) return;
      if (!window.__govukOnce) {
        try {
          if (document?.body && !document.body.classList.contains('govuk-frontend-supported')) {
            document.body.classList.add('govuk-frontend-supported');
          }
          if (typeof govukInitAll === 'function') govukInitAll();
          window.__govukOnce = true;
    } catch (e) { /* silent */ }
      }
    }, [html]);

    // Inline editing effect (runs every render; guarded inside)
    // Use layout effect so we can attach editing before paint to reduce focus races
  useLayoutEffect(() => {
      if (!html) return; // nothing to edit yet
      if (!containerRef.current) return;
      const root = containerRef.current;
      const isSelectedCurrent = selectedComponent?.index === index;
      // If not selected, ensure we remove editing affordances (once) then exit
      if (!isSelectedCurrent) {
        Array.from(root.querySelectorAll('[data-inline-edit]')).forEach(el => {
          el.removeAttribute('data-inline-edit');
          el.removeAttribute('contenteditable');
          el.onblur = null;
          el.onkeydown = null;
          el.style.outline = '';
          el.style.outlineOffset = '';
          el.classList.remove('inline-edit-target');
        });
        return;
      }
      // Skip if already initialised and no pending focus request
      if (root.querySelector('[data-inline-edit]') && !pendingFocusTargetRef?.current) {
        return; // preserve focus, nothing to change
      }

      const type = String(comp.type || comp.template_key || '').toLowerCase();

      const attach = (el, path, options = {}) => {
        if (!el) return;
        const { htmlMode = false, allowEnter = false, transformOut } = options;
        // Skip if already initialised for this path
        if (el.getAttribute('data-inline-edit') === path) return;
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('data-inline-edit', path);
        el.classList.add('inline-edit-target');
        el.style.outline = '2px dashed #0972d3';
        el.style.outlineOffset = '2px';
        el.setAttribute('tabindex', '0');
        const debugInline = !!window.__ISET_DEBUG_INLINE_EDIT;
        if (el.tagName === 'LABEL') {
          const origFor = el.getAttribute('for');
          if (origFor) {
            el.dataset.inlineEditFor = origFor;
            el.removeAttribute('for');
            if (debugInline) console.log('[InlineEdit] removed label for', origFor); // eslint-disable-line no-console
          }
          // No pointer suppression so caret can appear; removing 'for' is sufficient to stop focus jump.
        }
        // Ensure text is selectable even if parent containers set user-select:none
        el.style.userSelect = 'text';
        // Click-to-focus caret placement (works even if selection logic already ran)
        el.addEventListener('click', () => {
          if (selectedComponent?.index === index) {
            if (document.activeElement !== el) el.focus();
            try {
              const sel = window.getSelection();
              if (sel) {
                const r = document.createRange();
                r.selectNodeContents(el);
                r.collapse(false);
                sel.removeAllRanges();
                sel.addRange(r);
              }
            } catch (_) { /* ignore */ }
          }
        });
        if (debugInline) {
          el.addEventListener('keydown', (e) => {
            console.log('[InlineEdit] keydown', e.key); // eslint-disable-line no-console
          });
        }
        const readValue = () => {
          let txt = htmlMode ? el.innerHTML : (el.innerText || el.textContent || '');
          if (transformOut) txt = transformOut(txt, { el, htmlMode });
          return htmlMode ? txt.trim() : txt.trim();
        };
        const commit = () => {
          // Restore label 'for' attribute after editing ends
          if (el.tagName === 'LABEL' && el.dataset.inlineEditFor) {
            el.setAttribute('for', el.dataset.inlineEditFor);
            if (debugInline) console.log('[InlineEdit] restored label for', el.dataset.inlineEditFor); // eslint-disable-line no-console
            delete el.dataset.inlineEditFor;
          }
          const value = readValue();
          setComponents(prev => prev.map((c, i) => {
            if (i !== index) return c;
            const next = { ...c, props: { ...(c.props || {}) } };
            const parts = path.split('.');
            let cur = next.props;
            for (let pi = 0; pi < parts.length - 1; pi++) {
              const key = parts[pi];
              if (!cur[key] || typeof cur[key] !== 'object') cur[key] = {};
              cur = cur[key];
            }
            const leaf = parts[parts.length - 1];
            const existing = cur[leaf];
            if (existing && typeof existing === 'object' && (existing.en || existing.fr)) {
              cur[leaf] = { ...existing, [previewLang]: value };
            } else {
              cur[leaf] = value;
            }
            return next;
          }));
        };
        el.onblur = commit;
  el.onkeydown = (e) => { if (!allowEnter && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); el.blur(); } };
      };

      try {
        if (!root) return;
        if (['paragraph','inset-text','warning-text'].includes(type)) {
          const selector = type === 'inset-text' ? '.govuk-inset-text' : (type === 'warning-text' ? '.govuk-warning-text__text' : 'p, h1, h2, h3, h4');
          const el = root.querySelector(selector);
          attach(el, 'text');
        } else {
          const legend = root.querySelector('.govuk-fieldset__legend');
          if (legend) attach(legend, 'fieldset.legend.text');
          // Panel (confirmation panel) support: titleText + html body
          const panelTitle = root.querySelector('.govuk-panel__title');
          if (panelTitle) attach(panelTitle, 'titleText');
          const panelBody = root.querySelector('.govuk-panel__body');
          if (panelBody) attach(panelBody, 'html', { htmlMode: true, allowEnter: true });
          const label = root.querySelector('label.govuk-label:not(.govuk-radios__label):not(.govuk-checkboxes__label)');
          if (label) {
            // Debug instrumentation: observe if this label node gets replaced (character-count suspected)
            if (window.__ISET_DEBUG_INLINE_EDIT && !label.dataset.inlineEditObserved) {
              try {
                const obsTarget = label.parentElement || root;
                const mo = new MutationObserver(muts => {
                  muts.forEach(m => {
                    if ([...m.removedNodes].includes(label)) {
                      console.log('[InlineEdit][Observer] Label node removed from DOM'); // eslint-disable-line no-console
                    }
                    if ([...m.addedNodes].some(n => n.nodeType === 1 && n.matches && n.matches('label.govuk-label'))) {
                      console.log('[InlineEdit][Observer] New label node added', m); // eslint-disable-line no-console
                    }
                  });
                });
                mo.observe(obsTarget, { childList: true, subtree: true });
                label.dataset.inlineEditObserved = '1';
              } catch (_) { /* ignore */ }
            }
            // Dynamically determine correct path for this component's label text.
            // Common patterns:
            //  - props.label.text (GOV.UK inputs, character-count, etc.)
            //  - props.label (string) (some simpler templates)
            //  - props.text (standalone label component template)
            let labelPath = 'label.text';
            try {
              const p = comp?.props || {};
              if (type === 'label') {
                if (typeof p.text === 'string') labelPath = 'text';
                else if (typeof p.label === 'string') labelPath = 'label';
              } else {
                if (p.label && typeof p.label === 'string') labelPath = 'label';
                else if (!(p.label && typeof p.label === 'object' && Object.prototype.hasOwnProperty.call(p.label, 'text')) && typeof p.text === 'string' && !p.fieldset) {
                  // Fallback: if no label.text structure but top-level text exists and no fieldset legend, edit that.
                  labelPath = 'text';
                }
              }
            } catch (_) { /* ignore */ }
            // Additional heuristic: character-count macro sometimes uses label.text but editing failed; log and try alternatives.
            const debug = !!window.__ISET_DEBUG_INLINE_EDIT;
            if (debug) {
              // eslint-disable-next-line no-console
              console.log('[InlineEdit] attach attempt', { componentType: type, chosenPath: labelPath, hasLabelObj: !!comp?.props?.label, labelIsString: typeof comp?.props?.label === 'string', labelHTML: label.innerHTML });
            }
            attach(label, labelPath);
            // Fallbacks: if after first attach the attribute isn't set (edge template), try alternate common paths.
            if (!label.getAttribute('data-inline-edit')) {
              const fallbackPaths = [];
              if (labelPath !== 'label') fallbackPaths.push('label');
              if (labelPath !== 'text') fallbackPaths.push('text');
              if (labelPath !== 'label.text') fallbackPaths.push('label.text');
              for (const fp of fallbackPaths) {
                attach(label, fp);
                if (label.getAttribute('data-inline-edit')) {
                  if (debug) console.log('[InlineEdit] fallback path used', fp); // eslint-disable-line no-console
                  break;
                }
              }
            } else if (debug) {
              // eslint-disable-next-line no-console
              console.log('[InlineEdit] attached ok', label.getAttribute('data-inline-edit'));
            }
          }
          const hint = root.querySelector('.govuk-hint:not(.govuk-radios__hint):not(.govuk-checkboxes__hint)');
          if (hint) attach(hint, 'hint.text');
          if (['radio','radios','checkbox','checkboxes'].includes(type)) {
            // Attach editors to each option label's text (items[i].text) without allowing structure changes
            const optionLabels = root.querySelectorAll('.govuk-radios__item label.govuk-radios__label, .govuk-checkboxes__item label.govuk-checkboxes__label');
            optionLabels.forEach((lab, i) => {
              attach(lab, `items.${i}.text`);
              // Prevent toggling the underlying input while editing text
              lab.addEventListener('mousedown', e => { if (lab.getAttribute('data-inline-edit')) e.preventDefault(); });
            });
          }
        }
  } catch (err) { /* silent */ }

      // After attaching editors, if there is a pending focus target (user clicked directly on text when selecting), focus it now.
  if (pendingFocusTargetRef?.current && containerRef.current?.contains(pendingFocusTargetRef.current)) {
        // Find the nearest editable ancestor
        let focusEl = pendingFocusTargetRef.current;
        while (focusEl && focusEl !== containerRef.current && !focusEl.getAttribute?.('data-inline-edit')) {
          focusEl = focusEl.parentNode;
        }
        if (focusEl && focusEl.getAttribute && focusEl.getAttribute('data-inline-edit')) {
          try {
            // Delay focus to next frame to avoid race with selection re-render
            requestAnimationFrame(() => {
              try {
                focusEl.focus();
                const range = document.createRange();
                range.selectNodeContents(focusEl);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
                if (window.__ISET_DEBUG_INLINE_EDIT) console.log('[InlineEdit] primary focus applied'); // eslint-disable-line no-console
              } catch (e2) { /* silent */ }
            });
            // Secondary delayed retry (covers cases where GOV.UK JS moves focus, e.g., character-count auto JS)
            setTimeout(() => {
              if (document.activeElement !== focusEl) {
                try {
                  focusEl.focus();
                  const r2 = document.createRange();
                  r2.selectNodeContents(focusEl);
                  r2.collapse(false);
                  const sel2 = window.getSelection();
                  sel2.removeAllRanges();
                  sel2.addRange(r2);
                  if (window.__ISET_DEBUG_INLINE_EDIT) console.log('[InlineEdit] secondary focus retry'); // eslint-disable-line no-console
                } catch (_) {}
              }
            }, 80);
          } catch (e) { /* silent */ }
        }
      }
      if (pendingFocusTargetRef) pendingFocusTargetRef.current = null;
    }, [html, selectedComponent?.index, index, comp, previewLang, setComponents]);

    let inner;
    if (!templateId && !templateKey) inner = <div className="govuk-hint" style={{ color: '#b00' }}>Missing template reference</div>;
    else if (error) inner = <div className="govuk-hint" style={{ color: '#b00' }}>Render error: {error}</div>;
    else if (loading && !html) inner = <div className="govuk-hint">Rendering…</div>;
    else inner = <div dangerouslySetInnerHTML={{ __html: html }} />;

    // Stop clicks inside editable text from bubbling to card (avoid unintended selection logic)
    useEffect(() => {
      const root = containerRef.current;
      if (!root) return;
      const handler = (e) => {
        const el = e.target.closest('[data-inline-edit]');
        if (el) {
          e.stopPropagation();
        }
      };
      root.addEventListener('click', handler, true);
      return () => root.removeEventListener('click', handler, true);
    }, [html]);

    return <div ref={containerRef} className="govuk-embedded">{inner}</div>;
  }, (prev, next) => {
    // Custom props equality to avoid needless re-renders
    return prev.comp === next.comp && prev.previewLang === next.previewLang && prev.isSelected === next.isSelected;
  });

  return (
    <div
      ref={node => drop(node)}
      className={`stage-card${selectedComponent?.index === index ? ' selected' : ''}`}
      style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: isDragging ? 0.9 : 1 }}
      onMouseDown={e => {
        if (selectedComponent?.index !== index) {
          pendingFocusTargetRef.current = e.target;
        }
        const lbl = e.target.closest && e.target.closest('label.govuk-label');
        if (lbl && !lbl.hasAttribute('data-inline-edit')) {
          // Only prevent default before we turn it editable; after attach we want native selection for caret
          e.preventDefault();
        }
      }}
      onClick={e => {
        if (selectedComponent?.index !== index) handleSelectComponent(index);
        e.stopPropagation();
      }}
    >
      <div ref={handleRef} className="handle" style={{ padding: 5, fontWeight: 'bold', userSelect: 'none' }}>⠿</div>
      <div
        onClick={handleClick}
        style={{
          flex: 1,
          // Keep rendered content clear of the drag handle (left) and delete icon (right)
          paddingLeft: 28,
          paddingRight: 36,
        }}
      >
  <RenderComponentCard comp={comp} previewLang={previewLang} pendingFocusTargetRef={pendingFocusTargetRef} isSelected={selectedComponent?.index === index} />
      </div>
      <Button className="delete" onClick={handleDelete} iconName="close" variant="icon" />
    </div>
  );
};

const ModifyComponent = () => {
  const [components, _setComponents] = useState([]);
  const [historyStack, setHistoryStack] = useState([]); // snapshots
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [initialComponents, setInitialComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  // Debug instrumentation: expose currently selected component for console inspection
  useEffect(() => {
    if (window.__ISET_DEBUG_INLINE_EDIT) {
      if (selectedComponent) {
        try { window.__ISET_SELECTED = JSON.parse(JSON.stringify(selectedComponent)); } catch (_) { window.__ISET_SELECTED = selectedComponent; }
      } else {
        delete window.__ISET_SELECTED;
      }
    }
  }, [selectedComponent]);
  const [availableComponents, setAvailableComponents] = useState([]);
  const [loading, setLoading] = useState(true);
  // DB-only model (no file paths)
  // template lookups (filled after library fetch)
  const tplById = useMemo(() => new Map(availableComponents.map(t => [t.id, t])), [availableComponents]);
  const { id } = useParams();
  const location = useLocation();
  const sp = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const fromWorkflow = sp.get('fromWorkflow');
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

  const pushHistory = (snapshot) => {
    const serialized = JSON.stringify(snapshot);
    let base = historyIndex >= 0 ? historyStack.slice(0, historyIndex + 1) : [];
    if (base.length) {
      const last = JSON.stringify(base[base.length - 1]);
      if (last === serialized) return;
    }
    const clone = JSON.parse(serialized);
    base = [...base, clone];
    if (base.length > 50) base.splice(0, base.length - 50);
    setHistoryStack(base);
    setHistoryIndex(base.length - 1);
  };
  function setComponents(nextOrFn, { skipHistory } = {}) {
    _setComponents(prev => {
      const next = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      if (!skipHistory && JSON.stringify(prev) !== JSON.stringify(next)) pushHistory(next);
      return next;
    });
  }
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < historyStack.length - 1;
  const handleUndo = () => {
    if (!canUndo) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    const snap = historyStack[newIdx];
    _setComponents(JSON.parse(JSON.stringify(snap)));
    setSelectedComponent(sc => (sc && sc.index < snap.length) ? { ...snap[sc.index], index: sc.index } : null);
  };
  const handleRedo = () => {
    if (!canRedo) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    const snap = historyStack[newIdx];
    _setComponents(JSON.parse(JSON.stringify(snap)));
    setSelectedComponent(sc => (sc && sc.index < snap.length) ? { ...snap[sc.index], index: sc.index } : null);
  };

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
          setComponents(deduped, { skipHistory: true });
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

  // Seed initial history once loading completed
  useEffect(() => {
    if (!loading && historyIndex === -1) pushHistory(components);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => {
    const fetchAvailableComponents = async () => {
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/api/component-templates`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        // 1) Keep only active templates
        const active = data.filter(t => t.status === 'active');
        // 2) Normalise shape & ensure template_key carried through (older code used t.key which isn't present)
        const normalised = active.map(t => ({
          id: t.id,
          type: t.type,
          label: t.label,
          description: t.description ?? '',
          props: JSON.parse(JSON.stringify(t.props || {})),
            // Deep clone props so edits don't mutate the cached "availableComponents" list
          editable_fields: t.editable_fields || [],
          has_options: !!t.has_options,
          option_schema: t.option_schema || null,
          template_key: t.template_key || t.type, // prefer explicit template_key
          version: t.version || 1
        }));
        // 3) Keep only the highest version per template_key (or type fallback) so library shows latest version only.
        const byKey = new Map();
        for (const tpl of normalised) {
          const key = tpl.template_key || tpl.type;
          const existing = byKey.get(key);
          if (!existing || (tpl.version || 0) > (existing.version || 0)) byKey.set(key, tpl);
        }
        const latest = Array.from(byKey.values())
          .sort((a, b) => a.label.localeCompare(b.label));
        setAvailableComponents(latest);
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
    const nextSel = index !== null ? {
      ...components[index],
      index,
      props: {
        ...components[index].props,
        items: components[index].props?.items ?? [],
        mode: components[index].props?.props?.mode || 'static',
        endpoint: components[index].props?.props?.endpoint || null
      },
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
    } : null;
    if (window.__ISET_DEBUG_INLINE_EDIT) {
      try { window.__ISET_SELECTED = nextSel ? JSON.parse(JSON.stringify(nextSel)) : null; } catch (_) { window.__ISET_SELECTED = nextSel; }
    }
    setSelectedComponent(nextSel);
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

  // Language toggle for Working Area preview
  const [previewLang, setPreviewLang] = useState('en');

  /* existing state & effects unchanged */

  return (
    <MaybeDndProvider>
      <style>{`
        .stage { padding: 8px; background: #fafafa; min-height: 160px; border: 1px dashed #d5dbdb; }
        .stage-card { background:#fff; border:1px solid #d5dbdb; border-radius:8px; padding:12px; margin-bottom:12px; position:relative; }
        .stage-card.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
        .stage-card .handle { cursor:grab; position:absolute; left:8px; top:8px; opacity:0.6; }
        .stage-card .delete { cursor:pointer; position:absolute; right:8px; top:8px; opacity:0.7; }
        .stage-card .inline-edit-target { cursor:text; }
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
                {fromWorkflow && <Button onClick={() => history.push(`/modify-workflow?id=${fromWorkflow}`)}>Back to Workflow</Button>}
                <Button onClick={handleCancel}>Cancel</Button>
                <Button onClick={handleUndo} disabled={!canUndo}>Undo</Button>
                <Button onClick={handleRedo} disabled={!canRedo}>Redo</Button>
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
                    // Remove layout modifiers so newly added radios default to standard stacked layout.
                    if (typeKey === 'radio' || typeKey === 'radios') {
                      defaultProps.classes = stripClasses(defaultProps.classes, ['govuk-radios--inline','govuk-radios--small']);
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
                    // Ensure options array with sensible defaults.
                    const looksLikePlaceholder = (arr) => {
                      if (!Array.isArray(arr)) return true;
                      if (arr.length === 0) return true;
                      // If all items have text matching Option <n> (case-insensitive) treat as placeholder
                      const optRegex = /^\s*option\b/i;
                      const sample = arr.slice(0, 5);
                      return sample.every((it, idx) => {
                        const t = (it && (it.text || it.html) || '').trim();
                        return !t || optRegex.test(t) || /^yes$/i.test(t) || /^no$/i.test(t);
                      });
                    };
                    if (looksLikePlaceholder(defaultProps.items)) {
                      defaultProps.items = [
                        { text: 'Yes', value: 'true' },
                        { text: 'No', value: 'false' }
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
            <Header
              variant="h3"
              actions={
                <SegmentedControl
                  label="Language"
                  selectedId={previewLang}
                  onChange={({ detail }) => setPreviewLang(detail.selectedId)}
                  options={[
                    { text: 'EN', id: 'en' },
                    { text: 'FR', id: 'fr' }
                  ]}
                />
              }
            >
              Working Area
            </Header>
            {!loading && (
              <PreviewArea
                components={components}
                setComponents={setComponents}
                handleSelectComponent={handleSelectComponent}
        selectedComponent={selectedComponent}
        previewLang={previewLang}
              />
            )}
          </Box>

          <Box padding="m">
            <SpaceBetween size="l">
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
              <ExpandableSection headerText="Translations" defaultExpanded={false}>
                <TranslationsWidget
                  components={components}
                  setComponents={setComponents}
                  asBoardItem={false}
                />
              </ExpandableSection>
            </SpaceBetween>
          </Box>
        </Grid>
      </Container>
  </MaybeDndProvider>
  );
};
export { setComponentConfigValue };
export default ModifyComponent;
