import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../auth/apiClient';
import { BoardItem } from '@cloudscape-design/board-components';
import {
  Header,
  Table,
  Box,
  Button,
  ButtonDropdown,
  SpaceBetween,
  Alert,
  Link,
  Modal,
  FormField,
  Input,
  CollectionPreferences
} from '@cloudscape-design/components';
import SupportingDocumentsHelp from '../helpPanelContents/supportingDocumentsHelp';
import { useCaseWorkspace } from '../pages/Caseworking/caseWorkspace/CaseWorkspaceContext.jsx';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/$/, '');

const REFRESH_EVENT = 'iset:supporting-documents:refresh';

const PREFERENCES_STORAGE_KEY = 'supporting-documents-table-preferences-v1';
const COLUMN_WIDTHS_STORAGE_KEY = 'supporting-documents-table-widths-v1';
const ALL_COLUMN_IDS = ['label', 'file_name', 'source', 'uploaded_at', 'actions'];
const REQUIRED_COLUMN_IDS = ['file_name', 'actions'];

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
  const [labelModalVisible, setLabelModalVisible] = useState(false);
  const [pendingLabel, setPendingLabel] = useState('');
  const [labelError, setLabelError] = useState('');
  const [pendingDeletes, setPendingDeletes] = useState({});
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => {
    if (typeof window === 'undefined') return ALL_COLUMN_IDS;
    try {
      const raw = window.localStorage.getItem(PREFERENCES_STORAGE_KEY);
      if (!raw) return ALL_COLUMN_IDS;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return ALL_COLUMN_IDS;
      const stored = Array.isArray(parsed.visibleColumns)
        ? parsed.visibleColumns.filter(id => ALL_COLUMN_IDS.includes(id))
        : [];
      const visibleSet = new Set([...stored, ...REQUIRED_COLUMN_IDS]);
      const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
      return ordered.length ? ordered : ALL_COLUMN_IDS;
    } catch (err) {
      console.error('[SupportingDocuments] failed to read table preferences', err);
      return ALL_COLUMN_IDS;
    }
  });
  const [columnWidths, setColumnWidths] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(COLUMN_WIDTHS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const id = typeof entry.id === 'string' ? entry.id : null;
          const width = Number(entry.width);
          if (!id || !Number.isFinite(width)) return null;
          return { id, width };
        })
        .filter(Boolean);
    } catch (err) {
      console.error('[SupportingDocuments] failed to read column widths', err);
      return [];
    }
  });
  const fileInputRef = useRef(null);
  const nextUploadLabelRef = useRef('');
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
  const persistPreferences = useCallback(
    nextVisibleColumns => {
      if (typeof window === 'undefined') return;
      try {
        const visibleSet = new Set(
          (nextVisibleColumns || []).filter(id => ALL_COLUMN_IDS.includes(id))
        );
        REQUIRED_COLUMN_IDS.forEach(id => visibleSet.add(id));
        const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
        const payload = { visibleColumns: ordered };
        window.localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(payload));
      } catch (err) {
        console.error('[SupportingDocuments] failed to persist table preferences', err);
      }
    },
    []
  );

  const persistColumnWidths = useCallback(widths => {
    if (typeof window === 'undefined') return;
    try {
      if (!Array.isArray(widths) || !widths.length) {
        window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
        return;
      }
      const payload = widths
        .map(entry => {
          if (!entry || typeof entry !== 'object') return null;
          const id = typeof entry.id === 'string' ? entry.id : null;
          const width = Number(entry.width);
          if (!id || !Number.isFinite(width)) return null;
          return { id, width };
        })
        .filter(Boolean);
      if (payload.length) {
        window.localStorage.setItem(COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(payload));
      } else {
        window.localStorage.removeItem(COLUMN_WIDTHS_STORAGE_KEY);
      }
    } catch (err) {
      console.error('[SupportingDocuments] failed to persist column widths', err);
    }
  }, []);

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
  const openLabelModal = useCallback(() => {
    if (uploading) return;
    if (!applicantUserId) {
      setError('Unable to upload until an applicant is selected.');
      return;
    }
    setLabelError('');
    setLabelModalVisible(true);
    setPendingLabel(prev => prev || '');
  }, [applicantUserId, uploading]);
  const handleLabelModalDismiss = useCallback(() => {
    setLabelModalVisible(false);
    setLabelError('');
  }, []);
  const handleLabelConfirm = useCallback(() => {
    const trimmed = (pendingLabel || '').trim();
    if (!trimmed) {
      setLabelError('Enter a document label.');
      return;
    }
    nextUploadLabelRef.current = trimmed;
    setLabelError('');
    setLabelModalVisible(false);
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [pendingLabel]);
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
        const labelForUpload = (nextUploadLabelRef.current || '').trim() || file.name;
        formData.append('label', labelForUpload);
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
        nextUploadLabelRef.current = '';
        setPendingLabel('');
      }
    },
    [applicantUserId, caseId, applicationId, loadDocuments]
  );
  const handleInlineEdit = useCallback(
    async (item, column, newValue) => {
      const columnId = column?.id;
      const nextValue = typeof newValue === 'string' ? newValue : '';
      if (columnId !== 'label') return;
      const trimmed = nextValue.trim();
      if (!trimmed) {
        setError('Document label cannot be empty.');
        return;
      }
      if (!item?.id) {
        setError('Cannot update this document.');
        return;
      }
      setError(null);
      const original = documents;
      setDocuments(prev =>
        Array.isArray(prev) ? prev.map(doc => (doc.id === item.id ? { ...doc, label: trimmed } : doc)) : prev
      );
      try {
        const res = await apiFetch(`/api/documents/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ label: trimmed })
        });
        if (!res || !res.ok) {
          let payload = null;
          try {
            payload = await res.json();
          } catch (_) {
            payload = null;
          }
          throw new Error(payload?.message || 'Failed to update document label.');
        }
        await loadDocuments({ silent: true });
      } catch (err) {
        setError(err?.message || 'Failed to update document label.');
        setDocuments(original);
      }
    },
    [documents, loadDocuments]
  );

  const openDeleteModal = useCallback(item => {
    if (!item?.id) return;
    setDeleteTarget(item);
    setDeleteConfirm('');
    setDeleteModalVisible(true);
  }, []);

  const handleDeleteCancel = useCallback(() => {
    setDeleteModalVisible(false);
    setDeleteTarget(null);
    setDeleteConfirm('');
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget?.id) {
      handleDeleteCancel();
      return;
    }
    setError(null);
    setPendingDeletes(prev => ({ ...prev, [deleteTarget.id]: true }));
    try {
      const res = await apiFetch(`/api/documents/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res || !res.ok) {
        let payload = null;
        try {
          payload = await res.json();
        } catch (_) {
          payload = null;
        }
        throw new Error(payload?.message || 'Failed to delete document.');
      }
      await loadDocuments({ silent: true });
      handleDeleteCancel();
    } catch (err) {
      setError(err?.message || 'Failed to delete document.');
    } finally {
      setPendingDeletes(prev => {
        const next = { ...prev };
        if (deleteTarget?.id) {
          delete next[deleteTarget.id];
        }
        return next;
      });
    }
  }, [deleteTarget, loadDocuments, handleDeleteCancel]);
  const handleRefresh = () => {
    if (!applicantUserId) return;
    loadDocuments({ silent: true });
  };

  const baseColumnDefinitions = useMemo(
    () => [
      {
        id: 'label',
        header: 'Document label',
        cell: item => item.label || item.file_name || '',
        editConfig: {
          ariaLabel: 'Document label',
          editIconAriaLabel: 'Edit document label',
          disabledReason: item => (!item?.id ? 'Cannot edit this document.' : undefined),
          editingCell: (item, { currentValue, setValue }) => (
            <Input
              autoFocus
              value={currentValue ?? item.label ?? item.file_name ?? ''}
              onChange={({ detail }) => setValue(detail.value)}
              placeholder="e.g., Government ID"
            />
          )
        }
      },
      {
        id: 'file_name',
        header: 'File Name',
        cell: item => item.file_name || ''
      },
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
          const deleting = !!pendingDeletes[item.id];
          return (
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="inline-link"
                onClick={() => handleViewDocument(item)}
                disabled={inFlight}
                loading={inFlight}
              >
                View
              </Button>
              <Button
                variant="inline-link"
                disabled={deleting}
                loading={deleting}
                onClick={() => openDeleteModal(item)}
              >
                Delete
              </Button>
            </SpaceBetween>
          );
        }
      }
    ],
    [handleViewDocument, openDeleteModal, pendingDownloads, pendingDeletes]
  );

  const mergedColumnDefinitions = useMemo(
    () =>
      baseColumnDefinitions.map(column => {
        const stored = columnWidths.find(entry => entry.id === column.id);
        if (stored?.width) {
          return { ...column, width: stored.width };
        }
        return column;
      }),
    [baseColumnDefinitions, columnWidths]
  );

  const columnDefinitionsForTable = useMemo(() => {
    const allowed = new Set([...visibleColumns, ...REQUIRED_COLUMN_IDS]);
    return mergedColumnDefinitions.filter(column => allowed.has(column.id));
  }, [mergedColumnDefinitions, visibleColumns]);

  const preferencesState = useMemo(
    () => ({
      contentDisplay: mergedColumnDefinitions.map(column => ({
        id: column.id,
        visible: visibleColumns.includes(column.id)
      })),
      columnWidths
    }),
    [mergedColumnDefinitions, visibleColumns, columnWidths]
  );

  const columnPreferenceOptions = useMemo(
    () =>
      mergedColumnDefinitions.map(column => ({
        id: column.id,
        label: typeof column.header === 'string' ? column.header : column.id,
        alwaysVisible: REQUIRED_COLUMN_IDS.includes(column.id)
      })),
    [mergedColumnDefinitions]
  );

  const applyColumnWidthUpdates = useCallback(
    updates => {
      if (!Array.isArray(updates)) {
        setColumnWidths([]);
        persistColumnWidths([]);
        return;
      }
      const allowedIds = new Set(mergedColumnDefinitions.map(column => column.id));
      const tempMap = new Map();
      updates.forEach(entry => {
        if (!entry || typeof entry !== 'object') return;
        const { id, width } = entry;
        if (!allowedIds.has(id)) return;
        const numericWidth = Number(width);
        if (Number.isFinite(numericWidth)) {
          tempMap.set(id, numericWidth);
        }
      });
      const ordered = [];
      mergedColumnDefinitions.forEach(column => {
        if (tempMap.has(column.id)) {
          ordered.push({ id: column.id, width: tempMap.get(column.id) });
        }
      });
      setColumnWidths(ordered);
      persistColumnWidths(ordered);
    },
    [mergedColumnDefinitions, persistColumnWidths]
  );

  const handleColumnWidthsChange = useCallback(
    ({ detail }) => {
      if (!detail) return;
      const next = [];
      if (Array.isArray(detail.columnWidths)) {
        detail.columnWidths.forEach(entry => {
          if (!entry || typeof entry !== 'object') return;
          const { id, width } = entry;
          if (typeof id === 'string' && Number.isFinite(Number(width))) {
            next.push({ id, width: Number(width) });
          }
        });
      } else if (Array.isArray(detail.widths)) {
        detail.widths.forEach((width, index) => {
          const column = columnDefinitionsForTable[index];
          if (!column) return;
          if (Number.isFinite(Number(width))) {
            next.push({ id: column.id, width: Number(width) });
          }
        });
      }
      if (next.length) {
        applyColumnWidthUpdates(next);
      }
    },
    [applyColumnWidthUpdates, columnDefinitionsForTable]
  );

  const handlePreferencesConfirm = useCallback(
    ({ detail }) => {
      const display = detail?.contentDisplay || detail?.preferences?.contentDisplay || [];
      if (Array.isArray(display)) {
        const nextVisible = display
          .filter(entry => entry && entry.visible)
          .map(entry => entry.id)
          .filter(id => ALL_COLUMN_IDS.includes(id));
        const visibleSet = new Set([...nextVisible, ...REQUIRED_COLUMN_IDS]);
        const ordered = ALL_COLUMN_IDS.filter(id => visibleSet.has(id));
        setVisibleColumns(ordered);
        persistPreferences(ordered);
      }
      const widths = detail?.columnWidths || detail?.preferences?.columnWidths || [];
      if (Array.isArray(widths) && widths.length) {
        applyColumnWidthUpdates(widths);
      }
    },
    [persistPreferences, applyColumnWidthUpdates]
  );

  const preferencesComponent = (
    <CollectionPreferences
      title="Table preferences"
      confirmLabel="Confirm"
      cancelLabel="Cancel"
      preferences={preferencesState}
      contentDisplayPreference={{
        title: 'Select columns',
        options: columnPreferenceOptions
      }}
      onConfirm={handlePreferencesConfirm}
    />
  );

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
      <Modal
        visible={labelModalVisible}
        onDismiss={handleLabelModalDismiss}
        closeAriaLabel="Close dialog"
        header="Set document label"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleLabelModalDismiss}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleLabelConfirm}>
              Continue
            </Button>
          </SpaceBetween>
        }
      >
        <FormField
          label="Document label"
          description="Enter how this document should be listed in Supporting Documents."
          errorText={labelError}
        >
          <Input
            value={pendingLabel}
            placeholder="e.g., Government ID"
            onChange={({ detail }) => setPendingLabel(detail.value)}
            autoFocus
          />
        </FormField>
      </Modal>
      <Modal
        visible={deleteModalVisible}
        onDismiss={handleDeleteCancel}
        closeAriaLabel="Close dialog"
        header="Delete document"
        footer={
          <SpaceBetween direction="horizontal" size="xs">
            <Button variant="link" onClick={handleDeleteCancel}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirm.trim().toLowerCase() !== 'delete' || pendingDeletes[deleteTarget?.id]}
              loading={pendingDeletes[deleteTarget?.id]}
            >
              Delete
            </Button>
          </SpaceBetween>
        }
      >
        <SpaceBetween size="s">
          <Box>
            This will permanently delete the document from Supporting Documents. Type <strong>delete</strong> to confirm.
          </Box>
          <FormField label="Type delete to confirm">
            <Input
              value={deleteConfirm}
              onChange={({ detail }) => setDeleteConfirm(detail.value)}
              autoFocus
              placeholder="delete"
            />
          </FormField>
        </SpaceBetween>
      </Modal>
      <BoardItem
      header={
        <Header
          actions={
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="primary"
                iconName="upload"
                onClick={openLabelModal}
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
          trackBy="id"
          loading={loading || refreshing}
          loadingText="Loading supporting documents"
          variant="embedded"
        items={documents}
        columnDefinitions={columnDefinitionsForTable}
        resizableColumns
        stickyHeader
        enableKeyboardNavigation
        onColumnWidthsChange={handleColumnWidthsChange}
        preferences={preferencesComponent}
        submitEdit={handleInlineEdit}
        ariaLabels={{
          activateEditLabel: (column, item) => `Edit ${item?.label || item?.file_name || 'document'} ${column.header}`,
          cancelEditLabel: column => `Cancel editing ${column.header}`,
          submitEditLabel: column => `Submit editing ${column.header}`,
          tableLabel: 'Supporting documents'
        }}
        empty={<Box textAlign="center">No supporting documents to display.</Box>}
      />
      </SpaceBetween>
      </BoardItem>
    </>
  );
};

export default SupportingDocumentsWidget;
