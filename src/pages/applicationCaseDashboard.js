import React, { useEffect, useState } from 'react';
import { ContentLayout, SpaceBetween, Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import { apiFetch } from '../auth/apiClient';
import ApplicationOverviewWidget from '../widgets/ApplicationOverviewWidget';
import IsetApplicationFormWidget from '../widgets/IsetApplicationFormWidget';
import CoordinatorAssessmentWidget from '../widgets/CoordinatorAssessmentWidget';
import SupportingDocumentsWidget from '../widgets/SupportingDocumentsWidget';

const DEFAULT_ITEMS = [
  { id: 'application-overview', rowSpan: 2, columnSpan: 4 },
  { id: 'iset-application-form', rowSpan: 5, columnSpan: 2 },
  { id: 'coordinator-assessment', rowSpan: 5, columnSpan: 2 },
  { id: 'supporting-documents', rowSpan: 5, columnSpan: 2 }
];

const TITLES = {
  'application-overview': 'Application Overview',
  'iset-application-form': 'ISET Application Form',
  'coordinator-assessment': 'Coordinator Assessment',
  'supporting-documents': 'Supporting Documents'
};

const buildItems = (caseData) => DEFAULT_ITEMS.map(item => ({
  ...item,
  data: {
    title: TITLES[item.id],
    application_id: caseData?.application_id ?? null,
    caseData: caseData ?? null
  }
}));

const ApplicationCaseDashboard = ({ toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams(); // id = iset_case.id
  const [caseData, setCaseData] = useState(null);
  const [boardItems, setBoardItems] = useState(buildItems(null));

  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    apiFetch(`/api/cases/${id}`)
      .then(res => (res.ok ? res.json() : Promise.reject(res)))
      .then(data => {
        if (!isMounted) return;
        setCaseData(data);
        updateBreadcrumbs && updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Application Management', href: '/case-management' },
          { text: data.tracking_id || id }
        ]);
      })
      .catch(() => {
        if (isMounted) setCaseData(null);
      });
    return () => { isMounted = false; };
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    setBoardItems(buildItems(caseData));
  }, [caseData]);

  if (!caseData) {
    return <div>Loading...</div>;
  }

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        <Board
          items={boardItems}
          onItemsChange={event => setBoardItems(event.detail.items)}
          renderItem={(item, actions) => {
            if (item.id === 'application-overview') {
              return (
                <ApplicationOverviewWidget
                  actions={actions}
                  application_id={item.data.application_id}
                  caseData={item.data.caseData}
                />
              );
            }
            if (item.id === 'iset-application-form') {
              return (
                <IsetApplicationFormWidget
                  actions={actions}
                  application_id={item.data.application_id}
                  caseData={item.data.caseData}
                  toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'coordinator-assessment') {
              return (
                <CoordinatorAssessmentWidget
                  actions={actions}
                  caseData={item.data.caseData}
                  application_id={item.data.application_id}
                  toggleHelpPanel={toggleHelpPanel}
                />
              );
            }
            if (item.id === 'supporting-documents') {
              return (
                <SupportingDocumentsWidget
                  actions={actions}
                  caseData={item.data.caseData}
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
            liveAnnouncementDndDiscarded: operationType => `${operationType} discarded`
          }}
        />
        <Box variant="p">
          Use this workspace to review the submitted application, complete the coordinator assessment, and manage supporting documents for the applicant.
        </Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ApplicationCaseDashboard;
