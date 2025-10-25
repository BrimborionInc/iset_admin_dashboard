import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Board from '@cloudscape-design/board-components/board';
import { SpaceBetween, Box } from '@cloudscape-design/components';
import { useParams } from 'react-router-dom';

import EsdcReadinessChecklistWidget from './widgets/EsdcReadinessChecklistWidget.jsx';
import EsdcValidationSummaryWidget from './widgets/EsdcValidationSummaryWidget.jsx';
import EsdcPayloadPreviewWidget from './widgets/EsdcPayloadPreviewWidget.jsx';
import EsdcSubmissionHistoryWidget from './widgets/EsdcSubmissionHistoryWidget.jsx';
import EsdcReadinessChecklistHelp from '../../helpPanelContents/esdcReadinessChecklistHelp.js';
import EsdcValidationSummaryHelp from '../../helpPanelContents/esdcValidationSummaryHelp.js';
import EsdcPayloadPreviewHelp from '../../helpPanelContents/esdcPayloadPreviewHelp.js';
import EsdcSubmissionHistoryHelp from '../../helpPanelContents/esdcSubmissionHistoryHelp.js';
import { apiFetch } from '../../auth/apiClient';

const STORAGE_KEY = 'esdc-participant-workspace-layout-v1';

const widgetRegistry = {
  readiness: {
    id: 'readiness',
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: EsdcReadinessChecklistWidget,
    title: 'Submission readiness checklist',
    description: 'Field-level ILMP compliance status for this participant.',
    helpComponent: EsdcReadinessChecklistHelp,
    helpTitle: 'Readiness checklist',
    aiContext: EsdcReadinessChecklistHelp.aiContext
  },
  validation: {
    id: 'validation',
    defaultRowSpan: 4,
    defaultColumnSpan: 2,
    component: EsdcValidationSummaryWidget,
    title: 'Validation summary',
    description: 'Mandatory vs optional coverage, warnings, blocking errors.',
    helpComponent: EsdcValidationSummaryHelp,
    helpTitle: 'Validation summary',
    aiContext: EsdcValidationSummaryHelp.aiContext
  },
  payload: {
    id: 'payload',
    defaultRowSpan: 6,
    defaultColumnSpan: 4,
    component: EsdcPayloadPreviewWidget,
    title: 'Payload preview',
    description: 'XML generated for this participant prior to submission.',
    helpComponent: EsdcPayloadPreviewHelp,
    helpTitle: 'Payload preview',
    aiContext: EsdcPayloadPreviewHelp.aiContext
  },
  history: {
    id: 'history',
    defaultRowSpan: 4,
    defaultColumnSpan: 4,
    component: EsdcSubmissionHistoryWidget,
    title: 'Submission history',
    description: 'Audit log of past submissions for this participant.',
    helpComponent: EsdcSubmissionHistoryHelp,
    helpTitle: 'Submission history',
    aiContext: EsdcSubmissionHistoryHelp.aiContext
  }
};

const defaultLayout = [
  { id: 'readiness', rowSpan: 5, columnSpan: 2 },
  { id: 'validation', rowSpan: 5, columnSpan: 2 },
  { id: 'payload', rowSpan: 6, columnSpan: 4 },
  { id: 'history', rowSpan: 5, columnSpan: 4 }
];

const exportLayout = items =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset
  }));

const toBoardItems = layout =>
  layout.map(item => {
    const definition = widgetRegistry[item.id];
    if (!definition) {
      return item;
    }
    return {
      id: definition.id,
      rowSpan: item.rowSpan ?? definition.defaultRowSpan,
      columnSpan: item.columnSpan ?? definition.defaultColumnSpan,
      columnOffset: item.columnOffset,
      data: {
        title: definition.title,
        description: definition.description,
        component: definition.component,
        helpComponent: definition.helpComponent,
        helpTitle: definition.helpTitle,
        aiContext: definition.aiContext
      }
    };
  });

const loadLayoutFromStorage = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (err) {
    console.error('[ParticipantWorkspacePage] failed to parse stored layout', err);
  }
  return null;
};

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id ||
      (left.rowSpan ?? null) !== (right.rowSpan ?? null) ||
      (left.columnSpan ?? null) !== (right.columnSpan ?? null)) {
      return false;
    }
  }
  return true;
};

const computePaletteItems = items =>
  Object.values(widgetRegistry)
    .filter(def => !items.some(item => item.id === def.id))
    .map(def => ({ id: def.id, data: { title: def.title, description: def.description } }));

