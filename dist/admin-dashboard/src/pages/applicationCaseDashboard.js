import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ContentLayout, SpaceBetween, Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams, useLocation } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewWidget from '../widgets/ApplicationOverviewWidget';
import IsetApplicationFormWidget from '../widgets/IsetApplicationFormWidget';
import CoordinatorAssessmentWidget from '../widgets/CoordinatorAssessmentWidget';
import SupportingDocumentsWidget from '../widgets/SupportingDocumentsWidget';
import SecureMessagingWidget from '../widgets/SecureMessagingWidget';
import CaseNotesWidget from '../widgets/CaseNotesWidget';
import ApplicationEvents from '../widgets/applicationEvents';

// All widgets available for this dashboard (for palette)
const ALL_WIDGETS = [
  { id: 'application-overview', title: 'Application Overview', rowSpan: 2, columnSpan: 4 },
  { id: 'iset-application-form', title: 'ISET Application Form', rowSpan: 5, columnSpan: 2 },
  { id: 'coordinator-assessment', title: 'Application Assessment', rowSpan: 5, columnSpan: 2 },
  { id: 'supporting-documents', title: 'Supporting Documents', rowSpan: 5, columnSpan: 2 },
  { id: 'secure-messaging', title: 'Secure Messaging', rowSpan: 5, columnSpan: 2 },
  { id: 'case-notes', title: 'Case Notes', rowSpan: 5, columnSpan: 2 },
  { id: 'application-events', title: 'Application Events', rowSpan: 5, columnSpan: 2 }
];

const DEFAULT_ITEMS = [
  { id: 'application-overview', rowSpan: 2, columnSpan: 4 },
  { id: 'iset-application-form', rowSpan: 5, columnSpan: 2 },
  { id: 'coordinator-assessment', rowSpan: 5, columnSpan: 2 },
  { id: 'supporting-documents', rowSpan: 5, columnSpan: 2 },
  { id: 'secure-messaging', rowSpan: 5, columnSpan: 2 },
  { id: 'case-notes', rowSpan: 5, columnSpan: 2 },
  { id: 'application-events', rowSpan: 5, columnSpan: 2 }
];

const TITLES = {
  'application-overview': 'Application Overview',
  'iset-application-form': 'ISET Application Form',
  'coordinator-assessment': 'Application Assessment',
  'supporting-documents': 'Supporting Documents',
  'secure-messaging': 'Secure Messaging',
  'case-notes': 'Case Notes',
  'application-events': 'Application Events'
};

const buildItems = (caseData) => DEFAULT_ITEMS.map(item => ({
  ...item,
  data: {
    title: TITLES[item.id],
    application_id: caseData?.application_id ?? null,
    caseData: caseData ?? null,
    assessorEmail: caseData?.assigned_user_email || null
  }
}));

