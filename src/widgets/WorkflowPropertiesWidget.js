import React, { useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  ButtonDropdown,
  SpaceBetween,
  Input,
  Select,
  Alert,
  Button,
  FormField,
  ColumnLayout,
  Badge,
  Link
} from '@cloudscape-design/components';
import { apiFetch } from '../auth/apiClient';
import WorkflowPropertiesWidgetHelp from '../helpPanelContents/workflowPropertiesWidgetHelp';

// No key/value component needed; using FormField with disabled inputs for read-only fields.

export default function WorkflowPropertiesWidget({ workflow, onWorkflowUpdated, actions, toggleHelpPanel }) {
  const [nameValue, setNameValue] = useState('');
  const [statusValue, setStatusValue] = useState('draft');
  const [typeValue, setTypeValue] = useState('main-intake');
  const [saving, setSaving] = useState(false);
  const [docTypeValue, setDocTypeValue] = useState('');
  const [docTypeOptions, setDocTypeOptions] = useState([{ label: 'Select document type', value: '' }]);
  const [alert, setAlert] = useState(null); // { type, text }

  const normalizeType = (raw) => {
    const val = (raw || '').trim();
    if (val === 'intake-application') return 'main-intake';
    if (val === 'signature-request' || val === 'attachment-request') return 'consent-no-prefill';
    if (['main-intake', 'consent-no-prefill', 'consent-cm-prefill'].includes(val)) return val;
    return 'main-intake';
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await apiFetch('/api/document-types');
        if (!resp.ok) return;
        const data = await resp.json();
        if (cancelled) return;
        const opts = Array.isArray(data?.items)
          ? data.items
              .filter(d => d && d.code)
              .map(d => ({ value: d.code, label: d.label || d.code }))
          : [];
        const list = [{ label: 'Select document type', value: '' }, ...opts];
        setDocTypeOptions(list);
      } catch (e) {
        // fallback to default option only
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (workflow) {
      setNameValue(workflow.name || '');
      setStatusValue(workflow.status || 'draft');
      setTypeValue(normalizeType(workflow.workflow_type || workflow.workflowType || 'main-intake'));
      setDocTypeValue(workflow.document_type || workflow.documentType || '');
      setAlert(null);
    } else {
      setNameValue('');
      setStatusValue('draft');
      setTypeValue('main-intake');
      setDocTypeValue('');
      setAlert(null);
    }
  }, [workflow]);

  const statusOptions = useMemo(
    () => [
      { label: 'draft', value: 'draft' },
      { label: 'active', value: 'active' },
      { label: 'inactive', value: 'inactive' }
    ],
    []
  );

  const selectedStatus = useMemo(
    () =>
      statusOptions.find(o => o.value === statusValue) || { label: statusValue, value: statusValue },
    [statusOptions, statusValue]
  );

  const typeOptions = useMemo(
    () => [
      { label: 'Main Intake', value: 'main-intake' },
      { label: 'Form (No prefill)', value: 'consent-no-prefill' },
      { label: 'Form (CM prefill)', value: 'consent-cm-prefill' }
    ],
    []
  );

  const selectedType = useMemo(
    () =>
      typeOptions.find(o => o.value === typeValue) || { label: typeValue, value: typeValue },
    [typeOptions, typeValue]
  );

  const selectedDocType = useMemo(
    () =>
      docTypeOptions.find(o => o.value === docTypeValue) || docTypeOptions[0],
    [docTypeOptions, docTypeValue]
  );

  const isDirty =
    !!workflow &&
    ((nameValue || '') !== (workflow.name || '') ||
      (statusValue || '') !== (workflow.status || '') ||
      (typeValue || '') !== normalizeType(workflow.workflow_type || workflow.workflowType || 'main-intake') ||
      (docTypeValue || '') !== (workflow.document_type || workflow.documentType || ''));

  useEffect(() => {
    if (typeValue === 'main-intake') {
      setDocTypeValue('');
    }
  }, [typeValue]);

  const onCancel = () => {
    if (!workflow) return;
    setNameValue(workflow.name || '');
    setStatusValue(workflow.status || 'draft');
    setTypeValue(normalizeType(workflow.workflow_type || workflow.workflowType || 'main-intake'));
    setDocTypeValue(workflow.document_type || workflow.documentType || '');
    setAlert(null);
  };

  const onPublish = async () => {
    if (!workflow) { setAlert({ type: 'warning', text: 'No workflow selected.' }); return; }
    if (typeValue !== 'main-intake') {
      setAlert({ type: 'warning', text: 'Publish is only available for Main Intake workflows.' });
      return;
    }
    try {
      setSaving(true);
      setAlert(null);
      const resp = await apiFetch(`/api/workflows/${workflow.id}/publish`, { method: 'POST' });
      if (!resp.ok) throw new Error(`Publish failed: ${resp.status}`);
      const data = await resp.json();
      const publishedSteps = Number.isFinite(data?.steps)
        ? data.steps
        : Array.isArray(data?.steps)
          ? data.steps.length
          : stepsCount;
      setAlert({ type: 'success', text: `Published (${publishedSteps} steps).` });
    } catch (e) {
      setAlert({ type: 'error', text: 'Publish failed.' });
    } finally {
      setSaving(false);
    }
  };

  const onSave = async () => {
    if (!workflow) { setAlert({ type: 'warning', text: 'No workflow selected.' }); return; }
    if (!isDirty) { setAlert({ type: 'info', text: 'No changes to save.' }); return; }
    try {
      setSaving(true);
      setAlert(null);
      const steps = Array.isArray(workflow.steps) ? workflow.steps.map(s => s.id) : [];
      const start = (workflow.steps || []).find(s => s.is_start);
      const routes = Array.isArray(workflow.routes) ? workflow.routes : [];
      const payload = {
        name: nameValue || 'Untitled Workflow',
        status: statusValue || 'draft',
        workflow_type: typeValue || 'main-intake',
        document_type: typeValue === 'main-intake' ? null : (docTypeValue || null),
        steps,
        start_step_id: start ? start.id : null,
        routes
      };
      const saveResp = await apiFetch(`/api/workflows/${workflow.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!saveResp.ok) throw new Error(`Save failed: ${saveResp.status}`);
      setAlert({ type: 'success', text: 'Saved.' });
      try {
        const wfResp = await apiFetch(`/api/workflows/${workflow.id}`);
        if (wfResp.ok) {
          const data = await wfResp.json();
            onWorkflowUpdated && onWorkflowUpdated(data);
        }
      } catch {}
    } catch (e) {
      setAlert({ type: 'error', text: 'Save failed.' });
    } finally {
      setSaving(false);
    }
  };

  const stepsCount = Array.isArray(workflow?.steps) ? workflow.steps.length : 0;
  const headerCounter = workflow ? `(${stepsCount} steps)` : undefined;

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          counter={headerCounter}
          info={<Link variant="info" onClick={() => toggleHelpPanel && toggleHelpPanel(<WorkflowPropertiesWidgetHelp />, 'Workflow Properties')}>Info</Link>}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              {isDirty && <Badge color="blue">Unsaved</Badge>}
              <Button onClick={onPublish} disabled={!workflow || typeValue !== 'main-intake'} iconAlign="right">
                Publish
              </Button>
              <Button onClick={onCancel} disabled={!isDirty || !workflow}>
                Cancel
              </Button>
              <Button variant="primary" loading={saving} onClick={onSave} disabled={!isDirty || !workflow}>
                Save
              </Button>
            </SpaceBetween>
          }
        >
          Workflow Properties
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription:
          'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription:
          'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
  settings={<ButtonDropdown items={[{ id: 'remove', text: 'Remove' }]} ariaLabel="Board item settings" variant="icon" onItemClick={() => actions && actions.removeItem && actions.removeItem()} />}
    >
      <SpaceBetween size="l">
        {alert && (
          <Alert
            dismissible
            onDismiss={() => setAlert(null)}
            type={alert.type}
            header={alert.type === 'error' ? 'Error' : alert.type === 'success' ? 'Success' : undefined}
          >
            {alert.text}
          </Alert>
        )}

        {!workflow && <div style={{ color: '#888' }}>Select a workflow to see details</div>}

        {workflow && (
          <ColumnLayout columns={6} variant="text-grid">
            <FormField
              label="Name"
              description="Display name shown to administrators"
              constraintText="1–120 characters"
            >
              <Input
                value={nameValue}
                onChange={({ detail }) => setNameValue(detail.value)}
                maxLength={120}
                placeholder="Enter workflow name"
              />
            </FormField>
            <FormField
              label="Status"
              description="Lifecycle state (draft = editable)"
              constraintText="draft | active | inactive"
            >
              <Select
                selectedOption={selectedStatus}
                onChange={({ detail }) => setStatusValue(detail.selectedOption?.value || 'draft')}
                options={statusOptions}
                placeholder="Select status"
              />
          </FormField>
          <FormField
            label="Type"
            description="Workflow type"
          >
            <Select
              selectedOption={selectedType}
              onChange={({ detail }) => setTypeValue(detail.selectedOption?.value || 'main-intake')}
              options={typeOptions}
              placeholder="Select type"
            />
          </FormField>
          <FormField
            label="Document type"
            description="Used for generated artifacts and checklist categorization"
          >
            <Select
              selectedOption={selectedDocType}
              onChange={({ detail }) => setDocTypeValue(detail.selectedOption?.value || '')}
              options={docTypeOptions}
              placeholder="Select document type"
              disabled={typeValue === 'main-intake'}
            />
          </FormField>
          <FormField
            label="Steps"
            description="Total steps in this workflow"
            constraintText="Read-only"
          >
              <Input value={String(stepsCount)} disabled />
            </FormField>
            <FormField
              label="Created"
              description="Creation timestamp"
              constraintText="Local time"
            >
              <Input
                value={workflow.created_at ? new Date(workflow.created_at).toLocaleString() : '—'}
                disabled
              />
            </FormField>
            <FormField
              label="Updated"
              description="Last modification"
              constraintText="Local time"
            >
              <Input
                value={workflow.updated_at ? new Date(workflow.updated_at).toLocaleString() : '—'}
                disabled
              />
            </FormField>
          </ColumnLayout>
        )}
      </SpaceBetween>
    </BoardItem>
  );
}
