import React, { useEffect, useState, useMemo } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  ButtonDropdown,
  SpaceBetween,
  Box,
  Spinner,
  Tabs,
  StatusIndicator,
  Button
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import CopyToClipboard from '@cloudscape-design/components/copy-to-clipboard';
import { apiFetch } from '../auth/apiClient';

const API_BASE = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

export default function WorkflowRuntimeSchemaWidget({ selectedWorkflow, actions }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { steps, meta }
  const [expandedStep, setExpandedStep] = useState(null);
  const [showJson, setShowJson] = useState(false);

  // Auto-load when workflow changes
  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!selectedWorkflow) { setPreview(null); setError(null); return; }
      setLoading(true); setError(null);
      try {
        const resp = await apiFetch(`/api/workflows/${selectedWorkflow.id}/preview`);
        if (!cancelled) {
          if (resp.ok) {
            const data = await resp.json();
            setPreview(data);
          } else {
            setError('Failed to load preview');
          }
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load preview');
      } finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedWorkflow?.id]);

  const steps = preview?.steps || [];
  const meta = preview?.meta || null;

  const componentsCount = useMemo(() => steps.reduce((a, s) => a + (s.components?.length || 0), 0), [steps]);

  const headerCounter = selectedWorkflow ? `(${steps.length} steps / ${componentsCount} components)` : undefined;

  const jsonText = useMemo(() => preview ? JSON.stringify(preview, null, 2) : '', [preview]);

  return (
    <BoardItem
      header={
        <Header
          variant="h2"
          counter={headerCounter}
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button disabled={!preview} onClick={() => setShowJson(s => !s)}>{showJson ? 'Hide JSON' : 'Show JSON'}</Button>
            </SpaceBetween>
          }
        >
          Runtime Schema
        </Header>
      }
      i18nStrings={{
        dragHandleAriaLabel: 'Drag handle',
        dragHandleAriaDescription: 'Use Space or Enter to activate drag, arrow keys to move, Space or Enter to drop.',
        resizeHandleAriaLabel: 'Resize handle',
        resizeHandleAriaDescription: 'Use Space or Enter to activate resize, arrow keys to resize, Space or Enter to finish.'
      }}
      settings={<ButtonDropdown items={[{ id: 'remove', text: 'Remove' }]} ariaLabel="Board item settings" variant="icon" onItemClick={() => actions?.removeItem && actions.removeItem()} />}
    >
      <Box>
        {!selectedWorkflow && <Box color="text-status-inactive">Select a workflow to view runtime schema</Box>}
        {selectedWorkflow && loading && <Spinner />}
        {selectedWorkflow && error && <StatusIndicator type="error">{error}</StatusIndicator>}
        {selectedWorkflow && !loading && !error && preview && (
          <SpaceBetween size="m">
            {meta && (
              <Box variant="awsui-key-label">Schema v{meta.schemaVersion} • Generated {new Date(meta.generatedAt).toLocaleString()}</Box>
            )}
            <div style={{ maxHeight: showJson ? 240 : 160, overflow: 'auto', border: '1px solid #e0e0e0', padding: 8, borderRadius: 4, background: '#fafafa' }}>
              {steps.map((s, idx) => (
                <div key={s.stepId} style={{ marginBottom: 8 }}>
                  <strong style={{ cursor: 'pointer' }} onClick={() => setExpandedStep(es => es === s.stepId ? null : s.stepId)}>
                    {idx + 1}. {s.title?.en || s.stepId}
                  </strong>
                  <span style={{ marginLeft: 6, color: '#555' }}>({s.components?.length || 0} components{ s.nextStepId ? ` → ${s.nextStepId}` : ''})</span>
                  {expandedStep === s.stepId && (
                    <ul style={{ margin: '4px 0 4px 16px', padding: 0 }}>
                      {(s.components || []).map(c => (
                        <li key={c.id} style={{ fontSize: 12 }}>
                          <code>{c.type}</code> <span style={{ color: '#555' }}>{c.label?.en}</span>{c.storageKey ? ` [${c.storageKey}]` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {showJson && (
              <CodeView
                content={jsonText}
                language="json"
                lineNumbers
                wrapLines
                ariaLabel="Workflow runtime JSON"
                actions={
                  <CopyToClipboard
                    copyButtonAriaLabel="Copy workflow JSON"
                    copyErrorText="Copy failed"
                    copySuccessText="Copied"
                    textToCopy={jsonText}
                  />
                }
              />
            )}
          </SpaceBetween>
        )}
      </Box>
    </BoardItem>
  );
}