const ApplicationCaseDashboard = ({ toggleHelpPanel, updateBreadcrumbs, setSplitPanelOpen, setAvailableItems }) => {
  const { id } = useParams(); // id = iset_case.id
  const location = useLocation();
  const [caseData, setCaseData] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [boardItems, setBoardItems] = useState(buildItems(null));
  // Palette disabled in reverted version
  const fetchedRef = useRef(false);

  // No palette items in reverted version

  // Very lightweight dedupe/cache across remounts for the same case id
  const cacheRef = useRef(typeof window !== 'undefined' ? (window.__ISET_CASE_CACHE || (window.__ISET_CASE_CACHE = new Map())) : new Map());
  const inflightRef = useRef(typeof window !== 'undefined' ? (window.__ISET_CASE_INFLIGHT || (window.__ISET_CASE_INFLIGHT = new Map())) : new Map());

  const handleCaseUpdate = updates => {
    setCaseData(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...updates };
      const key = prev.id || id;
      if (key) {
        cacheRef.current.set(String(key), next);
      }
      return next;
    });
  };

  const refreshCaseData = useCallback(async () => {
    if (!id) return null;
    try {
      const res = await apiFetch(`/api/cases/${id}`);
      if (!res.ok) throw res;
      const data = await res.json();
      if (!data.assigned_user_email && location?.state?.assessorEmail) {
        data.assigned_user_email = location.state.assessorEmail;
      }
      cacheRef.current.set(String(id), data);
      setCaseData(data);
      setLoadError(null);
      return data;
    } catch (err) {
      let message = 'Failed to refresh case';
      if (err && typeof err.json === 'function') {
        try {
          const body = await err.json();
          message = body?.error || body?.message || message;
        } catch (_) {
          // ignore parse errors
        }
      }
      setLoadError(message);
      return null;
    }
  }, [id, location?.state?.assessorEmail]);

  useEffect(() => {
    if (!id) return;
    if (fetchedRef.current) return; // prevent repeated fetches in dev/strict-mode or remounts
    fetchedRef.current = true;
    let isMounted = true;
    setLoadError(null);
    // Serve from cache immediately if present
    const key = String(id);
    if (cacheRef.current.has(key)) {
      const cached = cacheRef.current.get(key);
      setCaseData(cached);
      return () => { isMounted = false; };
    }
    const doFetch = async () => {
      try {
        // Deduplicate in-flight requests
        if (!inflightRef.current.has(key)) {
          inflightRef.current.set(key, apiFetch(`/api/cases/${id}`).then(r => r));
        }
        const res = await inflightRef.current.get(key);
        inflightRef.current.delete(key);
        if (!res.ok) throw res;
        const data = await res.json();
        if (!isMounted) return;
        if (!data.assigned_user_email && location?.state?.assessorEmail) {
          data.assigned_user_email = location.state.assessorEmail;
        }
        cacheRef.current.set(key, data);
        setCaseData(data);
        setLoadError(null);
        updateBreadcrumbs && updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Application Management', href: '/case-management' },
          { text: data.tracking_id || id }
        ]);
      } catch (res) {
        if (!isMounted) return;
        setCaseData(cacheRef.current.get(key) || null);
        try {
          const body = res && res.json ? await res.json() : null;
          setLoadError(body?.error || body?.message || 'Failed to load case');
        } catch (_) {
          setLoadError('Failed to load case');
        }
      }
    };
    doFetch();
    return () => { isMounted = false; };
  }, [id, location?.state?.assessorEmail, updateBreadcrumbs]);

  useEffect(() => {
    setBoardItems(buildItems(caseData));
  }, [caseData]);

  // No add/remove events in reverted version

  // Avoid pushing palette items to parent automatically to prevent remount loops

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
        {/* Add/Remove widgets controls disabled in reverted version */}
        <Board
          items={boardItems}
          onItemsChange={event => {
            // Keep default behavior: accept board's items verbatim to avoid render loops
            setBoardItems(event.detail.items);
          }}
          renderItem={(item) => {
            if (item.id === 'application-overview') {
              return (
                <ApplicationOverviewWidget
                  actions={{ refreshCaseData }}
                  application_id={item.data.application_id}
                  caseData={item.data.caseData}
                   toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'iset-application-form') {
              return (
                <IsetApplicationFormWidget
                  actions={undefined}
                  application_id={item.data.application_id}
                  caseData={item.data.caseData}
                  toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'coordinator-assessment') {
              return (
                <CoordinatorAssessmentWidget
                  actions={{ refreshCaseData }}
                  caseData={item.data.caseData}
                  application_id={item.data.application_id}
                  toggleHelpPanel={toggleHelpPanel}
                  onCaseUpdate={handleCaseUpdate}
                  assessorEmail={item.data.assessorEmail}
                />
              );
            }
            if (item.id === 'supporting-documents') {
              return (
                <SupportingDocumentsWidget
                  actions={undefined}
                  caseData={item.data.caseData}
                   toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'secure-messaging') {
              return (
                <SecureMessagingWidget
                  actions={undefined}
                  caseData={item.data.caseData}
                   toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'case-notes') {
              return (
                <CaseNotesWidget
                  actions={undefined}
                  caseData={item.data.caseData}
                   toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'application-events') {
              return (
                <ApplicationEvents
                  actions={undefined}
                  application_id={item.data.application_id}
                  caseData={item.data.caseData}
                   toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            return null;
          }}
          i18nStrings={{
            liveAnnouncementDndStarted: operationType =>
              operationType === 'resize' ? 'Resizing' : 'Dragging',
            liveAnnouncementDndItemReordered: () => 'Item moved.',
            liveAnnouncementDndItemResized: () => 'Item resized.',
            liveAnnouncementDndItemInserted: () => 'Item inserted.',
            liveAnnouncementDndCommitted: operationType => `${operationType} committed`,
            liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`,
            liveAnnouncementItemRemoved: op => `Removed item ${op.item?.data?.title || ''}.`,
            navigationAriaLabel: 'Board navigation',
            navigationAriaDescription: 'Click on non-empty item to move focus over',
            navigationItemAriaLabel: item => (item ? item.data.title : 'Empty')
          }}
        />
        <Box variant="p">
          Use this workspace to review the submitted application, complete the Application Assessment, and manage supporting documents for the applicant.
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ApplicationCaseDashboard;


