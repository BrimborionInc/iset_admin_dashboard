import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Button,
  ButtonDropdown,
  Header,
  Link,
  Modal,
  Tabs,
  SpaceBetween,
  StatusIndicator,
  Table,
  CopyToClipboard,
  ColumnLayout,
  KeyValuePairs
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import xmlHighlight from '@cloudscape-design/code-view/highlight/xml';
import { apiFetch } from '../../../auth/apiClient';
import { boardItemI18nStrings } from './common';

const formatDateTime = value => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const EsdcParticipantHistoryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [activeTabId, setActiveTabId] = useState('details');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null);

  const handleSettingsClick = ({ detail }) => {
    if (detail?.id === 'remove' && typeof actions.removeItem === 'function') {
      actions.removeItem();
    }
  };

  const infoLink = metadata?.helpComponent && toggleHelpPanel ? (
    <Link
      variant="info"
      onFollow={event => {
        event.preventDefault();
        const helpContent = React.createElement(metadata.helpComponent);
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Participant history', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch('/api/esdc/participants/batches');
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(body.error || body.message || 'Failed to load batch history.');
        setBatches([]);
        setSelectedBatchId(null);
        return;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      setBatches(items);
      if (items.length && !selectedBatchId) {
        setSelectedBatchId(items[0].batchId);
        setActiveTabId('details');
      } else if (selectedBatchId && !items.some(item => item.batchId === selectedBatchId)) {
        const nextId = items[0]?.batchId || null;
        setSelectedBatchId(nextId);
        setActiveTabId('details');
      }
    } catch (err) {
      setError(err?.message || 'Failed to load batch history.');
      setBatches([]);
      setSelectedBatchId(null);
      setActiveTabId('details');
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    const handler = () => fetchBatches();
    window.addEventListener('esdcParticipants:refresh', handler);
    return () => window.removeEventListener('esdcParticipants:refresh', handler);
  }, [fetchBatches]);

  const selectedBatch = useMemo(
    () => batches.find(entry => entry.batchId === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  useEffect(() => {
    setActiveTabId('details');
  }, [selectedBatchId]);

  const handleMarkPending = useCallback(async () => {
    if (!selectedBatch) return;
    setResetting(true);
    setError(null);
    try {
      const ids = (selectedBatch.participants || []).map(p => p.submissionId || p.id).filter(Boolean);
      if (!ids.length) {
        throw new Error('No participant submission ids found in this batch.');
      }
      const resp = await apiFetch('/api/esdc/participants/batch-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || body.message || 'Failed to mark pending.');
      }
      setToast({ type: 'success', message: `Marked ${ids.length} participants pending.` });
      setShowResetModal(false);
      await fetchBatches();
      try {
        window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
      } catch (_) {}
    } catch (err) {
      setError(err?.message || 'Failed to mark pending.');
    } finally {
      setResetting(false);
    }
  }, [selectedBatch, fetchBatches]);

  const batchColumns = [
    {
      id: 'filename',
      header: 'File',
      cell: item => (
        <SpaceBetween size="xs" direction="vertical">
          <Link
            href={`#batch-${item.batchId}`}
            onFollow={e => {
              e.preventDefault();
              setSelectedBatchId(item.batchId);
              setActiveTabId('details');
              const el = document.getElementById('batch-details');
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
          >
            {item.filename || 'Batch file'}
          </Link>
          <Box variant="awsui-key-label" color="text-label">
            {item.downloadPath || 'Path not provided'}
          </Box>
        </SpaceBetween>
      )
    },
    {
      id: 'submittedAt',
      header: 'Exported',
      cell: item => formatDateTime(item.submittedAt)
    },
    {
      id: 'participantCount',
      header: 'Participants',
      cell: item => item.participantCount ?? 0
    },
    {
      id: 'checksum',
      header: 'Checksum',
      cell: item => item.xmlChecksum ? item.xmlChecksum.slice(0, 12) + '…' : '—'
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => (
        <Link
          href="#"
          onFollow={e => {
            e.preventDefault();
            setSelectedBatchId(item.batchId);
            setActiveTabId('details');
            setShowResetModal(true);
          }}
        >
          Mark pending
        </Link>
      )
    }
  ];

  const participantColumns = [
    {
      id: 'participant',
      header: 'Participant',
      cell: item => (
        <Link href={`/cases/${item.caseId}`}>
          {item.participantName} ({item.trackingId})
        </Link>
      )
    },
    {
      id: 'status',
      header: 'Status',
      cell: item => (
        <StatusIndicator type={item.submissionStatus === 'submitted' ? 'success' : 'info'}>
          {item.submissionStatus || 'submitted'}
        </StatusIndicator>
      )
    }
  ];

  return (
    <BoardItem
      header={(
        <Header
          variant="h2"
          info={infoLink}
          actions={(
            <Button
              iconName="refresh"
              onClick={fetchBatches}
              loading={loading}
            >
              Refresh
            </Button>
          )}
        >
          Recent ILMP exports
        </Header>
      )}
      settings={
        typeof actions.removeItem === 'function'
          ? (
            <ButtonDropdown
              ariaLabel="ILMP exports history settings"
              variant="icon"
              items={[{ id: 'remove', text: 'Remove widget' }]}
              onItemClick={handleSettingsClick}
            />
          )
          : undefined
      }
      i18nStrings={boardItemI18nStrings}
    >
      <SpaceBetween size="m">
        {error && <Box color="text-status-error">{error}</Box>}
        {toast && (
          <Box color="text-status-success">
            {toast.message}
          </Box>
        )}
        <Table
          selectionType="single"
          trackBy="batchId"
          loading={loading}
          items={batches}
          selectedItems={selectedBatch ? [selectedBatch] : []}
          onSelectionChange={({ detail }) => {
            setSelectedBatchId(detail.selectedItems?.[0]?.batchId || null);
            setActiveTabId('details');
          }}
          columnDefinitions={batchColumns}
          resizableColumns
          stickyHeader
          empty={<Box textAlign="center">No batches recorded yet.</Box>}
          variant="container"
        />

        {selectedBatch && (
          <Tabs
            id="batch-details"
            onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
            activeTabId={activeTabId}
            tabs={[
              {
                id: 'details',
                label: 'Batch details',
                content: (
                  <SpaceBetween size="m">
                    <ColumnLayout columns={2} variant="text-grid" minColumnWidth={260}>
                      <KeyValuePairs
                        columns={1}
                        items={[
                          { label: 'Filename', value: selectedBatch.filename || '—' },
                          { label: 'Download path', value: selectedBatch.downloadPath || 'Not provided' },
                          { label: 'Submitted', value: formatDateTime(selectedBatch.submittedAt) },
                        ]}
                      />
                      <KeyValuePairs
                        columns={1}
                        items={[
                          { label: 'Checksum', value: selectedBatch.xmlChecksum || '—' },
                          { label: 'Size', value: typeof selectedBatch.xmlSize === 'number' ? `${selectedBatch.xmlSize} bytes` : '—' },
                          { label: 'Participants', value: selectedBatch.participantCount ?? (selectedBatch.participants?.length ?? 0) }
                        ]}
                      />
                    </ColumnLayout>
                  </SpaceBetween>
                )
              },
              {
                id: 'participants',
                label: 'Participants',
                content: (
                  <Table
                    trackBy="submissionId"
                    columnDefinitions={participantColumns}
                    items={selectedBatch.participants || []}
                    variant="embedded"
                    stickyHeader={false}
                    empty={<Box textAlign="center">No participants found in this batch.</Box>}
                  />
                )
              },
              {
                id: 'xml',
                label: 'XML view',
                content: selectedBatch.xml ? (
                  <CodeView
                    content={selectedBatch.xml}
                    language="xml"
                    wrapLines
                    highlight={xmlHighlight}
                    ariaLabel="Batch XML preview"
                    actions={(
                      <CopyToClipboard
                        copyButtonAriaLabel="Copy batch XML"
                        copyErrorText="Copy failed"
                        copySuccessText="Copied"
                        textToCopy={selectedBatch.xml}
                      />
                    )}
                  />
                ) : (
                  <Box color="text-body-secondary">No XML payload recorded for this batch.</Box>
                )
              }
            ]}
          />
        )}
      </SpaceBetween>
      <Modal
        visible={showResetModal}
        header="Mark batch as pending"
        closeAriaLabel="Close mark pending modal"
        onDismiss={() => setShowResetModal(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="primary" loading={resetting} onClick={handleMarkPending}>
              Mark pending
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="s">
          <Box>
            This will reset all participants in this batch back to pending status so they can be re-exported.
            Continue?
          </Box>
          <Box variant="awsui-key-label">
            Batch: {selectedBatch?.filename || selectedBatch?.batchId || 'Selected batch'}
          </Box>
          <Box variant="awsui-key-label">
            Participants: {selectedBatch?.participantCount ?? (selectedBatch?.participants?.length ?? 0)}
          </Box>
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default EsdcParticipantHistoryWidget;
