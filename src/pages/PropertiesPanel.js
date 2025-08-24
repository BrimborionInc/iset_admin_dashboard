// Updated rewrite of PropertiesPanel.js – consistent Container usage and spacing
import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Box, Container, Header, Table, Input, Button, Select, SpaceBetween, FormField, Textarea, Badge, Popover, Checkbox, Toggle, ExpandableSection } from '@cloudscape-design/components';
import get from 'lodash/get';
import Ajv from 'ajv';

const PropertiesPanel = ({ selectedComponent, updateComponentProperty, pageProperties, setPageProperties, currentLang = 'en', latestTemplateVersionByKey, onUpgradeTemplate }) => {
  const [availableDataSources, setAvailableDataSources] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [optionSourceMode, setOptionSourceMode] = useState('static');
  const suppressOptionModeEffectRef = useRef(false);
  const suppressNextModeEffect = useRef(false);
  const [validationErrors, setValidationErrors] = useState({});

  const ajv = useMemo(() => new Ajv({ allErrors: true, strict: false }), []);

  useEffect(() => {
    axios.get(`${process.env.REACT_APP_API_BASE_URL}/api/option-data-sources`)
      .then(res => setAvailableDataSources(res.data))
      .catch(err => console.error('Failed to load data sources', err));
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
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}${endpoint}`);
      const data = res.data;
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
    if (p === 'pattern') return 'Client-side regex the value must match. Use sparingly; consider server validation too.';
    if (p === 'spellcheck') return 'Enable for free text (true); disable for codes, emails, or numbers (false).';
    if (p === 'disabled') return 'Prevents user interaction. Usually false for live forms.';
    if (p === 'describedby') return 'Space-separated IDs appended to aria-describedby. Advanced accessibility wiring.';
    if (p.startsWith('prefix.')) return 'Non-editable text before the input (e.g., $).';
    if (p.startsWith('suffix.')) return 'Non-editable text after the input (e.g., kg).';
  if (p === 'attributes') return 'Custom attributes (e.g., data-*). Use cautiously and document usage.';
  if (p === 'name') return 'Submission key used as the field identifier in submissions.';
  if (p === 'id') return 'HTML id attribute (used for label association); usually match Submission Key.';
  if (p === 'rows') return 'Visible height (number of text rows).';
  if (p === 'maxlength') return 'Maximum character count enforced by the component.';
  if (p === 'threshold') return 'Percentage (0-100) when the counter starts showing (e.g., 75).';
  if (p === 'maxwords') return 'Optional maximum word count (leave blank to ignore).';
  if (p === 'value') return 'Default pre-filled value (leave blank for none).';
    return null;
  };

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
    '', 'govuk-visually-hidden',
    'govuk-!-margin-bottom-2', 'govuk-!-margin-bottom-3', 'govuk-!-margin-bottom-4',
    'govuk-!-font-weight-bold',
    'govuk-radios--inline', 'govuk-radios--small',
    'govuk-checkboxes--inline', 'govuk-checkboxes--small'
  ], []);

  const isPath = (p, ...cands) => typeof p === 'string' && cands.some(c => p.toLowerCase() === c.toLowerCase());
  const endsWithPath = (p, suffix) => typeof p === 'string' && p.toLowerCase().endsWith(suffix.toLowerCase());

  const CuratedSelectWithCustom = ({ value, onChange, options, placeholder = 'Select...', width = 280 }) => {
    const optionList = options.map(v => ({ label: v === '' ? '(empty)' : v, value: v }));
    const isCustom = value != null && !options.includes(value);
    const [showCustom, setShowCustom] = React.useState(isCustom);
    // Keep internal showCustom state in sync if parent value changes to a curated option
    useEffect(() => {
      if (!isCustom && showCustom) setShowCustom(false);
      if (isCustom && !showCustom) setShowCustom(true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isCustom, value]);
    const selected = (showCustom || isCustom)
      ? { label: 'Custom…', value: '__custom__' }
      : { label: (value ?? '') === '' ? '(empty)' : (value ?? ''), value: value ?? '' };
    const handleSelectChange = (v) => {
      if (v === '__custom__') {
        setShowCustom(true);
        if (!isCustom) {
          // Seed with empty string so user can type
          onChange('');
        }
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
            value={value ?? ''}
            placeholder="Enter custom value"
            onChange={({ detail }) => onChange(detail.value)}
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
    'label.text', 'hint.text', 'errorMessage.text', 'fieldset.legend.text'
  ]);
  const isTranslatablePath = (p) => translatablePaths.has(String(p || ''));

  return (
    <SpaceBetween size="l">
      <ExpandableSection headerText="Page Properties" defaultExpanded>
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
        <>
          <ExpandableSection headerText="Component Properties" defaultExpanded>
            {selectedComponent && latestTemplateVersionByKey && (
              (() => {
                const key = selectedComponent.template_key || selectedComponent.type;
                const latest = latestTemplateVersionByKey.get ? latestTemplateVersionByKey.get(key) : latestTemplateVersionByKey[key];
                const cur = selectedComponent.version || 0;
                const needsUpgrade = latest && latest > cur;
                return (
                  <Box margin={{ bottom: 's' }}>
                    <SpaceBetween size="xs" direction="horizontal">
                      <Badge color={needsUpgrade ? 'red' : 'green'}>{`Version ${cur}${needsUpgrade ? ` (latest is ${latest})` : ''}`}</Badge>
                      {needsUpgrade && (
                        <Button size="small" onClick={() => onUpgradeTemplate && onUpgradeTemplate()}>Upgrade to v{latest}</Button>
                      )}
                    </SpaceBetween>
                  </Box>
                );
              })()
            )}
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
                      if (isPath(path, 'classes')) {
                        return (
                          <CuratedSelectWithCustom value={val || ''} onChange={handleChange} options={GENERIC_CLASS_SUGGESTIONS} placeholder="CSS classes" />
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
                        case 'enum':
                          return <Select expandToViewport selectedOption={{ label: currentValue || item.value, value: currentValue || item.value }} onChange={({ detail }) => handleChange(detail.selectedOption.value)} options={item.options || []} />;
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
                              ...schema.map(key => ({
                                id: key,
                                header: key,
                                cell: item => asLangString(item[key], 'en'),
                                editConfig: {
                                  editingCell: (item, { currentValue, setValue }) => (
                                    <Input
                                      value={currentValue ?? asLangString(item[key], 'en')}
                                      onChange={({ detail }) => {
                                        const newVal = detail.value;
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
                                       }}
                                     />
                                   ),
                                 },
                               })),
                               { id: 'actions', header: 'Actions', cell: item => (<Button iconName="close" variant="icon" onClick={() => handleRemoveOption(options.indexOf(item), field)} />) },
                            ]}
                            items={options}
                            header={<Header variant="h3" actions={<Button iconName="add-plus" variant="icon" onClick={() => handleAddOption(field)}>Add Option</Button>} />}
                          />
                        </>
                      )}
                    </SpaceBetween>
                    </Container>
                  </ExpandableSection>
                </React.Fragment>
              );
            })}
        </>
      )}
      {selectedComponent && (
        <ExpandableSection headerText="Validation" defaultExpanded>
          <ValidationEditor
            selectedComponent={selectedComponent}
            updateComponentProperty={updateComponentProperty}
          />
        </ExpandableSection>
      )}
    </SpaceBetween>
  );
};

export default PropertiesPanel;

// --- Validation Editor (inline) ---
const ValidationEditor = ({ selectedComponent, updateComponentProperty }) => {
  // Support prior mistaken nesting at props.props.validation
  const misNested = selectedComponent?.props?.props?.validation;
  const topLevel = selectedComponent?.props?.validation;
  const validation = topLevel || misNested || {};
  React.useEffect(() => {
    if (!topLevel && misNested) {
      // Lift mis-nested validation to correct location
      updateComponentProperty('validation', misNested, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [misNested, topLevel, selectedComponent?.props]);
  const rules = Array.isArray(validation.rules) ? validation.rules : [];

  const commit = (next) => {
    updateComponentProperty('validation', next, true);
  };

  const updateField = (path, value) => {
    const parts = path.split('.');
    const next = { ...validation, rules: [...rules] };
    let tgt = next;
    for (let i=0;i<parts.length-1;i++) {
      if (!tgt[parts[i]] || typeof tgt[parts[i]] !== 'object') tgt[parts[i]] = {};
      tgt = tgt[parts[i]];
    }
    tgt[parts[parts.length-1]] = value;
    commit(next);
  };

  const addRule = () => {
    const id = `rule-${Date.now()}`;
    const base = {
      id,
      trigger: ['submit'],
      kind: 'predicate',
      when: { '==': [ { var: selectedComponent?.props?.name || 'field' }, '' ] },
      message: { en: 'Custom validation message', fr: 'Message de validation personnalisé' },
      severity: 'error',
      block: false
    };
    commit({ ...validation, rules: [...rules, base] });
  };

  const updateRule = (idx, mutator) => {
    const nextRules = rules.map((r,i)=> i===idx ? mutator({ ...r }) : r);
    commit({ ...validation, rules: nextRules });
  };

  const removeRule = (idx) => {
    const nextRules = rules.filter((_,i)=> i!==idx);
    commit({ ...validation, rules: nextRules });
  };

  const aiGenerate = () => {
    // Simple heuristic generation based on type & labels
    const type = String(selectedComponent?.type || '').toLowerCase();
    const name = selectedComponent?.props?.label?.text || selectedComponent?.props?.fieldset?.legend?.text || selectedComponent?.props?.name || 'This field';
    const baseEn = type.includes('radio') ? `Select an option for ${name.toLowerCase()}` : type.includes('checkbox') ? `Select at least one option for ${name.toLowerCase()}` : `Enter ${name.toLowerCase()}`;
    const baseFr = type.includes('radio') ? `Sélectionnez une option pour ${name.toLowerCase()}` : type.includes('checkbox') ? `Sélectionnez au moins une option pour ${name.toLowerCase()}` : `Entrez ${name.toLowerCase()}`;
    const next = { ...validation, errorMessage: { en: baseEn, fr: baseFr } };
    commit(next);
  };

  return (
  <Container header={<Header variant="h3">Validation</Header>}>
      <SpaceBetween size="m">
        <FormField label="Required field?">
          <Toggle
            checked={!!validation.required}
            onChange={({ detail }) => updateField('required', detail.checked)}
          >Required on submit</Toggle>
        </FormField>
        <FormField label="Base error message (English)">
          <Input
            placeholder="e.g. Select an option"
            value={validation.errorMessage?.en || ''}
            onChange={({ detail }) => updateField('errorMessage.en', detail.value)}
          />
        </FormField>
        <FormField label="Message d'erreur de base (Français)">
          <Input
            placeholder="p.ex. Sélectionnez une option"
            value={validation.errorMessage?.fr || ''}
            onChange={({ detail }) => updateField('errorMessage.fr', detail.value)}
          />
        </FormField>
        <Button variant="normal" onClick={aiGenerate}>AI Generate Messages</Button>
        <Header variant="h4" actions={<Button onClick={addRule} iconName="add-plus" variant="icon">Add Rule</Button>}>Predicate Rules</Header>
        {rules.length === 0 && <Box color="text-body-secondary">No predicate rules</Box>}
        {rules.map((rule, idx) => (
          <Container key={rule.id || idx} header={<Header variant="h5">Rule {idx+1}</Header>}>
            <SpaceBetween size="s">
              <FormField label="Triggers">
                <SpaceBetween direction="horizontal" size="xs">
                  {['change','submit'].map(t => (
                    <Checkbox
                      key={t}
                      checked={rule.trigger?.includes(t)}
                      onChange={({ detail }) => updateRule(idx, r => ({
                        ...r,
                        trigger: detail.checked ? Array.from(new Set([...(r.trigger||[]), t])) : (r.trigger||[]).filter(x=>x!==t)
                      }))}
                    >{t}</Checkbox>
                  ))}
                </SpaceBetween>
              </FormField>
              <FormField label="JSON Logic condition (when)">
                <Textarea
                  rows={3}
                  value={JSON.stringify(rule.when, null, 2)}
                  onChange={({ detail }) => {
                    try { const parsed = JSON.parse(detail.value); updateRule(idx, r => ({ ...r, when: parsed })); }
                    catch { /* ignore parse errors until valid */ }
                  }}
                />
              </FormField>
              <FormField label="Severity">
                <Select
                  expandToViewport
                  selectedOption={{ label: rule.severity || 'error', value: rule.severity || 'error' }}
                  onChange={({ detail }) => updateRule(idx, r => ({ ...r, severity: detail.selectedOption.value }))}
                  options={[{ label: 'error', value: 'error' }, { label: 'warn', value: 'warn' }]}
                />
              </FormField>
              <FormField label="Block progression?">
                <Checkbox
                  checked={!!rule.block}
                  onChange={({ detail }) => updateRule(idx, r => ({ ...r, block: detail.checked }))}
                >Block on fail</Checkbox>
              </FormField>
              <FormField label="Message (English)">
                <Input
                  value={rule.message?.en || ''}
                  onChange={({ detail }) => updateRule(idx, r => ({ ...r, message: { ...(r.message||{}), en: detail.value } }))}
                />
              </FormField>
              <FormField label="Message (Français)">
                <Input
                  value={rule.message?.fr || ''}
                  onChange={({ detail }) => updateRule(idx, r => ({ ...r, message: { ...(r.message||{}), fr: detail.value } }))}
                />
              </FormField>
              <SpaceBetween direction="horizontal" size="xs">
                <Button iconName="remove" onClick={() => removeRule(idx)} variant="normal">Remove</Button>
              </SpaceBetween>
            </SpaceBetween>
          </Container>
        ))}
        <Box color="text-body-secondary" fontSize="body-s">Rules run in order; first blocking error stops navigation. Conditions use json-logic.</Box>
      </SpaceBetween>
    </Container>
  );
};
