// Updated rewrite of PropertiesPanel.js – corrected JSX restoration
import React, { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { Box, Container, Header, Table, Input, Button, Select, SpaceBetween, FormField, Textarea, Badge, Popover } from '@cloudscape-design/components';
import get from 'lodash/get';
import Ajv from 'ajv';

const PropertiesPanel = ({ selectedComponent, updateComponentProperty, pageProperties, setPageProperties }) => {
  const [availableDataSources, setAvailableDataSources] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState(null);
  const [optionSourceMode, setOptionSourceMode] = useState('static'); // Track the current mode
  const suppressOptionModeEffectRef = useRef(false); // Add useRef to suppress updates
  const suppressNextModeEffect = useRef(false); // Add useRef to suppress next mode effect
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
      suppressNextModeEffect.current = false; // Reset the flag
      return; // Skip automatic updates
    }

    if (suppressOptionModeEffectRef.current) {
      suppressOptionModeEffectRef.current = false; // Reset the flag
      return; // Skip automatic updates
    }

    const mode = selectedComponent.props?.mode ?? 'static';
    setOptionSourceMode(mode === 'simple' ? 'static' : mode); // Update mode only if not suppressed
    const endpoint = selectedComponent.props?.endpoint;
    setSelectedEndpoint(mode === 'dynamic' ? endpoint || null : null);
  }, [selectedComponent]);

  const handleOptionModeChange = (mode, editableField) => {
    suppressOptionModeEffectRef.current = true; // Suppress automatic updates
    if (mode === 'dynamic') {
      suppressNextModeEffect.current = true; // Suppress next mode effect for dynamic mode
    }
    setOptionSourceMode(mode); // Update the local state

    if (mode === 'static' || mode === 'simple') {
      updateComponentProperty('props.mode', 'static', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true); // Remove attributes for static mode
    } else if (mode === 'dynamic') {
      setSelectedEndpoint(null); // Reset the selected endpoint
      updateComponentProperty('props.mode', 'dynamic', true);
      updateComponentProperty('props.endpoint', null, true);
      updateComponentProperty('props.attributes', null, true); // Ensure attributes are cleared initially
    } else if (mode === 'snapshot') {
      updateComponentProperty('props.mode', 'snapshot', true);
      updateComponentProperty(editableField.path, [], true);
    }
  };

  const handleSnapshotFetch = async (endpoint, editableField) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}${endpoint}`);
      const data = res.data;
      const schema = selectedComponent.option_schema || ['text', 'value'];
      const mapped = data.map((item) => {
        const option = {};
        if (schema.includes('text')) option.text = item.name;
        if (schema.includes('value')) option.value = String(item.id);
        return option;
      });
      updateComponentProperty(editableField.path, mapped, true);
      updateComponentProperty('props.mode', 'static', true); // Revert to static mode
      updateComponentProperty('props.endpoint', null, true); // Clear endpoint
      setOptionSourceMode('static'); // Update local state to static
    } catch (err) {
      console.error('Snapshot fetch failed', err);
    }
  };

  const handleEndpointChange = (endpoint, editableField) => {
    setSelectedEndpoint(endpoint);

    if (endpoint) {
      updateComponentProperty('props.endpoint', endpoint, true);
      updateComponentProperty('props.attributes', { 'data-options-endpoint': endpoint }, true); // Update attributes for dynamic mode
      updateComponentProperty(editableField.path, [], true); // Clear the items array only when a data source is selected
    }
  };

  const handleAddOption = (editableField) => {
    const current = get(selectedComponent.props, editableField.path) || [];
    updateComponentProperty(editableField.path, [...current, { text: '', value: '' }], true);
  };

  const handleRemoveOption = (index, editableField) => {
    const current = get(selectedComponent.props, editableField.path) || [];
    const updated = current.filter((_, i) => i !== index);
    updateComponentProperty(editableField.path, updated, true);
  };

  const getSchema = () => selectedComponent?.option_schema || ['text', 'value'];
  const rawMode = selectedComponent?.props?.mode ?? 'static';
  const currentMode = optionSourceMode; // Use the tracked mode instead of rawMode

  // Helper: safely display bilingual objects or primitives
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

  // Build a lightweight JSON Schema for Ajv from editable_fields
  const componentJsonSchema = useMemo(() => {
    const fields = (selectedComponent?.editable_fields || []).filter(f => f.type !== 'optionList');
    const properties = {};
    const required = [];
    for (const f of fields) {
      const key = f.path; // use full path as a property key in a flat map
      let type = 'string';
      if (f.type === 'checkbox' || f.type === 'boolean') type = 'boolean';
      if (f.type === 'select' && Array.isArray(f.options)) type = 'string';
      if (f.type === 'attributes') type = 'array';
      properties[key] = { type };
      if (f.type === 'select' && Array.isArray(f.options)) {
        properties[key].enum = f.options.map(o => (o.value ?? o));
      }
      if (f.required) required.push(key);
    }
    return { type: 'object', properties, required };
  }, [selectedComponent?.editable_fields]);

  const validateProps = (props) => {
    try {
      const validate = ajv.compile(componentJsonSchema);
      const flat = {};
      // flatten nested values to path keys
      (selectedComponent?.editable_fields || []).forEach(f => {
        if (!f.path) return;
        flat[f.path] = get(props, f.path);
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
      // if schema compilation fails, do not block editing
      setValidationErrors({});
    }
  };

  // Hover help for common fields
  const hintFor = (path, label) => {
    const p = String(path || '').toLowerCase();
    if (p === 'label.classes') return 'Label size and visibility. Use govuk-label--s|m|l|xl or govuk-visually-hidden.';
  if (p === 'fieldset.legend.classes') return 'Legend size for radios/checkboxes. Use govuk-fieldset__legend--s|m|l|xl or govuk-visually-hidden.';
    if (p === 'hint.text') return 'Helper text shown under the label. Keep it short and actionable.';
    if (p === 'formgroup.classes' || p === 'formgroup.classes'.toLowerCase()) return 'Classes on the surrounding form group. Use GOV.UK spacing utilities; avoid error classes.';
    if (p === 'classes') return 'Extra CSS classes on the control. Space-separated; prefer GOV.UK utilities.';
    if (p.endsWith('.classes')) return 'Extra CSS classes on this element. Space-separated; prefer GOV.UK utilities.';
    if (p === 'autocomplete') return 'HTML autocomplete hint for browsers (e.g., email, given-name). Leave blank unless clear.';
    if (p === 'inputmode' || p === 'inputmode'.toLowerCase() || p === 'inputmode' || p === 'inputmode') return 'Virtual keyboard hint for mobile (e.g., numeric, email, tel).';
    if (p === 'type' || p === 'props.type') return 'HTML input type (text, email, number, etc.). Affects validation and keyboards.';
    if (p === 'pattern') return 'Client-side regex the value must match. Use sparingly; consider server validation too.';
    if (p === 'spellcheck') return 'Enable for free text (true); disable for codes, emails, or numbers (false).';
    if (p === 'disabled') return 'Prevents user interaction. Usually false for live forms.';
    if (p === 'describedby' || p === 'describedby' || p === 'describedby') return 'Space-separated IDs appended to aria-describedby. Advanced accessibility wiring.';
    if (p.startsWith('prefix.')) return 'Non-editable text before the input (e.g., $).';
    if (p.startsWith('suffix.')) return 'Non-editable text after the input (e.g., kg).';
    if (p === 'attributes') return 'Custom attributes (e.g., data-*). Use cautiously and document usage.';
    return null;
  };

  useEffect(() => {
    if (!selectedComponent) { setValidationErrors({}); return; }
    validateProps(selectedComponent.props || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedComponent?.props, selectedComponent?.editable_fields]);

  // Curated option sets for common HTML/GOV.UK fields (with full flexibility via custom input)
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

  // A few pragmatic pattern presets; authors can still paste any regex
  const PATTERN_SUGGESTIONS = useMemo(() => [
    '',
    // Digits only (any length)
    '^\\d+$',
    // 5-digit ZIP (US)
    '^[0-9]{5}$',
    // 5 or 9-digit ZIP with dash
    '^[0-9]{5}(?:-[0-9]{4})?$',
    // 10 digits (phone-like)
    '^[0-9]{10}$',
    // Canadian postal code (simple, case-insensitive on client typically)
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
    // Common spacing utilities (safe, optional)
    'govuk-!-margin-bottom-2', 'govuk-!-margin-bottom-3', 'govuk-!-margin-bottom-4',
    'govuk-!-font-weight-bold',
    // Radios/Checkboxes layout helpers
    'govuk-radios--inline', 'govuk-radios--small',
    'govuk-checkboxes--inline', 'govuk-checkboxes--small'
  ], []);

  const isPath = (p, ...cands) => typeof p === 'string' && cands.some(c => p.toLowerCase() === c.toLowerCase());
  const endsWithPath = (p, suffix) => typeof p === 'string' && p.toLowerCase().endsWith(suffix.toLowerCase());

  const CuratedSelectWithCustom = ({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    width = 280
  }) => {
    const optionList = options.map(v => ({ label: v === '' ? '(empty)' : v, value: v }));
    const isCustom = value != null && !options.includes(value);
    const selected = isCustom ? { label: 'Custom…', value: '__custom__' } : { label: (value ?? '') === '' ? '(empty)' : (value ?? ''), value: value ?? '' };
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: width }}>
        <Select
          selectedOption={selected}
          onChange={({ detail }) => {
            const v = detail.selectedOption.value;
            if (v === '__custom__') return; // keep current text; user will edit in input
            onChange(v);
          }}
          options={[...optionList, { label: 'Custom…', value: '__custom__' }]}
          placeholder={placeholder}
        />
        <Input
          value={value ?? ''}
          placeholder="Custom value"
          onChange={({ detail }) => onChange(detail.value)}
        />
      </div>
    );
  };

  return (
    <>
      <Header variant="h3">Page Properties</Header>
      <Box padding="none" margin="none" overflow="auto">
        <Table
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
                  return <Select selectedOption={{ label: currentValue, value: currentValue }} onChange={({ detail }) => handleChange(detail.selectedOption.value)} options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]} />;
                }
                return <Input value={currentValue} onChange={({ detail }) => handleChange(detail.value)} />;
              },
            },
          }]}
          items={[{ id: 'name', label: 'Name', value: pageProperties.name }, { id: 'status', label: 'Status', value: pageProperties.status }]}
        />
      </Box>

      {selectedComponent && (
        <>
          <Box padding="none" margin="none" overflow="auto">
            <Header variant="h3">Component Properties</Header>
            <Table
              columnDefinitions={[{
                id: 'label',
                header: 'Property',
                cell: item => {
                  const desc = hintFor(item.path, item.label);
                  if (!desc) return item.label;
                  return (
                    <Popover
                      triggerType="hover"
                      size="small"
                      position="top"
                      content={desc}
                    >
                      <span style={{ cursor: 'help', textDecoration: 'underline dotted' }}>{item.label}</span>
                    </Popover>
                  );
                },
              }, {
                id: 'value',
                header: 'Value',
                minWidth: 100,
                maxWidth: 200,
                cell: item => {
                  const v = item.value;
                  const err = validationErrors[item.path];
                  const display = typeof v === 'boolean' ? (v ? 'True' : 'False') : (typeof v === 'object' ? JSON.stringify(v) : v);
                  return (
                    <SpaceBetween direction="horizontal" size="xs">
                      <span>{display}</span>
                      {err && <Badge color="red">{err}</Badge>}
                    </SpaceBetween>
                  );
                },
                editConfig: {
                  editingCell: (item, { currentValue, setValue }) => {
                    const handleChange = (value) => {
                      setValue(value);
                      updateComponentProperty(item.path, value, true);
                      // validate on change
                      const next = JSON.parse(JSON.stringify(selectedComponent?.props || {}));
                      // set nested path
                      const parts = item.path.split('.');
                      let tgt = next; for (let i=0;i<parts.length-1;i++){ if(!tgt[parts[i]]) tgt[parts[i]]={}; tgt=tgt[parts[i]]; }
                      tgt[parts[parts.length-1]] = value;
                      validateProps(next);
                    };

                    // Curated editors for specific fields (balance UX + flexibility)
                    const path = item.path || '';
                    const val = (currentValue !== undefined ? currentValue : item.value);
                    // 1) label.classes – GOV.UK label sizes + visually hidden
                    if (isPath(path, 'label.classes')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={LABEL_CLASS_SUGGESTIONS}
                          placeholder="Label class"
                        />
                      );
                    }
                    // 2) fieldset.legend.classes – GOV.UK legend sizes
                    if (isPath(path, 'fieldset.legend.classes')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={FIELDSET_LEGEND_CLASS_SUGGESTIONS}
                          placeholder="Legend class"
                        />
                      );
                    }
                    // 2b) Generic *.classes – offer a small set of useful utilities
                    if (endsWithPath(path, '.classes')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={GENERIC_CLASS_SUGGESTIONS}
                          placeholder="CSS classes"
                        />
                      );
                    }
                    // 3) autocomplete – HTML standard tokens
                    if (isPath(path, 'autocomplete')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={AUTOCOMPLETE_SUGGESTIONS}
                          placeholder="Autocomplete"
                        />
                      );
                    }
                    // 4) inputmode/inputMode – standard tokens
                    if (isPath(path, 'inputmode', 'inputMode')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={INPUTMODE_SUGGESTIONS}
                          placeholder="Input mode"
                        />
                      );
                    }
                    // 5) type – common HTML input types
                    if (isPath(path, 'type', 'props.type')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={INPUT_TYPE_SUGGESTIONS}
                          placeholder="Input type"
                        />
                      );
                    }
                    // 6) pattern – provide a few helpful presets
                    if (isPath(path, 'pattern')) {
                      return (
                        <CuratedSelectWithCustom
                          value={val || ''}
                          onChange={handleChange}
                          options={PATTERN_SUGGESTIONS}
                          placeholder="Pattern (regex)"
                        />
                      );
                    }
                    switch (item.type) {
                      case 'textarea':
                        return <Textarea value={currentValue || item.value} onChange={({ detail }) => handleChange(detail.value)} rows={4} />;
                      case 'text':
                        return <Input value={currentValue || item.value} onChange={({ detail }) => handleChange(detail.value)} />;
                      case 'checkbox':
                      case 'boolean':
                        const selectedBool = currentValue ?? item.value;
                        return (
                          <Select
                            selectedOption={{ label: selectedBool ? 'True' : 'False', value: selectedBool }}
                            onChange={({ detail }) => handleChange(detail.selectedOption.value)}
                            options={[
                              { label: 'True', value: true },
                              { label: 'False', value: false }
                            ]}
                          />
                        );
                      case 'select':
                      case 'enum':
                        return <Select selectedOption={{ label: currentValue || item.value, value: currentValue || item.value }} onChange={({ detail }) => handleChange(detail.selectedOption.value)} options={item.options || []} />;
                      case 'attributes':
                        // minimal editor for array of { attribute, value }
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
                      default:
                        return null;
                    }
                  },
                },
              }]}
              items={selectedComponent.editable_fields?.filter(field => field.type !== 'optionList').map(field => ({
                label: field.label,
                value: get(selectedComponent.props, field.path),
                type: field.type === 'string' ? 'text' : (field.type === 'enum' ? 'select' : field.type),
                options: (field.options || []).map(o => typeof o === 'string' ? { label: o, value: o } : o),
                path: field.path,
              }))}
              submitEdit={() => { }}
              ariaLabels={{ tableLabel: 'Component Properties Table' }}
            />
          </Box>
        </>
      )}

  {Boolean(selectedComponent?.has_options) && selectedComponent.editable_fields?.map((field) => {
        if (field.type !== 'optionList') return null;
        const options = get(selectedComponent.props, field.path) || [];
        const schema = getSchema();

        return (
          <React.Fragment key={field.path}>
            <Header variant="h3">Options Properties</Header>
            <Container padding="m">
              <SpaceBetween size="m">
                <FormField label="Options Source">
                  <Select
                    selectedOption={{
                      label:
                        currentMode === 'dynamic' ? 'Code Table: Dynamic' :
                          currentMode === 'snapshot' ? 'Code Table: Snapshot' :
                            'Static (manually entered)',
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
                          selectedOption={
                            selectedEndpoint
                              ? {
                                label: availableDataSources.find(ds => ds.endpoint === selectedEndpoint)?.label || '',
                                value: selectedEndpoint,
                              }
                              : null
                          }
                          onChange={({ detail }) => handleEndpointChange(detail.selectedOption.value, field)}
                          options={[
                            { label: 'Select a data source...', value: null }, // Placeholder option
                            ...availableDataSources.map(ds => ({
                              label: ds.label,
                              value: ds.endpoint,
                            })),
                          ]}
                          placeholder="Select a data source..." // Ensure placeholder is shown
                        />
                      </FormField>
                    )}
                    {currentMode === 'snapshot' && (
                      <FormField label="Select Data Source (Snapshot)">
                        <Select
                          selectedOption={null}
                          onChange={({ detail }) => handleSnapshotFetch(detail.selectedOption.value, field)}
                          options={availableDataSources.map(ds => ({ label: ds.label, value: ds.endpoint }))}
                        />
                      </FormField>
                    )}
                  </>
                )}

                {(currentMode === 'static') && (
                  <>
                    {/* Basic validation for option lists: duplicate values / empty labels */}
                    {(() => {
                      const vals = options.map(o => String(o?.value ?? '')).filter(v => v !== '');
                      const dups = new Set(vals.filter((v, i) => vals.indexOf(v) !== i));
                      const empties = options.filter(o => !String(o?.text ?? '').trim());
                      if (dups.size === 0 && empties.length === 0) return null;
                      return (
                        <Box padding="s">
                          {dups.size > 0 && (
                            <Badge color="red">Duplicate values: {Array.from(dups).join(', ')}</Badge>
                          )}
                          {dups.size > 0 && empties.length > 0 && ' '}
                          {empties.length > 0 && (
                            <Badge color="red">{empties.length} option(s) missing label</Badge>
                          )}
                        </Box>
                      );
                    })()}
                  <Table
                    variant='embedded'
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
                      {
                        id: 'actions',
                        header: 'Actions',
                        cell: item => (
                          <Button iconName="close" variant="icon" onClick={() => handleRemoveOption(options.indexOf(item), field)} />
                        ),
                      },
                    ]}
                    items={options}
                    header={
                      <Header
                        variant='h3'
                        actions={
                          <Button iconName="add-plus" variant="icon" onClick={() => handleAddOption(field)}>Add Option</Button>
                        }
                      >
                      </Header>
                    }
                  />
                  </>
                )}
              </SpaceBetween>
            </Container>
          </React.Fragment>
        );
      })}
    </>
  );
};

export default PropertiesPanel;
