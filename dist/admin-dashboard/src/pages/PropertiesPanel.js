// Updated rewrite of PropertiesPanel.js – consistent Container usage and spacing
import React, { useEffect, useState, useRef, useMemo } from 'react';
// Switched from raw axios calls to authenticated apiFetch wrapper (adds bearer / dev bypass headers)
import { apiFetch } from '../auth/apiClient';
import { Box, Container, Header, Table, Input, Button, Select, SpaceBetween, FormField, Textarea, Badge, Popover, Checkbox, Toggle, ExpandableSection, Spinner, Modal, Alert } from '@cloudscape-design/components';
import Avatar from '@cloudscape-design/chat-components/avatar';
import get from 'lodash/get';
import Ajv from 'ajv';

const PropertiesPanel = ({ selectedComponent, updateComponentProperty, pageProperties, setPageProperties, currentLang = 'en', latestTemplateVersionByKey, onUpgradeTemplate, allComponents, addExternalComponent, availableTemplates = [] }) => {
  const [availableDataSources, setAvailableDataSources] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [optionSourceMode, setOptionSourceMode] = useState('static');
  const suppressOptionModeEffectRef = useRef(false);
  const suppressNextModeEffect = useRef(false);
  const [validationErrors, setValidationErrors] = useState({});
  // AI option generation state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiStatus, setAiStatus] = useState(null); // { type:'error'|'success'|'info', text }
  const [showAiOptionsModal, setShowAiOptionsModal] = useState(false);
  const [aiPreview, setAiPreview] = useState(null); // { options: [...] } pending approval


  const ajv = useMemo(() => new Ajv({ allErrors: true, strict: false }), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch('/api/option-data-sources');
        if (!resp.ok) throw new Error('option-data-sources fetch failed: ' + resp.status);
        const json = await resp.json();
        if (!cancelled) setAvailableDataSources(json || []);
      } catch (e) {
        console.error('Failed to load data sources', e);
        if (!cancelled) setAvailableDataSources([]);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selectedComponent) return;

    if (suppressNextModeEffect.current) {
      suppressNextModeEffect.current = false;
      return;
    }
    if (suppressOptionModeEffectRef.current) {
      suppressOptionModeEffectRef.current = false;
      return;
    }
    const mode = selectedComponent.props?.mode ?? 'static';
    setOptionSourceMode(mode === 'simple' ? 'static' : mode);
    const endpoint = selectedComponent.props?.endpoint;
    setSelectedEndpoint(mode === 'dynamic' ? endpoint || null : null);
  }, [selectedComponent]);

  const handleOptionModeChange = (mode, editableField) => {
    suppressOptionModeEffectRef.current = true;
    if (mode === 'dynamic') suppressNextModeEffect.current = true;
    setOptionSourceMode(mode);
    if (mode === 'static' || mode === 'simple') {
      updateComponentProperty('props.mode', 'static', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true);
    } else if (mode === 'dynamic') {
      setSelectedEndpoint(null);
      updateComponentProperty('props.mode', 'dynamic', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true);
    } else if (mode === 'snapshot') {
      updateComponentProperty('props.mode', 'snapshot', true);
      updateComponentProperty(editableField.path, [], true);
    }
  };

  const handleSnapshotFetch = async (endpoint, editableField) => {
    try {
  const resp = await apiFetch(endpoint.startsWith('http') ? endpoint : endpoint);
  if (!resp.ok) throw new Error('snapshot fetch failed ' + resp.status);
  const data = await resp.json();
      const schema = selectedComponent?.option_schema || ['text', 'value'];
      const mapped = data.map((item) => {
        const option = {};
        if (schema.includes('text')) option.text = item.name;
        if (schema.includes('value')) option.value = String(item.id);
        return option;
      });
      updateComponentProperty(editableField.path, mapped, true);
      updateComponentProperty('props.mode', 'static', true);
      updateComponentProperty('props.endpoint', null, true);
      setOptionSourceMode('static');
    } catch (err) {
      console.error('Snapshot fetch failed', err);
    }
  };

  const handleEndpointChange = (endpoint, editableField) => {
    setSelectedEndpoint(endpoint);
    if (endpoint) {
      updateComponentProperty('props.endpoint', endpoint, true);
      updateComponentProperty('props.attributes', { 'data-options-endpoint': endpoint }, true);
      updateComponentProperty(editableField.path, [], true);
    }
  };

  const handleAddOption = (editableField) => {
    const current = get(selectedComponent?.props, editableField.path) || [];
    updateComponentProperty(editableField.path, [...current, { text: '', value: '' }], true);
  };

  const handleRemoveOption = (index, editableField) => {
    const current = get(selectedComponent?.props, editableField.path) || [];
    const updated = current.filter((_, i) => i !== index);
    updateComponentProperty(editableField.path, updated, true);
  };

  const getSchema = () => selectedComponent?.option_schema || ['text', 'value'];
  const currentMode = optionSourceMode;

  // --- AI Option Generation ---
  const generateOptionsWithAI = async (editableField) => {
    setAiStatus(null);
    setAiPreview(null);
    const prompt = (aiPrompt || '').trim();
    if (!prompt) { setAiStatus({ type: 'error', text: 'Enter a description first.' }); return; }
    const schema = getSchema();
    setAiGenerating(true);
    try {
      // Lazy import to avoid circular if any
      const { apiFetch } = require('../auth/apiClient');
      const system = {
        role: 'system',
        content: 'You are an assistant that generates structured option lists for form controls. Output ONLY compact JSON: { "options": [ { ... } ] }. No explanations.'
      };
      const user = {
        role: 'user',
        content: JSON.stringify({
          instruction: 'Generate distinct, user-friendly options based on the description. Provide value (machine-friendly slug) and text (label). Include hint only if clearly requested and schema allows. Limit to max 40 options. For simple binary or yes/no style prompts, generate only necessary options.',
          description: prompt,
          requiredKeys: schema,
          examples: [
            { description: 'Yes No', options: [ { value: 'yes', text: 'Yes' }, { value: 'no', text: 'No' } ] },
            { description: 'Canadian Provinces and Territories', options: [ { value: 'ab', text: 'Alberta' }, { value: 'bc', text: 'British Columbia' } ] }
          ]
        })
      };
      const res = await apiFetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [system, user] })
      });
      if (res.status === 501) {
        setAiStatus({ type: 'error', text: 'AI service disabled on server.' });
        return;
      }
      const data = await res.json().catch(() => ({}));
      const raw = data?.choices?.[0]?.message?.content || '';
      const parsed = (() => {
        try { return JSON.parse(raw); } catch (_) {}
        // Attempt extraction of first JSON object substring
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch (_) {} }
        return null;
      })();
      const optArr = Array.isArray(parsed?.options) ? parsed.options : [];
      if (!optArr.length) {
        setAiStatus({ type: 'error', text: 'AI returned no options.' });
        return;
      }
      const slug = (s) => String(s || '')
        .toLowerCase()
        .replace(/&/g,' and ')
        .replace(/[^a-z0-9]+/g,'-')
        .replace(/^-+|-+$/g,'')
        .slice(0,64) || 'opt';
      const existingValues = new Set();
      const cleaned = optArr
        .filter(o => o && (o.text || o.value))
        .map((o,i) => {
          const text = String(o.text || o.value || `Option ${i+1}`).trim();
          let value = String(o.value || slug(text));
          value = value || slug(text);
          if (existingValues.has(value)) {
            let base = value; let n=2; while (existingValues.has(base+'-'+n)) n++; value = base+'-'+n;
          }
          existingValues.add(value);
          const item = {};
          if (schema.includes('value')) item.value = value;
          if (schema.includes('text')) item.text = text;
          if (schema.includes('hint') && o.hint) item.hint = o.hint;
          return item;
        })
        .slice(0, 40);
      if (!cleaned.length) { setAiStatus({ type: 'error', text: 'No valid options after cleaning.' }); return; }
      // Store preview instead of applying immediately
      setAiPreview({ options: cleaned, fieldPath: editableField.path });
      setAiStatus({ type: 'success', text: `Preview generated with ${cleaned.length} option(s). Review and approve to apply.` });
    } catch (e) {
      setAiStatus({ type: 'error', text: `Generation failed: ${e.message || String(e)}` });
    } finally {
      setAiGenerating(false);
    }
  };

  const applyAiPreview = () => {
    if (!aiPreview || !Array.isArray(aiPreview.options)) return;
    const { options: cleaned, fieldPath } = aiPreview;
    updateComponentProperty(fieldPath, cleaned, true);
    if (selectedComponent?.props?.mode !== 'static') {
      updateComponentProperty('props.mode', 'static', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true);
      setOptionSourceMode('static');
    }
    setAiStatus({ type: 'success', text: `Applied ${cleaned.length} option(s).` });
    setAiPreview(null);
    setShowAiOptionsModal(false);
  };

  const discardAiPreview = () => {
    setAiPreview(null);
    setAiStatus(null);
  };

  const asLangString = (val, lang = 'en') => {
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      if (Object.prototype.hasOwnProperty.call(val, 'en') || Object.prototype.hasOwnProperty.call(val, 'fr')) {
        return String(val[lang] ?? val.en ?? val.fr ?? '');
      }
      try { return JSON.stringify(val); } catch { return String(val); }
    }
    return String(val);
  };

  const componentJsonSchema = useMemo(() => {
    const fields = (selectedComponent?.editable_fields || []).filter(f => f.type !== 'optionList');
    const properties = {};
    const required = [];
    for (const f of fields) {
      const key = f.path;
      // Default assumption
      let type = 'string';
      if (f.type === 'checkbox' || f.type === 'boolean') type = 'boolean';
      if (f.type === 'attributes') type = 'array';
      if (['number','integer'].includes(f.type)) type = 'number';
      // If options provided (select/enum) remain string unless actual value indicates boolean
      if (f.type === 'select' && Array.isArray(f.options)) type = 'string';
      // Heuristic: if current prop value is strictly boolean, treat as boolean regardless of declared field type
      try {
        const currentVal = get(selectedComponent?.props, key);
        if (typeof currentVal === 'boolean') type = 'boolean';
      } catch { /* ignore */ }
      properties[key] = { type };
      // Allow blank string for optional numeric fields to avoid immediate error badge
      if (type === 'number' && !f.required) {
        properties[key] = { anyOf: [ { type: 'number' }, { type: 'string', enum: [''] } ] };
      }
      if (type === 'string' && f.type === 'select' && Array.isArray(f.options)) {
        const enumVals = f.options.map(o => (o.value ?? o));
        // Allow empty / unset as a valid non-required state so we don't show an error badge immediately
        if (!f.required && !enumVals.includes('')) enumVals.push('');
        // Include current value (e.g., pre-seeded 'govuk-radios') to prevent false validation errors
        try {
          const currentVal = get(selectedComponent?.props, key);
            if (typeof currentVal === 'string' && currentVal && !enumVals.includes(currentVal)) {
              enumVals.push(currentVal);
            }
        } catch { /* ignore */ }
        properties[key].enum = enumVals;
      }
      if (f.required) required.push(key);
    }
    return { type: 'object', properties, required };
  }, [selectedComponent?.editable_fields, selectedComponent?.props]);

  const flattenI18n = (val) => {
    if (!val) return val;
    if (typeof val === 'object' && (Object.prototype.hasOwnProperty.call(val,'en') || Object.prototype.hasOwnProperty.call(val,'fr'))) {
      return val[currentLang] ?? val.en ?? val.fr ?? '';
    }
    return val;
  };

  const validateProps = (props) => {
    try {
      const validate = ajv.compile(componentJsonSchema);
      const flat = {};
      (selectedComponent?.editable_fields || []).forEach(f => {
        if (!f.path) return;
        flat[f.path] = flattenI18n(get(props, f.path));
      });
      const ok = validate(flat);
      const errs = {};
      if (!ok && Array.isArray(validate.errors)) {
        for (const e of validate.errors) {
          const k = e.instancePath?.replace(/^\//, '') || e.params.missingProperty || e.schemaPath || 'props';
          errs[k] = e.message || 'Invalid value';
        }
      }
      // Data Key pattern + uniqueness (client-side advisory)
      const dataKey = flat['name'];
      if (typeof dataKey === 'string') {
        if (dataKey.trim() === '') {
          errs['name'] = errs['name'] || 'Data Key required';
        } else if (!/^[-a-z0-9_]+$/.test(dataKey)) {
          errs['name'] = 'Use lowercase letters, digits, hyphen or underscore.';
        } else {
          try {
            const siblings = (pageProperties?.components || []).filter(c => c !== selectedComponent);
            if (siblings.some(c => (c.props?.name || '') === dataKey)) {
              errs['name'] = 'Data Key must be unique on page';
            }
          } catch { /* ignore */ }
        }
      }
      setValidationErrors(errs);
    } catch (e) {
      setValidationErrors({});
    }
  };

  const hintFor = (path, label) => {
    const p = String(path || '').toLowerCase();
    if (p === 'label.classes') return 'Label size and visibility. Use govuk-label--s|m|l|xl or govuk-visually-hidden.';
    if (p === 'fieldset.legend.classes') return 'Legend size for radios/checkboxes. Use govuk-fieldset__legend--s|m|l|xl or govuk-visually-hidden.';
    if (p === 'hint.text') return 'Helper text shown under the label. Keep it short and actionable.';
    if (p === 'formgroup.classes' || p === 'formgroup.classes'.toLowerCase()) return 'Classes on the surrounding form group. Use GOV.UK spacing utilities; avoid error classes.';
    if (p === 'classes') return 'Extra CSS classes on the control. Space-separated; prefer GOV.UK utilities.';
    if (p.endsWith('.classes')) return 'Extra CSS classes on this element. Space-separated; prefer GOV.UK utilities.';
    if (p === 'autocomplete') return 'HTML autocomplete hint for browsers (e.g., email, given-name). Leave blank unless clear.';
    if (p === 'inputmode' || p === 'inputmode'.toLowerCase()) return 'Virtual keyboard hint for mobile (e.g., numeric, email, tel).';
    if (p === 'type' || p === 'props.type') return 'HTML input type (text, email, number, etc.). Affects validation and keyboards.';
  if (p === 'pattern') return 'Regular expression (JavaScript) tested against the entire value. Tips: ^ anchors start, $ anchors end. Escape backslashes \\ in patterns. Keep client regex simple (format only) and use server validation for complex/business rules. Examples: ^[0-9]{5}$ (US ZIP), ^[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d$ (CA postal), ^\\d+$ (digits only). Leave blank for no client pattern.';
    if (p === 'spellcheck') return 'Enable for free text (true); disable for codes, emails, or numbers (false).';
    if (p === 'disabled') return 'Prevents user interaction. Usually false for live forms.';
    if (p === 'describedby') return 'Space-separated IDs appended to aria-describedby. Advanced accessibility wiring.';
    if (p.startsWith('prefix.')) return 'Non-editable text before the input (e.g., $).';
    if (p.startsWith('suffix.')) return 'Non-editable text after the input (e.g., kg).';
  if (p === 'attributes') return 'Custom attributes (e.g., data-*). Use cautiously and document usage.';
  if (p === 'name') return 'Data Key: identifier used in submission JSON and exports. Lowercase, unique per page.';
  if (p === 'id') return 'HTML id attribute (used for label association); usually match Submission Key.';
  if (p === 'rows') return 'Visible height (number of text rows).';
  if (p === 'maxlength') return 'Maximum character count enforced by the component.';
  if (p === 'threshold') return 'Percentage (0-100) when the counter starts showing (e.g., 75).';
  if (p === 'maxwords') return 'Optional maximum word count (leave blank to ignore).';
  if (p === 'value') return 'Default pre-filled value (leave blank for none).';
  if (p === 'accept') return 'Comma-separated file types. Use extensions like .pdf,.jpg or MIME types like image/png, application/pdf. Leave blank to allow any.';
  if (p === 'multiple') return 'Allow selecting and uploading multiple files. If enabled, submission stores an array of file objects.';
  if (p === 'documenttype') return 'Optional document category tag (alphanumeric, dash, underscore). Sent to upload endpoint as metadata.';
  if (p === 'text') return 'Plain text content (displayed inside the inset area / static content component). Keep concise: 1–3 short sentences. Avoid headings or interactive elements.';
  if (p === 'html') return 'Optional HTML override. If provided, it is rendered instead of Text. Keep markup minimal (links, <strong>, <em>). Do not include headings or form controls.';
  if (p === 'titletext') return 'Panel heading text (prominent). Should be a short confirmation or status (e.g., Application complete). Bilingual object allowed.';
  if (p === 'headinglevel') return 'HTML heading level for the panel title (1-4). Choose the level that fits the page outline. Do not skip levels.';
  if (p === 'summarytext') return 'Clickable summary that toggles visibility of the hidden details content. Keep concise.';
  if (p === 'open') return 'Whether the details are expanded by default. Usually false so users can choose to reveal.';
  if (p === 'text') return 'Bilingual text content (object with en/fr). Editing here affects current language view; provide both before publishing.';
  if (p === 'html') return 'Optional HTML override for this text block. If set, HTML is rendered instead of Text.';
    return null;
  };

  // Side-effect: when editing date-input autocomplete preset, project to items[].autocomplete
  useEffect(() => {
    try {
      const t = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
      if (t === 'date-input') {
        const preset = selectedComponent?.props?.autocompletePreset || '';
        const items = Array.isArray(selectedComponent?.props?.items) ? selectedComponent.props.items : [];
        // Only mutate if preset implies values and items missing autocomplete fields
        if (preset === 'dob') {
          const desired = { day: 'bday-day', month: 'bday-month', year: 'bday-year' };
          let needsUpdate = false;
            const nextItems = items.map(it => {
              if (!it || !it.name) return it;
              const want = desired[it.name];
              if (want && it.autocomplete !== want) {
                needsUpdate = true;
                return { ...it, autocomplete: want };
              }
              return it;
            });
          if (needsUpdate) {
            // NOTE: path should be relative to props; previously used 'props.items' which created props.props.items
            updateComponentProperty('items', nextItems, true);
          }
        } else if (preset === 'off') {
          // Force explicit autocomplete="off" on each part
          let needsUpdate = false;
          const nextItems = items.map(it => {
            if (!it || !it.name) return it;
            if (it.autocomplete !== 'off') { needsUpdate = true; return { ...it, autocomplete: 'off' }; }
            return it;
          });
          if (needsUpdate) updateComponentProperty('items', nextItems, true);
        } else if (preset === '' && Array.isArray(items) && items.some(it => it && it.autocomplete)) {
          // If user clears preset, remove previously applied autocomplete hints (only if they match the preset pattern)
          const pattern = /^bday-(day|month|year)$/;
          let changed = false;
          const nextItems = items.map(it => {
            if (it && pattern.test(it.autocomplete || '')) { changed = true; const { autocomplete, ...rest } = it; return rest; }
            return it;
          });
          if (changed) updateComponentProperty('items', nextItems, true);
        }
      }
    } catch { /* ignore */ }
  }, [selectedComponent?.props?.autocompletePreset, selectedComponent?.props?.items, selectedComponent?.template_key, selectedComponent?.type]);

  useEffect(() => {
    if (!selectedComponent) { setValidationErrors({}); return; }
    validateProps(selectedComponent.props || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedComponent?.props, selectedComponent?.editable_fields]);

  const AUTOCOMPLETE_SUGGESTIONS = useMemo(() => [
    '', 'on', 'off',
    'name', 'honorific-prefix', 'given-name', 'additional-name', 'family-name', 'honorific-suffix',
    'nickname', 'email', 'username', 'new-password', 'current-password', 'one-time-code',
    'organization', 'street-address', 'address-line1', 'address-line2', 'address-level2', 'address-level1', 'postal-code', 'country',
    'tel', 'tel-country-code', 'tel-national', 'tel-extension',
    'bday', 'bday-day', 'bday-month', 'bday-year',
    'sex', 'url', 'language'
  ], []);

  const INPUTMODE_SUGGESTIONS = useMemo(() => [
    '', 'text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search', 'none'
  ], []);

  const INPUT_TYPE_SUGGESTIONS = useMemo(() => [
    '', 'text', 'email', 'tel', 'url', 'number', 'password', 'search', 'date', 'datetime-local', 'month', 'time', 'week'
  ], []);

  const PATTERN_SUGGESTIONS = useMemo(() => [
    '',
    '^\\d+$',
    '^[0-9]{5}$',
    '^[0-9]{5}(?:-[0-9]{4})?$',
    '^[0-9]{10}$',
    '^[A-Za-z]\\d[A-Za-z] ?\\d[A-Za-z]\\d$'
  ], []);

  const LABEL_CLASS_SUGGESTIONS = useMemo(() => [
    '', 'govuk-label--s', 'govuk-label--m', 'govuk-label--l', 'govuk-label--xl', 'govuk-visually-hidden'
  ], []);

  const FIELDSET_LEGEND_CLASS_SUGGESTIONS = useMemo(() => [
    '', 'govuk-fieldset__legend--s', 'govuk-fieldset__legend--m', 'govuk-fieldset__legend--l', 'govuk-fieldset__legend--xl',
    'govuk-visually-hidden'
  ], []);

  const GENERIC_CLASS_SUGGESTIONS = useMemo(() => [
    '', 'govuk-visually-hidden', 'govuk-hint',
    'govuk-!-margin-bottom-2', 'govuk-!-margin-bottom-3', 'govuk-!-margin-bottom-4',
    'govuk-!-font-weight-bold',
    'govuk-radios--inline', 'govuk-radios--small',
    'govuk-checkboxes--inline', 'govuk-checkboxes--small'
  ], []);

  const isPath = (p, ...cands) => typeof p === 'string' && cands.some(c => p.toLowerCase() === c.toLowerCase());
  const endsWithPath = (p, suffix) => typeof p === 'string' && p.toLowerCase().endsWith(suffix.toLowerCase());

  const CuratedSelectWithCustom = ({ value, onChange, options, placeholder = 'Select...', width = 280 }) => {
    // Maintain a local extended list so committed custom values become first-class curated options for future edits
    const [extended, setExtended] = React.useState(() => [...options]);
    // Keep extended in sync when parent options change (but preserve previously added custom if still selected)
    useEffect(() => {
      setExtended(prev => {
        const baseSet = new Set(options);
        // retain any prior custom currently selected
        if (value && !options.includes(value) && prev.includes(value)) baseSet.add(value);
        return Array.from(baseSet);
      });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options.join('|')]);

    const isCustom = value != null && !extended.includes(value);
    const [showCustom, setShowCustom] = React.useState(isCustom);
    const [draft, setDraft] = React.useState(isCustom ? (value || '') : '');
    const inputRef = React.useRef(null);

    // Sync when external value changes
    useEffect(() => {
      const nowCustom = value != null && !extended.includes(value);
      if (nowCustom && !showCustom) { setShowCustom(true); setDraft(value || ''); }
      if (!nowCustom && showCustom && extended.includes(value || '')) { setShowCustom(false); }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, extended.join('|')]);

    const optionList = extended.map(v => ({ label: v === '' ? '(empty)' : v, value: v }));

    const selected = (showCustom || isCustom)
      ? { label: 'Custom…', value: '__custom__' }
      : { label: (value ?? '') === '' ? '(empty)' : (value ?? ''), value: value ?? '' };

    const promoteValue = (val) => {
      if (val && !extended.includes(val)) {
        setExtended(prev => [...prev, val]);
      }
    };

    const commitDraft = () => {
      const trimmed = draft.trim();
      if (!trimmed) { onChange(''); return; }
      promoteValue(trimmed);
      onChange(trimmed);
      // After committing, treat as curated selection
      setShowCustom(false);
    };

    const handleSelectChange = (v) => {
      if (v === '__custom__') {
        setShowCustom(true);
        if (!isCustom) {
          setDraft('');
          // Do not call onChange yet; wait for commit
        }
        setTimeout(() => { inputRef.current && inputRef.current.focus(); }, 0);
        return;
      }
      setShowCustom(false);
      onChange(v);
    };

    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: width }}>
        <Select
          expandToViewport
          selectedOption={selected}
          onChange={({ detail }) => handleSelectChange(detail.selectedOption.value)}
          options={[...optionList, { label: 'Custom…', value: '__custom__' }]}
          placeholder={placeholder}
        />
        {(showCustom || isCustom) && (
          <Input
            ref={inputRef}
            value={draft}
            placeholder="Enter custom value"
            onChange={({ detail }) => setDraft(detail.value)}
            onBlur={commitDraft}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); commitDraft(); }
              if (e.key === 'Escape') { e.preventDefault(); setShowCustom(false); }
            }}
          />
        )}
      </div>
    );
  };

  // Translation helpers
  const isI18nObject = (v) => v && typeof v === 'object' && (
    Object.prototype.hasOwnProperty.call(v, 'en') || Object.prototype.hasOwnProperty.call(v, 'fr')
  );
  const translatablePaths = new Set([
  'label.text', 'hint.text', 'errorMessage.text', 'fieldset.legend.text', 'titleText', 'summaryText', 'text'
  ]);
  const isTranslatablePath = (p) => translatablePaths.has(String(p || ''));

  // --- Summary List (dynamic workflow summarisation) ----------------------
  const isSummaryList = selectedComponent && (selectedComponent.template_key === 'summary-list' || selectedComponent.type === 'summary-list');
  const [workflows, setWorkflows] = useState([]);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [availableFields, setAvailableFields] = useState([]); // { key, labelEn, labelFr, stepName }

  useEffect(() => {
    if (!isSummaryList) return;
    let cancelled = false;
    setWorkflowLoading(true);
    (async () => {
      try {
        const resp = await apiFetch('/api/workflows');
        if (!resp.ok) throw new Error('workflows list failed ' + resp.status);
        const data = await resp.json();
        if (!cancelled) setWorkflows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn('Workflows fetch (summary-list) failed:', e.message);
        if (!cancelled) setWorkflows([]);
      } finally {
        if (!cancelled) setWorkflowLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSummaryList]);

  // Helper to extract field-like components from a workflow detail object
  const extractFieldsFromWorkflow = (wfDetail) => {
    if (!wfDetail || !Array.isArray(wfDetail.steps)) return [];
    // Need each step's components; fetch individually if API exists (/api/steps/:id)
    return []; // placeholder until we fetch steps below
  };

  const loadWorkflowFields = async (workflowId) => {
    if (!workflowId) { setAvailableFields([]); return; }
    setFieldsLoading(true);
    try {
      const wfResp = await apiFetch(`/api/workflows/${workflowId}`);
      if (!wfResp.ok) throw new Error('workflow detail ' + wfResp.status);
      const wf = await wfResp.json();
      const steps = Array.isArray(wf.steps) ? wf.steps : [];
      const routes = Array.isArray(wf.routes) ? wf.routes : [];
      // Build adjacency for traversal ordering (mirrors normalizer BFS intent)
      const byId = new Map(steps.map(s => [s.id, s]));
      const adj = new Map();
      steps.forEach(s => adj.set(s.id, new Set()));
      for (const r of routes) {
        if (!r || !r.source_step_id) continue;
        if (!adj.has(r.source_step_id)) adj.set(r.source_step_id, new Set());
        if (r.mode === 'linear' && r.default_next_step_id && byId.has(r.default_next_step_id)) {
          adj.get(r.source_step_id).add(r.default_next_step_id);
        } else if (r.mode === 'by_option') {
          if (Array.isArray(r.options)) {
            r.options.forEach(o => { if (o && o.next_step_id && byId.has(o.next_step_id)) adj.get(r.source_step_id).add(o.next_step_id); });
          }
          if (r.default_next_step_id && byId.has(r.default_next_step_id)) adj.get(r.source_step_id).add(r.default_next_step_id);
        }
      }
      const start = steps.find(s => s.is_start) || steps[0] || null;
      const orderedIds = [];
      const seen = new Set();
      if (start) {
        const q = [start.id];
        seen.add(start.id);
        while (q.length) {
          const cur = q.shift();
            orderedIds.push(cur);
            for (const nxt of (adj.get(cur) || [])) if (!seen.has(nxt)) { seen.add(nxt); q.push(nxt); }
        }
      }
      // Append any disconnected steps (unlikely but safe)
      for (const s of steps) if (!seen.has(s.id)) orderedIds.push(s.id);
      const out = [];
      for (const stepId of orderedIds) {
        const s = byId.get(stepId);
        if (!s) continue;
        try {
          const stepResp = await apiFetch(`/api/steps/${s.id}`);
          if (!stepResp.ok) continue;
          const step = await stepResp.json();
          const comps = Array.isArray(step.components) ? step.components : [];
          for (const c of comps) {
            const props = c.props || {};
            const key = props.name || props.fieldName || props.field_name || props.id;
            if (!key) continue;
            const t = (c.template_key || c.templateKey || c.type || '').toLowerCase();
            if (!t || t === 'summary-list') continue;
            const allowed = ['input','textarea','radio','radios','checkbox','checkboxes','select','date-input','file-upload'];
            if (!allowed.includes(t)) continue;
            let labelObj = props?.fieldset?.legend?.text || props?.label?.text || props?.titleText || props?.text || '';
            const labEn = typeof labelObj === 'object' ? (labelObj.en || labelObj.fr || '') : (labelObj || '');
            const labFr = typeof labelObj === 'object' ? (labelObj.fr || labelObj.en || '') : (labelObj || '');
            out.push({ key, labelEn: labEn, labelFr: labFr, stepName: step.name || `Step ${s.id}` });
          }
        } catch {/* ignore individual step errors */}
      }
      setAvailableFields(out);
    } catch (e) {
      console.warn('Workflow fields load failed:', e.message);
      setAvailableFields([]);
    } finally {
      setFieldsLoading(false);
    }
  };

  // When workflowId changes on summary-list component, (re)load fields
  useEffect(() => {
    if (!isSummaryList) return;
    const workflowId = selectedComponent?.props?.workflowId || null;
    loadWorkflowFields(workflowId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSummaryList, selectedComponent?.props?.workflowId]);

  const summaryListConfig = useMemo(() => {
    if (!isSummaryList) return null;
    const included = Array.isArray(selectedComponent?.props?.included) ? selectedComponent.props.included : [];
    const hideEmpty = selectedComponent?.props?.hideEmpty !== false; // default true
    const emptyFallback = selectedComponent?.props?.emptyFallback || { en: 'Not provided', fr: 'Non fourni' };
    return { included, hideEmpty, emptyFallback };
  }, [isSummaryList, selectedComponent]);

  const updateSummaryListConfig = (patch) => {
    if (!isSummaryList) return;
    const prev = summaryListConfig || { included: [], hideEmpty: true, emptyFallback: { en: 'Not provided', fr: 'Non fourni' } };
    const next = { ...prev, ...patch };
    updateComponentProperty('included', next.included, true);
    updateComponentProperty('hideEmpty', next.hideEmpty, true);
    updateComponentProperty('emptyFallback', next.emptyFallback, true);
  };

  const handleWorkflowSelect = (wfId) => {
    updateComponentProperty('workflowId', wfId, true);
    // Reset included rows when workflow changes
    updateComponentProperty('included', [], true);
  };

  const toggleIncludeField = (fieldKey) => {
    const cur = summaryListConfig?.included || [];
    const idx = cur.findIndex(r => r.key === fieldKey);
    let next;
    if (idx >= 0) next = cur.filter(r => r.key !== fieldKey);
    else {
      const field = availableFields.find(f => f.key === fieldKey);
      next = [...cur, { key: fieldKey, labelOverride: null, stepName: field?.stepName, labelEn: field?.labelEn, labelFr: field?.labelFr }];
    }
    updateSummaryListConfig({ included: next });
  };

  const updateIncludedRow = (fieldKey, patch) => {
    const cur = summaryListConfig?.included || [];
    const next = cur.map(r => r.key === fieldKey ? { ...r, ...patch } : r);
    updateSummaryListConfig({ included: next });
  };

  return (
    <SpaceBetween size="l">
  <ExpandableSection headerText="Intake Step Properties" defaultExpanded>
        <Table
          variant="embedded"
          columnDefinitions={[{
            id: 'property',
            header: 'Property',
            cell: item => item.label,
          }, {
            id: 'value',
            header: 'Value',
            cell: item => item.value,
            editConfig: {
              editingCell: (item, { currentValue, setValue }) => {
                const handleChange = (value) => {
                  setValue(value);
                  if (item.id === 'name') setPageProperties({ name: value, status: pageProperties.status });
                  if (item.id === 'status') setPageProperties({ name: pageProperties.name, status: value });
                };
                if (item.id === 'status') {
                  return (
                    <Select
                      expandToViewport
                      selectedOption={{ label: currentValue, value: currentValue }}
                      onChange={({ detail }) => handleChange(detail.selectedOption.value)}
                      options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                    />
                  );
                }
                return <Input value={currentValue} onChange={({ detail }) => handleChange(detail.value)} />;
              },
            },
          }]}
          items={[{ id: 'name', label: 'Name', value: pageProperties.name }, { id: 'status', label: 'Status', value: pageProperties.status }]}
        />
      </ExpandableSection>

      {selectedComponent && (
        isSummaryList && (
          <ExpandableSection headerText="Summary List" defaultExpanded>
            <Container header={<Header variant="h3">Summary Source</Header>}>
              <SpaceBetween size="m">
                <FormField label="Workflow to summarise" description="Select a saved workflow; fields from its steps become available.">
                  <Select
                    statusType={workflowLoading ? 'loading' : 'finished'}
                    placeholder={workflowLoading ? 'Loading workflows…' : 'Select workflow'}
                    selectedOption={(selectedComponent?.props?.workflowId && workflows.find(w => w.id === selectedComponent.props.workflowId)) ? { label: workflows.find(w => w.id === selectedComponent.props.workflowId)?.name, value: selectedComponent.props.workflowId } : null}
                    onChange={({ detail }) => handleWorkflowSelect(detail.selectedOption.value)}
                    options={workflows.map(w => ({ label: w.name, value: w.id }))}
                    expandToViewport
                  />
                </FormField>
                {selectedComponent?.props?.workflowId && (
                  <>
                    <FormField label="Fields" description="Toggle which fields appear. Order follows workflow for now.">
                      <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginBottom:6 }}>
                        <Button
                          disabled={!availableFields.length || (summaryListConfig?.included||[]).length === availableFields.length}
                          onClick={() => {
                            const all = availableFields.map(f => {
                              const existing = (summaryListConfig?.included || []).find(r => r.key === f.key);
                              return existing || { key: f.key, labelOverride: null, stepName: f.stepName, labelEn: f.labelEn, labelFr: f.labelFr };
                            });
                            updateSummaryListConfig({ included: all });
                          }}
                        >Select all</Button>
                        <Button
                          disabled={!(summaryListConfig?.included||[]).length}
                          onClick={() => updateSummaryListConfig({ included: [] })}
                        >Clear all</Button>
                      </div>
                      <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #d5dbdb', padding: 8, borderRadius: 4 }}>
                        {fieldsLoading && <div className="govuk-hint">Loading fields…</div>}
                        {!fieldsLoading && availableFields.length === 0 && <div className="govuk-hint">No fields found in workflow.</div>}
                        {!fieldsLoading && availableFields.map(f => {
                          const included = (summaryListConfig?.included || []).some(r => r.key === f.key);
                          return (
                            <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                              <Checkbox checked={included} onChange={() => toggleIncludeField(f.key)} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>{f.labelEn || f.key} <span style={{ color: '#666', fontWeight: 400 }}>({f.key})</span></div>
                                <div style={{ fontSize: 11, color: '#666' }}>{f.stepName}</div>
                              </div>
                              {/* Format selector removed: all values rendered as plain strings; date formatting decided at runtime */}
                            </div>
                          );
                        })}
                      </div>
                    </FormField>
                    <FormField label="Hide empty answers">
                      <Toggle checked={summaryListConfig?.hideEmpty !== false} onChange={({ detail }) => updateSummaryListConfig({ hideEmpty: detail.checked })}>Hide empty</Toggle>
                    </FormField>
                    {summaryListConfig?.hideEmpty === false && (
                      <FormField label="Empty fallback (EN)">
                        <Input value={summaryListConfig?.emptyFallback?.en || ''} onChange={({ detail }) => updateSummaryListConfig({ emptyFallback: { ...(summaryListConfig?.emptyFallback || {}), en: detail.value } })} />
                      </FormField>
                    )}
                    {summaryListConfig?.hideEmpty === false && (
                      <FormField label="Texte de remplacement (FR)">
                        <Input value={summaryListConfig?.emptyFallback?.fr || ''} onChange={({ detail }) => updateSummaryListConfig({ emptyFallback: { ...(summaryListConfig?.emptyFallback || {}), fr: detail.value } })} />
                      </FormField>
                    )}
                    {(summaryListConfig?.included || []).length === 0 && <Badge color="red">Select at least one field</Badge>}
                  </>
                )}
                {!selectedComponent?.props?.workflowId && (
                  <Box variant="div" color="text-body-secondary">Select a workflow to populate this summary list. Placeholder rows show until then.</Box>
                )}
              </SpaceBetween>
            </Container>
          </ExpandableSection>
        )
      )}
      {selectedComponent && (
        <>
          <ExpandableSection headerText="Component Properties" defaultExpanded>
            {/* Version badge & upgrade controls removed until versioning UX is implemented */}
            <Table
              variant="embedded"
              columnDefinitions={[
                {
                  id: 'label',
                  header: 'Property',
                  cell: item => {
                    const desc = hintFor(item.path, item.label);
                    if (!desc) return item.label;
                    return (
                      <Popover triggerType="hover" size="small" position="top" content={desc}>
                        <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>{item.label}</span>
                      </Popover>
                    );
                  },
                },
                {
                  id: 'value',
                  header: 'Value',
                  minWidth: 100,
                  maxWidth: 200,
                  cell: item => {
                    const v = item.value;
                    const err = validationErrors[item.path];
                    let display;
                    if (typeof v === 'boolean') display = v ? 'True' : 'False';
                    else if (isI18nObject(v)) {
                      display = v[currentLang] ?? v.en ?? v.fr ?? '';
                    } else if (typeof v === 'object') display = JSON.stringify(v);
                    else display = v;
                    return (
                      <SpaceBetween direction="horizontal" size="xs">
                        <span>{display}</span>
                        {err && <Badge color="red">{err}</Badge>}
                      </SpaceBetween>
                    );
                  },
                  editConfig: {
                    editingCell: (item, { currentValue, setValue }) => {
                      const original = get(selectedComponent?.props, item.path);
                      const isI18n = isI18nObject(original) || isTranslatablePath(item.path);
                      const handleChange = (value) => {
                        if (isI18n) {
                          const base = isI18nObject(original) ? { ...original } : { [currentLang]: (typeof original === 'string' ? original : '') };
                          base[currentLang] = value;
                          setValue(value);
                          updateComponentProperty(item.path, base, true);
                          const next = JSON.parse(JSON.stringify(selectedComponent?.props || {}));
                          const parts = item.path.split('.');
                          let tgt = next; for (let i=0;i<parts.length-1;i++){ if(!tgt[parts[i]]) tgt[parts[i]]={}; tgt=tgt[parts[i]]; }
                          tgt[parts[parts.length-1]] = base;
                          validateProps(next);
                        } else {
                          setValue(value);
                          updateComponentProperty(item.path, value, true);
                          const next = JSON.parse(JSON.stringify(selectedComponent?.props || {}));
                          const parts = item.path.split('.');
                          let tgt = next; for (let i=0;i<parts.length-1;i++){ if(!tgt[parts[i]]) tgt[parts[i]]={}; tgt=tgt[parts[i]]; }
                          tgt[parts[parts.length-1]] = value;
                          validateProps(next);
                        }
                      };

                      const path = item.path || '';
                      const val = (currentValue !== undefined ? currentValue : item.value);
                      if (isPath(path, 'label.classes')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={LABEL_CLASS_SUGGESTIONS} placeholder="Label class" />
                        );
                      }
                      if (isPath(path, 'fieldset.legend.classes')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={FIELDSET_LEGEND_CLASS_SUGGESTIONS} placeholder="Legend class" />
                        );
                      }
                      if (isPath(path, 'classes', 'class')) {
                        // Determine component type for tailored suggestions
                        const compType = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
                        // Prefer template-defined options first
                        let optionValues = [];
                        if (Array.isArray(item.options) && item.options.length) {
                          optionValues = item.options.map(o => (o.value ?? o.label ?? ''));
                        } else {
                          optionValues = GENERIC_CLASS_SUGGESTIONS;
                        }
                        // Augment for text/paragraph style components
                        const texty = ['paragraph','text-block','textblock','inset-text','warning-text'];
                        if (texty.includes(compType)) {
                          const extra = ['govuk-body','govuk-body-l','govuk-hint'];
                          for (const e of extra) if (!optionValues.includes(e)) optionValues.push(e);
                        }
                        // Guarantee govuk-hint is present per requirement
                        if (!optionValues.includes('govuk-hint')) optionValues.push('govuk-hint');
                        // Ensure current value present so not forced into custom prematurely
                        if (typeof val === 'string' && val && !optionValues.includes(val)) {
                          optionValues = [val, ...optionValues];
                        }
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={optionValues} placeholder="CSS class" />
                        );
                      }
                      if (endsWithPath(path, '.classes')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={GENERIC_CLASS_SUGGESTIONS} placeholder="CSS classes" />
                        );
                      }
                      if (isPath(path, 'autocomplete')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={AUTOCOMPLETE_SUGGESTIONS} placeholder="Autocomplete" />
                        );
                      }
                      if (isPath(path, 'inputmode', 'inputMode')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={INPUTMODE_SUGGESTIONS} placeholder="Input mode" />
                        );
                      }
                      if (isPath(path, 'type', 'props.type')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={INPUT_TYPE_SUGGESTIONS} placeholder="Input type" />
                        );
                      }
                      if (isPath(path, 'pattern')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={PATTERN_SUGGESTIONS} placeholder="Pattern (regex)" />
                        );
                      }
                      switch (item.type) {
                        case 'textarea': {
                          const val = isI18n ? (original?.[currentLang] ?? original?.en ?? original?.fr ?? '') : (currentValue || item.value);
                          return <Textarea value={val} onChange={({ detail }) => handleChange(detail.value)} rows={4} />;
                        }
                        case 'text': {
                          const val = isI18n ? (original?.[currentLang] ?? original?.en ?? original?.fr ?? '') : (currentValue || item.value);
                          return <Input value={val} onChange={({ detail }) => handleChange(detail.value)} />;
                        }
                        case 'checkbox':
                        case 'boolean': {
                          const selectedBool = currentValue ?? item.value;
                          return (
                            <Select
                              expandToViewport
                              selectedOption={{ label: selectedBool ? 'True' : 'False', value: selectedBool }}
                              onChange={({ detail }) => handleChange(detail.selectedOption.value)}
                              options={[{ label: 'True', value: true }, { label: 'False', value: false }]}
                            />
                          );
                        }
                        case 'select':
                        case 'enum': {
                          // Normalise boolean option values to strings for Cloudscape Select (which matches by reference/value string)
                          const rawOptions = Array.isArray(item.options) ? item.options : [];
                          const optList = rawOptions.map(o => {
                            if (typeof o.value === 'boolean') {
                              return { ...o, value: o.value ? 'true' : 'false', __bool: true };
                            }
                            return o;
                          });
                          const rawVal = (currentValue !== undefined ? currentValue : item.value);
                          const normVal = typeof rawVal === 'boolean' ? (rawVal ? 'true' : 'false') : (rawVal ?? '');
                          const selectedOption = optList.find(o => o.value === normVal) || (normVal !== '' ? { label: String(normVal), value: normVal } : null);
                          return (
                            <Select
                              expandToViewport
                              selectedOption={selectedOption}
                              onChange={({ detail }) => {
                                const sel = detail.selectedOption;
                                if (sel && sel.__bool) {
                                  handleChange(sel.value === 'true');
                                } else if (typeof rawVal === 'boolean' && (sel?.value === 'true' || sel?.value === 'false')) {
                                  handleChange(sel.value === 'true');
                                } else {
                                  handleChange(sel ? sel.value : '');
                                }
                              }}
                              options={optList}
                            />
                          );
                        }
                        case 'number': {
                          const val = isI18n ? (original?.[currentLang] ?? original?.en ?? original?.fr ?? '') : (currentValue ?? item.value);
                          return <Input type="number" value={val} onChange={({ detail }) => {
                            const parsed = detail.value === '' ? '' : Number(detail.value);
                            handleChange(parsed);
                          }} />;
                        }
                        case 'attributes': {
                          const rows = Array.isArray(currentValue || item.value) ? (currentValue || item.value) : [];
                          return (
                            <div style={{ minWidth: 260 }}>
                              {(rows.length === 0) && <div className="govuk-hint">No attributes</div>}
                              {rows.map((r, idx) => (
                                <SpaceBetween key={idx} size="xs" direction="horizontal">
                                  <Input placeholder="attribute" value={r.attribute || ''} onChange={({ detail }) => {
                                    const next = rows.map((x,i)=> i===idx ? { ...x, attribute: detail.value } : x);
                                    handleChange(next);
                                  }} />
                                  <Input placeholder="value" value={r.value || ''} onChange={({ detail }) => {
                                    const next = rows.map((x,i)=> i===idx ? { ...x, value: detail.value } : x);
                                    handleChange(next);
                                  }} />
                                  <Button iconName="close" variant="icon" onClick={() => handleChange(rows.filter((_,i)=>i!==idx))} />
                                </SpaceBetween>
                              ))}
                              <div style={{ marginTop: 6 }}>
                                <Button onClick={() => handleChange([...(rows||[]), { attribute: '', value: '' }])} iconName="add-plus" variant="icon">Add</Button>
                              </div>
                            </div>
                          );
                        }
                        default:
                          return null;
                      }
                    },
                  }
                }
              ]}
                items={(() => {
                  const priority = [
                    'id',
                    'name',
                    'label.text', 'label.classes',
                    'fieldset.legend.text','fieldset.legend.classes',
                    'hint.text',
                    // File upload ordering adjustments
                    'maxSizeMb','showMaxSize','accept','showMimeList',
                    'value',
                    'rows','maxlength','threshold','maxwords',
                    'type','autocomplete','inputmode','pattern','spellcheck',
                    'classes','formGroup.classes',
                    'prefix.text','suffix.text'
                  ];
                  const indexOfPath = (p) => {
                    const i = priority.indexOf(p);
                    return i === -1 ? 999 + p.length : i; // stable fallback
                  };
                  return (selectedComponent.editable_fields || [])
                    .filter(field => field.type !== 'optionList')
                    .filter(field => {
                      const isCharCount = (selectedComponent.template_key || selectedComponent.type) === 'character-count';
                      if (isCharCount && (field.path === 'errorMessage.text' || field.key === 'errorMessage.text')) return false;
                      // Prefix / suffix only apply to text input components; suppress for others
                      const tKey = String(selectedComponent.template_key || selectedComponent.type || '').toLowerCase();
                      const isInputLike = tKey === 'input' || tKey === 'text' || tKey === 'email' || tKey === 'number' || tKey === 'password' || tKey === 'phone';
                      if (!isInputLike && (field.path?.startsWith('prefix.') || field.path?.startsWith('suffix.'))) return false;
                      return true;
                    })
                    .map(field => ({
                      label: field.label,
                      value: get(selectedComponent.props, field.path),
                      type: field.type === 'string' ? 'text' : (field.type === 'enum' ? 'select' : field.type),
                      options: (field.options || []).map(o => typeof o === 'string' ? { label: o, value: o } : o),
                      path: field.path,
                      _order: indexOfPath(field.path)
                    }))
                    .sort((a,b) => a._order === b._order ? a.label.localeCompare(b.label) : a._order - b._order)
                    .map(({ _order, ...rest }) => rest);
                })()}
                submitEdit={() => { }}
                ariaLabels={{ tableLabel: 'Component Properties Table' }}
              />
      </ExpandableSection>

            {Boolean(selectedComponent?.has_options) && selectedComponent.editable_fields?.map((field) => {
              if (field.type !== 'optionList') return null;
              const options = get(selectedComponent.props, field.path) || [];
              const schema = getSchema();
              return (
                <React.Fragment key={field.path}>
                  <ExpandableSection headerText="Options Properties" defaultExpanded>
                    <Container padding="m" variant="stacked">
                    <SpaceBetween size="m">
                      <FormField label="Options Source">
                        <Select
                          expandToViewport
                          selectedOption={{
                            label: currentMode === 'dynamic' ? 'Code Table: Dynamic' : (currentMode === 'snapshot' ? 'Code Table: Snapshot' : 'Static (manually entered)'),
                            value: currentMode,
                          }}
                          onChange={({ detail }) => handleOptionModeChange(detail.selectedOption.value, field)}
                          options={[
                            { label: 'Static (manually entered)', value: 'static' },
                            { label: 'Dynamic (from endpoint at runtime', value: 'dynamic' },
                            { label: 'Snapshot (fill static from endpoint now)', value: 'snapshot' },
                          ]}
                        />
                      </FormField>

                      {(currentMode === 'dynamic' || currentMode === 'snapshot') && (
                        <>
                          {currentMode === 'dynamic' && (
                            <FormField label="Select Data Source (Dynamic)">
                              <Select
                                expandToViewport
                                selectedOption={selectedEndpoint ? { label: availableDataSources.find(ds => ds.endpoint === selectedEndpoint)?.label || '', value: selectedEndpoint } : null}
                                onChange={({ detail }) => handleEndpointChange(detail.selectedOption.value, field)}
                                options={[{ label: 'Select a data source...', value: null }, ...availableDataSources.map(ds => ({ label: ds.label, value: ds.endpoint }))]}
                                placeholder="Select a data source..."
                              />
                            </FormField>
                          )}
                          {currentMode === 'snapshot' && (
                            <FormField label="Select Data Source (Snapshot)">
                              <Select
                                expandToViewport
                                selectedOption={null}
                                onChange={({ detail }) => handleSnapshotFetch(detail.selectedOption.value, field)}
                                options={availableDataSources.map(ds => ({ label: ds.label, value: ds.endpoint }))}
                              />
                            </FormField>
                          )}
                        </>
                      )}

                      {currentMode === 'static' && (
                        <>
                          <Modal
                            visible={showAiOptionsModal}
                            onDismiss={() => setShowAiOptionsModal(false)}
                            header="AI Generate Options"
                            size="large"
                            footer={<SpaceBetween size="xs" direction="horizontal">{aiPreview && <Button onClick={discardAiPreview}>Reset</Button>}<Button onClick={() => { setShowAiOptionsModal(false); }}>Close</Button>{aiPreview && <Button variant="primary" onClick={applyAiPreview}>Apply</Button>}<Button variant="primary" iconName="refresh" loading={aiGenerating} disabled={aiGenerating || !aiPrompt.trim()} onClick={() => generateOptionsWithAI(field)}>{aiPreview? 'Regenerate' : 'Generate'}</Button></SpaceBetween>}
                          >
                            <SpaceBetween size="m">
                              <FormField label="Describe the option list" constraintText="E.g. 'Yes No', 'Canadian Provinces and Territories', '1 to 5 satisfaction scale'">
                                <Input
                                  placeholder="Enter description..."
                                  value={aiPrompt}
                                  onChange={({ detail }) => setAiPrompt(detail.value)}
                                  disabled={aiGenerating}
                                />
                              </FormField>
                              {aiStatus && (
                                <Alert type={aiStatus.type === 'error' ? 'error' : (aiStatus.type === 'success' ? 'success' : 'info')}>{aiStatus.text}</Alert>
                              )}
                              {aiPreview && (
                                <Container header={<Header variant="h3">Preview Options ({aiPreview.options.length})</Header>}>
                                  <Table
                                    variant="embedded"
                                    columnDefinitions={getSchema().map(k => ({ id: k, header: k.toUpperCase(), cell: item => String(item[k] ?? '') }))}
                                    items={aiPreview.options}
                                    ariaLabels={{ tableLabel: 'AI generated options preview' }}
                                    header={<Header variant="h4">Generated List</Header>}
                                  />
                                </Container>
                              )}
                            </SpaceBetween>
                          </Modal>
                          {(() => {
                            const vals = options.map(o => String(o?.value ?? '')).filter(v => v !== '');
                            const dups = new Set(vals.filter((v, i) => vals.indexOf(v) !== i));
                            const empties = options.filter(o => !String(o?.text ?? '').trim());
                            if (dups.size === 0 && empties.length === 0) return null;
                            return (
                              <Box padding="s">
                                {dups.size > 0 && <Badge color="red">Duplicate values: {Array.from(dups).join(', ')}</Badge>}
                                {dups.size > 0 && empties.length > 0 && ' '}
                                {empties.length > 0 && <Badge color="red">{empties.length} option(s) missing label</Badge>}
                              </Box>
                            );
                          })()}
                          <Table
                            variant="embedded"
                            columnDefinitions={[
                              ...schema.map(key => {
                                const isHint = key === 'hint';
                                return {
                                  id: key,
                                  header: key,
                                  minWidth: isHint ? 260 : 120,
                                  maxWidth: isHint ? 480 : undefined,
                                  cell: item => {
                                    const val = asLangString(item[key], 'en');
                                    if (isHint) {
                                      // Show full hint but allow wrapping
                                      return <span style={{ whiteSpace: 'normal', display: 'block' }}>{val}</span>;
                                    }
                                    return val;
                                  },
                                  editConfig: {
                                    editingCell: (item, { currentValue, setValue }) => {
                                      const baseVal = currentValue ?? asLangString(item[key], 'en');
                                      const handleCommit = (newVal) => {
                                        setValue(newVal);
                                        const updated = [...options];
                                        const idx = options.indexOf(item);
                                        const prev = updated[idx]?.[key];
                                        if (key === 'text' && prev && typeof prev === 'object' && (Object.prototype.hasOwnProperty.call(prev,'en') || Object.prototype.hasOwnProperty.call(prev,'fr'))) {
                                          updated[idx][key] = { en: newVal, fr: prev.fr ?? '' };
                                        } else {
                                          updated[idx][key] = newVal;
                                        }
                                        updateComponentProperty(field.path, updated, true);
                                      };
                                      if (isHint) {
                                        return (
                                          <Textarea
                                            rows={2}
                                            value={baseVal}
                                            onChange={({ detail }) => handleCommit(detail.value)}
                                            placeholder="Hint (optional)"
                                            style={{ width: '100%' }}
                                          />
                                        );
                                      }
                                      return (
                                        <Input
                                          value={baseVal}
                                          onChange={({ detail }) => handleCommit(detail.value)}
                                          style={{ width: '100%' }}
                                        />
                                      );
                                    }
                                  }
                                };
                              }),
                               { id: 'actions', header: 'Actions', cell: item => (<Button iconName="close" variant="icon" onClick={() => handleRemoveOption(options.indexOf(item), field)} />) },
                            ]}
                            items={options}
                            header={<Header variant="h3" actions={<SpaceBetween size="xs" direction="horizontal"><div role="button" tabIndex={0} aria-label="Generate options with AI" onClick={() => setShowAiOptionsModal(true)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); setShowAiOptionsModal(true);} }} style={{ cursor:'pointer' }}><Avatar ariaLabel="AI option generator" color="gen-ai" iconName="gen-ai" tooltipText="Generate options with AI" /></div><Button iconName="add-plus" variant="icon" ariaLabel="Add option" onClick={() => handleAddOption(field)} /></SpaceBetween>} />}
                          />
                          {(() => {
                            const tKey = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
                            if (!['radio','radios','checkbox','checkboxes'].includes(tKey)) return null;
                            return (
                              <ChoiceConditionalScaffold
                                options={options}
                                fieldPath={field.path}
                                updateComponentProperty={updateComponentProperty}
                                asLangString={asLangString}
                                pageComponents={allComponents || []}
                                setPageProperties={setPageProperties}
                                selectedComponent={selectedComponent}
                                addExternalComponent={addExternalComponent}
                                availableTemplates={availableTemplates}
                              />
                            );
                          })()}
                        {/* Validation block relocated below (after options UI) */}
                      </>
                    )}
                    </SpaceBetween>
                    </Container>
                  </ExpandableSection>
                </React.Fragment>
              );
            })}
          {/* Validation section moved outside PropertiesPanel (below Translations) */}
        </>
      )}
    </SpaceBetween>
  );
};

