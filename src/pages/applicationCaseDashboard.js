import React, { useEffect, useState } from 'react';
import { ContentLayout, SpaceBetween, Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import IsetApplicationFormWidget from '../widgets/IsetApplicationFormWidget';
import SupportingDocumentsWidget from '../widgets/SupportingDocumentsWidget';
import ApplicationEvents from '../widgets/applicationEvents';
import SecureMessagesWidget from '../widgets/SecureMessagesWidget';
import CoordinatorAssessmentWidget from '../widgets/CoordinatorAssessmentWidget';

const ApplicationCaseDashboard = ({ toggleHelpPanel, updateBreadcrumbs }) => {
  const { id } = useParams(); // id = iset_case.id
  const [caseData, setCaseData] = useState(null);
  const [boardItems, setBoardItems] = useState([
    { id: 'iset-application-form', rowSpan: 6, columnSpan: 2, data: { title: 'ISET Application Form', application_id: caseData?.application_id, caseData } }
  ]);

  useEffect(() => {
    if (!id) return;
    fetch(`${process.env.REACT_APP_API_BASE_URL}/api/cases/${id}`)
      .then(res => res.json())
      .then(data => {
        setCaseData(data);
        updateBreadcrumbs && updateBreadcrumbs([
          { text: 'Home', href: '/' },
          { text: 'Application Management', href: '/case-management' },
          { text: data.tracking_id || id }
        ]);
      })
      .catch(err => setCaseData(null));
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    if (caseData) {
      setBoardItems([
        { id: 'iset-application-form', rowSpan: 6, columnSpan: 2, data: { title: 'ISET Application Form', application_id: caseData.application_id, caseData } },
        { id: 'coordinator-assessment', rowSpan: 6, columnSpan: 2, data: { title: 'Coordinator Assessment', application_id: caseData.application_id, caseData } },
        { id: 'supporting-documents', rowSpan: 3, columnSpan: 2, data: { title: 'Supporting Documents', application_id: caseData.application_id, caseData } },
        { id: 'secure-messages', rowSpan: 3, columnSpan: 2, data: { title: 'Secure Messages', application_id: caseData.application_id, caseData } },
        { id: 'application-events', rowSpan: 4, columnSpan: 4, data: { title: 'Events', application_id: caseData.application_id, caseData } }
      ]);
    }
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
            if (item.id === 'iset-application-form') {
              return <IsetApplicationFormWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} toggleHelpPanel={toggleHelpPanel} />;
            }
            if (item.id === 'coordinator-assessment') {
              return <CoordinatorAssessmentWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} toggleHelpPanel={toggleHelpPanel} />;
            }
            if (item.id === 'supporting-documents') {
              return <SupportingDocumentsWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} />;
            }
            if (item.id === 'application-events') {
              return <ApplicationEvents actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} />;
            }
            if (item.id === 'secure-messages') {
              return <SecureMessagesWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} toggleHelpPanel={toggleHelpPanel} />;
            }
            return null;
          }}
          i18nStrings={{
            liveAnnouncementDndStarted: (operationType) =>
              operationType === 'resize' ? 'Resizing' : 'Dragging',
            liveAnnouncementDndItemReordered: () => 'Item moved.',
            liveAnnouncementDndItemResized: () => 'Item resized.',
            liveAnnouncementDndItemInserted: () => 'Item inserted.',
            liveAnnouncementDndCommitted: (operationType) => `${operationType} committed`,
            liveAnnouncementDndDiscarded: (operationType) => `${operationType} discarded`,
          }}
        />
        <Box variant="p">This dashboard will allow you to view and adjudicate the ISET application form data and supporting documentation for the individual submitting the application. Widgets will be added here.</Box>
      </SpaceBetween>
    </ContentLayout>
  );
};

export default ApplicationCaseDashboard;
