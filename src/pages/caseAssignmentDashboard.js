import React from 'react';
import { ContentLayout } from '@cloudscape-design/components';
import ApplicationsWidget from '../widgets/ApplicationsWidget';

const CaseAssignmentDashboard = ({ toggleHelpPanel }) => (
  <ContentLayout>
    <ApplicationsWidget
      refreshKey={0}
      toggleHelpPanel={toggleHelpPanel}
    />
  </ContentLayout>
);

export default CaseAssignmentDashboard;
