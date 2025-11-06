import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Table, Box, Button, ButtonDropdown, SpaceBetween, Alert, Link } from '@cloudscape-design/components';
import SupportingDocumentsHelp from '../helpPanelContents/supportingDocumentsHelp';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const REFRESH_EVENT = 'iset:supporting-documents:refresh';

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const SupportingDocumentsWidget = ({ actions, caseData: propCaseData, toggleHelpPanel }) => {
  const workspace = useCaseWorkspace();
  const caseData = useMemo(() => {
    if (propCaseData) return propCaseData;
    if (workspace && typeof workspace === 'object') {
      if (workspace.caseData) return workspace.caseData;
    }
    return null;
  }, [propCaseData, workspace]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingDownloads, setPendingDownloads] = useState({});
  const fileInputRef = useRef(null);
  const applicantUserId =
    caseData?.applicant_user_id ??
    caseData?.applicantUserId ??
    workspace?.applicant_user_id ??
    workspace?.applicantUserId ??
    null;
  const caseId =
    caseData?.id ??
    caseData?.case_id ??
    workspace?.case_id ??
    workspace?.caseId ??
    null;
  const applicationId =
    caseData?.application_id ??
    caseData?.applicationId ??
    workspace?.application_id ??
    workspace?.applicationId ??
    null;

  const loadDocuments = useCallback(
    async (options = {}) => {
      const { silent = false } = options;
      if (!applicantUserId) {
        setDocuments([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const res = await apiFetch(`/api/applicants/${applicantUserId}/documents`);
        if (!res.ok) throw new Error('Failed to load supporting documents');
        const data = await res.json().catch(() => []);
        setDocuments(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err?.message || 'Failed to load supporting documents');
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [applicantUserId]
  );

  useEffect(() => {
    if (!applicantUserId) {
      setDocuments([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    loadDocuments();
  }, [applicantUserId, loadDocuments]);

  useEffect(() => {
    if (!applicantUserId || typeof window === 'undefined') return;
    const handler = event => {
      const targetApplicant = event?.detail?.applicantUserId;
      if (targetApplicant && targetApplicant !== applicantUserId) return;
      loadDocuments({ silent: true });
    };
    window.addEventListener(REFRESH_EVENT, handler);
    return () => {
      window.removeEventListener(REFRESH_EVENT, handler);
    };
  }, [applicantUserId, loadDocuments]);

  const handleViewDocument = useCallback(
    async item => {
      const documentId = item?.id;
      if (!documentId) return;
      setError(null);
      setPendingDownloads(prev => ({ ...prev, [documentId]: true }));
      try {
        const res = await apiFetch(`/api/documents/${documentId}/presign-download`);
        if (!res || !res.ok) {
          const message = res && res.status === 404 ? 'Document not found' : 'Failed to prepare download';
          throw new Error(message);
        }
        const payload = await res.json().catch(() => null);
        if (!payload) throw new Error('Invalid download response');
        let targetUrl = '';
        if (payload.mode === 's3') {
          targetUrl = payload.presigned?.url || '';
        } else if (payload.mode === 'local-direct') {
          const path = payload.path || '';
          if (path) {
            const normalized = path.startsWith('/') ? path : `/${path}`;
            targetUrl = API_BASE_URL ? `${API_BASE_URL}${normalized}` : normalized;
          }
        }
        if (!targetUrl) {
          throw new Error('Document download unavailable');
        }
        if (typeof window !== 'undefined') {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } catch (err) {
        console.error('[SupportingDocumentsWidget] document open failed', err);
        setError(err?.message || 'Failed to open document');
      } finally {
        setPendingDownloads(prev => {
          const next = { ...prev };
          delete next[documentId];
          return next;
        });
      }
    },
    []
  );
  const handleUploadButtonClick = useCallback(() => {
    if (uploading) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [uploading]);
  const handleFileSelected = useCallback(
    async event => {
      const input = event?.target;
      const file = input?.files?.[0] || null;
      if (input) {
        input.value = '';
      }
      if (!file) return;
      if (!applicantUserId) {
        setError('Unable to upload until an applicant is selected.');
        return;
      }
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (caseId) formData.append('caseId', caseId);
        if (applicationId) formData.append('applicationId', applicationId);
        formData.append('label', file.name);
        const response = await apiFetch(`/api/applicants/${applicantUserId}/documents/upload`, {
          method: 'POST',
          body: formData
        });
        if (!response || !response.ok) {
          let payload = null;
          if (response && typeof response.json === 'function') {
            try {
              payload = await response.json();
            } catch (_) {
              payload = null;
            }
          }
          const errorCode = payload?.error || null;
          if (errorCode === 'unsupported_file_type') {
            throw new Error('That file type is not allowed. Please upload a PDF, JPG, PNG, BMP, or TIFF file.');
          }
          if (errorCode === 'file_too_large') {
            const maxBytes = payload?.maxBytes;
            const maxMb = maxBytes ? Math.ceil(Number(maxBytes) / (1024 * 1024)) : null;
            throw new Error(
              maxMb
                ? `The file is too large. The maximum supported size is ${maxMb} MB.`
                : 'The file is too large to upload.'
            );
          }
          if (errorCode === 'invalid_applicant_id') {
            throw new Error('Unable to determine which applicant this upload belongs to.');
          }
          throw new Error(payload?.message || 'Failed to upload document.');
        }
        await loadDocuments({ silent: true });
      } catch (err) {
        const message = err?.message || 'Failed to upload document.';
        setError(message);
      } finally {
        setUploading(false);
      }
    },
    [applicantUserId, caseId, applicationId, loadDocuments]
  );
  const handleRefresh = () => {
    if (!applicantUserId) return;
    loadDocuments({ silent: true });
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelected}
        accept=".pdf,.jpg,.jpeg,.png,.bmp,.tif,.tiff"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <BoardItem
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                iconName="upload"
                onClick={handleUploadButtonClick}
                disabled={!applicantUserId}
                loading={uploading}
              >
                Upload
              </Button>
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh supporting documents"
                onClick={handleRefresh}
                disabled={loading || refreshing || !applicantUserId}
              />
            </SpaceBetween>
          }
          info={
            toggleHelpPanel ? (
              <Link
                variant="info"
                onFollow={() =>
                  toggleHelpPanel(
                    <SupportingDocumentsHelp />,
                    'Supporting Documents Help',
                    SupportingDocumentsHelp.aiContext
                  )
                }
              >
                Info
              </Link>
            ) : undefined
          }
        >
          Supporting Documents
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
      settings={
        actions && actions.removeItem && (
          <ButtonDropdown
            items={[{ id: 'remove', text: 'Remove' }]}
            ariaLabel="Board item settings"
            variant="icon"
            onItemClick={() => actions && actions.removeItem && actions.removeItem()}
          />
        )
      }
    >
      <SpaceBetween size="s">
        <Box variant="small">
          This widget displays all documents related to the applicant, including those submitted with the
          application and any adopted secure message attachments.
        </Box>
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}
        <Table
          loading={loading || refreshing}
          loadingText="Loading supporting documents"
          variant="embedded"
          items={documents}
          columnDefinitions={[
            { id: 'file_name', header: 'File Name', cell: item => item.file_name || '' },
            { id: 'source', header: 'Source', cell: item => (item.source || '').replace(/_/g, ' ') },
            {
              id: 'uploaded_at',
              header: 'Uploaded',
              cell: item => formatDate(item.uploaded_at)
            },
            {
              id: 'actions',
              header: 'Actions',
              cell: item => {
                const isAvailable = Boolean(item?.id && item?.file_path);
                if (!isAvailable) {
                  return <span style={{ color: '#888' }}>Unavailable</span>;
                }
                const inFlight = !!pendingDownloads[item.id];
                return (
                  <Button
                    variant="inline-link"
                    onClick={() => handleViewDocument(item)}
                    disabled={inFlight}
                    loading={inFlight}
                  >
                    View
                  </Button>
                );
              }
            }
          ]}
          header={<Header>Applicant's Supporting Documents</Header>}
          empty={<Box textAlign="center">No supporting documents to display.</Box>}
        />
      </SpaceBetween>
      </BoardItem>
    </>
  );
};

export default SupportingDocumentsWidget;
