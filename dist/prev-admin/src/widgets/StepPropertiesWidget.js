import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { useHistory } from 'react-router-dom';
import { BoardItem } from '@cloudscape-design/board-components';
import { Box, Header, Container, SpaceBetween, FormField, Input, Select, Button, Textarea, Toggle, Icon } from '@cloudscape-design/components';

const selectObj = (value, opts) => opts.find(o => o.value === value) || null;
const stepOptionsFrom = (steps, excludeId) => steps.filter(s => s.id !== excludeId).map(s => ({ label: s.name, value: s.id }));

const StepPropertiesWidget = ({ apiBase = '', steps = [], selectedId, onChange, onDelete, workflowId }) => {
  const history = useHistory();
  const step = steps.find(s => s.id === selectedId) || null;
  const stepOpts = useMemo(() => (step ? stepOptionsFrom(steps, step.id) : []), [steps, step?.id]);
  const routing = step?.routing || { mode: 'linear' };

  const [fieldChoices, setFieldChoices] = useState([]); // [{label,value}]
  const [optionsByField, setOptionsByField] = useState({}); // { fieldKey: [{value,label}] }
  const [labelByValue, setLabelByValue] = useState({}); // { value: label }
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldErr, setFieldErr] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setFieldErr(null);
      setFieldChoices([]); setOptionsByField({}); setLabelByValue({});
      if (!step?.stepId) return; // no DB backing
      try {
        setLoadingFields(true);
  const res = await apiFetch(`/api/steps/${step.stepId}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
        const choices = [];
        const map = {};
        (data.components || []).forEach(c => {
          const key = (c.props && c.props.name) || null;
          const tkey = c.templateKey || '';
          if (!key) return;
          if (tkey === 'radio' || tkey === 'select') {
            const items = Array.isArray(c.props?.items) ? c.props.items : [];
            const opts = items.map(it => ({ value: String(it?.value ?? ''), label: String(it?.text ?? String(it?.value ?? '')) })).filter(o => o.value.length > 0);
            if (opts.length) { choices.push({ label: key, value: key }); map[key] = opts; }
          }
        });
        if (cancelled) return;
        setFieldChoices(choices);
        setOptionsByField(map);
        if (step && step.routing?.mode === 'byOption') {
          const currentKey = step.routing.fieldKey;
          const useKey = (currentKey && map[currentKey]) ? currentKey : (choices[0]?.value || currentKey);
          if (useKey && (!currentKey || !Array.isArray(step.routing.options))) {
            const newOpts = (map[useKey] || []).map(o => o.value);
            onChange({ ...step, routing: { mode: 'byOption', fieldKey: useKey, options: newOpts, mapping: {}, defaultNext: undefined } });
          }
          const forLabels = (useKey && map[useKey]) ? map[useKey] : [];
          setLabelByValue(Object.fromEntries(forLabels.map(o => [o.value, o.label])));
        }
        setLoadingFields(false);
      } catch (e) {
        if (!cancelled) { setFieldErr(String(e)); setLoadingFields(false); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [step?.stepId]);

  useEffect(() => {
    if (!step || step.routing?.mode !== 'byOption') return;
    const fk = step.routing.fieldKey;
    if (!fk) { setLabelByValue({}); return; }
    const list = optionsByField[fk] || [];
    setLabelByValue(Object.fromEntries(list.map(o => [o.value, o.label])));
    const values = list.map(o => o.value);
    if (values.length && JSON.stringify(values) !== JSON.stringify(step.routing.options || [])) {
      onChange({ ...step, routing: { ...step.routing, options: values, mapping: {} } });
    }
  }, [optionsByField, step?.routing?.fieldKey]);

  const itemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.',
  };

  if (!step) return (
    <BoardItem header={<Header variant="h2">Step Properties</Header>} i18nStrings={itemI18n}>
      <Box textAlign="center" color="inherit" padding="m">
        <span style={{ color: '#888' }}>[Select a step]</span>
      </Box>
    </BoardItem>
  );

  const setRouting = (newRouting) => onChange({ ...step, routing: newRouting });

  // Step-level validation removed in this version.

  return (
    <BoardItem header={<Header variant="h2">Step Properties</Header>} i18nStrings={itemI18n}>
      <SpaceBetween size="s">
        <Container header={<Header variant="h3">{step.name}</Header>}>
          <FormField label="Step title">
            <Input value={step.name} onChange={({ detail }) => onChange({ ...step, name: detail.value })} />
          </FormField>
          <FormField label="Routing mode">
            <Select
              selectedOption={{ label: routing.mode === 'byOption' ? 'By option' : 'Linear', value: routing.mode }}
              onChange={({ detail }) => {
                const mode = detail.selectedOption.value;
                if (mode === 'linear') setRouting({ mode: 'linear', next: undefined });
                else {
                  const existing = routing.mode === 'byOption' ? routing : null;
                  const firstKey = fieldChoices[0]?.value || existing?.fieldKey || 'optionField';
                  const values = (optionsByField[firstKey] || []).map(o => o.value);
                  setRouting({
                    mode: 'byOption',
                    fieldKey: firstKey,
                    options: values.length ? values : (existing?.options || []),
                    mapping: existing?.mapping || {},
                    defaultNext: existing?.defaultNext
                  });
                }
              }}
              options={[{ label: 'Linear', value: 'linear' }, { label: 'By option', value: 'byOption' }]}
            />
          </FormField>
          {routing.mode === 'linear' && (
            <FormField label="Next step">
              <Select
                placeholder="(none / end)"
                selectedOption={selectObj(routing.next, stepOpts)}
                onChange={({ detail }) => setRouting({ mode: 'linear', next: detail.selectedOption?.value })}
                options={stepOpts}
                filteringType="auto"
              />
            </FormField>
          )}
          {routing.mode === 'byOption' && (
            <SpaceBetween size="s">
              <FormField label="Option field (on this step)">
                <Select
                  placeholder={loadingFields ? 'Loading…' : (fieldErr ? 'Failed to load fields' : 'Choose a field')}
                  selectedOption={routing.fieldKey ? selectObj(routing.fieldKey, fieldChoices) : null}
                  onChange={({ detail }) => {
                    const fk = detail.selectedOption?.value; if (!fk) return;
                    const values = (optionsByField[fk] || []).map(o => o.value);
                    setRouting({ ...routing, fieldKey: fk, options: values, mapping: {} });
                  }}
                  options={fieldChoices}
                  filteringType="auto"
                />
              </FormField>
              <Container header={<Header variant="h4">Option mappings</Header>}>
                <SpaceBetween size="xs">
                  {routing.options.map(opt => {
                    const selected = selectObj(routing.mapping?.[opt], stepOpts);
                    return (
                      <FormField key={opt} label={labelByValue[opt] || opt}>
                        <Select
                          placeholder="Choose next step"
                          selectedOption={selected}
                          onChange={({ detail }) => {
                            const next = detail.selectedOption?.value;
                            setRouting({ ...routing, mapping: { ...(routing.mapping || {}), [opt]: next } });
                          }}
                          options={stepOpts}
                          filteringType="auto"
                        />
                      </FormField>
                    );
                  })}
                </SpaceBetween>
              </Container>
              <FormField label="Default next (for unmapped options)">
                <Select
                  placeholder="Choose default"
                  selectedOption={selectObj(routing.defaultNext, stepOpts)}
                  onChange={({ detail }) => setRouting({ ...routing, defaultNext: detail.selectedOption?.value })}
                  options={stepOpts}
                  filteringType="auto"
                />
              </FormField>
            </SpaceBetween>
          )}
        </Container>
  {/* Step Validation (Stop Conditions) removed */}
        <SpaceBetween size="xs" direction="horizontal">
          <Button
            onClick={() => {
              if (step.stepId) {
                const qp = workflowId ? `?fromWorkflow=${workflowId}` : '';
                history.push(`/modify-component/${step.stepId}${qp}`);
              }
            }}
            disabled={!step.stepId}
          >Modify step</Button>
          <Button onClick={() => onDelete(step.id)}>Remove step</Button>
        </SpaceBetween>
      </SpaceBetween>
    </BoardItem>
  );
};

export default StepPropertiesWidget;
