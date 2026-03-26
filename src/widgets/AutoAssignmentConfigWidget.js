import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Button,
  ButtonDropdown,
  ColumnLayout,
  Header,
  Multiselect,
  Select,
  SpaceBetween,
  StatusIndicator,
  Table,
  Toggle,
  Modal,
  FormField,
  Input,
  Alert
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';

const AutoAssignmentConfigWidget = ({ actions, role }) => {
  const [enabled, setEnabled] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveInfo, setSaveInfo] = useState(null);
  const [savedSignature, setSavedSignature] = useState(null);

  const canConfigure = useMemo(
    () => role === 'System Administrator' || role === 'NWAC Administrator',
    [role]
  );

  const [rules, setRules] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalWorking, setModalWorking] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [formState, setFormState] = useState({ label: '', assigneeOption: null, priority: 1, conditions: [] });
  const [formError, setFormError] = useState(null);
  const [staffOptions, setStaffOptions] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState(null);

  const filteredRules = useMemo(() => {
    return rules;
  }, [rules]);

  const configSignature = useMemo(() => JSON.stringify({ enabled, rules }), [enabled, rules]);
  const dirty = useMemo(() => savedSignature !== null ? savedSignature !== configSignature : false, [configSignature, savedSignature]);

  const conditionOptions = useMemo(() => [
    { value: 'province', label: 'Province' },
    { value: 'indigenous_group', label: 'Indigenous group' },
    { value: 'any', label: 'Always' }
  ], []);
  const operatorOptions = useMemo(() => [
    { value: 'equals', label: 'is' },
    { value: 'in', label: 'is any of' },
    { value: 'not_in', label: 'is not any of' },
    { value: 'exists', label: 'exists' },
    { value: 'always', label: 'always' }
  ], []);

  const provinceOptions = [
    { value: 'ab', label: 'AB - Alberta' },
    { value: 'bc', label: 'BC - British Columbia' },
    { value: 'mb', label: 'MB - Manitoba' },
    { value: 'nb', label: 'NB - New Brunswick' },
    { value: 'nl', label: 'NL - Newfoundland and Labrador' },
    { value: 'ns', label: 'NS - Nova Scotia' },
    { value: 'nt', label: 'NT - Northwest Territories' },
    { value: 'nu', label: 'NU - Nunavut' },
    { value: 'on', label: 'ON - Ontario' },
    { value: 'pe', label: 'PE - Prince Edward Island' },
    { value: 'qc', label: 'QC - Quebec' },
    { value: 'sk', label: 'SK - Saskatchewan' },
    { value: 'yt', label: 'YT - Yukon' }
  ];

  const indigenousOptions = [
    { value: 'first_nations_status', label: 'First Nations (Status)' },
    { value: 'first_nations_non_status', label: 'First Nations (Non-Status)' },
    { value: 'inuit', label: 'Inuit' },
    { value: 'metis', label: 'Métis' }
  ];

  const getValueOptions = (field) => {
    if (field === 'province') return provinceOptions;
    if (field === 'indigenous_group') return indigenousOptions;
    return [];
  };

  const createEmptyCondition = () => ({
    id: `cond-${Date.now()}-${Math.random()}`,
    field: 'province',
    op: 'in',
    value: []
  });

  const normaliseRule = useCallback(
    (rule, fallbackLabel) => {
      if (!rule || typeof rule !== 'object') return null;
      const id = typeof rule.id === 'string' && rule.id.trim() ? rule.id.trim() : `rule-${Date.now()}-${Math.random()}`;
      const label = typeof rule.label === 'string' && rule.label.trim() ? rule.label.trim() : fallbackLabel || id;
      const assignee = typeof rule.assignee === 'string' && rule.assignee.trim()
        ? rule.assignee.trim()
        : (rule.assigneeId ? String(rule.assigneeId) : '');
      const assigneeId = rule.assigneeId ? String(rule.assigneeId) : null;
      const priorityNum = Number(rule.priority);
      const priority = Number.isFinite(priorityNum) ? priorityNum : 1;
      const conditions = Array.isArray(rule.conditions) && rule.conditions.length ? rule.conditions : [{ field: 'any', op: 'always', value: [] }];
      const cleanConditions = conditions
        .map((cond, idx) => {
          if (!cond || typeof cond !== 'object') return null;
          const cid = typeof cond.id === 'string' && cond.id.trim() ? cond.id.trim() : `${id}-c${idx}`;
          const field = conditionOptions.find(o => o.value === cond.field)?.value || 'any';
          const op = operatorOptions.find(o => o.value === cond.op)?.value || 'always';
          const needsValue = !(op === 'always' || op === 'exists' || field === 'any');
          const rawValues = Array.isArray(cond.value) ? cond.value : [];
          const values = needsValue ? rawValues.map(v => (typeof v === 'string' ? v.trim().toLowerCase() : null)).filter(Boolean) : [];
          return { id: cid, field, op, value: values };
        })
        .filter(Boolean);
      return {
        id,
        label,
        assignee,
        assigneeId,
        priority,
        conditions: cleanConditions
      };
    },
    [conditionOptions, operatorOptions]
  );

  useEffect(() => {
    let cancelled = false;
    setConfigLoading(true);
    setConfigError(null);
    setSaveInfo(null);
    apiFetch('/api/config/auto-assignment')
      .then(async res => {
        if (!res.ok) {
          const msg = `Load failed (${res.status})`;
          throw new Error(msg);
        }
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        const normalizedRules = Array.isArray(data?.rules)
          ? data.rules.map((rule, idx) => normaliseRule(rule, `Rule ${idx + 1}`)).filter(Boolean)
          : [];
        const enabledFlag = !!data?.enabled;
        setRules(normalizedRules);
        setEnabled(enabledFlag);
        setSavedSignature(JSON.stringify({ enabled: enabledFlag, rules: normalizedRules }));
      })
      .catch(err => {
        if (cancelled) return;
        console.error('[auto-assignment] load failed', err);
        setConfigError('Unable to load automatic assignment rules right now.');
        setRules([]);
        setEnabled(false);
      })
      .finally(() => {
        if (!cancelled) setConfigLoading(false);
      });
    return () => { cancelled = true; };
  }, [normaliseRule]);

  const summariseConditions = (conds = []) => {
    if (!Array.isArray(conds) || conds.length === 0) return 'Always';
    return conds.map(c => {
      const fieldLabel = conditionOptions.find(o => o.value === c.field)?.label || c.field;
      const opLabel = operatorOptions.find(o => o.value === c.op)?.label || c.op;
      const options = getValueOptions(c.field);
      const valueText = Array.isArray(c.value)
        ? c.value.map(val => options.find(opt => opt.value === val)?.label || val).join(', ')
        : c.value;
      if (c.op === 'exists') return `${fieldLabel} exists`;
      if (c.op === 'always' || c.field === 'any') return 'Always';
      return `${fieldLabel} ${opLabel} ${valueText}`;
    }).join(' • ');
  };

  const openRuleModal = (rule) => {
    if (!canConfigure) return;
    loadAssignableStaff();
    setEditingRule(rule || null);
    const initialAssignee = (() => {
      if (!rule) return null;
      if (rule.assigneeId) {
        const match = staffOptions.find(opt => String(opt.value) === String(rule.assigneeId));
        if (match) return match;
      }
      if (rule.assignee) {
        return { label: rule.assignee, value: rule.assigneeId || rule.assignee, email: rule.assignee };
      }
      return null;
    })();
    setFormState({
      label: rule?.label || '',
      assigneeOption: initialAssignee,
      priority: Number.isFinite(rule?.priority) ? rule.priority : 1,
      conditions: Array.isArray(rule?.conditions) && rule.conditions.length
        ? rule.conditions.map(c => ({ ...c }))
        : [createEmptyCondition()]
    });
    setFormError(null);
    setModalVisible(true);
  };

  const handleSaveRule = () => {
    if (!canConfigure || modalWorking) return;
    const { label, assigneeOption, priority, conditions } = formState;
    if (!label.trim() || !assigneeOption) {
      setFormError('Rule name and assignment are required.');
      return;
    }
    const hasEmptyCondition = conditions.some(c => {
      if (c.op === 'exists' || c.op === 'always' || c.field === 'any') return false;
      return !Array.isArray(c.value) || c.value.length === 0;
    });
    if (hasEmptyCondition) {
      setFormError('Fill in all condition values or remove unused rows.');
      return;
    }
    setModalWorking(true);
    const nextRule = {
      id: editingRule?.id || `rule-${Date.now()}`,
      label: label.trim(),
      assignee: assigneeOption.email || assigneeOption.label || '',
      assigneeId: assigneeOption.value || null,
      conditions: conditions.map(c => ({
        ...c,
        value: c.op === 'exists' || c.op === 'always' ? [] : (Array.isArray(c.value) ? c.value : [])
      })),
      priority: Number(priority) || 1
    };
    setRules(current => {
      const exists = current.find(r => r.id === nextRule.id);
      if (exists) {
        return current.map(r => (r.id === nextRule.id ? nextRule : r));
      }
      return [...current, nextRule].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    });
    setModalWorking(false);
    setModalVisible(false);
    setEditingRule(null);
  };

  const handleDelete = (id) => {
    if (!canConfigure) return;
    setRules(current => current.filter(rule => rule.id !== id));
  };

  const updateCondition = (id, updater) => {
    setFormState(current => ({
      ...current,
      conditions: current.conditions.map(cond => cond.id === id ? updater(cond) : cond)
    }));
  };

  const addConditionRow = () => {
    setFormState(current => ({
      ...current,
      conditions: [...current.conditions, createEmptyCondition()]
    }));
  };

  const removeConditionRow = (id) => {
    setFormState(current => {
      const next = current.conditions.filter(cond => cond.id !== id);
      return { ...current, conditions: next.length ? next : [createEmptyCondition()] };
    });
  };

  const handleRemove = () => {
    if (actions?.removeItem) {
      actions.removeItem();
    }
  };

  const handleSaveConfig = useCallback(() => {
    if (!canConfigure || savingConfig) return;
    setSavingConfig(true);
    setSaveInfo(null);
    setConfigError(null);
    apiFetch('/api/config/auto-assignment', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, rules })
    })
      .then(async res => {
        if (!res.ok) {
          const msg = `Save failed (${res.status})`;
          throw new Error(msg);
        }
        return res.json();
      })
      .then(data => {
        const normalizedRules = Array.isArray(data?.rules)
          ? data.rules.map((rule, idx) => normaliseRule(rule, `Rule ${idx + 1}`)).filter(Boolean)
          : [];
        const enabledFlag = !!data?.enabled;
        setRules(normalizedRules);
        setEnabled(enabledFlag);
        const signature = JSON.stringify({ enabled: enabledFlag, rules: normalizedRules });
        setSavedSignature(signature);
        setSaveInfo('Rules saved.');
      })
      .catch(err => {
        console.error('[auto-assignment] save failed', err);
        setConfigError('Unable to save automatic assignment rules.');
      })
      .finally(() => setSavingConfig(false));
  }, [canConfigure, enabled, normaliseRule, rules, savingConfig]);

  const loadAssignableStaff = useCallback(() => {
    if (staffLoading || staffOptions.length) return;
    setStaffLoading(true);
    setStaffError(null);
    apiFetch('/api/staff/assignable')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(list => {
        const options = (Array.isArray(list) ? list : []).map(entry => ({
          label: entry.email || entry.display_name || String(entry.id || 'Staff'),
          value: String(entry.id || entry.email || entry.display_name || 'unknown'),
          email: entry.email || null,
          role: entry.role || null,
          display_name: entry.display_name || null
        }));
        setStaffOptions(options);
      })
      .catch(err => {
        console.error('[auto-assignment] failed to load staff', err);
        setStaffError('Unable to load assignable staff right now.');
      })
      .finally(() => setStaffLoading(false));
  }, [staffLoading, staffOptions.length]);

  useEffect(() => {
    if (modalVisible) {
      loadAssignableStaff();
    }
  }, [modalVisible, loadAssignableStaff]);

  useEffect(() => {
    loadAssignableStaff();
  }, [loadAssignableStaff]);

  useEffect(() => {
    loadAssignableStaff();
  }, [loadAssignableStaff]);

  const resolveAssigneeLabel = useCallback((rule) => {
    if (rule?.assignee) return rule.assignee;
    if (rule?.assigneeId) {
      const match = staffOptions.find(opt => String(opt.value) === String(rule.assigneeId));
      if (match) return match.email || match.label || match.value;
    }
    return '-';
  }, [staffOptions]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          description="Control automatic routing of incoming applications."
          actions={
            <SpaceBetween size="xs" direction="horizontal">
              <Toggle
                disabled={!canConfigure}
                checked={enabled}
                onChange={({ detail }) => setEnabled(detail.checked)}
              >
                {enabled ? 'Automatic assignment: On' : 'Automatic assignment: Off'}
              </Toggle>
              <Button
                variant="primary"
                onClick={handleSaveConfig}
                disabled={!canConfigure || configLoading || !dirty || savingConfig}
                loading={savingConfig}
              >
                Save changes
              </Button>
              {actions?.removeItem ? (
                <ButtonDropdown
                  ariaLabel="Automatic assignment widget settings"
                  variant="icon"
                  items={[{ id: 'remove', text: 'Remove' }]}
                  onItemClick={({ detail }) => {
                    if (detail.id === 'remove') {
                      handleRemove();
                    }
                  }}
                />
              ) : null}
            </SpaceBetween>
          }
        >
          Automatic Assignment
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
    >
      <SpaceBetween size="s">
        {!canConfigure && (
          <StatusIndicator type="stopped">
            Only System Administrators and NWAC Administrators can configure automatic assignment.
          </StatusIndicator>
        )}
        {configLoading && <StatusIndicator type="loading">Loading configuration</StatusIndicator>}
        {configError && <Alert type="error">{configError}</Alert>}
        {saveInfo && <StatusIndicator type="success">{saveInfo}</StatusIndicator>}

        <Table
            columnDefinitions={[
              { id: 'label', header: 'Rule name', cell: r => (
                <Button
                  variant="inline-link"
                  onClick={() => openRuleModal(r)}
                  disabled={!canConfigure}
                >
                  {r.label}
                </Button>
              ), isRowHeader: true, minWidth: 200 },
              { id: 'when', header: 'When (matcher)', cell: r => summariseConditions(r.conditions), minWidth: 260 },
              { id: 'then', header: 'Then (assign to)', cell: r => resolveAssigneeLabel(r), minWidth: 220 },
              { id: 'priority', header: 'Priority', cell: r => r.priority, minWidth: 80 },
              {
                id: 'actions',
                header: 'Actions',
                minWidth: 120,
                cell: r => (
                  <Button
                    variant="link"
                    iconName="remove"
                    disabled={!canConfigure}
                    onClick={() => handleDelete(r.id)}
                  >
                    Delete
                  </Button>
                )
              }
            ]}
            items={filteredRules}
            sortingDisabled
            trackBy="id"
            empty={<Box variant="p">No rules defined.</Box>}
            header={
              <Header
                variant="h3"
                actions={
                  <Button disabled={!canConfigure} iconName="add-plus" onClick={() => openRuleModal(null)}>
                    Add rule
                  </Button>
                }
              >
                Automatic assignment rules
              </Header>
            }
          />

          <Modal
            visible={modalVisible}
            onDismiss={() => { if (!modalWorking) { setModalVisible(false); setEditingRule(null); setFormError(null); } }}
            header={editingRule ? 'Edit rule' : 'Add rule'}
            footer={
              <SpaceBetween direction="horizontal" size="xs">
                <Button onClick={() => { if (!modalWorking) { setModalVisible(false); setEditingRule(null); setFormError(null); } }} disabled={modalWorking}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={handleSaveRule} disabled={!canConfigure || modalWorking}>
                  Save rule
                </Button>
              </SpaceBetween>
            }
          >
            <SpaceBetween size="s">
              {formError && <Alert type="error">{formError}</Alert>}
              <FormField label="Rule name" stretch>
                <Input
                  value={formState.label}
                  disabled={!canConfigure || modalWorking}
                  onChange={({ detail }) => setFormState(current => ({ ...current, label: detail.value }))}
                />
              </FormField>
              <FormField label="When (conditions)" stretch description="Add one or more matchers. 'Always' matches every application.">
                <SpaceBetween size="xs">
                  {formState.conditions.map(cond => (
                    <ColumnLayout key={cond.id} columns={4} minColumnWidth={160}>
                      <Select
                        selectedOption={conditionOptions.find(o => o.value === cond.field) || conditionOptions[0]}
                        options={conditionOptions}
                        disabled={!canConfigure || modalWorking}
                        onChange={({ detail }) => updateCondition(cond.id, prev => ({ ...prev, field: detail.selectedOption.value }))}
                      />
                      <Select
                        selectedOption={operatorOptions.find(o => o.value === cond.op) || operatorOptions[0]}
                        options={operatorOptions}
                        disabled={!canConfigure || modalWorking}
                        onChange={({ detail }) => updateCondition(cond.id, prev => ({ ...prev, op: detail.selectedOption.value }))}
                      />
                      <Multiselect
                        placeholder="Select values"
                        selectedOptions={(Array.isArray(cond.value) ? cond.value : []).map(val => {
                          const opts = getValueOptions(cond.field);
                          return opts.find(o => o.value === val) || { label: val, value: val };
                        })}
                        options={getValueOptions(cond.field)}
                        disabled={!canConfigure || modalWorking || cond.op === 'exists' || cond.op === 'always'}
                        onChange={({ detail }) => updateCondition(cond.id, prev => ({ ...prev, value: (detail.selectedOptions || []).map(o => o.value) }))}
                      />
                      <Button
                        iconName="close"
                        variant="icon"
                        disabled={!canConfigure || modalWorking}
                        onClick={() => removeConditionRow(cond.id)}
                        ariaLabel="Remove condition"
                      />
                    </ColumnLayout>
                  ))}
                  <Button onClick={addConditionRow} disabled={!canConfigure || modalWorking} iconName="add-plus">
                    Add condition
                  </Button>
                </SpaceBetween>
              </FormField>
              <FormField
                label="Then (assign to)"
                stretch
                description="Pick from assignable staff."
                errorText={staffError}
              >
                <Select
                  placeholder="Select assignee"
                  selectedOption={formState.assigneeOption}
                  options={staffOptions}
                  loading={staffLoading}
                  disabled={!canConfigure || modalWorking}
                  onChange={({ detail }) => setFormState(current => ({ ...current, assigneeOption: detail.selectedOption }))}
                />
              </FormField>
              <FormField label="Priority" stretch description="Lower numbers run first">
                <Input
                  inputMode="numeric"
                  type="number"
                  value={String(formState.priority)}
                  disabled={!canConfigure || modalWorking}
                  onChange={({ detail }) => setFormState(current => ({ ...current, priority: detail.value }))}
                />
              </FormField>
            </SpaceBetween>
          </Modal>
      </SpaceBetween>
    </BoardItem>
  );
};

export default AutoAssignmentConfigWidget;