const boardI18nStrings = {
  liveAnnouncementDndStarted: operation => (operation === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: operation => {
    const position = operation.direction === 'horizontal'
      ? `column ${operation.placement.x + 1}`
      : `row ${operation.placement.y + 1}`;
    return `Item moved to ${position}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const base = operation.direction === 'horizontal'
      ? `columns ${operation.placement.width}`
      : `rows ${operation.placement.height}`;
    const constraint = operation.direction === 'horizontal'
      ? (operation.isMinimalColumnsReached ? ' (minimal)' : '')
      : (operation.isMinimalRowsReached ? ' (minimal)' : '');
    return `Item resized to ${base}${constraint}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const column = `column ${operation.placement.x + 1}`;
    const row = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${column}, ${row}.`;
  },
  liveAnnouncementDndCommitted: operation => `${operation} committed`,
  liveAnnouncementDndDiscarded: operation => `${operation} discarded`,
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: 'Participant workspace navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty')
};

const ParticipantWorkspacePage = ({
  toggleHelpPanel,
  updateBreadcrumbs,
  setAvailableItems,
  setSplitPanelOpen
}) => {
  const { clientId } = useParams();
  const participantId = clientId;
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(boardItems), [boardItems]);
  const paletteSignatureRef = useRef(JSON.stringify(paletteItems));
  const [submission, setSubmission] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [participantName, setParticipantName] = useState(null);

  const loadParticipant = useCallback(async () => {
    if (!participantId) {
      setSubmission(null);
      setHistory([]);
      setLoading(false);
      setError('Participant id missing');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await apiFetch(`/api/esdc/participants/${participantId}`);
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || body.message || `Failed to load participant (${resp.status})`);
      }
      const data = await resp.json();
      setSubmission(data?.submission || null);
      setHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (err) {
      setSubmission(null);
      setHistory([]);
      setError(err.message || 'Failed to load participant submission.');
    } finally {
      setLoading(false);
    }
  }, [participantId]);

  useEffect(() => {
    loadParticipant();
  }, [loadParticipant]);

  useEffect(() => {
    if (typeof updateBreadcrumbs === 'function') {
      updateBreadcrumbs([
        { text: 'Home', href: '/' },
        { text: 'ESDC Submissions', href: '/esdc/overview' },
        { text: 'Participant Workspace', href: '#' }
      ]);
    }
  }, [updateBreadcrumbs]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch {}
      }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(exportLayout(boardItems)));
    } catch {}
  }, [boardItems, paletteItems, setAvailableItems]);

  useEffect(() => {
    const handler = event => {
      const id = event?.detail?.id;
      if (!id || !widgetRegistry[id]) {
        return;
      }
      setLayout(current => {
        if (current.some(item => item.id === id)) {
          return current;
        }
        return [...current, { id }];
      });
    };
    window.addEventListener('palette:add', handler);
    return () => window.removeEventListener('palette:add', handler);
  }, []);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) {
      return;
    }
    const next = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, next) ? current : next));
  };

  const renderBoardItem = (item, actions) => {
    if (!item?.id) {
      return null;
    }
    const definition = widgetRegistry[item.id];
    if (!definition) {
      return null;
    }
    const WidgetComponent = definition.component;
    return (
      <WidgetComponent
        actions={actions}
        metadata={item.data}
        toggleHelpPanel={toggleHelpPanel}
        submission={submission}
        history={history}
        loading={loading}
        error={error}
        onRefresh={loadParticipant}
      />
    );
  };

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(toBoardItems(defaultLayout));
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(defaultPalette);
      } catch {}
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, [setAvailableItems]);

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(paletteItems);
      } catch {}
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpen = () => openPalette();
    const handleReset = () => resetLayout();
    window.addEventListener('esdcParticipantWorkspace:openPalette', handleOpen);
    window.addEventListener('esdcParticipantWorkspace:resetLayout', handleReset);
    return () => {
      window.removeEventListener('esdcParticipantWorkspace:openPalette', handleOpen);
      window.removeEventListener('esdcParticipantWorkspace:resetLayout', handleReset);
    };
  }, [openPalette, resetLayout]);

  useEffect(() => {
    if (!submission) {
      setParticipantName(null);
      return undefined;
    }

    const tracking = submission.tracking_id || (submission.case_id ? `CASE-${submission.case_id}` : null);
    const submissionName = submission.participant_name;

    if (submissionName && submissionName !== tracking) {
      setParticipantName(submissionName);
      return undefined;
    }

    if (!submission.application_id) {
      setParticipantName(tracking);
      return undefined;
    }

    let cancelled = false;

    async function hydrateName() {
      try {
        const resp = await apiFetch(`/api/applications/${submission.application_id}`);
        if (!resp.ok) {
          setParticipantName(tracking);
          return;
        }
        const data = await resp.json();
        let payload = data?.payload_json;
        if (payload && typeof payload === 'string') {
          try {
            payload = JSON.parse(payload);
          } catch {
            payload = null;
          }
        }

        const answers = payload?.answers || payload?.intake_answers || {};
        const firstName = answers['first-name'] || answers.first_name;
        const middleName = answers['middle-names'] || answers.middle_names;
        const lastName = answers['last-name'] || answers.last_name;
        const parts = [firstName, middleName, lastName]
          .filter(part => typeof part === 'string' && part.trim().length > 0);
        const legalName = parts.length ? parts.join(' ').trim() : '';
        const preferredName = typeof answers['preferred-name'] === 'string' ? answers['preferred-name'].trim() : '';
        const derived = legalName || preferredName || tracking;

        if (!cancelled) {
          setParticipantName(derived);
        }
      } catch {
        if (!cancelled) {
          setParticipantName(tracking);
        }
      }
    }

    hydrateName();

    return () => {
      cancelled = true;
    };
  }, [submission]);

  return (
    <SpaceBetween size="l">
      {error && !loading && (
        <Box color="text-status-critical">{error}</Box>
      )}
      {submission && (
        <Box>
          <Box variant="awsui-key-label">Tracking ID</Box>
          <Box variant="strong">{submission.tracking_id || `CASE-${submission.case_id}`}</Box>
          {participantName && (
            <Box margin={{ top: 'xs' }}>
              <Box variant="awsui-key-label">Applicant</Box>
              <Box>{participantName}</Box>
            </Box>
          )}
        </Box>
      )}
      <Board
        i18nStrings={boardI18nStrings}
        items={boardItems}
        onItemsChange={handleItemsChange}
        renderItem={renderBoardItem}
        empty={<Box padding="m">No widgets on the workspace.</Box>}
      />
    </SpaceBetween>
  );
};

export default ParticipantWorkspacePage;