export { ValidationEditor };
export default PropertiesPanel;

// --- Radio Conditional Linking Scaffold (Option C) ---
const ChoiceConditionalScaffold = ({ options, fieldPath, updateComponentProperty, asLangString, pageComponents, setPageProperties, selectedComponent, addExternalComponent, availableTemplates = [] }) => {
  const [selectedOptionIdx, setSelectedOptionIdx] = React.useState(-1);
  const [mode, setMode] = React.useState('choose'); // choose | attach-existing | create-new
  const [newType, setNewType] = React.useState('input');
  const [newLabel, setNewLabel] = React.useState('');
  const optionList = Array.isArray(options) ? options : [];
  // Allowable linked child component types (broad but exclude radios to prevent nesting groups for now)
  const followTypes = ['input','text','textarea','select','checkbox','date-input','date','file-upload','details','panel','text-block','character-count','email','number','phone','password','paragraph','inset-text','warning-text'];

  const updateOptionArray = (mutator) => {
    const next = optionList.map(o => ({ ...o }));
    mutator(next);
    updateComponentProperty(fieldPath, next, true);
  };

  const selectedOpt = selectedOptionIdx >=0 ? optionList[selectedOptionIdx] : null;
  const linkedChildId = selectedOpt?.conditionalChildId || null;
  const linkedChild = linkedChildId ? pageComponents.find(c => {
    if (!c) return false;
    const keys = [c.id, c.props?.name, c.templateId, c.template_id].filter(Boolean);
    return keys.includes(linkedChildId);
  }) : null;

  const extractLabel = (comp) => {
    if (!comp) return '';
    const raw = comp.props?.label?.text || comp.props?.fieldset?.legend?.text || comp.props?.titleText || comp.props?.text;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') {
      // i18n or macro object
      const en = raw.en || raw.EN || raw.En;
      const fr = raw.fr || raw.FR || raw.Fr;
      if (typeof en === 'string' && en.trim()) return en;
      if (typeof fr === 'string' && fr.trim()) return fr;
      // Any string value inside object
      for (const v of Object.values(raw)) {
        if (typeof v === 'string' && v.trim()) return v;
      }
    }
    return comp.id || comp.props?.name || '';
  };

  const referencedIds = new Set();
  optionList.forEach(o => { if (o && o.conditionalChildId) referencedIds.add(o.conditionalChildId); });

  const allComponents = Array.isArray(pageComponents) ? pageComponents : [];
  const candidateExisting = allComponents.filter(c => {
    if (!c) return false;
    const keys = [c.id, c.props?.name].filter(Boolean);
    if (!keys.length) return false;
    const parentKeys = [selectedComponent?.id, selectedComponent?.props?.name].filter(Boolean);
    if (keys.some(k => parentKeys.includes(k))) return false;
    const t = String(c.type || c.template_key || '').toLowerCase();
    if (t === 'radio' || t === 'radios') return false;
    // If any of the component's keys already referenced by some other option (and not the currently selected link), exclude
    if (keys.some(k => referencedIds.has(k)) && !keys.includes(linkedChildId)) return false;
    if (!followTypes.includes(t)) return false;
    return true;
  });

  const linkExisting = (childId) => {
    if (selectedOptionIdx < 0) return;
    updateOptionArray(next => { next[selectedOptionIdx] = { ...next[selectedOptionIdx], conditionalChildId: childId }; });
    setMode('choose');
  };

  const unlink = () => {
    if (selectedOptionIdx < 0) return;
    updateOptionArray(next => { const it = { ...next[selectedOptionIdx] }; delete it.conditionalChildId; next[selectedOptionIdx] = it; });
  };

  const createAndLink = () => {
    if (selectedOptionIdx < 0) return;
    const parentKey = selectedComponent?.id || selectedComponent?.props?.name || 'radio';
    const baseId = `${parentKey}_${optionList[selectedOptionIdx]?.value || 'opt'+selectedOptionIdx}_follow`.replace(/[^a-zA-Z0-9_-]/g,'_');
    let newId = baseId; let i=1;
    while (pageComponents.some(c => (c.id || c.props?.name) === newId)) { newId = baseId + '_' + (++i); }
    const tpl = availableTemplates.find(t => (t.template_key === newType) || (t.type === newType));
    const baseProps = JSON.parse(JSON.stringify(tpl?.props || {}));
    baseProps.name = newId;
    if (!baseProps.id) baseProps.id = newId;
    // Normalise label / legend text overrides
    const labelText = newLabel || baseProps?.label?.text || 'Follow-up';
    if (!baseProps.label) baseProps.label = { text: labelText };
    else if (typeof baseProps.label === 'object') {
      if (typeof baseProps.label.text === 'object') {
        baseProps.label.text.en = labelText;
      } else baseProps.label.text = labelText;
    }
    if (!baseProps.fieldset) baseProps.fieldset = { legend: { text: labelText, isPageHeading: false, classes: '' } };
    if (!baseProps.fieldset.legend) baseProps.fieldset.legend = { text: labelText, isPageHeading: false, classes: '' };
    else if (!baseProps.fieldset.legend.text) baseProps.fieldset.legend.text = labelText;
    const newComp = {
      id: undefined,
      templateId: tpl?.id,
      template_key: tpl?.template_key || newType,
      type: tpl?.type || newType,
      version: tpl?.version || 1,
      label: tpl?.label || labelText,
      props: baseProps,
      editable_fields: tpl?.editable_fields || [],
      has_options: !!tpl?.has_options,
      option_schema: tpl?.option_schema || null
    };
    if (typeof addExternalComponent === 'function') addExternalComponent(newComp);
    updateOptionArray(next => { next[selectedOptionIdx] = { ...next[selectedOptionIdx], conditionalChildId: newComp.props.name }; });
    setNewLabel('');
    setMode('choose');
  };

  const parentType = String(selectedComponent?.template_key || selectedComponent?.type || '').toLowerCase();
  const heading = parentType.includes('checkbox') ? 'Conditional Follow-up (linked - checkbox)' : 'Conditional Follow-up (linked)';
  return (
    <Box margin={{ top: 's' }}>
      <Header variant="h4">{heading}</Header>
      <Box fontSize="body-s" color="text-body-secondary" margin={{ bottom: 's' }}>
        Link an existing component or create a new one that only appears when its option is selected. Linked child is removed from top-level preview automatically.
      </Box>
      <SpaceBetween size="s">
        <FormField label="Target option">
          <Select
            expandToViewport
            selectedOption={selectedOptionIdx >=0 ? { label: `${asLangString(optionList[selectedOptionIdx]?.text,'en') || '(untitled)'} (${optionList[selectedOptionIdx]?.value})`, value: String(selectedOptionIdx) } : null}
            onChange={({ detail }) => { setSelectedOptionIdx(Number(detail.selectedOption.value)); setMode('choose'); }}
            placeholder="Choose option"
            options={optionList.map((o,i)=> ({ label: `${asLangString(o.text,'en') || '(untitled)'} (${o.value||i})`, value: String(i) }))}
          />
        </FormField>
        {selectedOptionIdx === -1 && <Box fontSize="body-s" color="text-body-secondary">Select an option to manage its follow-up.</Box>}
        {selectedOptionIdx >=0 && (
          <Container variant="stacked" header={<Header variant="h5">Follow-up for option {asLangString(optionList[selectedOptionIdx]?.text,'en') || '(untitled)'} </Header>}>
            <SpaceBetween size="s">
              {!linkedChild && <Box fontSize="body-s" color="text-body-secondary">No follow-up linked.</Box>}
              {linkedChild && (
                <Box>
                  <strong>{extractLabel(linkedChild)}</strong>
                  <div style={{ fontSize:11, color:'#555' }}>{linkedChild.type}</div>
                  <SpaceBetween direction="horizontal" size="xs" style={{ marginTop:4 }}>
                    <Button onClick={unlink} iconName="close">Unlink</Button>
                  </SpaceBetween>
                </Box>
              )}
              {mode === 'choose' && (
                <SpaceBetween size="xs">
                  <Button onClick={()=>setMode('attach-existing')} disabled={candidateExisting.length===0}>Attach existing</Button>
                  <Button onClick={()=>setMode('create-new')} iconName="add-plus">Create new</Button>
                </SpaceBetween>
              )}
              {mode === 'attach-existing' && (
                <SpaceBetween size="s">
                  <FormField label="Existing components">
                    <Select
                      expandToViewport
                      placeholder={candidateExisting.length? 'Select component' : 'None available'}
                      onChange={({ detail }) => linkExisting(detail.selectedOption.value)}
                      options={candidateExisting.map(c => {
                        const key = c.id || c.props?.name;
                        return { label: `${extractLabel(c)} (${c.type})`, value: key };
                      })}
                    />
                  </FormField>
                  <Button onClick={()=>setMode('choose')}>Cancel</Button>
                </SpaceBetween>
              )}
              {mode === 'create-new' && (
                <SpaceBetween size="s">
                  <FormField label="Component type">
                    <Select
                      expandToViewport
                      selectedOption={{ label: newType, value: newType }}
                      onChange={({ detail }) => setNewType(detail.selectedOption.value)}
                      options={followTypes.map(t => ({ label: t, value: t }))}
                    />
                  </FormField>
                  <FormField label="Label (legend/text)">
                    <Input value={newLabel} onChange={({ detail }) => setNewLabel(detail.value)} placeholder="e.g. Email address" />
                  </FormField>
                  <SpaceBetween direction="horizontal" size="xs">
                    <Button variant="primary" disabled={!newType} onClick={createAndLink}>Create & Link</Button>
                    <Button onClick={()=> { setMode('choose'); setNewLabel(''); }}>Cancel</Button>
                  </SpaceBetween>
                </SpaceBetween>
              )}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </Box>
  );
};

// --- Unified Validation Editor vNext ---
const ValidationEditor = ({ selectedComponent, updateComponentProperty, allComponents = [] }) => {
  const misNested = selectedComponent?.props?.props?.validation;
  const topLevel = selectedComponent?.props?.validation;
  const rawValidation = topLevel || misNested || {};

  // AI validation generation state
  const [showValAiModal, setShowValAiModal] = React.useState(false);
  const [valAiPrompt, setValAiPrompt] = React.useState('');
  const [valAiGenerating, setValAiGenerating] = React.useState(false);
  const [valAiStatus, setValAiStatus] = React.useState(null); // { type, text }
  const [valAiPreview, setValAiPreview] = React.useState(null); // preview validation object

  // Migration to unified schema
  const migrate = React.useCallback((v) => {
    const next = { ...v };
    // normalize requiredMessage vs errorMessage
    if (next.errorMessage && !next.requiredMessage && next.required) {
      next.requiredMessage = next.errorMessage;
    }
    // collect rules
    let rules = Array.isArray(next.rules) ? [...next.rules] : [];
    rules = rules.map(r => ({
      id: r.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type: r.type || r.kind || 'predicate',
      trigger: Array.isArray(r.trigger) && r.trigger.length ? r.trigger : ['submit'],
      severity: r.severity || 'error',
      block: typeof r.block === 'boolean' ? r.block : (r.severity !== 'warn'),
      message: r.message || { en: '', fr: '' },
      when: r.when,
      keys: r.keys,
      min: r.min,
      max: r.max,
      pattern: r.pattern,
      minLength: r.minLength,
      maxLength: r.maxLength,
      compare: r.compare
    }));
    // promote legacy pattern/minLength on component root
    if (next.pattern && !rules.some(r => r.type === 'pattern' && r.pattern === next.pattern)) {
      rules.push({ id: `rule-${Date.now()}-pat`, type: 'pattern', trigger:['submit'], severity:'error', block:true, message:{ en:'Invalid format', fr:'Format invalide' }, pattern: next.pattern });
      delete next.pattern;
    }
    if (next.minLength && !rules.some(r => r.type==='length' && r.minLength===next.minLength)) {
      rules.push({ id: `rule-${Date.now()}-len`, type:'length', trigger:['submit'], severity:'error', block:true, message:{ en:`Minimum length is ${next.minLength}`, fr:`Longueur minimale ${next.minLength}` }, minLength: next.minLength });
      delete next.minLength;
    }
    next.rules = rules;
    return next;
  }, []);

  React.useEffect(() => {
    if (!topLevel && misNested) {
      updateComponentProperty('validation', misNested, true);
    }
    // Apply migration once (idempotent)
    if (rawValidation && Object.keys(rawValidation).length) {
      const migrated = migrate(rawValidation);
      updateComponentProperty('validation', migrated, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validation = migrate(rawValidation);
  const rules = validation.rules || [];

  const commit = (next) => updateComponentProperty('validation', migrate(next), true);

  const updateRoot = (patch) => commit({ ...validation, ...patch });

  const updateRule = (id, mutator) => {
    const nextRules = rules.map(r => r.id === id ? mutator({ ...r }) : r);
    commit({ ...validation, rules: nextRules });
  };

  const addRule = (type='predicate') => {
    const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
    const base = {
      id,
      type,
      trigger:['submit'],
      severity:'error',
      block:true,
      message:{ en:'', fr:'' }
    };
    if (type==='predicate') base.when = { '==':[ { var: selectedComponent?.props?.name || 'field' }, '' ] };
    if (type==='atLeastOne') base.keys = [];
    if (type==='range') { base.min = 0; base.max = 1; }
    if (type==='length') { base.minLength = 1; }
    if (type==='pattern') { base.pattern = '^.+$'; }
    if (type==='compare') { base.compare = { left: selectedComponent?.props?.name || 'field', op: '==', right: '' }; }
    commit({ ...validation, rules:[...rules, base] });
  };

  const removeRule = (id) => commit({ ...validation, rules: rules.filter(r => r.id !== id) });

  // Field picker for multi-field rules
  const fieldOptions = allComponents.map(c => {
    const key = c?.props?.name || c?.props?.id || c?.id;
    if (!key) return null; return { label: key, value: key };
  }).filter(Boolean);

  const generateValidationWithAI = async () => {
    setValAiStatus(null);
    setValAiPreview(null);
    const prompt = (valAiPrompt || '').trim();
    if (!prompt) { setValAiStatus({ type: 'error', text: 'Enter a description first.' }); return; }
    setValAiGenerating(true);
    try {
      const { apiFetch } = require('../auth/apiClient');
      const system = { role: 'system', content: 'You generate validation schemas for form components. Output ONLY JSON matching { "validation": { required?: boolean, requiredMessage?: { en:string, fr?:string }, rules?: [ { id?:string, type: "predicate"|"atLeastOne"|"range"|"length"|"pattern"|"compare", trigger?: ["submit"|"change"], severity?: "error"|"warn", block?: boolean, message?: { en:string, fr?:string }, when?: object, min?:number, max?:number, minLength?:number, maxLength?:number, pattern?:string, keys?:string[], compare?: { left:any, op:string, right:any } } ] } } . Use both EN and FR messages if possible (FR may be empty). Keep triggers minimal (submit unless real-time needed). Ensure each rule has stable id (generate if missing).'};
      const user = { role: 'user', content: JSON.stringify({ component: { name: selectedComponent?.props?.name, type: selectedComponent?.type, existingValidation: rawValidation }, description: prompt }) };
      const res = await apiFetch('/api/ai/chat', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ messages:[system,user] }) });
      if (res.status === 501) { setValAiStatus({ type:'error', text:'AI service disabled on server.' }); return; }
      const data = await res.json().catch(()=>({}));
      const raw = data?.choices?.[0]?.message?.content || '';
      const parsed = (()=>{ try { return JSON.parse(raw); } catch(_) { const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch(_2) {} } return null; } })();
      const vObj = parsed?.validation || parsed || null;
      if (!vObj || typeof vObj !== 'object') { setValAiStatus({ type:'error', text:'No validation object returned.' }); return; }
      // Basic normalization (ids, triggers, severity)
      const norm = { ...vObj };
      if (!Array.isArray(norm.rules)) norm.rules = [];
      norm.rules = norm.rules.map(r => ({
        id: r.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
        type: r.type || 'predicate',
        trigger: Array.isArray(r.trigger) && r.trigger.length ? r.trigger : ['submit'],
        severity: r.severity === 'warn' ? 'warn' : 'error',
        block: r.block === undefined ? (r.severity !== 'warn') : !!r.block,
        message: ( ()=> { if (!r.message) return { en:'', fr:'' }; if (typeof r.message === 'string') return { en:r.message, fr:'' }; if (typeof r.message === 'object') return { en: r.message.en || r.message.EN || r.message.Fr || r.message.fr || r.message.en || '', fr: r.message.fr || r.message.FR || '' }; return { en:'', fr:'' }; })(),
        when: r.when,
        keys: r.keys,
        min: r.min,
        max: r.max,
        minLength: r.minLength,
        maxLength: r.maxLength,
        pattern: r.pattern,
        compare: r.compare
      }));
      setValAiPreview(norm);
      setValAiStatus({ type:'success', text:`Preview generated with ${norm.rules.length} rule(s). Review and apply.` });
    } catch(e) {
      setValAiStatus({ type:'error', text:`Generation failed: ${e.message || String(e)}` });
    } finally {
      setValAiGenerating(false);
    }
  };

  const applyValidationPreview = () => {
    if (!valAiPreview) return;
    commit({ ...validation, ...valAiPreview });
    setValAiPreview(null);
    setValAiStatus({ type:'success', text:'Validation applied.' });
    setShowValAiModal(false);
  };
  const discardValidationPreview = () => { setValAiPreview(null); setValAiStatus(null); };

  return (
    <SpaceBetween size="l">
        <Container variant="stacked" header={<Header variant="h4" actions={<SpaceBetween size="xs" direction="horizontal"><div role="button" tabIndex={0} aria-label="AI generate validation" onClick={()=>setShowValAiModal(true)} onKeyDown={e=>{ if(e.key==='Enter'||e.key===' ') { e.preventDefault(); setShowValAiModal(true);} }} style={{ cursor:'pointer' }}><Avatar ariaLabel="AI validation generator" color="gen-ai" iconName="gen-ai" tooltipText="Generate validation with AI" /></div></SpaceBetween>}>Required</Header>}>
          <SpaceBetween size="s">
            <FormField label="Required?">
              <Toggle checked={!!validation.required} onChange={({detail})=>updateRoot({ required: detail.checked })}>Field required</Toggle>
            </FormField>
            {validation.required && (
              <SpaceBetween size="s" direction="horizontal">
                <FormField label="Required message (EN)">
                  <Input value={validation.requiredMessage?.en || validation.errorMessage?.en || ''} onChange={({detail})=>updateRoot({ requiredMessage:{ ...(validation.requiredMessage||validation.errorMessage||{}), en: detail.value } })} />
                </FormField>
                <FormField label="Message (FR)">
                  <Input value={validation.requiredMessage?.fr || validation.errorMessage?.fr || ''} onChange={({detail})=>updateRoot({ requiredMessage:{ ...(validation.requiredMessage||validation.errorMessage||{}), fr: detail.value } })} />
                </FormField>
              </SpaceBetween>
            )}
          </SpaceBetween>
        </Container>
  <Container variant="stacked" header={<Header variant="h4" actions={<SpaceBetween direction="horizontal" size="xs">
          <Select
            placeholder="Add rule type"
            selectedOption={null}
            onChange={({detail})=> addRule(detail.selectedOption.value)}
            options={[
              { label:'Predicate', value:'predicate' },
              { label:'At least one', value:'atLeastOne' },
              { label:'Range', value:'range' },
              { label:'Length', value:'length' },
              { label:'Pattern', value:'pattern' },
              { label:'Compare', value:'compare' }
            ]}
            expandToViewport
          />
        </SpaceBetween>}>Rules</Header>}>
          <SpaceBetween size="m">
            {rules.length === 0 && <Box color="text-body-secondary">No rules defined.</Box>}
            {rules.map((r, idx) => (
              <Container key={r.id} header={<Header variant="h5">{idx+1}. {r.type}</Header>}>
                <SpaceBetween size="s">
                  <SpaceBetween direction="horizontal" size="xs">
                    {['change','submit'].map(tr => (
                      <Checkbox key={tr} checked={r.trigger.includes(tr)} onChange={({detail})=>updateRule(r.id, rr => ({ ...rr, trigger: detail.checked ? Array.from(new Set([...rr.trigger, tr])) : rr.trigger.filter(t=>t!==tr) }))}>{tr}</Checkbox>
                    ))}
                  </SpaceBetween>
                  <SpaceBetween direction="horizontal" size="s">
                    <FormField label="Severity">
                      <Select
                        selectedOption={{ label:r.severity, value:r.severity }}
                        onChange={({detail})=>updateRule(r.id, rr => ({ ...rr, severity: detail.selectedOption.value, block: detail.selectedOption.value==='error' ? true : rr.block }))}
                        options={[{label:'error',value:'error'},{label:'warn',value:'warn'}]}
                      />
                    </FormField>
                    <FormField label="Block?">
                      <Checkbox checked={!!r.block} onChange={({detail})=>updateRule(r.id, rr => ({ ...rr, block: detail.checked }))}>Block</Checkbox>
                    </FormField>
                  </SpaceBetween>
                  {r.type==='predicate' && (
                    <FormField label="JSON Logic (triggering failure)">
                      <Textarea rows={9} value={JSON.stringify(r.when, null, 2)} onChange={({detail})=>{ try { const parsed = JSON.parse(detail.value); updateRule(r.id, rr=>({...rr, when: parsed})); } catch {} }} />
                    </FormField>
                  )}
                  {r.type==='atLeastOne' && (
                    <FormField label="Fields (at least one)">
                      <Select
                        multiple
                        selectedOptions={(r.keys||[]).map(k=>({label:k,value:k}))}
                        onChange={({detail})=>updateRule(r.id, rr=>({...rr, keys: detail.selectedOptions.map(o=>o.value)}))}
                        options={fieldOptions}
                        placeholder="Choose fields"
                        expandToViewport
                      />
                    </FormField>
                  )}
                  {r.type==='range' && (
                    <SpaceBetween direction="horizontal" size="s">
                      <FormField label="Min"><Input type="number" value={r.min ?? ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, min: detail.value === '' ? undefined : Number(detail.value)}))} /></FormField>
                      <FormField label="Max"><Input type="number" value={r.max ?? ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, max: detail.value === '' ? undefined : Number(detail.value)}))} /></FormField>
                    </SpaceBetween>
                  )}
                  {r.type==='length' && (
                    <SpaceBetween direction="horizontal" size="s">
                      <FormField label="Min length"><Input type="number" value={r.minLength ?? ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, minLength: detail.value===''?undefined:Number(detail.value)}))} /></FormField>
                      <FormField label="Max length"><Input type="number" value={r.maxLength ?? ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, maxLength: detail.value===''?undefined:Number(detail.value)}))} /></FormField>
                    </SpaceBetween>
                  )}
                  {r.type==='pattern' && (
                    <FormField label="Pattern (regex)">
                      <Input value={r.pattern || ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, pattern: detail.value}))} placeholder="e.g. ^\\d+$" />
                    </FormField>
                  )}
                  {r.type==='compare' && (
                    <SpaceBetween size="s">
                      <FormField label="Left field"><Select selectedOption={r.compare?.left?{label:r.compare.left,value:r.compare.left}:null} onChange={({detail})=>updateRule(r.id, rr=>({...rr, compare:{ ...(rr.compare||{}), left: detail.selectedOption.value }}))} options={fieldOptions} placeholder="Select field" /></FormField>
                      <FormField label="Operator"><Select selectedOption={{label: r.compare?.op || '==', value: r.compare?.op || '=='}} onChange={({detail})=>updateRule(r.id, rr=>({...rr, compare:{ ...(rr.compare||{}), op: detail.selectedOption.value }}))} options={[ '==','!=','<','<=','>','>=' ].map(o=>({label:o,value:o}))} /></FormField>
                      <FormField label="Right (field or constant)">
                        <Input value={r.compare?.right ?? ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, compare:{ ...(rr.compare||{}), right: detail.value }}))} />
                      </FormField>
                    </SpaceBetween>
                  )}
                  <SpaceBetween direction="horizontal" size="s">
                    <FormField label="Message (EN)"><Input value={r.message?.en || ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, message:{ ...(rr.message||{}), en: detail.value }}))} /></FormField>
                    <FormField label="Message (FR)"><Input value={r.message?.fr || ''} onChange={({detail})=>updateRule(r.id, rr=>({...rr, message:{ ...(rr.message||{}), fr: detail.value }}))} /></FormField>
                  </SpaceBetween>
                  <Button iconName="remove" onClick={()=>removeRule(r.id)} variant="normal">Remove Rule</Button>
                </SpaceBetween>
              </Container>
            ))}
            <Box color="text-body-secondary" fontSize="body-s">Rules evaluate in listed order. First blocking error stops evaluation; warnings never block.</Box>
          </SpaceBetween>
    </Container>
    <Modal
      visible={showValAiModal}
      onDismiss={()=>setShowValAiModal(false)}
      size="large"
      header="AI Generate Validation"
      footer={<SpaceBetween size="xs" direction="horizontal">{valAiPreview && <Button onClick={discardValidationPreview}>Reset</Button>}<Button onClick={()=>setShowValAiModal(false)}>Close</Button>{valAiPreview && <Button variant="primary" onClick={applyValidationPreview}>Apply</Button>}<Button variant="primary" iconName="refresh" loading={valAiGenerating} disabled={valAiGenerating || !valAiPrompt.trim()} onClick={generateValidationWithAI}>{valAiPreview ? 'Regenerate' : 'Generate'}</Button></SpaceBetween>}
    >
      <SpaceBetween size="m">
        <FormField label="Describe validation goals" constraintText="E.g. 'Required, must match Canadian postal code pattern, warn if over 50 characters'">
          <Textarea rows={4} placeholder="Describe desired rules..." value={valAiPrompt} onChange={({detail})=>setValAiPrompt(detail.value)} disabled={valAiGenerating} />
        </FormField>
        {valAiStatus && <Alert type={valAiStatus.type==='error'?'error':(valAiStatus.type==='success'?'success':'info')}>{valAiStatus.text}</Alert>}
        {valAiPreview && (
          <Container header={<Header variant="h3">Preview Rules ({valAiPreview.rules?.length||0})</Header>}>
            <SpaceBetween size="s">
              {(valAiPreview.rules||[]).map((r,i)=> (
                <Box key={r.id} padding={{vertical:'xs'}} border={{ side:'bottom', color:'divider' }}>
                  <strong>{i+1}. {r.type}</strong> – <code>{(r.trigger||[]).join(',')}</code> [{r.severity}{r.block?' block':''}]<br />
                  {r.pattern && <span>Pattern: <code>{r.pattern}</code><br/></span>}
                  {r.min!=null || r.max!=null ? <span>Range: {r.min!=null? r.min : '-'} to {r.max!=null? r.max : '-'}<br/></span>: null}
                  {r.minLength!=null || r.maxLength!=null ? <span>Length: {r.minLength!=null? r.minLength:'-'} to {r.maxLength!=null? r.maxLength:'-'}<br/></span>: null}
                  {r.keys && r.keys.length>0 && <span>Fields: {r.keys.join(', ')}<br/></span>}
                  {r.compare && <span>Compare: {JSON.stringify(r.compare)}<br/></span>}
                  {r.when && <span>Logic: <code>{JSON.stringify(r.when)}</code><br/></span>}
                  Message EN: {r.message?.en || ''}{r.message?.fr ? <> | FR: {r.message.fr}</> : ''}
                </Box>
              ))}
            </SpaceBetween>
          </Container>
        )}
      </SpaceBetween>
    </Modal>
  </SpaceBetween>
  );
};
