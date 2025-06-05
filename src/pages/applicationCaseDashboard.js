import React, { useEffect, useState } from 'react';
import { ContentLayout, Header, SpaceBetween, Box } from '@cloudscape-design/components';
import Board from '@cloudscape-design/board-components/board';
import { useParams } from 'react-router-dom';
import IsetApplicationFormWidget from '../widgets/IsetApplicationFormWidget';
import SupportingDocumentsWidget from '../widgets/SupportingDocumentsWidget';
import ApplicationEvents from '../widgets/applicationEvents';

const ApplicationCaseDashboard = ({ headerInfo, updateBreadcrumbs }) => {
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
          { text: 'Case Management', href: '/case-management' },
          { text: `Application ${data.tracking_id || id}` }
        ]);
      })
      .catch(err => setCaseData(null));
  }, [id, updateBreadcrumbs]);

  useEffect(() => {
    if (caseData) {
      setBoardItems([
        { id: 'iset-application-form', rowSpan: 6, columnSpan: 2, data: { title: 'ISET Application Form', application_id: caseData.application_id, caseData } },
        { id: 'supporting-documents', rowSpan: 6, columnSpan: 2, data: { title: 'Supporting Documents', application_id: caseData.application_id, caseData } },
        { id: 'application-events', rowSpan: 4, columnSpan: 4, data: { title: 'Events', application_id: caseData.application_id, caseData } }
      ]);
    }
  }, [caseData]);

  if (!caseData) {
    return <div>Loading...</div>;
  }

  return (
    <ContentLayout
      header={
        <Header variant="h1" info={headerInfo}>
          Application {caseData.tracking_id || id}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Board
          items={boardItems}
          onItemsChange={event => setBoardItems(event.detail.items)}
          renderItem={(item, actions) => {
            if (item.id === 'iset-application-form') {
              return <IsetApplicationFormWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} />;
            }
            if (item.id === 'supporting-documents') {
              return <SupportingDocumentsWidget actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} />;
            }
            if (item.id === 'application-events') {
              return <ApplicationEvents actions={actions} application_id={item.data.application_id} caseData={item.data.caseData} />;
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
