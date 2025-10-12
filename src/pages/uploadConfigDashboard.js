import React, { useEffect, useState, useCallback } from 'react';
import { Box, SpaceBetween, Header, Button, FormField, Input, Multiselect, Toggle, StatusIndicator, ColumnLayout, Alert, Badge, Table, Link } from '@cloudscape-design/components';
import { Board, BoardItem } from '@cloudscape-design/board-components';
import { apiFetch } from '../auth/apiClient';

function useUploadConfig() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [effective, setEffective] = useState(null); // { policy, infra }
  const [audit, setAudit] = useState([]);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await apiFetch('/api/admin/upload-config');
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Failed to load');
      setEffective({ policy: j.policy, infra: j.infra, loadedAt: j.loadedAt });
      setAudit(j.audit || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  return { loading, error, effective, audit, reload: load };
}

export default function UploadConfigDashboard({ toggleHelpPanel }) {
  const { loading, error, effective, audit, reload } = useUploadConfig();
  // Board layout: no tabs; sections rendered simultaneously
  const [policyEdits, setPolicyEdits] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Initialize edits when effective changes
  useEffect(() => {
    if (effective?.policy) {
      setPolicyEdits(effective.policy);
    }
  }, [effective]);

  useEffect(() => { reload(); }, [reload]);

  const dirty = policyEdits && effective?.policy && JSON.stringify(policyEdits) !== JSON.stringify(effective.policy);

  async function savePolicy() {
    if (!dirty || !policyEdits) return;
    setSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const res = await apiFetch('/api/admin/upload-config', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(policyEdits) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Update failed');
      setSaveSuccess(true);
      // Merge response (policy, infra)
      setPolicyEdits(j.policy);
      reload();
    } catch(e) { setSaveError(e.message); }
    finally { setSaving(false); }
  }

  function discard() {
    if (effective?.policy) setPolicyEdits(effective.policy);
  }

  function updateField(field, value) {
    setPolicyEdits(p => ({ ...p, [field]: value }));
  }

  function updateAllowedMime(options) {
    setPolicyEdits(p => ({ ...p, allowedMime: options.map(o => o.value) }));
  }

  function policySection() {
    if (!policyEdits) return <StatusIndicator type={loading ? 'loading':'stopped'}>{loading ? 'Loading':'No data'}</StatusIndicator>;
    const mimeOptions = policyEdits.allowedMime.map(m => ({ label: m, value: m }));
    const sizeWarn = policyEdits.maxSizeMB > 200;
    const thresholdWarn = policyEdits.multipartThresholdMB >= policyEdits.maxSizeMB;
    return (
      <SpaceBetween size="s">
        <ColumnLayout columns={4} variant="text-grid">
          <FormField label="Uploads Enabled" description="Toggle entire upload feature">
            <Toggle checked={policyEdits.enabled} onChange={e => updateField('enabled', e.detail.checked)}>Enabled</Toggle>
          </FormField>
          <FormField label="Max Size (MB)" description="Hard per-file cap">
            <Input type="number" value={String(policyEdits.maxSizeMB)} onChange={e => updateField('maxSizeMB', Number(e.detail.value)||0)} />
          </FormField>
          <FormField label="Multipart Threshold (MB)" description="S3 multipart switch-over">
            <Input type="number" value={String(policyEdits.multipartThresholdMB)} onChange={e => updateField('multipartThresholdMB', Number(e.detail.value)||0)} />
          </FormField>
          <FormField label="Retention (Days)" description="Used for cleanup jobs">
            <Input type="number" value={String(policyEdits.retentionDays)} onChange={e => updateField('retentionDays', Number(e.detail.value)||0)} />
          </FormField>
        </ColumnLayout>
        <FormField label="Allowed MIME Types" description="Whitelist enforced at presign + finalize">
          <Multiselect
            selectedOptions={policyEdits.allowedMime.map(m => ({ label: m, value: m }))}
            options={mimeOptions}
            onChange={e => updateAllowedMime(e.detail.selectedOptions)}
            placeholder="Add or remove MIME types"
            tokenLimit={20}
          />
        </FormField>
        <FormField label="Scan Required" description="Require clean scan before usable (future AV)">
          <Toggle checked={policyEdits.scanRequired} onChange={e => updateField('scanRequired', e.detail.checked)}>Scan Required</Toggle>
        </FormField>
        {sizeWarn && <Alert type="warning" header="Large max size">Files over 200MB may degrade performance without multipart & streaming.</Alert>}
        {thresholdWarn && <Alert type="warning" header="Threshold >= Max Size">Multipart threshold should be lower than max size.</Alert>}
        <SpaceBetween direction="horizontal" size="xs">
          <Button variant="primary" disabled={!dirty || saving} loading={saving} onClick={savePolicy}>Save</Button>
          <Button variant="link" disabled={!dirty || saving} onClick={discard}>Discard</Button>
          {dirty && <Badge color="blue">Unsaved Changes</Badge>}
          {saveSuccess && !dirty && <StatusIndicator type="success">Saved</StatusIndicator>}
          {saveError && <StatusIndicator type="error">{saveError}</StatusIndicator>}
        </SpaceBetween>
      </SpaceBetween>
    );
  }

  function infraSection() {
    if (!effective?.infra) return <StatusIndicator type={loading ? 'loading':'stopped'}>{loading ? 'Loading':'No infra'}</StatusIndicator>;
    const infra = effective.infra;
    return (
      <SpaceBetween size="s">
        <ColumnLayout columns={3} variant="text-grid">
          <FormField label="Mode"><Box>{infra.mode}</Box></FormField>
          <FormField label="Driver"><Box>{infra.driver}</Box></FormField>
          <FormField label="Bucket"><Box>{infra.bucket || '—'}</Box></FormField>
          <FormField label="Region"><Box>{infra.region || '—'}</Box></FormField>
          <FormField label="Endpoint"><Box style={{wordBreak:'break-all'}}>{infra.endpoint || '—'}</Box></FormField>
          <FormField label="Force Path Style"><StatusIndicator type={infra.forcePathStyle ? 'success':'stopped'}>{String(infra.forcePathStyle)}</StatusIndicator></FormField>
          <FormField label="Key Prefix"><Box>{infra.keyPrefix || '(none)'}</Box></FormField>
          {infra.maxUploadEnvCapMB && <FormField label="Env Max Cap (MB)"><Box>{infra.maxUploadEnvCapMB}</Box></FormField>}
        </ColumnLayout>
        <Alert type="info" header="Immutable Infrastructure">
          These values are environment-provisioned. Change via deployment variables, not the dashboard.
        </Alert>
      </SpaceBetween>
    );
  }

  function scanningSection() {
    if (!policyEdits) return <StatusIndicator type={loading ? 'loading':'stopped'}>{loading ? 'Loading':'No data'}</StatusIndicator>;
    return (
      <SpaceBetween size="s">
        <Alert type="info" header="Antivirus Roadmap">Real AV integration pending. Current flag gates future workflow.</Alert>
        <FormField label="Scan Required">
          <Toggle checked={policyEdits.scanRequired} onChange={e => updateField('scanRequired', e.detail.checked)}>Scan Required</Toggle>
        </FormField>
      </SpaceBetween>
    );
  }

  function retentionSection() {
    if (!policyEdits) return <StatusIndicator type={loading ? 'loading':'stopped'}>{loading ? 'Loading':'No data'}</StatusIndicator>;
    const high = policyEdits.retentionDays > 365;
    const low = policyEdits.retentionDays < 7;
    return (
      <SpaceBetween size="s">
        <FormField label="Retention Days" description="Automatic cleanup policy horizon">
          <Input type="number" value={String(policyEdits.retentionDays)} onChange={e => updateField('retentionDays', Number(e.detail.value)||0)} />
        </FormField>
        {high && <Alert type="info" header="High Retention">Over one year retention may increase storage costs.</Alert>}
        {low && <Alert type="warning" header="Very Low Retention">Under 7 days could remove in-progress documents.</Alert>}
      </SpaceBetween>
    );
  }

  function auditSection() {
    return (
      <Table
        variant="embedded"
        columnDefinitions={[
          { id:'time', header:'Time', cell: r => new Date(r.created_at).toLocaleString() },
          { id:'actor', header:'Actor', cell: r => r.actor || '—' },
          { id:'diff', header:'Changed Fields', cell: r => r.diff_summary || '—' }
        ]}
        items={audit}
        loading={loading}
        loadingText="Loading audit"
        empty={<Box fontSize="body-s" color="text-status-inactive">No recent changes</Box>}
        header={<Header variant="h3" actions={<Button iconName="refresh" onClick={reload}>Refresh</Button>}>Recent Changes</Header>}
      />
    );
  }

  // Board layout consistent with configurationSettings
  const defaultItems = React.useMemo(() => ([
    { id: 'policy', columnSpan: 2, rowSpan: 4, data: { type: 'policy' } },
    { id: 'retention', columnSpan: 2, rowSpan: 3, data: { type: 'retention' } },
    { id: 'scanning', columnSpan: 2, rowSpan: 3, data: { type: 'scanning' } },
    { id: 'infra', columnSpan: 2, rowSpan: 4, data: { type: 'infra' } },
    { id: 'audit', columnSpan: 2, rowSpan: 4, data: { type: 'audit' } }
  ]), []);
  const [items, setItems] = useState(defaultItems);

  function renderContent(type) {
    switch(type) {
      case 'policy': return policySection();
      case 'retention': return retentionSection();
      case 'scanning': return scanningSection();
      case 'infra': return infraSection();
      case 'audit': return auditSection();
      default: return <Box>Unknown</Box>;
    }
  }

  const boardI18n = {
    empty: 'No widgets',
    loading: 'Loading',
    columnAriaLabel: i => `Column ${i + 1}`,
    itemPositionAnnouncement: e => {
      const { currentIndex, currentColumn, currentRow } = e;
      return `Item moved to position ${currentIndex + 1}, column ${currentColumn + 1}, row ${currentRow + 1}`;
    },
    liveAnnouncementDndStarted: e => `Picked up item at position ${e.position + 1}.`,
    liveAnnouncementDndItemReordered: e => `Item moved from position ${e.initialPosition + 1} to ${e.currentPosition + 1}.`,
    liveAnnouncementDndItemResized: e => `Item resized to ${e.size.width} by ${e.size.height}.`,
    liveAnnouncementDndItemInserted: e => `Item inserted at position ${e.position + 1}.`,
    liveAnnouncementDndCommitted: e => `Drag and drop committed. Final position ${e.finalPosition != null ? e.finalPosition + 1 : 'unchanged'}.`,
    liveAnnouncementDndDiscarded: () => 'Drag and drop canceled.',
    liveAnnouncementItemRemoved: e => `Removed item at position ${e.position + 1}.`,
  };
  const boardItemI18n = {
    dragHandleAriaLabel: 'Drag handle',
    dragHandleAriaDescription: 'Press Space or Enter to start dragging the widget',
    dragHandleAriaDescriptionInactive: 'Drag not active',
    resizeHandleAriaLabel: 'Resize handle',
    resizeHandleAriaDescription: 'Press Space or Enter to start resizing the widget',
    resizeHandleAriaDescriptionInactive: 'Resize not active',
    removeItemAriaLabel: 'Remove widget',
    editItemAriaLabel: 'Edit widget',
    dragInactiveItemAriaLabel: 'Draggable widget',
    dragActiveItemAriaLabel: 'Dragging widget',
    resizeInactiveItemAriaLabel: 'Resizable widget',
    resizeActiveItemAriaLabel: 'Resizing widget'
  };

  const widgetHelp = {
    policy: 'Manage upload enablement, size caps, MIME allowlist, scan flag, multipart threshold.',
    retention: 'Configure how long uploaded files are retained before eligible for cleanup.',
    scanning: 'Toggle future antivirus scanning requirement (currently advisory).',
    infra: 'Read-only infrastructure parameters sourced from environment variables.',
    audit: 'Recent configuration change history captured with actor and changed fields.'
  };

  return (
      <SpaceBetween size="l">
        {error && <Alert type="error" header="Load Error">{error}</Alert>}
        <Board
        items={items}
        renderItem={(item, actions) => (
          <BoardItem
            header={
              <Header
                variant="h2"
                description={widgetHelp[item.data.type]}
                info={<Link variant="info" onFollow={e => { e.preventDefault(); toggleHelpPanel && toggleHelpPanel(widgetHelp[item.data.type], 'File Upload Configuration'); }}>Info</Link>}
                actions={(() => {
                  if (item.id === 'policy') {
                    return (
                      <SpaceBetween direction="horizontal" size="xs">
                        {dirty && <Badge color="blue">Unsaved</Badge>}
                        <Button iconName="save" variant="inline-icon" ariaLabel="Save policy" disabled={!dirty || saving} onClick={savePolicy} />
                        <Button iconName="undo" variant="inline-icon" ariaLabel="Discard policy" disabled={!dirty || saving} onClick={discard} />
                      </SpaceBetween>
                    );
                  }
                  if (item.id === 'audit') {
                    return <Button iconName="refresh" variant="inline-icon" ariaLabel="Refresh audit" onClick={reload} />;
                  }
                  if (item.id === 'infra') {
                    return <Badge color="grey">Read-only</Badge>;
                  }
                  return null;
                })()}
              >
                {item.id === 'policy' ? 'Policy' : item.id === 'retention' ? 'Retention' : item.id === 'scanning' ? 'Scanning' : item.id === 'infra' ? 'Infrastructure' : item.id === 'audit' ? 'Audit' : item.id}
              </Header>
            }
            i18nStrings={boardItemI18n}
            {...actions}
          >
            {renderContent(item.data.type)}
          </BoardItem>
        )}
        onItemsChange={e => {
          const seen = new Set();
          const deduped = [];
          for (const it of e.detail.items) {
            if (!seen.has(it.id)) { seen.add(it.id); deduped.push(it); }
          }
          setItems(deduped);
        }}
        i18nStrings={boardI18n}
        empty={<Box>No widgets</Box>}
        ariaLabel="File upload configuration board"
        />
        <Box fontSize="body-s" color="text-status-inactive">Last loaded: {effective?.loadedAt ? new Date(effective.loadedAt).toLocaleTimeString() : '—'}</Box>
      </SpaceBetween>
  );
}
