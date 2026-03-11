import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ContentLayout, SpaceBetween, Box, Flashbar } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams, useLocation, useHistory } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewWidget from '../widgets/ApplicationOverviewWidget';
import IsetApplicationFormWidget from '../widgets/IsetApplicationFormWidget';
import CoordinatorAssessmentWidget from '../widgets/CoordinatorAssessmentWidget';
import SupportingDocumentsWidget from '../widgets/SupportingDocumentsWidget';
import SecureMessagingWidget from '../widgets/SecureMessagingWidget';
import CaseNotesWidget from '../widgets/CaseNotesWidget';
import ApplicationEvents from '../widgets/applicationEvents';
import CaseCalendarWidget from '../widgets/CaseCalendarWidget';

const STORAGE_KEY = 'application-assessment-dashboard-layout.v2';
const TUTORIAL_APP_LAYOUT_RESET_FLAG = 'iset.tutorial.resetApplicationLayout';

const widgetRegistry = {
  'application-overview': {
    id: 'application-overview',
    defaultRowSpan: 2,
    defaultColumnSpan: 4,
    component: ApplicationOverviewWidget,
    title: 'Application Overview',
    description: 'Case summary, status badge, reference number, and quick actions.',
  },
  'iset-application-form': {
    id: 'iset-application-form',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: IsetApplicationFormWidget,
    title: 'ISET Application Form',
    description: 'Submitted application with version history; edit where permitted.',
  },
  'coordinator-assessment': {
    id: 'coordinator-assessment',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: CoordinatorAssessmentWidget,
    title: 'Application Assessment',
    description: 'Assessment workflow, declarations, and status progression.',
  },
  'supporting-documents': {
    id: 'supporting-documents',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: SupportingDocumentsWidget,
    title: 'Supporting Documents',
    description: 'Document list with refresh and source filters.',
  },
  'secure-messaging': {
    id: 'secure-messaging',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: SecureMessagingWidget,
    title: 'Secure Messaging',
    description: 'Inbox, sent, and deleted threads with compose and attachments.',
  },
  'case-notes': {
    id: 'case-notes',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: CaseNotesWidget,
    title: 'Notes and Tasks',
    description: 'Case notes and lightweight tasks.',
  },
  'case-calendar': {
    id: 'case-calendar',
    defaultRowSpan: 5,
    defaultColumnSpan: 2,
    component: CaseCalendarWidget,
    title: 'Case Calendar',
    description: 'Calendar and list view of reminders and deadlines.',
  },
  'application-events': {
    id: 'application-events',
    defaultRowSpan: 5,
    defaultColumnSpan: 4, // widened per requirement
    component: ApplicationEvents,
    title: 'Events Timeline',
    description: 'Timeline of status changes and related case events.',
  },
};

const defaultLayout = [
  { id: 'application-overview', rowSpan: 2, columnSpan: 4 },
  { id: 'iset-application-form', rowSpan: 5, columnSpan: 2 },
  { id: 'coordinator-assessment', rowSpan: 5, columnSpan: 2 },
  { id: 'supporting-documents', rowSpan: 5, columnSpan: 2 },
  { id: 'secure-messaging', rowSpan: 5, columnSpan: 2 },
  { id: 'case-notes', rowSpan: 5, columnSpan: 2 },
  { id: 'case-calendar', rowSpan: 5, columnSpan: 2 },
  { id: 'application-events', rowSpan: 5, columnSpan: 4 },
];

const reviewAssessmentLayout = [
  { id: 'application-overview', rowSpan: 3, columnSpan: 4 },
  { id: 'iset-application-form', rowSpan: 6, columnSpan: 2 },
  { id: 'coordinator-assessment', rowSpan: 6, columnSpan: 2 },
];

const documentsMessagesLayout = [
  { id: 'application-overview', rowSpan: 3, columnSpan: 4 },
  { id: 'supporting-documents', rowSpan: 6, columnSpan: 2 },
  { id: 'secure-messaging', rowSpan: 6, columnSpan: 2 },
];

const notesCalendarLayout = [
  { id: 'application-overview', rowSpan: 3, columnSpan: 4 },
  { id: 'case-notes', rowSpan: 6, columnSpan: 2 },
  { id: 'case-calendar', rowSpan: 6, columnSpan: 2 },
];

const auditTrailLayout = [
  { id: 'application-overview', rowSpan: 3, columnSpan: 4 },
  { id: 'iset-application-form', rowSpan: 6, columnSpan: 2 },
  { id: 'application-events', rowSpan: 6, columnSpan: 2 },
];

