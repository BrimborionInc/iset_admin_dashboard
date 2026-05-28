import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Box,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  Header,
  Link,
  Modal,
  SpaceBetween,
  StatusIndicator,
  Tabs,
  Table,
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import xmlHighlight from '@cloudscape-design/code-view/highlight/xml';
import { apiFetch } from '../../../auth/apiClient';
import { boardItemI18nStrings } from './common';
import './EsdcParticipantHistoryWidget.css';

const formatDateTime = value => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getBatchTimestamp = batch =>
  batch?.downloadedAt ||
  batch?.downloaded_at ||
  batch?.exportedAt ||
  batch?.exported_at ||
  batch?.submittedAt ||
  batch?.submitted_at ||
  null;

const getBatchParticipants = batch =>
  Array.isArray(batch?.participants) ? batch.participants : [];

const getBatchParticipantCount = batch => {
  const explicit = Number(batch?.participantCount ?? batch?.participant_count);
  if (Number.isFinite(explicit)) return explicit;
  return getBatchParticipants(batch).length;
};

const getBatchDownloadPath = batch =>
  batch?.downloadPath ||
  batch?.download_path ||
  null;

const getBatchFileDisplay = batch => {
  const filename = batch?.filename || 'ILMP export file';
  const downloadPath = getBatchDownloadPath(batch);
  if (!downloadPath) return filename;
  const trimmedPath = String(downloadPath).trim();
  if (!trimmedPath) return filename;
  if (trimmedPath.toLowerCase().endsWith(String(filename).toLowerCase())) {
    return trimmedPath;
  }
  const separator = trimmedPath.includes('\\') && !trimmedPath.includes('/') ? '\\' : '/';
  return `${trimmedPath.replace(/[\\/]+$/, '')}${separator}${filename}`;
};

const getBatchDownloader = batch =>
  batch?.downloadedByDisplayName ||
  batch?.downloaded_by_display_name ||
  batch?.downloadedBy ||
  batch?.downloaded_by ||
  '-';

const EsdcParticipantHistoryWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [activeTabId, setActiveTabId] = useState('summary');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [toast, setToast] = useState(null);

  const selectedBatch = useMemo(
    () => batches.find(entry => entry.batchId === selectedBatchId) || null,
    [batches, selectedBatchId]
  );

  const selectedParticipants = useMemo(
    () => getBatchParticipants(selectedBatch),
    [selectedBatch]
  );

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
        setError(body.error || body.message || 'Failed to load export history.');
        setBatches([]);
        setSelectedBatchId(null);
        return;
      }
      const items = Array.isArray(body.items) ? body.items : [];
      setBatches(items);
      setSelectedBatchId(current => {
        if (!items.length) return null;
        if (current && items.some(item => item.batchId === current)) return current;
        return items[0].batchId;
      });
    } catch (err) {
      setError(err?.message || 'Failed to load export history.');
      setBatches([]);
      setSelectedBatchId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    const handler = () => fetchBatches();
    window.addEventListener('esdcParticipants:refresh', handler);
    return () => window.removeEventListener('esdcParticipants:refresh', handler);
  }, [fetchBatches]);

  const selectBatch = useCallback((batch) => {
    if (!batch?.batchId) return;
    setSelectedBatchId(batch.batchId);
  }, []);

  const openResetModal = useCallback((batch = selectedBatch) => {
    if (!batch?.batchId) return;
    setSelectedBatchId(batch.batchId);
    setShowResetModal(true);
  }, [selectedBatch]);

  const handleMarkPending = useCallback(async () => {
    if (!selectedBatch) return;
    setResetting(true);
    setError(null);
    try {
      const ids = selectedParticipants.map(p => p.submissionId || p.id).filter(Boolean);
      if (!ids.length) {
        throw new Error('No client submission ids found in this export.');
      }
      const resp = await apiFetch('/api/esdc/participants/batch-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        throw new Error(body.error || body.message || 'Failed to requeue clients.');
      }
      setToast({ type: 'success', message: `Requeued ${ids.length} client${ids.length === 1 ? '' : 's'} for export.` });
      setShowResetModal(false);
      await fetchBatches();
      try {
        window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
      } catch (_) {}
    } catch (err) {
      setError(err?.message || 'Failed to requeue clients.');
    } finally {
      setResetting(false);
    }
  }, [selectedBatch, selectedParticipants, fetchBatches]);

  const batchColumns = useMemo(() => [
    {
      id: 'filename',
      header: 'File',
      cell: item => (
        <Button
          variant="inline-link"
          onClick={() => selectBatch(item)}
        >
          {item.filename || 'ILMP export file'}
        </Button>
      )
    },
    {
      id: 'downloadedAt',
      header: 'Downloaded',
      cell: item => formatDateTime(getBatchTimestamp(item))
    },
    {
      id: 'participantCount',
      header: 'Clients exported',
      cell: item => getBatchParticipantCount(item)
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: item => (
        <Button
          variant="inline-link"
          iconName="undo"
          onClick={() => openResetModal(item)}
        >
          Requeue
        </Button>
      )
    }
  ], [openResetModal, selectBatch]);

  const participantColumns = useMemo(() => [
    {
      id: 'participant',
      header: 'Client',
      cell: item => {
        const label = item.participantName || item.participant_name || 'Client';
        const caseId = item.caseId || item.case_id;
        return caseId ? <Link href={`/cases/${caseId}`}>{label}</Link> : label;
      }
    },
    {
      id: 'trackingId',
      header: 'Tracking ID',
      cell: item => item.trackingId || item.tracking_id || '-'
    },
    {
      id: 'state',
      header: 'Export state',
      cell: () => <StatusIndicator type="info">Included in file</StatusIndicator>
    }
  ], []);

  const selectedSummary = selectedBatch ? [
    { label: 'File', value: getBatchFileDisplay(selectedBatch) },
    { label: 'Downloaded', value: formatDateTime(getBatchTimestamp(selectedBatch)) },
    { label: 'Downloaded by', value: getBatchDownloader(selectedBatch) },
    { label: 'Clients exported', value: getBatchParticipantCount(selectedBatch) },
  ] : [];

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
          <Box color={toast.type === 'error' ? 'text-status-error' : 'text-status-success'}>
            {toast.message}
          </Box>
        )}
        <Table
          trackBy="batchId"
          loading={loading}
          loadingText="Loading exports"
          items={batches}
          columnDefinitions={batchColumns}
          stickyHeader
          empty={<Box textAlign="center">No ILMP exports yet.</Box>}
          variant="embedded"
        />

        {selectedBatch && (
          <div className="esdc-export-summary" id="batch-details">
            <div className="esdc-export-summary__title">Selected export</div>
            <Tabs
              activeTabId={activeTabId}
              onChange={({ detail }) => setActiveTabId(detail.activeTabId)}
              tabs={[
                {
                  id: 'summary',
                  label: 'Summary',
                  content: (
                    <div className="esdc-export-summary__grid">
                      {selectedSummary.map(item => (
                        <div className="esdc-export-summary__item" key={item.label}>
                          <div className="esdc-export-summary__label">{item.label}</div>
                          <div className="esdc-export-summary__value">{item.value}</div>
                        </div>
                      ))}
                    </div>
                  )
                },
                {
                  id: 'people',
                  label: 'Clients exported',
                  content: (
                    <Table
                      trackBy="submissionId"
                      columnDefinitions={participantColumns}
                      items={selectedParticipants}
                      variant="embedded"
                      empty={<Box textAlign="center">No clients found in this export.</Box>}
                    />
                  )
                },
                {
                  id: 'xml',
                  label: 'XML',
                  content: selectedBatch?.xml ? (
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
                    <Box color="text-body-secondary">No XML payload recorded for this export.</Box>
                  )
                }
              ]}
            />
          </div>
        )}
      </SpaceBetween>
      <Modal
        visible={showResetModal}
        header="Requeue export"
        closeAriaLabel="Close requeue modal"
        onDismiss={() => setShowResetModal(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setShowResetModal(false)}>Cancel</Button>
            <Button variant="primary" iconName="undo" loading={resetting} onClick={handleMarkPending}>
              Requeue clients
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="s">
          <Box>
            This returns the clients in this export to the ILMP queue so a replacement XML file can be downloaded.
            It does not contact ESDC.
          </Box>
          <Box variant="awsui-key-label">
            File: {selectedBatch?.filename || selectedBatch?.batchId || 'Selected export'}
          </Box>
          <Box variant="awsui-key-label">
            Clients exported: {getBatchParticipantCount(selectedBatch)}
          </Box>
        </SpaceBetween>
      </Modal>
    </BoardItem>
  );
};

export default EsdcParticipantHistoryWidget;
