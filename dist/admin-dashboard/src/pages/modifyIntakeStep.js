  import React, { useState, useEffect, useMemo, useRef, useLayoutEffect, useCallback } from "react";
  // Ensure GOV.UK styles are available in-editor
  import "../css/govuk-frontend.min.css";
  // Initialize GOV.UK behaviours for dynamic previews
  import { initAll as govukInitAll } from 'govuk-frontend';
  import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
  import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
  import { CSS } from '@dnd-kit/utilities';
import { Grid, Box, Header, Button, Container, SpaceBetween, Alert, ExpandableSection, SegmentedControl, FormField, Input, Select, Badge, Table, Modal } from "@cloudscape-design/components";
import { useParams, useHistory, useLocation } from "react-router-dom";
import PropertiesPanel, { ValidationEditor } from './PropertiesPanel.js';
import { validateStep, summarizeIssues } from '../validation/stepValidator';
import TranslationsWidget from '../widgets/TranslationsWidget';
import { apiFetch } from '../auth/apiClient';

// API_BASE constant removed; all network calls now go through apiFetch which handles base URL & auth.

const debugDragLog = (...args) => {
  if (typeof window !== 'undefined' && window.__ISET_DEBUG_DND) {
    console.debug('[ModifyIntakeStep DnD]', ...args);
  }
};

const RENDER_CACHE = new Map();
const RENDER_CACHE_TTL = 5_000;

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

// Utility: identify translatable (i18n) value objects
const isI18nObject = v => v && typeof v === 'object' && (
  Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'fr')
);

// Given a default props object and current language, wrap plain string values at known translation paths into { lang: value }
function seedI18nDefaults(props, lang = 'en') {
  if (!props || typeof props !== 'object') return props;
  const clone = JSON.parse(JSON.stringify(props));
  const translationPaths = [
    'label.text','hint.text','errorMessage.text','value',
    'actionLabel.text','clearLabel.text','placeholder.text','statusSignedText.text','statusUnsignedText.text',
    'props.label.text','props.hint.text','props.actionLabel.text','props.clearLabel.text','props.placeholder.text','props.statusSignedText.text','props.statusUnsignedText.text',
    'charCountSingular','charCountPlural','wordCountSingular','wordCountPlural'
  ];
  const setPath = (obj, path, val) => {
    const parts = path.split('.');
    const last = parts.pop();
    const target = parts.reduce((acc,k)=>{ if(!acc[k]||typeof acc[k]!== 'object') acc[k]={}; return acc[k]; }, obj);
    target[last] = val;
  };
  const getPath = (obj, path) => path.split('.').reduce((acc,k)=> (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
  translationPaths.forEach(p => {
    const val = getPath(clone, p);
    if (typeof val === 'string' && val.trim()) {
      setPath(clone, p, { [lang]: val });
    } else if (typeof val === 'string' && !val.trim()) {
      // leave empty string as blank translation for current lang only
      setPath(clone, p, { [lang]: '' });
    }
  });
  return clone;
}

function collectTranslationSeeds(obj) {
  const seeds = {};
  const visit = (value, path) => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((item, idx) => {
        const next = path ? `${path}.${idx}` : String(idx);
        visit(item, next);
      });
      return;
    }
    if (typeof value === 'object') {
      if (isI18nObject(value)) {
        if (path) {
          const en = typeof value.en === 'string' ? value.en : '';
          const fr = typeof value.fr === 'string' ? value.fr : '';
          seeds[path] = { en, fr };
        }
        return;
      }
      Object.entries(value).forEach(([key, val]) => {
        const next = path ? `${path}.${key}` : key;
        visit(val, next);
      });
    }
  };
  visit(obj, '');
  return seeds;
}

function mergeSeedMaps(base = {}, extra = {}) {
  const normalise = (entry = {}) => ({
    en: typeof entry.en === 'string' ? entry.en : '',
    fr: typeof entry.fr === 'string' ? entry.fr : ''
  });
  const out = {};
  Object.entries(base || {}).forEach(([path, entry]) => {
    out[path] = normalise(entry);
  });
  Object.entries(extra || {}).forEach(([path, entry]) => {
    const current = out[path] ? { ...out[path] } : { en: '', fr: '' };
    const next = normalise(entry);
    if (next.en && next.en.trim()) current.en = next.en;
    if (next.fr && next.fr.trim()) current.fr = next.fr;
    out[path] = current;
  });
  return out;
}

function buildSeedMapFromTemplate(props = {}) {
  const seedsEn = collectTranslationSeeds(seedI18nDefaults(props, 'en'));
  const seedsFr = collectTranslationSeeds(seedI18nDefaults(props, 'fr'));
  return mergeSeedMaps(seedsEn, seedsFr);
}

const ComponentItem = ({ component, onAdd, currentLang }) => (
  <div
    style={{ padding: "8px", border: "1px solid #ccc", cursor: "pointer" }}
    onClick={() => onAdd(component, currentLang)}
  >
    {component.label}
  </div>
);

