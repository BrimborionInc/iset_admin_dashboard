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
  SpaceBetween,
  StatusIndicator
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
  const [participants, setParticipants] = useState([]);
  const [showWarningsModal, setShowWarningsModal] = useState(false);
  const [warnings, setWarnings] = useState([]);
  const [blocking, setBlocking] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [filename, setFilename] = useState(() => `esdc-participants-${new Date().toISOString().slice(0,10)}.xml`);
  const [downloadPath, setDownloadPath] = useState('');
  const [queueCount, setQueueCount] = useState(0);
  const [validatedCount, setValidatedCount] = useState(0);

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
        toggleHelpPanel(helpContent, metadata.helpTitle ?? 'Batch submission', metadata.aiContext ?? '');
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
      const validated = items.filter(it => it.last_validated_at).length;
      setQueueCount(total);
      setValidatedCount(validated);
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

  const downloadXml = () => {
    if (!xml) return;
    const blob = new Blob([xml], { type: 'text/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `esdc-participants-${Date.now()}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const prepareBatch = async (opts = {}) => {
    setLoading(true);
    setAlert(null);
    setWarnings([]);
    setBlocking([]);
    try {
      const resp = await apiFetch('/api/esdc/participants/batch-prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignoreWarnings: !!opts.ignoreWarnings })
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status === 409) {
          if (Array.isArray(body.blocking) && body.blocking.length) {
            setBlocking(body.blocking);
            setAlert({ type: 'error', message: 'Blocked participants detected. Fix blockers before generating.' });
          } else if (Array.isArray(body.warnings) && body.warnings.length) {
            setWarnings(body.warnings);
            setShowWarningsModal(true);
            setAlert({ type: 'warning', message: 'Warnings detected. Review and confirm to proceed.' });
          } else {
            setAlert({ type: 'error', message: body.error || body.message || 'Batch prepare failed.' });
          }
        } else {
          setAlert({ type: 'error', message: body.error || body.message || 'Batch prepare failed.' });
        }
        setXml('');
        setParticipants([]);
        return;
      }
      setXml(body.xml || '');
      setParticipants(Array.isArray(body.participants) ? body.participants : []);
      setAlert({ type: 'success', message: `Generated batch for ${body.participants?.length || 0} participants.` });
      triggerRefresh();
      loadQueueInfo();
    } catch (err) {
      setAlert({ type: 'error', message: err?.message || 'Batch prepare failed.' });
      setXml('');
      setParticipants([]);
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
        setAlert({ type: 'error', message: body.error || body.message || 'Batch submit failed.' });
        setXml('');
        setParticipants([]);
        return;
      }
      setXml(body.xml || '');
      setParticipants(Array.isArray(body.participants) ? body.participants : []);
      setAlert({
        type: 'success',
        message: `Submitted batch ${body.batchId || ''} for ${body.participants?.length || 0} participants.`
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
      setAlert({ type: 'error', message: err?.message || 'Batch submit failed.' });
      setXml('');
      setParticipants([]);
    } finally {
      setLoading(false);
      setShowSubmitModal(false);
    }
  };

  const issuesList = useMemo(() => {
    const render = (title, list) => (
          <SpaceBetween size="xxs">
            <Box variant="strong">{title}</Box>
            <Box as="ul" padding={{ left: 'm' }}>
              {list.map(item => (
                <li key={`${item.id}-${item.case_id || ''}`}>
                  <Link href={`/cases/${item.case_id || item.id}`}>
                    {item.participant_name || item.tracking_id || `Submission #${item.id}`}
                  </Link>
                  {item.detail ? ` — ${item.detail}` : ''}
                </li>
              ))}
        </Box>
      </SpaceBetween>
    );
    return (
      <>
        {blocking.length > 0 && render('Blocked participants', blocking)}
        {warnings.length > 0 && render('Warnings', warnings)}
      </>
    );
  }, [blocking, warnings]);

  return (
    <>
      <BoardItem
        header={(
          <Header
            variant="h2"
            info={infoLink}
            description="Generate a single ILMP XML file for all ready participants."
            actions={(
              <SpaceBetween size="xs" direction="horizontal">
              <Button
                variant="primary"
                iconName="refresh"
                onClick={() => prepareBatch()}
                loading={loading}
                disabled={queueCount === 0 || validatedCount === 0}
              >
                Generate batch XML
              </Button>
              <Button
                variant="normal"
                iconName="download"
                disabled={!xml}
                onClick={() => setShowSubmitModal(true)}
              >
                Download
              </Button>
            </SpaceBetween>
          )}
          >
            Batch submission
          </Header>
        )}
        settings={
          typeof actions.removeItem === 'function'
            ? (
              <ButtonDropdown
                ariaLabel="Batch submission settings"
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
            Participants included: <strong>{participants.length}</strong>. Batch generation blocks on validation blockers; warnings require confirmation.
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
        visible={showWarningsModal}
        header="Warnings detected"
        closeAriaLabel="Close warning modal"
        onDismiss={() => setShowWarningsModal(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setShowWarningsModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowWarningsModal(false);
                prepareBatch({ ignoreWarnings: true });
              }}
            >
              Proceed with warnings
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="s">
          <Box>One or more participants have warnings. You can proceed, but review recommended.</Box>
          {issuesList}
        </SpaceBetween>
      </Modal>
      <Modal
        visible={showSubmitModal}
        header="Confirm batch submission"
        closeAriaLabel="Close submit modal"
        onDismiss={() => setShowSubmitModal(false)}
        footer={(
          <SpaceBetween size="xs" direction="horizontal">
            <Button variant="normal" onClick={() => setShowSubmitModal(false)}>Cancel</Button>
            <Button
              variant="primary"
              iconName="download"
              onClick={submitBatch}
              loading={loading}
            >
              Submit and download
            </Button>
          </SpaceBetween>
        )}
      >
        <SpaceBetween size="s">
          <Box>
            Downloading will mark included participants as submitted and record a history entry. Continue?
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
