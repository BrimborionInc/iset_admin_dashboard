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

const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, ''); // retained for any absolute path needs

// No key/value component needed; using FormField with disabled inputs for read-only fields.

export default function WorkflowPropertiesWidget({ workflow, onWorkflowUpdated, actions, toggleHelpPanel }) {
  const [nameValue, setNameValue] = useState('');
  const [statusValue, setStatusValue] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type, text }

  useEffect(() => {
    if (workflow) {
      setNameValue(workflow.name || '');
      setStatusValue(workflow.status || 'draft');
      setAlert(null);
    } else {
      setNameValue('');
      setStatusValue('draft');
      setAlert(null);
    }
  }, [workflow]);

  const statusColor =
    statusValue === 'active' ? 'success' : statusValue === 'inactive' ? 'stopped' : 'info';

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

  const isDirty =
    !!workflow &&
    ((nameValue || '') !== (workflow.name || '') ||
      (statusValue || '') !== (workflow.status || ''));

  const onCancel = () => {
    if (!workflow) return;
    setNameValue(workflow.name || '');
    setStatusValue(workflow.status || 'draft');
    setAlert(null);
  };

  const onPublish = async () => {
    if (!workflow) { setAlert({ type: 'warning', text: 'No workflow selected.' }); return; }
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
              <Button onClick={onPublish} disabled={!workflow} iconAlign="right">
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
          <ColumnLayout columns={5} variant="text-grid">
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