const PreviewArea = ({ components, setComponents, handleSelectComponent, selectedComponent, previewLang = 'en' }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    })
  );

  const fallbackIdMapRef = useRef(new WeakMap());
  const fallbackIdCounterRef = useRef(0);

  const getComponentDndId = useCallback((comp, index) => {
    if (!comp) return `component-empty-${index}`;
    const candidates = [
      comp.__editorUid,
      comp.props?.name,
      comp.props?.id,
      comp.id,
      comp.templateId,
      comp.template_id,
      comp.type
    ];
    const baseCandidate = candidates.find(val => typeof val === 'string' && val.trim())
      ?? candidates.find(val => typeof val === 'number')
      ?? null;
    if (baseCandidate != null) {
      const normalised = String(baseCandidate).trim().replace(/\s+/g, '-');
      return `component-${normalised || index}`;
    }
    if (fallbackIdMapRef.current.has(comp)) {
      return fallbackIdMapRef.current.get(comp);
    }
    const generated = `component-generated-${fallbackIdCounterRef.current++}`;
    fallbackIdMapRef.current.set(comp, generated);
    return generated;
  }, []);

  const itemIds = useMemo(
    () => components.map((comp, index) => getComponentDndId(comp, index)),
    [components, getComponentDndId]
  );

  const [activeId, setActiveId] = useState(null);

  const handleDragStart = useCallback((event) => {
    const { active } = event;
    setActiveId(active?.id ?? null);
    if (typeof active?.data?.current?.index === 'number') {
      debugDragLog('beginDrag', { index: active.data.current.index });
    } else {
      debugDragLog('beginDrag', { id: active?.id });
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    if (activeId != null) debugDragLog('cancelDrag');
    setActiveId(null);
  }, [activeId]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!active || !over) {
      debugDragLog('dragEnd cancelled', { hasActive: !!active, hasOver: !!over });
      handleDragCancel();
      return;
    }
    const fromIndex = itemIds.indexOf(active.id);
    const toIndex = itemIds.indexOf(over.id);
    debugDragLog('dragEnd', { fromIndex, toIndex, activeId: active.id, overId: over.id });
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      setComponents(prev => arrayMove(prev, fromIndex, toIndex));
      const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (fn) => setTimeout(fn, 0);
      schedule(() => handleSelectComponent(toIndex));
    }
    setActiveId(null);
  }, [handleDragCancel, handleSelectComponent, itemIds, setComponents]);

  const conditionalRefMap = useMemo(() => {
    const map = new Map();
    const extract = (val) => {
      if (!val) return '';
      if (typeof val === 'string') return val;
      if (typeof val === 'object') {
        if (val.en || val.fr) return val.en || val.fr || '';
        for (const v of Object.values(val)) { if (typeof v === 'string' && v.trim()) return v; }
      }
      return '';
    };
    (components || []).forEach(parent => {
      if (!parent || !parent.props) return;
      const t = String(parent.template_key || parent.type || '').toLowerCase();
      if (!['radio','radios','checkbox','checkboxes'].includes(t)) return;
      const parentLabel = extract(parent.props?.fieldset?.legend?.text || parent.props?.label?.text || parent.props?.titleText || parent.props?.text) || (parent.props?.name || parent.id || '');
      const items = Array.isArray(parent.props.items) ? parent.props.items : [];
      items.forEach(it => {
        if (it && it.conditionalChildId) {
          const optLabel = extract(it.text || it.html || it.value) || (it.value || '');
          if (!map.has(it.conditionalChildId)) map.set(it.conditionalChildId, { parentLabel, optionLabel: optLabel });
        }
      });
    });
    return map;
  }, [components]);

  const stageClass = `stage${activeId ? ' stage--dragging' : ''}`;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className={stageClass}>
          {components.length === 0 && (
            <Box color="inherit" textAlign="center" padding="m" variant="div" style={{ color: '#777' }}>
              Drag from the library or click a component to add it here
            </Box>
          )}
          {components.map((comp, index) => {
            const key = comp?.templateId || comp?.template_id || comp?.id || comp?.props?.id || comp?.props?.name || `${comp?.type || 'component'}-${index}`;
            const id = itemIds[index];
            return (
              <DraggablePreviewItem
                key={`comp-${key}-${index}`}
                itemId={id}
                index={index}
                comp={comp}
                setComponents={setComponents}
                handleSelectComponent={handleSelectComponent}
                selectedComponent={selectedComponent}
                previewLang={previewLang}
                conditionalRef={(() => {
                  const idKey = comp?.id;
                  const nameKey = comp?.props?.name;
                  if (idKey && conditionalRefMap.get(idKey)) return conditionalRefMap.get(idKey);
                  if (nameKey && conditionalRefMap.get(nameKey)) return conditionalRefMap.get(nameKey);
                  return null;
                })()}
                isActiveDrag={activeId === id}
                isAnySorting={!!activeId}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
};

const DraggablePreviewItem = ({
  itemId,
  comp,
  index,
  setComponents,
  handleSelectComponent,
  selectedComponent,
  previewLang = 'en',
  conditionalRef = null,
  isActiveDrag = false,
  isAnySorting = false
}) => {
  const pendingFocusTargetRef = useRef(null); // stores original mousedown target when selecting
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: itemId, data: { index } });

  const mergedHandleRef = useCallback((node) => {
    if (node) setActivatorNodeRef(node);
  }, [setActivatorNodeRef]);

  const styleTransform = transform ? CSS.Transform.toString(transform) : undefined;
  const dragging = isDragging || isActiveDrag;
  const transitionStyle = (isDragging || isAnySorting) ? 'transform 0s' : transition;

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

    const propsSignature = useMemo(() => JSON.stringify(props ?? {}), [props]);
    const cacheKey = useMemo(() => {
      return `${templateKey ?? 'null'}|${templateId ?? 'null'}|${version ?? 0}|${propsSignature}`;
    }, [templateKey, templateId, version, propsSignature]);

    useEffect(() => {
      if (!(templateKey || templateId)) {
        setHtml('');
        setError('');
        setLoading(false);
        return () => {};
      }

      if (debounceRef.current) clearTimeout(debounceRef.current);

      const cached = RENDER_CACHE.get(cacheKey);
      const now = Date.now();
      if (cached && now - cached.timestamp <= RENDER_CACHE_TTL) {
        setHtml(cached.html);
        setError('');
        setLoading(false);
        return () => {};
      }

      debounceRef.current = setTimeout(async () => {
        if (abortRef.current) abortRef.current.abort();
        const ac = new AbortController();
        abortRef.current = ac;
        setLoading(true);
        setError('');
        try {
          const res = await apiFetch(`/api/render/component`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateKey, templateId, version, props }),
            signal: ac.signal
          });
          const txt = await res.text();
          if (!res.ok) throw new Error(txt || `HTTP ${res.status}`);
          RENDER_CACHE.set(cacheKey, { html: txt, timestamp: Date.now() });
          setHtml(txt);
        } catch (e) {
          if (e.name !== 'AbortError') {
            setError(String(e.message || e));
          }
        } finally {
          setLoading(false);
        }
      }, 150);

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (abortRef.current) abortRef.current.abort();
      };
    }, [cacheKey, templateKey, templateId, version, props]);

    return { html, loading, error };
  }

  const RenderComponentCard = React.memo(({ comp, previewLang = 'en', pendingFocusTargetRef, selectedIndex, setComponentsRef, itemIndex }) => {
    // Flatten any bilingual values like { en, fr } down to a single string for preview rendering
    const flattenTranslations = useCallback((value, langOverride = previewLang) => {
      const normalise = (val) => {
        if (val == null) return val;
        if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
        if (Array.isArray(val)) return val.map(item => normalise(item));
        if (typeof val === 'object') {
          if (Object.prototype.hasOwnProperty.call(val, 'en') || Object.prototype.hasOwnProperty.call(val, 'fr')) {
            const cand = val[langOverride] ?? val.en ?? val.fr;
            return (typeof cand === 'string' || typeof cand === 'number') ? String(cand) : '';
          }
          const out = Array.isArray(val) ? [] : {};
          Object.entries(val).forEach(([key, inner]) => {
            out[key] = normalise(inner);
          });
          return out;
        }
        return val;
      };
      return normalise(value);
    }, [previewLang]);

    // Prefer templateId from DB, fall back to key/type.
    const templateId  = comp?.templateId ?? comp?.template_id ?? comp?.id ?? null;
    const templateKey = comp?.template_key ?? comp?.type ?? null;
    // Prepare props for preview (strings only) with special handling for summary-list
    const previewProps = useMemo(() => {
      const base = flattenTranslations(comp?.props || {}, previewLang) || {};
      const t = String(comp?.type || comp?.template_key || '').toLowerCase();
      if (t === 'summary-list') {
        const included = Array.isArray(comp?.props?.included) ? comp.props.included : [];
        if (included.length > 0) {
          base.rows = included.map(r => {
            const lbl = (() => {
              if (!r) return '';
              // 1. Explicit override (string or bilingual object)
              if (typeof r.labelOverride === 'string') return r.labelOverride;
              if (r.labelOverride && typeof r.labelOverride === 'object') return r.labelOverride[previewLang] || r.labelOverride.en || r.labelOverride.fr || r.key;
              // 2. Stored snapshot labels from field selection
              if (previewLang === 'fr' && r.labelFr) return r.labelFr;
              if (previewLang === 'en' && r.labelEn) return r.labelEn;
              if (r.labelEn || r.labelFr) return r.labelEn || r.labelFr; // fallback any snapshot
              // 3. Fallback to key
              return r.key;
            })();
            return {
              key: { text: lbl },
              value: { text: previewLang === 'fr' ? '(valeur à l\'exécution)' : '(value at runtime)' }
            };
          });
        } else {
          base.rows = [
            {
              key: { text: previewLang === 'fr' ? 'Liste récapitulative (espace réservé)' : 'Summary list (placeholder)' },
              value: { text: previewLang === 'fr' ? 'Sélectionnez un workflow et des champs dans le panneau Propriétés. Non publié tant que non configuré.' : 'Select a workflow & fields in the Properties panel. Not included in publish until configured.' }
            }
          ];
        }
        base.__preview = true; // hint for server template if needed
      }
      return base;
    }, [comp, previewLang, flattenTranslations]);
    const { html, loading, error } = useNunjucksHTML({
      templateId,
      templateKey,
      version: comp?.version ?? 1,
      props: previewProps
    });
    const containerRef = useRef(null);

    useEffect(() => {
      if (typeof document === 'undefined') return;
      if (!document.body) return;
      if (!document.body.classList.contains('govuk-frontend-supported')) {
        document.body.classList.add('govuk-frontend-supported');
      }
    }, []);

    // Re-init GOV.UK behaviours when new HTML is injected
    useEffect(() => {
      if (!html) return;
      if (!containerRef.current) return;
      const root = containerRef.current;
      const rafId = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(runInit)
        : setTimeout(runInit, 0);

      function runInit() {
        try {
          Array.from(root.querySelectorAll('[data-module]')).forEach((el) => {
            if (el.hasAttribute('data-govuk-initialised')) {
              el.removeAttribute('data-govuk-initialised');
            }
          });
          if (typeof govukInitAll === 'function') {
            govukInitAll(root);
          }
        } catch (err) {
          if (window?.__ISET_DEBUG_INLINE_EDIT) {
            console.warn('[GOVUK init] failed to re-run', err); // eslint-disable-line no-console
          }
        }
      }

      return () => {
        if (typeof cancelAnimationFrame === 'function' && typeof rafId === 'number') {
          cancelAnimationFrame(rafId);
        } else {
          clearTimeout(rafId);
        }
      };
  }, [comp, html]);

    // Inline editing effect (runs every render; guarded inside)
    // Use layout effect so we can attach editing before paint to reduce focus races
  useLayoutEffect(() => {
      if (!html) return; // nothing to edit yet
      if (!containerRef.current) return;
      const root = containerRef.current;
  const isSelectedCurrent = selectedIndex === itemIndex;
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
          if (selectedIndex === itemIndex) {
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
          setComponentsRef(prev => prev.map((c, i) => {
            if (i !== itemIndex) return c;
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
  }, [comp, html, itemIndex, pendingFocusTargetRef, previewLang, selectedIndex, setComponentsRef]);

    let inner;
    if (!templateId && !templateKey) inner = <div className="govuk-hint" style={{ color: '#b00' }}>Missing template reference</div>;
    else if (error) inner = <div className="govuk-hint" style={{ color: '#b00' }}>Render error: {error}</div>;
    else if (loading && !html) inner = <div className="govuk-hint">Rendering…</div>;
    else {
      // Post-process HTML for signature-ack to provide working-area interactive approximation
  const lowerType = String(comp?.template_key || comp?.type || '').toLowerCase();
  if (lowerType === 'signature-ack') {
        const resolveI18n = (val, fallback = '') => {
          if (!val) return fallback;
          if (typeof val === 'string') return val;
          if (typeof val === 'object') {
            if (typeof val.text !== 'undefined') return resolveI18n(val.text, fallback);
            return resolveI18n(val[previewLang] || val.en || val.fr || Object.values(val).find(v => typeof v === 'string'), fallback);
          }
          return fallback;
        };
        const labelText = resolveI18n(comp?.props?.label, resolveI18n(comp?.label, ''));
        const hintText = resolveI18n(comp?.props?.hint, '');
        const placeholder = resolveI18n(comp?.props?.placeholder, 'Type your full name');
        const labelClass = (comp?.props?.label && comp.props.label.classes) ? comp.props.label.classes : '';
        const paddingScale = {
          s: { py: 6, px: 18, minHeight: 44 },
          m: { py: 22, px: 30, minHeight: 68 },
          l: { py: 38, px: 40, minHeight: 94 },
          xl: { py: 54, px: 52, minHeight: 120 },
        };
        const padKey = String(comp?.props?.boxPadding || 'm').toLowerCase();
        const pad = paddingScale[padKey] || paddingScale.m;
        const statusUnsigned = resolveI18n(comp?.props?.statusUnsignedText, 'Not signed');
        inner = (
          <div className="govuk-form-group" data-sig-preview="1" style={{ marginBottom: 16 }}>
            {labelText && <label className={`govuk-label${labelClass ? ' ' + labelClass : ''}`} style={{ fontWeight: labelClass ? undefined : 600 }}>{labelText}</label>}
            {hintText && <div className="govuk-hint" style={{ marginBottom: 4 }}>{hintText}</div>}
            <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
              <div style={{ flex:'0 0 34%', minWidth:260, maxWidth:420, position:'relative' }}>
                <input type="text" className="govuk-input" placeholder={placeholder} style={{ width:'100%', background:'#fff', border:'2px solid #0b0c0c', borderRadius:6, padding:`${pad.py}px ${pad.px}px`, textAlign:'center', minHeight: pad.minHeight, boxShadow:'0 1px 2px rgba(0,0,0,0.08)' }} disabled value="" onChange={()=>{}} />
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, height: pad.minHeight }}>
                <button type="button" disabled className="govuk-button" style={{ margin:0, height: pad.minHeight, display:'flex', alignItems:'center', justifyContent:'center' }}>{resolveI18n(comp?.props?.actionLabel, 'Sign Now')}</button>
                <button type="button" disabled className="govuk-button govuk-button--warning" style={{ margin:0, height: pad.minHeight, display:'flex', alignItems:'center', justifyContent:'center' }}>{resolveI18n(comp?.props?.clearLabel, 'Clear')}</button>
              </div>
              <div className="govuk-hint signature-ack__status" style={{ flexBasis:'100%', marginTop:4 }}>{statusUnsigned}</div>
            </div>
          </div>
        );
      } else {
        inner = <div dangerouslySetInnerHTML={{ __html: html }} />;
      }
    }

    // Stop clicks inside editable text from bubbling to card (avoid unintended selection logic)
    useEffect(() => {
      const root = containerRef.current;
      if (!root) return;
      // Disable actual file selection in preview for file-upload components
      try {
        if (String(comp?.template_key || comp?.type || '').toLowerCase() === 'file-upload') {
          const inputs = root.querySelectorAll('input[type="file"]');
          inputs.forEach(inp => {
            inp.setAttribute('disabled','disabled');
            inp.style.pointerEvents = 'none';
            inp.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); return false; });
          });
        }
      } catch (_) {}
      const handler = (e) => {
        const el = e.target.closest('[data-inline-edit]');
        if (el) {
          e.stopPropagation();
        }
      };
      root.addEventListener('click', handler, true);
      return () => root.removeEventListener('click', handler, true);
    }, [comp, html]);

    return <div ref={containerRef} className="govuk-embedded">{inner}</div>;
  }, (prev, next) => {
    // Custom props equality to avoid needless re-renders
    return (
      prev.comp === next.comp &&
      prev.previewLang === next.previewLang &&
      prev.itemIndex === next.itemIndex &&
      prev.selectedIndex === next.selectedIndex &&
      prev.setComponentsRef === next.setComponentsRef
    );
  });

  const isSelected = selectedComponent?.index === index;

  useEffect(() => {
    debugDragLog('draggable state', { index, isDraggingFromMonitor: isDragging, isActiveDrag, combinedDragging: dragging });
  }, [index, isDragging, isActiveDrag, dragging]);

  return (
    <div
      ref={setNodeRef}
      className={`stage-card${isSelected ? ' selected' : ''}${dragging ? ' stage-card--dragging' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: dragging ? 0.6 : 1,
        transform: styleTransform,
        transition: transitionStyle,
        willChange: isDragging ? 'transform' : undefined,
        zIndex: isDragging ? 30 : undefined
      }}
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
        <div
          ref={mergedHandleRef}
          className="handle"
          style={{ padding: 5, fontWeight: 'bold', userSelect: 'none' }}
          aria-label="Drag to reorder component"
          aria-grabbed={dragging}
          {...attributes}
          {...listeners}
        >
          ⠿
        </div>
      {conditionalRef && (
        <div
          className="conditional-badge"
          data-has-detail="1"
          style={{
            position: 'absolute',
            top: 4,
            right: 36,
            background: '#5925dc',
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: 12,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            cursor: 'default'
          }}
          aria-label={`Conditional follow-up: ${conditionalRef.parentLabel || 'Parent'} > ${conditionalRef.optionLabel || 'Option'}`}
        >
          COND
          <span className="conditional-badge__tooltip" role="tooltip">
            <strong style={{display:'block', fontWeight:600}}>Conditional Follow-up</strong>
            <span style={{fontSize:11, display:'block'}}>
              <span style={{color:'#bbb'}}>Parent:</span> {conditionalRef.parentLabel || 'Parent'}
            </span>
            <span style={{fontSize:11, display:'block'}}>
              <span style={{color:'#bbb'}}>Option:</span> {conditionalRef.optionLabel || 'Option'}
            </span>
          </span>
        </div>
      )}
      <div
        onClick={handleClick}
        style={{
          flex: 1,
          // Keep rendered content clear of the drag handle (left) and delete icon (right)
          paddingLeft: 28,
          paddingRight: 36,
        }}
      >
        <RenderComponentCard
          comp={comp}
          previewLang={previewLang}
          pendingFocusTargetRef={pendingFocusTargetRef}
          selectedIndex={selectedComponent?.index ?? null}
          itemIndex={index}
          setComponentsRef={setComponents}
        />
      </div>
      <Button className="delete" onClick={handleDelete} iconName="close" variant="icon" />
    </div>
  );
};

const ModifyComponent = () => {
  const [components, _setComponents] = useState([]);
  const [historyStack, setHistoryStack] = useState([]); // snapshots
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(historyIndex);
  const [initialComponents, setInitialComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  // Draft inputs for adding a conditional visibility rule (file-upload panel)
  const [condDraftRef, setCondDraftRef] = useState('');
  const [condDraftOp, setCondDraftOp] = useState('equals');
  const [condDraftValue, setCondDraftValue] = useState('');
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
  const componentCount = components.length;
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
  // (Removed) Step-level validation (stop conditions) – simplified editor now only manages component-level validation.
  const [manualDirty, setManualDirty] = useState(false);
  // compute hasChanges (deep) to gate buttons
  const hasChanges = useMemo(() => {
    const a = { name, status, components };
    const b = { name: initialName, status: initialStatus, components: initialComponents };
    return JSON.stringify(a) !== JSON.stringify(b);
  }, [name, status, components, initialName, initialStatus, initialComponents]);

  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);

  const pushHistory = useCallback((snapshot) => {
    const serialized = JSON.stringify(snapshot);
    setHistoryStack(prevStack => {
      const currentIndex = historyIndexRef.current;
      let base = currentIndex >= 0 ? prevStack.slice(0, currentIndex + 1) : [];
      if (base.length) {
        const lastSerialized = JSON.stringify(base[base.length - 1]);
        if (lastSerialized === serialized) {
          const stableIndex = base.length - 1;
          if (historyIndexRef.current !== stableIndex) {
            historyIndexRef.current = stableIndex;
            setHistoryIndex(stableIndex);
          }
          return base;
        }
      }
      const clone = JSON.parse(serialized);
      base = [...base, clone];
      if (base.length > 50) {
        base = base.slice(base.length - 50);
      }
      const newIndex = base.length - 1;
      historyIndexRef.current = newIndex;
      setHistoryIndex(newIndex);
      return base;
    });
  }, [setHistoryIndex]);
  // Remove dangling conditionalChildId links on radio options whose target component was deleted
  function cleanupOrphanConditionalLinks(list) {
    if (!Array.isArray(list) || !list.length) return list;
    // Collect BOTH ids and props.name values for robust existence detection across save cycles
    const existingKeys = new Set();
    list.forEach(c => {
      if (!c) return;
      const idKey = c.id || c.templateId || c.template_id || c.props?.id;
      const nameKey = c.props?.name;
      if (idKey) existingKeys.add(String(idKey));
      if (nameKey) existingKeys.add(String(nameKey));
    });
    let changed = false;
    const cleaned = list.map(c => {
      if (!c) return c;
      const typ = String(c.template_key || c.type || '').toLowerCase();
      if (!['radio','radios','checkbox','checkboxes'].includes(typ)) return c;
      const items = Array.isArray(c.props?.items) ? c.props.items : [];
      let itemsChanged = false;
      const newItems = items.map(it => {
        if (it && it.conditionalChildId) {
          // If neither id nor name exists in the set, treat as orphan
          if (!existingKeys.has(String(it.conditionalChildId))) {
            const { conditionalChildId, ...rest } = it; // eslint-disable-line no-unused-vars
            itemsChanged = true;
            return rest;
          }
        }
        return it;
      });
      if (itemsChanged) {
        changed = true;
        return { ...c, props: { ...(c.props || {}), items: newItems } };
      }
      return c;
    });
    return changed ? cleaned : list;
  }
  const setComponents = useCallback((nextOrFn, { skipHistory } = {}) => {
    _setComponents(prev => {
      const rawNext = typeof nextOrFn === 'function' ? nextOrFn(prev) : nextOrFn;
      const next = cleanupOrphanConditionalLinks(rawNext);
      if (!skipHistory && JSON.stringify(prev) !== JSON.stringify(next)) pushHistory(next);
      return next;
    });
  }, [pushHistory]);
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex >= 0 && historyIndex < historyStack.length - 1;
  const handleUndo = () => {
    if (!canUndo) return;
    const newIdx = historyIndex - 1;
    setHistoryIndex(newIdx);
    historyIndexRef.current = newIdx;
    const snap = historyStack[newIdx];
    _setComponents(JSON.parse(JSON.stringify(snap)));
    setSelectedComponent(sc => (sc && sc.index < snap.length) ? { ...snap[sc.index], index: sc.index } : null);
  };
  const handleRedo = () => {
    if (!canRedo) return;
    const newIdx = historyIndex + 1;
    setHistoryIndex(newIdx);
    historyIndexRef.current = newIdx;
    const snap = historyStack[newIdx];
    _setComponents(JSON.parse(JSON.stringify(snap)));
    setSelectedComponent(sc => (sc && sc.index < snap.length) ? { ...snap[sc.index], index: sc.index } : null);
  };

  // --- Conditional Visibility (file-upload) workflow selector state ---
  const [condWfLoading, setCondWfLoading] = useState(false);
  const [condWorkflows, setCondWorkflows] = useState([]);
  const condWorkflowsLoadedRef = useRef(false);
  useEffect(() => {
    if (!selectedComponent) return;
    const t = String(selectedComponent.template_key || selectedComponent.type || '').toLowerCase();
    if (t !== 'file-upload') return;
    if (condWorkflowsLoadedRef.current) return;
    setCondWfLoading(true);
    (async () => {
      try {
        const resp = await apiFetch('/api/workflows');
        if (resp && resp.ok) {
          const data = await resp.json().catch(()=>[]);
          if (Array.isArray(data)) setCondWorkflows(data);
        }
      } catch (e) {
        console.error('Load workflows (conditional visibility) failed', e);
      } finally {
        setCondWfLoading(false);
        condWorkflowsLoadedRef.current = true;
      }
    })();
  }, [selectedComponent]);

  const handleSelectCondWorkflow = async (wfId) => {
    if (!selectedComponent) return;
    try {
      // Patch component props with chosen workflowId for conditions context
      let updatedComp = null;
      setComponents(prev => prev.map((c,i) => {
        if (i !== selectedComponent.index) return c;
        const nextProps = { ...(c.props||{}), conditionsWorkflowId: wfId };
        updatedComp = { ...c, props: nextProps };
        return updatedComp;
      }));
      if (updatedComp) {
        setSelectedComponent({ ...updatedComp, index: selectedComponent.index });
      }
      if (!wfId) return;
      const wfDetails = await apiFetch(`/api/workflows/${wfId}`);
      let wfData = null;
      if (wfDetails && typeof wfDetails.json === 'function') {
        if (wfDetails.ok) {
          wfData = await wfDetails.json().catch(()=>null);
        }
      } else {
        // Backward compatibility if apiFetch was changed to return JSON directly
        wfData = wfDetails;
      }
      if (wfData && Array.isArray(wfData.steps)) {
        // If steps do not include components, attempt per-step fetch to enrich snapshot
        const enrichedSteps = [];
        for (const step of wfData.steps) {
          let stepObj = step;
            // Only fetch if components missing
          if (!Array.isArray(stepObj.components)) {
            try {
              const stepResp = await apiFetch(`/api/steps/${step.id}`);
              if (stepResp && typeof stepResp.json === 'function' && stepResp.ok) {
                const stepData = await stepResp.json().catch(()=>null);
                if (stepData && Array.isArray(stepData.components)) {
                  stepObj = { ...stepObj, components: stepData.components };
                }
              } else if (stepResp && Array.isArray(stepResp.components)) {
                stepObj = { ...stepObj, components: stepResp.components };
              }
            } catch (e) {
              // Non-fatal; continue
              console.warn('Conditional visibility: step component fetch failed', step.id, e);
            }
          }
          enrichedSteps.push(stepObj);
        }
        const stepsForSnapshot = enrichedSteps.length ? enrichedSteps : wfData.steps;
        const snapshot = stepsForSnapshot.map((s, si) => {
          const comps = Array.isArray(s.components) ? s.components : [];
          const compEntries = comps.map(cc => {
            const ref = cc?.props?.name || cc?.props?.id || cc?.id || cc?.templateId || null;
            if (!ref) return null;
            let label = '';
            const rawLabel = cc?.label;
            if (rawLabel && typeof rawLabel === 'object') {
              if (rawLabel.text) {
                if (typeof rawLabel.text === 'string') label = rawLabel.text;
                else if (typeof rawLabel.text === 'object') label = rawLabel.text.en || rawLabel.text.fr || '';
              } else {
                label = rawLabel.en || rawLabel.fr || '';
              }
            } else if (typeof rawLabel === 'string') {
              label = rawLabel;
            }
            if (!label) label = ref;
            // Derive canonical type; step API returns camelCase templateKey, while local editor uses snake template_key
            const type = String(cc?.template_key || cc?.templateKey || cc?.type || '').toLowerCase();
            return { ref, label, type };
          }).filter(Boolean);
          return { stepId: s.id || s.step_id || `step-${si+1}`, stepName: s.name || `Step ${si+1}`, components: compEntries };
        }).filter(s => s.components && s.components.length);
        // Persist snapshot into component props (__workflowFields) so existing option merge logic uses it
        let finalComp = null;
        setComponents(prev => prev.map((c,i) => {
          if (i !== selectedComponent.index) return c;
          const nextProps = { ...(c.props||{}), __workflowFields: snapshot, conditionsWorkflowId: wfId };
            finalComp = { ...c, props: nextProps };
          return finalComp;
        }));
        if (finalComp) {
          setSelectedComponent({ ...finalComp, index: selectedComponent.index });
        }
      }
    } catch (e) {
      console.error('Load workflow details (conditional visibility) failed', e);
    }
  };

  // Add component with i18n seeding (moved inside component scope to satisfy linter)
  const pendingSelectIndexRef = useRef(null);
  const addComponent = (template, lang = 'en') => {
    if (!template) return;
    const seeded = seedI18nDefaults(template.props || {}, lang);
    // File-upload: ensure accept list defaults explicitly so property panel is populated
    if ((template.template_key || template.type) === 'file-upload') {
      if (!seeded.accept || !String(seeded.accept).trim()) {
        seeded.accept = '.pdf,.jpg,.jpeg,.png,.gif,.heic';
      }
    }
    // --- Ensure unique name/id across page (avoid collisions that can make unrelated components look conditionally linked) ---
    const existingKeys = new Set();
    components.forEach(c => {
      if (!c) return;
      const keys = [c.id, c.templateId, c.template_id, c.props?.id, c.props?.name].filter(Boolean);
      keys.forEach(k => existingKeys.add(String(k)));
    });
    const baseTypeSlug = String(template.template_key || template.type || 'comp').replace(/[^a-zA-Z0-9_-]/g,'-');
    const preferredFromLabel = (() => {
      const raw = seeded?.label?.text || seeded?.fieldset?.legend?.text || '';
      if (typeof raw === 'string') return raw;
      if (raw && typeof raw === 'object') return raw.en || raw.fr || '';
      return '';
    })().trim().slice(0,40).replace(/\s+/g,'-').replace(/[^a-zA-Z0-9_-]/g,'');
    let candidate = seeded?.name || seeded?.id || preferredFromLabel || baseTypeSlug || 'component';
    if (!candidate.trim()) candidate = baseTypeSlug || 'component';
    // Normalize
    candidate = candidate.replace(/[^a-zA-Z0-9_-]/g,'-');
    if (/^message$/i.test(candidate)) candidate = baseTypeSlug;
    // Append numeric suffix until unique
    let unique = candidate; let idx = 1;
    while (existingKeys.has(unique)) { unique = `${candidate}-${++idx}`; }
    if (!seeded.name || existingKeys.has(seeded.name)) seeded.name = unique;
    if (!seeded.id || existingKeys.has(seeded.id)) seeded.id = seeded.name;
    // ----------------------------------------------------------------------
    // Summary-list: start with placeholder dummy content (until workflow selected in properties panel)
    if ((template.template_key || template.type) === 'summary-list') {
      if (!Array.isArray(seeded.rows) || !seeded.rows.length) {
        seeded.rows = [
          {
            key: { text: { en: 'Question 1', fr: 'Question 1' } },
            value: { text: { en: 'Value', fr: 'Valeur' } }
          },
          {
            key: { text: { en: 'Question 2', fr: 'Question 2' } },
            value: { text: { en: 'Value', fr: 'Valeur' } }
          }
        ];
      }
      // dynamic config placeholders (set by PropertiesPanel when workflow picked)
      seeded.workflowId = null;
    }
    // Character-count specific post-processing: strip large bottom margin & assign incremental name/id
    if ((template.template_key || template.type) === 'character-count') {
      if (seeded && seeded.classes === 'govuk-!-margin-bottom-6') seeded.classes = '';
      // Determine next index (1-based)
      const existingCount = components.filter(c => (c.template_key || c.type) === 'character-count').length;
      const nextIndex = existingCount + 1;
      const baseName = `Character-Count-${nextIndex}`;
      if (!seeded.name || /^message$/i.test(seeded.name)) seeded.name = baseName;
      if (!seeded.id || !String(seeded.id).trim()) seeded.id = seeded.name;
      if (seeded.maxwords == null) seeded.maxwords = '';
      if (typeof seeded.value === 'undefined' || seeded.value === '') seeded.value = { [lang]: '' };
      if (seeded.errorMessage && typeof seeded.errorMessage.text === 'string' && !seeded.errorMessage.text.trim()) {
        // Allow validation widget to control it; convert to i18n object for consistency
        seeded.errorMessage.text = { [lang]: '' };
      }
      // Enforce default label class & bilingual label text if not already meaningful
      if (!seeded.label || typeof seeded.label !== 'object') seeded.label = { text: { en: '', fr: '' }, classes: 'govuk-label--m' };
      if (!seeded.label.classes || !String(seeded.label.classes).trim()) seeded.label.classes = 'govuk-label--m';
      const currentLabelText = seeded.label.text;
      const isPlainString = typeof currentLabelText === 'string';
      const genericPlaceholders = ['message','label',''];
      const objectHasGeneric = (!isPlainString && typeof currentLabelText === 'object' && (
        (currentLabelText.en && genericPlaceholders.includes(String(currentLabelText.en).trim().toLowerCase())) ||
        (currentLabelText.fr && genericPlaceholders.includes(String(currentLabelText.fr).trim().toLowerCase()))
      ));
      const needsDefault = (
        (isPlainString && genericPlaceholders.includes(currentLabelText.trim().toLowerCase())) ||
        (isPlainString && !currentLabelText.trim()) ||
        objectHasGeneric ||
        (typeof currentLabelText === 'object' && !(
          (currentLabelText.en && currentLabelText.en.trim()) || (currentLabelText.fr && currentLabelText.fr.trim())
        ))
      );
      if (needsDefault) {
        seeded.label.text = { en: 'Input with character-count', fr: 'Champ avec compteur de caractères' };
      } else if (isPlainString) {
        // Convert existing plain string to bilingual object preserving value for EN, supply FR default
        seeded.label.text = { en: currentLabelText, fr: 'Champ avec compteur de caractères' };
      } else if (typeof currentLabelText === 'object') {
        if (!currentLabelText.en) currentLabelText.en = 'Input with character-count';
        if (!currentLabelText.fr) currentLabelText.fr = 'Champ avec compteur de caractères';
      }
    } else if ((template.template_key || template.type) === 'textarea') {
      // Textarea improvements: bilingual defaults, consistent label class, value i18n wrapper
      if (!seeded.label || typeof seeded.label !== 'object') seeded.label = { text: { en: '', fr: '' }, classes: 'govuk-label--m' };
      if (!seeded.label.classes || !String(seeded.label.classes).trim()) seeded.label.classes = 'govuk-label--m';
      const lt = seeded.label.text;
      const plain = typeof lt === 'string';
      if (plain && !lt.trim()) {
        seeded.label.text = { en: 'Multi-line input', fr: 'Champ multi-lignes' };
      } else if (plain) {
        seeded.label.text = { en: lt, fr: 'Champ multi-lignes' };
      } else if (typeof lt === 'object') {
        if (!lt.en) lt.en = 'Multi-line input';
        if (!lt.fr) lt.fr = 'Champ multi-lignes';
      }
      // Hint i18n
      if (seeded.hint) {
        const ht = seeded.hint.text;
        if (typeof ht === 'string') {
          seeded.hint.text = { [lang]: ht };
        } else if (typeof ht === 'object') {
          if (!ht.en) ht.en = "Don't include personal or financial information.";
          if (!ht.fr) ht.fr = "N'incluez pas d'informations personnelles ou financières.";
        } else {
          seeded.hint.text = { en: "Don't include personal or financial information.", fr: "N'incluez pas d'informations personnelles ou financières." };
        }
      }
      // Value to i18n object
      if (typeof seeded.value === 'string') {
        seeded.value = { [lang]: seeded.value };
      } else if (typeof seeded.value === 'undefined') {
        seeded.value = { en: '', fr: '' };
      }
      // errorMessage to i18n container
      if (seeded.errorMessage && typeof seeded.errorMessage.text === 'string') {
        seeded.errorMessage.text = { [lang]: seeded.errorMessage.text };
      }
    }
    const baseSeeds = buildSeedMapFromTemplate(template.props || {});
    const seededSeeds = collectTranslationSeeds(seeded);
    const mergedSeeds = mergeSeedMaps(baseSeeds, seededSeeds);
    setComponents(prev => {
      const instance = {
        id: undefined,
        templateId: template.id,
        template_key: template.template_key,
        type: template.type,
        version: template.version,
        label: template.label,
        props: seeded,
        editable_fields: template.editable_fields || [],
        has_options: !!template.has_options,
        option_schema: template.option_schema || null,
        __i18nSeeds: mergedSeeds
      };
      const next = [...prev, instance];
      pendingSelectIndexRef.current = next.length - 1;
      return next;
    });
  };

  useEffect(() => {
    if (id === 'new') {
  setComponents([]);
      setName('Untitled BlockStep');
      setStatus('active');
      setInitialComponents([]);
      setInitialName('Untitled BlockStep');
      setInitialStatus('active');
  /* stopConditions removed */
      setLoading(false);
    } else if (id) {
      // DB-backed step load
    const fetchStep = async () => {
        try {
      const res = await apiFetch(`/api/steps/${id}`);
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
          // stopConditions removed from this version; ignore any legacy data.stopConditions
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
          /* stopConditions removed */
        } catch (e) {
          console.error('Failed to load step', e);
        } finally {
          setLoading(false);
        }
      };
      fetchStep();
    }
  }, [id, setComponents]);

  // Backfill missing accept on existing file-upload components (post-load)
  useEffect(() => {
    if (!components.length) return;
    let changed = false;
    const next = components.map(c => {
      if ((c.template_key || c.type) === 'file-upload') {
        const currentAccept = c.props?.accept || c.accept;
        if (!currentAccept || !String(currentAccept).trim()) {
          const clone = { ...c };
          clone.props = { ...(clone.props||{}), accept: '.pdf,.jpg,.jpeg,.png,.gif,.heic' };
          changed = true;
          return clone;
        }
      }
      return c;
    });
    if (changed) setComponents(next);
  }, [components, setComponents]);

  // Seed initial history once loading completed
  useEffect(() => {
    if (!loading && historyIndex === -1) {
      pushHistory(components);
    }
  }, [loading, historyIndex, pushHistory, components]);

  useEffect(() => {
    const fetchAvailableComponents = async () => {
      try {
        const res = await apiFetch(`/api/component-templates`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw = await res.json();
        // Accept both old (array) and new ({ count, templates }) shapes
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.templates)
            ? raw.templates
            : Array.isArray(raw.data)
              ? raw.data
              : [];
        // 1) Keep only active templates (default to active if status missing)
        const active = list.filter(t => (t.status || 'active') === 'active');
        // 2) Normalise shape; prefer default_props then props
        const normalised = active.map(t => {
          const baseProps = t.default_props || t.props || {};
          return {
            id: t.id,
            type: t.type || t.template_key || t.name,
            label: t.label || t.name || t.template_key || t.type || 'Component',
            description: t.description ?? '',
            props: JSON.parse(JSON.stringify(baseProps)), // deep clone
            editable_fields: t.editable_fields || t.prop_schema || [],
            has_options: !!t.has_options,
            option_schema: t.option_schema || null,
            template_key: t.template_key || t.type || t.name,
            version: t.version || 1
          };
        });
        // Fallback injection: ensure any option-bearing template has an optionList field so Options editor appears even if DB template missing it
        normalised.forEach(t => {
          if (t.has_options && Array.isArray(t.editable_fields)) {
            if (!t.editable_fields.some(f => f && f.type === 'optionList')) {
              t.editable_fields = [...t.editable_fields, { key: 'options', path: 'items', type: 'optionList', label: 'Options' }];
            }
          }
        });
        // 3) Keep only the highest version per template_key
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
    if (!componentCount || !availableComponents.length) return;
    setComponents(prev =>
      prev.map(c => {
        const tpl =
          tplById.get(c.templateId ?? c.template_id ?? c.id) ||
          availableComponents.find(t => t.template_key === c.template_key || t.type === c.type);
        if (!tpl) return c;
        const existing = Array.isArray(c.editable_fields) ? c.editable_fields : [];
        const tplFields = Array.isArray(tpl.editable_fields) ? tpl.editable_fields : [];
        const mergedMap = new Map();
        [...existing, ...tplFields].forEach(f => { if (f && f.path) mergedMap.set(f.path, f); });
        const merged = Array.from(mergedMap.values());
        if ((c.has_options || tpl.has_options) && !merged.some(f => f.type === 'optionList')) {
          merged.push({ key: 'options', path: 'items', type: 'optionList', label: 'Options' });
        }
        const templateSeeds = buildSeedMapFromTemplate(tpl.props || {});
        const seeds = c.__i18nSeeds && Object.keys(c.__i18nSeeds || {}).length
          ? mergeSeedMaps(templateSeeds, c.__i18nSeeds)
          : templateSeeds;
        return {
          ...c,
          type: c.type ?? tpl.type,
          label: c.label ?? tpl.label,
          template_key: c.template_key ?? tpl.template_key,
          version: c.version ?? tpl.version,
          editable_fields: merged,
          has_options: c.has_options ?? !!tpl.has_options,
          option_schema: c.option_schema || tpl.option_schema || null,
          __i18nSeeds: seeds
        };
      })
    );
  }, [componentCount, availableComponents, tplById, setComponents]);

  const handleSelectComponent = useCallback(index => {
  if (index == null) { setSelectedComponent(null); return; }
  if (!components[index]) return; // guard against race
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
        const tpl =
          tplById.get(
            components[index].templateId ?? components[index].template_id ?? components[index].id
          ) ||
          availableComponents.find(
            t => t.template_key === components[index].template_key || t.type === components[index].type
          );
        const existing = Array.isArray(components[index].editable_fields) ? components[index].editable_fields : [];
        const tplFields = Array.isArray(tpl?.editable_fields) ? tpl.editable_fields : [];
        const mergedMap = new Map();
        [...existing, ...tplFields].forEach(f => { if (f && f.path) mergedMap.set(f.path, f); });
        const merged = Array.from(mergedMap.values());
        if ((components[index].has_options || tpl?.has_options) && !merged.some(f => f.type === 'optionList')) {
          merged.push({ key: 'options', path: 'items', type: 'optionList', label: 'Options' });
        }
        return merged;
      })()
    } : null;
    if (window.__ISET_DEBUG_INLINE_EDIT) {
      try { window.__ISET_SELECTED = nextSel ? JSON.parse(JSON.stringify(nextSel)) : null; } catch (_) { window.__ISET_SELECTED = nextSel; }
    }
    setSelectedComponent(nextSel);
  }, [components, availableComponents, tplById, setSelectedComponent]);
  // After components mutate, if we have a pending selection index, select it once the component exists
  useEffect(() => {
    if (pendingSelectIndexRef.current != null) {
      const idx = pendingSelectIndexRef.current;
      if (components[idx]) {
        handleSelectComponent(idx);
        pendingSelectIndexRef.current = null;
      }
    }
  }, [components, handleSelectComponent]);

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
  const toApiComponents = (arr) => {
    return (Array.isArray(arr) ? arr : []).map(c => {
      if (!c) return c;
      const templateKey = c.template_key || c.type;
      // Shallow clone props to avoid mutating editor state
      const props = c.props ? { ...c.props } : {};
      // If summary-list has been configured (workflow selected or included rows chosen), drop placeholder rows
      if ((templateKey === 'summary-list') && props) {
        const hasConfig = (Array.isArray(props.included) && props.included.length) || props.workflowId;
        if (hasConfig && Array.isArray(props.rows)) {
          delete props.rows; // prevent hybrid state (placeholder + included)
        }
      }
      return {
        templateId: c.templateId ?? c.template_id ?? c.id, // be forgiving
        template_key: templateKey, // include for server-side sanitation / future logic
        props
      };
    });
  };

  const handleSaveTemplate = async () => {
    // DB-only save of step JSON
    try {
  const payload = { name, status, components: toApiComponents(components) };
      if (id === 'new') {
        const res = await apiFetch(`/api/steps`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const out = await res.json();
        if (!res.ok) throw new Error(out?.error || `HTTP ${res.status}`);
        setAlert({ type: 'success', message: 'Created new Step.' });
        history.push(`/modify-component/${out.id}`);
      } else {
        const res = await apiFetch(`/api/steps/${id}`, {
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
  /* stopConditions removed */
      setManualDirty(false);
    } catch (e) {
      console.error('Save step failed', e);
      setAlert({ type: 'error', message: 'Failed to save step.' });
    }
  };

  const handleSaveAsNew = async () => {
    try {
  const payload = { name: `${name} (copy)`, status, components: toApiComponents(components) };
      const res = await apiFetch(`/api/steps`, {
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
      const res = await apiFetch(`/api/steps/${id}`, { method: 'DELETE' });
      const out = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const workflows = Array.isArray(out?.workflows) && out.workflows.length
          ? ` (${out.workflows.slice(0, 5).join(', ')})`
          : '';
        setAlert({ type: 'warning', message: `${out?.error || 'Step is referenced by a workflow.'}${workflows}` });
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
  // Step-level validation state (deterministic advisory)
  const [validationIssues, setValidationIssues] = useState([]);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  // Modal for detailed issue view
  const [activeIssue, setActiveIssue] = useState(null);

  // Auto-suppress generic validation panel for file-upload components (panel not relevant)
  useEffect(() => {
    if (selectedComponent && (selectedComponent.type === 'file-upload' || selectedComponent.template_key === 'file-upload')) {
      if (showValidationPanel) setShowValidationPanel(false);
    }
  }, [selectedComponent, showValidationPanel]);

  const runValidation = useCallback(() => {
    const stepObj = { name, status, components };
    const issues = validateStep(stepObj);
    setValidationIssues(issues);
    setShowValidationPanel(true);
  }, [name, status, components]);

  // Map of latest active template versions by key for upgrade detection
  const latestTemplateVersionByKey = useMemo(() => {
    const m = new Map();
    availableComponents.forEach(t => {
      const k = t.template_key || t.type;
      if (!m.has(k) || (t.version || 0) > (m.get(k) || 0)) m.set(k, t.version || 0);
    });
    return m;
  }, [availableComponents]);

  // Upgrade selected component to latest template version, merging props conservatively
  const upgradeSelectedComponent = useCallback(() => {
    if (!selectedComponent) return;
    const key = selectedComponent.template_key || selectedComponent.type;
    const latestTpl = availableComponents.find(t => (t.template_key || t.type) === key);
    if (!latestTpl || (latestTpl.version || 0) <= (selectedComponent.version || 0)) return;
    const oldProps = selectedComponent.props || {};
    const newDefaults = seedI18nDefaults(latestTpl.props || {}, previewLang);
    const merge = (oldVal, newVal) => {
      if (oldVal === undefined) return newVal;
      if (typeof newVal !== 'object' || newVal === null) return oldVal !== undefined ? oldVal : newVal;
      if (Array.isArray(newVal)) return Array.isArray(oldVal) ? oldVal : newVal;
      const out = { ...newVal };
      Object.keys(oldVal || {}).forEach(k => {
        if (k in newVal) out[k] = merge(oldVal[k], newVal[k]);
      });
      return out;
    };
    const mergedProps = merge(oldProps, newDefaults);
    setComponents(prev => prev.map((c, i) => i === selectedComponent.index ? {
      ...c,
      version: latestTpl.version,
      props: mergedProps,
      editable_fields: latestTpl.editable_fields || c.editable_fields
    } : c));
    setSelectedComponent(sc => sc ? {
      ...sc,
      version: latestTpl.version,
      props: mergedProps,
      editable_fields: latestTpl.editable_fields || sc.editable_fields
    } : sc);
  }, [selectedComponent, availableComponents, setComponents, previewLang]);

  /* existing state & effects unchanged */

  return (
    <>
      <style>{`
  .stage { padding: 8px; background: #fafafa; min-height: 160px; border: 1px dashed #d5dbdb; }
  .stage--dragging { cursor: grabbing; }
  .stage-card { background:#fff; border:1px solid #d5dbdb; border-radius:8px; padding:12px; margin-bottom:12px; position:relative; transition: transform 0.12s ease, box-shadow 0.12s ease; }
        .stage-card.selected { box-shadow: 0 0 0 2px #0972d3 inset; }
  .stage-card--dragging { opacity: 0.55; transform: scale(0.995); }
        .stage-card .handle { cursor:grab; position:absolute; left:8px; top:8px; opacity:0.6; }
        .stage-card .delete { cursor:pointer; position:absolute; right:8px; top:8px; opacity:0.7; }
        .stage-card .inline-edit-target { cursor:text; }
        .stage .govuk-embedded { background:#fff; }
        /* GOV.UK background normalised inside editor */
        .stage .govuk-form-group { margin-bottom: 20px; }
        .stage .govuk-label, .stage .govuk-fieldset__legend { margin-bottom: 5px; }
  .stage-card .conditional-badge { box-shadow: 0 0 0 1px #fff, 0 1px 3px rgba(0,0,0,0.25); position:relative; }
  .stage-card .conditional-badge__tooltip { display:none; position:absolute; top:110%; right:0; background:#1d1d29; color:#fff; padding:6px 8px; border-radius:6px; width:220px; z-index:10; box-shadow:0 2px 6px rgba(0,0,0,0.35); text-transform:none; letter-spacing:normal; }
  .stage-card .conditional-badge__tooltip:before { content:""; position:absolute; top:-5px; right:12px; width:8px; height:8px; background:#1d1d29; transform:rotate(45deg); }
  .stage-card .conditional-badge[data-has-detail]:hover .conditional-badge__tooltip { display:block; }
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
                <Button onClick={runValidation} variant="normal">Validate</Button>
                <Button onClick={handleSaveTemplate} disabled={!hasChanges && !manualDirty} variant="primary">Save Changes</Button>
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
            {availableComponents.map((comp) => (
              <ComponentItem
                key={comp.id}
                component={comp}
                currentLang={previewLang}
                onAdd={(c) => addComponent(c, previewLang)}
              />
            ))}
          </Box>

          <Box padding="m">
            {showValidationPanel && !(selectedComponent && (selectedComponent.type === 'file-upload' || selectedComponent.template_key === 'file-upload')) && (
              <ExpandableSection headerText={`Validation Results (${validationIssues.length})`} defaultExpanded>
                <SpaceBetween size="s">
                  {validationIssues.length === 0 && <Box color="text-body-secondary">No issues found.</Box>}
                  {validationIssues.length > 0 && (() => {
                    const summary = summarizeIssues(validationIssues);
                    return (
                      <SpaceBetween size="s">
                        <SpaceBetween direction="horizontal" size="xs">
                          <Badge color={summary.error ? 'red' : 'grey'}>{summary.error} errors</Badge>
                          <Badge color={summary.warning ? 'yellow' : 'grey'}>{summary.warning} warnings</Badge>
                          <Badge color={summary.info ? 'blue' : 'grey'}>{summary.info} info</Badge>
                          <Button variant="inline-link" onClick={() => setShowValidationPanel(false)}>Hide</Button>
                          <Button variant="inline-link" onClick={runValidation}>Re-run</Button>
                        </SpaceBetween>
                        <Table
                          variant="embedded"
                          columnDefinitions={[
                            { id: 'sev', header: 'Severity', cell: i => i.severity },
                            { id: 'cat', header: 'Category', cell: i => i.category },
                            { id: 'msg', header: 'Message (click row for full)', cell: i => {
                                const m = i.message || '';
                                return m.length > 110 ? m.slice(0, 110) + '…' : m;
                              } },
                            { id: 'comp', header: 'Component', cell: i => (i.componentName || (i.componentIndex!=null? `#${i.componentIndex+1}` : '')) }
                          ]}
                          items={validationIssues}
                          stickyHeader
                          resizableColumns
                          onRowClick={({ detail }) => setActiveIssue(detail.item)}
                          ariaLabels={{ tableLabel: 'Validation issues table' }}
                        />
                        {activeIssue && (
                          <Modal
                            visible={!!activeIssue}
                            onDismiss={() => setActiveIssue(null)}
                            header={`Validation Issue: ${activeIssue.severity?.toUpperCase()}`}
                            size="medium"
                            closeAriaLabel="Close issue details"
                          >
                            <SpaceBetween size="s">
                              <Box><strong>Severity:</strong> {activeIssue.severity}</Box>
                              <Box><strong>Category:</strong> {activeIssue.category}</Box>
                              {activeIssue.componentName || activeIssue.componentIndex!=null ? (
                                <Box><strong>Component:</strong> {activeIssue.componentName || `#${(activeIssue.componentIndex||0)+1}`}</Box>
                              ) : null}
                              <Box><strong>Message:</strong><br />{activeIssue.message}</Box>
                              {activeIssue.suggestion && (
                                <Box><strong>Suggestion:</strong><br />{activeIssue.suggestion}</Box>
                              )}
                              <Box textAlign="right">
                                <Button variant="primary" onClick={() => setActiveIssue(null)}>Close</Button>
                              </Box>
                            </SpaceBetween>
                          </Modal>
                        )}
                      </SpaceBetween>
                    );
                  })()}
                </SpaceBetween>
              </ExpandableSection>
            )}
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
                allComponents={components}
                availableTemplates={availableComponents}
                addExternalComponent={(comp) => {
                  setComponents(prev => [...prev, comp]);
                }}
                currentLang={previewLang}
                latestTemplateVersionByKey={latestTemplateVersionByKey}
                onUpgradeTemplate={upgradeSelectedComponent}
              />
              <ExpandableSection headerText="Translations" defaultExpanded={false}>
                <TranslationsWidget
                  actions={{ markDirty: () => setManualDirty(true) }}
                  components={components}
                  setComponents={setComponents}
                  asBoardItem={false}
                />
              </ExpandableSection>
              {selectedComponent && (() => {
                const t = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
                const allowed = new Set(['textarea','select','radio','radios','password-input','input','date-input','checkbox','checkboxes','character-count']);
                if (!allowed.has(t)) return null; // file-upload intentionally excluded (no per-component validation panel)
                return (
                  <ExpandableSection headerText="Validation" defaultExpanded={false}>
                    <ValidationEditor
                      selectedComponent={selectedComponent}
                      updateComponentProperty={updateComponentProperty}
                      allComponents={components}
                    />
                  </ExpandableSection>
                );
              })()}
              {selectedComponent && (() => {
                // Scaffold: Conditional visibility editor (beta) for file-upload components
                const t = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
                if (t !== 'file-upload') return null;
                const idx = selectedComponent.index;
                // Gather prior components as potential refs
                // Local step prior components
                const inputLikeTypes = new Set(['input','text','email','phone','password','number','textarea','select','radio','radios','checkbox','checkboxes','date','date-input','character-count','file-upload']);
                const priorLocal = components.slice(0, idx).filter(Boolean).filter(c => {
                  const ttype = String(c.template_key || c.type || '').toLowerCase();
                  return inputLikeTypes.has(ttype);
                }).map((c,i) => {
                  const ref = c.props?.name || c.props?.id || c.id || c.templateId || `comp-${i+1}`;
                  return { label: ref, value: ref, group: 'This Step' };
                });
                // Prototype: if workflow fields snapshot already attached to this component (e.g., via future PropertiesPanel selection)
                // expect structure props.__workflowFields = [{ stepId, components:[{ ref, label }] }]
                const wfFields = [];
                try {
                  const snap = selectedComponent.props?.__workflowFields;
                  if (Array.isArray(snap)) {
                    const includeTypes = new Set(['input','text','email','phone','password','number','textarea','select','radio','checkbox','checkboxes','date','date-input','character-count','file-upload']);
                    snap.forEach(s => {
                      const sid = s.stepName || s.stepId || 'Step';
                      (s.components||[]).forEach(f => {
                        if (!f) return;
                        const ref = f.ref || f.name || f.id;
                        if (!ref) return;
                        let ttype = String(f.type || '').toLowerCase();
                        if (!ttype && f.templateKey) ttype = String(f.templateKey).toLowerCase();
                        // Exclude anything not explicitly in allowlist (including missing type)
                        if (!ttype || !includeTypes.has(ttype)) return; // skip non-input / display-only components
                        const lab = f.label || ref;
                        wfFields.push({ label: `${lab} (${sid})`, value: ref, group: sid });
                      });
                    });
                  }
                } catch (_) {}
                const prior = [...priorLocal, ...wfFields];
                const conditions = selectedComponent.props?.conditions || { all: [] };
                // Local ephemeral control state is not kept; rely on immediate writes to component props via setComponents.
                const addRule = (rule) => {
                  setComponents(prev => prev.map((c,i) => {
                    if (i !== idx) return c;
                    const nextConds = c.props?.conditions && typeof c.props.conditions === 'object' ? { ...c.props.conditions } : { all: [] };
                    if (!Array.isArray(nextConds.all)) nextConds.all = [];
                    nextConds.all = [...nextConds.all, rule];
                    return { ...c, props: { ...(c.props||{}), conditions: nextConds } };
                  }));
                  // Refresh selectedComponent reference
                  setSelectedComponent(sc => sc && sc.index === idx ? { ...components[idx], index: idx, props: { ...components[idx].props, conditions: { ...(conditions || { all: [] }), all: [...(conditions.all||[]), rule] } } } : sc);
                };
                const removeRule = (rIdx) => {
                  setComponents(prev => prev.map((c,i) => {
                    if (i !== idx) return c;
                    const nextConds = c.props?.conditions && typeof c.props.conditions === 'object' ? { ...c.props.conditions } : { all: [] };
                    if (Array.isArray(nextConds.all)) nextConds.all = nextConds.all.filter((_,ri) => ri !== rIdx);
                    return { ...c, props: { ...(c.props||{}), conditions: nextConds } };
                  }));
                  setSelectedComponent(sc => sc && sc.index === idx ? { ...components[idx], index: idx } : sc);
                };
                // Temporary state for new rule inputs kept in refs to avoid re-renders
                // Replaced ref object with component state (condDraftRef/Op/Value) so inputs are interactive.
                const condWfId = selectedComponent.props?.conditionsWorkflowId || null;
                return (
                  <ExpandableSection headerText="Conditional Visibility (Beta)" defaultExpanded={false}>
                    <SpaceBetween size="s">
                      <Box variant="p" fontSize="body-s" color="text-body-secondary">
                        Show this file upload only when all listed conditions evaluate true. Stored under props.conditions.all[].
                      </Box>
                      <FormField label="Workflow context" description="Optionally pull fields from another workflow's steps.">
                        <Select
                          statusType={condWfLoading ? 'loading' : 'finished'}
                          placeholder={condWfLoading ? 'Loading workflows…' : 'Select workflow (optional)'}
                          selectedOption={condWfId && condWorkflows.find(w => w.id === condWfId) ? { label: condWorkflows.find(w => w.id === condWfId).name, value: condWfId } : null}
                          onChange={({ detail }) => handleSelectCondWorkflow(detail.selectedOption?.value || null)}
                          options={condWorkflows.map(w => ({ label: w.name, value: w.id }))}
                          expandToViewport
                        />
                      </FormField>
                      {!condWfId && (
                        <Box color="text-body-secondary">Select a workflow to configure visibility conditions.</Box>
                      )}
                      {condWfId && !selectedComponent.props?.__workflowFields && (
                        <Box variant="span" color="text-status-info">Loading workflow fields…</Box>
                      )}
                      {condWfId && selectedComponent.props?.__workflowFields && (
                        <>
                          {(() => {
                            const snap = selectedComponent.props?.__workflowFields || [];
                            const totalFields = snap.reduce((acc,s)=> acc + ((s.components&&s.components.length)||0),0);
                            if (totalFields === 0) {
                              return (
                                <Alert type="info">
                                  No input fields found in the selected workflow steps. The field list below will remain empty until that workflow has components with identifiable refs (props.name or id).
                                </Alert>
                              );
                            }
                            return null;
                          })()}
                          <Table
                            variant="embedded"
                            columnDefinitions={[
                              { id: 'ref', header: 'Ref', cell: r => r.ref },
                              { id: 'op', header: 'Op', cell: r => r.op },
                              { id: 'val', header: 'Value', cell: r => (r.value===undefined||r.value===null||r.value==='') ? '—' : String(r.value) },
                              { id: 'act', header: '', cell: (_r, ri) => (
                                <Button variant="icon" iconName="close" ariaLabel="Remove" onClick={() => removeRule(ri)} />
                              ) }
                            ]}
                            items={(conditions.all||[]).map(r => ({ ...r }))}
                            empty={<Box color="text-body-secondary">No conditions defined.</Box>}
                            ariaLabels={{ tableLabel: 'Conditional visibility rules' }}
                          />
                          <SpaceBetween size="xs">
                            <FormField label="When field" stretch>
                              <Select
                                selectedOption={condDraftRef ? { label: condDraftRef, value: condDraftRef } : null}
                                onChange={({ detail }) => { setCondDraftRef(detail.selectedOption?.value || ''); }}
                                options={prior}
                                placeholder="Select a field"
                              />
                            </FormField>
                            <FormField label="Operator">
                              <Select
                                selectedOption={{ label: condDraftOp, value: condDraftOp }}
                                onChange={({ detail }) => {
                                  const next = detail.selectedOption?.value || 'equals';
                                  setCondDraftOp(next);
                                  if (['exists','notExists'].includes(next)) setCondDraftValue('');
                                }}
                                options={[ 'equals','notEquals','exists','notExists','>','<' ].map(o => ({ label: o, value: o }))}
                              />
                            </FormField>
                            <FormField label="Value" description="Ignored for exists/notExists">
                              <Input
                                value={condDraftValue}
                                onChange={({ detail }) => { setCondDraftValue(detail.value); }}
                                placeholder="e.g. married"
                                disabled={['exists','notExists'].includes(condDraftOp)}
                              />
                            </FormField>
                            <Button
                              onClick={() => {
                                if (!condDraftRef) return;
                                const rule = { ref: condDraftRef, op: condDraftOp };
                                if (!['exists','notExists'].includes(condDraftOp)) rule.value = condDraftValue;
                                addRule(rule);
                                // reset draft
                                setCondDraftRef('');
                                setCondDraftOp('equals');
                                setCondDraftValue('');
                              }}
                              variant="primary"
                            >Add condition</Button>
                          </SpaceBetween>
                        </>
                      )}
                    </SpaceBetween>
                  </ExpandableSection>
                );
              })()}
              {/* Step Validation (Stop Conditions) UI removed */}
              {!showValidationPanel && validationIssues.length > 0 && !(selectedComponent && (selectedComponent.type === 'file-upload' || selectedComponent.template_key === 'file-upload')) && (
                <Alert type={validationIssues.some(i=>i.severity==='error')? 'warning':'info'}>
                  Previous validation run found {validationIssues.length} issue(s). <Button variant="inline-link" onClick={()=>setShowValidationPanel(true)}>Show details</Button>
                </Alert>
              )}
            </SpaceBetween>
          </Box>
        </Grid>
      </Container>
    </>
  );
};
export { setComponentConfigValue };
export default ModifyComponent;