const QUICK_ACTION_LAYOUTS = {
  reviewAssessment: reviewAssessmentLayout,
  documentsMessages: documentsMessagesLayout,
  notesCalendar: notesCalendarLayout,
  auditTrail: auditTrailLayout,
};

const exportLayout = (items = []) =>
  items.map(({ id, rowSpan, columnSpan, columnOffset }) => ({
    id,
    rowSpan,
    columnSpan,
    columnOffset,
  }));

const toBoardItems = (layout = []) =>
  layout
    .map(item => {
      const def = widgetRegistry[item.id];
      if (!def) return null;
      return {
        id: def.id,
        rowSpan: item.rowSpan ?? def.defaultRowSpan,
        columnSpan: item.columnSpan ?? def.defaultColumnSpan,
        columnOffset: item.columnOffset,
        data: {
          title: def.title,
          description: def.description,
        },
      };
    })
    .filter(Boolean);

const loadLayoutFromStorage = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter(entry => entry && widgetRegistry[entry.id]);
      return filtered.length ? filtered : null;
    }
  } catch (err) {
    console.error('[ApplicationCaseDashboard] Failed to parse stored layout', err);
  }
  return null;
};

const computePaletteItems = (layout = []) =>
  Object.values(widgetRegistry)
    .filter(def => !layout.some(entry => entry.id === def.id))
    .map(def => ({
      id: def.id,
      data: { title: def.title, description: def.description },
    }));

const areLayoutsEqual = (a = [], b = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i];
    const right = b[i];
    if (!left || !right || left.id !== right.id) return false;
    if ((left.rowSpan ?? null) !== (right.rowSpan ?? null)) return false;
    if ((left.columnSpan ?? null) !== (right.columnSpan ?? null)) return false;
    if ((left.columnOffset ?? null) !== (right.columnOffset ?? null)) return false;
  }
  return true;
};

const boardI18nStrings = {
  liveAnnouncementDndStarted: operationType => (operationType === 'resize' ? 'Resizing' : 'Dragging'),
  liveAnnouncementDndItemReordered: operation => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item moved to ${operation.direction === 'horizontal' ? columns : rows}.`;
  },
  liveAnnouncementDndItemResized: operation => {
    const columnsConstraint = operation.isMinimalColumnsReached ? ' (minimal)' : '';
    const rowsConstraint = operation.isMinimalRowsReached ? ' (minimal)' : '';
    const sizeAnnouncement =
      operation.direction === 'horizontal'
        ? `columns ${operation.placement.width}${columnsConstraint}`
        : `rows ${operation.placement.height}${rowsConstraint}`;
    return `Item resized to ${sizeAnnouncement}.`;
  },
  liveAnnouncementDndItemInserted: operation => {
    const columns = `column ${operation.placement.x + 1}`;
    const rows = `row ${operation.placement.y + 1}`;
    return `Item inserted to ${columns}, ${rows}.`;
  },
  liveAnnouncementDndCommitted: operationType => `${operationType} committed`,
  liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`,
  liveAnnouncementItemRemoved: op => `Removed item ${op.item.data.title}.`,
  navigationAriaLabel: 'Application assessment dashboard navigation',
  navigationAriaDescription: 'Use arrow keys to move between widgets.',
  navigationItemAriaLabel: item => (item ? item.data.title : 'Empty'),
};

