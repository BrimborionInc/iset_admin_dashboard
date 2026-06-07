import React, { useMemo, useState } from 'react';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Alert,
  Box,
  Button,
  ButtonDropdown,
  CopyToClipboard,
  ExpandableSection,
  Header,
  Link,
  Modal,
  SpaceBetween
} from '@cloudscape-design/components';
import CodeView from '@cloudscape-design/code-view/code-view';
import xmlHighlight from '@cloudscape-design/code-view/highlight/xml';
import { boardItemI18nStrings } from './common';
import { apiFetch } from '../../../auth/apiClient';

const EsdcBatchSubmissionWidget = ({
  actions = {},
  metadata = {},
  toggleHelpPanel
}) => {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  const [xml, setXml] = useState('');
  const [skipped, setSkipped] = useState([]);
  const [showExportModal, setShowExportModal] = useState(false);
  const [filename, setFilename] = useState(() => `esdc-participants-${new Date().toISOString().slice(0,10)}.xml`);
  const [downloadPath, setDownloadPath] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [needsReviewCount, setNeedsReviewCount] = useState(0);
  const [blockedCount, setBlockedCount] = useState(0);

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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Batch export', metadata.aiContext ?? '');
      }}
    >
      Info
    </Link>
  ) : undefined;

  const triggerRefresh = () => {
    try {
      window.dispatchEvent(new CustomEvent('esdcParticipants:refresh'));
    } catch (_) {}
  };

  const loadQueueInfo = React.useCallback(async () => {
    try {
      const resp = await apiFetch('/api/esdc/participants?limit=500&offset=0&groupByClient=true');
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) return;
      const items = Array.isArray(body.items) ? body.items : [];
      const total = typeof body.total === 'number' ? body.total : items.length;
      const ready = items.filter(it => it.readiness_status === 'ready').length;
      const needsReview = items.filter(it => it.readiness_status === 'needs_review').length;
      const blocked = items.filter(it => it.readiness_status === 'blocked').length;
      setQueueCount(total);
      setReadyCount(ready);
      setNeedsReviewCount(needsReview);
      setBlockedCount(blocked);
    } catch (_) {
      // ignore errors for gating UI
    }
  }, []);

  React.useEffect(() => {
    loadQueueInfo();
    const handler = () => loadQueueInfo();
    window.addEventListener('esdcParticipants:refresh', handler);
    return () => window.removeEventListener('esdcParticipants:refresh', handler);
  }, [loadQueueInfo]);

  const prepareBatch = async (opts = {}) => {
    setLoading(true);
    setAlert(null);
    setSkipped([]);
    try {
      const resp = await apiFetch('/api/esdc/participants/batch-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoreWarnings: !!opts.ignoreWarnings })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setAlert({ type: 'error', message: body.error || body.message || 'Batch prepare failed.' });
        setXml('');
        return;
      }
      setXml(body.xml || '');
      setSkipped(Array.isArray(body.skipped) ? body.skipped : []);
      if ((body.participants?.length || 0) > 0) {
        setAlert({
          type: 'success',
          message: `Generated batch for ${body.participants?.length || 0} exportable participants.${(body.skipped?.length || 0) ? ` Excluded ${body.skipped.length} blocked records.` : ''}`
        });
      } else {
        setAlert({
          type: 'info',
          message: (body.skipped?.length || 0)
            ? `No exportable participants were available. ${body.skipped.length} blocked records remain excluded until their ILMP blockers are resolved.`
            : 'No exportable participants were available for batch generation.'
        });
      }
      triggerRefresh();
      loadQueueInfo();
    } catch (err) {
      setAlert({ type: 'error', message: err?.message || 'Batch prepare failed.' });
      setXml('');
    } finally {
      setLoading(false);
    }
  };

  const submitBatch = async () => {
    setLoading(true);
    setAlert(null);
    try {
      const resp = await apiFetch('/api/esdc/participants/batch-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoreWarnings: true, filename, downloadPath })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setSkipped(Array.isArray(body.skipped) ? body.skipped : []);
        setAlert({ type: 'error', message: body.error || body.message || 'Batch export failed.' });
        setXml('');
        return;
      }
      setXml(body.xml || '');
      setSkipped(Array.isArray(body.skipped) ? body.skipped : []);
      setAlert({
        type: 'success',
        message: `Exported batch ${body.batchId || ''} for ${body.participants?.length || 0} exportable participants.${(body.skipped?.length || 0) ? ` Excluded ${body.skipped.length} blocked records.` : ''}`
      });
      triggerRefresh();
      loadQueueInfo();
      // Trigger download with provided filename
      if (body.xml) {
        const blob = new Blob([body.xml], { type: 'text/xml;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = (body.filename && body.filename.trim()) || filename || `esdc-participants-${Date.now()}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setAlert({ type: 'error', message: err?.message || 'Batch export failed.' });
      setXml('');
    } finally {
      setLoading(false);
      setShowExportModal(false);
    }
  };

  const issuesList = useMemo(() => {
    if (!skipped.length) return null;
    return (
      <SpaceBetween size="xxs">
        <Box variant="strong">Excluded from batch</Box>
        <Box as="ul" padding={{ left: 'm' }}>
          {skipped.map(item => (
            <li key={`${item.id}-${item.case_id || ''}`}>
              <Link href={item.case_id ? `/application-case/${item.case_id}` : `/esdc/participants/${item.id}`}>
                {item.participant_name || item.tracking_id || `Submission #${item.id}`}
              </Link>
              {item.detail ? ` — ${item.detail}` : ''}
            </li>
          ))}
        </Box>
      </SpaceBetween>
    );
  }, [skipped]);

  return (
    <>
      <BoardItem
        header={(
          <Header
            variant="h2"
            info={infoLink}
            description="Generate a single ILMP XML file for all participants without blocking ILMP issues."
            actions={(
              <SpaceBetween size="xs" direction="horizontal">
              <Button
                variant="primary"
                iconName="refresh"
                onClick={() => prepareBatch()}
                loading={loading}
                disabled={readyCount === 0}
              >
                Generate batch XML
              </Button>
              <Button
                variant="normal"
                iconName="download"
                disabled={!xml}
                onClick={() => setShowExportModal(true)}
              >
                Download
              </Button>
            </SpaceBetween>
          )}
          >
            Batch export
          </Header>
        )}
        settings={
          typeof actions.removeItem === 'function'
            ? (
              <ButtonDropdown
                ariaLabel="Batch export settings"
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
          {alert && (
            <Alert type={alert.type} dismissible onDismiss={() => setAlert(null)}>
              {alert.message}
              {issuesList}
            </Alert>
          )}
          <Box variant="p">
            Ready now: <strong>{readyCount}</strong> of <strong>{queueCount}</strong>. Needs review: <strong>{needsReviewCount}</strong>. Blocked: <strong>{blockedCount}</strong>. Batch generation includes ready and warning-only participants, and excludes blocked records automatically.
          </Box>
          {xml ? (
            <ExpandableSection headerText="Batch ILMP payload" defaultExpanded>
              <CodeView
                content={xml}
                language="xml"
                wrapLines
                highlight={xmlHighlight}
                ariaLabel="Batch ILMP payload preview"
                actions={(
                  <CopyToClipboard
                    copyButtonAriaLabel="Copy batch XML"
                    copyErrorText="Copy failed"
                    copySuccessText="Copied"
                    textToCopy={xml}
                  />
                )}
              />
            </ExpandableSection>
          ) : (
            <Box padding="m" color="text-body-secondary">
              No batch generated yet. Run “Generate batch XML” to preview and download.
            </Box>
          )}
        </SpaceBetween>
      </BoardItem>
      <Modal
        visible={showExportModal}
        header="Confirm batch export"
        closeAriaLabel="Close export modal"
        onDismiss={() => setShowExportModal(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setShowExportModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              iconName="download"
              onClick={submitBatch}
              loading={loading}
            >
              Download and mark exported
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="s">
          <Box>
            Downloading will mark included clients as exported in PATH and record a history entry. PATH does not upload
            the XML to ESDC.
          </Box>
          <SpaceBetween size="xs">
            <Box variant="strong">Filename</Box>
            <input
              type="text"
              value={filename}
              onChange={e => setFilename(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
            <Box variant="strong">Download path (optional)</Box>
            <input
              type="text"
              value={downloadPath}
              onChange={e => setDownloadPath(e.target.value)}
              placeholder={String.raw`e.g. C:\Users\you\Downloads`}
              style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}
            />
          </SpaceBetween>
        </SpaceBetween>
      </Modal>
    </>
  );
};

export default EsdcBatchSubmissionWidget;
