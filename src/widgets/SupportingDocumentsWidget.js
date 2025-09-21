import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import { Header, Table, Box, Button, ButtonDropdown, SpaceBetween, Alert } from '@cloudscape-design/components';

const REFRESH_EVENT = 'iset:supporting-documents:refresh';

const formatDate = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const normalizeFileUrl = path => {
  if (!path) return '';
  const sanitized = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const base = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');
  return base ? `${base}/${sanitized}` : sanitized;
};

const SupportingDocumentsWidget = ({ actions, caseData }) => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const applicantUserId = caseData?.applicant_user_id || null;

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

  const handleRefresh = () => {
    if (!applicantUserId) return;
    loadDocuments({ silent: true });
  };

  return (
    <BoardItem
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="icon"
                iconName="refresh"
                ariaLabel="Refresh supporting documents"
                onClick={handleRefresh}
                disabled={loading || refreshing || !applicantUserId}
              />
            </SpaceBetween>
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
                const url = normalizeFileUrl(item.file_path || '');
                return url ? (
                  <Button
                    variant="inline-link"
                    onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                  >
                    View
                  </Button>
                ) : (
                  <span style={{ color: '#888' }}>Unavailable</span>
                );
              }
            }
          ]}
          header={<Header>Applicant's Supporting Documents</Header>}
          empty={<Box textAlign="center">No supporting documents to display.</Box>}
        />
      </SpaceBetween>
    </BoardItem>
  );
};

export default SupportingDocumentsWidget;