const ApplicationCaseDashboard = ({ toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, setAvailableItems }) => {
  const { id } = useParams(); // id = iset_case.id
  const location = useLocation();
  const history = useHistory();
  const [caseData, setCaseData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [appRowVersion, setAppRowVersion] = useState(0);
  const [flashItems, setFlashItems] = useState([]);
  const [layout, setLayout] = useState(() => loadLayoutFromStorage() ?? defaultLayout);
  const paletteSignatureRef = useRef(JSON.stringify(computePaletteItems(layout)));
  const cacheRef = useRef(typeof window !== 'undefined' ? (window.__ISET_CASE_CACHE || (window.__ISET_CASE_CACHE = new Map())) : new Map());
  const inflightRef = useRef(typeof window !== 'undefined' ? (window.__ISET_CASE_INFLIGHT || (window.__ISET_CASE_INFLIGHT = new Map())) : new Map());

  const boardItems = useMemo(() => toBoardItems(layout), [layout]);
  const paletteItems = useMemo(() => computePaletteItems(layout), [layout]);

  useEffect(() => {
    const message = location?.state?.flashMessage;
    if (!message) return;
    setFlashItems([
      {
        type: location.state.flashType || 'success',
        dismissible: true,
        content: message,
      },
    ]);
    history.replace({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: {},
    });
  }, [history, location]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (err) {
      console.error('[ApplicationCaseDashboard] Failed to persist layout', err);
    }
  }, [layout]);

  useEffect(() => {
    const signature = JSON.stringify(paletteItems);
    if (paletteSignatureRef.current !== signature) {
      paletteSignatureRef.current = signature;
      if (typeof setAvailableItems === 'function') {
        try {
          setAvailableItems(paletteItems);
        } catch (_) {}
      }
    }
  }, [paletteItems, setAvailableItems]);

  useEffect(() => {
    const handleAdd = event => {
      const widgetId = event?.detail?.id;
      if (!widgetId || !widgetRegistry[widgetId]) return;
      setLayout(current => {
        if (current.some(item => item.id === widgetId)) return current;
        return [...current, { id: widgetId }];
      });
    };
    window.addEventListener('applicationAssessment:palette:add', handleAdd);
    return () => window.removeEventListener('applicationAssessment:palette:add', handleAdd);
  }, []);

  const handleItemsChange = ({ detail }) => {
    if (!detail || !Array.isArray(detail.items)) return;
    const nextLayout = exportLayout(detail.items);
    setLayout(current => (areLayoutsEqual(current, nextLayout) ? current : nextLayout));
  };

  const bumpRowVersion = useCallback((version) => {
    const numeric = Number(version || 0);
    if (!numeric) return;
    setAppRowVersion(prev => (numeric > prev ? numeric : prev));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(current => (areLayoutsEqual(current, defaultLayout) ? current : defaultLayout));
    const defaultPalette = computePaletteItems(defaultLayout);
    paletteSignatureRef.current = JSON.stringify(defaultPalette);
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(defaultPalette);
      } catch (_) {}
    }
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  }, [setAvailableItems]);

  useEffect(() => {
    let shouldReset = false;
    try {
      shouldReset = window.sessionStorage?.getItem(TUTORIAL_APP_LAYOUT_RESET_FLAG) === '1';
      if (shouldReset) {
        window.sessionStorage?.removeItem(TUTORIAL_APP_LAYOUT_RESET_FLAG);
      }
    } catch (_) {
      shouldReset = false;
    }
    if (shouldReset) {
      resetLayout();
    }
  }, [id, resetLayout]);

  const applyLayout = useCallback(
    nextLayout => {
      if (!Array.isArray(nextLayout) || nextLayout.length === 0) return;
      setLayout(current => (areLayoutsEqual(current, nextLayout) ? current : [...nextLayout]));
    },
    [setLayout]
  );

  const openPalette = useCallback(() => {
    if (typeof setAvailableItems === 'function') {
      try {
        setAvailableItems(paletteItems);
      } catch (_) {}
    }
    if (typeof setSplitPanelOpen === 'function') {
      setSplitPanelOpen(true);
    }
  }, [paletteItems, setAvailableItems, setSplitPanelOpen]);

  useEffect(() => {
    const handleOpenPalette = () => openPalette();
    const handleResetLayout = () => resetLayout();
    const handleSetLayout = event => {
      const detail = event?.detail || {};
      const nextLayout = Array.isArray(detail.layout) ? detail.layout : QUICK_ACTION_LAYOUTS[detail.layoutId];
      if (nextLayout) {
        applyLayout(nextLayout);
      }
    };
    window.addEventListener('applicationAssessment:openPalette', handleOpenPalette);
    window.addEventListener('applicationAssessment:resetLayout', handleResetLayout);
    window.addEventListener('applicationAssessment:set-layout', handleSetLayout);
    return () => {
      window.removeEventListener('applicationAssessment:openPalette', handleOpenPalette);
      window.removeEventListener('applicationAssessment:resetLayout', handleResetLayout);
      window.removeEventListener('applicationAssessment:set-layout', handleSetLayout);
    };
  }, [applyLayout, openPalette, resetLayout]);

  const handleCaseUpdate = updates => {
    setCaseData(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      if (updates && Object.prototype.hasOwnProperty.call(updates, 'application_row_version')) {
        const incomingVersion = Number(updates.application_row_version || 0);
        if (incomingVersion && incomingVersion > appRowVersion) {
          setAppRowVersion(incomingVersion);
        }
      }
      const key = prev.id || id;
      if (key) {
        cacheRef.current.set(String(key), next);
      }
      return next;
    });
  };

  const applyCaseDataIfNewer = (key, nextData) => {
    const current = cacheRef.current.get(key);
    const currentVersion = Number(current?.application_row_version ?? 0) || 0;
    const nextVersion = Number(nextData?.application_row_version ?? 0) || 0;
    // If we have a version and the incoming payload is older, ignore it to prevent stale overwrites.
    if (currentVersion && nextVersion && nextVersion < currentVersion) {
      return current || nextData;
    }
    cacheRef.current.set(key, nextData);
    if (nextVersion && nextVersion > appRowVersion) {
      setAppRowVersion(nextVersion);
    }
    return nextData;
  };

  const loadCaseResponse = useCallback(async (caseId, { retries = 3 } = {}) => {
    let attempt = 0;
    while (true) {
      try {
        console.info('[case:ui] requesting case', { caseId, attempt: attempt + 1, retries: retries + 1 });
        const res = await apiFetch(`/api/cases/${caseId}`);
        console.info('[case:ui] response received', { caseId, status: res.status, ok: res.ok, attempt: attempt + 1 });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          return { status: res.status, headers: res.headers, data };
        }
        if (res.status >= 500 && attempt < retries) {
          attempt += 1;
          const waitMs = 250 * Math.pow(2, attempt - 1);
          console.warn('[case:ui] transient server response, retrying', { caseId, status: res.status, waitMs, attempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        const body = await res.json().catch(() => null);
        const err = new Error(body?.error || body?.message || `Case request failed (${res.status})`);
        err.status = res.status;
        err.body = body;
        err.headers = res.headers;
        throw err;
      } catch (err) {
        const status = typeof err?.status === 'number' ? err.status : null;
        const message = typeof err?.message === 'string' ? err.message : null;
        if ((status === null || status >= 500) && attempt < retries) {
          attempt += 1;
          const waitMs = 250 * Math.pow(2, attempt - 1);
          console.warn('[case:ui] request failed, retrying', { caseId, status, message, waitMs, attempt: attempt + 1 });
          await new Promise(resolve => setTimeout(resolve, waitMs));
          continue;
        }
        console.error('[case:ui] case load failed after retries', { caseId, status, message, attempts: attempt + 1 });
        throw err;
      }
    }
  }, []);

  const refreshCaseData = useCallback(async () => {
    if (!id) return null;
    try {
      const { data } = await loadCaseResponse(id, { retries: 1 });
      if (!data.assigned_user_email && location?.state?.assessorEmail) {
        data.assigned_user_email = location.state.assessorEmail;
      }
      const applicationStatus =
        data.applicationStatus ?? data.application_status ?? null;
      const normalised = { ...data, applicationStatus, application_status: applicationStatus ?? data.application_status ?? null };
      const applied = applyCaseDataIfNewer(String(id), normalised);
      setCaseData(applied);
      const incomingVersion = Number(normalised.application_row_version || 0);
      if (incomingVersion && incomingVersion > appRowVersion) {
        setAppRowVersion(incomingVersion);
      }
      setLoadError(null);
      return applied;
    } catch (err) {
      let message = 'Failed to refresh case';
      const body = err?.body || null;
      if (body) message = body?.error || body?.message || message;
      else if (err?.message) message = err.message;
      if (err?.status && err.status !== 200) {
        message = `${message} (${err.status})`;
      }
      setLoadError(message);
      return null;
    }
  }, [id, location?.state?.assessorEmail, loadCaseResponse]);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    setLoadError(null);
    const key = String(id);

    // Show cached data immediately if we have it, but still fetch fresh data
    if (cacheRef.current.has(key)) {
      setCaseData(cacheRef.current.get(key));
    }

    const doFetch = async () => {
      try {
        if (!inflightRef.current.has(key)) {
          inflightRef.current.set(key, loadCaseResponse(id, { retries: 1 }));
        }
        const { data } = await inflightRef.current.get(key);
        if (!data || typeof data !== 'object') {
          throw new Error('Case API returned an invalid payload.');
        }
        const hydrated = { ...data };
        if (!isMounted) return;
        if (!hydrated.assigned_user_email && location?.state?.assessorEmail) {
          hydrated.assigned_user_email = location.state.assessorEmail;
        }
        const applicationStatus =
          hydrated.applicationStatus ?? hydrated.application_status ?? null;
        const normalised = { ...hydrated, applicationStatus, application_status: applicationStatus ?? hydrated.application_status ?? null };
        const applied = applyCaseDataIfNewer(key, normalised);
        setCaseData(applied);
        const incomingVersion = Number(normalised.application_row_version || 0);
        if (incomingVersion && incomingVersion > appRowVersion) {
          setAppRowVersion(incomingVersion);
        }
        setLoadError(null);
        if (updateBreadcrumbs) {
          try {
            updateBreadcrumbs([
              { text: 'Home', href: '/' },
              { text: 'Application Management', href: '/case-management' },
              { text: normalised.tracking_id || id },
            ]);
          } catch (breadcrumbErr) {
            console.error('[case:ui] breadcrumb update failed', {
              caseId: id,
              message: breadcrumbErr?.message || String(breadcrumbErr),
            });
          }
        }
      } catch (resErr) {
        if (!isMounted) return;
        setCaseData(cacheRef.current.get(key) || null);
        try {
          const body = resErr?.body || null;
          const statusSuffix = resErr?.status ? ` (${resErr.status})` : '';
          const fallbackMessage =
            'Failed to load application. Probably a glitch. Please refresh the page to try again. If the problem persists please contact support.';
          const rawMessage = body?.error || body?.message || resErr?.message || fallbackMessage;
          const userMessage = rawMessage === 'Failed to load case' ? fallbackMessage : rawMessage;
          const traceFromBody = body?.trace_id ? ` [trace ${body.trace_id}]` : '';
          const traceFromHeader = typeof resErr?.headers?.get === 'function'
            ? (resErr.headers.get('x-case-trace-id') ? ` [trace ${resErr.headers.get('x-case-trace-id')}]` : '')
            : '';
          setLoadError(`${userMessage}${statusSuffix}${traceFromBody || traceFromHeader}`);
          console.error('[case:ui] failed to load case payload', {
            caseId: id,
            status: resErr?.status || null,
            traceId: body?.trace_id || (typeof resErr?.headers?.get === 'function' ? resErr.headers.get('x-case-trace-id') : null) || null,
            body,
          });
        } catch (_) {
          const statusSuffix = resErr?.status ? ` (${resErr.status})` : '';
          const networkMessage = typeof resErr?.message === 'string' ? resErr.message : '';
          const composed = networkMessage
            ? `Failed to load application. ${networkMessage}${statusSuffix}`
            : `Failed to load application. Probably a glitch. Please refresh the page to try again. If the problem persists please contact support.${statusSuffix}`;
          setLoadError(composed);
          console.error('[case:ui] failed to load case (non-response error)', {
            caseId: id,
            status: resErr?.status || null,
            message: networkMessage || null,
            error: resErr,
          });
        }
      } finally {
        inflightRef.current.delete(key);
      }
    };
    doFetch();
    return () => {
      isMounted = false;
    };
  }, [id, location?.state?.assessorEmail, updateBreadcrumbs]);

  useEffect(() => {
    setLayout(current => current); // ensure board rerenders when caseData changes
  }, [caseData]);

  const lockApplicationId = caseData?.application_id ?? caseData?.applicationId ?? null;

  useEffect(() => {
    return () => {
      if (!lockApplicationId) return;
      apiFetch(`/api/locks/application/${lockApplicationId}`, { method: 'DELETE' }).catch(() => {});
    };
  }, [lockApplicationId]);

  const renderBoardItem = (item, actions) => {
    if (!item?.id) return null;
    const definition = widgetRegistry[item.id];
    if (!definition) return null;
    const WidgetComponent = definition.component;
    return (
      <WidgetComponent
        actions={actions}
        application_id={caseData?.application_id ?? null}
        caseData={caseData}
        toggleHelpPanel={toggleHelpPanel}
        assessorEmail={caseData?.assigned_user_email || null}
        refreshCaseData={refreshCaseData}
        onCaseUpdate={handleCaseUpdate}
        applicationRowVersion={appRowVersion}
        onRowVersionUpdate={bumpRowVersion}
      />
    );
  };

  if (!caseData) {
    return (
      <ContentLayout>
        <SpaceBetween size="l">
          {loadError ? (
            <Box color="text-status-critical">{loadError}</Box>
          ) : (
            <Box>Loading…</Box>
          )}
        </SpaceBetween>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        {flashItems.length ? (
          <Flashbar
            items={flashItems}
            onDismiss={({ detail }) => {
              setFlashItems((items) => items.filter((_, index) => index !== detail.itemIndex));
            }}
          />
        ) : null}
        <Board
          items={boardItems}
          onItemsChange={handleItemsChange}
          renderItem={renderBoardItem}
          i18nStrings={boardI18nStrings}
          empty={<Box>No widgets</Box>}
        />
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ApplicationCaseDashboard;
