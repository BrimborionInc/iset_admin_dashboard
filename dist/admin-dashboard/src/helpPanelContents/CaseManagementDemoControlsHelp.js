import React from 'react';
import { Box, Header } from '@cloudscape-design/components';

const CaseManagementDemoControlsHelp = () => (
  <Box>
    <Header variant="h3">Testing and Demo Controls Help</Header>
    <Box variant="p" margin={{ top: 's' }}>
      This widget is for development and demonstration purposes only. It allows you to change which evaluator is viewing this page without logging out and back in each time. This widget will not be included in the final production solution.
    </Box>
  </Box>
);

export default CaseManagementDemoControlsHelp;
